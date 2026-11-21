// 1 PLAYER LEVELS: beat the computer boxer to go to the next level, in a new place. Each level is harder.
// All the numbers to tune are here. Times are in seconds.
//   place      where the fight is (src/game/places.js)
//   foe        the computer boxer (if it's the same as yours, another one steps in)
//   health     the computer's health (yours is always RULES.health and fills up again each level)
//   seconds    round time; when it runs out the sumo lands on you (game over)
//   guardOpen / guardUp   how long its guard stays down / up (up blocks your HEAD punches)
//   attack     null = it doesn't punch; else [min, max] seconds between its rocket fists
//   warn       a "!" flashes over its head this long before it punches (time to duck a HIGH one)
//   high       chance its punch flies HIGH (duck to dodge it); the rest fly LOW
//   special    true = it has a SUPER meter and uses its special when it is full
export const LEVELS = [
  { place: 'arena', foe: 'orange', health: 600, seconds: 75, guardOpen: [1.6, 3.0], guardUp: [0.6, 1.1], attack: null, warn: 0.8, high: 0.5, special: false },
  { place: 'apartment', foe: 'green', health: 800, seconds: 80, guardOpen: [1.4, 2.6], guardUp: [0.8, 1.4], attack: [4.0, 6.0], warn: 0.8, high: 0.5, special: false },
  { place: 'jungle', foe: 'purple', health: 1000, seconds: 90, guardOpen: [1.2, 2.2], guardUp: [1.0, 1.6], attack: [3.2, 5.0], warn: 0.7, high: 0.55, special: true },
  { place: 'volcano', foe: 'teal', health: 1200, seconds: 100, guardOpen: [1.0, 1.9], guardUp: [1.1, 1.9], attack: [2.6, 4.0], warn: 0.6, high: 0.6, special: true },
  { place: 'space', foe: 'boss', health: 1500, seconds: 120, guardOpen: [0.9, 1.6], guardUp: [1.2, 2.1], attack: [2.0, 3.2], warn: 0.55, high: 0.6, special: true },
];

// Who steps in when the level's boxer is the same as yours.
const STAND_INS = ['orange', 'green', 'purple', 'teal'];

// The computer boxer for level n (1..LEVELS.length) when you are `mine`.
export function foeFor(n, mine) {
  const want = LEVELS[n - 1].foe;
  if (want !== mine) return want;
  const others = STAND_INS.filter((id) => id !== mine);
  return others[Math.floor(Math.random() * others.length)];
}
