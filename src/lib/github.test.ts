import { describe, expect, it } from 'vitest';
import { deleteDeckFile, GitHubError, isConfigured, putDeckFile, testConnection, toBase64, validFileName } from './github';

const cfg = { repo: 'me/musicguess', branch: 'main', token: 'github_pat_1234567890abcdefghijklmnop' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function recorder(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return responses.shift() ?? json({}, 500);
  }) as typeof fetch;
  return { calls, fetcher };
}

describe('GitHub-Client', () => {
  it('Base64 ist UTF-8-sicher', () => {
    expect(new TextDecoder().decode(Uint8Array.from(atob(toBase64('Größte Hits ♫')), (c) => c.charCodeAt(0)))).toBe('Größte Hits ♫');
  });

  it('prüft Konfiguration und Dateinamen', () => {
    expect(isConfigured(cfg)).toBe(true);
    expect(isConfigured({ ...cfg, token: '' })).toBe(false);
    expect(isConfigured({ ...cfg, repo: 'kaputt' })).toBe(false);
    expect(validFileName('roadtrip.musicguess.json')).toBe(true);
    expect(validFileName('../package.json')).toBe(false);
    expect(validFileName('x.musicguess.json/../a')).toBe(false);
  });

  it('legt eine neue Datei an (ohne sha)', async () => {
    const { calls, fetcher } = recorder([json({}, 404), json({ commit: { html_url: 'https://github.com/me/musicguess/commit/abc' } }, 201)]);
    const link = await putDeckFile(cfg, 'roadtrip.musicguess.json', '{"a":"ä"}', 'msg', fetcher);
    expect(link).toBe('https://github.com/me/musicguess/commit/abc');
    expect(calls[0].url).toBe('https://api.github.com/repos/me/musicguess/contents/src/decks/roadtrip.musicguess.json?ref=main');
    expect(calls[1].init?.method).toBe('PUT');
    const body = JSON.parse(String(calls[1].init?.body));
    expect(body).toMatchObject({ message: 'msg', branch: 'main' });
    expect(body.sha).toBeUndefined();
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${cfg.token}`);
  });

  it('ersetzt eine vorhandene Datei (mit sha)', async () => {
    const { calls, fetcher } = recorder([json({ sha: 'old' }), json({ commit: {} }, 200)]);
    await putDeckFile(cfg, 'roadtrip.musicguess.json', '{}', 'msg', fetcher);
    expect(JSON.parse(String(calls[1].init?.body)).sha).toBe('old');
  });

  it('übersetzt Fehler verständlich', async () => {
    await expect(putDeckFile(cfg, 'a.musicguess.json', '{}', 'm', recorder([json({}, 401)]).fetcher)).rejects.toThrow(/ungültig oder abgelaufen/);
    await expect(putDeckFile(cfg, 'a.musicguess.json', '{}', 'm', recorder([json({}, 404), json({}, 403)]).fetcher)).rejects.toThrow(/Contents: Read and write/);
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(putDeckFile(cfg, 'a.musicguess.json', '{}', 'm', offline)).rejects.toBeInstanceOf(GitHubError);
    await expect(putDeckFile(cfg, '../evil.json', '{}', 'm', offline)).rejects.toThrow(/Ungültiger Dateiname/);
  });

  it('löscht nur vorhandene Dateien', async () => {
    const a = recorder([json({}, 404)]);
    await deleteDeckFile(cfg, 'a.musicguess.json', 'm', a.fetcher);
    expect(a.calls).toHaveLength(1);
    const b = recorder([json({ sha: 's1' }), json({})]);
    await deleteDeckFile(cfg, 'a.musicguess.json', 'm', b.fetcher);
    expect(b.calls[1].init?.method).toBe('DELETE');
    expect(JSON.parse(String(b.calls[1].init?.body))).toMatchObject({ sha: 's1', branch: 'main' });
  });

  it('Verbindungstest erkennt fehlende Schreibrechte und Branches', async () => {
    await expect(testConnection(cfg, recorder([json({ full_name: 'me/musicguess', permissions: { push: false } })]).fetcher)).rejects.toThrow(/Contents/);
    await expect(testConnection(cfg, recorder([json({ full_name: 'me/musicguess', permissions: { push: true } }), json({}, 404)]).fetcher)).rejects.toThrow(/Branch/);
    expect(await testConnection(cfg, recorder([json({ full_name: 'me/musicguess', permissions: { push: true } }), json({ name: 'main' })]).fetcher)).toBe('me/musicguess');
  });
});
