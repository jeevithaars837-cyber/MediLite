'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, History, Settings } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/patient', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/patient/new', label: 'New', icon: PlusCircle },
    { href: '/patient/history', label: 'History', icon: History },
    { href: '/patient/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1.5">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 min-w-[64px] py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
