import { Header } from '@/components/shared/Header';
import Link from 'next/link';
import { LayoutList } from 'lucide-react';

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header userRole="doctor" />
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        {/* Doctor Sidebar */}
        <aside className="w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 space-y-3 shrink-0">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
            Doctor Workstation
          </div>
          <nav className="space-y-1 text-xs font-medium">
            <Link
              href="/doctor"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-sm"
            >
              <LayoutList className="w-4 h-4" />
              <span>Consultation Queue</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
