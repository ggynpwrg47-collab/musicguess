import type { DatePrecision, Deck, OnlineCheck, Song, YearSource } from '../types';
import { normalizeLink } from './links';
import { uid } from './random';
import { detectYearWarnings, markConflicts, maxYear, MIN_YEAR } from './years';

/**
 * Austauschformat für Song-Listen („*.musicguess.json“).
 * Damit lassen sich Listen auf ein anderes Gerät übertragen oder fest in die App einbauen (Ordner src/decks/).
 * Dateien werden beim Einlesen geprüft und bereinigt – sie gelten als nicht vertrauenswürdig.
 */
export const DECK_FORMAT = 'musicguess-deck';
/** Älterer Formatname, wird beim Import weiterhin akzeptiert. */
const LEGACY_DECK_FORMAT = 'jahrgang-deck';
export const DECK_FORMAT_VERSION = 1;

export interface DeckFile {
  format: typeof DECK_FORMAT;
  version: number;
  name: string;
  exportedAt: string;
  songs: Song[];
}

export function serializeDeck(deck: Deck): string {
  const file: DeckFile = {
    format: DECK_FORMAT,
    version: DECK_FORMAT_VERSION,
    name: deck.name,
    exportedAt: new Date().toISOString(),
    // Lokale Audiodateien gibt es auf anderen Geräten nicht – nur die Metadaten werden übernommen.
    songs: deck.songs.map(({ fileName: _fileName, ...rest }) => rest),
  };
  return JSON.stringify(file, null, 2);
}

/** Dateiname wie „roadtrip-mix.musicguess.json“. */
export function deckFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${slug || 'liste'}.musicguess.json`;
}

export function downloadDeck(deck: Deck): void {
  const blob = new Blob([serializeDeck(deck)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = deckFileName(deck.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PRECISIONS: DatePrecision[] = ['year', 'month', 'day'];
const SOURCES: YearSource[] = ['manual', 'list', 'album-date', 'tag-original', 'tag', 'filename', 'demo', 'online'];
const ONLINE_STATUS: OnlineCheck['status'][] = ['match', 'differs', 'filled', 'kept', 'notfound', 'error'];

const str = (v: unknown, max = 300): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanSong(raw: unknown, index: number, idPrefix: string): Song | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title);
  const artist = str(r.artist);
  if (!title || !artist) return null;
  const year = typeof r.year === 'number' && Number.isInteger(r.year) && r.year >= MIN_YEAR && r.year <= maxYear() ? r.year : null;
  const precision = PRECISIONS.includes(r.precision as DatePrecision) ? (r.precision as DatePrecision) : 'year';
  const date = typeof r.date === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(r.date) && year !== null && r.date.startsWith(String(year)) ? r.date : year !== null ? String(year) : undefined;
  const yearSource = SOURCES.includes(r.yearSource as YearSource) ? (r.yearSource as YearSource) : 'list';
  let online: OnlineCheck | undefined;
  if (typeof r.online === 'object' && r.online !== null) {
    const o = r.online as Record<string, unknown>;
    if (ONLINE_STATUS.includes(o.status as OnlineCheck['status'])) {
      const oy = typeof o.year === 'number' && Number.isInteger(o.year) ? o.year : undefined;
      const ourl = typeof o.url === 'string' && o.url.startsWith('https://musicbrainz.org/') ? o.url : undefined;
      online = {
        status: o.status as OnlineCheck['status'],
        year: oy,
        date: typeof o.date === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(o.date) ? o.date : undefined,
        precision: PRECISIONS.includes(o.precision as DatePrecision) ? (o.precision as DatePrecision) : undefined,
        url: ourl,
        checkedAt: typeof o.checkedAt === 'number' ? o.checkedAt : 0,
      };
    }
  }
  const album = str(r.album) || undefined;
  const base = { title, artist, year, album, yearSource };
  const id = typeof r.id === 'string' && /^[A-Za-z0-9_:-]{1,60}$/.test(r.id) ? r.id : `${idPrefix}${index}`;
  return {
    id,
    ...base,
    date,
    precision: year === null ? 'year' : precision,
    warnings: detectYearWarnings(base),
    confirmed: r.confirmed === true && year !== null,
    link: normalizeLink(str(r.link, 500)),
    online,
  };
}

/** Liest eine exportierte Liste. Gibt null zurück, wenn die Datei nicht im Music-Guess-Format ist. */
export function parseDeckFile(text: string, opts: { id?: string; kind?: Deck['kind'] } = {}): Deck | null {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return null;
  }
  return deckFromData(data, opts);
}

export function deckFromData(data: unknown, opts: { id?: string; kind?: Deck['kind'] } = {}): Deck | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if ((d.format !== DECK_FORMAT && d.format !== LEGACY_DECK_FORMAT) || !Array.isArray(d.songs)) return null;
  const id = opts.id ?? uid('d');
  const seen = new Set<string>();
  const songs: Song[] = [];
  d.songs.slice(0, 5000).forEach((raw, i) => {
    const s = cleanSong(raw, i, `${id}_s`);
    if (!s) return;
    if (seen.has(s.id)) s.id = `${id}_s${i}`;
    seen.add(s.id);
    songs.push(s);
  });
  if (songs.length === 0) return null;
  const now = Date.now();
  return {
    id,
    name: str(d.name, 80) || 'Importierte Liste',
    kind: opts.kind ?? 'list',
    songs: markConflicts(songs),
    createdAt: now,
    updatedAt: now,
  };
}
