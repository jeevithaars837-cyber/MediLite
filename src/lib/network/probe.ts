import { db } from '../offline/db';

let lastProbeTime = 0;
let lastProbeResult = true;

export async function probeConnectivity(): Promise<boolean> {
  // If simulated offline in demo tools, return false
  if (typeof window !== 'undefined' && localStorage.getItem('caresync_simulated_offline') === 'true') {
    return false;
  }

  if (!navigator.onLine) {
    return false;
  }

  const now = Date.now();
  if (now - lastProbeTime < 30000 && lastProbeTime > 0) {
    return lastProbeResult;
  }

  lastProbeTime = now;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    lastProbeResult = res.ok || res.status === 204;
    return lastProbeResult;
  } catch {
    lastProbeResult = false;
    return false;
  }
}

export async function getLowDataMode(): Promise<boolean> {
  try {
    const meta = await db.meta.get('lowDataMode');
    if (meta !== undefined) {
      return Boolean(meta.value);
    }
    // Initial default: ON if navigator.connection.saveData is true
    const nav = navigator as any;
    if (nav.connection?.saveData) {
      await setLowDataMode(true);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function setLowDataMode(enabled: boolean): Promise<void> {
  try {
    await db.meta.put({ key: 'lowDataMode', value: enabled });
    if (typeof document !== 'undefined') {
      if (enabled) {
        document.documentElement.setAttribute('data-low-data', 'true');
      } else {
        document.documentElement.removeAttribute('data-low-data');
      }
    }
  } catch (err) {
    console.error('Failed to set low data mode', err);
  }
}
