import type { Deck, Song } from '../types';

/**
 * Kleines Beispiel-Deck zum Ausprobieren. Enthält nur Fakten (Interpret, Titel, Jahr der
 * Erstveröffentlichung als Single bzw. auf dem Originalalbum) – keine Audiodaten, keine Cover.
 * Die Jahre wurden sorgfältig gewählt, sollten aber wie jede Quelle kritisch geprüft werden.
 */
const RAW: [string, string, number][] = [
  ['Elvis Presley', 'Heartbreak Hotel', 1956],
  ['Chuck Berry', 'Johnny B. Goode', 1958],
  ['Ben E. King', 'Stand by Me', 1961],
  ['The Beatles', 'I Want to Hold Your Hand', 1963],
  ['The Rolling Stones', "(I Can't Get No) Satisfaction", 1965],
  ['The Beach Boys', 'Good Vibrations', 1966],
  ['Aretha Franklin', 'Respect', 1967],
  ['The Doors', 'Light My Fire', 1967],
  ['Marvin Gaye', "What's Going On", 1971],
  ['Led Zeppelin', 'Stairway to Heaven', 1971],
  ['Queen', 'Bohemian Rhapsody', 1975],
  ['ABBA', 'Dancing Queen', 1976],
  ['David Bowie', '"Heroes"', 1977],
  ['Bee Gees', "Stayin' Alive", 1977],
  ['Kraftwerk', 'Das Model', 1978],
  ['Village People', 'Y.M.C.A.', 1978],
  ['Gloria Gaynor', 'I Will Survive', 1978],
  ['Pink Floyd', 'Another Brick in the Wall, Part 2', 1979],
  ['Toto', 'Africa', 1982],
  ['Survivor', 'Eye of the Tiger', 1982],
  ['Nena', '99 Luftballons', 1983],
  ['Eurythmics', 'Sweet Dreams (Are Made of This)', 1983],
  ['Prince', 'Purple Rain', 1984],
  ['Tina Turner', "What's Love Got to Do with It", 1984],
  ['Bruce Springsteen', 'Born in the U.S.A.', 1984],
  ['Falco', 'Rock Me Amadeus', 1985],
  ['Europe', 'The Final Countdown', 1986],
  ['Bon Jovi', "Livin' on a Prayer", 1986],
  ['Michael Jackson', 'Bad', 1987],
  ['Madonna', 'Like a Prayer', 1989],
  ['R.E.M.', 'Losing My Religion', 1991],
  ['Nirvana', 'Smells Like Teen Spirit', 1991],
  ['Whitney Houston', 'I Will Always Love You', 1992],
  ['Haddaway', 'What Is Love', 1993],
  ['Oasis', 'Wonderwall', 1995],
  ['Spice Girls', 'Wannabe', 1996],
  ['Robbie Williams', 'Angels', 1997],
  ['Cher', 'Believe', 1998],
  ['Britney Spears', '...Baby One More Time', 1998],
  ['Backstreet Boys', 'I Want It That Way', 1999],
  ['Eminem', 'Lose Yourself', 2002],
  ['Beyoncé', 'Crazy in Love', 2003],
  ['OutKast', 'Hey Ya!', 2003],
  ['Amy Winehouse', 'Rehab', 2006],
  ['Shakira', "Hips Don't Lie", 2006],
  ['Rihanna', 'Umbrella', 2007],
  ['Coldplay', 'Viva la Vida', 2008],
  ['Lady Gaga', 'Poker Face', 2008],
  ['Adele', 'Rolling in the Deep', 2010],
  ['Gotye', 'Somebody That I Used to Know', 2011],
  ['PSY', 'Gangnam Style', 2012],
  ['Daft Punk', 'Get Lucky', 2013],
  ['Avicii', 'Wake Me Up', 2013],
  ['Pharrell Williams', 'Happy', 2013],
  ['Taylor Swift', 'Shake It Off', 2014],
  ['Mark Ronson feat. Bruno Mars', 'Uptown Funk', 2014],
  ['Ed Sheeran', 'Shape of You', 2017],
  ['Luis Fonsi feat. Daddy Yankee', 'Despacito', 2017],
  ['Billie Eilish', 'bad guy', 2019],
  ['The Weeknd', 'Blinding Lights', 2019],
  ['Dua Lipa', 'Levitating', 2020],
  ['Harry Styles', 'As It Was', 2022],
];

export const DEMO_DECK_ID = 'demo';

export function createDemoDeck(): Deck {
  const songs: Song[] = RAW.map(([artist, title, year], i) => ({
    id: `demo_${i}`,
    artist,
    title,
    year,
    date: String(year),
    precision: 'year',
    yearSource: 'demo',
    warnings: [],
    confirmed: true,
  }));
  return { id: DEMO_DECK_ID, name: 'Beispiel-Deck: Hits aus 7 Jahrzehnten', kind: 'demo', songs, createdAt: 0, updatedAt: 0 };
}
