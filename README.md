# Music Guess – Musik-Zeitleisten-Quiz (PWA)

Ein freundliches Musik-Quiz für Gruppen: Ein Song läuft, niemand sieht Titel oder Jahr, und alle raten,
wo er in ihre persönliche Zeitleiste gehört. Dazu gibt es einen einfachen Modus „Jahr raten“,
1–10 Spieler oder Teams, Veto-Chips mit Bonus-Chip, zufällige Reihenfolge und eine einstellbare
Rundenzahl. Music Guess ist eigenständig gestaltet, nutzt keine fremden Karten, Logos oder Inhalte und
ist eine installierbare Progressive Web App ohne Konto, Werbung oder Abo.

> **Wichtig – Spotify:** Die [Spotify Developer Policy](https://developer.spotify.com/policy) verbietet
> Apps, die Spotify-Schnittstellen für **Spiele einschließlich Trivia-Quizze** nutzen. Außerdem liefert
> die Web-API seit Februar 2026 Playlist-Inhalte nur noch für **eigene oder kollaborative** Playlists.
> Music Guess verwendet deshalb **keinen Spotify-Login, keine Web-API und kein Web Playback SDK**.
> Stattdessen: eigene Song-Listen (auch als CSV-Export), eigene Audiodateien oder normale Links bzw.
> Websuchen, die eure Musik-App öffnen. Details, Quellen und eine Beschreibung, wie eine Integration
> aussähe, falls Spotify die Regeln ändert: [docs/SPOTIFY.md](docs/SPOTIFY.md).

---

## Inhalt

1. [Funktionen und was davon abhängt](#funktionen)
2. [Architektur und Tech-Stack](#architektur)
3. [Lokal installieren und starten](#1-lokal-installieren-und-starten)
4. [Im lokalen Browser testen](#2-im-lokalen-browser-testen)
5. [Online über HTTPS bereitstellen](#3-online-über-https-bereitstellen)
6. [Spotify-Dashboard, Redirect-URLs und Umgebungsvariablen](#4-spotify-dashboard-redirect-urls-und-umgebungsvariablen)
7. [Spätere Veröffentlichung als native App](#5-spätere-veröffentlichung-als-native-app)
8. [Song-Listen und Jahreszahlen](#song-listen-und-jahreszahlen) · [Listen auf allen Geräten](#listen-auf-allen-geräten-nutzen)
9. [Spielregeln inklusive Veto-Chips](#spielregeln)
10. [Datenspeicherung und Sicherheit](#datenspeicherung-und-sicherheit)
11. [Fehlerbehebung](#fehlerbehebung)

---

## Funktionen

| Funktion | Zuverlässig? | Abhängig von |
|---|---|---|
| Zeitleisten-Modus und „Jahr raten“, 1–10 Spieler/Teams, Runden, Zielkarten, Zufall | ✅ ja | – |
| Veto-Chips (ein-/ausschaltbar, Startanzahl einstellbar) und Bonus-Chip für erratenen Titel + Interpret | ✅ ja | – |
| Beispiel-Deck mit 62 Hits (1956–2022) | ✅ ja | – |
| Eigene Listen per Text, CSV oder TSV (u. a. mit Spalten aus gängigen Playlist-Exporten) | ✅ ja | Qualität der Daten |
| Eigene Spotify-Playlists aus dem offiziellen Spotify-Datenexport (JSON) einlesen | ✅ ja | Export muss bei Spotify angefordert werden; enthält keine Jahre |
| Jahres-Prüfung: Genauigkeit, Warnungen bei Remaster/Live/Compilation/Duplikaten, Korrektur | ✅ ja | – |
| Jahre online prüfen (MusicBrainz: früheste Veröffentlichung der Aufnahme, Vorschläge bei Abweichung) | ⚠️ meistens | Internet; Song muss in MusicBrainz erfasst sein; Datenqualität der Datenbank |
| Spotify-Songs direkt in der Spotify-App öffnen (ohne neuen Browser-Tab) | ✅ ja | installierte Spotify-App; Browser fragt beim ersten Mal nach |
| Eigene Audiodateien abspielen, ohne Titel zu verraten | ✅ ja | Dateiformat muss der Browser unterstützen (MP3/AAC überall) |
| Song über Link/Suche in Spotify, YouTube o. Ä. öffnen | ⚠️ teilweise | Konto und Abo beim Dienst; die Dienst-App zeigt den Titel an |
| QR-Code direkt auf der verdeckten Karte, um auf einem zweiten Gerät abzuspielen | ✅ ja | Kamera-App auf dem zweiten Gerät |
| Installation als App, offline spielbar | ✅ ja | Browser mit PWA-Unterstützung; Links brauchen Internet |
| Spotify-Login, Playlist-Auswahl aus dem Konto, Wiedergabe-Steuerung | ❌ nein | durch die Spotify-Policy ausgeschlossen |

## Architektur

- **Reine Frontend-App (statische Dateien)**, kein eigener Server, kein Backend, keine Datenbank.
  Das ist die einfachste sichere Variante für Einsteiger: Ohne Server gibt es keine Secrets, keine
  Tokens und nichts, was angegriffen werden könnte.
- **Tech-Stack:** [Vite](https://vite.dev) + React 19 + TypeScript, [Vitest](https://vitest.dev) für Tests,
  `qrcode` für QR-Codes. Service Worker und Manifest sind handgeschrieben (keine Build-Magie).
- **Spiel-Engine** (`src/lib/game.ts`): ein reiner Reducer ohne UI-Abhängigkeiten, vollständig getestet.
  Alle Aktionen (Raten, Bestätigen, Veto, Zurücknehmen, Aufdecken, Bonusfrage, Weiter, Neustart,
  Beenden) prüfen ihre Regeln selbst, sodass auch eine fehlerhafte Bedienung keinen ungültigen Zustand
  erzeugen kann.

```
src/
  App.tsx                 Ansichten, Zustand, Speicherung
  types.ts                Datenmodell
  lib/game.ts             Spielregeln und Veto-Chips (Reducer)
  lib/years.ts            Datum/Genauigkeit, Warnungen, Duplikate
  lib/importer.ts         Text-/CSV-Import, Dateinamen
  lib/id3.ts              MP3-Tags lesen (inkl. Original-Datum TDOR/TORY)
  lib/links.ts            Link-Prüfung, Suchlinks
  lib/storage.ts          localStorage (nur lokal)
  lib/demoDeck.ts         Beispiel-Deck
  components/             Startseite, Import, Prüfansicht, Setup, Spiel, Ergebnis, Dialoge …
public/                   Manifest, Service Worker, Icons, Sicherheits-Header
docs/                     Spotify-Analyse, Testplan, Sicherheitsprüfung
```

---

## 1. Lokal installieren und starten

**Voraussetzungen:** [Node.js](https://nodejs.org) ab Version 20 (empfohlen: 22 LTS) und Git.

```bash
git clone <URL-dieses-Repositorys> musicguess
cd musicguess
npm install
npm run dev
```

Dann im Browser **http://127.0.0.1:5173** öffnen. Änderungen am Code werden sofort neu geladen.
Eine `.env`-Datei ist nicht nötig. Nur wenn du in einem Unterordner hosten willst, kopierst du
`.env.example` nach `.env.local` und passt `VITE_BASE_PATH` an.

## 2. Im lokalen Browser testen

```bash
npm test            # automatische Tests
npm run build       # Produktions-Build nach dist/
npm run preview     # Build lokal ausliefern: http://127.0.0.1:4173
```

- Der **Service Worker** (Offline-Modus, Installation) ist nur im Build aktiv, also mit `npm run preview` testen.
- **Handy-Ansicht:** In den Chrome-DevTools (F12) den Gerätemodus einschalten (Strg+Shift+M).
- **Auf dem echten Handy im WLAN:** `npm run dev -- --host` bzw. `npm run preview -- --host` und die
  angezeigte Netzwerk-Adresse öffnen. Ohne HTTPS funktionieren Spielen und Audiodateien; die
  Installation als App und der Offline-Modus brauchen aber HTTPS (siehe Abschnitt 3).
- Eine ausführliche Checkliste steht in [docs/TESTING.md](docs/TESTING.md).

## 3. Online über HTTPS bereitstellen

Music Guess besteht nur aus statischen Dateien (`dist/`), daher eignet sich jeder kostenlose Static-Hoster.
Alle folgenden Anbieter liefern automatisch **HTTPS**, was für die PWA-Installation nötig ist.

**Netlify (empfohlen, am einfachsten, kostenlos)**
1. Auf [netlify.com](https://www.netlify.com) mit dem GitHub-Konto anmelden.
2. **„Add new site → Import an existing project → GitHub“** wählen und das Repository auswählen. Bei der ersten Verbindung
   fragt GitHub, auf welche Repositorys Netlify zugreifen darf; nur dieses eine freigeben reicht.
3. Unter **„Branch to deploy“** den Branch mit der App wählen (z. B. `main`).
4. Build-Einstellungen nicht ändern. Sie kommen automatisch aus `netlify.toml` (`npm run build`, Ordner `dist`, Node 22).
5. **„Deploy“** klicken. Nach etwa einer Minute steht die Seite unter `https://<zufallsname>.netlify.app`.
6. Optional unter **Site configuration → Change site name** einen eigenen Namen wählen. Ein schwer zu erratender Name
   (z. B. `musicguess-k7q2`) ist besser als `musicguess`.
7. Jeder neue Push auf den Branch wird automatisch veröffentlicht.

Sicherheits-Header aus `public/_headers` werden automatisch übernommen.

**Wer kann die Seite sehen?**
- Jeder, der die Adresse kennt. Sie ist aber nirgends verlinkt und für Suchmaschinen gesperrt: `noindex` steht als
  Meta-Tag in `index.html` und als `X-Robots-Tag`-Header in `public/_headers`.
- Deine Song-Listen, Spielstände und Einstellungen liegen **nicht** auf Netlify, sondern nur im Browser des jeweiligen
  Geräts. Wer die Adresse kennt, sieht nur die leere App mit dem Beispiel-Deck.
- Ein echter Passwortschutz ist bei Netlify kostenpflichtig. Kostenlos geht das mit Cloudflare Pages und
  [Cloudflare Access](https://www.cloudflare.com/zero-trust/products/access/): erlaubte E-Mail-Adressen eintragen, Zugang
  per Einmal-Code.

**Cloudflare Pages:** gleiche Einstellungen (Framework „Vite“, Ausgabe `dist`); `_headers` wird ebenfalls unterstützt.

**Vercel:** „Import Project“, Framework „Vite“; die Header kommen aus `vercel.json`.

**GitHub Pages** (Adresse: `https://<benutzer>.github.io/<repo-name>/`):
1. Einmalig: Repository → *Settings* → *Pages* → *Build and deployment* → Source **„GitHub Actions“**.
2. Der Workflow **„Deploy to GitHub Pages“** (`.github/workflows/pages.yml`) läuft danach bei jedem Push auf
   `main` automatisch, also auch wenn du eine Liste mit „📌 Fest einbauen“ speicherst. Den ersten Lauf
   startest du unter *Actions* → „Deploy to GitHub Pages“ → *Run workflow* (Branch `main`).
3. Der Workflow setzt `VITE_BASE_PATH=/<repo-name>/` sowie Repository und Branch für „Fest einbauen“.

Gut zu wissen:
- GitHub Pages erlaubt keine eigenen HTTP-Header, `_headers` wird ignoriert. Die Content-Security-Policy wird
  deshalb beim Build zusätzlich als `<meta>`-Tag eingebaut (ohne `frame-ancestors`, das geht nur als Header).
  `noindex` steht ebenfalls als Meta-Tag in der Seite.
- Die Seite ist öffentlich erreichbar, wer die Adresse kennt (auch bei privatem Repository).
- Bei einem privaten Repository braucht GitHub Pages einen kostenpflichtigen Plan (z. B. GitHub Pro).

Danach die HTTPS-Adresse auf dem Handy öffnen und „Zum Startbildschirm hinzufügen“ wählen:
- **Android/Chrome:** Menü ⋮ → „App installieren“
- **iPhone/iPad (Safari):** Teilen → „Zum Home-Bildschirm“
- **Desktop Chrome/Edge:** Installieren-Symbol in der Adressleiste

## 4. Spotify-Dashboard, Redirect-URLs und Umgebungsvariablen

**Für Music Guess ist kein Spotify-Developer-Dashboard nötig.** Es gibt keine Client-ID, kein Client-Secret
und keine Redirect-URL, weil die App aus den oben genannten Policy-Gründen keine Spotify-Schnittstelle
verwendet. **Lege bitte auch keine Spotify-App für Music Guess an.**

Umgebungsvariablen (`.env.example`):

| Variable | Zweck | Standard |
|---|---|---|
| `VITE_BASE_PATH` | Unterordner beim Hosting (z. B. `/musicguess/`) | `/` |

Alle `VITE_`-Variablen landen im öffentlichen JavaScript. Dort niemals Secrets eintragen. `.env` und
`.env.local` sind per `.gitignore` vom Repository ausgeschlossen.

Falls Spotify Spiele künftig erlaubt, beschreibt [docs/SPOTIFY.md](docs/SPOTIFY.md#5-falls-spotify-die-regeln-eines-tages-ändert)
die korrekte Einrichtung: Authorization Code mit PKCE ohne Secret, minimale Scopes, Redirect-URIs
`http://127.0.0.1:5173/callback` (lokal, nicht `localhost`) und `https://<deine-domain>/callback`.

## 5. Spätere Veröffentlichung als native App

1. **Android (am einfachsten):** Die PWA mit [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
   oder [PWABuilder](https://www.pwabuilder.com) als *Trusted Web Activity* verpacken. Dafür brauchst du
   die HTTPS-Adresse, `/.well-known/assetlinks.json` auf der Domain, einen Signierschlüssel und ein
   Google-Play-Entwicklerkonto (einmalige Gebühr).
2. **iOS und Android mit eigenem Code:** Mit [Capacitor](https://capacitorjs.com) das `dist/`-Verzeichnis
   in eine native Hülle einbetten (`npx cap add ios/android`). Für iOS sind ein Mac mit Xcode und eine
   Apple-Developer-Mitgliedschaft (jährliche Gebühr) nötig. Für Audiodateien aus dem Dateisystem
   empfiehlt sich ein Datei-Plugin.
3. **Store-Anforderungen:** Datenschutzerklärung (es werden keine Daten erhoben), App-Icons und
   Screenshots, Altersfreigabe. Apple verlangt, dass eine App mehr bietet als eine verpackte Website
   (Guideline 4.2). Offline-Modus und lokale Audiodateien helfen dabei.
4. **Marken:** Keine fremden Marken im Namen, Icon oder in den Screenshots verwenden. Musikdienste nur
   textlich als Link-Ziel nennen. Eine native Spotify-Integration (iOS/Android SDK) unterliegt derselben
   Developer Policy und ist für Spiele ebenfalls nicht erlaubt.

---

## Song-Listen und Jahreszahlen

**Formate beim Import:**
- **Eigene Spotify-Playlists über den offiziellen Datenexport:** Im Spotify-Konto unter *Datenschutzeinstellungen →
  „Deine Daten herunterladen“* die Kontodaten anfordern. Danach die Datei `Playlist1.json` (bzw. `YourLibrary.json` für die
  Lieblingssongs) im Reiter *Spotify-Datenexport* wählen und die gewünschten Playlists ankreuzen. Titel, Interpret, Album
  und Spotify-Link werden übernommen. **Jahre enthält der Export nicht**; die werden in der Prüfansicht ergänzt. Das
  Dateiformat ist von Spotify nicht öffentlich dokumentiert, darum akzeptiert der Import mehrere übliche Feldnamen.
- **CSV aus einem Export-Tool** (z. B. Exportify): enthält zusätzlich das Album-Datum und spart so Tipparbeit.
- Freitext, eine Zeile pro Song: `Interpret - Titel (Jahr)`, `Interpret – Titel; Jahr` und optional ein Link
  (`https://…` oder `spotify:track:…`, wird zu einem normalen Web-Link). `#` leitet einen Kommentar ein.
- CSV/TSV mit Kopfzeile (Trennzeichen Komma, Semikolon oder Tab). Erkannt werden z. B. `Titel/Title/Track Name`,
  `Interpret/Artist/Artist Name(s)`, `Jahr/Year`, `Release Date` + `Release Date Precision`, `Album`, `Link/URL/Track URI`.
- Eigene Audiodateien: ID3v2-Tags (`TDOR`/`TORY` = Original-Veröffentlichung, `TDRC`/`TYER` = Jahr der Datei)
  oder der Dateiname `Interpret - Titel (Jahr).mp3`.

**Umgang mit Jahreszahlen:**
- Die **Genauigkeit** der Quelle bleibt erhalten: `1985` wird als „nur Jahr bekannt“ angezeigt,
  `1985-03` als „03/1985“. Eine Angabe wie `release_date_precision = year` verringert die Genauigkeit;
  aus einem Jahr wird nie ein Tagesdatum.
- **Album-/Release-Daten gelten nie automatisch als Erstveröffentlichung.** Sie werden als „Album-/Release-Datum –
  evtl. Neuauflage“ markiert und müssen bestätigt werden.
- **Warnungen** erscheinen bei Remaster, Live, Remix/Edit, Neuaufnahme („Taylor's Version“), Deluxe-/Jubiläumsausgaben,
  Compilations („Greatest Hits“, „Best of“ …), unscharfen Angaben (`ca. 1975`, `1975/76`, `1975?`), Datei-Tags ohne
  Original-Datum, Duplikaten und widersprüchlichen Jahren.
- **Online prüfen:** In der Prüfansicht unter *Jahre online prüfen* sucht Music Guess in der offenen Datenbank
  [MusicBrainz](https://musicbrainz.org) nach der frühesten Veröffentlichung einer Aufnahme mit gleichem Titel und
  Interpreten. Zusätze wie „- Remastered 2011“, „(Live …)“ oder „(feat. …)“ werden vorher entfernt. Ergebnis:
  ✓ bestätigt, fehlendes Jahr ergänzt, oder bei Abweichung ein Vorschlag („1975 übernehmen“ / „2011 behalten“, auch
  „Alle Vorschläge übernehmen“). Es werden nur Interpret und Titel gesendet, mit höchstens 1 Anfrage pro Sekunde
  (Vorgabe von MusicBrainz). Die Prüfung startet nur auf Knopfdruck.
- In der **Prüfansicht** korrigiert oder bestätigt man die Jahre; ein von Hand eingetragenes Jahr gilt als geprüft.
  Songs ohne Jahr werden nicht gespielt. Beim Aufdecken ungeprüfter oder gewarnter Songs erscheint „⚠ Jahr unsicher“.

## Listen auf allen Geräten nutzen

Importierte Listen werden im **Browser des jeweiligen Geräts** gespeichert (`localStorage`). Was du am PC importierst,
ist am Handy deshalb zunächst nicht da. Es gibt bewusst keinen Server und kein Konto, das Listen abgleicht.

**Am einfachsten: per Klick fest einbauen**
1. Einmalig unter *Info & Datenschutz → Listen fest einbauen (GitHub)* einen GitHub-Token einrichten. Die Anleitung steht
   dort. Kurz: Bei GitHub einen **Fine-grained personal access token** erstellen, mit Zugriff **nur auf dieses Repository**
   und nur **Contents: Read and write**, z. B. 90 Tage gültig. Repository und Branch sind auf Netlify automatisch vorausgefüllt.
2. In einer Liste auf **„📌 Fest einbauen (alle Geräte)“** klicken und bestätigen. Music Guess speichert die Liste als
   `src/decks/<name>.musicguess.json` im Repository.
3. Netlify baut automatisch neu. Nach 1–2 Minuten ist die Liste auf allen Geräten da. Auf dem PC wird die lokale Liste dann
   automatisch ausgeblendet, damit sie nicht doppelt erscheint.
4. Spätere Änderungen: Liste bearbeiten → **„📌 Änderungen fest einbauen“**. Bei eingebauten Listen: „Als eigene Liste
   kopieren“, bearbeiten, „Änderungen fest einbauen“ (ersetzt das Original). Entfernen: in der eingebauten Liste
   **„Aus der App entfernen“**.

Der Token liegt nur im Browser dieses Geräts (nicht im Code, nicht auf Netlify) und wird nur an `api.github.com` gesendet.
Richte ihn nur auf deinem eigenen Gerät ein und entferne ihn dort, wenn du ihn nicht mehr brauchst.

**Alternativ von Hand**
1. Am PC die Liste importieren, die Jahre prüfen (gern mit „Jahre online prüfen“).
2. In der Liste auf **„⤓ Exportieren (für alle Geräte)“** klicken. Es wird eine Datei wie `roadtrip-mix.musicguess.json` gespeichert.
3. Die Datei in den Ordner **`src/decks/`** im Repository legen. Am einfachsten auf GitHub im Browser: Ordner `src/decks`
   öffnen → **„Add file → Upload files“** → Datei hineinziehen → **„Commit changes“**. Lokal: Datei kopieren, dann
   `git add src/decks && git commit -m "Liste hinzugefügt" && git push`.
4. Netlify baut die Seite automatisch neu. Nach etwa einer Minute steht die Liste auf **jedem Gerät** unter „Song-Listen“
   mit der Markierung **„Fest eingebaut“**, am Handy ganz ohne Import.

Eingebaute Listen sind schreibgeschützt. Zum Ändern: „Als eigene Liste kopieren“, bearbeiten, erneut exportieren und die
Datei in `src/decks/` ersetzen. Zum Entfernen die Datei löschen.

**Gut zu wissen:** Eingebaute Listen sind Teil der veröffentlichten Seite. Wer die Adresse kennt, kann sie sehen (Titel,
Interpret, Jahr, Links – keine Musik, keine Kontodaten). Ohne Einbauen geht es auch direkt: Die exportierte Datei aufs
Handy schicken und dort unter „Eigene Song-Liste anlegen → CSV-/Textdatei“ öffnen. Sie liegt dann nur auf diesem Handy.

## Spielregeln

- **Zeitleiste:** Jeder startet mit einer aufgedeckten Karte. Der aktive Spieler ordnet den unbekannten Song in eine
  Lücke seiner Zeitleiste ein und bestätigt. Richtig = Karte bleibt liegen, +1 Punkt. Gleiche Jahre dürfen links
  oder rechts liegen.
- **Jahr raten:** Jahr schätzen; exakt 3 Punkte, ±1 Jahr 2 Punkte, ±2–3 Jahre 1 Punkt.
- **Veto-Chips:** Nach dem Bestätigen und vor dem Aufdecken darf jeder andere Spieler einen Chip setzen (ein Veto pro
  Spieler und Zug), und zwar auf eine andere Lücke in der Zeitleiste des aktiven Spielers bzw. auf ein anderes Jahr.
  Auf jeder Position liegt höchstens ein Chip, nie auf der Position des aktiven Spielers. Vor dem Einsatz erscheint ein
  Bestätigungsdialog mit dem Chipstand. Liegt der aktive Spieler falsch und ein Veto richtig, ordnet der Veto-Spieler
  die Karte in **seine eigene** Zeitleiste ein (+1 Punkt; bei mehreren richtigen Chips gewinnt der zuerst gesetzte).
  Im Jahres-Modus übernimmt die nähere Veto-Schätzung die Punkte. Ein gesetzter Chip ist verbraucht. Vor dem Aufdecken
  kann er zurückgenommen werden. Nach dem ersten Veto ist die Wahl des aktiven
  Spielers gesperrt. Beim Neustart werden alle Chips auf den Startwert zurückgesetzt.
- **Bonus-Chip:** Hat der aktive Spieler das Jahr selbst richtig (Zeitleiste: richtig eingeordnet; Jahres-Modus: exaktes
  Jahr), fragt die App nach dem Aufdecken: „Auch Titel und Interpret erraten?“ – „Ja“ gibt einen Veto-Chip. Bei falschem
  Jahr oder wenn ein Veto-Spieler die Karte gewinnt, kommt keine Frage. „Nächster Zug“ geht erst nach der Antwort.
- **Spielende:** nach der eingestellten Rundenzahl, beim Erreichen der Zielkarten oder wenn der Stapel leer ist.

## Datenspeicherung und Sicherheit

- **Lokal im Browser** (`localStorage`): eigene Song-Listen, Einstellungen, Spielernamen und ein laufendes Spiel.
- **In der App selbst:** nur Listen, die du bewusst in `src/decks/` ablegst (siehe „Listen auf allen Geräten nutzen“).
- **Nicht gespeichert:** Audiodateien (nur im Arbeitsspeicher), Passwörter, Tokens, Konten. Es gibt keinen Server,
  kein Tracking und keine Cookies.
- **Einzige Verbindung zu einem fremden Dienst:** die optionale Online-Prüfung der Jahre (Interpret + Titel an musicbrainz.org).
- Unter *Info & Datenschutz → Alle lokalen Daten löschen* lässt sich alles entfernen.
- Die Ergebnisse der Sicherheitsprüfung (Secrets, Tokens, Scopes, Redirects, CSP, Links) stehen in [docs/SECURITY.md](docs/SECURITY.md).

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| `npm install` schlägt fehl | Node-Version prüfen (`node -v`, mindestens 20). `node_modules` löschen und neu installieren. |
| Port 5173 ist belegt | `npm run dev -- --port 5180` |
| Handy erreicht den Dev-Server nicht | `npm run dev -- --host`, Firewall freigeben, beide Geräte im selben WLAN |
| „App installieren“ erscheint nicht | Nur über HTTPS (oder `127.0.0.1`) und im Build (`npm run preview` bzw. gehostet). Auf iOS nur in Safari über „Teilen“. |
| Nach einem Update ist die alte Version zu sehen | Seite schließen und neu öffnen (der Service Worker aktualisiert sich beim nächsten Start) oder in den DevTools unter *Application → Service Workers* auf „Update“ klicken. |
| Audiodatei spielt nicht | Format prüfen (MP3/AAC funktionieren überall; FLAC/OGG nicht in jedem Safari). Nach dem Neuladen Dateien erneut auswählen. |
| Song-Link öffnet die falsche Version | In der Prüfansicht einen direkten Link zur Originalversion eintragen. |
| Jahre wirken falsch | Prüfansicht → Filter „Zu prüfen“. Album- und Remaster-Daten korrigieren. |
| Klick auf „In der Spotify-App öffnen“ bewirkt nichts | Spotify-Desktop-App installiert? Beim ersten Mal die Browser-Nachfrage „Spotify öffnen?“ bestätigen. Sonst den Link „Im Browser öffnen“ nutzen oder unter *Info & Datenschutz* auf „Browser-Tab“ umstellen. |
| Spotify öffnet den Song, spielt ihn aber nicht ab (der alte Song läuft weiter) | Neuere Spotify-Apps öffnen bei Links oft nur die Songseite. Music Guess hängt deshalb eine Startposition an (`spotify:track:…#0:01`), damit die Wiedergabe sofort beginnt. Das ist ein von Nutzern gemeldeter, nicht offiziell dokumentierter Weg. Klappt er in deiner Spotify-Version nicht, in Spotify einmal auf Play drücken. Eine zuverlässige Steuerung ginge nur über Spotifys Wiedergabe-Schnittstelle, die für Spiele nicht erlaubt ist. |
| Spotify kommt beim Abspielen in den Vordergrund und zeigt den Titel | Lässt sich aus einer Web-App nicht verhindern. Mit Alt+Tab (Mac: ⌘+Tab) zurück, oder die Musik per QR-Code auf einem Handy abspielen, das verdeckt liegt. |
| Online-Prüfung meldet nur Fehler | Internetverbindung prüfen; manche Werbeblocker oder Firmennetze sperren musicbrainz.org. Bei Überlastung später erneut versuchen. |
| Spotify verlangt beim Öffnen eines Links ein Login/Abo | Das entscheidet Spotify. Alternativ unter *Info & Datenschutz* die YouTube-Suche wählen oder eigene Audiodateien nutzen. |
| Daten sind weg | Privates Fenster oder gelöschte Browserdaten leeren `localStorage`. Song-Listen am besten auch als Text/CSV aufbewahren. |
| Seite bleibt auf GitHub Pages leer | Ist `VITE_BASE_PATH` auf `/<repo-name>/` gesetzt? Der mitgelieferte Workflow erledigt das automatisch. |

## Lizenz und Hinweise

Music Guess ist ein unabhängiges Projekt ohne Verbindung zu Spotify oder anderen Marken. Das Beispiel-Deck
enthält nur Fakten (Interpret, Titel, Jahr), keine Audiodaten und keine Cover.
