import { useState } from 'react';
import type { Prefs } from '../lib/storage';
import type { OpenIn, SearchProvider } from '../lib/links';
import { ConfirmDialog } from './Dialog';
import { GitHubSettings } from './GitHubSettings';

export function AlbumDateNote() {
  return (
    <aside className="note" aria-label="Hinweis zu Jahreszahlen">
      <strong>Gut zu wissen:</strong> Das Datum, das Streamingdienste (auch Spotify) anzeigen, ist das Veröffentlichungsdatum
      des <em>Albums</em> bzw. der jeweiligen Ausgabe. Bei Remastern, Best-of-Compilations, Live-Alben oder
      Neuaufnahmen ist das oft Jahre oder Jahrzehnte später als die Erstveröffentlichung des Songs. Music Guess markiert
      solche Fälle, so gut es geht – prüft die Jahre trotzdem vor dem Spiel.
    </aside>
  );
}

interface Props {
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onBack: () => void;
  onClearAll: () => void;
}

export function InfoView({ prefs, onPrefs, onBack, onClearAll }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <div className="stack-lg prose">
      <div className="row between wrap">
        <h1 tabIndex={-1}>Info &amp; Datenschutz</h1>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← Zurück
        </button>
      </div>

      <section className="panel stack">
        <h2>Spotify und andere Musikdienste</h2>
        <p>
          Ursprünglich sollte Music Guess Playlists direkt aus Spotify laden und dort abspielen. Das ist mit den aktuellen
          Spotify-Regeln nicht regelkonform möglich:
        </p>
        <ul>
          <li>
            Die <strong>Spotify Developer Policy</strong> nennt unter den verbotenen Anwendungen ausdrücklich Spiele
            einschließlich Trivia-Quizze („Do not create a game, including trivia quizzes“). Ein Musik-Jahreszahlen-Quiz
            über Spotify-Login, Web-API oder Web Playback SDK wäre ein solches Spiel.
          </li>
          <li>
            Seit den Änderungen vom <strong>Februar 2026</strong> liefert die Web-API Playlist-Inhalte im
            Entwicklungsmodus nur noch für Playlists, die dem angemeldeten Nutzer gehören oder bei denen er mitwirkt.
            „Beliebige“ Playlists per Link lassen sich also ohnehin nicht zuverlässig auslesen.
          </li>
          <li>
            Apps im Entwicklungsmodus sind außerdem auf wenige freigeschaltete Nutzer begrenzt und setzen ein
            Premium-Konto des App-Besitzers voraus; die Wiedergabe über das Web Playback SDK erfordert Premium.
          </li>
        </ul>
        <p>
          Music Guess nutzt deshalb <strong>keine</strong> Spotify-Schnittstelle, keinen Spotify-Login, keine Cover und keine
          Spotify-Logos. Zum Abspielen öffnet die App höchstens einen normalen Link – genau so, als würdest du ihn selbst
          anklicken. Die Wiedergabe passiert dann vollständig in der App des jeweiligen Dienstes und nach dessen Regeln.
        </p>
      </section>

      <section className="panel stack">
        <h2>Abspielen ohne Spoiler</h2>
        <ul>
          <li>
            <strong>Eigene Audiodateien:</strong> werden direkt in Music Guess abgespielt, Titel und Interpret bleiben
            verborgen. Die Dateien verlassen dein Gerät nicht.
          </li>
          <li>
            <strong>Links / Suche:</strong> Die Musik-App zeigt den Titel an. Legt das Abspielgerät verdeckt hin, nutzt ein
            zweites Gerät (QR-Code) oder bestimmt eine Person als „DJ“, die nicht miträt.
          </li>
        </ul>
        <div className="field">
          <label htmlFor="open-in">Spotify-Songs öffnen in</label>
          <select id="open-in" value={prefs.openIn} onChange={(e) => onPrefs({ ...prefs, openIn: e.target.value as OpenIn })}>
            <option value="app">der Spotify-App (Desktop/Handy) – kein neuer Browser-Tab</option>
            <option value="browser">einem neuen Browser-Tab (Spotify-Webplayer)</option>
          </select>
          <span className="muted small">
            Beim ersten Mal fragt der Browser, ob er Spotify öffnen darf – „Immer erlauben“ anhaken, dann klappt es künftig
            ohne Nachfrage. Dass Spotify dabei in den Vordergrund kommt, kann eine Web-App nicht verhindern.
          </span>
        </div>
        <div className="field">
          <label htmlFor="search-provider">Suchlink für Songs ohne eigenen Link</label>
          <select
            id="search-provider"
            value={prefs.searchProvider}
            onChange={(e) => onPrefs({ ...prefs, searchProvider: e.target.value as SearchProvider })}
          >
            <option value="spotify">Spotify-Websuche (open.spotify.com)</option>
            <option value="youtube">YouTube-Suche</option>
            <option value="none">Keinen Suchlink anzeigen</option>
          </select>
        </div>
      </section>

      <AlbumDateNote />

      <GitHubSettings />

      <section className="panel stack">
        <h2>Was wird wo gespeichert?</h2>
        <ul>
          <li>
            <strong>Nur lokal in diesem Browser</strong> (localStorage): deine Song-Listen inkl. geprüfter Jahre,
            Spielernamen, Einstellungen und ein laufendes Spiel, damit du es fortsetzen kannst.
          </li>
          <li>
            <strong>Nicht gespeichert:</strong> Audiodateien (nur im Arbeitsspeicher des Tabs), Passwörter, Tokens,
            Konten. Es gibt keinen Server, kein Tracking, keine Cookies, keine Werbung.
          </li>
          <li>
            <strong>Nur wenn du „Fest einbauen“ einrichtest:</strong> dein GitHub-Token liegt in diesem Browser; eingebaute
            Listen liegen im Repository und sind Teil der veröffentlichten Seite.
          </li>
          <li>
            Die App lädt keine Inhalte von Drittservern. Ausnahme: Startest du in der Prüfansicht „Jahre online prüfen“,
            werden Interpret und Titel an <strong>musicbrainz.org</strong> gesendet. Externe Seiten öffnen sich nur, wenn du
            einen Link antippst.
          </li>
        </ul>
        <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirmClear(true)}>
          Alle lokalen Daten löschen
        </button>
      </section>

      <section className="panel stack">
        <h2>Als App installieren</h2>
        <ul>
          <li><strong>Android / Chrome / Edge:</strong> Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.</li>
          <li><strong>iPhone / iPad (Safari):</strong> Teilen-Symbol → „Zum Home-Bildschirm“.</li>
          <li><strong>Desktop (Chrome/Edge):</strong> Installations-Symbol in der Adressleiste.</li>
        </ul>
        <p className="muted">Nach dem ersten Laden funktioniert Music Guess auch offline (Links zu Musikdiensten natürlich nicht).</p>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Alle lokalen Daten löschen?"
        message="Alle eigenen Song-Listen, Einstellungen und das laufende Spiel werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen."
        confirmLabel="Alles löschen"
        danger
        onConfirm={() => {
          setConfirmClear(false);
          onClearAll();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
