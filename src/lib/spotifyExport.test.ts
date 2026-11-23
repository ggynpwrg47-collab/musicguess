import { describe, expect, it } from 'vitest';
import { parseSpotifyDataExport } from './spotifyExport';

describe('parseSpotifyDataExport', () => {
  it('liest Playlist1.json mit mehreren Playlists und überspringt Podcasts', () => {
    const json = JSON.stringify({
      playlists: [
        {
          name: 'Partymix',
          lastModifiedDate: '2024-01-01',
          items: [
            { track: { trackName: 'Africa', artistName: 'Toto', albumName: 'Toto IV', trackUri: 'spotify:track:2374M0fQpWi3dLnB54qaLX' }, episode: null },
            { track: null, episode: { episodeName: 'Folge 1', showName: 'Podcast' } },
            { track: { trackName: 'Lokal', artistName: 'X', albumName: '', trackUri: 'spotify:local:abc' } },
          ],
        },
        { name: 'Leer', items: [] },
      ],
    });
    const r = parseSpotifyDataExport(json)!;
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Partymix');
    expect(r[0].songs).toHaveLength(1);
    expect(r[0].songs[0]).toMatchObject({
      title: 'Africa',
      artist: 'Toto',
      album: 'Toto IV',
      year: null,
      link: 'https://open.spotify.com/track/2374M0fQpWi3dLnB54qaLX',
    });
    expect(r[0].songs[0].warnings.join()).toMatch(/Kein Jahr/);
  });

  it('liest YourLibrary.json als „Lieblingssongs“', () => {
    const json = JSON.stringify({ tracks: [{ artist: 'Nena', album: '99 Luftballons', track: '99 Luftballons', uri: 'spotify:track:6HA97v4wEGQ5TUClRM0XLc' }] });
    const r = parseSpotifyDataExport(json)!;
    expect(r[0]).toMatchObject({ name: 'Lieblingssongs' });
    expect(r[0].songs[0]).toMatchObject({ title: '99 Luftballons', artist: 'Nena' });
  });

  it('gibt null bei fremdem oder kaputtem JSON', () => {
    expect(parseSpotifyDataExport('{kaputt')).toBeNull();
    expect(parseSpotifyDataExport(JSON.stringify({ foo: 1 }))).toBeNull();
  });
});
