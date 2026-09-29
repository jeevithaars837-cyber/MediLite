import { db } from '../offline/db';
import { createClient } from '../supabase/client';
import { getLowDataMode } from '../network/probe';
import { SyncState, OutboxItem, LocalSubmission } from '@/types';

class SyncEngine {
  private isProcessing = false;
  private syncListeners: Array<() => void> = [];

  public subscribe(listener: () => void) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.syncListeners.forEach((l) => l());
  }

  public async kick() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('caresync_simulated_offline') === 'true') {
      console.log('[SyncEngine] Skipped kick: Simulated offline mode active');
      return;
    }
    await this.acquireLockAndProcess();
  }

  private async acquireLockAndProcess() {
    if (this.isProcessing) return;

    if ('locks' in navigator && navigator.locks.request) {
      try {
        await navigator.locks.request('caresync-sync', { ifAvailable: true }, async (lock) => {
          if (!lock) return;
          await this.processQueue();
        });
      } catch {
        await this.fallbackLockProcess();
      }
    } else {
      await this.fallbackLockProcess();
    }
  }

  private async fallbackLockProcess() {
    const leaseKey = 'caresync_sync_lease';
    const now = Date.now();
    const existing = localStorage.getItem(leaseKey);
    if (existing && parseInt(existing, 10) > now) {
      return; // Lock active
    }
    localStorage.setItem(leaseKey, (now + 15000).toString());
    try {
      await this.processQueue();
    } finally {
      localStorage.removeItem(leaseKey);
    }
  }

  public async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.notify();

    try {
      const nowIso = new Date().toISOString();
      const items = await db.outbox
        .where('status')
        .equals('queued')
        .filter((item) => item.nextAttemptAt <= nowIso)
        .toArray();

      if (items.length === 0) {
        this.isProcessing = false;
        this.notify();
        return;
      }

      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      for (const item of items) {
        if (!user && !item.userId) {
          // No user active
          await this.updateItemStatus(item, 'needs_login', 'No active authenticated user session');
          continue;
        }

        try {
          if (item.type === 'submit_consultation') {
            await this.handleSubmitConsultation(item, supabase, user?.id || item.userId);
          } else if (item.type === 'send_message') {
            await this.handleSendMessage(item, supabase, user?.id || item.userId);
          }
        } catch (err: any) {
          await this.handleError(item, err);
        }
      }

      // Delta pull after processing queue
      if (user) {
        await this.pullRemoteUpdates(user.id);
      }
    } catch (err) {
      console.error('[SyncEngine] Error in processQueue:', err);
    } finally {
      this.isProcessing = false;
      this.notify();
    }
  }

  private async handleSubmitConsultation(item: OutboxItem, supabase: any, userId: string) {
    const payload = item.payload;
    const clientSubmissionId = payload.client_submission_id;

    // 1. Update local submission state to 'syncing'
    await db.submissions.update(clientSubmissionId, {
      syncState: 'syncing',
    });
    this.notify();

    // 2. Fetch images belonging to this submission
    const localImages = await db.images
      .where('clientSubmissionId')
      .equals(clientSubmissionId)
      .toArray();

    const lowData = await getLowDataMode();
    const uploadTimeoutMs = lowData ? 90000 : 45000;

    const uploadedImagesPayload: any[] = [];

    for (const img of localImages) {
      const storagePath = img.storagePath || `${userId}/${clientSubmissionId}/${img.clientImageId}.webp`;
      const thumbPath = img.thumbPath || `${userId}/${clientSubmissionId}/${img.clientImageId}_thumb.webp`;

      if (!img.uploaded) {
        // Upload full blob to Supabase Storage
        const fullUpload = await this.uploadBlobWithTimeout(
          supabase,
          storagePath,
          img.fullBlob,
          img.mimeType,
          uploadTimeoutMs
        );
        if (fullUpload.error) throw fullUpload.error;

        // Upload thumb blob
        const thumbUpload = await this.uploadBlobWithTimeout(
          supabase,
          thumbPath,
          img.thumbBlob,
          img.mimeType,
          uploadTimeoutMs
        );
        if (thumbUpload.error) throw thumbUpload.error;

        await db.images.update(img.clientImageId, {
          uploaded: true,
          storagePath,
          thumbPath,
        });
      }

      uploadedImagesPayload.push({
        client_image_id: img.clientImageId,
        storage_path: storagePath,
        thumb_path: thumbPath,
        original_size: img.originalSize,
        compressed_size: img.compressedSize,
        mime_type: img.mimeType,
        width: img.width,
        height: img.height,
      });
    }

    // 3. Call RPC submit_consultation
    const rpcPayload = {
      ...payload,
      images: uploadedImagesPayload,
    };

    const { data: serverId, error } = await supabase.rpc('submit_consultation', {
      p: rpcPayload,
    });

    if (error) {
      // Check duplicate error
      if (error.code === '23505') {
        // Idempotent duplicate: fetch existing consultation
        const { data: existing } = await supabase
          .from('consultations')
          .select('id, case_number')
          .eq('client_submission_id', clientSubmissionId)
          .single();

        if (existing) {
          await this.markSubmissionSynced(clientSubmissionId, item.id, existing.id, existing.case_number);
          return;
        }
      }
      throw error;
    }

    // Fetch case number
    let caseNumber = 1000 + Math.floor(Math.random() * 9000);
    if (serverId) {
      const { data: consRow } = await supabase
        .from('consultations')
        .select('case_number')
        .eq('id', serverId)
        .single();
      if (consRow?.case_number) {
        caseNumber = consRow.case_number;
      }
    }

    // 4. Mark synced, delete outbox, prune full image blobs
    await this.markSubmissionSynced(clientSubmissionId, item.id, serverId || clientSubmissionId, caseNumber);
  }

  private async markSubmissionSynced(
    clientSubmissionId: string,
    outboxItemId: string,
    serverId: string,
    caseNumber: number
  ) {
    await db.submissions.update(clientSubmissionId, {
      syncState: 'synced',
      serverId,
      caseNumber,
    });

    await db.outbox.delete(outboxItemId);

    // Prune full blobs to conserve device storage, keep thumbnails
    const images = await db.images
      .where('clientSubmissionId')
      .equals(clientSubmissionId)
      .toArray();

    for (const img of images) {
      // replace fullBlob with thumbBlob or lightweight Blob to free memory
      await db.images.update(img.clientImageId, {
        fullBlob: img.thumbBlob,
      });
    }

    this.notify();
  }

  private async handleSendMessage(item: OutboxItem, supabase: any, userId: string) {
    const payload = item.payload;
    const { error } = await supabase.from('messages').insert({
      client_message_id: payload.client_message_id,
      consultation_id: payload.consultation_id,
      sender_id: userId,
      kind: payload.kind,
      body: payload.body,
    });

    if (error && error.code !== '23505') {
      throw error;
    }

    await db.outbox.delete(item.id);
    this.notify();
  }

  private async uploadBlobWithTimeout(
    supabase: any,
    path: string,
    blob: Blob,
    contentType: string,
    timeoutMs: number
  ) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await supabase.storage.from('consultation-images').upload(path, blob, {
        contentType,
        upsert: true,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  private async handleError(item: OutboxItem, error: any) {
    console.warn('[SyncEngine] Retryable / Permanent error occurred:', error);

    const code = error?.code || error?.status || '';
    const message = error?.message || 'Network request failed';

    // 1. Data invalid / check constraint -> permanent failure
    if (['400', '422', '23514', '22023', '22P02', 'PGRST102'].includes(code) || message.includes('check constraint')) {
      await this.updateItemStatus(item, 'failed_permanent', message);
      return;
    }

    // 2. RLS policy violation / 403
    if (code === '42501' || code === '403') {
      await this.updateItemStatus(item, 'failed_permanent', 'Permission denied');
      return;
    }

    // 3. Auth expired
    if (code === '401' || message.includes('JWT')) {
      await this.updateItemStatus(item, 'needs_login', 'Session expired. Please sign in again.');
      return;
    }

    // 4. Transient network error -> exponential backoff retry
    const attempts = (item.attempts || 0) + 1;
    const delaySec = Math.min(300, Math.pow(2, attempts) * 2) * (0.7 + Math.random() * 0.6);
    const nextAttemptAt = new Date(Date.now() + delaySec * 1000).toISOString();

    await db.outbox.update(item.id, {
      attempts,
      nextAttemptAt,
    });

    if (item.type === 'submit_consultation') {
      await db.submissions.update(item.payload.client_submission_id, {
        syncState: 'retry_scheduled',
        attempts,
        lastErrorCode: code,
        lastErrorMessage: message,
        nextAttemptAt,
      });
    }

    this.notify();
  }

  private async updateItemStatus(item: OutboxItem, syncState: SyncState, message: string) {
    if (item.type === 'submit_consultation') {
      await db.submissions.update(item.payload.client_submission_id, {
        syncState,
        lastErrorMessage: message,
      });
    }
    await db.outbox.update(item.id, {
      status: 'failed',
    });
    this.notify();
  }

  public async pullRemoteUpdates(userId: string) {
    try {
      const supabase = createClient();
      // Get max updated_at cursor from local remote store
      const lastRemote = await db.remote
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('updated_at');

      const cursor = lastRemote.length > 0 ? lastRemote[0].updated_at : '1970-01-01T00:00:00Z';

      const { data: consultations, error: consErr } = await supabase
        .from('consultations')
        .select('*')
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(50);

      if (consErr || !consultations) return;

      for (const cons of consultations) {
        await db.remote.put({
          ...cons,
          userId,
        });

        // Also update local submission status if matching
        const localSub = await db.submissions.get(cons.client_submission_id);
        if (localSub) {
          await db.submissions.update(cons.client_submission_id, {
            serverId: cons.id,
            caseNumber: cons.case_number,
            syncState: 'synced',
          });
        }

        // Fetch messages for this consultation
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('consultation_id', cons.id)
          .order('created_at', { ascending: true });

        if (msgs) {
          for (const m of msgs) {
            await db.remoteMessages.put({
              ...m,
              userId,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[SyncEngine] Pull failed (offline):', err);
    }
  }
}

export const syncEngine = new SyncEngine();
