'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wifi, WifiOff, Zap, LogOut, User } from 'lucide-react';
import { probeConnectivity, getLowDataMode, setLowDataMode } from '@/lib/network/probe';
import { createClient } from '@/lib/supabase/client';

export function Header({ userRole }: { userRole?: 'patient' | 'doctor' }) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [isLowData, setIsLowData] = useState(false);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // Initial Low Data Mode check
    getLowDataMode().then(setIsLowData);

    const checkConn = async () => {
      const online = await probeConnectivity();
      setIsOnline(online);
    };
    checkConn();
    const interval = setInterval(checkConn, 25000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Fetch user name
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.user_metadata?.full_name) {
        setUserName(data.user.user_metadata.full_name);
      } else if (data?.user?.email) {
        setUserName(data.user.email.split('@')[0]);
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleLowData = async () => {
    const next = !isLowData;
    setIsLowData(next);
    await setLowDataMode(next);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={userRole === 'doctor' ? '/doctor' : '/patient'} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-teal-500 flex items-center justify-center font-bold text-white shadow-md">
              CS
            </div>
            <span className="font-bold text-lg text-slate-100 tracking-tight">CareSync</span>
          </Link>
          {userRole === 'doctor' && (
            <span className="text-xs bg-brand-900/80 text-brand-300 px-2 py-0.5 rounded border border-brand-700 font-medium">
              Doctor Portal
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Connectivity Badge */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
              isOnline
                ? 'bg-teal-950/70 text-teal-300 border-teal-800'
                : 'bg-rose-950/80 text-rose-300 border-rose-800 animate-pulse'
            }`}
            role="status"
            aria-live="polite"
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Low Data Mode Toggle */}
          <button
            onClick={toggleLowData}
            title="Toggle Low Data Mode"
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
              isLowData
                ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isLowData ? 'fill-amber-300' : ''}`} />
            <span className="hidden sm:inline">Low Data</span>
          </button>

          {/* User Sign Out */}
          {userName && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <span className="text-xs text-slate-300 hidden md:inline truncate max-w-[120px]">
                {userName}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
