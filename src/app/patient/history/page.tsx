'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/offline/db';
import { StatusBadge } from '@/components/patient/StatusBadge';
import { History, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PatientHistoryPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const allSubmissions = useLiveQuery(() => db.submissions.orderBy('createdAt').reverse().toArray()) || [];

  const totalPages = Math.ceil(allSubmissions.length / pageSize) || 1;
  const pagedSubmissions = allSubmissions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/patient"
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-brand-400" /> Consultation History
          </h1>
          <p className="text-xs text-slate-400">Complete archive of health requests stored on this device.</p>
        </div>
      </div>

      {pagedSubmissions.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 text-center text-xs text-slate-400">
          No consultation records found.
        </div>
      ) : (
        <div className="space-y-3">
          {pagedSubmissions.map((sub) => {
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
                <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-slate-400 font-mono">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
