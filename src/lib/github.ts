/**
 * Minimaler GitHub-Client, um Song-Listen als Datei in src/decks/ abzulegen („fest einbauen“).
 * Nutzt die offizielle GitHub-REST-API (Contents API) mit einem Fine-grained Token, das nur dieses
 * Repository und nur „Contents: Read and write“ erlaubt. Das Token bleibt im Browser dieses Geräts.
 */
export const DECKS_DIR = 'src/decks';
const API = 'https://api.github.com';

export interface GitHubConfig {
  /** „besitzer/repository“ */
  repo: string;
  branch: string;
  token: string;
}

const KEY = 'musicguess.github.v1';

export const DEFAULT_REPO = typeof __GITHUB_REPO__ === 'string' ? __GITHUB_REPO__ : '';
export const DEFAULT_BRANCH = typeof __GITHUB_BRANCH__ === 'string' ? __GITHUB_BRANCH__ : '';

export function loadGitHubConfig(): GitHubConfig {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<GitHubConfig>) : {};
    return {
      repo: saved.repo || DEFAULT_REPO,
      branch: saved.branch || DEFAULT_BRANCH || 'main',
      token: typeof saved.token === 'string' ? saved.token : '',
    };
  } catch {
    return { repo: DEFAULT_REPO, branch: DEFAULT_BRANCH || 'main', token: '' };
  }
}

export function saveGitHubConfig(cfg: GitHubConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* Speicher nicht verfügbar */
  }
}

export function clearGitHubToken(): void {
  const cfg = loadGitHubConfig();
  saveGitHubConfig({ ...cfg, token: '' });
}

export function forgetGitHub(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
}

export function isConfigured(cfg: GitHubConfig): boolean {
  return validRepo(cfg.repo) && validBranch(cfg.branch) && cfg.token.trim().length > 20;
}

export const validRepo = (r: string) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(r.trim());
export const validBranch = (b: string) => /^[A-Za-z0-9._/-]+$/.test(b.trim()) && !b.includes('..');
export const validFileName = (f: string) => /^[a-z0-9-]{1,60}\.musicguess\.json$/.test(f);

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Fetcher = typeof fetch;

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function explain(status: number, what: string): string {
  switch (status) {
    case 401:
      return 'Der GitHub-Token ist ungültig oder abgelaufen. Bitte unter „Info & Datenschutz“ einen neuen eintragen.';
    case 403:
      return 'Der Token darf dieses Repository nicht ändern. Beim Erstellen „Contents: Read and write“ für genau dieses Repository wählen.';
    case 404:
      return `Nicht gefunden: Repository oder Branch stimmen nicht, oder der Token hat keinen Zugriff darauf (${what}).`;
    case 409:
    case 422:
      return 'Die Datei wurde zwischenzeitlich geändert. Bitte noch einmal versuchen.';
    default:
      return `GitHub hat mit Fehler ${status} geantwortet (${what}).`;
  }
}

function contentsUrl(cfg: GitHubConfig, file: string): string {
  if (!validFileName(file)) throw new GitHubError('Ungültiger Dateiname.', 0);
  const [owner, repo] = cfg.repo.trim().split('/');
  return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${DECKS_DIR}/${file}`;
}

async function call(fetcher: Fetcher, url: string, init: RequestInit, what: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetcher(url, init);
  } catch {
    throw new GitHubError('GitHub ist nicht erreichbar. Bist du online?', 0);
  }
  if (!res.ok && res.status !== 404) throw new GitHubError(explain(res.status, what), res.status);
  return res;
}

/** UTF-8-sicheres Base64 (für Umlaute in Titeln). */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function existingSha(cfg: GitHubConfig, file: string, fetcher: Fetcher): Promise<string | undefined> {
  const res = await call(fetcher, `${contentsUrl(cfg, file)}?ref=${encodeURIComponent(cfg.branch.trim())}`, { headers: headers(cfg.token) }, 'Datei lesen');
  if (res.status === 404) return undefined;
  const data = (await res.json()) as { sha?: string };
  return data.sha;
}

/** Prüft Token, Repository und Branch. */
export async function testConnection(cfg: GitHubConfig, fetcher: Fetcher = fetch): Promise<string> {
  const [owner, repo] = cfg.repo.trim().split('/');
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const r = await call(fetcher, base, { headers: headers(cfg.token) }, 'Repository');
  if (r.status === 404) throw new GitHubError(explain(404, 'Repository'), 404);
  const info = (await r.json()) as { full_name?: string; permissions?: { push?: boolean } };
  if (info.permissions && info.permissions.push === false) throw new GitHubError(explain(403, 'Repository'), 403);
  const b = await call(fetcher, `${base}/branches/${encodeURIComponent(cfg.branch.trim())}`, { headers: headers(cfg.token) }, 'Branch');
  if (b.status === 404) throw new GitHubError(`Den Branch „${cfg.branch}“ gibt es in ${info.full_name ?? cfg.repo} nicht.`, 404);
  return info.full_name ?? cfg.repo;
}

/** Legt die Datei an oder ersetzt sie. Gibt die URL des Commits zurück. */
export async function putDeckFile(cfg: GitHubConfig, file: string, content: string, message: string, fetcher: Fetcher = fetch): Promise<string | undefined> {
  const sha = await existingSha(cfg, file, fetcher);
  const res = await call(
    fetcher,
    contentsUrl(cfg, file),
    {
      method: 'PUT',
      headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: toBase64(content), branch: cfg.branch.trim(), ...(sha ? { sha } : {}) }),
    },
    'Datei speichern',
  );
  if (res.status === 404) throw new GitHubError(explain(404, 'Datei speichern'), 404);
  const data = (await res.json()) as { commit?: { html_url?: string } };
  return data.commit?.html_url;
}

/** Entfernt die Datei wieder. */
export async function deleteDeckFile(cfg: GitHubConfig, file: string, message: string, fetcher: Fetcher = fetch): Promise<void> {
  const sha = await existingSha(cfg, file, fetcher);
  if (!sha) return; // bereits entfernt
  await call(
    fetcher,
    contentsUrl(cfg, file),
    {
      method: 'DELETE',
      headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch: cfg.branch.trim() }),
    },
    'Datei löschen',
  );
}
