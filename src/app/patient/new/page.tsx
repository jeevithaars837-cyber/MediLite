'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/sync/engine';
import { suggestPriority } from '@/lib/triage/triage';
import { EmergencyBanner } from '@/components/patient/EmergencyBanner';
import { ImageUploader } from '@/components/patient/ImageUploader';
import { SymptomCategory, CompressionResult } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, CheckCircle, ArrowLeft, Send } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

export default function NewConsultationPage() {
  const router = useRouter();

  const [category, setCategory] = useState<SymptomCategory>('fever');
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [images, setImages] = useState<Array<{ result: CompressionResult; clientImageId: string }>>([]);

  const [triage, setTriage] = useState(suggestPriority({ symptoms: '' }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto triage scanning on input changes
  useEffect(() => {
    const res = suggestPriority({
      symptoms,
      additionalNotes,
      category,
      patientAgeYears: patientAge ? parseInt(patientAge, 10) : null,
    });
    setTriage(res);
  }, [symptoms, additionalNotes, category, patientAge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (symptoms.trim().length < 5) {
      setErrorMsg('Please describe your symptoms in at least 5 characters.');
      return;
    }
    if (!duration.trim()) {
      setErrorMsg('Please specify how long you have experienced these symptoms.');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || 'offline-local-user';

      const clientSubmissionId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const localSubmission = {
        clientSubmissionId,
        userId,
        category,
        symptoms: symptoms.trim(),
        duration: duration.trim(),
        additionalNotes: additionalNotes.trim() || undefined,
        patientAgeYears: patientAge ? parseInt(patientAge, 10) : undefined,
        suggestedPriority: triage.priority,
        syncState: 'queued' as const,
        createdAt,
        attempts: 0,
      };

      const outboxItem = {
        id: crypto.randomUUID(),
        userId,
        type: 'submit_consultation' as const,
        payload: {
          client_submission_id: clientSubmissionId,
          category,
          symptoms: symptoms.trim(),
          duration: duration.trim(),
          additional_notes: additionalNotes.trim() || null,
          patient_age_years: patientAge ? parseInt(patientAge, 10) : null,
          suggested_priority: triage.priority,
          client_created_at: createdAt,
        },
        status: 'queued' as const,
        nextAttemptAt: createdAt,
        attempts: 0,
        createdAt,
      };

      // Atomic Dexie transaction (§6.2 rule 3)
      await db.transaction('rw', [db.submissions, db.images, db.outbox], async () => {
        await db.submissions.add(localSubmission);

        for (const img of images) {
          await db.images.add({
            clientImageId: img.clientImageId,
            clientSubmissionId,
            fullBlob: img.result.blob,
            thumbBlob: img.result.thumbBlob,
            originalSize: img.result.originalSize,
            compressedSize: img.result.compressedSize,
            mimeType: img.result.mime,
            width: img.result.width,
            height: img.result.height,
            uploaded: false,
          });
        }

        await db.outbox.add(outboxItem);
      });

      setSuccessMsg(strings.status.queued);

      // Trigger background sync engine
      syncEngine.kick();

      setTimeout(() => {
        router.push(`/patient/consultations/${clientSubmissionId}`);
      }, 1200);
    } catch (err: any) {
      console.error('Dexie save error:', err);
      if (err.name === 'QuotaExceededError') {
        setErrorMsg(strings.errors.localSaveFailed);
      } else {
        setErrorMsg('Failed to save consultation locally. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">New Consultation</h1>
          <p className="text-xs text-slate-400">Describe your health concern. Works fully offline.</p>
        </div>
      </div>

      {/* Emergency Warning Banner if red flags detected */}
      {triage.hasRedFlags && <EmergencyBanner />}

      {errorMsg && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-teal-950/90 border border-teal-700 rounded-xl text-teal-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SymptomCategory)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-slate-100 focus:border-brand-500 focus:outline-none transition-colors"
          >
            <option value="fever">Fever / Chills</option>
            <option value="skin">Skin / Rash / Wound</option>
            <option value="respiratory">Cough / Cold / Respiratory</option>
            <option value="pain">Pain / Aches</option>
            <option value="digestive">Digestive / Stomach</option>
            <option value="injury">Injury / Trauma</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Symptoms */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Describe your symptoms *
          </label>
          <textarea
            required
            rows={4}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Please detail what you are feeling, where it hurts, and any visible signs..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Duration & Age grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Duration *
            </label>
            <input
              type="text"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 2 days, 3 hours"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Patient Age (Years)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              placeholder="e.g. 28"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Additional Medical History / Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any existing conditions, allergies, or current medications..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Image Uploader */}
        <ImageUploader onImagesChanged={setImages} />

        {/* Priority hint footnote */}
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">Triage Hint: </span>
          {strings.safety.priorityLabel}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Saving to Device…' : 'Save & Submit Consultation'}</span>
        </button>
      </form>
    </div>
  );
}
