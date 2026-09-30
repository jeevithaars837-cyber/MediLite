'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/sync/engine';
import { StatusBadge } from '@/components/patient/StatusBadge';
import { PlusCircle, HardDrive, MessageSquare, ArrowRight, ShieldCheck, Activity, Clock } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

export default function PatientDashboard() {
  const [patientName, setPatientName] = useState<string>('Patient');

  const submissions = useLiveQuery(() => db.submissions.orderBy('createdAt').reverse().toArray()) || [];
  const images = useLiveQuery(() => db.images.toArray()) || [];
  const remoteConsultations = useLiveQuery(() => db.remote.toArray()) || [];
  const remoteMessages = useLiveQuery(() => db.remoteMessages.toArray()) || [];

  useEffect(() => {
    syncEngine.kick();
  }, []);

  const pendingSyncCount = submissions.filter((s) => s.syncState !== 'synced').length;

  const totalSavedBytes = images.reduce((sum, img) => {
    return sum + Math.max(0, img.originalSize - img.compressedSize);
  }, 0);
  const formattedSavedMB = (totalSavedBytes / (1024 * 1024)).toFixed(2);

  const latestDoctorMsg = remoteMessages
    .filter((m) => m.kind === 'guidance' || m.kind === 'follow_up_question')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-blue-600 rounded-2xl p-6 shadow-blue text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Hello, {patientName}
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              Your health records are accessible anytime, even offline.
            </p>
          </div>
          <Link
            href="/patient/new"
            className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-bold text-sm px-5 py-3 rounded-xl shadow-sm hover:bg-blue-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Consultation</span>
          </Link>
        </div>
      </div>

      {/* Doctor Reply Alert */}
      {latestDoctorMsg && (
        <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-card flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-sm text-slate-800">Doctor Replied</h4>
              <span className="text-xs text-slate-400 font-mono">
                {new Date(latestDoctorMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
              &ldquo;{latestDoctorMsg.body}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Sync</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{pendingSyncCount}</div>
          <p className="text-xs text-slate-500">
            {pendingSyncCount > 0 ? 'Will sync when online' : 'All synced'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{submissions.length}</div>
          <p className="text-xs text-slate-500">Total consultations</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Data Saved</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{formattedSavedMB} MB</div>
          <p className="text-xs text-slate-500">Via image compression</p>
        </div>
      </div>

      {/* Recent Consultations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Your Consultations
          </h3>
          <Link href="/patient/history" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {submissions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-card space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 mx-auto flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No consultations yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a new consultation online or offline. Your request is saved securely on your device.
            </p>
            <Link
              href="/patient/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" /> Start First Consultation
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.slice(0, 5).map((sub) => {
              const displayKey = sub.caseNumber ? `CS-${sub.caseNumber}` : `Local-${sub.clientSubmissionId.slice(0, 4)}`;
              return (
                <Link
                  key={sub.clientSubmissionId}
                  href={`/patient/consultations/${sub.clientSubmissionId}`}
                  className="block bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all shadow-card hover:border-blue-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {displayKey}
                      </span>
                      <span className="text-xs font-medium capitalize text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {sub.category}
                      </span>
                    </div>
                    <StatusBadge syncState={sub.syncState} />
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {sub.symptoms}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Duration: {sub.duration}</span>
                    <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Safety Disclaimer */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center text-xs text-blue-600 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
        <span>{strings.safety.disclaimer}</span>
      </div>
    </div>
  );
}
