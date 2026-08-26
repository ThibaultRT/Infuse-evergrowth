import { browserSaveStorage, type SaveStorage } from '../save';

export type GameClock = { now(): number; date(): Date };

export const browserClock: GameClock = { now: () => Date.now(), date: () => new Date() };
export const browserStorage: SaveStorage = browserSaveStorage;
