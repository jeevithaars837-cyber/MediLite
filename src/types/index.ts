export type UserRole = 'patient' | 'doctor';

export type SymptomCategory = 
  | 'fever'
  | 'skin'
  | 'respiratory'
  | 'pain'
  | 'digestive'
  | 'injury'
  | 'other';

export type PriorityLevel = 'normal' | 'needs_attention' | 'urgent_review';

export type ConsultationStatus = 
  | 'submitted'
  | 'doctor_reviewing'
  | 'doctor_replied'
  | 'completed';

export type MessageKind = 
  | 'patient_message'
  | 'follow_up_question'
  | 'guidance'
  | 'system';

export type SyncState = 
  | 'queued'
  | 'syncing'
  | 'retry_scheduled'
  | 'needs_login'
  | 'failed_permanent'
  | 'synced';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: string;
  case_number: number;
  client_submission_id: string;
  patient_id: string;
  doctor_id?: string | null;
  category: SymptomCategory;
  symptoms: string;
  duration: string;
  additional_notes?: string | null;
  patient_age_years?: number | null;
  suggested_priority: PriorityLevel;
  priority?: PriorityLevel | null;
  status: ConsultationStatus;
  in_person_recommended: boolean;
  client_created_at: string;
  created_at: string;
  updated_at: string;
}

export interface ConsultationImage {
  id: string;
  client_image_id: string;
  consultation_id: string;
  storage_path: string;
  thumb_path?: string | null;
  original_size: number;
  compressed_size: number;
  mime_type: 'image/jpeg' | 'image/webp';
  width?: number | null;
  height?: number | null;
  created_at: string;
}

export interface Message {
  id: string;
  client_message_id: string;
  consultation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string;
  created_at: string;
  read_at?: string | null;
}

// Dexie IndexedDB Store Models
export interface LocalSubmission {
  clientSubmissionId: string;
  userId: string;
  category: SymptomCategory;
  symptoms: string;
  duration: string;
  additionalNotes?: string;
  patientAgeYears?: number;
  suggestedPriority: PriorityLevel;
  syncState: SyncState;
  createdAt: string;
  attempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  nextAttemptAt?: string;
  serverId?: string;
  caseNumber?: number;
}

export interface LocalImage {
  clientImageId: string;
  clientSubmissionId: string;
  fullBlob: Blob;
  thumbBlob: Blob;
  originalSize: number;
  compressedSize: number;
  mimeType: 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  uploaded: boolean;
  storagePath?: string;
  thumbPath?: string;
}

export interface OutboxItem {
  id: string;
  userId: string;
  type: 'submit_consultation' | 'send_message';
  payload: any;
  status: 'queued' | 'syncing' | 'failed';
  nextAttemptAt: string;
  attempts: number;
  createdAt: string;
}

export interface RemoteConsultationCache extends Consultation {
  userId: string;
}

export interface RemoteMessageCache extends Message {
  userId: string;
}

export interface MetaItem {
  key: string;
  value: any;
}

// Image compression types
export type CompressionPreset = 'low' | 'medium' | 'high';

export interface CompressionResult {
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  mime: 'image/jpeg' | 'image/webp';
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
}

// Triage pure function types
export interface TriageInput {
  symptoms: string;
  additionalNotes?: string | null;
  category?: SymptomCategory;
  patientAgeYears?: number | null;
}

export interface TriageResult {
  priority: PriorityLevel;
  hasRedFlags: boolean;
  matchedFlags: string[];
}
