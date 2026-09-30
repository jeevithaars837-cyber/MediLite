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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 animate-pulse flex items-center justify-center font-bold text-white text-sm shadow-blue">
          CS
        </div>
        <p className="text-sm text-slate-500 font-medium">Loading CareSync…</p>
      </div>
    </div>
  );
}
