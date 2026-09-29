'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Consultation, ConsultationImage, Message } from '@/types';
import { ArrowLeft, UserCheck, Send, AlertTriangle, CheckCircle, Lock, ShieldCheck, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

export default function DoctorCaseReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [images, setImages] = useState<Array<{ image: ConsultationImage; signedUrl?: string }>>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [guidanceText, setGuidanceText] = useState('');
  const [followUpText, setFollowUpText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchCaseDetails();
  }, [id]);

  const fetchCaseDetails = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);

      // Fetch consultation row
      const { data: consData, error: consErr } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', id)
        .single();

      if (consErr || !consData) {
        setErrorMsg('Consultation case not found.');
        return;
      }

      setConsultation(consData as Consultation);

      // Fetch images
      const { data: imgData } = await supabase
        .from('consultation_images')
        .select('*')
        .eq('consultation_id', id);

      if (imgData) {
        // Generate signed URLs (5 min expiry)
        const signedList = await Promise.all(
          imgData.map(async (img: ConsultationImage) => {
            const { data: signed } = await supabase.storage
              .from('consultation-images')
              .createSignedUrl(img.storage_path, 300);
            return { image: img, signedUrl: signed?.signedUrl };
          })
        );
        setImages(signedList);
      }

      // Fetch messages
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('consultation_id', id)
        .order('created_at', { ascending: true });

      if (msgData) setMessages(msgData as Message[]);
    } catch {
      setErrorMsg('Failed to load case details.');
    }
  };

  const handleStartReview = async () => {
    if (!currentUserId || !consultation) return;
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('consultations')
        .update({ doctor_id: currentUserId, status: 'doctor_reviewing' })
        .eq('id', id)
        .is('doctor_id', null)
        .select();

      if (error || !data || data.length === 0) {
        setErrorMsg(strings.errors.doctorAlreadyClaimed);
      } else {
        await fetchCaseDetails();
      }
    } catch {
      setErrorMsg('Claim operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendGuidance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guidanceText.trim() || !currentUserId) return;
    setActionLoading(true);

    try {
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();

      await supabase.from('messages').insert({
        client_message_id: clientMessageId,
        consultation_id: id,
        sender_id: currentUserId,
        kind: 'guidance',
        body: guidanceText.trim(),
      });

      setGuidanceText('');
      await fetchCaseDetails();
    } catch {
      setErrorMsg('Failed to post guidance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAskFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim() || !currentUserId) return;
    setActionLoading(true);

    try {
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();

      await supabase.from('messages').insert({
        client_message_id: clientMessageId,
        consultation_id: id,
        sender_id: currentUserId,
        kind: 'follow_up_question',
        body: followUpText.trim(),
      });

      setFollowUpText('');
      await fetchCaseDetails();
    } catch {
      setErrorMsg('Failed to post follow-up question.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecommendInPerson = async () => {
    if (!currentUserId) return;
    setActionLoading(true);

    try {
      const supabase = createClient();
      await supabase
        .from('consultations')
        .update({
          in_person_recommended: true,
          priority: 'urgent_review',
        })
        .eq('id', id);

      const clientMessageId = crypto.randomUUID();
      await supabase.from('messages').insert({
        client_message_id: clientMessageId,
        consultation_id: id,
        sender_id: currentUserId,
        kind: 'system',
        body: strings.safety.inPersonRecommendation,
      });

      await fetchCaseDetails();
    } catch {
      setErrorMsg('Operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkCompleted = async () => {
    setActionLoading(true);
    try {
      const supabase = createClient();
      await supabase
        .from('consultations')
        .update({ status: 'completed' })
        .eq('id', id);

      await fetchCaseDetails();
    } catch {
      setErrorMsg('Failed to complete case.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!consultation) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        {errorMsg || 'Loading consultation details…'}
      </div>
    );
  }

  const isClaimedByMe = consultation.doctor_id === currentUserId;
  const isClaimedByOther = consultation.doctor_id && consultation.doctor_id !== currentUserId;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-brand-400 bg-brand-950 px-2.5 py-0.5 rounded border border-brand-800">
                CS-{consultation.case_number}
              </span>
              <span className="text-xs font-semibold capitalize text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                {consultation.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Submitted {new Date(consultation.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Claim Status Badge */}
        {isClaimedByOther ? (
          <div className="px-3 py-1 bg-amber-950/90 text-amber-300 border border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Lock className="w-4 h-4" />
            <span>{strings.doctor.claimedByOther}</span>
          </div>
        ) : !consultation.doctor_id ? (
          <button
            onClick={handleStartReview}
            disabled={actionLoading}
            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all"
          >
            <UserCheck className="w-4 h-4" />
            <span>Start Review (Claim Case)</span>
          </button>
        ) : (
          <div className="px-3 py-1 bg-teal-950 text-teal-300 border border-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            <span>Claimed by You</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Symptoms & Medical Summary */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Reported Symptoms & Complaint
          </h3>
          <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-normal">
            {consultation.symptoms}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Duration:</span>
            <span className="text-slate-200 ml-1 font-semibold">{consultation.duration}</span>
          </div>
          {consultation.patient_age_years && (
            <div>
              <span className="text-slate-400 font-medium">Age:</span>
              <span className="text-slate-200 ml-1 font-semibold">{consultation.patient_age_years} yrs</span>
            </div>
          )}
          <div>
            <span className="text-slate-400 font-medium">Priority Suggestion:</span>
            <span className="text-amber-400 ml-1 font-semibold capitalize">
              {consultation.priority || consultation.suggested_priority}
            </span>
          </div>
        </div>

        {/* Photos (Signed URLs) */}
        {images.length > 0 && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-brand-400" /> Clinical Photos (Private Signed URLs)
            </h4>
            <div className="flex flex-wrap gap-3">
              {images.map(({ image, signedUrl }) => (
                <div
                  key={image.id}
                  onClick={() => signedUrl && setSelectedImage(signedUrl)}
                  className="w-24 h-24 bg-slate-950 rounded-xl overflow-hidden border border-slate-700 cursor-pointer hover:border-brand-400 transition-colors"
                >
                  {signedUrl ? (
                    <img src={signedUrl} alt="Patient attachment" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">Loading…</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discussion Thread */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-400" /> Patient Discussion History
        </h3>

        <div className="space-y-3">
          {messages.map((m) => {
            const isDoc = m.kind === 'guidance' || m.kind === 'follow_up_question' || m.kind === 'system';
            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl max-w-[85%] border text-xs leading-relaxed space-y-1 ${
                  isDoc
                    ? 'bg-gradient-to-tr from-brand-950 to-slate-900 border-brand-800 text-slate-100 ml-auto'
                    : 'bg-slate-800 border-slate-700 text-slate-200 self-start'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold text-[11px]">
                  <span className={isDoc ? 'text-brand-300' : 'text-slate-300'}>
                    {isDoc ? 'Doctor (You / Medical Staff)' : 'Patient'}
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Doctor Action Controls (Only available if claimed by current doctor and not completed) */}
      {isClaimedByMe && consultation.status !== 'completed' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Doctor Actions</h3>

          {/* Send Medical Guidance Form */}
          <form onSubmit={handleSendGuidance} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Send Medical Guidance & Instructions
            </label>
            <textarea
              rows={3}
              required
              value={guidanceText}
              onChange={(e) => setGuidanceText(e.target.value)}
              placeholder="Provide clinical recommendations, self-care guidance, or observations..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={actionLoading || !guidanceText.trim()}
              className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold py-2 px-4 rounded-xl shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Guidance</span>
            </button>
          </form>

          {/* Ask Follow-up Form */}
          <form onSubmit={handleAskFollowUp} className="space-y-2 pt-3 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Ask Follow-Up Question
            </label>
            <input
              type="text"
              required
              value={followUpText}
              onChange={(e) => setFollowUpText(e.target.value)}
              placeholder="e.g. Do you have any difficulty swallowing?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={actionLoading || !followUpText.trim()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 px-4 rounded-xl shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask Question</span>
            </button>
          </form>

          {/* Buttons: Recommend In-Person & Complete */}
          <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={handleRecommendInPerson}
              disabled={actionLoading || consultation.in_person_recommended}
              className="bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-200 text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{consultation.in_person_recommended ? 'In-Person Recommended' : 'Recommend In-Person Care'}</span>
            </button>

            <button
              onClick={handleMarkCompleted}
              disabled={actionLoading}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow flex items-center gap-1.5 transition-all ml-auto disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Mark Consultation Completed</span>
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={selectedImage} alt="Clinical Full View" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-slate-700" />
        </div>
      )}
    </div>
  );
}
