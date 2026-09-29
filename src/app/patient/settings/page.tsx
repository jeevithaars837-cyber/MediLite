'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/offline/db';
import { getLowDataMode, setLowDataMode } from '@/lib/network/probe';
import { createClient } from '@/lib/supabase/client';
import { Settings, Zap, Trash2, LogOut, ShieldAlert, Check } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

export default function PatientSettingsPage() {
  const router = useRouter();
  const [isLowData, setIsLowData] = useState(false);
  const [imageQuality, setImageQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    getLowDataMode().then(setIsLowData);
  }, []);

  const handleLowDataToggle = async () => {
    const next = !isLowData;
    setIsLowData(next);
    await setLowDataMode(next);
  };

  const handleClearLocalData = async () => {
    setIsDeleting(true);
    try {
      await db.submissions.clear();
      await db.images.clear();
      await db.outbox.clear();
      await db.remote.clear();
      await db.remoteMessages.clear();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to clear local data:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-400" /> Settings & Data Preferences
        </h1>
        <p className="text-xs text-slate-400">Manage low-bandwidth options and device storage.</p>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Low Data Mode */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="space-y-1 max-w-md">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-200">{strings.app.lowDataMode}</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {strings.app.lowDataModeDesc}
            </p>
          </div>
          <button
            onClick={handleLowDataToggle}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 border ${
              isLowData ? 'bg-amber-500 border-amber-400' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                isLowData ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Image Quality Settings */}
        <div className="space-y-2 border-b border-slate-800 pb-5">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Image Compression Quality Target
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => setImageQuality(q)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize flex items-center justify-center gap-1.5 transition-all ${
                  imageQuality === q
                    ? 'bg-brand-950 border-brand-500 text-brand-300 shadow'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {imageQuality === q && <Check className="w-3.5 h-3.5 text-brand-400" />}
                <span>{q} ({q === 'low' ? '≤100KB' : q === 'medium' ? '≤300KB' : '≤500KB'})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Account Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleSignOut}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out of Account</span>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Remove Data From This Device</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Confirm Data Removal</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will erase all locally stored offline consultations and photos from this browser's IndexedDB. Unsynced items will be permanently lost from this device.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleClearLocalData}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow"
              >
                {isDeleting ? 'Erasing…' : 'Yes, Remove Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
