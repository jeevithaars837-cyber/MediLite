import { Header } from '@/components/shared/Header';
import { BottomNav } from '@/components/shared/BottomNav';
import { DemoPanel } from '@/components/shared/DemoPanel';

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 md:pb-6">
      <Header userRole="patient" />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <BottomNav />
      <DemoPanel />
    </div>
  );
}
