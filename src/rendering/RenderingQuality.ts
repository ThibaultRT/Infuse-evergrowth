export type RenderScale = 1 | 0.7;
export type FrameRateLimit = 60 | 30;

export type RenderingQualitySettings = {
  renderScale: RenderScale;
  frameRateLimit: FrameRateLimit;
  showStats: boolean;
};

const STORAGE_KEY = 'infuse-rendering-quality-v1';
const DEFAULT_SETTINGS: RenderingQualitySettings = { renderScale: 1, frameRateLimit: 60, showStats: false };

function normalize(value: unknown): RenderingQualitySettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const candidate = value as Partial<RenderingQualitySettings>;
  return {
    renderScale: candidate.renderScale === 0.7 ? 0.7 : 1,
    frameRateLimit: candidate.frameRateLimit === 30 ? 30 : 60,
    showStats: import.meta.env.DEV && candidate.showStats === true
  };
}

export function loadRenderingQuality(): RenderingQualitySettings {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveRenderingQuality(settings: RenderingQualitySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function effectivePixelRatio(settings: RenderingQualitySettings): number {
  return Math.min(devicePixelRatio * settings.renderScale, 2);
}
