import Dexie, { type EntityTable } from 'dexie';
import {
  LocalSubmission,
  LocalImage,
  OutboxItem,
  RemoteConsultationCache,
  RemoteMessageCache,
  MetaItem,
} from '@/types';

class CareSyncDatabase extends Dexie {
  submissions!: EntityTable<LocalSubmission, 'clientSubmissionId'>;
  images!: EntityTable<LocalImage, 'clientImageId'>;
  outbox!: EntityTable<OutboxItem, 'id'>;
  remote!: EntityTable<RemoteConsultationCache, 'id'>;
  remoteMessages!: EntityTable<RemoteMessageCache, 'id'>;
  meta!: EntityTable<MetaItem, 'key'>;

  constructor() {
    super('CareSyncDB');
    this.version(1).stores({
      submissions: 'clientSubmissionId, userId, syncState, createdAt',
      images: 'clientImageId, clientSubmissionId',
      outbox: 'id, userId, status, nextAttemptAt, createdAt',
      remote: 'id, userId, updatedAt',
      remoteMessages: 'id, consultationId, createdAt',
      meta: 'key',
    });
  }
}

export const db = new CareSyncDatabase();
