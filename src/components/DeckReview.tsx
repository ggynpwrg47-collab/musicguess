import { useMemo, useState } from 'react';
import type { Deck, Song } from '../types';
import { detectYearWarnings, formatDate, isPlayable, markConflicts, needsReview, parseDate, precisionLabel, maxYear, MIN_YEAR } from '../lib/years';
import { normalizeLink } from '../lib/links';
import { uid } from '../lib/random';
import { downloadDeck } from '../lib/deckFile';
import { ConfirmDialog } from './Dialog';
import { useAudioFiles } from './audioFiles';
import { AlbumDateNote } from './InfoView';
import { OnlineCheckPanel } from './OnlineCheckPanel';
import { PublishControls } from './PublishControls';
import { acceptSuggestion, keepOwnYear } from '../lib/onlineCheck';

interface Props {
  deck: Deck;
  onChange: (deck: Deck) => void;
  onDelete: () => void;
  onBack: () => void;
  onPlay: () => void;
  onOpenDeck: (id: string) => void;
  builtinFiles: Set<string>;
  onOpenSettings: () => void;
}

type Filter = 'review' | 'all' | 'missing';

const SOURCE_LABEL: Record<Song['yearSource'], string> = {
  manual: 'manuell eingetragen',
  list: 'aus der Liste (Jahr)',
  'album-date': 'Album-/Release-Datum – evtl. Neuauflage',
  'tag-original': 'Datei-Tag „Original-Veröffentlichung“',
  tag: 'Datei-Tag „Jahr“ – evtl. Neuauflage',
  filename: 'aus dem Dateinamen',
  demo: 'Beispiel-Deck',
  online: 'Online-Prüfung (MusicBrainz, Erstveröffentlichung)',
};

export function DeckReview({ deck, onChange, onDelete, onBack, onPlay, onOpenDeck, builtinFiles, onOpenSettings }: Props) {
  const readOnly = deck.kind === 'demo' || deck.kind === 'builtin';
  const missingCount = deck.songs.filter((s) => !isPlayable(s)).length;
  const toReviewCount = deck.songs.filter((s) => needsReview(s) || !isPlayable(s)).length;
  const [filter, setFilter] = useState<Filter>(toReviewCount > 0 && !readOnly ? 'review' : 'all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const audio = useAudioFiles();

  const visible = useMemo(() => {
    if (filter === 'review') return deck.songs.filter((s) => needsReview(s) || !isPlayable(s));
    if (filter === 'missing') return deck.songs.filter((s) => !isPlayable(s));
    return deck.songs;
  }, [deck.songs, filter]);

  const missingFiles = deck.kind === 'local-audio' ? deck.songs.filter((s) => s.fileName && !audio.has(s.fileName)).length : 0;

  function update(songs: Song[]) {
    onChange({ ...deck, songs: markConflicts(songs), updatedAt: Date.now() });
  }

  function patchSong(id: string, patch: Partial<Song>) {
    update(
      deck.songs.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        return { ...next, warnings: detectYearWarnings(next) };
      }),
    );
  }

  function setYear(song: Song, raw: string) {
    const p = parseDate(raw);
    // Ein von Hand eingetragenes Jahr gilt als geprüft.
    const online = song.online?.status === 'differs' ? { ...song.online, status: p.year === song.online.year ? ('match' as const) : ('kept' as const) } : song.online;
    patchSong(song.id, {
      year: p.year,
      date: p.date,
      precision: p.precision,
      yearSource: 'manual',
      confirmed: p.year !== null,
      online,
    });
  }

  function copyDemo() {
    const now = Date.now();
    const id = uid('d');
    onChange({
      ...deck,
      id,
      kind: 'list',
      // Kopie einer eingebauten Liste behält den Dateinamen: „Änderungen fest einbauen“ ersetzt dann das Original.
      name: deck.kind === 'builtin' ? deck.name : `${deck.name} (Kopie)`,
      published: deck.kind === 'builtin' && deck.published ? { file: deck.published.file, at: 0 } : undefined,
      songs: deck.songs.map((s) => ({ ...s, id: uid('s') })),
      createdAt: now,
      updatedAt: now,
    });
    onOpenDeck(id);
  }

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← Zurück
        </button>
        <div className="row wrap">
          {readOnly ? (
            <button type="button" className="btn btn--secondary" onClick={copyDemo}>
              Als eigene Liste kopieren
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirmDelete(true)}>
                Liste löschen
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => downloadDeck(deck)}>
                ⤓ Exportieren (für alle Geräte)
              </button>
            </>
          )}
          <button type="button" className="btn btn--primary" onClick={onPlay} disabled={deck.songs.filter(isPlayable).length < 2}>
            Weiter zum Spiel
          </button>
        </div>
      </div>

      <header className="stack">
        {readOnly ? (
          <h1 tabIndex={-1}>{deck.name}</h1>
        ) : (
          <>
            <h1 tabIndex={-1} className="sr-only">Jahre prüfen: {deck.name}</h1>
            <label className="field">
              <span>Name der Liste</span>
              <input value={deck.name} maxLength={80} onChange={(e) => onChange({ ...deck, name: e.target.value, updatedAt: Date.now() })} />
            </label>
          </>
        )}
        <p className="lead">
          {readOnly
            ? deck.kind === 'builtin'
              ? 'Diese Liste ist fest in die App eingebaut (Ordner src/decks/) und auf allen Geräten verfügbar. Zum Ändern kopieren, bearbeiten, neu exportieren und die Datei im Ordner ersetzen.'
              : 'Dieses Beispiel-Deck ist schreibgeschützt. Kopiere es, um Jahre oder Links zu ändern.'
            : 'Prüft vor dem Spiel die Jahre. Markierte Songs haben möglicherweise ein falsches oder ungenaues Jahr. Ein eingetragenes oder bestätigtes Jahr gilt als geprüft. Songs ohne Jahr werden im Spiel übersprungen.'}
        </p>
        <PublishControls deck={deck} onChange={onChange} builtinFiles={builtinFiles} onOpenSettings={onOpenSettings} />
        <p className="spoiler-warning" role="note">
          ⚠️ Achtung, Spoiler: Diese Ansicht zeigt alle Lösungen. Am besten prüft eine Person, die nicht mitspielt – oder ihr
          prüft gemeinsam nur die markierten Songs.
        </p>
      </header>

      {deck.kind === 'local-audio' && missingFiles > 0 && (
        <div className="alert alert--warn" role="status">
          <p>
            {missingFiles} Audiodatei(en) sind in diesem Tab nicht geladen (z. B. nach einem Neuladen der Seite). Wähle sie
            erneut aus, um sie abspielen zu können.
          </p>
          <label className="file-drop file-drop--inline">
            <input type="file" multiple accept="audio/*,.mp3,.m4a,.ogg,.opus,.flac,.wav" onChange={(e) => e.target.files && audio.register([...e.target.files])} />
            <span>Audiodateien erneut auswählen …</span>
          </label>
        </div>
      )}

      {!readOnly && <OnlineCheckPanel deck={deck} onChange={onChange} />}

      <div className="row between wrap">
        <div role="group" aria-label="Filter" className="segmented">
          <button type="button" aria-pressed={filter === 'review'} onClick={() => setFilter('review')}>
            Zu prüfen ({toReviewCount})
          </button>
          <button type="button" aria-pressed={filter === 'missing'} onClick={() => setFilter('missing')}>
            Ohne Jahr ({missingCount})
          </button>
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            Alle ({deck.songs.length})
          </button>
        </div>
        {!readOnly && (
          <div className="row wrap">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!visible.some((s) => s.year !== null && !s.confirmed)}
              onClick={() => {
                const ids = new Set(visible.filter((s) => s.year !== null).map((s) => s.id));
                update(deck.songs.map((s) => (ids.has(s.id) ? { ...s, confirmed: true } : s)));
              }}
            >
              ✓ Angezeigte bestätigen
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                update([
                  ...deck.songs,
                  { id: uid('s'), title: '', artist: '', year: null, precision: 'year', yearSource: 'manual', warnings: [], confirmed: false },
                ])
              }
            >
              ＋ Song hinzufügen
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <p>🎉 Nichts mehr zu prüfen. Alle Songs haben ein bestätigtes Jahr.</p>
          <button type="button" className="btn btn--ghost" onClick={() => setFilter('all')}>
            Alle Songs anzeigen
          </button>
        </div>
      ) : (
        <ul className="song-list">
          {visible.map((s) => (
            <li key={s.id} className={`song-row${needsReview(s) ? ' song-row--review' : ''}${!isPlayable(s) ? ' song-row--missing' : ''}`}>
              {readOnly ? (
                <div className="song-row__main">
                  <strong>{s.title}</strong>
                  <span className="muted">{s.artist}</span>
                </div>
              ) : (
                <div className="song-row__main song-row__edit">
                  <label>
                    <span className="sr-only">Titel</span>
                    <input value={s.title} placeholder="Titel" onChange={(e) => patchSong(s.id, { title: e.target.value })} />
                  </label>
                  <label>
                    <span className="sr-only">Interpret</span>
                    <input value={s.artist} placeholder="Interpret" onChange={(e) => patchSong(s.id, { artist: e.target.value })} />
                  </label>
                  {deck.kind !== 'local-audio' && (
                    <label className="song-row__link">
                      <span className="sr-only">Link zum Abspielen (optional)</span>
                      <input
                        defaultValue={s.link ?? ''}
                        placeholder="Link zum Abspielen (optional)"
                        inputMode="url"
                        onBlur={(e) => patchSong(s.id, { link: normalizeLink(e.target.value) })}
                      />
                    </label>
                  )}
                </div>
              )}
              <div className="song-row__year">
                {readOnly ? (
                  <span className="year-pill">{formatDate(s)}</span>
                ) : (
                  <label>
                    <span className="sr-only">Jahr für {s.title || 'Song'}</span>
                    <input
                      key={`${s.id}-${s.year}`}
                      className="year-input"
                      type="number"
                      inputMode="numeric"
                      min={MIN_YEAR}
                      max={maxYear()}
                      defaultValue={s.year ?? ''}
                      placeholder="Jahr"
                      onBlur={(e) => {
                        if (e.target.value !== String(s.year ?? '')) setYear(s, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </label>
                )}
                <span className="muted small">
                  {s.year !== null ? `${formatDate(s)} · ${precisionLabel(s.precision)}` : 'kein Jahr'}
                  <br />
                  {s.year !== null && <>Quelle: {SOURCE_LABEL[s.yearSource]}</>}
                </span>
              </div>
              <div className="song-row__status">
                {s.online && <OnlineInfo song={s} readOnly={readOnly} onAccept={() => update(deck.songs.map((x) => (x.id === s.id ? acceptSuggestion(x) : x)))} onKeep={() => update(deck.songs.map((x) => (x.id === s.id ? keepOwnYear(x) : x)))} />}
                {s.warnings.length > 0 && (
                  <ul className="warnings">
                    {s.warnings.map((w) => (
                      <li key={w}>⚠ {w}</li>
                    ))}
                  </ul>
                )}
                {!readOnly && (
                  <div className="row wrap">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={s.confirmed}
                        disabled={s.year === null}
                        onChange={(e) =>
                          e.target.checked && s.online?.status === 'differs'
                            ? update(deck.songs.map((x) => (x.id === s.id ? keepOwnYear(x) : x)))
                            : patchSong(s.id, { confirmed: e.target.checked })
                        }
                      />
                      Jahr geprüft
                    </label>
                    <button
                      type="button"
                      className="btn btn--small btn--danger-ghost"
                      onClick={() => update(deck.songs.filter((x) => x.id !== s.id))}
                      aria-label={`${s.title || 'Song'} entfernen`}
                    >
                      Entfernen
                    </button>
                  </div>
                )}
                {deck.kind === 'local-audio' && s.fileName && (
                  <span className={`small ${audio.has(s.fileName) ? 'muted' : 'warn-text'}`}>
                    Datei: {s.fileName} {audio.has(s.fileName) ? '' : '(nicht geladen)'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlbumDateNote />

      <ConfirmDialog
        open={confirmDelete}
        title="Liste löschen?"
        message={`„${deck.name}“ mit ${deck.songs.length} Songs wird von diesem Gerät gelöscht.`}
        confirmLabel="Löschen"
        danger
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function OnlineInfo({ song, readOnly, onAccept, onKeep }: { song: Song; readOnly: boolean; onAccept: () => void; onKeep: () => void }) {
  const o = song.online!;
  const shown = o.year !== undefined ? formatDate({ year: o.year, date: o.date, precision: o.precision ?? 'year' }) : '';
  const source = o.url ? (
    <a href={o.url} target="_blank" rel="noopener noreferrer">
      MusicBrainz<span className="sr-only"> (öffnet in neuem Fenster)</span>
    </a>
  ) : (
    'MusicBrainz'
  );
  switch (o.status) {
    case 'differs':
      return (
        <div className="online online--differs">
          <p>
            🔎 Laut {source} erstmals erschienen: <strong>{shown}</strong> (eingetragen: {song.year ?? '–'})
          </p>
          {!readOnly && (
            <div className="row wrap">
              <button type="button" className="btn btn--small btn--primary" onClick={onAccept}>
                {o.year} übernehmen
              </button>
              <button type="button" className="btn btn--small btn--ghost" onClick={onKeep}>
                {song.year ?? 'Eigenes'} behalten
              </button>
            </div>
          )}
        </div>
      );
    case 'match':
      return <p className="online online--ok small">✓ Online bestätigt ({source}: {shown})</p>;
    case 'filled':
      return <p className="online online--ok small">✓ Jahr online ergänzt ({source}: {shown})</p>;
    case 'kept':
      return <p className="online small muted">Online abweichend ({source}: {shown}) – eigenes Jahr behalten</p>;
    case 'notfound':
      return <p className="online small muted">Online nicht gefunden – bitte selbst prüfen</p>;
    default:
      return <p className="online small muted">Online-Prüfung fehlgeschlagen</p>;
  }
}
