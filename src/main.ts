import './style.css';
import { Game } from './game/Game';
import { BOOT_ASSETS, quaterniusAssets } from './rendering/AssetLoader';
import { finishLoading, setLoadingProgress } from './ui';
import { applyVersionTag, ensureCurrentVersion } from './version';

applyVersionTag();

async function boot(): Promise<void> {
  await ensureCurrentVersion();
  try {
    await quaterniusAssets.preload(BOOT_ASSETS, (loaded, total) => setLoadingProgress(loaded / total));
  } catch (error) {
    console.warn('Some presentation assets could not be loaded; starting with safe fallbacks.', error);
  }
  new Game().start();
  requestAnimationFrame(() => requestAnimationFrame(finishLoading));
}

void boot();
