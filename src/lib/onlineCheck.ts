import type { DatePrecision, OnlineCheck, Song } from '../types';
import { detectYearWarnings, parseDate } from './years';

/**
 * Optionale Online-Prüfung des Erscheinungsjahres über MusicBrainz (offene Musikdatenbank, kein Konto/Schlüssel).
 * Gesucht wird nach der *frühesten* Veröffentlichung einer Aufnahme dieses Titels vom selben Interpreten.
 * So werden Remaster, Compilations und spätere Live-Versionen auf das Original zurückgeführt.
 * Gesendet werden nur Interpret und Titel – und nur, wenn der Nutzer die Prüfung startet.
 */
export const MB_BASE = 'https://musicbrainz.org/ws/2/recording';
export const MB_DELAY_MS = 1100; // MusicBrainz erlaubt höchstens 1 Anfrage pro Sekunde

const VERSION_SUFFIX =
  /\s*[-–—]\s*(\d{4}\s*)?(remaster(ed)?|live|mono|stereo|single|radio|edit|version|remix|mix|acoustic|demo|bonus|deluxe|anniversary|re-?recorded|from|recorded|taken from|original)\b.*$/i;
const VERSION_PAREN =
  /\s*[([][^)\]]*(remaster|live|version|mono|stereo|edit|remix|mix|acoustic|demo|feat\.?|ft\.?|featuring|with |from |re-?recorded|deluxe|anniversary|bonus)[^)\]]*[)\]]/gi;

/** Entfernt Zusätze wie „- Remastered 2011“, „(Live at Wembley)“ oder „(feat. X)“. */
export function cleanTitle(title: string): string {
  let t = title.replace(VERSION_PAREN, '');
  t = t.replace(VERSION_SUFFIX, '');
  return t.replace(/\s+/g, ' ').trim() || title.trim();
}

/** Erster bzw. Hauptinterpret („A feat. B“, „A, B“ → „A“). */
export function primaryArtist(artist: string): string {
  // Nicht an „&“ oder „/“ trennen: Bandnamen wie „Simon & Garfunkel“ oder „AC/DC“ bleiben ganz.
  const first = artist.split(/\s*(?:,|;|\s(?:feat\.?|ft\.?|featuring|with|x|vs\.?)\s)\s*/i)[0];
  return (first || artist).trim();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`"]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();
}

const escapeLucene = (s: string) => s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');

export function buildQueryUrl(song: Pick<Song, 'title' | 'artist'>): string {
  const q = `recording:"${escapeLucene(cleanTitle(song.title))}" AND artist:"${escapeLucene(primaryArtist(song.artist))}"`;
  return `${MB_BASE}?query=${encodeURIComponent(q)}&limit=50&fmt=json`;
}

interface MbRecording {
  id: string;
  score?: number;
  title: string;
  'first-release-date'?: string;
  'artist-credit'?: { name?: string; artist?: { name?: string } }[];
  releases?: { date?: string }[];
}

export interface YearPick {
  year: number;
  date: string;
  precision: DatePrecision;
  url: string;
}

/** Früheres Datum gewinnt; bei gleichem Datum-Präfix („1975“ vs. „1975-10-31“) das genauere. */
function isEarlierOrMorePrecise(candidate: string, current: string): boolean {
  if (candidate.startsWith(current)) return candidate.length > current.length;
  if (current.startsWith(candidate)) return false;
  return candidate < current;
}

/** Wählt die früheste Veröffentlichung unter den passenden Aufnahmen. */
export function pickEarliest(recordings: MbRecording[], song: { title: string; artist: string }): YearPick | null {
  const wantTitle = norm(cleanTitle(song.title));
  const wantArtist = norm(primaryArtist(song.artist));
  let best: YearPick | null = null;
  for (const r of recordings) {
    if ((r.score ?? 100) < 70) continue;
    if (norm(cleanTitle(r.title)) !== wantTitle) continue;
    const credits = (r['artist-credit'] ?? []).flatMap((c) => [c.name ?? '', c.artist?.name ?? '']).map(norm);
    if (!credits.some((c) => c === wantArtist || c.includes(wantArtist) || (c.length > 2 && wantArtist.includes(c)))) continue;
    const dates = [r['first-release-date'], ...(r.releases ?? []).map((x) => x.date)].filter((d): d is string => !!d);
    for (const d of dates) {
      const p = parseDate(d);
      if (p.year === null || !p.date) continue;
      if (!best || isEarlierOrMorePrecise(p.date, best.date)) {
        best = { year: p.year, date: p.date, precision: p.precision, url: `https://musicbrainz.org/recording/${r.id}` };
      }
    }
  }
  return best;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Abgebrochen', 'AbortError'));
    });
  });

/** Fragt MusicBrainz für einen Song ab (mit bis zu 2 Wiederholungen bei Überlastung). */
export async function lookupSong(song: Song, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<OnlineCheck> {
  const url = buildQueryUrl(song);
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetcher(url, { headers: { Accept: 'application/json' }, signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      return { status: 'error', checkedAt: Date.now() };
    }
    if (res.status === 503 || res.status === 429) {
      await sleep(2000 * (attempt + 1), signal);
      continue;
    }
    if (!res.ok) return { status: 'error', checkedAt: Date.now() };
    let data: { recordings?: MbRecording[] };
    try {
      data = await res.json();
    } catch {
      return { status: 'error', checkedAt: Date.now() };
    }
    const pick = pickEarliest(data.recordings ?? [], song);
    if (!pick) return { status: 'notfound', checkedAt: Date.now() };
    const status: OnlineCheck['status'] = song.year === null ? 'filled' : song.year === pick.year ? 'match' : 'differs';
    return { status, year: pick.year, date: pick.date, precision: pick.precision, url: pick.url, checkedAt: Date.now() };
  }
  return { status: 'error', checkedAt: Date.now() };
}

/** Überträgt ein Prüfergebnis auf den Song. Abweichungen bleiben ein Vorschlag, bis jemand entscheidet. */
export function applyCheck(song: Song, check: OnlineCheck): Song {
  if (check.status === 'filled' && check.year !== undefined) {
    const next: Song = { ...song, year: check.year, date: check.date, precision: check.precision ?? 'year', yearSource: 'online', confirmed: true, online: check };
    return { ...next, warnings: detectYearWarnings(next) };
  }
  if (check.status === 'match') return { ...song, confirmed: true, online: check };
  if (check.status === 'differs') return { ...song, confirmed: false, online: check };
  return { ...song, online: check };
}

/** Online-Vorschlag übernehmen. */
export function acceptSuggestion(song: Song): Song {
  const o = song.online;
  if (!o || o.year === undefined) return song;
  const next: Song = { ...song, year: o.year, date: o.date, precision: o.precision ?? 'year', yearSource: 'online', confirmed: true, online: { ...o, status: 'match' } };
  return { ...next, warnings: detectYearWarnings(next) };
}

/** Eigenes Jahr trotz Abweichung behalten. */
export function keepOwnYear(song: Song): Song {
  if (!song.online) return song;
  return { ...song, confirmed: true, online: { ...song.online, status: 'kept' } };
}

export interface RunOptions {
  fetcher?: Fetcher;
  signal?: AbortSignal;
  delayMs?: number;
  onResult: (songId: string, check: OnlineCheck, index: number) => void;
}

/** Prüft Songs nacheinander im erlaubten Tempo. Bricht bei signal.abort() sauber ab. */
export async function runChecks(songs: Song[], { fetcher = fetch, signal, delayMs = MB_DELAY_MS, onResult }: RunOptions): Promise<void> {
  for (let i = 0; i < songs.length; i++) {
    if (signal?.aborted) return;
    const started = Date.now();
    let check: OnlineCheck;
    try {
      check = await lookupSong(songs[i], fetcher, signal);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      check = { status: 'error', checkedAt: Date.now() };
    }
    onResult(songs[i].id, check, i);
    const wait = delayMs - (Date.now() - started);
    if (i < songs.length - 1 && wait > 0) {
      try {
        await sleep(wait, signal);
      } catch {
        return;
      }
    }
  }
}
