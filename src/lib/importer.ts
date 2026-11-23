import type { Song, YearSource } from '../types';
import { normalizeLink } from './links';
import { uid } from './random';
import { detectYearWarnings, markConflicts, parseDate } from './years';

/** Einfacher, robuster CSV-Parser (RFC 4180: Anführungszeichen, "" als Escape, Zeilenumbrüche in Feldern). */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const delim = delimiter ?? detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: [string, number][] = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

const ALIASES: Record<string, string[]> = {
  title: ['title', 'titel', 'song', 'track', 'track name', 'trackname', 'song title', 'songtitel', 'name'],
  artist: ['artist', 'artists', 'interpret', 'interpreten', 'künstler', 'kuenstler', 'band', 'artist name', 'artist name(s)', 'artist names'],
  year: ['year', 'jahr', 'erscheinungsjahr', 'original year', 'originaljahr', 'release year'],
  date: ['release date', 'release_date', 'album release date', 'erscheinungsdatum', 'veröffentlichung', 'veroeffentlichung', 'datum', 'date'],
  precision: ['release date precision', 'release_date_precision', 'precision', 'genauigkeit'],
  album: ['album', 'album name', 'albumname'],
  link: ['link', 'url', 'spotify', 'spotify url', 'track uri', 'uri', 'spotify uri', 'youtube'],
};

function mapHeader(header: string[]): Record<keyof typeof ALIASES, number> | null {
  const norm = header.map((h) => h.trim().toLowerCase());
  const map = {} as Record<keyof typeof ALIASES, number>;
  for (const key of Object.keys(ALIASES) as (keyof typeof ALIASES)[]) {
    map[key] = norm.findIndex((h) => ALIASES[key].includes(h));
  }
  if (map.title < 0 || map.artist < 0) return null;
  return map;
}

export interface ImportResult {
  songs: Song[];
  skipped: number;
  messages: string[];
}

export function createSong(input: {
  title: string;
  artist: string;
  rawYear?: string;
  rawDate?: string;
  precision?: string;
  album?: string;
  link?: string;
  fileName?: string;
  sourceHint?: YearSource;
}): Song {
  // Ein explizites Jahr hat Vorrang vor einem (Album-)Datum.
  const fromYear = input.rawYear ? parseDate(input.rawYear) : null;
  const fromDate = input.rawDate ? parseDate(input.rawDate, input.precision) : null;
  const useYear = fromYear && fromYear.year !== null;
  const parsed = useYear ? fromYear! : fromDate ?? fromYear ?? { year: null, precision: 'year' as const, fuzzy: false };
  const yearSource: YearSource = input.sourceHint ?? (useYear ? 'list' : fromDate && fromDate.year !== null ? 'album-date' : 'manual');
  const album = input.album?.trim() || undefined;
  const base = {
    title: input.title.trim(),
    artist: input.artist.trim(),
    year: parsed.year,
    album,
    yearSource,
  };
  return {
    id: uid('s'),
    ...base,
    date: parsed.date,
    precision: parsed.precision,
    warnings: detectYearWarnings(base, parsed.fuzzy),
    confirmed: false,
    link: normalizeLink(input.link),
    fileName: input.fileName,
  };
}

/** Freitext: eine Zeile pro Song, z. B. "Queen - Bohemian Rhapsody (1975)" oder "Queen – Bohemian Rhapsody; 1975; https://…". */
export function parseLine(line: string): Song | null {
  let s = line.trim();
  if (!s || s.startsWith('#')) return null;
  let link: string | undefined;
  const urlMatch = s.match(/(https?:\/\/\S+|spotify:track:[A-Za-z0-9]+)/);
  if (urlMatch) {
    link = urlMatch[1];
    s = s.replace(urlMatch[1], '').trim();
  }
  let rawYear: string | undefined;
  const yearMatch =
    s.match(/[([]\s*((?:ca\.?\s*)?\d{4}(?:\s*\/\s*\d{2,4})?\??)\s*[)\]]\s*[;,|]?\s*$/i) ??
    s.match(/[;,|\t]\s*((?:ca\.?\s*)?\d{4}(?:\s*\/\s*\d{2,4})?\??)\s*[;,|]?\s*$/i);
  if (yearMatch) {
    rawYear = yearMatch[1];
    s = s.slice(0, yearMatch.index).trim();
  }
  s = s.replace(/[;,|]+\s*$/, '').trim();
  const parts = s.split(/\s+[-–—]\s+|\s*;\s*|\t/);
  if (parts.length < 2) return null;
  const artist = parts[0];
  const title = parts.slice(1).join(' - ');
  if (!artist.trim() || !title.trim()) return null;
  return createSong({ artist, title, rawYear, link });
}

export function importText(text: string): ImportResult {
  const messages: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { songs: [], skipped: 0, messages: ['Die Eingabe ist leer.'] };

  // CSV/TSV mit Kopfzeile?
  const rows = parseCsv(trimmed);
  const header = rows.length > 1 ? mapHeader(rows[0]) : null;
  let songs: Song[] = [];
  let skipped = 0;

  if (header) {
    for (const r of rows.slice(1)) {
      const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
      const title = get(header.title);
      const artist = get(header.artist).replace(/\s*;\s*/g, ', ');
      if (!title || !artist) {
        skipped++;
        continue;
      }
      songs.push(
        createSong({
          title,
          artist,
          rawYear: get(header.year) || undefined,
          rawDate: get(header.date) || undefined,
          precision: get(header.precision) || undefined,
          album: get(header.album) || undefined,
          link: get(header.link) || undefined,
        }),
      );
    }
    if (header.year < 0 && header.date >= 0) {
      messages.push(
        'Die Liste enthält nur ein Release-/Albumdatum. Das ist oft das Datum des Albums oder einer Neuauflage, nicht der Erstveröffentlichung des Songs – bitte vor dem Spiel prüfen.',
      );
    }
    if (header.year < 0 && header.date < 0) {
      messages.push('Keine Spalte für Jahr oder Datum gefunden – bitte die Jahre in der Prüfansicht eintragen.');
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const song = parseLine(line);
      if (song) songs.push(song);
      else skipped++;
    }
  }

  songs = markConflicts(songs);
  if (skipped > 0) messages.push(`${skipped} Zeile(n) konnten nicht gelesen werden (Interpret und Titel nötig).`);
  if (songs.length === 0) messages.push('Keine Songs erkannt. Format: „Interpret - Titel (Jahr)“ oder CSV mit Kopfzeile.');
  return { songs, skipped, messages };
}

/** Dateiname wie "Queen - Bohemian Rhapsody (1975).mp3" als Fallback, wenn keine Tags vorhanden sind. */
export function parseFileName(fileName: string): { artist?: string; title?: string; year?: string } {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/^\d{1,3}[\s._-]+/, '').replace(/_/g, ' ');
  let year: string | undefined;
  let rest = base;
  const y = rest.match(/[([]\s*(\d{4})\s*[)\]]/);
  if (y) {
    year = y[1];
    rest = rest.replace(y[0], '').trim();
  }
  const parts = rest.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), year };
  return { title: rest.trim(), year };
}
