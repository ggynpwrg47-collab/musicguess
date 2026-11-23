import type {
  GameSettings,
  GameState,
  LogEntry,
  PlayerSetup,
  PlayerState,
  Song,
  TimelineCard,
  TurnResult,
  Veto,
} from '../types';
import { createRng, shuffle } from './random';
import { isPlayable, maxYear, MIN_YEAR } from './years';

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'timeline',
  rounds: 5,
  targetCards: 0,
  shuffle: true,
  vetoEnabled: true,
  vetoStartChips: 2,
};

export const LIMITS = {
  minPlayers: 1,
  maxPlayers: 10,
  minRounds: 1,
  maxRounds: 50,
  maxChips: 10,
  maxTarget: 30,
};

/** Punkte im Jahres-Modus nach Abstand zum richtigen Jahr. */
export function yearPoints(distance: number): number {
  if (distance === 0) return 3;
  if (distance === 1) return 2;
  if (distance <= 3) return 1;
  return 0;
}

/** Alle Lücken, in die ein Song mit diesem Jahr korrekt passt (gleiche Jahre zählen als richtig). */
export function correctGaps(timeline: TimelineCard[], year: number): number[] {
  const gaps: number[] = [];
  for (let g = 0; g <= timeline.length; g++) {
    const leftOk = g === 0 || timeline[g - 1].year <= year;
    const rightOk = g === timeline.length || year <= timeline[g].year;
    if (leftOk && rightOk) gaps.push(g);
  }
  return gaps;
}

export function insertSorted(timeline: TimelineCard[], card: TimelineCard): TimelineCard[] {
  const idx = timeline.findIndex((c) => c.year > card.year);
  const out = timeline.slice();
  out.splice(idx === -1 ? out.length : idx, 0, card);
  return out;
}

export function minSongsNeeded(playerCount: number, settings: GameSettings): number {
  return (settings.mode === 'timeline' ? playerCount : 0) + 1;
}

export function recommendedSongs(playerCount: number, settings: GameSettings): number {
  return minSongsNeeded(playerCount, settings) + playerCount * settings.rounds;
}

export function createGame(
  songs: Song[],
  players: PlayerSetup[],
  settings: GameSettings,
  seed: number,
  deckId: string,
): GameState {
  const playable = songs.filter(isPlayable);
  if (players.length < LIMITS.minPlayers) throw new Error('Mindestens ein Spieler bzw. Team wird benötigt.');
  if (playable.length < minSongsNeeded(players.length, settings)) {
    throw new Error(`Zu wenige spielbare Songs: mindestens ${minSongsNeeded(players.length, settings)} nötig.`);
  }
  const rng = createRng(seed);
  const ids = playable.map((s) => s.id);
  const pile = settings.shuffle ? shuffle(ids, rng) : ids;
  const songMap: Record<string, Song> = {};
  for (const s of playable) songMap[s.id] = s;

  const chips = settings.vetoEnabled ? settings.vetoStartChips : 0;
  const playerStates: PlayerState[] = players.map((p) => ({ ...p, timeline: [], score: 0, chips }));

  if (settings.mode === 'timeline') {
    // Jeder startet mit einer aufgedeckten Karte als Anker der eigenen Zeitleiste.
    for (const p of playerStates) {
      const id = pile.shift()!;
      p.timeline = [{ songId: id, year: songMap[id].year! }];
    }
  }

  const first = pile.shift()!;
  return {
    status: 'playing',
    settings: { ...settings },
    players: playerStates,
    songs: songMap,
    drawPile: pile,
    round: 1,
    activeIndex: 0,
    turn: { songId: first, phase: 'guessing', guess: null, vetoes: [] },
    log: [],
    deckId,
    seed,
  };
}

export type GameAction =
  | { type: 'guess'; value: number }
  | { type: 'confirm' }
  | { type: 'unlock' }
  | { type: 'veto'; playerId: string; value: number }
  | { type: 'withdrawVeto'; playerId: string }
  | { type: 'reveal' }
  | { type: 'bonus'; answer: boolean }
  | { type: 'next' }
  | { type: 'restart'; seed: number }
  | { type: 'end' };

export function activePlayer(state: GameState): PlayerState {
  return state.players[state.activeIndex];
}

export function currentSong(state: GameState): Song | null {
  return state.turn ? state.songs[state.turn.songId] ?? null : null;
}

function isValidGuess(state: GameState, value: number): boolean {
  if (!Number.isInteger(value)) return false;
  if (state.settings.mode === 'timeline') {
    return value >= 0 && value <= activePlayer(state).timeline.length;
  }
  return value >= MIN_YEAR && value <= maxYear();
}

/** Prüft, ob ein Veto erlaubt ist. Gibt einen Grund zurück, wenn nicht – sonst null. */
export function vetoBlockReason(state: GameState, playerId: string, value: number | null): string | null {
  const turn = state.turn;
  if (state.status !== 'playing' || !turn) return 'Kein laufender Zug.';
  if (!state.settings.vetoEnabled) return 'Veto-Chips sind ausgeschaltet.';
  if (turn.phase !== 'locked') return 'Ein Veto ist erst möglich, wenn der aktive Spieler seine Wahl bestätigt hat – und nur vor dem Aufdecken.';
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 'Unbekannter Spieler.';
  if (player.id === activePlayer(state).id) return 'Der aktive Spieler kann kein Veto gegen sich selbst einlegen.';
  if (player.chips <= 0) return `${player.name} hat keine Veto-Chips mehr.`;
  if (turn.vetoes.some((v) => v.playerId === playerId)) return `${player.name} hat in diesem Zug bereits ein Veto gesetzt.`;
  if (value === null) return null;
  if (!isValidGuess(state, value)) return 'Ungültige Position.';
  if (value === turn.guess) return 'Hier liegt bereits die Karte des aktiven Spielers.';
  if (turn.vetoes.some((v) => v.value === value)) return 'Auf dieser Position liegt bereits ein Veto-Chip.';
  return null;
}

function evaluateTimeline(state: GameState, song: Song): TurnResult {
  const turn = state.turn!;
  const active = activePlayer(state);
  const gaps = correctGaps(active.timeline, song.year!);
  if (turn.guess !== null && gaps.includes(turn.guess)) {
    return { correct: true, winnerId: active.id, viaVeto: false, points: 1, correctGaps: gaps };
  }
  // Erster erfolgreicher Veto-Chip (in Reihenfolge des Setzens) gewinnt die Karte.
  const winner = turn.vetoes.find((v) => gaps.includes(v.value));
  return {
    correct: false,
    winnerId: winner ? winner.playerId : null,
    viaVeto: !!winner,
    points: winner ? 1 : 0,
    correctGaps: gaps,
  };
}

function evaluateYear(state: GameState, song: Song): TurnResult {
  const turn = state.turn!;
  const active = activePlayer(state);
  const year = song.year!;
  const distance = turn.guess === null ? Infinity : Math.abs(turn.guess - year);
  const activePts = yearPoints(distance);
  let best: Veto | null = null;
  let bestDist = Infinity;
  for (const v of turn.vetoes) {
    const d = Math.abs(v.value - year);
    if (yearPoints(d) > 0 && d < distance && d < bestDist) {
      best = v;
      bestDist = d;
    }
  }
  if (best) {
    return { correct: false, winnerId: best.playerId, viaVeto: true, points: yearPoints(bestDist), distance };
  }
  return {
    correct: activePts > 0,
    winnerId: activePts > 0 ? active.id : null,
    viaVeto: false,
    points: activePts,
    distance,
  };
}

function finish(state: GameState, reason: GameState['finishReason']): GameState {
  return { ...state, status: 'finished', finishReason: reason, turn: null };
}

function drawFor(state: GameState): GameState {
  if (state.drawPile.length === 0) return finish(state, 'deck-empty');
  const [next, ...rest] = state.drawPile;
  return { ...state, drawPile: rest, turn: { songId: next, phase: 'guessing', guess: null, vetoes: [] } };
}

function refundVetoes(players: PlayerState[], vetoes: Veto[]): PlayerState[] {
  if (vetoes.length === 0) return players;
  return players.map((p) => (vetoes.some((v) => v.playerId === p.id) ? { ...p, chips: p.chips + 1 } : p));
}

/**
 * Bonusfrage „Titel und Interpret auch erraten?“: nur wenn Veto-Chips aktiv sind, der aktive Spieler
 * das Jahr selbst richtig hatte (Zeitleiste: richtig eingeordnet; Jahres-Modus: exaktes Jahr)
 * und die Frage in diesem Zug noch nicht beantwortet wurde.
 */
export function bonusEligible(state: GameState): boolean {
  const turn = state.turn;
  if (state.status !== 'playing' || !turn || turn.phase !== 'revealed' || !turn.result) return false;
  if (!state.settings.vetoEnabled || turn.bonus !== undefined) return false;
  const r = turn.result;
  if (r.viaVeto || r.winnerId !== activePlayer(state).id) return false;
  return state.settings.mode === 'timeline' ? r.correct : r.distance === 0;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const turn = state.turn;
  switch (action.type) {
    case 'guess': {
      if (state.status !== 'playing' || !turn || turn.phase !== 'guessing') return state;
      if (!isValidGuess(state, action.value)) return state;
      return { ...state, turn: { ...turn, guess: action.value } };
    }
    case 'confirm': {
      if (!turn || turn.phase !== 'guessing' || turn.guess === null) return state;
      return { ...state, turn: { ...turn, phase: 'locked' } };
    }
    case 'unlock': {
      // Zurück zum Raten ist nur möglich, solange noch niemand ein Veto gesetzt hat.
      if (!turn || turn.phase !== 'locked' || turn.vetoes.length > 0) return state;
      return { ...state, turn: { ...turn, phase: 'guessing' } };
    }
    case 'veto': {
      if (vetoBlockReason(state, action.playerId, action.value) !== null) return state;
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.playerId ? { ...p, chips: p.chips - 1 } : p)),
        turn: { ...turn!, vetoes: [...turn!.vetoes, { playerId: action.playerId, value: action.value }] },
      };
    }
    case 'withdrawVeto': {
      if (!turn || turn.phase !== 'locked') return state;
      const veto = turn.vetoes.find((v) => v.playerId === action.playerId);
      if (!veto) return state;
      return {
        ...state,
        players: refundVetoes(state.players, [veto]),
        turn: { ...turn, vetoes: turn.vetoes.filter((v) => v !== veto) },
      };
    }
    case 'reveal': {
      if (!turn || turn.phase !== 'locked' || turn.guess === null) return state;
      const song = state.songs[turn.songId];
      const result = state.settings.mode === 'timeline' ? evaluateTimeline(state, song) : evaluateYear(state, song);
      const players = state.players.map((p) => {
        if (p.id !== result.winnerId) return p;
        return {
          ...p,
          score: p.score + result.points,
          timeline: insertSorted(p.timeline, { songId: song.id, year: song.year! }),
        };
      });
      const entry: LogEntry = {
        round: state.round,
        playerId: activePlayer(state).id,
        songId: song.id,
        result: result.viaVeto ? 'veto' : result.correct ? 'correct' : 'wrong',
        points: result.points,
        winnerId: result.winnerId,
      };
      return { ...state, players, turn: { ...turn, phase: 'revealed', result }, log: [...state.log, entry] };
    }
    case 'bonus': {
      if (!bonusEligible(state)) return state;
      const active = activePlayer(state);
      const log = state.log.slice();
      if (log.length) log[log.length - 1] = { ...log[log.length - 1], bonusChip: action.answer };
      return {
        ...state,
        players: action.answer ? state.players.map((p) => (p.id === active.id ? { ...p, chips: p.chips + 1 } : p)) : state.players,
        turn: { ...turn!, bonus: action.answer },
        log,
      };
    }
    case 'next': {
      if (state.status !== 'playing' || !turn || turn.phase !== 'revealed') return state;
      if (bonusEligible(state)) return state; // erst die Bonusfrage beantworten
      const { settings } = state;
      if (settings.mode === 'timeline' && settings.targetCards > 0 && state.players.some((p) => p.timeline.length >= settings.targetCards)) {
        return finish(state, 'target');
      }
      let activeIndex = state.activeIndex + 1;
      let round = state.round;
      if (activeIndex >= state.players.length) {
        activeIndex = 0;
        round += 1;
      }
      if (round > settings.rounds) return finish({ ...state, round: settings.rounds }, 'rounds');
      return drawFor({ ...state, activeIndex, round, turn: null });
    }
    case 'restart': {
      const songs = Object.values(state.songs);
      const setups: PlayerSetup[] = state.players.map(({ id, name, color }) => ({ id, name, color }));
      return createGame(songs, setups, state.settings, action.seed, state.deckId);
    }
    case 'end': {
      if (state.status !== 'playing') return state;
      return finish({ ...state, players: turn ? refundVetoes(state.players, turn.phase === 'locked' ? turn.vetoes : []) : state.players }, 'rounds');
    }
    default:
      return state;
  }
}

export function ranking(state: GameState): PlayerState[] {
  return state.players
    .slice()
    .sort((a, b) => b.score - a.score || b.timeline.length - a.timeline.length || a.name.localeCompare(b.name));
}

/** Beschreibt eine Lücke für Screenreader und Bestätigungsdialoge. */
export function describeGap(timeline: TimelineCard[], gap: number): string {
  if (timeline.length === 0) return 'erste Position';
  if (gap === 0) return `vor ${timeline[0].year}`;
  if (gap === timeline.length) return `nach ${timeline[timeline.length - 1].year}`;
  return `zwischen ${timeline[gap - 1].year} und ${timeline[gap].year}`;
}
