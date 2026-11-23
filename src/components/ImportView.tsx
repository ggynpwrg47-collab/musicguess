import { useId, useState } from 'react';
import type { Deck, Song } from '../types';
import { createSong, importText, parseFileName } from '../lib/importer';
import { readId3FromFile } from '../lib/id3';
import { markConflicts } from '../lib/years';
import { parseSpotifyDataExport, type ExportPlaylist } from '../lib/spotifyExport';
import { parseDeckFile } from '../lib/deckFile';
import { uid } from '../lib/random';
import { useAudioFiles } from './audioFiles';
import { AlbumDateNote } from './InfoView';

type Tab = 'spotify' | 'text' | 'file' | 'audio';

interface Props {
  onCancel: () => void;
  onImported: (deck: Deck) => void;
}

const EXAMPLE = `Queen - Bohemian Rhapsody (1975)
Nena - 99 Luftballons (1983)
Daft Punk - Get Lucky (2013) https://open.spotify.com/track/...
Amy Winehouse - Rehab; 2006`;

export function ImportView({ onCancel, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('spotify');
  const [exportLists, setExportLists] = useState<ExportPlaylist[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [name, setName] = useState('Meine Song-Liste');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const audio = useAudioFiles();
  const nameId = useId();
  const textId = useId();

  function finish(songs: Song[], kind: Deck['kind'], msgs: string[]) {
    if (songs.length === 0) {
      setMessages(msgs.length ? msgs : ['Keine Songs gefunden.']);
      return;
    }
    const now = Date.now();
    onImported({ id: uid('d'), name: name.trim() || 'Meine Song-Liste', kind, songs, createdAt: now, updatedAt: now });
  }

  async function handleTextFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessages(['Die Datei ist größer als 5 MB. Bitte eine kleinere CSV- oder Textdatei verwenden.']);
      return;
    }
    const content = await file.text();
    if (/\.json$/i.test(file.name) || content.trimStart().startsWith('{') || content.trimStart().startsWith('[')) {
      const own = parseDeckFile(content);
      if (own) {
        onImported(own); // exportierte Music-Guess-Liste, z. B. von einem anderen Gerät
        return;
      }
      const lists = parseSpotifyDataExport(content, file.name);
      if (!lists) {
        setMessages([`„${file.name}“ enthält keine lesbaren Playlists. Erwartet wird z. B. „Playlist1.json“ oder „YourLibrary.json“ aus dem Spotify-Datenexport.`]);
        return;
      }
      setExportLists(lists);
      setPicked(new Set(lists.length === 1 ? [0] : []));
      setTab('spotify');
      setMessages([]);
      return;
    }
    if (name === 'Meine Song-Liste') setName(file.name.replace(/\.[a-z]+$/i, ''));
    setText(content);
    setTab('text');
    setMessages([`„${file.name}“ geladen – prüfe die Vorschau und tippe auf „Liste übernehmen“.`]);
  }

  async function handleAudio(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    const files = [...fileList];
    const count = audio.register(files);
    const songs: Song[] = [];
    let noYear = 0;
    for (const file of files) {
      if (!(file.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(file.name))) continue;
      let tags = null;
      try {
        tags = await readId3FromFile(file);
      } catch {
        tags = null;
      }
      const fromName = parseFileName(file.name);
      const original = tags?.originalDate;
      const song = createSong({
        title: tags?.title || fromName.title || file.name,
        artist: tags?.artist || fromName.artist || 'Unbekannt',
        album: tags?.album,
        rawYear: original ? undefined : tags?.date ? undefined : fromName.year,
        rawDate: original ?? tags?.date,
        fileName: file.name,
        sourceHint: original ? 'tag-original' : tags?.date ? 'tag' : fromName.year ? 'filename' : 'manual',
      });
      if (song.year === null) noYear++;
      songs.push(song);
    }
    setBusy(false);
    const msgs = [`${count} Audiodatei(en) erkannt.`];
    if (noYear) msgs.push(`${noYear} Song(s) ohne Jahr – bitte in der Prüfansicht ergänzen.`);
    finish(markConflicts(songs), 'local-audio', msgs);
  }

  const preview = tab === 'text' && text.trim() ? importText(text) : null;

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <h1 tabIndex={-1}>Song-Liste anlegen</h1>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Abbrechen
        </button>
      </div>

      <div className="field">
        <label htmlFor={nameId}>Name der Liste</label>
        <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>

      <div role="tablist" aria-label="Importart" className="tabs">
        {(
          [
            ['spotify', 'Spotify-Datenexport'],
            ['text', 'Text einfügen'],
            ['file', 'CSV-/Textdatei'],
            ['audio', 'Eigene Audiodateien'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className="tabs__tab"
            onClick={() => {
              setTab(key);
              setMessages([]);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'spotify' && (
        <section id="panel-spotify" role="tabpanel" aria-labelledby="tab-spotify" className="panel stack">
          <p>
            Lies deine eigenen Spotify-Playlists aus der Datei ein, die Spotify dir auf Anfrage zuschickt. Music Guess braucht
            dafür keinen Spotify-Login und ruft keine Spotify-Schnittstelle auf. Die Datei wird nur auf deinem Gerät gelesen.
          </p>
          <ol className="stack">
            <li>
              Melde dich im Browser bei deinem Spotify-Konto an und öffne <strong>Konto → Datenschutzeinstellungen</strong>.
            </li>
            <li>
              Fordere unter <strong>„Deine Daten herunterladen“</strong> die <strong>Kontodaten</strong> an und bestätige die
              E-Mail. Spotify schickt dir den Download meist innerhalb weniger Tage.
            </li>
            <li>
              Entpacke die ZIP-Datei und wähle hier <code>Playlist1.json</code> (deine Playlists) oder{' '}
              <code>YourLibrary.json</code> (Lieblingssongs). Bei vielen Playlists gibt es auch <code>Playlist2.json</code> usw.
            </li>
          </ol>
          <label className="file-drop">
            <input type="file" accept=".json,application/json" onChange={(e) => handleTextFile(e.target.files?.[0])} />
            <span>JSON-Datei aus dem Spotify-Export auswählen …</span>
          </label>
          <p className="muted small">
            Der Export enthält Titel, Interpret, Album und den Spotify-Link jedes Songs, aber <strong>keine Erscheinungsjahre</strong>.
            Die trägst du anschließend in der Prüfansicht ein. Schneller geht es mit einer CSV-Datei aus einem Export-Tool, die
            schon Album-Daten enthält (Reiter „CSV-/Textdatei“).
          </p>

          {exportLists && (
            <fieldset className="stack">
              <legend>Welche Playlists möchtest du übernehmen?</legend>
              {exportLists.map((pl, i) => (
                <label key={`${pl.name}-${i}`} className="check">
                  <input
                    type="checkbox"
                    checked={picked.has(i)}
                    onChange={(e) =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        return next;
                      })
                    }
                  />
                  {pl.name} <span className="muted">({pl.songs.length} {pl.songs.length === 1 ? 'Song' : 'Songs'})</span>
                </label>
              ))}
              <div className="row wrap">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={picked.size === 0}
                  onClick={() => {
                    const chosen = exportLists.filter((_, i) => picked.has(i));
                    if (name === 'Meine Song-Liste' && chosen.length === 1) setName(chosen[0].name);
                    const songs = markConflicts(chosen.flatMap((pl) => pl.songs));
                    const listName = name === 'Meine Song-Liste' ? chosen.map((pl) => pl.name).join(' + ') : name;
                    const now = Date.now();
                    onImported({ id: uid('d'), name: listName.slice(0, 80), kind: 'list', songs, createdAt: now, updatedAt: now });
                  }}
                >
                  {picked.size > 1 ? `${picked.size} Playlists zusammen übernehmen` : 'Playlist übernehmen'}
                </button>
              </div>
            </fieldset>
          )}
        </section>
      )}

      {tab === 'text' && (
        <section id="panel-text" role="tabpanel" aria-labelledby="tab-text" className="panel stack">
          <label htmlFor={textId}>
            Eine Zeile pro Song: <code>Interpret - Titel (Jahr)</code>, optional mit Link. Oder eine CSV-Tabelle mit
            Kopfzeile einfügen.
          </label>
          <textarea id={textId} rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} spellCheck={false} />
          {preview && (
            <p className="muted" aria-live="polite">
              Vorschau: {preview.songs.length} Song(s) erkannt
              {preview.songs.filter((s) => s.year === null).length > 0 &&
                `, davon ${preview.songs.filter((s) => s.year === null).length} ohne Jahr`}
              {preview.skipped > 0 && `, ${preview.skipped} Zeile(n) nicht lesbar`}.
            </p>
          )}
          <div className="row wrap">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!text.trim()}
              onClick={() => {
                const r = importText(text);
                finish(r.songs, 'list', r.messages);
              }}
            >
              Liste übernehmen
            </button>
          </div>
          <details>
            <summary>Unterstützte Spalten für CSV</summary>
            <p>
              Erkannt werden u. a.: <code>Titel/Title/Track Name</code>, <code>Interpret/Artist/Artist Name(s)</code>,{' '}
              <code>Jahr/Year</code>, <code>Release Date</code> mit <code>Release Date Precision</code>,{' '}
              <code>Album</code> und <code>Link/URL/Track URI</code>. Trennzeichen Komma, Semikolon oder Tab.
            </p>
          </details>
        </section>
      )}

      {tab === 'file' && (
        <section id="panel-file" role="tabpanel" aria-labelledby="tab-file" className="panel stack">
          <p>
            Wähle eine CSV- oder Textdatei – oder eine mit „Exportieren“ gespeicherte Music-Guess-Liste (<code>*.musicguess.json</code>).
            Die Datei wird nur lokal gelesen und nicht hochgeladen.
          </p>
          <label className="file-drop">
            <input type="file" accept=".csv,.tsv,.txt,.json,text/csv,text/plain,application/json" onChange={(e) => handleTextFile(e.target.files?.[0])} />
            <span>Datei auswählen …</span>
          </label>
        </section>
      )}

      {tab === 'audio' && (
        <section id="panel-audio" role="tabpanel" aria-labelledby="tab-audio" className="panel stack">
          <p>
            Wähle Musikdateien, die du selbst besitzt (z. B. MP3). Sie werden <strong>nur in diesem Browser-Tab</strong>{' '}
            abgespielt – ohne Upload, ohne Speicherung. So bleibt der Titel beim Raten verborgen. Titel, Interpret und Jahr
            werden aus den Datei-Tags (ID3) oder dem Dateinamen <code>Interpret - Titel (Jahr).mp3</code> gelesen.
          </p>
          <label className="file-drop">
            <input type="file" accept="audio/*,.mp3,.m4a,.ogg,.opus,.flac,.wav" multiple onChange={(e) => handleAudio(e.target.files)} />
            <span>{busy ? 'Lese Dateien …' : 'Audiodateien auswählen …'}</span>
          </label>
          <p className="muted">
            Hinweis: Nach dem Neuladen der Seite müssen die Dateien erneut ausgewählt werden; die Liste mit den geprüften
            Jahren bleibt erhalten.
          </p>
        </section>
      )}

      {messages.length > 0 && (
        <div className="alert" role="status">
          <ul>
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <AlbumDateNote />
    </div>
  );
}
