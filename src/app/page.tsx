'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'doctor') {
          router.replace('/doctor');
        } else {
          router.replace('/patient');
        }
      } catch {
        router.replace('/patient');
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-teal-500 animate-pulse flex items-center justify-center font-bold text-white mb-3 shadow-lg">
        CS
      </div>
      <p className="text-xs text-slate-400 font-medium">Loading CareSync…</p>
    </div>
  );
}
