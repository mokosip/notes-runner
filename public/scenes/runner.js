import { palette } from '../style.js';
import { classify, mapField } from '../lib/roles.js';
import { buildCourse, newHero, stepHero } from '../lib/planner.js';
import { untilNextOnset } from '../lib/layout.js';
import { HERO_COLORS, HERO_ROWS, renderSprite } from '../sprites/hero.js';
import { inBlast, stepBomb } from '../lib/bomb.js';

const W = 480;
const H = 270;
const GROUND = 200;
const NOW_X = 80;
const DEFAULT_PX_PER_CYCLE = 240;
const LED_CROP = 128; // halves to 64: hero ~8 LEDs tall, a short stretch of course ahead
const DEFAULT_AHEAD = 1;
const DEFAULT_PAST_COLOR = '#ff2a2a';
const KEEP_BEHIND = 1;
const TRACK_TOP = GROUND + 6;
const TRACK_ROW = 8;
const STACK_GAP = 1;
const STACK_ORDER = { hurdle: 0, wall: 1 };
const HIT_MS = 150;
const SHOT_SPEED = 450;
const BURST_MS = 600;
const ERUPT_GRAVITY = 420;
const DEFAULT_TARGET_COLOR = '#ff2a2a';
const DEFAULT_KILL_LEAD = 0.3;
const DEFAULT_AIM_TOLERANCE = 8;
const SHOOTABLE = new Set(['hurdle', 'wall', 'platform', 'coin']);
const BOMBABLE = new Set(['hurdle', 'wall', 'platform', 'coin', 'track']);
const SUPPORT = new Set(['hurdle', 'wall', 'platform']);
const BOMB_GRAVITY = 500;
const BOMB_THROW_VY = -160;
const RING_MS = 300;
const DEFAULT_BOMB_FUSE = 2;
const DEFAULT_BOMB_RADIUS = 28;
const DEFAULT_BOMB_THROW = 240;
const MATCH_EPS = 1 / 128;
const ONSET_EPS = 1 / 256;
const MOTION = { clear: 3, hop: 4, snap: 8, stumbleMs: 400 };
const GRAVITY_PER_PX2 = 1280 / 180 ** 2;
const RECOVER_PER_PX = 600 / 180;
const COIN_CLEAR_PX = 6;
const COIN_LIFT = 4;

const DEFAULTS = {
  hurdle: { height: { from: 'gain', in: [0.5, 1.5], out: [9, 27] } },
  wall: { height: { from: 'gain', in: [0.5, 1.5], out: [18, 42] } },
  platform: { y: { from: ['note', 'n'], in: [-36, 24], out: [14, 90] }, length: 'event' },
  coin: { y: { from: ['note', 'n'], in: [0, 24], out: [10, 24] } },
  bg: { y: { from: ['note', 'n'], in: [-12, 24], out: [105, 175] } },
};

const GLYPHS = {
  dot: ['.....', '.###.', '.###.', '.###.', '.....'],
  tick: ['..#..', '..#..', '..#..', '..#..', '..#..'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  plus: ['..#..', '..#..', '#####', '..#..', '..#..'],
  diamond: ['..#..', '.#.#.', '#...#', '.#.#.', '..#..'],
  ring: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  square: ['#####', '#...#', '#...#', '#...#', '#####'],
  bar: ['.....', '.....', '#####', '.....', '.....'],
};
const GLYPH_NAMES = Object.keys(GLYPHS);

function glyphFor(s, overrides) {
  if (GLYPHS[overrides?.[s]]) return overrides[s];
  let h = 2166136261;
  for (const ch of String(s ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return GLYPH_NAMES[(h >>> 0) % GLYPH_NAMES.length];
}

function drawGlyph(b, name, cx, cy, size = 5) {
  const rows = GLYPHS[name];
  const half = Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rows[Math.floor((y * 5) / size)][Math.floor((x * 5) / size)] === '#') b.fillRect(cx - half + x, cy - half + y, 1, 1);
    }
  }
}

function keyOf(e) {
  return `${e.pat}|${e.on.toFixed(4)}|${e.s ?? ''}|${e.n ?? ''}|${e.note ?? ''}`;
}

function box(b, x, y, w, h, solid) {
  if (solid) return b.fillRect(x, y, w, h);
  b.fillRect(x, y, w, 1);
  b.fillRect(x, y + h - 1, w, 1);
  b.fillRect(x, y, 1, h);
  b.fillRect(x + w - 1, y, 1, h);
}

function spike(b, cx, bottom, width, height, solid) {
  const half = (width - 1) / 2;
  for (let i = 0; i < height; i++) {
    const hw = Math.round((i / Math.max(height - 1, 1)) * half);
    const y = bottom - height + i;
    if (solid || i === height - 1) b.fillRect(cx - hw, y, hw * 2 + 1, 1);
    else {
      b.fillRect(cx - hw, y, 1, 1);
      b.fillRect(cx + hw, y, 1, 1);
    }
  }
}

export const runner = {
  groupChords: false,
  legend: [
    { param: 's / vrole', from: ['vrole', 's'], effect: 'role (runner.config.js)', state: (s) => `${s.obstacles.size} ev` },
    { param: 'onset', from: ['cycle'], effect: 'x position, jump timing' },
    { param: 'gain', from: ['gain'], effect: 'hurdle/wall height' },
    { param: 'note/n', from: ['note', 'n'], effect: 'platform/coin height' },
    { param: 'next onset', effect: 'platform length' },
    { param: 'played', effect: 'outline -> solid' },
    { param: 'passed now', effect: 'red' },
    { param: 'forecast', effect: 'hero plan', state: (s) => s.hero.mode },
  ],
  config: null,
  configFailed: false,
  loading: null,
  obstacles: new Map(),
  trackOrder: [],
  sync: null,
  buf: null,
  bctx: null,
  hero: newHero(0),
  shots: [],
  bursts: [],
  fireQueued: 0,
  bombs: [],
  bombQueued: 0,
  rings: [],

  onKey(key) {
    if (key === ' ') this.fireQueued++;
    if (key === 'b') this.bombQueued++;
  },

  load() {
    this.loading = import(`../runner.config.js?t=${Date.now()}`)
      .then((m) => {
        this.config = m.default;
        this.configFailed = false;
        for (const o of this.obstacles.values()) o.role = classify(o.e, this.config);
      })
      .catch((err) => {
        this.configFailed = true;
        console.warn('runner.config.js failed to load, keeping previous config:', err);
      });
  },

  onReload(file) {
    if (file === 'runner.config.js') this.load();
  },

  cycleAt(now) {
    const s = this.sync;
    return s ? s.cycle + ((now - s.at) / 1000) * s.cps : 0;
  },

  audibleCycle(now) {
    return this.cycleAt(now) + (this.config?.audioLead ?? 0) * (this.sync?.cps ?? 0);
  },

  onForecast(snap, now) {
    if (!this.loading) this.load();
    const predicted = this.cycleAt(now);
    const drift = snap.now - predicted;
    const cycle = this.sync && Math.abs(drift) < 0.1 ? predicted + drift * 0.2 : snap.now;
    this.sync = { cycle, at: now, cps: snap.cps };

    const next = new Map();
    for (const [k, o] of this.obstacles) {
      if (o.on < snap.from && o.on > snap.now - KEEP_BEHIND) next.set(k, o);
    }
    for (const e of snap.events) {
      const k = keyOf(e);
      next.set(k, {
        key: k,
        on: e.on,
        off: e.off,
        e,
        role: this.config ? classify(e, this.config) : 'ignore',
        confirmedAt: this.obstacles.get(k)?.confirmedAt ?? 0,
        shotAt: this.obstacles.get(k)?.shotAt ?? 0,
      });
    }
    this.obstacles = next;
  },

  onEvent(e, now) {
    if (e._id_ === undefined || typeof e.cycle !== 'number') return;
    const pat = String(e._id_);
    for (const o of this.obstacles.values()) {
      if (o.e.pat === pat && o.e.s === e.s && Math.abs(o.on - e.cycle) < MATCH_EPS) {
        o.confirmedAt = now;
        return;
      }
    }
  },

  trackRows(overrides) {
    const present = new Set();
    for (const o of this.obstacles.values()) if (o.role === 'track') present.add(o.e.s);
    for (const s of present) if (!this.trackOrder.includes(s)) this.trackOrder.push(s);
    const ordered = this.trackOrder.filter((s) => present.has(s));
    const taken = new Set(ordered.map((s) => overrides?.[s]).filter((g) => GLYPHS[g]));
    const free = GLYPH_NAMES.filter((g) => !taken.has(g));
    const rows = new Map();
    let next = 0;
    for (const s of ordered) {
      const glyph = GLYPHS[overrides?.[s]] ? overrides[s] : free[next++ % free.length] ?? GLYPH_NAMES[0];
      rows.set(s, { row: rows.size, glyph });
    }
    return rows;
  },

  // the 480x270 buffer of the frame just drawn, framed around the hero
  ledCrop() {
    if (!this.buf) return null;
    return { source: this.buf, x: NOW_X - 24, y: GROUND + 30 - LED_CROP, size: LED_CROP };
  },

  draw(ctx, { w, h, dt, now }) {
    if (!this.buf) {
      this.buf = document.createElement('canvas');
      this.buf.width = W;
      this.buf.height = H;
      this.bctx = this.buf.getContext('2d');
      this.bctx.imageSmoothingEnabled = false;
    }
    const b = this.bctx;
    // Hosts may set `colors` ({ fg, hero: { k, w, r } }) to restyle the scene; default is the viz palette.
    const fg = this.colors?.fg ?? palette.fg;
    b.clearRect(0, 0, W, H);
    b.fillStyle = fg;

    const c = this.audibleCycle(now);
    const pxPerCycle = this.config?.pxPerCycle ?? DEFAULT_PX_PER_CYCLE;
    const motion = { ...MOTION, gravity: GRAVITY_PER_PX2 * pxPerCycle ** 2, recover: RECOVER_PER_PX * pxPerCycle };
    const xOf = (cycle) => Math.round(NOW_X + (cycle - c) * pxPerCycle);
    const horizon = Math.min(W, NOW_X + Math.round((this.config?.ahead ?? DEFAULT_AHEAD) * pxPerCycle));
    const roles = this.config?.roles ?? {};
    const glyphs = this.config?.glyphs;
    const rows = this.trackRows(glyphs);
    const groundStack = new Map();
    const coinStack = new Map();
    const towers = new Map();
    const platforms = [];
    const slot = (map, on, size) => {
      const k = Math.round(on / ONSET_EPS);
      const base = map.get(k) ?? 0;
      map.set(k, base + size);
      return base;
    };

    b.fillRect(0, GROUND, W, 1);
    for (let y = 0; y < GROUND; y += 4) b.fillRect(NOW_X, y, 1, 2);

    const visible = [...this.obstacles.values()]
      .filter((o) => o.role !== 'ignore' && !o.shotAt)
      .sort((a, z) => a.on - z.on || (STACK_ORDER[a.role] ?? 2) - (STACK_ORDER[z.role] ?? 2) || String(a.e.s).localeCompare(String(z.e.s)));

    const ground = new Map();
    for (const o of visible) {
      if (o.role !== 'hurdle' && o.role !== 'wall') continue;
      const spec = { ...DEFAULTS[o.role], ...roles[o.role] };
      const height = Math.round(mapField(spec.height, o.e));
      const base = slot(groundStack, o.on, height + STACK_GAP);
      ground.set(o, { base, height });
      towers.set(Math.round(o.on / ONSET_EPS), { on: o.on, height: base + height });
    }
    const towerList = [...towers.values()];
    const towerTopNear = (on) => towerList.reduce(
      (top, t) => (Math.abs(t.on - on) * pxPerCycle <= COIN_CLEAR_PX ? Math.max(top, t.height) : top),
      0,
    );
    const platformObs = visible.filter((o) => o.role === 'platform');
    const platformEnd = new Map();
    if ({ ...DEFAULTS.platform, ...roles.platform }.length === 'next') {
      const ends = untilNextOnset(platformObs.map((o) => ({ pat: o.e.pat, on: o.on, off: o.off })));
      platformObs.forEach((o, i) => platformEnd.set(o, ends[i]));
    }
    const targetColor = this.config?.targetColor ?? DEFAULT_TARGET_COLOR;
    const hitBoxes = [];
    const surfaces = [];
    const addBox = (o, l, r, t, bot) => {
      if (SUPPORT.has(o.role)) surfaces.push({ l, r, t });
      if (o.on > c) hitBoxes.push({ o, l, r, t, b: bot });
    };

    for (const o of visible) {
      const x = xOf(o.on);
      const x1 = xOf(o.off);
      if (x1 < 0 || x > W) continue;
      const spec = { ...DEFAULTS[o.role], ...roles[o.role] };
      const solid = o.confirmedAt > 0;
      const flash = solid && now - o.confirmedAt < HIT_MS;

      if (o.role === 'platform') {
        const height = Math.round(mapField(spec.y, o.e));
        const off = platformEnd.get(o) ?? o.off;
        platforms.push({ on: o.on, off, height });
        if (x <= horizon) {
          const width = Math.max(Math.min(xOf(off), horizon) - x - 1, 2);
          addBox(o, x, x + width - 1, GROUND - height, GROUND - height + 2);
          box(b, x, GROUND - height, width, 3, solid);
        }
        continue;
      }
      if (x > horizon) continue;

      if (o.role === 'hurdle' || o.role === 'wall') {
        const { base, height } = ground.get(o);
        const bottom = GROUND - base;
        const half = o.role === 'wall' ? 4 : 3;
        addBox(o, x - half, x + half, bottom - height, bottom - 1);
        if (flash && o.role === 'hurdle') box(b, x - 4, bottom - height - 1, 8, height + 1, true);
        else if (flash) spike(b, x, bottom, 11, height + 1, true);
        else if (o.role === 'hurdle') box(b, x - 3, bottom - height, 6, height, solid);
        else spike(b, x, bottom, 9, height, solid);
      } else if (o.role === 'track') {
        const { row, glyph } = rows.get(o.e.s);
        const y = TRACK_TOP + row * TRACK_ROW + 2;
        drawGlyph(b, glyph, x, y, flash ? 7 : 5);
        addBox(o, x - 2, x + 2, y - 2, y + 2);
      } else if (o.role === 'coin') {
        const lifted = Math.max(Math.round(mapField(spec.y, o.e)), towerTopNear(o.on) + COIN_LIFT);
        const y = GROUND - lifted - slot(coinStack, o.on, 7);
        addBox(o, x - 2, x + 2, y - 2, y + 2);
        if (flash) drawGlyph(b, glyphFor(o.e.s, glyphs), x, y, 7);
        else if (!solid) drawGlyph(b, glyphFor(o.e.s, glyphs), x, y);
      } else if (o.role === 'bg') {
        const y = GROUND - Math.round(mapField(spec.y, o.e));
        for (let xx = Math.max(x, 0); xx < Math.min(x1, horizon); xx += 2) b.fillRect(xx, y, 1, 1);
      }
    }

    b.globalCompositeOperation = 'source-atop';
    b.fillStyle = this.config?.pastColor ?? DEFAULT_PAST_COLOR;
    b.fillRect(0, 0, NOW_X, GROUND);
    b.fillRect(0, GROUND + 1, NOW_X, H - GROUND - 1);
    b.globalCompositeOperation = 'source-over';
    b.fillStyle = fg;

    const course = buildCourse(towerList, platforms, motion);
    stepHero(this.hero, c, now, course, motion);
    const heroBottom = GROUND - Math.round(this.hero.y);
    this.sprite ??= renderSprite(HERO_ROWS, this.colors?.hero ?? HERO_COLORS);
    const sw = this.sprite.width;
    const sh = this.sprite.height;
    const muzzleY = heroBottom - Math.round(sh / 2);
    const tol = this.config?.aimTolerance ?? DEFAULT_AIM_TOLERANCE;
    const inLine = (bx, y) => y >= bx.t - tol && y <= bx.b + tol;
    const firstInLine = (from, to, y) => hitBoxes
      .filter((bx) => SHOOTABLE.has(bx.o.role) && !bx.o.shotAt && bx.r >= from && bx.l <= to && inLine(bx, y))
      .sort((a, z) => a.l - z.l)[0];

    const aim = firstInLine(NOW_X + 6, horizon, muzzleY);
    if (aim) {
      b.globalCompositeOperation = 'source-atop';
      b.fillStyle = targetColor;
      b.fillRect(aim.l, aim.t, aim.r - aim.l + 1, aim.b - aim.t + 1);
      b.globalCompositeOperation = 'source-over';
      b.fillStyle = fg;
    }

    if (this.hero.mode === 'stumble') {
      b.save();
      b.translate(NOW_X + Math.round(sh / 2), heroBottom - sw);
      b.rotate(Math.PI / 2);
      b.drawImage(this.sprite, 0, 0);
      b.restore();
    } else {
      b.drawImage(this.sprite, NOW_X - Math.floor(sw / 2), heroBottom - sh);
    }

    const erupt = (on, ex, ey, n, speed, spread, red) => {
      for (let i = 0; i < n; i++) {
        const a = spread();
        const v = speed();
        this.bursts.push({ on, dx: ex - xOf(on), y: ey, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: now, red: red && i % 2 === 0 });
      }
    };
    const tryKill = (o, ex, ey) => {
      const leadSec = (o.on - this.cycleAt(now)) / (this.sync?.cps || 1);
      if (leadSec < (this.config?.killLead ?? DEFAULT_KILL_LEAD)) return false;
      o.shotAt = now;
      this.send?.({ kill: { pat: o.e.pat, on: o.on } });
      erupt(o.on, ex, ey, 18, () => 60 + Math.random() * 120, () => -Math.PI * (0.1 + 0.8 * Math.random()), true);
      return true;
    };

    for (; this.fireQueued > 0; this.fireQueued--) this.shots.push({ x: NOW_X + 8, y: muzzleY });
    const step = SHOT_SPEED * dt;
    this.shots = this.shots.filter((s) => {
      const x0 = s.x;
      s.x += step;
      const hit = firstInLine(x0, s.x + 2, s.y);
      if (hit) {
        const ex = Math.max(hit.l, x0);
        if (!tryKill(hit.o, ex, s.y)) {
          erupt(hit.o.on, ex, s.y, 5, () => 50 + Math.random() * 60, () => Math.PI + (Math.random() - 0.5) * 1.2, false);
        }
        return false;
      }
      if (s.x > W) return false;
      b.fillRect(Math.round(s.x) - 1, s.y, 3, 2);
      return true;
    });

    const fuse = (this.config?.bombFuse ?? DEFAULT_BOMB_FUSE) * 1000;
    const radius = this.config?.bombRadius ?? DEFAULT_BOMB_RADIUS;
    const throwSpeed = this.config?.bombThrow ?? DEFAULT_BOMB_THROW;
    const scroll = pxPerCycle * (this.sync?.cps ?? 0);
    const xAt = (bc) => NOW_X + (bc - c) * pxPerCycle;
    for (; this.bombQueued > 0; this.bombQueued--) {
      this.bombs.push({ bc: c + 8 / pxPerCycle, y: heroBottom - 14, vx: (throwSpeed + scroll) / pxPerCycle, vy: BOMB_THROW_VY, resting: false, born: now });
    }
    this.bombs = this.bombs.filter((bomb) => {
      stepBomb(bomb, dt, xAt, surfaces, GROUND, BOMB_GRAVITY);
      const bx = Math.round(xAt(bomb.bc));
      const by = Math.round(bomb.y);
      const age = now - bomb.born;
      if (age >= fuse) {
        const cy = by - 2;
        for (const box of hitBoxes) {
          if (!BOMBABLE.has(box.o.role) || box.o.shotAt || !inBlast(box, bx, cy, radius)) continue;
          tryKill(box.o, Math.max(box.l, Math.min(bx, box.r)), Math.max(box.t, Math.min(cy, box.b)));
        }
        erupt(bomb.bc, bx, cy, 30, () => 80 + Math.random() * 160, () => Math.random() * Math.PI * 2, true);
        this.rings.push({ bc: bomb.bc, y: cy, r: radius, born: now });
        return false;
      }
      b.fillRect(bx - 3, by - 4, 7, 4);
      const period = 60 + 340 * (1 - age / fuse);
      if (Math.floor(age / period) % 2 === 0) {
        b.fillStyle = targetColor;
        b.fillRect(bx, by - 5, 1, 1);
        b.fillStyle = fg;
      }
      return true;
    });
    this.rings = this.rings.filter((ring) => {
      const t = (now - ring.born) / RING_MS;
      if (t >= 1) return false;
      const rr = ring.r * t;
      const rx = xOf(ring.bc);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        b.fillStyle = i % 2 ? targetColor : fg;
        b.fillRect(Math.round(rx + Math.cos(a) * rr), Math.round(ring.y + Math.sin(a) * rr), 1, 1);
      }
      return true;
    });
    b.fillStyle = fg;
    this.bursts = this.bursts.filter((p) => {
      if (now - p.born >= BURST_MS) return false;
      p.dx += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += ERUPT_GRAVITY * dt;
      b.fillStyle = p.red ? targetColor : fg;
      b.fillRect(Math.round(xOf(p.on) + p.dx), Math.round(p.y), 2, 2);
      return true;
    });

    if (this.configFailed) {
      b.font = '8px monospace';
      b.fillText('CFG ERR', 2, 9);
    }

    const dpr = devicePixelRatio;
    const scale = Math.max(1, Math.floor(Math.min((w * dpr) / W, (h * dpr) / H)));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, Math.floor((w * dpr - W * scale) / 2), Math.floor((h * dpr - H * scale) / 2), W * scale, H * scale);
    ctx.restore();
  },
};
