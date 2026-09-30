'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Consultation } from '@/types';
import { LayoutList, Filter, ShieldCheck, ChevronLeft, ChevronRight, AlertOctagon, UserCheck } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

type TabKind = 'new' | 'mine' | 'replied' | 'completed' | 'urgent';

export default function DoctorQueuePage() {
  const [activeTab, setActiveTab] = useState<TabKind>('new');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchQueue();
  }, [activeTab, categoryFilter, page]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const doctorId = session?.user?.id;

      let query = supabase.from('consultations').select('*');

      if (activeTab === 'new') query = query.eq('status', 'submitted');
      else if (activeTab === 'mine') { if (doctorId) query = query.eq('doctor_id', doctorId); }
      else if (activeTab === 'replied') query = query.eq('status', 'doctor_replied');
      else if (activeTab === 'completed') query = query.eq('status', 'completed');
      else if (activeTab === 'urgent') query = query.or('suggested_priority.eq.urgent_review,priority.eq.urgent_review');

      if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);
      query = query.order('created_at', { ascending: true });

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error } = await query;
      setConsultations(!error && data ? (data as Consultation[]) : []);
    } catch {
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'new', label: 'New' },
    { id: 'mine', label: 'In Review' },
    { id: 'replied', label: 'Replied' },
    { id: 'completed', label: 'Completed' },
    { id: 'urgent', label: '⚠ Urgent' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutList className="w-5 h-5 text-blue-600" /> Consultation Queue
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Review, claim, and reply to patient requests.</p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="fever">Fever</option>
            <option value="skin">Skin</option>
            <option value="respiratory">Respiratory</option>
            <option value="pain">Pain</option>
            <option value="digestive">Digestive</option>
            <option value="injury">Injury</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as TabKind); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Safety Notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
        <span>{strings.safety.priorityLabel}</span>
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading consultations…</div>
      ) : consultations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400 shadow-card">
          No consultations found for this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {consultations.map((c) => {
            const isUrgent = (c.priority || c.suggested_priority) === 'urgent_review';
            return (
              <Link
                key={c.id}
                href={`/doctor/consultations/${c.id}`}
                className={`block bg-white hover:bg-slate-50 border rounded-2xl p-4 transition-all shadow-card hover:shadow-card-md ${
                  isUrgent ? 'border-red-200 bg-red-50/30 hover:bg-red-50/50' : 'border-slate-200 hover:border-blue-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      CS-{c.case_number}
                    </span>
                    <span className="text-xs font-medium capitalize text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {c.category}
                    </span>
                    {isUrgent && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                        <AlertOctagon className="w-3 h-3" /> Urgent
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-mono">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${
                      c.status === 'doctor_reviewing'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : c.status === 'doctor_replied'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{c.symptoms}</p>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Duration: {c.duration}{c.patient_age_years ? ` · Age: ${c.patient_age_years}` : ''}</span>
                  {c.doctor_id ? (
                    <span className="text-blue-600 font-semibold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" /> Claimed
                    </span>
                  ) : (
                    <span className="text-amber-500 font-medium">Unclaimed</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {consultations.length === pageSize && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-slate-400 font-mono">Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
