import type { DatePrecision, Song } from '../types';

export const MIN_YEAR = 1877; // erste Tonaufnahme (Phonograph)
export function maxYear(now = new Date()): number {
  return now.getFullYear();
}

export interface ParsedDate {
  year: number | null;
  date?: string;
  precision: DatePrecision;
  /** Die Quelle war unscharf (z. B. "ca. 1975", "1975/76", "197?"). */
  fuzzy: boolean;
}

/**
 * Liest eine Jahres- oder Datumsangabe. Unterstützt "1985", "1985-03", "1985-03-14",
 * "14.03.1985", "03/1985", "ca. 1985", "1985?", "1975/76".
 * Gibt nur so viel Genauigkeit zurück, wie in der Eingabe steht.
 */
export function parseDate(raw: string | undefined | null, precisionHint?: string): ParsedDate {
  const empty: ParsedDate = { year: null, precision: 'year', fuzzy: false };
  if (!raw) return empty;
  let s = raw.trim();
  if (!s) return empty;
  let fuzzy = false;
  if (/^(ca\.?|circa|um|approx\.?|~)\s*/i.test(s)) {
    fuzzy = true;
    s = s.replace(/^(ca\.?|circa|um|approx\.?|~)\s*/i, '');
  }
  if (/\?$/.test(s)) {
    fuzzy = true;
    s = s.replace(/\?+$/, '').trim();
  }

  let m: RegExpMatchArray | null;
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/))) {
    year = +m[1]; month = +m[2]; day = +m[3];
  } else if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) {
    year = +m[1]; month = +m[2];
  } else if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
    day = +m[1]; month = +m[2]; year = +m[3];
  } else if ((m = s.match(/^(\d{1,2})[/.](\d{4})$/))) {
    month = +m[1]; year = +m[2];
  } else if ((m = s.match(/^(\d{4})\s*[/–-]\s*(\d{2,4})$/))) {
    // Bereich wie "1975/76" -> erstes Jahr, als unscharf markiert
    year = +m[1];
    fuzzy = true;
  } else if ((m = s.match(/^(\d{4})$/))) {
    year = +m[1];
  } else if ((m = s.match(/^(\d{3})[?x_]$/i))) {
    // "197?" -> Jahrzehnt bekannt, Jahr nicht
    return { year: null, precision: 'year', fuzzy: true };
  } else {
    return { ...empty, fuzzy: true };
  }

  if (year === null || year < MIN_YEAR || year > maxYear() + 1) {
    return { year: null, precision: 'year', fuzzy: true };
  }
  if (month !== null && (month < 1 || month > 12)) month = null;
  if (day !== null && (day < 1 || day > 31)) day = null;

  let precision: DatePrecision = day !== null && month !== null ? 'day' : month !== null ? 'month' : 'year';
  // Eine explizite Genauigkeitsangabe (z. B. "release_date_precision") darf die Genauigkeit nur verringern.
  const hint = precisionHint?.trim().toLowerCase();
  if (hint === 'year') precision = 'year';
  else if (hint === 'month' && precision === 'day') precision = 'month';

  const pad = (n: number) => String(n).padStart(2, '0');
  const date =
    precision === 'day' ? `${year}-${pad(month!)}-${pad(day!)}` : precision === 'month' ? `${year}-${pad(month!)}` : `${year}`;
  return { year, date, precision, fuzzy };
}

/** Datum nur so genau anzeigen, wie es bekannt ist. */
export function formatDate(song: Pick<Song, 'year' | 'date' | 'precision'>): string {
  if (song.year === null) return 'unbekannt';
  const d = song.date ?? String(song.year);
  const [y, mo, da] = d.split('-');
  if (song.precision === 'day' && da) return `${+da}.${+mo}.${y}`;
  if (song.precision === 'month' && mo) return `${mo}/${y}`;
  return String(song.year);
}

export function precisionLabel(p: DatePrecision): string {
  return p === 'day' ? 'tagesgenau' : p === 'month' ? 'monatsgenau' : 'nur Jahr bekannt';
}

const VERSION_HINTS: [RegExp, string][] = [
  [/\bremaster(ed)?\b/i, 'Remaster – das Datum kann das der Neuauflage sein'],
  [/\blive\b/i, 'Live-Version – Aufnahme kann jünger als das Original sein'],
  [/\b(re-?recorded|taylor'?s version|neuaufnahme)\b/i, 'Neuaufnahme – Original ist älter'],
  [/\b(remix|rmx|re-?edit|club mix|radio edit|extended (mix|version)|version \d{4})\b/i, 'Remix/Edit – Datum kann vom Original abweichen'],
  [/\b(acoustic|unplugged|mtv unplugged|demo|mono version|stereo version|single version)\b/i, 'Alternative Fassung – Datum prüfen'],
  [/\b(anniversary|deluxe|expanded|edition)\b/i, 'Jubiläums-/Deluxe-Ausgabe – Datum der Neuauflage möglich'],
];

const COMPILATION_HINTS = /\b(greatest hits|best of|the best|hits|collection|essential|anthology|gold|platinum|ultimate|definitive|singles|compilation|sampler|bravo|now that'?s what|kuschelrock|top \d+|\d+ jahre|\d{2}er|\d+s hits)\b/i;

/** Ermittelt Warnhinweise, warum das Jahr eines Songs nicht stimmen könnte. */
export function detectYearWarnings(song: Pick<Song, 'title' | 'album' | 'year' | 'yearSource'>, fuzzy = false): string[] {
  const warnings: string[] = [];
  if (song.year === null) warnings.push('Kein Jahr bekannt – bitte eintragen');
  // Von Hand eingetragene oder online geprüfte Jahre beziehen sich bewusst auf das Original –
  // Hinweise auf Remaster/Live/Compilation im Titel sind dann erledigt.
  if (song.year !== null && (song.yearSource === 'manual' || song.yearSource === 'online')) {
    return song.year > maxYear() ? ['Jahr liegt in der Zukunft'] : [];
  }
  if (fuzzy) warnings.push('Ungenaue Jahresangabe in der Quelle');
  const texts = [song.title, song.album ?? ''];
  for (const [re, msg] of VERSION_HINTS) {
    if (texts.some((t) => re.test(t)) && !warnings.includes(msg)) warnings.push(msg);
  }
  if (song.album && COMPILATION_HINTS.test(song.album)) {
    warnings.push('Album sieht nach Compilation aus – Datum ist evtl. das der Zusammenstellung');
  }
  if (song.yearSource === 'tag') {
    warnings.push('Jahr aus Datei-Tag (kein Original-Datum) – kann Neuauflage sein');
  }
  if (song.year !== null && song.year > maxYear()) warnings.push('Jahr liegt in der Zukunft');
  return warnings;
}

export function normalizeKey(artist: string, title: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s*[([].*?[)\]]\s*/g, ' ')
      .replace(/\s+-\s+.*(remaster|live|version|edit|mix).*$/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return `${clean(artist)}|${clean(title)}`;
}

/** Markiert doppelte Songs; widersprüchliche Jahre bei Duplikaten werden als Warnung ergänzt. */
export function markConflicts(songs: Song[]): Song[] {
  const groups = new Map<string, Song[]>();
  for (const s of songs) {
    const k = normalizeKey(s.artist, s.title);
    const list = groups.get(k) ?? [];
    list.push(s);
    groups.set(k, list);
  }
  return songs.map((s) => {
    const group = groups.get(normalizeKey(s.artist, s.title))!;
    const base = s.warnings.filter((w) => !w.startsWith('Doppelt') && !w.startsWith('Widersprüchlich'));
    if (group.length < 2) return { ...s, warnings: base };
    const years = new Set(group.map((g) => g.year).filter((y): y is number => y !== null));
    const extra = years.size > 1
      ? [`Widersprüchliche Jahre bei Duplikaten: ${[...years].sort().join(', ')}`]
      : ['Doppelt in der Liste'];
    return { ...s, warnings: [...base, ...extra] };
  });
}

export function isPlayable(song: Song): boolean {
  return song.year !== null && song.title.trim() !== '' && song.artist.trim() !== '';
}

export function needsReview(song: Song): boolean {
  if (song.online?.status === 'differs') return true;
  return !song.confirmed && (song.warnings.length > 0 || song.yearSource === 'album-date' || song.yearSource === 'tag');
}
