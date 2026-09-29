import { AlertOctagon } from 'lucide-react';
import { strings } from '@/lib/i18n/strings';

export function EmergencyBanner() {
  return (
    <div className="bg-rose-950/90 border-2 border-rose-600/90 rounded-xl p-4 text-rose-100 shadow-xl flex items-start gap-3 my-4 animate-pulse">
      <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
      <div>
        <h4 className="font-bold text-sm text-rose-200 tracking-wide uppercase mb-1">
          Possible Medical Emergency Detected
        </h4>
        <p className="text-xs leading-relaxed text-rose-100 font-medium">
          {strings.safety.emergencyBanner}
        </p>
      </div>
    </div>
  );
}
