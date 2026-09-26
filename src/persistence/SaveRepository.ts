import type { SaveData } from '../types';
import { createNewSave } from './SaveDefaults';
import { decodeSave } from './SaveMigrations';
import { browserSaveStorage, browserStorageHealthy, type SaveStorage } from './SaveStorage';

const SAVE_KEY = 'infuse-evergrowth-save-v20';
const BACKUP_KEY = 'infuse-evergrowth-save-backup';
const PREVIOUS_SAVE_KEYS = ['infuse-evergrowth-save-v19', 'infuse-evergrowth-save-v18', 'infuse-evergrowth-save-v17', 'infuse-evergrowth-save-v16', 'infuse-evergrowth-save-v15', 'infuse-evergrowth-save-v14', 'infuse-evergrowth-save-v13', 'infuse-evergrowth-save-v12', 'infuse-evergrowth-save-v11', 'infuse-evergrowth-save-v10', 'infuse-evergrowth-save-v9', 'infuse-evergrowth-save-v8', 'infuse-evergrowth-save-v7'];


// Cache exact strings, not storage keys: a write by another tab still needs validation.
const validated = new WeakMap<SaveStorage, Map<string, boolean>>();
function remember(storage: SaveStorage, raw: string, valid: boolean): boolean {
  if (!valid) return false;
  const entries = validated.get(storage) ?? new Map<string, boolean>();
  if (entries.size >= 2 && !entries.has(raw)) entries.delete(entries.keys().next().value!);
  entries.set(raw, valid);
  validated.set(storage, entries);
  return valid;
}
function validPrevious(storage: SaveStorage, raw: string, now: Date): boolean {
  return validated.get(storage)?.get(raw) ?? remember(storage, raw, decodeSave(raw, now) !== null);
}

export function loadSave(storage: SaveStorage = browserSaveStorage, now = new Date()): SaveData {
  for (const key of [SAVE_KEY, BACKUP_KEY, ...PREVIOUS_SAVE_KEYS]) {
    try {
      const raw = storage.getItem(key);
      const restored = raw ? decodeSave(raw, now) : null;
      if (raw) remember(storage, raw, restored !== null);
      if (restored) return restored;
    } catch { /* Unavailable storage is handled by the browser adapter. */ }
  }
  return createNewSave(now);
}

/** Retains one validated previous save; concurrent tabs use last-write-wins. */
export function persist(state: SaveData, storage: SaveStorage = browserSaveStorage, now = new Date()): boolean {
  try {
    const next = JSON.stringify(state, (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Cannot save a non-finite number.');
      return value;
    });
    const previous = storage.getItem(SAVE_KEY);
    if (previous && validPrevious(storage, previous, now)) storage.setItem(BACKUP_KEY, previous);
    else {
      const backup = storage.getItem(BACKUP_KEY);
      if (!backup || !validPrevious(storage, backup, now)) storage.setItem(BACKUP_KEY, next);
    }
    storage.setItem(SAVE_KEY, next);
    const saved = storage !== browserSaveStorage || browserStorageHealthy();
    if (saved) remember(storage, next, true);
    return saved;
  } catch (error) {
    console.warn('Progress could not be saved to this device.', error);
    return false;
  }
}
