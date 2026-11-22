// LANGUAGE: every word the game shows, in Swedish (sv) and English (en). One language shows at a time;
// the 🇸🇪 / 🇬🇧 button on the title screen switches it, and the choice is remembered on this computer.
//   t('fight')                 -> 'KÖR!' or 'FIGHT!'
//   t('levelN', { n: 3 })      -> 'NIVÅ 3' or 'LEVEL 3'   ({n} in a text is filled in)
//   boxerName(b), placeName(p) -> the name in the language now
// In index.html, an element with data-i18n="key" gets its text from here (data-i18n-html for text with tags).
// Keep the big arcade words short and punchy, and the Swedish simple enough for a 9-year-old.

const STORE_KEY = 'rocket-punch-lang';

export const STRINGS = {
  sv: {
    // title screen
    langButton: '🇬🇧 English',
    subtitle: 'Slå mot kameran så flyger handsken!',
    play2: '👯 2 SPELARE',
    play1: '🥊 1 SPELARE',
    sidesMiddle: 'stå bredvid varandra',
    p1Side: '⬅️ P1 TURKOS', p2Side: 'P2 ORANGE ➡️',
    keys1: '⬅️ ➡️ / A D = gå · ⬆️ / W = huvud · SPACE / ⬇️ = kropp · X / ⇧ = ducka · M = ljud av/på',
    keys2: 'P1: W högt · S lågt · X ducka · A D gå  —  P2: ⬆️ högt · ⬇️ lågt · ⇧ Shift / - ducka · ⬅️ ➡️ gå · M = ljud',
    // camera
    allowCamera: 'Tillåt kameran!',
    clickAllow: 'Klicka på <b>Tillåt</b> högst upp i fönstret.',
    skipCamera: '⌨️ Spela med tangenter i stället',
    noCamera: 'Ingen kamera den här gången',
    playKeys: '▶ SPELA MED TANGENTER',
    camDenied: 'Kameran sa nej. Be en vuxen klicka på 📷 i adressfältet.',
    camMissing: 'Vi hittar ingen kamera på den här datorn.',
    camBusy: 'Ett annat program använder kameran. Stäng det och försök igen.',
    camInsecure: 'Kameran fungerar bara på den publicerade spelsidan.',
    camUnsupported: 'Den här webbläsaren kan inte använda kameran.',
    camOther: 'Kameran startade inte.',
    // hints during the fight
    hintCam2: 'Stå i din STÅ-ruta 👯  Slå in i HÖGT / LÅGT-rutorna i mitten 👊  DUCKA för att undvika!',
    hintKeys2: 'P1: W S X · A D    P2: ⬆️ ⬇️ ⇧ · ⬅️ ➡️    X / ⇧ = DUCKA',
    hintCam1: 'Stå i STÅ-rutan 🚶  Slå åt höger in i HUVUD / KROPP-rutorna 👊  DUCKA när du ser "!"',
    hintKeys1: '⬅️ ➡️ gå  ⬆️ / W = HUVUD 👊  SPACE / ⬇️ = KROPP  X / ⇧ = DUCKA',
    // GET READY
    getReady: 'GÖR DIG REDO!',
    readyGo: '✅ Nu kör vi!',
    readyBox2: 'Ställ er i era rutor! ({n}/2) · SPACE = KÖR!',
    readyBox1: 'Ställ dig i rutan! · SPACE = KÖR!',
    // the wheel
    spin: 'SNURRA HJULET!',
    spinHelpCam: '👊 Slå · SPACE · klicka för att snurra!',
    spinHelp: 'SPACE · klicka för att snurra!',
    zeusGot: 'DU FICK DEN SÄLLSYNTA! ({n}%)',
    zeusHelp: '⚡ Åsknävar: 150 skada! ⚡',
    youGot: 'DU FICK: ',
    goOn: 'Klicka · SPACE för att fortsätta',
    // the 2-player place reveal
    placeRoll: '🎲 VAR SKA NI SLÅSS?',
    placeHelp: 'Klicka · SPACE för att fortsätta',
    // pop-up words on the game picture
    levelN: 'NIVÅ {n}', boss: 'BOSS: {name}!', fight: 'KÖR!', time: 'TIDEN UTE!', dodge: 'UNDAN!', boing: 'BOING!',
    pow: 'POW!', bam: 'BAM!', zap: 'ZAP!', whoosh: 'SVISCH!', flomp: 'FLOMP!', duck: 'DUCKA!',
    soundOff: 'LJUD AV', soundOn: 'LJUD PÅ', soundButton: 'Ljud', superReady: 'SUPER REDO!', tangled: 'FAST!', lava: 'LAVA!',
    // the camera's boxes
    stand: 'STÅ', here: 'HÄR', ready: 'REDO!', head: 'HUVUD', body: 'KROPP', high: 'HÖGT', low: 'LÅGT',
    // specials: the name when it fires, and the word over the one it hits
    water: 'VATTENNÄVE!', waterHit: 'SEG!',
    flame: 'ELDNÄVE!', flameHit: 'MEGAHETT!',
    ivy: 'LIANNÄVE!', ivyHit: 'FAST!',
    poison: 'GIFTNÄVE!', poisonHit: 'FÖRGIFTAD!',
    storm: 'ÅSKSTORM!', stormHit: 'STORM!',
    wind: 'VINDSTORM!', windHit: 'BORTBLÅST!',
    // end screens
    winTitle: 'P{n} {name} VANN! ⭐',
    winSub: 'Spelare {n} ({side}) vann!', left: 'vänster', right: 'höger',
    youWin: 'DU VANN! ⭐', youWinSub: 'Vilket raketslag!',
    playAgain: '🔁 SPELA IGEN',
    menu: '🏠 1 / 2 SPELARE',
    tryAgain: '🔁 FÖRSÖK IGEN',
    gameOver: 'GAME OVER',
    atLevel: 'på nivå {n}',
    champion: 'MÄSTARE!',
    championSub: 'Du klarade alla 5 nivåerna!',
    levelTitle: 'NIVÅ {n}!', bossLevelTitle: 'NIVÅ {n}: {name}!',
    theBoss: 'BOSSEN {name}!',
    levelHelp: '👊 Slå · SPACE · klicka = KÖR!',
    // score cards
    you: 'DU', damage: '💥 Skada', hits: '👊 Träffar', headHits: '🙂 Huvud', bodyHits: '👕 Kropp', specials: '⭐ Superslag',
  },
  en: {
    langButton: '🇸🇪 Svenska',
    subtitle: 'Punch at the camera and your glove flies!',
    play2: '👯 2 PLAYERS',
    play1: '🥊 1 PLAYER',
    sidesMiddle: 'stand side by side',
    p1Side: '⬅️ P1 TEAL', p2Side: 'P2 ORANGE ➡️',
    keys1: '⬅️ ➡️ / A D = walk · ⬆️ / W = head · SPACE / ⬇️ = body · X / ⇧ = duck · M = sound on/off',
    keys2: 'P1: W high · S low · X duck · A D walk  —  P2: ⬆️ high · ⬇️ low · ⇧ Shift / - duck · ⬅️ ➡️ walk · M = sound',
    allowCamera: 'Allow the camera!',
    clickAllow: 'Click <b>Allow</b> at the top of the window.',
    skipCamera: '⌨️ Play with keys instead',
    noCamera: 'No camera this time',
    playKeys: '▶ PLAY WITH KEYS',
    camDenied: 'The camera said no. Ask a grown-up to click the 📷 in the address bar.',
    camMissing: 'We can\'t find a camera on this computer.',
    camBusy: 'Another app is using the camera. Close it and try again.',
    camInsecure: 'The camera only works on the published game page.',
    camUnsupported: 'This browser can\'t use the camera.',
    camOther: 'The camera didn\'t start.',
    hintCam2: 'Stand in your STAND box 👯  Punch into the HIGH / LOW boxes in the middle 👊  DUCK to dodge!',
    hintKeys2: 'P1: W S X · A D    P2: ⬆️ ⬇️ ⇧ · ⬅️ ➡️    X / ⇧ = DUCK',
    hintCam1: 'Stand in the STAND box 🚶  Punch right into the HEAD / BODY boxes 👊  DUCK when you see "!"',
    hintKeys1: '⬅️ ➡️ walk  ⬆️ / W = HEAD 👊  SPACE / ⬇️ = BODY  X / ⇧ = DUCK',
    getReady: 'GET READY!',
    readyGo: '✅ Here we go!',
    readyBox2: 'Stand in your boxes! ({n}/2) · SPACE = FIGHT!',
    readyBox1: 'Stand in the box! · SPACE = FIGHT!',
    spin: 'SPIN THE WHEEL!',
    spinHelpCam: '👊 Punch · SPACE · click to spin!',
    spinHelp: 'SPACE · click to spin!',
    zeusGot: 'GOT THE RARE ONE! ({n}%)',
    zeusHelp: '⚡ Thunder fists: 150 damage! ⚡',
    youGot: 'YOU GOT: ',
    goOn: 'Click · SPACE to go on',
    placeRoll: '🎲 WHERE WILL YOU FIGHT?',
    placeHelp: 'Click · SPACE to go on',
    levelN: 'LEVEL {n}', boss: 'BOSS: {name}!', fight: 'FIGHT!', time: 'TIME!', dodge: 'DODGE!', boing: 'BOING!',
    pow: 'POW!', bam: 'BAM!', zap: 'ZAP!', whoosh: 'WHOOSH!', flomp: 'FLOMP!', duck: 'DUCK!',
    soundOff: 'SOUND OFF', soundOn: 'SOUND ON', soundButton: 'Sound', superReady: 'SUPER READY!', tangled: 'TANGLED!', lava: 'LAVA!',
    stand: 'STAND', here: 'HERE', ready: 'READY!', head: 'HEAD', body: 'BODY', high: 'HIGH', low: 'LOW',
    water: 'WATER FIST!', waterHit: 'SLOW!',
    flame: 'FLAME FIST!', flameHit: 'MEGA BURN!',
    ivy: 'IVY FIST!', ivyHit: 'TANGLED!',
    poison: 'POISON FIST!', poisonHit: 'POISONED!',
    storm: 'THUNDER STORM!', stormHit: 'STORM!',
    wind: 'WIND STORM!', windHit: 'BLOWN AWAY!',
    winTitle: 'P{n} {name} WINS! ⭐',
    winSub: 'Player {n} ({side}) wins!', left: 'left', right: 'right',
    youWin: 'YOU WIN! ⭐', youWinSub: 'What a rocket punch!',
    playAgain: '🔁 PLAY AGAIN',
    menu: '🏠 1 / 2 PLAYERS',
    tryAgain: '🔁 TRY AGAIN',
    gameOver: 'GAME OVER',
    atLevel: 'at level {n}',
    champion: 'CHAMPION!',
    championSub: 'You beat all 5 levels!',
    levelTitle: 'LEVEL {n}!', bossLevelTitle: 'LEVEL {n}: {name}!',
    theBoss: 'THE BOSS {name}!',
    levelHelp: '👊 Punch · SPACE · click = FIGHT!',
    you: 'YOU', damage: '💥 Damage', hits: '👊 Hits', headHits: '🙂 Head', bodyHits: '👕 Body', specials: '⭐ Specials',
  },
};

function load() {
  try { const v = localStorage.getItem(STORE_KEY); if (v === 'sv' || v === 'en') return v; } catch { /* no storage: use the default */ }
  return 'en';
}
let lang = load();
const listeners = [];

export const getLang = () => lang;

// The text for key in the language now, with {name} parts filled in from vars.
export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// A boxer's or place's name (roster entries and PLACES have `name` in English and `sv` in Swedish).
export const boxerName = (b) => (lang === 'sv' && b.sv ? b.sv : b.name);
export const placeName = (p) => (lang === 'sv' && p.sv ? p.sv : p.name);

// Fill every data-i18n element on the page.
export function applyPage(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
}

// Switch language, remember it, refill the page, and tell anyone listening (onLangChange).
export function setLang(l) {
  lang = l === 'sv' ? 'sv' : 'en';
  try { localStorage.setItem(STORE_KEY, lang); } catch { /* not remembered, still switches */ }
  applyPage();
  listeners.forEach((fn) => fn(lang));
}
export const toggleLang = () => setLang(lang === 'sv' ? 'en' : 'sv');
export const onLangChange = (fn) => listeners.push(fn);
