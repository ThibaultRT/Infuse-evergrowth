// Compatibility exports only. Browser state is loaded explicitly by main.ts.
export { loadSave, persist } from './persistence/SaveRepository';
export { browserSaveStorage, type SaveStorage } from './persistence/SaveStorage';
export { createNewSave, emptySpawnState, resetPermanentStats, resetHeroProgress } from './persistence/SaveDefaults';
export { localDailyKey, nextLocalMidnightMs } from './domain/time/LocalCalendar';
export { statAdditiveTotal, statMultiplierTotal, statTotal } from './domain/stats/StatSources';
