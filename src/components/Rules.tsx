import type { GameSettings } from '../types';

export function Rules({ settings }: { settings: GameSettings }) {
  const timeline = settings.mode === 'timeline';
  return (
    <div className="rules stack">
      <h3>Ablauf eines Zuges</h3>
      <ol>
        <li>Der aktive Spieler (bzw. das Team) spielt den Song ab. Titel, Interpret und Jahr bleiben verborgen.</li>
        {timeline ? (
          <li>
            Er legt die verdeckte Karte in eine Lücke seiner <strong>eigenen Zeitleiste</strong> – älter links/oben, neuer
            rechts/unten – und bestätigt.
          </li>
        ) : (
          <li>Er schätzt das Erscheinungsjahr und bestätigt.</li>
        )}
        {settings.vetoEnabled && <li>Jetzt dürfen die anderen ein Veto einlegen (siehe unten).</li>}
        <li>Lösung aufdecken. {timeline ? 'Richtig eingeordnet = Karte bleibt liegen und zählt 1 Punkt.' : 'Punkte: exakt 3, ±1 Jahr 2, ±2–3 Jahre 1.'}</li>
        {settings.vetoEnabled && (
          <li>
            <strong>Bonus-Chip:</strong> Wer {timeline ? 'richtig eingeordnet' : 'das Jahr exakt getroffen'} hat, wird nach dem
            Aufdecken gefragt, ob er auch Titel und Interpret richtig genannt hat. Bei „Ja“ gibt es einen Veto-Chip dazu. Die
            Mitspieler entscheiden fair mit.
          </li>
        )}
      </ol>
      {timeline && <p>Jeder startet mit einer aufgedeckten Karte. Gleiche Jahre dürfen links oder rechts liegen.</p>}
      {settings.vetoEnabled && (
        <>
          <h3>Veto-Chips</h3>
          <ul>
            <li>Jeder startet mit {settings.vetoStartChips} Veto-Chip{settings.vetoStartChips === 1 ? '' : 's'}.</li>
            <li>
              Nachdem der aktive Spieler bestätigt hat und <strong>bevor aufgedeckt wird</strong>, darf jeder andere Spieler
              einen Chip setzen – {timeline ? 'auf eine andere Lücke in der Zeitleiste des aktiven Spielers' : 'mit einer anderen Jahreszahl'}.
            </li>
            <li>
              Pro {timeline ? 'Position' : 'Jahreszahl'} liegt höchstens ein Chip, nie dort, wo der aktive Spieler{' '}
              {timeline ? 'die Karte eingeordnet hat' : 'getippt hat'}. Pro Zug setzt jeder höchstens einen Chip.
            </li>
            <li>
              {timeline
                ? 'Liegt der aktive Spieler falsch und ein Veto-Chip richtig, bekommt der Veto-Spieler die Karte und ordnet sie in seine eigene Zeitleiste ein (+1 Punkt). Liegen mehrere richtig, gewinnt der zuerst gesetzte Chip.'
                : 'Ist eine Veto-Schätzung näher dran als die des aktiven Spielers (und mindestens 1 Punkt wert), bekommt der Veto-Spieler seine Punkte und der aktive Spieler geht leer aus.'}
            </li>
            <li>Ein gesetzter Chip ist verbraucht – egal ob das Veto erfolgreich war. Vor dem Aufdecken kann er zurückgenommen werden.</li>
            <li>Nach dem ersten Veto kann der aktive Spieler seine Wahl nicht mehr ändern.</li>
          </ul>
        </>
      )}
      <h3>Spielende</h3>
      <p>
        Nach {settings.rounds} Runde{settings.rounds === 1 ? '' : 'n'}
        {timeline && settings.targetCards > 0 ? `, sobald jemand ${settings.targetCards} Karten in der Zeitleiste hat,` : ''} oder
        wenn keine Songs mehr übrig sind. Es gewinnt, wer die meisten Punkte hat.
      </p>
    </div>
  );
}
