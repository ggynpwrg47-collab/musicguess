import { describe, expect, it } from 'vitest';
import type { Song } from '../types';
import { acceptSuggestion, applyCheck, buildQueryUrl, cleanTitle, keepOwnYear, lookupSong, pickEarliest, primaryArtist, runChecks } from './onlineCheck';
import { needsReview } from './years';

const song = (title: string, artist: string, year: number | null): Song => ({
  id: 's1', title, artist, year, precision: 'year', yearSource: 'album-date', warnings: [], confirmed: false,
});

const rec = (id: string, title: string, artist: string, first?: string, releases: string[] = [], score = 100) => ({
  id, title, score, 'first-release-date': first, 'artist-credit': [{ name: artist, artist: { name: artist } }], releases: releases.map((date) => ({ date })),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('Titel und Interpret bereinigen', () => {
  it('entfernt Versionszusätze', () => {
    expect(cleanTitle('Bohemian Rhapsody - Remastered 2011')).toBe('Bohemian Rhapsody');
    expect(cleanTitle('Hotel California (Live on MTV, 1994)')).toBe('Hotel California');
    expect(cleanTitle('Wonderwall - Remastered')).toBe('Wonderwall');
    expect(cleanTitle('Get Lucky (feat. Pharrell Williams)')).toBe('Get Lucky');
    expect(cleanTitle('Love Story (Taylor’s Version)')).toBe('Love Story');
    expect(cleanTitle('Smells Like Teen Spirit')).toBe('Smells Like Teen Spirit');
  });
  it('nimmt den Hauptinterpreten', () => {
    expect(primaryArtist('Mark Ronson feat. Bruno Mars')).toBe('Mark Ronson');
    expect(primaryArtist('Simon & Garfunkel')).toBe('Simon & Garfunkel');
    expect(primaryArtist('AC/DC')).toBe('AC/DC');
    expect(primaryArtist('Daft Punk, Pharrell Williams')).toBe('Daft Punk');
    expect(primaryArtist('Queen')).toBe('Queen');
  });
  it('baut eine maskierte Suchanfrage', () => {
    const url = decodeURIComponent(buildQueryUrl({ title: 'Song: Teil "1"', artist: 'AC/DC' }));
    expect(url).toContain('recording:"Song\\: Teil \\"1\\""');
    expect(url).toContain('artist:"AC\\/DC"');
    expect(url).toContain('fmt=json');
  });
});

describe('pickEarliest', () => {
  it('findet das Original statt Remaster und Live-Version', () => {
    const recs = [
      rec('a', 'Bohemian Rhapsody', 'Queen', '2011-03-14'),
      rec('b', 'Bohemian Rhapsody', 'Queen', '1975-10-31'),
      rec('c', 'Bohemian Rhapsody (live)', 'Queen', '1986-07-12'),
      rec('d', 'Bohemian Rhapsody', 'Some Cover Band', '1970'),
      rec('e', 'Another Song', 'Queen', '1960'),
    ];
    expect(pickEarliest(recs, { title: 'Bohemian Rhapsody - 2011 Remaster', artist: 'Queen' })).toMatchObject({
      year: 1975, date: '1975-10-31', precision: 'day', url: 'https://musicbrainz.org/recording/b',
    });
  });
  it('nutzt Release-Daten, wenn first-release-date fehlt, und bevorzugt genauere Daten', () => {
    const recs = [rec('a', 'Africa', 'Toto', undefined, ['1983-01', '1982']), rec('b', 'Africa', 'Toto', undefined, ['1982-04-08'])];
    expect(pickEarliest(recs, { title: 'Africa', artist: 'Toto' })).toMatchObject({ year: 1982, date: '1982-04-08' });
  });
  it('ignoriert schwache Treffer', () => {
    expect(pickEarliest([rec('a', 'Africa', 'Toto', '1982', [], 40)], { title: 'Africa', artist: 'Toto' })).toBeNull();
  });
});

describe('lookupSong', () => {
  it('meldet Abweichungen und Treffer', async () => {
    const fetcher = async () => jsonResponse({ recordings: [rec('b', 'Bohemian Rhapsody', 'Queen', '1975-10-31')] });
    expect(await lookupSong(song('Bohemian Rhapsody - Remastered 2011', 'Queen', 2011), fetcher)).toMatchObject({ status: 'differs', year: 1975 });
    expect(await lookupSong(song('Bohemian Rhapsody', 'Queen', 1975), fetcher)).toMatchObject({ status: 'match' });
    expect(await lookupSong(song('Bohemian Rhapsody', 'Queen', null), fetcher)).toMatchObject({ status: 'filled', year: 1975 });
  });
  it('wiederholt bei Überlastung (503) und meldet Netzwerkfehler', async () => {
    let calls = 0;
    const flaky = async () => (++calls === 1 ? new Response('', { status: 503 }) : jsonResponse({ recordings: [] }));
    expect(await lookupSong(song('X', 'Y', 2000), flaky)).toMatchObject({ status: 'notfound' });
    expect(calls).toBe(2);
    const broken = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await lookupSong(song('X', 'Y', 2000), broken)).toMatchObject({ status: 'error' });
  });
});

describe('Ergebnisse anwenden', () => {
  const check = { status: 'differs' as const, year: 1975, date: '1975-10-31', precision: 'day' as const, checkedAt: 1 };
  it('Abweichung bleibt Vorschlag, bis entschieden wird', () => {
    const s = applyCheck(song('Bohemian Rhapsody', 'Queen', 2011), check);
    expect(s.year).toBe(2011);
    expect(needsReview(s)).toBe(true);
    const accepted = acceptSuggestion(s);
    expect(accepted).toMatchObject({ year: 1975, precision: 'day', yearSource: 'online', confirmed: true });
    expect(needsReview(accepted)).toBe(false);
    const kept = keepOwnYear(s);
    expect(kept).toMatchObject({ year: 2011, confirmed: true });
    expect(needsReview(kept)).toBe(false);
  });
  it('fehlendes Jahr wird ergänzt', () => {
    const s = applyCheck(song('Africa', 'Toto', null), { status: 'filled', year: 1982, date: '1982', precision: 'year', checkedAt: 1 });
    expect(s).toMatchObject({ year: 1982, yearSource: 'online', confirmed: true });
  });
});

describe('runChecks', () => {
  it('prüft nacheinander und lässt sich abbrechen', async () => {
    const ctrl = new AbortController();
    const seen: string[] = [];
    const fetcher = async () => jsonResponse({ recordings: [] });
    const songs = ['a', 'b', 'c'].map((id) => ({ ...song('T', 'A', 2000), id }));
    await runChecks(songs, {
      fetcher,
      delayMs: 0,
      signal: ctrl.signal,
      onResult: (id) => {
        seen.push(id);
        if (id === 'b') ctrl.abort();
      },
    });
    expect(seen).toEqual(['a', 'b']);
  });
});
