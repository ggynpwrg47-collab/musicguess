/** Genauigkeit eines Datums – es wird nie mehr Genauigkeit angezeigt, als die Quelle hergibt. */
export type DatePrecision = 'year' | 'month' | 'day';

/** Woher die Jahreszahl eines Songs stammt. */
export type YearSource =
  | 'manual' // von Spielern eingetragen
  | 'list' // aus einer importierten Liste (Spalte „Jahr“)
  | 'album-date' // aus einer Liste, Spalte „Album-/Release-Datum“ (kann Neuauflage sein!)
  | 'tag-original' // Audio-Datei: Original-Veröffentlichung (ID3 TDOR/TORY)
  | 'tag' // Audio-Datei: Aufnahme-/Veröffentlichungsdatum dieser Datei (ID3 TDRC/TYER)
  | 'filename' // aus dem Dateinamen gelesen
  | 'demo' // mitgeliefertes Beispiel-Deck
  | 'online'; // aus der Online-Prüfung (MusicBrainz, Erstveröffentlichung der Aufnahme)

/** Ergebnis der optionalen Online-Prüfung eines Songs. */
export interface OnlineCheck {
  /** match = gleiches Jahr; differs = anderes Jahr (Vorschlag offen); filled = Jahr fehlte und wurde ergänzt;
   *  kept = Abweichung gesehen, eigenes Jahr behalten; notfound = kein Treffer; error = Abruf fehlgeschlagen */
  status: 'match' | 'differs' | 'filled' | 'kept' | 'notfound' | 'error';
  year?: number;
  date?: string;
  precision?: DatePrecision;
  /** Link zur gefundenen Aufnahme bei MusicBrainz (zum Nachprüfen). */
  url?: string;
  checkedAt: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  /** Jahr der (vermuteten) Erstveröffentlichung; null = unbekannt, Song ist nicht spielbar. */
  year: number | null;
  /** Originales Datum so genau wie bekannt, z. B. "1985", "1985-03" oder "1985-03-14". */
  date?: string;
  precision: DatePrecision;
  yearSource: YearSource;
  /** Automatisch erkannte Hinweise auf ein möglicherweise falsches Jahr. */
  warnings: string[];
  /** Von den Spielern geprüft und bestätigt. */
  confirmed: boolean;
  album?: string;
  /** Optionaler Link zum Abspielen (z. B. Spotify-, YouTube- oder Bandcamp-Link). */
  link?: string;
  /** Lokale Audiodatei (nur Dateiname; die Datei selbst wird nie gespeichert oder hochgeladen). */
  fileName?: string;
  online?: OnlineCheck;
}

export type DeckKind = 'list' | 'local-audio' | 'demo' | 'builtin';

export interface Deck {
  id: string;
  name: string;
  kind: DeckKind;
  songs: Song[];
  createdAt: number;
  updatedAt: number;
  /** Fest in die App eingebaut als Datei src/decks/<file> (bei eigenen Listen: Stand der letzten Veröffentlichung). */
  published?: { file: string; at: number };
}

export type GameMode = 'timeline' | 'year';

export interface GameSettings {
  mode: GameMode;
  /** Anzahl Runden; in jeder Runde ist jeder Spieler/jedes Team einmal dran. */
  rounds: number;
  /** Nur Zeitleisten-Modus: Spiel endet, sobald jemand so viele Karten hat (0 = aus). */
  targetCards: number;
  shuffle: boolean;
  vetoEnabled: boolean;
  vetoStartChips: number;
}

export interface PlayerSetup {
  id: string;
  name: string;
  color: string;
}

export interface TimelineCard {
  songId: string;
  year: number;
}

export interface PlayerState extends PlayerSetup {
  timeline: TimelineCard[]; // immer chronologisch sortiert
  score: number;
  chips: number;
}

export interface Veto {
  playerId: string;
  /** Zeitleisten-Modus: Lücken-Index in der Zeitleiste des aktiven Spielers. Jahres-Modus: geratenes Jahr. */
  value: number;
}

export type TurnPhase = 'guessing' | 'locked' | 'revealed';

export interface TurnResult {
  correct: boolean;
  /** Spieler, der die Karte/Punkte erhält (aktiver Spieler oder erfolgreicher Veto-Spieler). */
  winnerId: string | null;
  viaVeto: boolean;
  points: number;
  /** Jahres-Modus: Abstand der Schätzung des aktiven Spielers. */
  distance?: number;
  /** Alle richtigen Lücken (bei gleichen Jahren können es mehrere sein). */
  correctGaps?: number[];
}

export interface TurnState {
  songId: string;
  phase: TurnPhase;
  /** Lücken-Index (Zeitleiste) bzw. geratenes Jahr (Jahres-Modus). */
  guess: number | null;
  vetoes: Veto[];
  result?: TurnResult;
  /** Antwort auf „Titel und Interpret auch erraten?“ (nur bei richtigem Jahr und aktiven Veto-Chips). */
  bonus?: boolean;
}

export interface LogEntry {
  round: number;
  playerId: string;
  songId: string;
  result: 'correct' | 'wrong' | 'veto';
  points: number;
  winnerId: string | null;
  /** Bonus-Chip für erratenen Titel und Interpreten erhalten. */
  bonusChip?: boolean;
}

export interface GameState {
  status: 'playing' | 'finished';
  settings: GameSettings;
  players: PlayerState[];
  /** Kopie der verwendeten Songs (Momentaufnahme beim Start). */
  songs: Record<string, Song>;
  drawPile: string[];
  round: number;
  activeIndex: number;
  turn: TurnState | null;
  log: LogEntry[];
  deckId: string;
  finishReason?: 'rounds' | 'target' | 'deck-empty';
  seed: number;
}
