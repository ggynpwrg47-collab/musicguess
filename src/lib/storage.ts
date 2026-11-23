import type { Deck, GameState, PlayerSetup, GameSettings } from '../types';
import type { OpenIn, SearchProvider } from './links';

/**
 * Alles wird ausschließlich lokal im Browser (localStorage) gespeichert:
 * eigene Song-Listen, Einstellungen und ein laufendes Spiel. Es gibt keinen Server,
 * keine Konten, keine Tokens und keine Passwörter. Audiodateien werden nie gespeichert.
 */
const KEYS = {
  decks: 'musicguess.decks.v1',
  game: 'musicguess.game.v1',
  prefs: 'musicguess.prefs.v1',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // z. B. privater Modus oder Speicher voll
  }
}

export interface Prefs {
  players: PlayerSetup[];
  settings: GameSettings | null;
  searchProvider: SearchProvider;
  openIn: OpenIn;
  lastDeckId: string | null;
  rulesSeen: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  players: [],
  settings: null,
  searchProvider: 'spotify',
  openIn: 'app',
  lastDeckId: null,
  rulesSeen: false,
};

export const storage = {
  loadDecks: (): Deck[] => {
    const decks = read<Deck[]>(KEYS.decks, []);
    return Array.isArray(decks) ? decks.filter((d) => d && Array.isArray(d.songs)) : [];
  },
  saveDecks: (decks: Deck[]) => write(KEYS.decks, decks.filter((d) => d.kind !== 'demo' && d.kind !== 'builtin')),
  loadGame: (): GameState | null => {
    const g = read<GameState | null>(KEYS.game, null);
    return g && g.players && g.settings ? g : null;
  },
  saveGame: (g: GameState | null) => write(KEYS.game, g),
  loadPrefs: (): Prefs => ({ ...DEFAULT_PREFS, ...read<Partial<Prefs>>(KEYS.prefs, {}) }),
  savePrefs: (p: Prefs) => write(KEYS.prefs, p),
  clearAll: () => {
    for (const k of Object.values(KEYS)) write(k, null);
  },
};
