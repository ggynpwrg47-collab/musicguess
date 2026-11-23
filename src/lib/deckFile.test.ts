import { describe, expect, it } from 'vitest';
import type { Deck } from '../types';
import { deckFileName, parseDeckFile, serializeDeck } from './deckFile';
import { loadBuiltinDecks } from './builtinDecks';
import { createDemoDeck } from './demoDeck';

const deck: Deck = {
  id: 'd1',
  name: 'Roadtrip Mix',
  kind: 'list',
  createdAt: 1,
  updatedAt: 1,
  songs: [
    {
      id: 's1', title: 'Africa', artist: 'Toto', year: 1982, date: '1982-04-08', precision: 'day', yearSource: 'online',
      warnings: [], confirmed: true, link: 'https://open.spotify.com/track/2374M0fQpWi3dLnB54qaLX',
      online: { status: 'filled', year: 1982, date: '1982-04-08', precision: 'day', url: 'https://musicbrainz.org/recording/x', checkedAt: 5 },
    },
    { id: 's2', title: 'Song', artist: 'Band', year: null, precision: 'year', yearSource: 'manual', warnings: [], confirmed: false, fileName: 'song.mp3' },
  ],
};

describe('Listen exportieren und importieren', () => {
  it('Export → Import ergibt dieselben Songs (ohne lokale Dateinamen)', () => {
    const text = serializeDeck(deck);
    expect(text).not.toContain('song.mp3');
    const back = parseDeckFile(text, { id: 'neu' })!;
    expect(back).toMatchObject({ id: 'neu', name: 'Roadtrip Mix', kind: 'list' });
    expect(back.songs[0]).toMatchObject({
      id: 's1', title: 'Africa', year: 1982, date: '1982-04-08', precision: 'day', yearSource: 'online', confirmed: true,
      link: 'https://open.spotify.com/track/2374M0fQpWi3dLnB54qaLX', online: { status: 'filled', year: 1982 },
    });
    expect(back.songs[1]).toMatchObject({ year: null, confirmed: false });
    expect(back.songs[1].fileName).toBeUndefined();
  });

  it('das Beispiel-Deck übersteht den Roundtrip vollständig', () => {
    const demo = createDemoDeck();
    const back = parseDeckFile(serializeDeck(demo))!;
    expect(back.songs.map((s) => [s.artist, s.title, s.year])).toEqual(demo.songs.map((s) => [s.artist, s.title, s.year]));
  });

  it('bereinigt manipulierte Dateien', () => {
    const evil = JSON.stringify({
      format: 'musicguess-deck',
      version: 1,
      name: 'x'.repeat(500),
      songs: [
        { id: 'a', title: 'T', artist: 'A', year: 3000, confirmed: true, link: 'javascript:alert(1)', precision: 'nonsense', yearSource: 'evil' },
        { id: 'a', title: 'T2', artist: 'A2', year: 1999, date: '<img>', online: { status: 'differs', url: 'https://evil.example/' } },
        { title: '', artist: 'leer' },
        'kaputt',
      ],
    });
    const d = parseDeckFile(evil)!;
    expect(d.name).toHaveLength(80);
    expect(d.songs).toHaveLength(2);
    expect(d.songs[0]).toMatchObject({ year: null, confirmed: false, link: undefined, precision: 'year', yearSource: 'list' });
    expect(d.songs[1].id).not.toBe(d.songs[0].id);
    expect(d.songs[1]).toMatchObject({ year: 1999, date: '1999' });
    expect(d.songs[1].online?.url).toBeUndefined();
  });

  it('erkennt fremde Dateien nicht als Liste', () => {
    expect(parseDeckFile('{"playlists": []}')).toBeNull();
    expect(parseDeckFile('kein json')).toBeNull();
    expect(parseDeckFile(JSON.stringify({ format: 'musicguess-deck', songs: [] }))).toBeNull();
  });

  it('baut sprechende Dateinamen', () => {
    expect(deckFileName('Roadtrip Mix 2024!')).toBe('roadtrip-mix-2024.musicguess.json');
    expect(deckFileName('Größte Hits')).toBe('grosste-hits.musicguess.json');
    expect(deckFileName('???')).toBe('liste.musicguess.json');
  });

  it('eingebaute Listen werden geladen (Ordner src/decks/)', () => {
    const decks = loadBuiltinDecks();
    expect(Array.isArray(decks)).toBe(true);
    for (const d of decks) expect(d.kind).toBe('builtin');
  });
});
