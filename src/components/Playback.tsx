import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Song } from '../types';
import { linkHostLabel, searchLink, spotifyAppUri, type OpenIn, type SearchProvider } from '../lib/links';
import { useAudioFiles } from './audioFiles';

interface Props {
  song: Song;
  searchProvider: SearchProvider;
  openIn: OpenIn;
  revealed: boolean;
}

export function Playback({ song, searchProvider, openIn, revealed }: Props) {
  if (song.fileName) return <LocalAudio key={song.id} song={song} />;
  return <LinkPlayback key={song.id} song={song} searchProvider={searchProvider} openIn={openIn} revealed={revealed} />;
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Spielt eine lokal ausgewählte Datei ab, ohne Titel/Interpret/Dateinamen anzuzeigen. */
function LocalAudio({ song }: { song: Song }) {
  const audioFiles = useAudioFiles();
  const file = song.fileName ? audioFiles.files.get(song.fileName) : undefined;
  const ref = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    // Neutrale Metadaten, damit Sperrbildschirm/Benachrichtigung nicht den Dateinamen verraten.
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Rätsel-Song', artist: 'Music Guess' });
    }
    return () => ref.current?.pause();
  }, []);

  if (!file) {
    return (
      <div className="playback playback--missing">
        <p>Die Audiodatei für diesen Song ist in diesem Tab nicht geladen.</p>
        <label className="file-drop file-drop--inline">
          <input type="file" multiple accept="audio/*,.mp3,.m4a,.ogg,.opus,.flac,.wav" onChange={(e) => e.target.files && audioFiles.register([...e.target.files])} />
          <span>Audiodateien erneut auswählen …</span>
        </label>
      </div>
    );
  }

  const toggle = async () => {
    const el = ref.current;
    if (!el) return;
    try {
      if (el.paused) await el.play();
      else el.pause();
      setError(null);
    } catch {
      setError('Wiedergabe nicht möglich – dieses Dateiformat wird vom Browser evtl. nicht unterstützt.');
    }
  };

  return (
    <div className="playback">
      {url && (
        <audio
          ref={ref}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => setError('Die Datei konnte nicht gelesen werden.')}
        />
      )}
      <button type="button" className={`play-btn${playing ? ' play-btn--playing' : ''}`} onClick={toggle} aria-label={playing ? 'Pause' : 'Abspielen'}>
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
      <div className="playback__progress">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(time, duration || 0)}
          aria-label="Position im Song"
          aria-valuetext={`${fmt(time)} von ${fmt(duration)}`}
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = +e.target.value;
          }}
        />
        <span className="muted small">
          {fmt(time)} / {fmt(duration)}
        </span>
      </div>
      {error && <p className="warn-text small" role="alert">{error}</p>}
    </div>
  );
}

/** Abspiel-Link eines Songs: eigener Link oder – falls keiner hinterlegt ist – ein Suchlink. */
export function playbackLink(song: Song, searchProvider: SearchProvider): string | undefined {
  return song.fileName ? undefined : song.link ?? searchLink(searchProvider, song.artist, song.title);
}

/** QR-Code mit dem Abspiel-Link – zum Scannen mit einem zweiten Gerät, das die Musik abspielt. */
export function SongQr({ link, size = 220 }: { link: string; size?: number }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setQr(null);
    QRCode.toDataURL(link, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' })
      .then((d) => active && setQr(d))
      .catch(() => active && setQr(null));
    return () => {
      active = false;
    };
  }, [link, size]);
  return (
    <div className="qr" style={{ width: size, height: size }}>
      {qr ? <img src={qr} alt="QR-Code zum Abspielen auf einem zweiten Gerät" width={size} height={size} /> : <span className="qr__loading">QR-Code …</span>}
    </div>
  );
}

function LinkPlayback({ song, searchProvider, openIn, revealed }: Props) {
  const link = playbackLink(song, searchProvider);
  const isSearch = !song.link;

  if (!link) {
    return (
      <div className="playback playback--missing">
        <p>
          Für diesen Song gibt es keinen Link. Spielt ihn in einer beliebigen Musik-App ab – die Spielleitung kann Titel und
          Interpret unter „Spielleitung: Song anzeigen“ nachsehen.
        </p>
      </div>
    );
  }

  const label = linkHostLabel(link);
  const appUri = openIn === 'app' ? spotifyAppUri(song.link, searchProvider, song.artist, song.title) : undefined;
  const openInBrowser = () => window.open(link, '_blank', 'noopener,noreferrer');
  // „spotify:“-Adressen öffnen die installierte Spotify-App direkt, ohne neuen Browser-Tab.
  const openInApp = () => {
    if (appUri) window.location.href = appUri;
  };
  return (
    <div className="playback playback--link">
      <div className="row wrap">
        {/* Button statt <a>, damit der Link (bei Suchlinks inkl. Titel) beim Überfahren nicht in der Statusleiste erscheint. */}
        {appUri ? (
          <button type="button" className="btn btn--primary btn--large" onClick={openInApp}>
            ▶ {isSearch ? 'In der Spotify-App suchen' : 'In der Spotify-App öffnen'}
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--large" onClick={openInBrowser}>
            ▶ {isSearch ? `In ${label} suchen & abspielen` : `In ${label} öffnen`}
            <span className="sr-only"> (öffnet in neuem Fenster)</span>
          </button>
        )}
      </div>
      {appUri && (
        <p className="muted small">
          Spotify kommt dabei in den Vordergrund – mit <kbd>Alt</kbd>+<kbd>Tab</kbd> (Mac: <kbd>⌘</kbd>+<kbd>Tab</kbd>) zurück zum
          Spiel. {isSearch ? 'In Spotify das Original auswählen und abspielen.' : 'Zeigt Spotify nur die Songseite, dort einmal auf Play drücken.'}{' '}
          Nichts passiert?{' '}
          <button type="button" className="link-btn" onClick={openInBrowser}>
            Im Browser öffnen
          </button>
        </p>
      )}
      {!revealed && (
        <p className="muted small">
          Tipp: QR-Code mit einem zweiten Handy scannen und es verdeckt hinlegen – dann sieht niemand den Titel.{' '}
          {isSearch && 'Bei der Suche bitte das Original (nicht Remix/Live) auswählen.'}
        </p>
      )}
    </div>
  );
}
