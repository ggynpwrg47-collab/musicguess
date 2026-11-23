# Spotify: geprüfte Einschränkungen und Entscheidung

Stand der Prüfung: Oktober 2026. Die Spotify-Entwicklerseiten (`developer.spotify.com`) waren aus der
Build-Umgebung nicht direkt abrufbar. Die folgenden Punkte stützen sich auf Spotifys Changelog und
Migrationsleitfaden (über Suchergebnisse und Zitate), die Spotify-Community und Issues großer
Open-Source-Bibliotheken. **Bitte vor einer Veröffentlichung selbst auf den verlinkten Originalseiten
gegenprüfen.**

## 1. Developer Policy: Spiele und Quizze sind verboten

Die [Spotify Developer Policy](https://developer.spotify.com/policy) führt unter *„Some Prohibited
Applications“* aus: **„Do not create a game, including trivia quizzes.“** Früher waren Ausnahmen mit
schriftlicher Genehmigung möglich, in der aktuellen Fassung steht diese Option laut Community-Berichten
nicht mehr. Für Trivia-Apps wird laut Entwicklerberichten auch kein Extended-Quota-Zugang gewährt.

Ein Jahreszahlen-Musikquiz mit Spotify-Login, Playlist-Abruf über die Web-API und Wiedergabe über das
Web Playback SDK wäre genau so eine Anwendung.

**Folge:** Music Guess verwendet **keine** Spotify-Schnittstelle: kein OAuth, keine Web-API, kein Web
Playback SDK, keine Embeds, keine Cover und keine Spotify-Logos. Das ist die „nächstbeste regelkonforme
Alternative“ aus der Aufgabenstellung.

## 2. Web-API-Änderungen vom Februar 2026 (Development Mode)

Laut Spotify-Changelog und [Migrationsleitfaden](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide):

- **Playlist-Inhalte** (`items`) werden nur noch für Playlists geliefert, die der angemeldete Nutzer
  **besitzt oder bei denen er mitwirkt**. Bei anderen Playlists kommen nur Metadaten, das Feld `items`
  fehlt. Eine „beliebige Playlist per Link“ lässt sich also nicht zuverlässig auslesen.
- `GET /playlists/{id}/tracks` wurde durch `GET /playlists/{id}/items` ersetzt; im Playlist-Objekt heißt
  `tracks` jetzt `items` und `track` jetzt `item`.
- Entfernt wurden unter anderem `GET /users/{id}/playlists`, Mehrfachabfragen wie `GET /tracks` und
  `GET /albums` sowie Felder wie `popularity`, `available_markets` und `label`. (`external_ids` wurde
  laut Berichten im März 2026 wieder eingeführt.)
- Neue Development-Mode-Apps: 1 Client-ID pro Entwickler und **höchstens 5 Nutzer**. Der App-Besitzer
  braucht **Spotify Premium**, sonst antwortet die API mit 403.
- Das Suchlimit wurde auf 10 Ergebnisse pro Anfrage gesenkt.
- Extended Quota (mehr Nutzer) gibt es laut Berichten nur für Organisationen mit großer Reichweite.

## 3. Wiedergabe

- Das Web Playback SDK und die Player-Endpunkte (Wiedergabe steuern, Gerät wechseln) setzen
  **Spotify Premium** voraus.
- 30-Sekunden-`preview_url`s stehen neuen Apps seit November 2024 nicht mehr zur Verfügung.

## 4. Was Music Guess stattdessen tut

| Bedarf | Lösung in Music Guess | Status |
|---|---|---|
| Songs auswählen | Beispiel-Deck, eingefügte Text-/CSV-Listen (auch Exporte mit Spalten wie `Track Name`, `Artist Name(s)`, `Album Release Date`, `Release Date Precision`) oder eigene Audiodateien | zuverlässig |
| Ohne Spoiler abspielen | Eigene Audiodateien werden im Browser abgespielt, ohne Titel anzuzeigen | zuverlässig |
| Über einen Musikdienst abspielen | Normaler Link (z. B. `open.spotify.com/track/…`) oder Websuche öffnet die App des Dienstes; QR-Code für ein zweites Gerät | funktioniert, aber die Dienst-App zeigt den Titel (Gerät verdeckt hinlegen oder „DJ“) |
| Wiedergabe steuern (Play/Pause) | Nur bei eigenen Audiodateien; bei Links in der jeweiligen App | abhängig vom Dienst bzw. Konto |
| Erscheinungsjahr | Jahr/Datum aus der Liste bzw. aus ID3-Tags, mit Genauigkeit, Warnungen und Prüfansicht | zuverlässig, inhaltlich so gut wie die Quelle |

Ein normaler Hyperlink auf eine öffentliche Spotify-Seite ist keine Nutzung der Spotify-Developer-Plattform
(keine API, kein SDK, keine Client-ID). Ob Spotify beim Öffnen eines Links Premium verlangt oder Werbung
einblendet, entscheidet allein Spotify. Wer ganz sichergehen will, stellt unter *Info & Datenschutz* den
Suchlink auf YouTube um oder nutzt eigene Audiodateien. Das ist eine technische Einschätzung, keine
Rechtsberatung.

## 5. Falls Spotify die Regeln eines Tages ändert

Falls Spotify Spiele künftig erlaubt, wäre eine regelkonforme Integration so aufgebaut:

- **OAuth:** Authorization Code mit **PKCE**, nur Client-ID im Frontend, **kein Client-Secret**.
  Weiterleitung zu `accounts.spotify.com`, nie ein eigenes Login-Formular.
- **Minimale Scopes:** `playlist-read-private` (eigene private Playlists), `playlist-read-collaborative`.
  Für das Web Playback SDK zusätzlich `streaming` und `user-read-private`/`user-read-email`, wie vom
  SDK verlangt. Für die Steuerung eines anderen Geräts `user-modify-playback-state` und
  `user-read-playback-state`.
- **Redirect-URIs:** Spotify akzeptiert seit 2025 kein `localhost` mehr. Lokal also
  `http://127.0.0.1:5173/callback` (Loopback-IP), gehostet nur `https://…/callback`, jeweils exakt so
  im Dashboard eingetragen.
- **Tokens:** Access-Token nur im Arbeitsspeicher, Refresh-Token höchstens in `sessionStorage`. Abmelden
  löscht beides. Bei 401 erneuern, bei 429 (`Retry-After`, `QUOTA_EXCEEDED`) zurückhaltend wiederholen.
- **Metadaten:** keine dauerhafte Speicherung von Spotify-Inhalten über das hinaus, was die Developer
  Terms erlauben. Cover nur unverändert mit Spotify-Attribution und Link zurück zu Spotify.

Weil dieser Code nach heutiger Policy nicht genutzt werden dürfte, ist er bewusst **nicht** enthalten.
Die Architektur (Song-Listen als Datenquelle, unabhängige Spiel-Engine) erlaubt eine spätere Ergänzung.

## Quellen

- [Spotify Developer Policy](https://developer.spotify.com/policy)
- [Web API Changelog – February 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- [February 2026 Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Spotify Community: Clarification regarding „Do not create a game, including trivia quizzes“](https://community.spotify.com/t5/Spotify-for-Developers/Clarification-regarding-Do-not-create-a-game-including-trivia/td-p/7508005)
- [Spotify Community: Extended Quota Mode Request (Trivia-App abgelehnt)](https://community.spotify.com/t5/Spotify-for-Developers/Extended-Quota-Mode-Request-Independent-Developer-TrackLine/td-p/7384615)
- [rspotify Issue #550: Spotify Web API changes (February 2026)](https://github.com/ramsayleung/rspotify/issues/550)
- [blind-test PR #74: Anpassung an die API-Änderungen 2026](https://github.com/laurentChin/blind-test/pull/74)
