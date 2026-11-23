import { useState } from 'react';
import type { Deck, GameState } from '../types';
import { isPlayable, needsReview } from '../lib/years';
import { ConfirmDialog } from './Dialog';

interface Props {
  decks: Deck[];
  game: GameState | null;
  onResume: () => void;
  onDiscardGame: () => void;
  onPlay: (deckId: string) => void;
  onOpenDeck: (deckId: string) => void;
  onImport: () => void;
  onInfo: () => void;
}

export function Home({ decks, game, onResume, onDiscardGame, onPlay, onOpenDeck, onImport, onInfo }: Props) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const running = game && game.status === 'playing';

  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero__text">
          <h1 tabIndex={-1}>Welcher Song kam zuerst?</h1>
          <p className="lead">
            Hört gemeinsam Musik, ratet das Erscheinungsjahr und baut eure eigene Zeitleiste. Für 1–10 Spieler oder Teams
            an einem Gerät – ganz ohne Karten, Konto oder Abo.
          </p>
          <div className="row wrap">
            {running && (
              <button type="button" className="btn btn--primary btn--large" onClick={onResume}>
                ▶ Spiel fortsetzen (Runde {game.round})
              </button>
            )}
            <button type="button" className={`btn btn--large ${running ? 'btn--secondary' : 'btn--primary'}`} onClick={onImport}>
              ＋ Eigene Song-Liste anlegen
            </button>
          </div>
          {running && (
            <button type="button" className="link-btn" onClick={() => setConfirmDiscard(true)}>
              Laufendes Spiel verwerfen
            </button>
          )}
        </div>
        <ol className="steps" aria-label="So funktioniert es">
          <li><strong>Songs wählen</strong><span>Beispiel-Deck, eigene Liste oder eigene Audiodateien.</span></li>
          <li><strong>Jahre prüfen</strong><span>Unsichere Angaben werden markiert und lassen sich korrigieren.</span></li>
          <li><strong>Spielen</strong><span>Song abspielen, einordnen, Veto einlegen, aufdecken.</span></li>
        </ol>
      </section>

      <section className="notice" aria-labelledby="spotify-note">
        <h2 id="spotify-note" className="notice__title">Warum gibt es keinen „Mit Spotify verbinden“-Knopf?</h2>
        <p>
          Spotifys Entwicklerrichtlinien verbieten Apps, die die Spotify-Schnittstellen für Spiele oder Quizze nutzen. Seit
          Februar 2026 liefert die Schnittstelle zudem Playlist-Inhalte nur noch für eigene Playlists. Music Guess nutzt
          deshalb keine Spotify-API und keinen Spotify-Login. Ihr könnt Songs trotzdem über normale Links in eurer
          Musik-App abspielen.{' '}
          <button type="button" className="link-btn" onClick={onInfo}>
            Mehr erfahren
          </button>
        </p>
      </section>

      <section aria-labelledby="decks-title" className="stack">
        <div className="row between wrap">
          <h2 id="decks-title">Song-Listen</h2>
          <button type="button" className="btn btn--secondary" onClick={onImport}>
            ＋ Neue Liste
          </button>
        </div>
        <ul className="deck-grid">
          {decks.map((deck) => {
            const playable = deck.songs.filter(isPlayable).length;
            const review = deck.songs.filter(needsReview).length;
            return (
              <li key={deck.id} className="deck-card">
                <div className="deck-card__head">
                  <span className={`tag tag--${deck.kind}`}>
                    {deck.kind === 'demo' ? 'Beispiel' : deck.kind === 'builtin' ? 'Fest eingebaut' : deck.kind === 'local-audio' ? 'Eigene Audiodateien' : 'Nur auf diesem Gerät'}
                  </span>
                  <h3>{deck.name}</h3>
                </div>
                <p className="muted">
                  {playable} von {deck.songs.length} Songs spielbar
                  {review > 0 && (
                    <>
                      {' · '}
                      <span className="warn-text">{review} zu prüfen</span>
                    </>
                  )}
                </p>
                <div className="row wrap">
                  <button type="button" className="btn btn--primary" onClick={() => onPlay(deck.id)} disabled={playable < 2}>
                    Spielen
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => onOpenDeck(deck.id)}>
                    {deck.kind === 'demo' || deck.kind === 'builtin' ? 'Ansehen' : 'Jahre prüfen & bearbeiten'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <ConfirmDialog
        open={confirmDiscard}
        title="Spiel verwerfen?"
        message="Punktestände, Zeitleisten und Veto-Chips des laufenden Spiels gehen verloren."
        confirmLabel="Verwerfen"
        danger
        onConfirm={() => {
          onDiscardGame();
          setConfirmDiscard(false);
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
