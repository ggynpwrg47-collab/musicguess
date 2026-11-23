# Sicherheitsprüfung

| Prüfpunkt | Ergebnis |
|---|---|
| **Offengelegte Secrets** | Es gibt keine. Die App braucht weder Client-ID noch Client-Secret oder API-Key. `.env*` steht in `.gitignore` (außer `.env.example`, die nur `VITE_BASE_PATH` enthält). Hinweis: Alles mit dem Präfix `VITE_` landet im öffentlichen JavaScript – dort dürfen nie Secrets stehen. |
| **Token-Speicherung** | Es gibt keine Tokens, Passwörter oder Konten. In `localStorage` liegen nur Song-Listen, Spielernamen, Einstellungen und der Spielstand; unter *Info & Datenschutz* lässt sich alles löschen. |
| **OAuth-Scopes** | Keine, weil es keinen OAuth-Flow gibt (siehe [SPOTIFY.md](SPOTIFY.md); dort steht auch, welche minimalen Scopes nötig wären, falls Spotify die Policy ändert). |
| **Redirect-URLs** | Keine. Es gibt also keine offenen Weiterleitungen und keine Callback-Route. |
| **Externe Links** | Nur `http(s)` wird akzeptiert (`javascript:` u. a. werden verworfen, siehe Tests). Links öffnen mit `noopener,noreferrer` in einem neuen Fenster. |
| **XSS** | React escaped alle Texte; es gibt kein `dangerouslySetInnerHTML`. Importierte Texte werden nie als HTML interpretiert. |
| **Content Security Policy** | `public/_headers` (Netlify/Cloudflare) und `vercel.json` setzen eine strikte CSP (`script-src 'self'`, kein Inline-JS, `frame-ancestors 'none'`, `form-action 'none'`). `connect-src` erlaubt nur die eigene Seite und `https://musicbrainz.org`. Ein Browser-Test mit dieser CSP lief ohne Verstöße. Für GitHub Pages (keine eigenen Header möglich) wird dieselbe Policy beim Build als `<meta http-equiv>` eingefügt (`vite.config.ts`); `frame-ancestors` ist dort technisch nicht verfügbar. |
| **Online-Prüfung** | Nur auf Knopfdruck; gesendet werden ausschließlich Interpret und Titel an musicbrainz.org (keine Kennungen, keine Cookies). Antworten werden nur als Daten ausgewertet (Jahr/Datum, Link zur Aufnahme), nie als HTML. Rate-Limit 1 Anfrage/s wird eingehalten, bei 503 wird kurz gewartet. |
| **GitHub-Token („Fest einbauen“)** | Optional und nur auf Wunsch. Empfohlen und in der App erklärt: Fine-grained Token mit Zugriff nur auf dieses Repository und nur „Contents: Read and write“, mit Ablaufdatum. Gespeichert nur im `localStorage` des eigenen Geräts (Feld vom Typ Passwort, nie im Code, nie in Exporten, nie auf Netlify), gesendet nur an `https://api.github.com` (CSP `connect-src`). Geschrieben wird ausschließlich `src/decks/<name>.musicguess.json`; Dateinamen werden streng geprüft (kein `../`). „Token entfernen“ und „Alle lokalen Daten löschen“ entfernen ihn. Restrisiko: Wer Zugriff auf diesen Browser hat, könnte über den Token Dateien in diesem einen Repository ändern – daher nur auf dem eigenen Gerät einrichten und kurze Laufzeit wählen. |
| **Eingebaute Listen** | Werden beim Einlesen wie fremde Dateien geprüft und bereinigt (Jahre, Links nur http/https, IDs, Längen). Sie sind Teil der veröffentlichten Seite und für alle mit der Adresse sichtbar. |
| **spotify:-Adressen** | Werden nur aus geprüften `open.spotify.com`-Links mit gültiger ID bzw. URL-kodierter Suche gebaut; andere Schemata werden nicht geöffnet. |
| **Dateien** | Text-Importe sind auf 5 MB begrenzt. Audiodateien werden nur als Object-URL im Tab verwendet, nie hochgeladen oder gespeichert. Der ID3-Parser liest höchstens 2 MB und prüft alle Längenangaben gegen die Puffergrenzen. |
| **Service Worker** | Er cacht nur Anfragen an die eigene Herkunft (GET); fremde Anfragen werden nie abgefangen. |
| **Abhängigkeiten** | Laufzeit: nur `react`, `react-dom` und `qrcode`. `npm audit` meldet 0 Schwachstellen (Stand der Erstellung). |
| **Tracking/Werbung** | Keines. |
