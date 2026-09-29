'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/sync/engine';
import { StatusBadge } from '@/components/patient/StatusBadge';
import { PlusCircle, HardDrive, MessageSquare, ArrowRight, ShieldCheck, Activity, Clock, CheckCircle } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

export default function PatientDashboard() {
  const [patientName, setPatientName] = useState<string>('Patient');

  // Read local Dexie submissions & images
  const submissions = useLiveQuery(() => db.submissions.orderBy('createdAt').reverse().toArray()) || [];
  const images = useLiveQuery(() => db.images.toArray()) || [];
  const remoteConsultations = useLiveQuery(() => db.remote.toArray()) || [];
  const remoteMessages = useLiveQuery(() => db.remoteMessages.toArray()) || [];

  useEffect(() => {
    // Initial sync engine trigger & delta pull
    syncEngine.kick();
  }, []);

  // Compute counters
  const pendingSyncCount = submissions.filter((s) => s.syncState !== 'synced').length;
  const activeCount = submissions.filter((s) => s.syncState === 'synced').length + remoteConsultations.length;

  // Calculate real bytes saved sum (original_size - compressed_size)
  const totalSavedBytes = images.reduce((sum, img) => {
    return sum + Math.max(0, img.originalSize - img.compressedSize);
  }, 0);

  const formattedSavedMB = (totalSavedBytes / (1024 * 1024)).toFixed(2);

  // Latest doctor response
  const latestDoctorMsg = remoteMessages
    .filter((m) => m.kind === 'guidance' || m.kind === 'follow_up_question')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
            Hello, {patientName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Offline health dashboard — your records stay accessible anytime.
          </p>
        </div>
        <Link
          href="/patient/new"
          className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <PlusCircle className="w-5 h-5" />
          <span>New Consultation</span>
        </Link>
      </div>

      {/* Latest Doctor Response Alert */}
      {latestDoctorMsg && (
        <div className="bg-gradient-to-r from-teal-950/90 to-brand-950/90 border border-teal-700/80 rounded-2xl p-4 shadow-xl flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-teal-200">Doctor Replied</h4>
              <span className="text-[10px] text-teal-400 font-mono">
                {new Date(latestDoctorMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">
              "{latestDoctorMsg.body}"
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Sync Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pending Sync
            </span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{pendingSyncCount}</div>
          <p className="text-[11px] text-slate-400">
            {pendingSyncCount > 0 ? 'Will sync automatically when online' : 'All consultations synchronized'}
          </p>
        </div>

        {/* Total consultations */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-brand-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active / History
            </span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{submissions.length}</div>
          <p className="text-[11px] text-slate-400">Total consultations created</p>
        </div>

        {/* Data Saved Real Bytes Card (§10 & §18) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-teal-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Data Saved
            </span>
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-teal-300">{formattedSavedMB} MB</div>
          <p className="text-[11px] text-slate-400">Bandwidth saved via client image compression</p>
        </div>
      </div>

      {/* Recent Consultations List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider">
            Your Consultations
          </h3>
          <Link href="/patient/history" className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {submissions.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">No consultations yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a new consultation offline or online. Your medical request will be saved safely on your device.
            </p>
            <Link
              href="/patient/new"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" /> Start First Consultation
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.slice(0, 5).map((sub) => {
              const displayKey = sub.caseNumber ? `CS-${sub.caseNumber}` : `Local-${sub.clientSubmissionId.slice(0, 4)}`;
              return (
                <Link
                  key={sub.clientSubmissionId}
                  href={`/patient/consultations/${sub.clientSubmissionId}`}
                  className="block bg-slate-900/90 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 transition-all shadow-md hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950/80 px-2 py-0.5 rounded border border-brand-800">
                        {displayKey}
                      </span>
                      <span className="text-xs font-semibold capitalize text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                        {sub.category}
                      </span>
                    </div>
                    <StatusBadge syncState={sub.syncState} />
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-normal">
                    {sub.symptoms}
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Duration: {sub.duration}</span>
                    <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Safety Disclaimer Footer (§11) */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-brand-500 shrink-0" />
        <span>{strings.safety.disclaimer}</span>
      </div>
    </div>
  );
}
