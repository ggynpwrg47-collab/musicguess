# Tests

## Automatische Tests

```bash
npm test          # Vitest: Jahreszahlen, Import, ID3, Spiel-Engine inkl. Veto-Chips
npm run typecheck # TypeScript
npm run build     # Produktions-Build
```

Abgedeckt sind u. a.: Datumsgenauigkeit (Jahr/Monat/Tag, nie genauer als die Quelle), Remaster-,
Live- und Compilation-Warnungen, widersprüchliche Duplikate, CSV mit Anführungszeichen,
Freitext-Import, Link-Prüfung (nur http/https), ID3v2.3/2.4, richtige und falsche Platzierung,
gleiche Jahre, alle Veto-Regeln (ein Chip pro Position, nicht auf der Position des aktiven Spielers,
keine negativen Chipstände, Rückgabe beim Zurücknehmen, Reset beim Neustart), Bonus-Chip (nur bei richtigem Jahr),
Rundenende, Zielkarten, leerer Stapel und der Jahres-Modus.

## Manuelle Testschritte

### A. Anmeldung / OAuth
Music Guess hat bewusst **keinen** Login (siehe [SPOTIFY.md](SPOTIFY.md)). Zu prüfen:
1. Startseite öffnen: Es gibt kein Login-Formular und keinen „Mit Spotify verbinden“-Knopf, dafür den Hinweis, warum.
2. In den DevTools unter *Netzwerk* prüfen: Beim Spielen gehen keine Anfragen an `api.spotify.com` oder `accounts.spotify.com`.
3. In den DevTools unter *Anwendung → Local Storage*: nur `musicguess.*`-Einträge, keine Tokens.

### B. Playlist- bzw. Listen-Import
1. *Eigene Song-Liste anlegen* → Text einfügen:
   ```
   Queen - Bohemian Rhapsody (1975)
   Queen - Bohemian Rhapsody - 2011 Remaster (2011)
   ABBA - Dancing Queen
   Nena - 99 Luftballons; ca. 1983
   kaputte Zeile
   ```
   Erwartet: 4 Songs, Hinweis „1 Zeile nicht lesbar“; in der Prüfansicht „Widersprüchliche Jahre“, „Remaster“, „Kein Jahr“, „Ungenaue Jahresangabe“.
2. CSV mit Komma und Anführungszeichen importieren:
   ```
   Track Name,Artist Name(s),Album Name,Album Release Date,Release Date Precision,Track URI
   "Song, Teil 1","A;B","Greatest Hits","1999-05-01","month","spotify:track:4u7EnebtmKWzUH433cf5Qv"
   ```
   Erwartet: Interpret „A, B“, Datum „05/1999 · monatsgenau“, Quelle „Album-/Release-Datum“, Compilation-Warnung, Link wird zu `https://open.spotify.com/track/…`.
3. Leere Eingabe: Knopf ist deaktiviert. Datei über 5 MB: verständliche Fehlermeldung.
4. *Eigene Audiodateien*: MP3s mit ID3-Tags wählen; Titel, Interpret und Jahr erscheinen. Dateien ohne Tags: Dateiname `Interpret - Titel (Jahr).mp3` wird gelesen. Seite neu laden: Hinweis „Datei nicht geladen“ und erneute Auswahl funktioniert.

5. *Spotify-Datenexport*: `Playlist1.json` mit zwei Playlists wählen → beide erscheinen mit Songanzahl; Podcast-Folgen und lokale Dateien fehlen; nach „Übernehmen“ haben alle Songs einen Spotify-Link und stehen unter „Ohne Jahr“. Eine beliebige andere JSON-Datei ergibt eine verständliche Fehlermeldung.

7. *Export & eingebaute Listen*: Liste → „Exportieren (für alle Geräte)“ lädt `name.musicguess.json`. Diese Datei unter „CSV-/Textdatei“ wieder importieren → identische Liste. Datei nach `src/decks/` kopieren, `npm run build && npm run preview`, in einem privaten Fenster öffnen → Liste erscheint als „Fest eingebaut“, ist schreibgeschützt, lässt sich spielen und kopieren.

8. *Fest einbauen*: Ohne Token → Dialog „Einmalig GitHub verbinden“. Unter Info & Datenschutz Repository, Branch und einen Fine-grained Token (nur dieses Repo, Contents: Read and write) eintragen → „Speichern & Verbindung testen“ meldet „Verbunden mit …“. Falscher Token → „ungültig oder abgelaufen“. In einer Liste „📌 Fest einbauen“ → Bestätigung zeigt `src/decks/<name>.musicguess.json` → „Gespeichert ✓“ mit Link zum Commit; auf GitHub liegt die Datei. Nach dem Netlify-Build auf dem Handy neu laden → Liste „Fest eingebaut“; am PC ist die lokale Liste ausgeblendet. „Aus der App entfernen“ löscht die Datei wieder.

### C. Jahreszahlen
1. In der Prüfansicht ein Jahr ändern und Enter drücken: Der Song gilt als geprüft, die Quelle wird „manuell eingetragen“.
2. „Angezeigte bestätigen“ bestätigt nur die gefilterten Songs mit Jahr.
3. Song ohne Jahr: „Jahr geprüft“ ist deaktiviert, der Song wird beim Spiel nicht verwendet.
4. Ungültige Jahre (z. B. 3000 oder 1200) werden als „kein Jahr“ behandelt.
5. Beim Aufdecken eines ungeprüften oder gewarnten Songs erscheint „⚠ Jahr unsicher“ samt Genauigkeit.

6. *Jahre online prüfen*: Liste mit `Queen - Bohemian Rhapsody - Remastered 2011 (2011)`, `Toto - Africa` (ohne Jahr) und einem erfundenen Song → „Alle prüfen“. Erwartet: Fortschrittsbalken, danach Vorschlag „1975 übernehmen / 2011 behalten“, Africa erhält 1982 („online ergänzt“), der erfundene Song „nicht gefunden“. „Abbrechen“ stoppt sofort. Offline (DevTools → Offline): verständliche Fehlermeldung statt Absturz.

### D. Spielablauf
1. Beispiel-Deck → *Spielen* → 3 Teams, Zeitleiste, 2 Runden, 2 Veto-Chips. Die Regeln sind beim ersten Mal aufgeklappt.
2. Während des Ratens sind nirgends Titel, Interpret oder Jahr zu sehen (auch nicht beim Überfahren des Abspiel-Knopfs).
3. Lücke wählen → *Position bestätigen* → *Wahl ändern* geht zurück (solange kein Veto liegt).
4. Team 2: *Veto einlegen* → Lücke wählen → Bestätigungsdialog zeigt „Chips: 2 → 1“ → *Abbrechen* verbraucht nichts.
5. Veto setzen. Team 3 kann dieselbe Lücke nicht wählen, die Lücke des aktiven Teams ist nicht wählbar, *Wahl ändern* ist verschwunden.
6. *Zurücknehmen* gibt den Chip zurück. Ein Team mit 0 Chips sieht „Keine Chips“ (deaktiviert).
7. *Lösung zeigen*: Ergebnis, richtige Lücke(n) markiert; bei erfolgreichem Veto wandert die Karte in die Zeitleiste des Veto-Teams (unter *Alle Zeitleisten ansehen* prüfen). Die Punkte stimmen.
8. Bonus-Chip: Richtig eingeordnet → Frage „Auch Titel und Interpret erraten?“, „Nächster Zug“ ist bis zur Antwort gesperrt; „Ja“ erhöht die Chips sofort um 1. Falsch eingeordnet oder Karte per Veto verloren → keine Frage.
8a. Während des Ratens steht auf der verdeckten Karte ein QR-Code (Handy-Kamera öffnet den Song); nach „Lösung zeigen“ verschwindet er und Jahr, Titel, Interpret erscheinen. Bei eigenen Audiodateien steht dort weiter „?“.
9. *Neu starten*: Punkte 0, je 1 Startkarte, Chips wieder auf Startwert. *Beenden* → Ergebnis mit Rangliste.
10. Jahres-Modus: ±1/±10 und Eingabefeld funktionieren; Veto mit gleichem Jahr wird abgelehnt; ein näheres Veto übernimmt die Punkte.
11. Spotify-Song mit Link: „In der Spotify-App öffnen“ öffnet die Desktop-App (beim ersten Mal Browser-Nachfrage), **kein** neuer Tab. „Im Browser öffnen“ öffnet den Webplayer. Unter *Info & Datenschutz* auf „Browser-Tab“ umstellen → Knopf öffnet wieder einen Tab.
12. Seite mitten im Zug neu laden: *Spiel fortsetzen* stellt den exakten Stand inkl. Chips und Vetos wieder her.

### E. Mobile Ansicht und Bedienbarkeit
1. DevTools → Gerätemodus (z. B. 390×844) oder ein echtes Handy: kein horizontales Scrollen, Zeitleiste vertikal, Aktionsknöpfe unten erreichbar.
2. Hell- und Dunkelmodus des Systems umschalten: Kontraste bleiben gut lesbar.
3. Nur mit Tastatur (Tab, Enter, Leertaste, Escape) ein ganzes Spiel spielen; der Fokusrahmen ist immer sichtbar, Dialoge schließen mit Escape.
4. Systemeinstellung „Bewegung reduzieren“: keine Animationen.
5. PWA: `npm run build && npm run preview`, im Chrome installieren und offline neu starten (DevTools → Network → Offline): Die App lädt.
