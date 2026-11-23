import { useState } from 'react';
import type { Deck } from '../types';
import { deckFileName, serializeDeck } from '../lib/deckFile';
import { deleteDeckFile, GitHubError, isConfigured, loadGitHubConfig, putDeckFile } from '../lib/github';
import { ConfirmDialog, Dialog } from './Dialog';

interface Props {
  deck: Deck;
  onChange: (deck: Deck) => void;
  /** Dateinamen der aktuell eingebauten Listen (zum Erkennen von Überschreibungen). */
  builtinFiles: Set<string>;
  onOpenSettings: () => void;
}

type Status = { kind: 'busy' } | { kind: 'ok'; text: string; link?: string } | { kind: 'error'; text: string } | null;

/** „Fest einbauen“ für eigene Listen bzw. „Aus der App entfernen“ für eingebaute Listen. */
export function PublishControls({ deck, onChange, builtinFiles, onOpenSettings }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [needSetup, setNeedSetup] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const isBuiltin = deck.kind === 'builtin';
  const file = deck.published?.file ?? deckFileName(deck.name);
  const overwritesOther = !isBuiltin && builtinFiles.has(file) && deck.published?.file !== file;
  const changedSincePublish = !!deck.published && deck.published.at > 0 && deck.updatedAt > deck.published.at;

  if (deck.kind === 'demo' || deck.kind === 'local-audio') return null;

  function start() {
    if (!isConfigured(loadGitHubConfig())) setNeedSetup(true);
    else setConfirm(true);
  }

  async function run() {
    setConfirm(false);
    setStatus({ kind: 'busy' });
    const cfg = loadGitHubConfig();
    try {
      if (isBuiltin) {
        await deleteDeckFile(cfg, file, `Liste „${deck.name}“ aus Music Guess entfernt`);
        setStatus({ kind: 'ok', text: 'Entfernt. Nach dem nächsten Build (ca. 1–2 Minuten) ist die Liste auf allen Geräten verschwunden.' });
      } else {
        const link = await putDeckFile(cfg, file, serializeDeck(deck), `Liste „${deck.name}“ fest in Music Guess eingebaut`);
        onChange({ ...deck, published: { file, at: Date.now() } });
        setStatus({
          kind: 'ok',
          text: 'Gespeichert ✓ Die Seite wird jetzt neu gebaut. In ca. 1–2 Minuten ist die Liste auf allen Geräten da (Seite neu laden).',
          link,
        });
      }
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof GitHubError ? e.message : 'Unbekannter Fehler beim Speichern.' });
    }
  }

  return (
    <div className="stack">
      <div className="row wrap">
        {isBuiltin ? (
          <button type="button" className="btn btn--danger-ghost" onClick={start} disabled={status?.kind === 'busy'}>
            Aus der App entfernen
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={start} disabled={status?.kind === 'busy'}>
            📌 {deck.published ? 'Änderungen fest einbauen' : 'Fest einbauen (alle Geräte)'}
          </button>
        )}
        {status?.kind === 'busy' && <span className="muted" role="status">Speichere bei GitHub …</span>}
      </div>
      {!isBuiltin && deck.published && deck.published.at > 0 && (
        <p className="small muted">
          Zuletzt fest eingebaut am {new Date(deck.published.at).toLocaleString('de-DE')}
          {changedSincePublish && <strong className="warn-text"> · seitdem geändert – erneut einbauen, damit es alle Geräte sehen</strong>}
        </p>
      )}
      {status?.kind === 'ok' && (
        <div className="alert" role="status">
          <p>{status.text}</p>
          {status.link && (
            <p className="small">
              <a href={status.link} target="_blank" rel="noopener noreferrer">
                Änderung bei GitHub ansehen
              </a>
            </p>
          )}
        </div>
      )}
      {status?.kind === 'error' && (
        <div className="alert alert--error" role="alert">
          <p>{status.text}</p>
          <button type="button" className="link-btn" onClick={onOpenSettings}>
            GitHub-Verbindung prüfen
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={isBuiltin ? 'Liste aus der App entfernen?' : 'Liste fest einbauen?'}
        message={
          isBuiltin ? (
            <p>
              „{deck.name}“ wird aus dem Repository gelöscht und verschwindet nach dem nächsten Build von allen Geräten. Lokale
              Kopien bleiben erhalten.
            </p>
          ) : (
            <>
              <p>
                „{deck.name}“ ({deck.songs.length} Songs) wird als <code>src/decks/{file}</code> im Repository gespeichert. GitHub Pages
                veröffentlicht die Liste dann auf allen Geräten.
              </p>
              {overwritesOther && <p className="warn-text">Es gibt bereits eine eingebaute Liste mit diesem Dateinamen – sie wird ersetzt.</p>}
              <p className="muted small">
                Eingebaute Listen sind Teil der Seite: Wer die Adresse kennt, kann Titel, Interpreten, Jahre und Links sehen.
              </p>
            </>
          )
        }
        confirmLabel={isBuiltin ? 'Entfernen' : 'Fest einbauen'}
        danger={isBuiltin}
        onConfirm={run}
        onCancel={() => setConfirm(false)}
      />
      <Dialog
        open={needSetup}
        title="Einmalig GitHub verbinden"
        onClose={() => setNeedSetup(false)}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setNeedSetup(false)}>
              Später
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setNeedSetup(false);
                onOpenSettings();
              }}
            >
              Jetzt einrichten
            </button>
          </>
        }
      >
        <p>
          Damit Music Guess Listen selbst in die App einbauen kann, braucht es einmalig einen GitHub-Zugangsschlüssel (Token), der
          nur dieses Repository ändern darf. Die Einrichtung dauert etwa 2 Minuten und steht unter „Info &amp; Datenschutz“.
        </p>
      </Dialog>
    </div>
  );
}
