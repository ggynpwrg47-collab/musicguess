import { useId, useState } from 'react';
import { DEFAULT_BRANCH, DEFAULT_REPO, forgetGitHub, GitHubError, isConfigured, loadGitHubConfig, saveGitHubConfig, testConnection, validBranch, validRepo } from '../lib/github';

/** Einrichtung der GitHub-Verbindung für „Liste fest einbauen“. */
export function GitHubSettings() {
  const [cfg, setCfg] = useState(loadGitHubConfig);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { repo: useId(), branch: useId(), token: useId() };
  const tokenUrl = 'https://github.com/settings/personal-access-tokens/new';

  async function saveAndTest() {
    const clean = { repo: cfg.repo.trim(), branch: cfg.branch.trim(), token: cfg.token.trim() };
    if (!validRepo(clean.repo)) return setResult({ ok: false, text: 'Repository bitte als „besitzer/name“ angeben.' });
    if (!validBranch(clean.branch)) return setResult({ ok: false, text: 'Bitte einen gültigen Branch angeben.' });
    if (!clean.token) return setResult({ ok: false, text: 'Bitte den Token einfügen.' });
    saveGitHubConfig(clean);
    setCfg(clean);
    setBusy(true);
    try {
      const name = await testConnection(clean);
      setResult({ ok: true, text: `Verbunden mit ${name} (Branch „${clean.branch}“). „Fest einbauen“ ist jetzt bereit.` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof GitHubError ? e.message : 'Verbindung fehlgeschlagen.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack" aria-labelledby="gh-title">
      <h2 id="gh-title">Listen fest einbauen (GitHub)</h2>
      <p>
        Mit „📌 Fest einbauen“ legt Music Guess eine Liste selbst im Repository ab. GitHub Pages veröffentlicht sie danach auf allen
        Geräten. Dafür braucht es einmalig einen <strong>Fine-grained Token</strong>, der nur dieses Repository ändern darf.
      </p>
      <details>
        <summary>So erstellst du den Token (ca. 2 Minuten)</summary>
        <ol className="stack">
          <li>
            Bei GitHub angemeldet{' '}
            <a href={tokenUrl} target="_blank" rel="noopener noreferrer">
              „Fine-grained personal access token“ erstellen
            </a>{' '}
            öffnen.
          </li>
          <li>Name z. B. „Music Guess Listen“, Ablauf z. B. 90 Tage.</li>
          <li>
            <strong>Repository access → Only select repositories</strong> → nur <code>{cfg.repo || DEFAULT_REPO || 'dein-repo'}</code> wählen.
          </li>
          <li>
            <strong>Permissions → Repository permissions → Contents: Read and write</strong>. Sonst nichts ändern (Metadata: Read
            ist automatisch dabei).
          </li>
          <li>„Generate token“ klicken, den Token kopieren und unten einfügen.</li>
        </ol>
      </details>
      <div className="field">
        <label htmlFor={ids.repo}>Repository (besitzer/name)</label>
        <input id={ids.repo} value={cfg.repo} placeholder={DEFAULT_REPO || 'besitzer/repository'} onChange={(e) => setCfg({ ...cfg, repo: e.target.value })} autoComplete="off" spellCheck={false} />
      </div>
      <div className="field">
        <label htmlFor={ids.branch}>Branch, der veröffentlicht wird</label>
        <input id={ids.branch} value={cfg.branch} placeholder={DEFAULT_BRANCH || 'main'} onChange={(e) => setCfg({ ...cfg, branch: e.target.value })} autoComplete="off" spellCheck={false} />
      </div>
      <div className="field">
        <label htmlFor={ids.token}>Token</label>
        <input
          id={ids.token}
          type="password"
          value={cfg.token}
          placeholder="github_pat_…"
          onChange={(e) => setCfg({ ...cfg, token: e.target.value })}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="muted small">
          Der Token wird nur in diesem Browser gespeichert (nicht im Code, nicht auf dem Server) und nur an api.github.com gesendet.
          Richte das nur auf deinem eigenen Gerät ein.
        </span>
      </div>
      <div className="row wrap">
        <button type="button" className="btn btn--primary" onClick={saveAndTest} disabled={busy}>
          {busy ? 'Prüfe …' : 'Speichern & Verbindung testen'}
        </button>
        {isConfigured(cfg) && (
          <button
            type="button"
            className="btn btn--danger-ghost"
            onClick={() => {
              forgetGitHub();
              setCfg(loadGitHubConfig());
              setResult({ ok: true, text: 'Token von diesem Gerät entfernt.' });
            }}
          >
            Token entfernen
          </button>
        )}
      </div>
      {result && (
        <div className={`alert${result.ok ? '' : ' alert--error'}`} role={result.ok ? 'status' : 'alert'}>
          {result.text}
        </div>
      )}
    </section>
  );
}
