import { useEffect, useRef, useState } from 'react';
import type { Deck, OnlineCheck, Song } from '../types';
import { acceptSuggestion, applyCheck, MB_DELAY_MS, runChecks } from '../lib/onlineCheck';
import { markConflicts, needsReview } from '../lib/years';

interface Props {
  deck: Deck;
  onChange: (deck: Deck) => void;
}

/** Startet die optionale Online-Prüfung (MusicBrainz) für unsichere oder alle Songs. */
export function OnlineCheckPanel({ deck, onChange }: Props) {
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<Record<OnlineCheck['status'], number> | null>(null);

  // Beim Verlassen der Ansicht laufende Prüfung abbrechen.
  useEffect(() => () => abortRef.current?.abort(), []);

  const candidates = (scope: 'unsure' | 'all'): Song[] =>
    deck.songs.filter((s) => s.title.trim() && s.artist.trim() && (scope === 'all' || s.year === null || needsReview(s) || !s.confirmed));
  const unsure = candidates('unsure');
  const all = candidates('all');
  const suggestions = deck.songs.filter((s) => s.online?.status === 'differs');

  async function start(songs: Song[]) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const counts = { match: 0, differs: 0, filled: 0, kept: 0, notfound: 0, error: 0 };
    setSummary(null);
    setProgress({ done: 0, total: songs.length });
    await runChecks(songs, {
      signal: ctrl.signal,
      onResult: (id, check, i) => {
        counts[check.status]++;
        const current = deckRef.current;
        const updated = current.songs.map((s) => (s.id === id ? applyCheck(s, check) : s));
        onChange({ ...current, songs: markConflicts(updated), updatedAt: Date.now() });
        setProgress({ done: i + 1, total: songs.length });
      },
    });
    if (abortRef.current === ctrl) abortRef.current = null;
    setProgress(null);
    setSummary(counts);
  }

  const minutes = (n: number) => Math.max(1, Math.ceil((n * MB_DELAY_MS) / 60000));
  const running = progress !== null;

  return (
    <section className="panel stack" aria-labelledby="online-title">
      <h2 id="online-title">Jahre online prüfen</h2>
      <p>
        Music Guess sucht in der offenen Musikdatenbank <strong>MusicBrainz</strong> nach der <em>ersten</em> Veröffentlichung
        jedes Songs vom selben Interpreten. So werden Remaster, Best-of-Alben und spätere Live-Versionen auf das Original
        zurückgeführt. Weicht das Ergebnis ab, siehst du einen Vorschlag und entscheidest selbst.
      </p>
      <p className="muted small">
        Dabei werden nur Interpret und Titel an musicbrainz.org gesendet. Erlaubt ist eine Anfrage pro Sekunde, 60 Songs dauern
        also etwa eine Minute. Die Datenbank wird von Freiwilligen gepflegt und kann selbst Fehler enthalten.
      </p>

      {running ? (
        <div className="stack" role="status" aria-live="polite">
          <div className="progress progress--wide" aria-hidden="true">
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p>
            Prüfe {progress.done} von {progress.total} …
          </p>
          <button type="button" className="btn btn--ghost" onClick={() => abortRef.current?.abort()}>
            Abbrechen
          </button>
        </div>
      ) : (
        <div className="row wrap">
          <button type="button" className="btn btn--primary" disabled={unsure.length === 0} onClick={() => start(unsure)}>
            Unsichere prüfen ({unsure.length}, ca. {minutes(unsure.length)} Min.)
          </button>
          <button type="button" className="btn btn--secondary" disabled={all.length === 0} onClick={() => start(all)}>
            Alle prüfen ({all.length}, ca. {minutes(all.length)} Min.)
          </button>
        </div>
      )}

      {summary && (
        <div className={`alert${summary.error > 0 ? ' alert--warn' : ''}`} role="status">
          <p>
            Fertig: {summary.match} bestätigt, {plural(summary.filled, 'Jahr', 'Jahre')} ergänzt,{' '}
            {plural(summary.differs, 'Abweichung', 'Abweichungen')}, {summary.notfound} nicht gefunden
            {summary.error > 0 ? `, ${plural(summary.error, 'Fehler', 'Fehler')}` : ''}.
          </p>
          {summary.error > 0 && summary.error === Object.values(summary).reduce((a, b) => a + b, 0) && (
            <p>
              MusicBrainz war nicht erreichbar. Bist du online? Manche Werbeblocker oder Firmennetze sperren den Zugriff.
              Versuch es später noch einmal.
            </p>
          )}
        </div>
      )}

      {suggestions.length > 0 && !running && (
        <div className="row wrap">
          <p className="grow">
            <strong>{plural(suggestions.length, 'Vorschlag', 'Vorschläge')}</strong> offen. Du kannst sie einzeln unten in der Liste ansehen oder alle auf
            einmal übernehmen.
          </p>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => onChange({ ...deck, songs: markConflicts(deck.songs.map((s) => (s.online?.status === 'differs' ? acceptSuggestion(s) : s))), updatedAt: Date.now() })}
          >
            {suggestions.length === 1 ? 'Vorschlag übernehmen' : `Alle ${suggestions.length} Vorschläge übernehmen`}
          </button>
        </div>
      )}
    </section>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
