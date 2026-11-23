import { useEffect, useRef, useState } from 'react';
import type { DeckKind, GameState, PlayerState } from '../types';
import { activePlayer, bonusEligible, currentSong, describeGap, vetoBlockReason, type GameAction } from '../lib/game';
import { formatDate, precisionLabel } from '../lib/years';
import { randomSeed } from '../lib/random';
import type { OpenIn, SearchProvider } from '../lib/links';
import { Timeline } from './Timeline';
import { YearPicker } from './YearPicker';
import { Playback, playbackLink, SongQr } from './Playback';
import { ConfirmDialog, Dialog } from './Dialog';
import { Rules } from './Rules';
import { Results } from './Results';

interface Props {
  game: GameState;
  dispatch: (a: GameAction) => void;
  searchProvider: SearchProvider;
  openIn: OpenIn;
  deckKind: DeckKind;
  onMenu: () => void;
  onNewGame: () => void;
}

type Confirm =
  | { kind: 'veto'; playerId: string; value: number }
  | { kind: 'end' }
  | { kind: 'restart' }
  | { kind: 'peek' }
  | null;

export function GameView({ game, dispatch, searchProvider, openIn, onMenu, onNewGame }: Props) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [vetoer, setVetoer] = useState<string | null>(null);
  const [vetoYear, setVetoYear] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [peek, setPeek] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const turn = game.turn;
  const phase = turn?.phase;
  // Veto-Auswahl zurücksetzen, sobald sich Zug oder Phase ändern.
  useEffect(() => {
    setVetoer(null);
    setVetoYear(null);
    setPeek(false);
  }, [turn?.songId, phase]);
  useEffect(() => {
    if (phase === 'revealed') resultRef.current?.focus();
  }, [phase]);

  if (game.status === 'finished' || !turn) {
    return (
      <Results
        game={game}
        onRestart={() => dispatch({ type: 'restart', seed: randomSeed() })}
        onNewGame={onNewGame}
        onMenu={onMenu}
      />
    );
  }

  const active = activePlayer(game);
  const song = currentSong(game)!;
  const timelineMode = game.settings.mode === 'timeline';
  const others = game.players.filter((p) => p.id !== active.id);
  const vetoPossible = game.settings.vetoEnabled && others.some((p) => p.chips > 0);
  const vetoingPlayer = vetoer ? game.players.find((p) => p.id === vetoer) ?? null : null;
  const result = turn.result;

  const guessText =
    turn.guess === null ? '' : timelineMode ? describeGap(active.timeline, turn.guess) : String(turn.guess);

  function requestVeto(value: number) {
    if (!vetoer) return;
    if (vetoBlockReason(game, vetoer, value) !== null) return;
    setConfirm({ kind: 'veto', playerId: vetoer, value });
  }

  const qrLink = playbackLink(song, searchProvider);
  const askBonus = bonusEligible(game);
  const winner = result?.winnerId ? game.players.find((p) => p.id === result.winnerId) : null;

  return (
    <div className="game stack-lg">
      <div className="game__top row between wrap">
        <div>
          <h1 tabIndex={-1} className="game__title">
            Runde {game.round} von {game.settings.rounds}
          </h1>
          <p className="muted small">
            {timelineMode ? 'Zeitleiste' : 'Jahr raten'} · noch {game.drawPile.length} Song{game.drawPile.length === 1 ? '' : 's'} im Stapel
            {game.settings.targetCards > 0 && timelineMode && ` · Ziel: ${game.settings.targetCards} Karten`}
          </p>
          <div
            className="progress"
            role="progressbar"
            aria-label="Spielfortschritt"
            aria-valuemin={0}
            aria-valuemax={game.settings.rounds * game.players.length}
            aria-valuenow={(game.round - 1) * game.players.length + game.activeIndex}
          >
            <span style={{ width: `${(((game.round - 1) * game.players.length + game.activeIndex) / (game.settings.rounds * game.players.length)) * 100}%` }} />
          </div>
        </div>
        <div className="row wrap">
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setShowRules(true)}>
            Regeln
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={onMenu}>
            Menü
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirm({ kind: 'restart' })}>
            Neu starten
          </button>
          <button type="button" className="btn btn--small btn--danger-ghost" onClick={() => setConfirm({ kind: 'end' })}>
            Beenden
          </button>
        </div>
      </div>

      <Scoreboard game={game} />

      <section className="turn panel stack" aria-labelledby="turn-title" style={{ ['--pc' as string]: active.color }}>
        <div className="turn__head">
          <span className="avatar avatar--large" style={{ background: active.color }} aria-hidden="true">
            {active.name[0]?.toUpperCase()}
          </span>
          <div>
            <p className="muted small">Am Zug</p>
            <h2 id="turn-title" className="turn__name">{active.name}</h2>
          </div>
        </div>

        <div className="mystery">
          <div className={`mystery__card${qrLink && phase !== 'revealed' ? ' mystery__card--qr' : ''}`}>
            {phase === 'revealed' ? (
              <>
                <span className="mystery__year">{song.year}</span>
                <span className="mystery__title">{song.title}</span>
                <span className="mystery__artist">{song.artist}</span>
              </>
            ) : (
              <>
                {qrLink ? <SongQr link={qrLink} /> : <span className="mystery__year" aria-hidden="true">?</span>}
                <span className="mystery__hint">
                  {qrLink ? 'Scannen und auf dem zweiten Gerät abspielen' : 'Titel, Interpret und Jahr sind verdeckt'}
                </span>
              </>
            )}
          </div>
          <Playback song={song} searchProvider={searchProvider} openIn={openIn} revealed={phase === 'revealed'} />
          {phase !== 'revealed' && !song.fileName && (
            <button type="button" className="link-btn small" onClick={() => setConfirm({ kind: 'peek' })}>
              Spielleitung: Song anzeigen (ohne Jahr)
            </button>
          )}
        </div>

        {/* Raten */}
        {phase === 'guessing' && (
          <div className="stack">
            {timelineMode ? (
              <>
                <p className="instruction">
                  <strong>{active.name}</strong>, wohin gehört der Song? Tippe auf eine Lücke in deiner Zeitleiste.
                </p>
                <Timeline
                  label={`Zeitleiste von ${active.name}`}
                  player={active}
                  players={game.players}
                  songs={game.songs}
                  mode="place"
                  guess={turn.guess}
                  onSelectGap={(g) => dispatch({ type: 'guess', value: g })}
                />
              </>
            ) : (
              <YearPicker label={`${active.name}, aus welchem Jahr ist der Song?`} value={turn.guess} onChange={(y) => dispatch({ type: 'guess', value: y })} />
            )}
            <div className="action-bar">
              <button type="button" className="btn btn--primary btn--large" disabled={turn.guess === null} onClick={() => dispatch({ type: 'confirm' })}>
                {timelineMode ? 'Position bestätigen' : 'Jahr bestätigen'}
              </button>
            </div>
          </div>
        )}

        {/* Bestätigt: Veto-Fenster */}
        {phase === 'locked' && (
          <div className="stack">
            <p className="instruction">
              {active.name} tippt: <strong>{guessText}</strong>
            </p>

            {game.settings.vetoEnabled && (
              <section className="veto-panel stack" aria-labelledby="veto-title">
                <h3 id="veto-title">Veto vor dem Aufdecken?</h3>
                {!vetoPossible && turn.vetoes.length === 0 && <p className="muted">Niemand hat mehr Veto-Chips.</p>}
                <ul className="veto-players">
                  {others.map((p) => {
                    const placed = turn.vetoes.find((v) => v.playerId === p.id);
                    const reason = vetoBlockReason(game, p.id, null);
                    return (
                      <li key={p.id} style={{ ['--pc' as string]: p.color }}>
                        <span className="veto-players__name">
                          <span className="avatar" style={{ background: p.color }} aria-hidden="true">
                            {p.name[0]?.toUpperCase()}
                          </span>
                          {p.name}
                          <Chips count={p.chips} />
                        </span>
                        {placed ? (
                          <span className="row wrap">
                            <span className="small">
                              Veto auf {timelineMode ? describeGap(active.timeline, placed.value) : placed.value}
                            </span>
                            <button type="button" className="btn btn--small btn--ghost" onClick={() => dispatch({ type: 'withdrawVeto', playerId: p.id })}>
                              Zurücknehmen
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`btn btn--small ${vetoer === p.id ? 'btn--primary' : 'btn--secondary'}`}
                            disabled={!!reason}
                            title={reason ?? undefined}
                            aria-pressed={vetoer === p.id}
                            onClick={() => {
                              setVetoer(vetoer === p.id ? null : p.id);
                              setVetoYear(null);
                            }}
                          >
                            {p.chips === 0 ? 'Keine Chips' : vetoer === p.id ? 'Auswahl abbrechen' : 'Veto einlegen'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {vetoingPlayer && !timelineMode && (
                  <div className="stack">
                    <YearPicker label={`${vetoingPlayer.name}: Welches Jahr ist richtig?`} value={vetoYear} onChange={setVetoYear} />
                    {vetoYear !== null && vetoBlockReason(game, vetoingPlayer.id, vetoYear) && (
                      <p className="warn-text small">{vetoBlockReason(game, vetoingPlayer.id, vetoYear)}</p>
                    )}
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={vetoYear === null || vetoBlockReason(game, vetoingPlayer.id, vetoYear) !== null}
                      onClick={() => vetoYear !== null && requestVeto(vetoYear)}
                    >
                      Veto mit {vetoYear ?? '…'} setzen
                    </button>
                  </div>
                )}
                {vetoingPlayer && timelineMode && (
                  <p className="instruction" role="status">
                    <strong>{vetoingPlayer.name}</strong>: Wähle eine andere Lücke in der Zeitleiste von {active.name}.
                  </p>
                )}
              </section>
            )}

            {timelineMode && (
              <Timeline
                label={`Zeitleiste von ${active.name}`}
                player={active}
                players={game.players}
                songs={game.songs}
                mode={vetoingPlayer ? 'veto' : 'view'}
                guess={turn.guess}
                vetoes={turn.vetoes}
                onSelectGap={vetoingPlayer ? requestVeto : undefined}
                gapBlockReason={vetoingPlayer ? (g) => vetoBlockReason(game, vetoingPlayer.id, g) : undefined}
              />
            )}
            {!timelineMode && turn.vetoes.length > 0 && (
              <ul className="year-vetoes">
                {turn.vetoes.map((v) => {
                  const p = game.players.find((x) => x.id === v.playerId)!;
                  return (
                    <li key={v.playerId} style={{ ['--pc' as string]: p.color }}>
                      <span className="chip-dot" aria-hidden="true" /> {p.name}: {v.value}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="action-bar">
              <button type="button" className="btn btn--primary btn--large" onClick={() => dispatch({ type: 'reveal' })}>
                Lösung zeigen
              </button>
              {turn.vetoes.length === 0 && (
                <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'unlock' })}>
                  Wahl ändern
                </button>
              )}
            </div>
          </div>
        )}

        {/* Aufgedeckt */}
        {phase === 'revealed' && result && (
          <div className="stack">
            <div
              ref={resultRef}
              tabIndex={-1}
              className={`result ${result.winnerId === active.id ? 'result--good' : result.viaVeto ? 'result--veto' : 'result--bad'}`}
              role="status"
            >
              <p className="result__headline">
                {result.winnerId === active.id
                  ? `Richtig! ${active.name} bekommt ${result.points} Punkt${result.points === 1 ? '' : 'e'}.`
                  : result.viaVeto && winner
                    ? `Veto erfolgreich! ${winner.name} ${timelineMode ? 'bekommt die Karte' : `bekommt ${result.points} Punkt${result.points === 1 ? '' : 'e'}`}.`
                    : timelineMode
                      ? 'Leider falsch – die Karte wird abgelegt.'
                      : `Leider daneben (${result.distance} Jahre) – keine Punkte.`}
              </p>
              <p>
                <strong>{song.title}</strong> – {song.artist}
                <br />
                Erschienen: <strong>{formatDate(song)}</strong> <span className="muted">({precisionLabel(song.precision)})</span>
                {song.album && <span className="muted"> · Album: {song.album}</span>}
              </p>
              {song.online?.year !== undefined && song.online.year !== song.year && (
                <p className="small">🔎 Laut MusicBrainz erstmals erschienen: {song.online.year}</p>
              )}
              {(song.warnings.length > 0 || !song.confirmed) && (
                <p className="warn-text small">
                  ⚠ Jahr unsicher{song.warnings.length > 0 ? `: ${song.warnings.join('; ')}` : ' (nicht geprüft)'}
                </p>
              )}
            </div>
            {timelineMode && (
              <Timeline
                label={`Auflösung in der Zeitleiste von ${active.name}`}
                player={result.winnerId === active.id ? { ...active, timeline: active.timeline.filter((c) => c.songId !== song.id) } : active}
                players={game.players}
                songs={game.songs}
                mode="revealed"
                guess={turn.guess}
                vetoes={turn.vetoes}
                revealedSong={song}
                correctGaps={result.correctGaps}
              />
            )}
            {askBonus && (
              <section className="bonus" aria-labelledby="bonus-title">
                <h3 id="bonus-title">Bonus: Hat {active.name} auch Titel und Interpret erraten?</h3>
                <p className="muted small">Bei „Ja“ gibt es einen Veto-Chip dazu ({active.chips} → {active.chips + 1}).</p>
                <div className="row wrap">
                  <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'bonus', answer: true })}>
                    Ja, +1 Chip
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'bonus', answer: false })}>
                    Nein
                  </button>
                </div>
              </section>
            )}
            {turn.bonus === true && <p className="bonus-done" role="status">🎉 {active.name} bekommt einen Bonus-Chip!</p>}
            <div className="action-bar">
              <button
                type="button"
                className="btn btn--primary btn--large"
                onClick={() => dispatch({ type: 'next' })}
                disabled={askBonus}
                title={askBonus ? 'Bitte zuerst die Bonusfrage beantworten' : undefined}
              >
                Nächster Zug →
              </button>
            </div>
          </div>
        )}
      </section>

      {timelineMode && (
        <details className="panel">
          <summary>Alle Zeitleisten ansehen</summary>
          <div className="stack">
            {game.players.map((p) => (
              <div key={p.id} className="stack">
                <h3 style={{ color: p.color }}>{p.name}</h3>
                <Timeline label={`Zeitleiste von ${p.name}`} player={p} players={game.players} songs={game.songs} mode="view" />
              </div>
            ))}
          </div>
        </details>
      )}

      <Dialog open={showRules} title="Spielregeln" onClose={() => setShowRules(false)} wide actions={<button type="button" className="btn btn--primary" onClick={() => setShowRules(false)}>Schließen</button>}>
        <Rules settings={game.settings} />
      </Dialog>

      <Dialog open={peek} title="Nur für die Spielleitung" onClose={() => setPeek(false)} actions={<button type="button" className="btn btn--primary" onClick={() => setPeek(false)}>Ausblenden</button>}>
        <p className="peek">
          <strong>{song.title}</strong>
          <br />
          {song.artist}
        </p>
        <p className="muted small">Das Jahr wird hier bewusst nicht angezeigt.</p>
      </Dialog>

      <ConfirmDialog
        open={confirm?.kind === 'veto'}
        title="Veto-Chip einsetzen?"
        message={
          confirm?.kind === 'veto' &&
          (() => {
            const p = game.players.find((x) => x.id === confirm.playerId)!;
            return (
              <p>
                <strong>{p.name}</strong> setzt einen Veto-Chip auf{' '}
                <strong>{timelineMode ? describeGap(active.timeline, confirm.value) : confirm.value}</strong>.
                <br />
                Chips: {p.chips} → {p.chips - 1}. Der Chip ist verbraucht, auch wenn das Veto nicht erfolgreich ist.
              </p>
            );
          })()
        }
        confirmLabel="Chip einsetzen"
        onConfirm={() => {
          if (confirm?.kind === 'veto') dispatch({ type: 'veto', playerId: confirm.playerId, value: confirm.value });
          setConfirm(null);
          setVetoer(null);
          setVetoYear(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'restart'}
        title="Spiel neu starten?"
        message="Gleiche Spieler und Einstellungen, neu gemischt. Punkte, Zeitleisten und Veto-Chips werden zurückgesetzt."
        confirmLabel="Neu starten"
        danger
        onConfirm={() => {
          dispatch({ type: 'restart', seed: randomSeed() });
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'end'}
        title="Spiel beenden?"
        message="Das Spiel wird jetzt mit dem aktuellen Punktestand ausgewertet."
        confirmLabel="Beenden"
        danger
        onConfirm={() => {
          dispatch({ type: 'end' });
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'peek'}
        title="Song anzeigen?"
        message="Titel und Interpret werden angezeigt (ohne Jahr). Nur für die Spielleitung bzw. den „DJ“, der den Song startet – Mitspieler bitte wegschauen."
        confirmLabel="Anzeigen"
        onConfirm={() => {
          setConfirm(null);
          setPeek(true);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export function Chips({ count }: { count: number }) {
  return (
    <span className="chips" aria-label={`${count} Veto-Chip${count === 1 ? '' : 's'}`} title={`${count} Veto-Chips`}>
      {Array.from({ length: Math.min(count, 5) }, (_, i) => (
        <span key={i} className="chip-dot" aria-hidden="true" />
      ))}
      <span aria-hidden="true" className="chips__n">{count}</span>
    </span>
  );
}

function Scoreboard({ game }: { game: GameState }) {
  const active = activePlayer(game);
  return (
    <section aria-label="Punktestand">
      <ul className="scoreboard" aria-live="polite">
        {game.players.map((p: PlayerState) => (
          <li key={p.id} className={`score${p.id === active.id ? ' score--active' : ''}`} style={{ ['--pc' as string]: p.color }} aria-current={p.id === active.id ? 'true' : undefined}>
            <span className="score__name">{p.name}</span>
            <span className="score__pts">
              {p.score} <span className="small">Pkt.</span>
            </span>
            <span className="score__meta">
              {game.settings.mode === 'timeline' && <span>{p.timeline.length} {p.timeline.length === 1 ? 'Karte' : 'Karten'}</span>}
              {game.settings.vetoEnabled && <Chips count={p.chips} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
