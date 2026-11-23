import { describe, expect, it } from 'vitest';
import { importText, parseCsv, parseFileName, parseLine } from './importer';
import { normalizeLink, searchLink, spotifyAppUri } from './links';

describe('parseCsv', () => {
  it('versteht Anführungszeichen, Kommas und Zeilenumbrüche in Feldern', () => {
    const rows = parseCsv('a,b\n"x, y","he said ""hi"""\n"multi\nline",z');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
      ['multi\nline', 'z'],
    ]);
  });
  it('erkennt Semikolon als Trennzeichen', () => {
    expect(parseCsv('Titel;Interpret;Jahr\nA;B;1999')[1]).toEqual(['A', 'B', '1999']);
  });
});

describe('importText', () => {
  it('importiert CSV mit deutschen Spaltennamen', () => {
    const r = importText('Interpret;Titel;Jahr;Link\nQueen;Bohemian Rhapsody;1975;spotify:track:4u7EnebtmKWzUH433cf5Qv');
    expect(r.songs).toHaveLength(1);
    expect(r.songs[0]).toMatchObject({ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975, yearSource: 'list' });
    expect(r.songs[0].link).toBe('https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv');
  });

  it('übernimmt Release-Datum samt Genauigkeit, warnt aber vor dem Albumdatum', () => {
    const csv = 'Track Name,Artist Name(s),Album Name,Album Release Date,Release Date Precision\n"Song","A;B","Best of X","1999-01-01","year"';
    const r = importText(csv);
    const s = r.songs[0];
    expect(s.artist).toBe('A, B');
    expect(s.year).toBe(1999);
    expect(s.precision).toBe('year');
    expect(s.yearSource).toBe('album-date');
    expect(s.warnings.join()).toMatch(/Compilation/);
    expect(r.messages.join()).toMatch(/Albumdatum|Album/);
  });

  it('liest Freitext-Zeilen', () => {
    const r = importText('# Kommentar\nQueen - Bohemian Rhapsody (1975)\nNena – 99 Luftballons; 1983\nkaputt\nABBA - Dancing Queen');
    expect(r.songs.map((s) => [s.artist, s.title, s.year])).toEqual([
      ['Queen', 'Bohemian Rhapsody', 1975],
      ['Nena', '99 Luftballons', 1983],
      ['ABBA', 'Dancing Queen', null],
    ]);
    expect(r.skipped).toBe(1);
    expect(r.songs[2].warnings.join()).toMatch(/Kein Jahr/);
  });

  it('entfernt Links aus Freitext und speichert sie separat', () => {
    const s = parseLine('Toto - Africa (1982) https://example.com/africa')!;
    expect(s.title).toBe('Africa');
    expect(s.link).toBe('https://example.com/africa');
  });

  it('meldet leere Eingaben verständlich', () => {
    expect(importText('   ').messages[0]).toMatch(/leer/);
  });
});

describe('Links', () => {
  it('akzeptiert nur http(s)', () => {
    expect(normalizeLink('javascript:alert(1)')).toBeUndefined();
    expect(normalizeLink('http://example.com/x')).toBe('https://example.com/x');
    expect(normalizeLink('nonsense')).toBeUndefined();
  });
  it('wandelt Spotify-Links in App-Adressen um', () => {
    expect(spotifyAppUri('https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv?si=abc', 'spotify', 'a', 'b')).toBe('spotify:track:4u7EnebtmKWzUH433cf5Qv#0:01');
    expect(spotifyAppUri('https://open.spotify.com/intl-de/track/4u7EnebtmKWzUH433cf5Qv', 'spotify', 'a', 'b')).toBe('spotify:track:4u7EnebtmKWzUH433cf5Qv#0:01');
    expect(spotifyAppUri('https://www.youtube.com/watch?v=x', 'spotify', 'a', 'b')).toBeUndefined();
    expect(spotifyAppUri(undefined, 'spotify', 'Queen', 'Bohemian Rhapsody')).toBe('spotify:search:Queen%20Bohemian%20Rhapsody');
    expect(spotifyAppUri(undefined, 'youtube', 'Queen', 'X')).toBeUndefined();
  });
  it('baut Suchlinks ohne API', () => {
    expect(searchLink('spotify', 'Queen', 'Bohemian Rhapsody')).toBe('https://open.spotify.com/search/Queen%20Bohemian%20Rhapsody');
    expect(searchLink('none', 'a', 'b')).toBeUndefined();
  });
});

describe('parseFileName', () => {
  it('liest "Interpret - Titel (Jahr)"', () => {
    expect(parseFileName('03 - Queen - Bohemian Rhapsody (1975).mp3')).toEqual({ artist: 'Queen', title: 'Bohemian Rhapsody', year: '1975' });
    expect(parseFileName('Song.mp3')).toEqual({ title: 'Song', year: undefined });
  });
});
