import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Deck, GameSettings, PlayerSetup } from './types';
import { createGame, gameReducer, type GameAction } from './lib/game';
import type { GameState } from './types';
import { createDemoDeck } from './lib/demoDeck';
import { loadBuiltinDecks } from './lib/builtinDecks';
import { forgetGitHub } from './lib/github';
import { storage, type Prefs } from './lib/storage';
import { randomSeed } from './lib/random';
import { Home } from './components/Home';
import { ImportView } from './components/ImportView';
import { DeckReview } from './components/DeckReview';
import { Setup } from './components/Setup';
import { GameView } from './components/GameView';
import { InfoView } from './components/InfoView';
import { AudioFilesProvider } from './components/audioFiles';

export type View =
  | { name: 'home' }
  | { name: 'import' }
  | { name: 'deck'; deckId: string }
  | { name: 'setup'; deckId: string }
  | { name: 'game' }
  | { name: 'info' };

type Action = GameAction | { type: 'load'; state: GameState | null };

function appGameReducer(state: GameState | null, action: Action): GameState | null {
  if (action.type === 'load') return action.state;
  return state ? gameReducer(state, action) : state;
}

export default function App() {
  const [decks, setDecks] = useState<Deck[]>(() => [createDemoDeck(), ...loadBuiltinDecks(), ...storage.loadDecks()]);
  const [prefs, setPrefs] = useState<Prefs>(() => storage.loadPrefs());
  const [game, dispatch] = useReducer(appGameReducer, null, () => storage.loadGame());
  const [view, setView] = useState<View>({ name: 'home' });

  useEffect(() => {
    storage.saveDecks(decks);
  }, [decks]);
  useEffect(() => {
    storage.savePrefs(prefs);
  }, [prefs]);
  useEffect(() => {
    storage.saveGame(game);
  }, [game]);

  // Beim Ansichtswechsel nach oben scrollen und Überschrift fokussieren (für Tastatur/Screenreader).
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const h = document.querySelector<HTMLElement>('main h1');
    h?.focus({ preventScroll: true });
  }, [view]);

  const upsertDeck = useCallback((deck: Deck) => {
    setDecks((list) => {
      const i = list.findIndex((d) => d.id === deck.id);
      if (i === -1) return [...list, deck];
      const copy = list.slice();
      copy[i] = deck;
      return copy;
    });
  }, []);

  const deleteDeck = useCallback((id: string) => {
    setDecks((list) => list.filter((d) => d.id !== id || d.kind === 'demo' || d.kind === 'builtin'));
    setView({ name: 'home' });
  }, []);

  const startGame = useCallback(
    (deck: Deck, players: PlayerSetup[], settings: GameSettings) => {
      const state = createGame(deck.songs, players, settings, randomSeed(), deck.id);
      dispatch({ type: 'load', state });
      setPrefs((p) => ({ ...p, players, settings, lastDeckId: deck.id, rulesSeen: true }));
      setView({ name: 'game' });
    },
    [],
  );

  const deckById = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks]);
  const builtinFiles = useMemo(() => new Set(decks.filter((d) => d.kind === 'builtin').map((d) => d.published!.file)), [decks]);
  // Eigene Listen ausblenden, sobald sie unverändert als eingebaute Liste vorliegen (keine Doppelten).
  const visibleDecks = useMemo(
    () => decks.filter((d) => !(d.kind === 'list' && d.published && builtinFiles.has(d.published.file) && d.updatedAt <= d.published.at)),
    [decks, builtinFiles],
  );

  let content: React.ReactNode;
  switch (view.name) {
    case 'import':
      content = (
        <ImportView
          onCancel={() => setView({ name: 'home' })}
          onImported={(deck) => {
            upsertDeck(deck);
            setView({ name: 'deck', deckId: deck.id });
          }}
        />
      );
      break;
    case 'deck': {
      const deck = deckById.get(view.deckId);
      content = deck ? (
        <DeckReview
          deck={deck}
          onChange={upsertDeck}
          onDelete={() => deleteDeck(deck.id)}
          onBack={() => setView({ name: 'home' })}
          onPlay={() => setView({ name: 'setup', deckId: deck.id })}
          onOpenDeck={(id) => setView({ name: 'deck', deckId: id })}
          builtinFiles={builtinFiles}
          onOpenSettings={() => setView({ name: 'info' })}
        />
      ) : (
        <Missing onBack={() => setView({ name: 'home' })} />
      );
      break;
    }
    case 'setup': {
      const deck = deckById.get(view.deckId);
      content = deck ? (
        <Setup
          deck={deck}
          prefs={prefs}
          onPrefs={setPrefs}
          onBack={() => setView({ name: 'home' })}
          onReview={() => setView({ name: 'deck', deckId: deck.id })}
          onStart={(players, settings) => startGame(deck, players, settings)}
        />
      ) : (
        <Missing onBack={() => setView({ name: 'home' })} />
      );
      break;
    }
    case 'game':
      content = game ? (
        <GameView
          game={game}
          dispatch={dispatch}
          searchProvider={prefs.searchProvider}
          openIn={prefs.openIn}
          deckKind={deckById.get(game.deckId)?.kind ?? 'list'}
          onMenu={() => setView({ name: 'home' })}
          onNewGame={() => {
            const deckId = game.deckId;
            dispatch({ type: 'load', state: null });
            setView(deckById.has(deckId) ? { name: 'setup', deckId } : { name: 'home' });
          }}
        />
      ) : (
        <Missing onBack={() => setView({ name: 'home' })} />
      );
      break;
    case 'info':
      content = (
        <InfoView
          prefs={prefs}
          onPrefs={setPrefs}
          onBack={() => setView({ name: 'home' })}
          onClearAll={() => {
            storage.clearAll();
            forgetGitHub();
            setDecks([createDemoDeck(), ...loadBuiltinDecks()]);
            setPrefs(storage.loadPrefs());
            dispatch({ type: 'load', state: null });
            setView({ name: 'home' });
          }}
        />
      );
      break;
    default:
      content = (
        <Home
          decks={visibleDecks}
          game={game}
          onResume={() => setView({ name: 'game' })}
          onDiscardGame={() => dispatch({ type: 'load', state: null })}
          onPlay={(id) => setView({ name: 'setup', deckId: id })}
          onOpenDeck={(id) => setView({ name: 'deck', deckId: id })}
          onImport={() => setView({ name: 'import' })}
          onInfo={() => setView({ name: 'info' })}
        />
      );
  }

  return (
    <AudioFilesProvider>
      <a className="skip-link" href="#main">
        Zum Inhalt springen
      </a>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setView({ name: 'home' })} aria-label="Music Guess – zur Startseite">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={32} height={32} />
          <span>Music Guess</span>
        </button>
        <nav aria-label="Hauptnavigation" className="topbar__nav">
          {game && game.status === 'playing' && view.name !== 'game' && (
            <button type="button" className="btn btn--small btn--primary" onClick={() => setView({ name: 'game' })}>
              Spiel fortsetzen
            </button>
          )}
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setView({ name: 'info' })}>
            Info &amp; Datenschutz
          </button>
        </nav>
      </header>
      <main id="main" className="main">
        {content}
      </main>
      <footer className="footer">
        <p>
          Music Guess ist ein unabhängiges Fan-Projekt und steht in keiner Verbindung zu Spotify oder anderen Marken.
          Keine Werbung, keine Abos, keine Konten.
        </p>
      </footer>
    </AudioFilesProvider>
  );
}

function Missing({ onBack }: { onBack: () => void }) {
  return (
    <section className="panel stack">
      <h1 tabIndex={-1}>Nicht gefunden</h1>
      <p>Diese Liste oder dieses Spiel existiert nicht mehr.</p>
      <button type="button" className="btn btn--primary" onClick={onBack}>
        Zur Startseite
      </button>
    </section>
  );
}
