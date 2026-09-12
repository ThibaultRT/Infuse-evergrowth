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
    if (signal.aborted) { reject(signal.reason); return; }
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
  const initialController = navigator.serviceWorker.controller;
  const controllerChanged = waitForControllerChange(timeout.signal);
  // A failed registration/check may end before this listener is awaited.
  void controllerChanged.catch(() => undefined);
  try {
    await Promise.race([(async () => {
      const registrationTask = navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' });
      const publishedTask = fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
        cache: 'no-store',
        signal: timeout.signal
      }).then(async (response): Promise<PublishedVersion | null> => response.ok ? await response.json() as PublishedVersion : null)
        .catch(() => null);
      const [registration, published] = await Promise.all([registrationTask, publishedTask]);
      if (timeout.signal.aborted) return;
      if (!initialController || !published?.version || published.version === packageInfo.version) {
        // On the first visit, let the worker claim this page before model/texture loads.
        // The outer timeout preserves playable startup when installation is unavailable.
        if (!navigator.serviceWorker.controller) await controllerChanged;
        void registration.update().catch((error: unknown) => console.warn('The background app update check failed.', error));
        return;
      }

      ui.loadingSubtitle.textContent = `Updating to version ${published.version}…`;
      if (navigator.serviceWorker.controller === initialController) {
        await registration.update();
        await controllerChanged;
      }
      if (timeout.signal.aborted) return;
      window.location.reload();
      await new Promise<never>(() => undefined);
    })(), timedOut]);
  } catch (error) {
    if (!timeout.signal.aborted) console.warn('Could not check for an app update; continuing with the latest known version.', error);
  } finally {
    window.clearTimeout(timeoutId);
    timeout.abort();
  }
}
