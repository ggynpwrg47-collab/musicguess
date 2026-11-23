import type { PlayerState, Song, Veto } from '../types';
import { describeGap } from '../lib/game';

interface Props {
  player: PlayerState;
  songs: Record<string, Song>;
  players: PlayerState[];
  /** place = aktiver Spieler wählt; veto = Veto-Spieler wählt; view = nur ansehen; revealed = Auflösung */
  mode: 'place' | 'veto' | 'view' | 'revealed';
  guess?: number | null;
  vetoes?: Veto[];
  revealedSong?: Song | null;
  correctGaps?: number[];
  onSelectGap?: (gap: number) => void;
  gapBlockReason?: (gap: number) => string | null;
  label: string;
}

export function Timeline({ player, songs, players, mode, guess = null, vetoes = [], revealedSong, correctGaps = [], onSelectGap, gapBlockReason, label }: Props) {
  const cards = player.timeline;
  const items: React.ReactNode[] = [];

  for (let g = 0; g <= cards.length; g++) {
    const veto = vetoes.find((v) => v.value === g);
    const vetoPlayer = veto ? players.find((p) => p.id === veto.playerId) : undefined;
    const isGuess = guess === g;
    const isCorrect = mode === 'revealed' && correctGaps.includes(g);
    const where = describeGap(cards, g);
    const block = gapBlockReason?.(g) ?? null;
    const selectable = (mode === 'place' || mode === 'veto') && !!onSelectGap && !block && !(mode === 'veto' && isGuess);

    items.push(
      <li key={`gap-${g}`} className={`gap${isGuess ? ' gap--guess' : ''}${isCorrect ? ' gap--correct' : ''}${vetoPlayer ? ' gap--veto' : ''}`}>
        {isGuess && (
          <div className={`card card--mystery${mode === 'revealed' ? (isCorrect ? ' card--right' : ' card--wrong') : ''}`}>
            {mode === 'revealed' && revealedSong ? (
              <>
                <span className="card__year">{revealedSong.year}</span>
                <span className="card__title">{revealedSong.title}</span>
                <span className="card__artist">{revealedSong.artist}</span>
                <span className="card__badge">{isCorrect ? '✓ richtig' : '✗ falsch'}</span>
              </>
            ) : (
              <>
                <span className="card__year" aria-hidden="true">?</span>
                <span className="card__title">Gewählte Position</span>
                <span className="sr-only">{where}</span>
              </>
            )}
          </div>
        )}
        {vetoPlayer && (
          <div className="veto-marker" style={{ ['--pc' as string]: vetoPlayer.color }}>
            <span className="chip-dot" aria-hidden="true" />
            Veto: {vetoPlayer.name}
            {mode === 'revealed' && (isCorrect ? ' ✓' : ' ✗')}
          </div>
        )}
        {isCorrect && !isGuess && !vetoPlayer && <div className="gap__hint">richtig wäre hier</div>}
        {selectable && (
          <button
            type="button"
            className={`gap__btn${mode === 'veto' ? ' gap__btn--veto' : ''}`}
            onClick={() => onSelectGap!(g)}
            aria-label={`${mode === 'veto' ? 'Veto setzen' : 'Hier einordnen'}: ${where}`}
            aria-pressed={mode === 'place' ? isGuess : undefined}
          >
            <span aria-hidden="true">{mode === 'veto' ? '◆' : '＋'}</span>
            <span className="gap__where">{where}</span>
          </button>
        )}
      </li>,
    );
    if (g < cards.length) {
      const song = songs[cards[g].songId];
      items.push(
        <li key={cards[g].songId} className="card">
          <span className="card__year">{cards[g].year}</span>
          <span className="card__title">{song?.title}</span>
          <span className="card__artist">{song?.artist}</span>
        </li>,
      );
    }
  }

  return (
    <div className="timeline-wrap">
      <ol className={`timeline timeline--${mode}`} aria-label={label}>
        {items}
      </ol>
      {cards.length === 0 && mode === 'view' && <p className="muted">Noch keine Karten.</p>}
    </div>
  );
}
