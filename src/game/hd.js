// The HD art (assets/art/hd/, made by the Drawing Friend). Three manifests say where each frame is:
//   characters/manifest.json  boxers (teal, orange, green, purple, zeus, boss) and the sumo
//   world/manifest.json       the six place backgrounds (whole scenes, ring included)
//   effects/manifest.json     rocket gloves, elemental effects, stars, dust, aura, Zeus's sky bolt
//   ui/manifest.json          the title logo (index.html shows it straight) and the wheel's rim and hub
// The reader below is forgiving about the exact shape (see assets/art/hd/integration.json for the full
// contract). Each frame comes back as a canvas at full native size with its game size and anchor (sprite.js).
import { cutFrame } from './sprite.js';

const HD = new URL('../../assets/art/hd/', import.meta.url);

// ---------- small readers for the different ways a manifest can say things ----------
const first = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined) return o[k]; return undefined; };
function point(p) {
  if (!p) return null;
  if (Array.isArray(p)) return [Number(p[0]), Number(p[1])];
  if (typeof p === 'object' && 'x' in p) return [Number(p.x), Number(p.y)];
  return null;
}
function rect(r) {
  if (Array.isArray(r)) return { x: r[0], y: r[1], w: r[2], h: r[3] };
  const x = first(r, 'x', 'left') ?? 0, y = first(r, 'y', 'top') ?? 0;
  const w = first(r, 'w', 'width'), h = first(r, 'h', 'height');
  return w && h ? { x, y, w, h } : null;
}
// "hit-wobble" -> "hit", "idle2" / "idle-2" / "idle_2" -> "idle", "sittingWave" -> "sit".
// "recovery" stays its own pose: for a boxer it is the arm-out frame as the rocket glove clicks back on,
// for the sumo it is him standing up off the loser (sumo-finish.js), never the sitting wave.
const ALIAS = { 'hit-wobble': 'hit', hurt: 'hit', wobble: 'hit', crouch: 'duck', block: 'guard', win: 'victory', ko: 'hit',
  falling: 'fall', descending: 'fall', 'belly-flop': 'flop', bellyflop: 'flop', squash: 'flop', landing: 'flop',
  sitting: 'sit', wave: 'sit', 'sitting-waving': 'sit', 'sitting-wave': 'sit', sittingwave: 'sit',
  'special-punch': 'superpunch', 'special-launch': 'superpunch', 'super-punch': 'superpunch', launch: 'punch' };
function poseName(n) {
  const s = String(n).toLowerCase().replace(/[_\s]+/g, '-');
  if (ALIAS[s]) return ALIAS[s];
  const base = s.replace(/-?\d+$/, '');
  return ALIAS[base] || base;
}

const images = new Map();
function loadImage(url) {
  const key = String(url);
  if (!images.has(key)) {
    images.set(key, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { console.warn(`hd art missing: ${key}`); resolve(null); };
      img.src = key;
    }));
  }
  return images.get(key);
}
async function fetchJson(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Native pixels per game pixel for an entry: given straight out, or worked out from its game height.
function pxOf(o, nativeH, fallback) {
  const px = first(o, 'pxPerUnit', 'pxPerGamePixel', 'pixelsPerGamePixel', 'scale', 'px');
  if (px) return Number(px);
  const gh = first(o, 'logicalHeight', 'gameHeight', 'lh');
  if (gh && nativeH) return nativeH / Number(gh);
  const sz = first(o, 'logicalSize', 'gameSize');
  if (sz && nativeH) return nativeH / Number(Array.isArray(sz) ? sz[1] : sz.h ?? sz.height);
  return fallback;
}

// Every frame list in an entry, as { pose: [ {img, rect, anchor, px, extra} ] }.
async function frameList(entry, base, defaults) {
  const sheetName = first(entry, 'image', 'sheet', 'file', 'src', 'path');
  const sheet = sheetName ? await loadImage(new URL(sheetName, base)) : null;
  let groups = first(entry, 'frames', 'poses', 'animations', 'anims');
  // array of named frames -> group them by pose
  if (Array.isArray(groups) && groups.length && (groups[0].name || groups[0].pose || groups[0].id)) {
    const g = {};
    for (const f of groups) (g[poseName(f.pose || f.name || f.id)] ||= []).push(f);
    groups = g;
  } else if (Array.isArray(groups)) groups = { frames: groups };
  const out = {};
  for (const [name, list] of Object.entries(groups || {})) {
    const arr = Array.isArray(list) ? list : Array.isArray(list?.frames) ? list.frames : [list];
    const pose = poseName(name);
    for (const f of arr) {
      const r = rect(f.rect || f.frame || f.box || f);
      if (!r) continue;
      const img = f.image || f.file ? await loadImage(new URL(f.image || f.file, base)) : sheet;
      if (!img) continue;
      // anchors are measured from the frame's own top-left, unless the manifest says "anchorSpace": "sheet"
      let anchor = point(first(f, 'anchor', 'foot', 'feet', 'pivot', 'origin')) || defaults.anchor;
      if (anchor && (f.anchorSpace || entry.anchorSpace) === 'sheet') anchor = [anchor[0] - r.x, anchor[1] - r.y];
      (out[pose] ||= []).push({
        img, r, anchor,
        px: pxOf(f, r.h, null),
        lsize: first(f, 'logicalSize', 'gameSize'),
        tip: point(first(f, 'tip', 'front')),
        fps: list?.fps ?? entry.fps,
      });
    }
  }
  return out;
}

function toFrames(list, px) {
  return (list || []).map((f) => {
    let p = f.px || px;
    if (!p && f.lsize) p = f.r.h / Number(Array.isArray(f.lsize) ? f.lsize[1] : f.lsize.h ?? f.lsize.height);
    const fr = cutFrame(f.img, f.r.x, f.r.y, f.r.w, f.r.h, p || 1, f.anchor);
    if (f.tip) fr.tip = [f.tip[0] / (p || 1), f.tip[1] / (p || 1)];
    fr.fps = f.fps;
    fr.hd = true;
    return fr;
  });
}

// ---------- characters ----------
const CHAR_IDS = ['teal', 'orange', 'green', 'purple', 'zeus', 'boss', 'sumo'];
const BOXER_HEIGHT = 72;   // game pixels a standing boxer's frame is tall when the manifest gives no scale

async function readCharacters() {
  const url = new URL('characters/manifest.json', HD);
  const m = await fetchJson(url);
  if (!m) return null;
  const root = first(m, 'characters', 'boxers') || m;
  const entries = Array.isArray(root) ? Object.fromEntries(root.map((c) => [c.id || c.name, c])) : root;
  const out = {};
  for (const [rawId, entry] of Object.entries(entries)) {
    if (!entry || typeof entry !== 'object') continue;
    const id = String(rawId).toLowerCase().replace(/^boxer-/, '').replace(/-boxer$/, '').replace(/^kang$/, 'boss');
    if (!CHAR_IDS.includes(id)) continue;
    const base = new URL('characters/', HD);
    const groups = await frameList(entry, base, { anchor: point(first(entry, 'anchor', 'foot', 'feet', 'pivot')) });
    const any = groups.idle?.[0] || Object.values(groups)[0]?.[0];
    if (!any) continue;
    const ls = first(entry, 'logicalSize', 'gameSize');
    const gameH = ls ? Number(Array.isArray(ls) ? ls[1] : ls.h ?? ls.height) : Number(first(entry, 'logicalHeight', 'gameHeight') || BOXER_HEIGHT);
    const px = Number(first(entry, 'pxPerUnit', 'pxPerGamePixel', 'pixelsPerGamePixel', 'scale') || 0) || any.r.h / gameH;
    const poses = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, toFrames(v, px)]));
    // art drawn facing left is turned round later (roster.js keeps every boxer facing right)
    const facing = String(first(entry, 'facing', 'faces', 'direction') || 'right').toLowerCase().startsWith('l') ? -1 : 1;
    const c = { id, px, facing, poses, fps: entry.fps };
    const portrait = first(entry, 'portrait', 'head', 'face');
    if (portrait) {
      const pg = await frameList({ ...portrait, frames: { portrait: [portrait] } }, base, { anchor: null });
      if (!pg.portrait && sheetOf(entry)) Object.assign(pg, await frameList({ image: sheetOf(entry), frames: { portrait: [portrait] } }, base, { anchor: null }));
      c.portrait = toFrames(pg.portrait, px)[0];
    }
    const glove = first(entry, 'glove', 'rocketGlove', 'fist');
    if (glove) {
      const gg = await frameList(sheetOf(glove) ? glove : { ...glove, image: sheetOf(entry) }, base, { anchor: point(first(glove, 'anchor', 'tip')) });
      c.glove = toFrames(Object.values(gg).flat(), pxOf(glove, null, px));
    }
    out[id] = c;
  }
  return out;
}
const sheetOf = (e) => first(e, 'image', 'sheet', 'file', 'src', 'path');

// ---------- atlases: effects and world ----------
// { frames: { name: { image, rect: [x, y, w, h] (source pixels), drawSize: [w, h] and anchor: [x, y] (game pixels) } },
//   animations: { name: { frames: [frame names], fps, loop } } }
// Returns { name: [frame, ...] }: every animation, and every single frame as a one-frame list.
async function readAtlas(m, base) {
  const out = {};
  const frames = {};
  await Promise.all(Object.entries(m.frames || {}).map(async ([name, f]) => {
    const img = await loadImage(new URL(f.image || f.file, base));
    const r = rect(f.rect || f);
    if (!img || !r) return;
    const size = f.drawSize || f.logicalSize || [r.w, r.h];
    const fr = cutFrame(img, r.x, r.y, r.w, r.h, r.w / size[0]);
    const anchor = point(f.anchor) || [size[0] / 2, size[1] / 2];
    Object.assign(fr, { lw: size[0], lh: size[1], ax: anchor[0], ay: anchor[1], hd: true, name });
    frames[name] = fr;
    out[name] = [fr];
  }));
  for (const [name, a] of Object.entries(m.animations || {})) {
    const list = (a.frames || []).map((n) => frames[n]).filter(Boolean);
    if (!list.length) continue;
    list.fps = a.fps || 12;
    list.loop = a.loop !== false;
    out[name] = list;
  }
  return out;
}

async function readEffects() {
  const m = await fetchJson(new URL('effects/manifest.json', HD));
  return m ? readAtlas(m, new URL('effects/', HD)) : null;
}

// ---------- world ----------
export const PLACE_IDS = ['arena', 'apartment', 'jungle', 'volcano', 'space', 'cliffside'];
async function readWorld() {
  const m = await fetchJson(new URL('world/manifest.json', HD));
  if (!m) return null;
  const atlas = await readAtlas(m, new URL('world/', HD));
  const out = {};
  for (const id of PLACE_IDS) if (atlas[id]) out[id] = { img: atlas[id][0], floorY: m.floorBaseline, ringBaked: m.ringBaked !== false };
  return out;
}

// ---------- ui (ui/manifest.json: the title logo and the wheel's rim and hub) ----------
async function readUI() {
  const m = await fetchJson(new URL('ui/manifest.json', HD));
  return m ? readAtlas(m, new URL('ui/', HD)) : null;
}

// Everything HD that exists: { characters, effects, world, ui } (each may be empty).
export async function loadHD() {
  const [characters, effects, world, ui] = await Promise.all([readCharacters(), readEffects(), readWorld(), readUI()]);
  return { characters: characters || {}, effects: effects || {}, world: world || {}, ui: ui || {} };
}
