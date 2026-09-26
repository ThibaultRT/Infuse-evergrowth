import './style.css';
import { loadSave, persist } from './persistence/SaveRepository';
import { Game } from './game/Game';
import { BOOT_ASSETS, quaterniusAssets } from './rendering/AssetLoader';
import { finishLoading, setLoadingProgress } from './ui';
import { applyVersionTag, ensureCurrentVersion } from './version';

applyVersionTag();
const game = new Game();
let disposed = false;
import.meta.hot?.dispose(() => { disposed = true; game.dispose(); });

async function boot(): Promise<void> {
  await ensureCurrentVersion();
  try {
    await quaterniusAssets.preload(BOOT_ASSETS, (loaded, total) => setLoadingProgress(loaded / total));
  } catch (error) {
    console.warn('Some presentation assets could not be loaded; starting with safe fallbacks.', error);
  }
  if (disposed) return;
  game.start(loadSave(), persist);
  requestAnimationFrame(() => requestAnimationFrame(finishLoading));
}

void boot();
