import { SyncState, ConsultationStatus } from '@/types';
import { CheckCircle2, RefreshCw, AlertTriangle, Clock, MessageSquare, CheckCheck } from 'lucide-react';

interface StatusBadgeProps {
  syncState: SyncState;
  serverStatus?: ConsultationStatus;
}

export function StatusBadge({ syncState, serverStatus }: StatusBadgeProps) {
  // If local sync state is not 'synced', local state takes priority
  if (syncState === 'queued') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-950/70 text-amber-300 border border-amber-800/80">
        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
        <span>Saved on device — waiting for network</span>
      </div>
    );
  }

  if (syncState === 'syncing') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-brand-950/70 text-brand-300 border border-brand-800/80">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />
        <span>Sending…</span>
      </div>
    );
  }

  if (syncState === 'retry_scheduled') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-700/80">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span>Couldn't send yet — retrying automatically</span>
      </div>
    );
  }

  if (syncState === 'needs_login') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-800">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
        <span>Sign in again to send</span>
      </div>
    );
  }

  if (syncState === 'failed_permanent') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-950/90 text-rose-200 border border-rose-700">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
        <span>Needs a change before sending</span>
      </div>
    );
  }

  // Server status when synced
  switch (serverStatus) {
    case 'doctor_reviewing':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-950/70 text-indigo-300 border border-indigo-800">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Doctor is reviewing your request</span>
        </div>
      );
    case 'doctor_replied':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>Doctor replied</span>
        </div>
      );
    case 'completed':
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Completed</span>
        </div>
      );
    case 'submitted':
    default:
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-950/70 text-teal-300 border border-teal-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
          <span>Sent — waiting for a doctor</span>
        </div>
      );
  }
}
