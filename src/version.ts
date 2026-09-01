import packageInfo from '../package.json';
import { ui } from './ui';

export const APP_VERSION = packageInfo.version.replace(/\.0$/, '');
const UPDATE_TIMEOUT_MS = 5_000;

interface PublishedVersion { version: string }

export function applyVersionTag(): void {
  document.querySelectorAll<HTMLElement>('.version-tag').forEach((tag) => { tag.textContent = APP_VERSION; });
  ui.loadingVersion.textContent = `Version ${APP_VERSION}`;
}

function waitForControllerChange(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const changed = (): void => { cleanup(); resolve(); };
    const aborted = (): void => { cleanup(); reject(signal.reason); };
    const cleanup = (): void => {
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      signal.removeEventListener('abort', aborted);
    };
    navigator.serviceWorker.addEventListener('controllerchange', changed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
  });
}

export async function ensureCurrentVersion(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  const timeout = new AbortController();
  let rejectTimeout: (reason: Error) => void = () => undefined;
  const timedOut = new Promise<never>((_, reject) => { rejectTimeout = reject; });
  const timeoutId = window.setTimeout(() => {
    const error = new Error('Version check timed out');
    timeout.abort(error);
    rejectTimeout(error);
  }, UPDATE_TIMEOUT_MS);
  try {
    await Promise.race([(async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
        cache: 'no-store',
        signal: timeout.signal
      });
      if (!response.ok) throw new Error(`Version check returned ${response.status}`);
      const published = await response.json() as PublishedVersion;
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
      if (!published.version || published.version === packageInfo.version) {
        void registration.update().catch((error: unknown) => console.warn('The background app update check failed.', error));
        return;
      }

      ui.loadingSubtitle.textContent = `Updating to version ${published.version}…`;
      const controllerChanged = waitForControllerChange(timeout.signal);
      await registration.update();
      await controllerChanged;
      window.location.reload();
      await new Promise<never>(() => undefined);
    })(), timedOut]);
  } catch (error) {
    if (!timeout.signal.aborted) console.warn('Could not check for an app update; continuing with the latest known version.', error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
