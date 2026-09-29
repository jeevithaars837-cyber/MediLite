'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Consultation, SymptomCategory, PriorityLevel } from '@/types';
import { LayoutList, Filter, ShieldCheck, ChevronLeft, ChevronRight, AlertOctagon, Clock, UserCheck } from 'lucide-react';
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

      // Filter by tab
      if (activeTab === 'new') {
        query = query.eq('status', 'submitted');
      } else if (activeTab === 'mine') {
        if (doctorId) query = query.eq('doctor_id', doctorId);
      } else if (activeTab === 'replied') {
        query = query.eq('status', 'doctor_replied');
      } else if (activeTab === 'completed') {
        query = query.eq('status', 'completed');
      } else if (activeTab === 'urgent') {
        query = query.or('suggested_priority.eq.urgent_review,priority.eq.urgent_review');
      }

      // Filter by category
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      // Order: priority urgent -> oldest first
      query = query.order('created_at', { ascending: true });

      // Range pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      if (!error && data) {
        setConsultations(data as Consultation[]);
      } else {
        setConsultations([]);
      }
    } catch {
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <LayoutList className="w-5 h-5 text-brand-400" /> Medical Consultation Queue
          </h1>
          <p className="text-xs text-slate-400">Review, claim, and reply to patient consultation requests.</p>
        </div>
        
        {/* Category Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:border-brand-500 focus:outline-none"
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
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'new', label: 'New Requests' },
          { id: 'mine', label: 'In Review (Mine)' },
          { id: 'replied', label: 'Replied' },
          { id: 'completed', label: 'Completed' },
          { id: 'urgent', label: 'Urgent Review' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as TabKind);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mandatory Safety Copy (§11) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
        <span>{strings.safety.priorityLabel}</span>
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading consultation queue…</div>
      ) : consultations.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center text-xs text-slate-400">
          No consultations found matching current tab/filter.
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((c) => {
            const displayPriority = c.priority || c.suggested_priority;
            const isUrgent = displayPriority === 'urgent_review';

            return (
              <Link
                key={c.id}
                href={`/doctor/consultations/${c.id}`}
                className={`block bg-slate-900/90 hover:bg-slate-850 border rounded-2xl p-4 transition-all shadow-md ${
                  isUrgent ? 'border-rose-700/80 bg-rose-950/20' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                      CS-{c.case_number}
                    </span>
                    <span className="text-xs font-semibold capitalize text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                      {c.category}
                    </span>
                    {isUrgent && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-700 px-2 py-0.5 rounded">
                        <AlertOctagon className="w-3 h-3 text-rose-400" /> Urgent Review
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-mono">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${
                      c.status === 'doctor_reviewing'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : c.status === 'doctor_replied'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                  {c.symptoms}
                </p>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Duration: {c.duration} {c.patient_age_years ? `· Age: ${c.patient_age_years}` : ''}</span>
                  {c.doctor_id ? (
                    <span className="text-brand-400 font-semibold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" /> Claimed
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium">Unclaimed Pool</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
