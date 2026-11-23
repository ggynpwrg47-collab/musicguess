/**
 * Minimaler ID3v2-Leser (v2.2, v2.3, v2.4) für Titel, Interpret, Album und Jahresangaben.
 * Läuft komplett lokal im Browser; Dateien werden nicht hochgeladen.
 */
export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  /** Original-Veröffentlichung (TDOR in v2.4, TORY in v2.3, TOR in v2.2). */
  originalDate?: string;
  /** Aufnahme-/Veröffentlichungsdatum dieser Datei (TDRC, TYER, TYE). */
  date?: string;
}

function syncsafe(b: Uint8Array, o: number): number {
  return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
}

function decodeText(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const enc = bytes[0];
  const data = bytes.subarray(1);
  let text: string;
  try {
    if (enc === 0) text = new TextDecoder('latin1').decode(data);
    else if (enc === 1) {
      // UTF-16 mit Byte-Order-Mark
      const be = data[0] === 0xfe && data[1] === 0xff;
      const hasBom = be || (data[0] === 0xff && data[1] === 0xfe);
      text = new TextDecoder(be ? 'utf-16be' : 'utf-16le').decode(hasBom ? data.subarray(2) : data);
    }
    else if (enc === 2) text = new TextDecoder('utf-16be').decode(data);
    else text = new TextDecoder('utf-8').decode(data);
  } catch {
    text = '';
  }
  // Mehrere Werte sind durch Null-Zeichen getrennt; den ersten verwenden.
  return text.replace(/^﻿/, '').split('\u0000')[0].trim();
}

const FRAME_MAP: Record<string, keyof Id3Tags> = {
  TIT2: 'title', TT2: 'title',
  TPE1: 'artist', TP1: 'artist',
  TALB: 'album', TAL: 'album',
  TDOR: 'originalDate', TORY: 'originalDate', TOR: 'originalDate',
  TDRC: 'date', TYER: 'date', TYE: 'date',
};

export function parseId3(buffer: ArrayBuffer): Id3Tags | null {
  const b = new Uint8Array(buffer);
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null; // "ID3"
  const major = b[3];
  if (major < 2 || major > 4) return null;
  const flags = b[5];
  const tagSize = syncsafe(b, 6);
  const end = Math.min(b.length, 10 + tagSize);
  let pos = 10;
  if (flags & 0x40 && major >= 3) {
    // Extended Header überspringen
    const extSize = major === 4 ? syncsafe(b, pos) : ((b[pos] << 24) | (b[pos + 1] << 16) | (b[pos + 2] << 8) | b[pos + 3]) + 4;
    pos += extSize;
  }
  const tags: Id3Tags = {};
  const idLen = major === 2 ? 3 : 4;
  const headerLen = major === 2 ? 6 : 10;
  while (pos + headerLen <= end) {
    const id = String.fromCharCode(...b.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break; // Padding erreicht
    let size: number;
    if (major === 2) size = (b[pos + 3] << 16) | (b[pos + 4] << 8) | b[pos + 5];
    else if (major === 4) size = syncsafe(b, pos + 4);
    else size = ((b[pos + 4] << 24) | (b[pos + 5] << 16) | (b[pos + 6] << 8) | b[pos + 7]) >>> 0;
    const dataStart = pos + headerLen;
    if (size <= 0 || dataStart + size > end) break;
    const key = FRAME_MAP[id];
    if (key && tags[key] === undefined) {
      const value = decodeText(b.subarray(dataStart, dataStart + size));
      if (value) tags[key] = value;
    }
    pos = dataStart + size;
  }
  return tags;
}

/** Liest nur den Anfang der Datei (Tags stehen bei ID3v2 vorne). */
export async function readId3FromFile(file: File): Promise<Id3Tags | null> {
  const head = await file.slice(0, 10).arrayBuffer();
  const hb = new Uint8Array(head);
  if (hb.length < 10 || hb[0] !== 0x49 || hb[1] !== 0x44 || hb[2] !== 0x33) return null;
  const size = Math.min(10 + syncsafe(hb, 6), 2 * 1024 * 1024); // höchstens 2 MB lesen (Cover-Bilder überspringen wir ohnehin)
  return parseId3(await file.slice(0, size).arrayBuffer());
}
