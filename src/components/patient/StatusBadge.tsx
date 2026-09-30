import { SyncState, ConsultationStatus } from '@/types';
import { CheckCircle2, RefreshCw, AlertTriangle, Clock, MessageSquare, CheckCheck } from 'lucide-react';

interface StatusBadgeProps {
  syncState: SyncState;
  serverStatus?: ConsultationStatus;
}

export function StatusBadge({ syncState, serverStatus }: StatusBadgeProps) {
  if (syncState === 'queued') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
        <span>Saved — waiting for network</span>
      </div>
    );
  }

  if (syncState === 'syncing') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
        <span>Sending…</span>
      </div>
    );
  }

  if (syncState === 'retry_scheduled') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span>Retrying automatically</span>
      </div>
    );
  }

  if (syncState === 'needs_login') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span>Sign in again to send</span>
      </div>
    );
  }

  if (syncState === 'failed_permanent') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span>Needs a change before sending</span>
      </div>
    );
  }

  switch (serverStatus) {
    case 'doctor_reviewing':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span>Doctor reviewing</span>
        </div>
      );
    case 'doctor_replied':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
          <span>Doctor replied</span>
        </div>
      );
    case 'completed':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Completed</span>
        </div>
      );
    case 'submitted':
    default:
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
          <span>Sent — waiting for doctor</span>
        </div>
      );
  }
}
