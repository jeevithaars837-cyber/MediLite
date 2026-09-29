import { Header } from '@/components/shared/Header';
import Link from 'next/link';
import { LayoutList, UserCheck, CheckCircle2, AlertOctagon } from 'lucide-react';

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header userRole="doctor" />
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        {/* Doctor Sidebar for Desktop / Tablet */}
        <aside className="w-full md:w-64 bg-slate-900/60 border-b md:border-b-0 md:border-r border-slate-800 p-4 space-y-4 shrink-0">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
            Doctor Workstation
          </div>
          <nav className="space-y-1 text-xs font-medium">
            <Link
              href="/doctor"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-brand-950/80 border border-brand-800 text-brand-300 font-bold"
            >
              <LayoutList className="w-4 h-4 text-brand-400" />
              <span>Consultation Queue</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
