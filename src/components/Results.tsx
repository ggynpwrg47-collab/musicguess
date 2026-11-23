import type { GameState } from '../types';
import { ranking } from '../lib/game';
import { Timeline } from './Timeline';

interface Props {
  game: GameState;
  onRestart: () => void;
  onNewGame: () => void;
  onMenu: () => void;
}

const REASON: Record<NonNullable<GameState['finishReason']>, string> = {
  rounds: 'Alle Runden sind gespielt.',
  target: 'Die Zielanzahl an Karten wurde erreicht.',
  'deck-empty': 'Es sind keine Songs mehr übrig.',
};

export function Results({ game, onRestart, onNewGame, onMenu }: Props) {
  const ranked = ranking(game);
  const top = ranked[0];
  const winners = ranked.filter((p) => p.score === top.score && p.timeline.length === top.timeline.length);
  const played = game.log.length;
  const bonusChips = game.log.filter((l) => l.bonusChip).length;
  const vetoWins = game.log.filter((l) => l.result === 'veto').length;

  return (
    <div className="stack-lg">
      <header className="results-hero">
        <p className="muted">{game.finishReason ? REASON[game.finishReason] : 'Spiel beendet.'}</p>
        <h1 tabIndex={-1}>
          {winners.length > 1 ? `Gleichstand: ${winners.map((w) => w.name).join(' & ')}` : `🏆 ${top.name} gewinnt!`}
        </h1>
        <p className="lead">
          {played} Song{played === 1 ? '' : 's'} gespielt
          {game.settings.vetoEnabled &&
            ` · ${vetoWins} erfolgreiche${vetoWins === 1 ? 's' : ''} Veto${vetoWins === 1 ? '' : 's'} · ${bonusChips} Bonus-Chip${bonusChips === 1 ? '' : 's'}`}
        </p>
      </header>

      <ol className="ranking">
        {ranked.map((p, i) => (
          <li key={p.id} style={{ ['--pc' as string]: p.color }}>
            <span className="ranking__pos">{i + 1}.</span>
            <span className="ranking__name">{p.name}</span>
            <span className="ranking__pts">{p.score} Pkt.</span>
            <span className="muted small">
              {game.settings.mode === 'timeline' ? `${p.timeline.length} ${p.timeline.length === 1 ? 'Karte' : 'Karten'}` : `${p.timeline.length} Songs erraten`}
              {game.settings.vetoEnabled && ` · ${p.chips} Chips übrig`}
            </span>
          </li>
        ))}
      </ol>

      <div className="row wrap">
        <button type="button" className="btn btn--primary btn--large" onClick={onRestart}>
          Nochmal spielen
        </button>
        <button type="button" className="btn btn--secondary" onClick={onNewGame}>
          Neues Spiel einrichten
        </button>
        <button type="button" className="btn btn--ghost" onClick={onMenu}>
          Zur Startseite
        </button>
      </div>

      <details className="panel" open>
        <summary>Zeitleisten</summary>
        <div className="stack">
          {ranked.map((p) => (
            <div key={p.id} className="stack">
              <h3 style={{ color: p.color }}>{p.name}</h3>
              <Timeline label={`Zeitleiste von ${p.name}`} player={p} players={game.players} songs={game.songs} mode="view" />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
