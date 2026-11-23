import { useId, useState } from 'react';
import type { Deck, GameSettings, PlayerSetup } from '../types';
import type { Prefs } from '../lib/storage';
import { DEFAULT_SETTINGS, LIMITS, minSongsNeeded, recommendedSongs } from '../lib/game';
import { isPlayable, needsReview } from '../lib/years';
import { uid } from '../lib/random';
import { Rules } from './Rules';
import { useAudioFiles } from './audioFiles';

export const PLAYER_COLORS = ['#2563eb', '#c2410c', '#15803d', '#9333ea', '#be123c', '#0e7490', '#a16207', '#4338ca', '#9d174d', '#3f6212'];

interface Props {
  deck: Deck;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onBack: () => void;
  onReview: () => void;
  onStart: (players: PlayerSetup[], settings: GameSettings) => void;
}

function defaultPlayers(): PlayerSetup[] {
  return [
    { id: uid('p'), name: 'Team 1', color: PLAYER_COLORS[0] },
    { id: uid('p'), name: 'Team 2', color: PLAYER_COLORS[1] },
  ];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));

export function Setup({ deck, prefs, onPrefs, onBack, onReview, onStart }: Props) {
  const [players, setPlayers] = useState<PlayerSetup[]>(() => (prefs.players.length ? prefs.players : defaultPlayers()));
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...DEFAULT_SETTINGS, ...(prefs.settings ?? {}) }));
  const [error, setError] = useState<string | null>(null);
  const audio = useAudioFiles();
  const ids = { rounds: useId(), target: useId(), chips: useId() };

  const playable = deck.songs.filter(isPlayable);
  const review = deck.songs.filter(needsReview).length;
  const needed = minSongsNeeded(players.length, settings);
  const recommended = recommendedSongs(players.length, settings);
  const missingFiles = deck.kind === 'local-audio' ? playable.filter((s) => !audio.has(s.fileName)).length : 0;

  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  function start() {
    const cleaned = players.map((p, i) => ({ ...p, name: p.name.trim() || `Spieler ${i + 1}` }));
    const names = new Set(cleaned.map((p) => p.name.toLowerCase()));
    if (names.size !== cleaned.length) {
      setError('Bitte gib jedem Spieler bzw. Team einen eigenen Namen.');
      return;
    }
    if (playable.length < needed) {
      setError(`Diese Liste hat nur ${playable.length} spielbare Songs; für ${cleaned.length} Spieler sind mindestens ${needed} nötig.`);
      return;
    }
    setError(null);
    onPrefs({ ...prefs, players: cleaned, settings });
    onStart(cleaned, settings);
  }

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← Zurück
        </button>
      </div>
      <header className="stack">
        <h1 tabIndex={-1}>Neues Spiel</h1>
        <p className="lead">
          Liste: <strong>{deck.name}</strong> · {playable.length} spielbare Songs
        </p>
        {review > 0 && (
          <div className="alert alert--warn">
            <p>
              {review} Song(s) haben ein ungeprüftes oder möglicherweise falsches Jahr.{' '}
              <button type="button" className="link-btn" onClick={onReview}>
                Jetzt prüfen
              </button>
            </p>
          </div>
        )}
        {missingFiles > 0 && (
          <div className="alert alert--warn">
            <p>{missingFiles} Audiodatei(en) sind nicht geladen. Du kannst sie hier oder später im Spiel auswählen.</p>
            <label className="file-drop file-drop--inline">
              <input type="file" multiple accept="audio/*,.mp3,.m4a,.ogg,.opus,.flac,.wav" onChange={(e) => e.target.files && audio.register([...e.target.files])} />
              <span>Audiodateien auswählen …</span>
            </label>
          </div>
        )}
      </header>

      <div className="setup-grid">
        <section className="panel stack" aria-labelledby="players-title">
          <h2 id="players-title">Spieler &amp; Teams</h2>
          <ul className="player-edit">
            {players.map((p, i) => (
              <li key={p.id}>
                <span className="avatar" style={{ background: p.color }} aria-hidden="true">
                  {(p.name.trim()[0] ?? '?').toUpperCase()}
                </span>
                <label className="grow">
                  <span className="sr-only">Name von Spieler {i + 1}</span>
                  <input
                    value={p.name}
                    maxLength={24}
                    onChange={(e) => setPlayers((list) => list.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={players.length <= LIMITS.minPlayers}
                  onClick={() => setPlayers((list) => list.filter((x) => x.id !== p.id))}
                  aria-label={`${p.name || `Spieler ${i + 1}`} entfernen`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={players.length >= LIMITS.maxPlayers}
            onClick={() =>
              setPlayers((list) => [
                ...list,
                { id: uid('p'), name: `Team ${list.length + 1}`, color: PLAYER_COLORS.find((c) => !list.some((x) => x.color === c)) ?? PLAYER_COLORS[list.length % PLAYER_COLORS.length] },
              ])
            }
          >
            ＋ Spieler/Team hinzufügen
          </button>
        </section>

        <section className="panel stack" aria-labelledby="settings-title">
          <h2 id="settings-title">Einstellungen</h2>
          <fieldset className="stack">
            <legend>Spielmodus</legend>
            <label className="radio-card">
              <input type="radio" name="mode" checked={settings.mode === 'timeline'} onChange={() => set('mode', 'timeline')} />
              <span>
                <strong>Zeitleiste</strong>
                <span className="muted">Songs chronologisch in die eigene Zeitleiste einordnen.</span>
              </span>
            </label>
            <label className="radio-card">
              <input type="radio" name="mode" checked={settings.mode === 'year'} onChange={() => set('mode', 'year')} />
              <span>
                <strong>Jahr raten (einfach)</strong>
                <span className="muted">Nur das Erscheinungsjahr schätzen – Punkte nach Abstand.</span>
              </span>
            </label>
          </fieldset>

          <div className="field-row">
            <label htmlFor={ids.rounds}>Runden</label>
            <input
              id={ids.rounds}
              type="number"
              inputMode="numeric"
              min={LIMITS.minRounds}
              max={LIMITS.maxRounds}
              value={settings.rounds}
              onChange={(e) => set('rounds', clamp(+e.target.value, LIMITS.minRounds, LIMITS.maxRounds))}
            />
          </div>
          {settings.mode === 'timeline' && (
            <div className="field-row">
              <label htmlFor={ids.target}>Sieg bei Karten (0 = aus)</label>
              <input
                id={ids.target}
                type="number"
                inputMode="numeric"
                min={0}
                max={LIMITS.maxTarget}
                value={settings.targetCards}
                onChange={(e) => set('targetCards', clamp(+e.target.value, 0, LIMITS.maxTarget))}
              />
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={settings.shuffle} onChange={(e) => set('shuffle', e.target.checked)} />
            Zufällige Reihenfolge
          </label>

          <fieldset className="stack">
            <legend>Veto-Chips</legend>
            <label className="check">
              <input type="checkbox" checked={settings.vetoEnabled} onChange={(e) => set('vetoEnabled', e.target.checked)} />
              Veto-Chips verwenden
            </label>
            {settings.vetoEnabled && (
              <div className="field-row">
                <label htmlFor={ids.chips}>Chips pro Spieler/Team</label>
                <input
                  id={ids.chips}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITS.maxChips}
                  value={settings.vetoStartChips}
                  onChange={(e) => set('vetoStartChips', clamp(+e.target.value, 1, LIMITS.maxChips))}
                />
              </div>
            )}
          </fieldset>

          {playable.length < recommended && (
            <p className="muted small">
              Hinweis: Für {settings.rounds} volle Runden mit {players.length} Spielern werden ca. {recommended} Songs benötigt. Das
              Spiel endet früher, wenn die Liste leer ist.
            </p>
          )}
        </section>
      </div>

      <details className="panel" open={!prefs.rulesSeen}>
        <summary>
          <h2 className="inline-h2">Spielregeln</h2>
        </summary>
        <Rules settings={settings} />
      </details>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="sticky-actions">
        <button type="button" className="btn btn--primary btn--large" onClick={start} disabled={playable.length < needed}>
          ▶ Spiel starten
        </button>
      </div>
    </div>
  );
}
