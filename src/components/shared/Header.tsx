'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wifi, WifiOff, Zap, LogOut } from 'lucide-react';
import { probeConnectivity, getLowDataMode, setLowDataMode } from '@/lib/network/probe';
import { createClient } from '@/lib/supabase/client';

export function Header({ userRole }: { userRole?: 'patient' | 'doctor' }) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [isLowData, setIsLowData] = useState(false);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
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
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Link href={userRole === 'doctor' ? '/doctor' : '/patient'} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-blue">
              CS
            </div>
            <span className="font-bold text-lg text-slate-800 tracking-tight">CareSync</span>
          </Link>
          {userRole === 'doctor' && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-medium">
              Doctor Portal
            </span>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Connectivity Badge */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-600 border-red-200 animate-pulse'
            }`}
            role="status"
            aria-live="polite"
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Low Data Toggle */}
          <button
            onClick={toggleLowData}
            title="Toggle Low Data Mode"
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
              isLowData
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isLowData ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span className="hidden sm:inline">Low Data</span>
          </button>

          {/* User Sign Out */}
          {userName && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="text-xs text-slate-600 hidden md:inline truncate max-w-[120px] font-medium">
                {userName}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
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
