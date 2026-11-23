import type { Deck } from '../types';
import { deckFromData } from './deckFile';

/**
 * Fest eingebaute Listen: Jede Datei „src/decks/*.musicguess.json“ wird beim Build in die App gepackt
 * und steht dann auf jedem Gerät zur Verfügung (z. B. am Handy über die GitHub-Pages-Adresse).
 */
const files = import.meta.glob<unknown>('../decks/*.json', { eager: true, import: 'default' });

export function loadBuiltinDecks(): Deck[] {
  const decks: Deck[] = [];
  for (const [path, data] of Object.entries(files)) {
    const file = path.split('/').pop()!;
    const fileName = file.replace(/\.json$/, '').replace(/\.(musicguess|jahrgang)$/, '');
    const deck = deckFromData(data, { id: `builtin_${fileName.replace(/[^A-Za-z0-9_-]/g, '_')}`, kind: 'builtin' });
    if (deck) decks.push({ ...deck, createdAt: 0, updatedAt: 0, published: { file, at: 0 } });
    else console.warn(`Eingebaute Liste „${path}“ ist kein gültiges Music-Guess-Format und wurde übersprungen.`);
  }
  return decks.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
