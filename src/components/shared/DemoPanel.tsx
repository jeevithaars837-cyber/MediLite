'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/sync/engine';
import { Sliders, RefreshCw } from 'lucide-react';

export function DemoPanel() {
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [outboxCount, setOutboxCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('caresync_simulated_offline') === 'true';
    setIsSimulatedOffline(stored);

    const updateCount = async () => {
      try {
        const count = await db.outbox.count();
        setOutboxCount(count);
      } catch {
        setOutboxCount(0);
      }
    };

    updateCount();
    const unsubscribe = syncEngine.subscribe(updateCount);
    const interval = setInterval(updateCount, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const toggleSimulatedOffline = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    localStorage.setItem('caresync_simulated_offline', next ? 'true' : 'false');
    window.dispatchEvent(new Event(next ? 'offline' : 'online'));
  };

  const handleManualSync = () => {
    syncEngine.kick();
  };

  if (process.env.NEXT_PUBLIC_DEMO_TOOLS !== '1') {
    return null;
  }

  return (
    <div className="fixed bottom-16 right-4 md:bottom-4 z-50">
      {isOpen ? (
        <div className="bg-slate-900 border border-brand-500/40 rounded-xl p-4 shadow-2xl w-72 text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Demo Control Panel
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
              <span className="font-medium">Simulate Offline</span>
              <button
                onClick={toggleSimulatedOffline}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  isSimulatedOffline
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isSimulatedOffline ? 'OFFLINE' : 'ONLINE'}
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
              <span>Pending Outbox Queue</span>
              <span className="font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                {outboxCount} items
              </span>
            </div>

            <button
              onClick={handleManualSync}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Trigger Sync Engine Now
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white p-2.5 rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105"
          title="Open Demo Tools"
        >
          <Sliders className="w-5 h-5" />
          {outboxCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">
              {outboxCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
