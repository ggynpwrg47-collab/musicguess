import { describe, expect, it } from 'vitest';
import { detectYearWarnings, formatDate, markConflicts, needsReview, parseDate } from './years';
import { createSong } from './importer';

describe('parseDate', () => {
  it('liest Jahr, Monat und Tag mit passender Genauigkeit', () => {
    expect(parseDate('1985')).toMatchObject({ year: 1985, precision: 'year', date: '1985' });
    expect(parseDate('1985-03')).toMatchObject({ year: 1985, precision: 'month', date: '1985-03' });
    expect(parseDate('1985-03-14')).toMatchObject({ year: 1985, precision: 'day', date: '1985-03-14' });
    expect(parseDate('14.03.1985')).toMatchObject({ year: 1985, precision: 'day' });
    expect(parseDate('03/1985')).toMatchObject({ year: 1985, precision: 'month' });
  });

  it('erhöht nie die Genauigkeit über die Quellangabe hinaus', () => {
    // Spotify-artige Daten: "1985-01-01" mit precision "year" darf nicht als 1.1.1985 erscheinen.
    const p = parseDate('1985-01-01', 'year');
    expect(p.precision).toBe('year');
    expect(p.date).toBe('1985');
    expect(parseDate('1985-03-01', 'month')).toMatchObject({ precision: 'month', date: '1985-03' });
  });

  it('markiert unscharfe Angaben', () => {
    expect(parseDate('ca. 1975')).toMatchObject({ year: 1975, fuzzy: true });
    expect(parseDate('1975?')).toMatchObject({ year: 1975, fuzzy: true });
    expect(parseDate('1975/76')).toMatchObject({ year: 1975, fuzzy: true });
    expect(parseDate('197?')).toMatchObject({ year: null, fuzzy: true });
  });

  it('lehnt unplausible Jahre ab', () => {
    expect(parseDate('1200').year).toBeNull();
    expect(parseDate('3000').year).toBeNull();
    expect(parseDate('abc').year).toBeNull();
    expect(parseDate('').year).toBeNull();
  });
});

describe('formatDate', () => {
  it('zeigt nur die bekannte Genauigkeit', () => {
    expect(formatDate({ year: 1985, date: '1985', precision: 'year' })).toBe('1985');
    expect(formatDate({ year: 1985, date: '1985-03', precision: 'month' })).toBe('03/1985');
    expect(formatDate({ year: 1985, date: '1985-03-14', precision: 'day' })).toBe('14.3.1985');
    expect(formatDate({ year: null, precision: 'year' })).toBe('unbekannt');
  });
});

describe('Warnungen', () => {
  it('erkennt Remaster, Live-Versionen und Compilations', () => {
    expect(detectYearWarnings({ title: 'Song - 2011 Remaster', year: 2011, yearSource: 'list' }).join()).toMatch(/Remaster/);
    expect(detectYearWarnings({ title: 'Song (Live)', year: 1990, yearSource: 'list' }).join()).toMatch(/Live/);
    expect(detectYearWarnings({ title: 'Song', album: 'Greatest Hits', year: 2001, yearSource: 'list' }).join()).toMatch(/Compilation/);
    expect(detectYearWarnings({ title: 'Song', year: 1999, yearSource: 'list' })).toEqual([]);
    // Bewusst eingetragene bzw. online geprüfte Jahre brauchen keine Remaster-Warnung mehr
    expect(detectYearWarnings({ title: 'Song - 2011 Remaster', year: 1975, yearSource: 'online' })).toEqual([]);
    expect(detectYearWarnings({ title: 'Song (Live)', year: 1975, yearSource: 'manual' })).toEqual([]);
  });

  it('Albumdatum muss immer geprüft werden', () => {
    const s = createSong({ artist: 'A', title: 'B', rawDate: '1999-05-01', precision: 'day' });
    expect(s.yearSource).toBe('album-date');
    expect(needsReview(s)).toBe(true);
    expect(needsReview({ ...s, confirmed: true })).toBe(false);
  });

  it('meldet widersprüchliche Duplikate', () => {
    const a = createSong({ artist: 'Queen', title: 'Bohemian Rhapsody', rawYear: '1975' });
    const b = createSong({ artist: 'Queen', title: 'Bohemian Rhapsody (Remastered 2011)', rawYear: '2011' });
    const [ma, mb] = markConflicts([a, b]);
    expect(ma.warnings.join()).toMatch(/Widersprüchliche Jahre/);
    expect(mb.warnings.join()).toMatch(/Widersprüchliche Jahre/);
  });
});
