import { describe, expect, it } from 'vitest';
import { parseId3 } from './id3';

function syncsafe(n: number): number[] {
  return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
}

function frame(id: string, text: string, version: 3 | 4): number[] {
  const body = [3, ...new TextEncoder().encode(text)]; // Encoding 3 = UTF-8
  const size = version === 4 ? syncsafe(body.length) : [0, 0, (body.length >> 8) & 0xff, body.length & 0xff];
  return [...id.split('').map((c) => c.charCodeAt(0)), ...size, 0, 0, ...body];
}

function tag(version: 3 | 4, frames: number[][]): ArrayBuffer {
  const body = frames.flat();
  const bytes = [0x49, 0x44, 0x33, version, 0, 0, ...syncsafe(body.length + 16), ...body, ...new Array(16).fill(0)];
  return new Uint8Array(bytes).buffer;
}

describe('parseId3', () => {
  it('liest v2.4 inklusive Original-Datum', () => {
    const t = parseId3(tag(4, [frame('TIT2', 'Bohemian Rhapsody', 4), frame('TPE1', 'Queen', 4), frame('TDRC', '2011', 4), frame('TDOR', '1975-10-31', 4)]));
    expect(t).toEqual({ title: 'Bohemian Rhapsody', artist: 'Queen', date: '2011', originalDate: '1975-10-31' });
  });
  it('liest v2.3 mit Umlauten', () => {
    const t = parseId3(tag(3, [frame('TIT2', 'Über den Wolken', 3), frame('TYER', '1974', 3)]));
    expect(t).toEqual({ title: 'Über den Wolken', date: '1974' });
  });
  it('gibt null für Dateien ohne ID3', () => {
    expect(parseId3(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).buffer)).toBeNull();
  });
});
