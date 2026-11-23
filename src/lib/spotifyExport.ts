import type { Song } from '../types';
import { createSong } from './importer';
import { markConflicts } from './years';

/**
 * Liest die JSON-Dateien aus Spotifys offiziellem Datenexport
 * (Konto → Datenschutz → „Deine Daten herunterladen“), z. B. „Playlist1.json“ oder „YourLibrary.json“.
 *
 * Das ist eine Datei, die du selbst von Spotify bekommst – Music Guess ruft dafür keine Spotify-Schnittstelle auf.
 * Das Format ist nicht offiziell dokumentiert, daher werden mehrere übliche Feldnamen akzeptiert.
 * Der Export enthält KEINE Erscheinungsjahre; diese müssen in der Prüfansicht ergänzt werden.
 */
export interface ExportPlaylist {
  name: string;
  songs: Song[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Obj, keys: string[]): string => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

const TITLE = ['trackName', 'track', 'name', 'title', 'songName'];
const ARTIST = ['artistName', 'artist', 'artists'];
const ALBUM = ['albumName', 'album'];
const URI = ['trackUri', 'uri', 'spotifyUri', 'url'];

/** Liest einen einzelnen Playlist-Eintrag; Podcasts, Hörbücher und lokale Dateien werden übersprungen. */
function readItem(item: unknown): Song | null {
  if (!isObj(item)) return null;
  // Format „Playlist1.json“: { track: { trackName, artistName, albumName, trackUri }, episode: null, … }
  const inner = isObj(item.track) ? item.track : isObj(item.item) ? item.item : item;
  if (inner === item && (isObj(item.episode) || isObj(item.audiobook))) return null;
  const title = str(inner, TITLE);
  const artist = str(inner, ARTIST);
  if (!title || !artist) return null;
  const uri = str(inner, URI);
  if (uri && !/^spotify:track:|open\.spotify\.com\/track\//.test(uri)) return null; // nur Musiktitel
  return createSong({ title, artist, album: str(inner, ALBUM) || undefined, link: uri || undefined });
}

function readList(name: string, items: unknown[]): ExportPlaylist | null {
  const songs = items.map(readItem).filter((s): s is Song => s !== null);
  return songs.length ? { name, songs: markConflicts(songs) } : null;
}

export function parseSpotifyDataExport(text: string, fileName = 'Spotify'): ExportPlaylist[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return null;
  }
  const result: ExportPlaylist[] = [];

  if (isObj(data)) {
    // Playlist1.json: { playlists: [ { name, items: [...] } ] }
    if (Array.isArray(data.playlists)) {
      for (const p of data.playlists) {
        if (!isObj(p)) continue;
        const items = Array.isArray(p.items) ? p.items : Array.isArray(p.tracks) ? p.tracks : [];
        const list = readList(str(p, ['name', 'title']) || 'Playlist', items);
        if (list) result.push(list);
      }
    }
    // YourLibrary.json: { tracks: [ { artist, album, track, uri } ] } = „Lieblingssongs“
    if (Array.isArray(data.tracks)) {
      const list = readList('Lieblingssongs', data.tracks);
      if (list) result.push(list);
    }
  } else if (Array.isArray(data)) {
    const list = readList(fileName.replace(/\.json$/i, ''), data);
    if (list) result.push(list);
  }
  return result.length ? result : null;
}
