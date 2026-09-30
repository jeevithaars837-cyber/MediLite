'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/sync/engine';
import { StatusBadge } from '@/components/patient/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Send, AlertTriangle, ShieldCheck, Image as ImageIcon, MessageSquare, CheckCircle } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

function SafeThumbnail({ blob, onClick }: { blob?: Blob; onClick: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob || !(blob instanceof Blob)) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (!url) return null;

  return (
    <div
      onClick={() => onClick(url)}
      className="w-20 h-20 bg-slate-950 rounded-xl overflow-hidden border border-slate-700 cursor-pointer hover:border-brand-400 transition-colors"
    >
      <img src={url} alt="Thumb" className="w-full h-full object-cover" />
    </div>
  );
}

export default function PatientConsultationDetailPage({ params }: { params?: Promise<{ clientSubmissionId: string }> }) {
  const routeParams = useParams();
  const clientSubmissionId = (routeParams?.clientSubmissionId as string) || '';
  const router = useRouter();

  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Live queries from Dexie (safely guarded)
  const submission = useLiveQuery(
    () => (clientSubmissionId ? db.submissions.get(clientSubmissionId) : undefined),
    [clientSubmissionId]
  );
  const images = useLiveQuery(
    () => (clientSubmissionId ? db.images.where('clientSubmissionId').equals(clientSubmissionId).toArray() : []),
    [clientSubmissionId]
  ) || [];
  
  const remoteCons = useLiveQuery(
    () => (clientSubmissionId ? db.remote.filter((r) => r.client_submission_id === clientSubmissionId).first() : undefined),
    [clientSubmissionId]
  );
  const remoteMsgs = useLiveQuery(
    () => (remoteCons?.id ? db.remoteMessages.where('consultationId').equals(remoteCons.id).toArray() : []),
    [remoteCons?.id]
  ) || [];

  useEffect(() => {
    syncEngine.kick();
  }, [clientSubmissionId]);

  if (!submission && !remoteCons) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-slate-400 text-sm">Loading consultation record…</p>
      </div>
    );
  }

  const category = submission?.category || remoteCons?.category || 'other';
  const symptoms = submission?.symptoms || remoteCons?.symptoms || '';
  const duration = submission?.duration || remoteCons?.duration || '';
  const caseNumber = submission?.caseNumber || remoteCons?.case_number;
  const displayKey = caseNumber ? `CS-${caseNumber}` : `Local-${clientSubmissionId.slice(0, 4)}`;
  const syncState = submission?.syncState || 'synced';
  const serverStatus = remoteCons?.status || 'submitted';
  const inPersonRecommended = remoteCons?.in_person_recommended || false;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !remoteCons?.id) return;

    setIsSendingReply(true);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || submission?.userId || 'patient';
      const clientMessageId = crypto.randomUUID();

      const outboxItem = {
        id: crypto.randomUUID(),
        userId,
        type: 'send_message' as const,
        payload: {
          client_message_id: clientMessageId,
          consultation_id: remoteCons.id,
          kind: 'patient_message' as const,
          body: replyText.trim(),
        },
        status: 'queued' as const,
        nextAttemptAt: new Date().toISOString(),
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      await db.outbox.add(outboxItem);
      setReplyText('');
      syncEngine.kick();
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950/80 px-2 py-0.5 rounded border border-brand-800">
                {displayKey}
              </span>
              <span className="text-xs font-semibold capitalize text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                {category}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Created {new Date(submission?.createdAt || remoteCons?.created_at || Date.now()).toLocaleString()}
            </p>
          </div>
        </div>

        <StatusBadge syncState={syncState} serverStatus={serverStatus} />
      </div>

      {/* In-Person Care Recommendation Banner (§11) */}
      {inPersonRecommended && (
        <div className="bg-amber-950/90 border-2 border-amber-600 rounded-xl p-4 text-amber-100 shadow-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm text-amber-200">Doctor Recommends In-Person Visit</h4>
            <p className="text-xs text-amber-100 mt-1 leading-relaxed">
              {strings.safety.inPersonRecommendation}
            </p>
          </div>
        </div>
      )}

      {/* Consultation Summary Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Symptoms & Health Concern
          </h3>
          <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-normal">
            {symptoms}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Duration:</span>
            <span className="text-slate-200 ml-1 font-semibold">{duration}</span>
          </div>
          {submission?.patientAgeYears && (
            <div>
              <span className="text-slate-400 font-medium">Age:</span>
              <span className="text-slate-200 ml-1 font-semibold">{submission.patientAgeYears} yrs</span>
            </div>
          )}
        </div>

        {/* Photos Preview */}
        {images.length > 0 && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-brand-400" /> Attached Photos ({images.length})
            </h4>
            <div className="flex flex-wrap gap-3">
              {images.map((img) => (
                <SafeThumbnail
                  key={img.clientImageId}
                  blob={img.thumbBlob}
                  onClick={(url) => setSelectedImage(url)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Message Thread */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-400" /> Medical Discussion Thread
        </h3>

        {remoteMsgs.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 text-center text-xs text-slate-400">
            {syncState === 'synced'
              ? 'Waiting for a qualified healthcare professional to review your request.'
              : 'Your consultation will be submitted as soon as your device connects online.'}
          </div>
        ) : (
          <div className="space-y-3">
            {remoteMsgs.map((msg) => {
              const isDoctor = msg.kind === 'guidance' || msg.kind === 'follow_up_question' || msg.kind === 'system';
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl max-w-[85%] border text-xs leading-relaxed space-y-1 ${
                    isDoctor
                      ? 'bg-gradient-to-tr from-brand-950 to-slate-900 border-brand-800 text-slate-100 self-start'
                      : 'bg-slate-800 border-slate-700 text-slate-200 ml-auto'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-bold text-[11px]">
                    <span className={isDoctor ? 'text-brand-300' : 'text-slate-300'}>
                      {isDoctor ? 'Doctor / Healthcare Team' : 'You (Patient)'}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Patient Reply Box (Available once synced) */}
        {remoteCons?.id && (
          <form onSubmit={handleSendReply} className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Reply to doctor's question..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSendingReply || !replyText.trim()}
              className="bg-brand-600 hover:bg-brand-500 text-white p-2.5 rounded-xl font-semibold shadow transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Image Modal Lightbox */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={selectedImage} alt="Enlarged" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-slate-700" />
        </div>
      )}
    </div>
  );
}
