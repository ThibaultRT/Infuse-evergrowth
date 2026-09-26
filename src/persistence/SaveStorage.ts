export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
const volatileValues = new Map<string, string>();
let storageFailed = false;
function reportStorageFailure(error: unknown): void {
  if (!storageFailed) console.warn('Progress could not be saved to this device.', error);
  storageFailed = true;
}
export const browserSaveStorage: SaveStorage = {
  getItem: (key) => {
    try { return typeof localStorage === 'undefined' ? volatileValues.get(key) ?? null : localStorage.getItem(key); }
    catch (error) { reportStorageFailure(error); return volatileValues.get(key) ?? null; }
  },
  setItem: (key, value) => {
    volatileValues.set(key, value);
    // Do not overwrite a save that could not be read earlier in this session.
    if (storageFailed) return;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); }
    catch (error) { reportStorageFailure(error); }
  }
};


export function browserStorageHealthy(): boolean { return !storageFailed; }
