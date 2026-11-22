// The living gallery: state, rules, and one fixed step of simulation.
// Everything the render and the screenshots draw comes from here, so a staged
// screenshot is the same game, just played by an autopilot instead of a person.
import {
  TILE, COLS, ROWS, PLAYER_SPEED, PLAYER_RADIUS, GUARD_SPEED, GUARD_CHASE_SPEED,
  GUARD_PAUSE, ALARM_MAX, ALARM_RISE_CLOSE, ALARM_RISE_FAR, ALARM_DECAY,
  ALARM_DECAY_SMOKE, CHASE_ABOVE, CALM_BELOW, EMP_SECONDS, DECOY_SECONDS,
  SMOKE_SECONDS, START_TOOLS,
} from './config.js';
import { LEVELS, isBlock } from './levels.js';
import { watcherSees, guardWatcher, cameraWatcher, hasLineOfSight } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';
export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;

const tileCentre = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  const loots = [];
  let start = null;
  let exit = null;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = grid[y][x];
      if (ch === 'P') { start = tileCentre(x, y); grid[y][x] = '.'; }
      if (ch === 'E') { exit = tileCentre(x, y); grid[y][x] = '.'; }
      if (ch === 'L') { loots.push({ ...tileCentre(x, y), kind: 'painting', value: 100, taken: false }); grid[y][x] = '.'; }
      if (ch === 'W') { loots.push({ ...tileCentre(x, y), kind: 'swan', value: 500, taken: false }); grid[y][x] = '.'; }
    }
  }
  return { grid, loots, start, exit };
}

export class World {
  constructor(levelIndex = 0) {
    this.levelIndex = levelIndex;
    this.reset();
  }

  reset() {
    const def = LEVELS[this.levelIndex];
    const { grid, loots, start, exit } = parseLevel(def);
    this.def = def;
    this.grid = grid;
    this.loots = loots;
    this.start = start;
    this.exit = exit;
    this.player = { x: start.x, y: start.y, r: PLAYER_RADIUS };
    this.guards = def.guards.map((g) => {
      const p = tileCentre(g.path[0][0], g.path[0][1]);
      return {
        path: g.path.map(([tx, ty]) => tileCentre(tx, ty)),
        leg: 0, dir: 1, pause: 0, pauseAt: g.pause,
        x: p.x, y: p.y, angle: 0, state: 'patrol', investigate: null,
      };
    });
    this.cameras = def.cameras.map((c) => {
      const p = tileCentre(c.x, c.y);
      return { x: p.x, y: p.y, base: c.base, sweep: c.sweep, speed: c.speed, disabledUntil: 0 };
    });
    this.alarm = 0;
    this.time = 0;
    this.score = 0;
    this.status = SCREEN_TITLE;
    this.screen = SCREEN_TITLE;
    this.tools = { ...START_TOOLS };
    this.empUntil = 0;
    this.smoke = null; // {x, y, until}
    this.decoy = null; // {x, y, until}
    this.spotted = false;
    this.caughtBy = null;
    this.message = '';
    this.messageUntil = 0;
    this.best = 0;
    this.events = [];
  }

  get lootLeft() {
    return this.loots.filter((l) => !l.taken).length;
  }

  get lootTotal() {
    return this.loots.length;
  }

  get swanTaken() {
    return this.loots.some((l) => l.kind === 'swan' && l.taken);
  }

  get empActive() {
    return this.time < this.empUntil;
  }

  get inSmoke() {
    return this.smoke && this.time < this.smoke.until
      && Math.hypot(this.player.x - this.smoke.x, this.player.y - this.smoke.y) < 95;
  }

  blockedAt(px, py) {
    const cx = Math.floor(px / TILE);
    const cy = Math.floor(py / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    return isBlock(this.grid[cy][cx]);
  }

  // Move a circle through the tile grid, sliding along walls.
  moveCircle(body, dx, dy) {
    const r = body.r ?? PLAYER_RADIUS;
    let nx = body.x + dx;
    if (!this.blockedAt(nx + Math.sign(dx) * r, body.y - r + 2)
      && !this.blockedAt(nx + Math.sign(dx) * r, body.y + r - 2)) body.x = nx;
    let ny = body.y + dy;
    if (!this.blockedAt(body.x - r + 2, ny + Math.sign(dy) * r)
      && !this.blockedAt(body.x + r - 2, ny + Math.sign(dy) * r)) body.y = ny;
  }

  currentWatchers() {
    const list = this.guards.map(guardWatcher);
    for (const c of this.cameras) {
      if (this.time < c.disabledUntil || this.empActive) continue;
      list.push(cameraWatcher(c, this.time));
    }
    return list;
  }

  useTool(name, tx, ty) {
    if (this.status !== SCREEN_PLAY) return false;
    if (this.tools[name] <= 0) {
      this.flash('No charges left — make it count next time.');
      return false;
    }
    this.tools[name] -= 1;
    if (name === 'emp') {
      this.empUntil = this.time + EMP_SECONDS;
      this.alarm = Math.min(ALARM_MAX, this.alarm + 6);
      this.flash('EMP burst! Cameras blind for 6s — but the noise stirs the guards.');
    }
    if (name === 'decoy') {
      const x = tx ?? this.player.x + Math.cos(0) * 120;
      const y = ty ?? this.player.y;
      this.decoy = { x, y, until: this.time + DECOY_SECONDS };
      this.flash('Decoy tossed — a guard goes to look.');
    }
    if (name === 'smoke') {
      this.smoke = { x: this.player.x, y: this.player.y, until: this.time + SMOKE_SECONDS };
      this.flash('Smoke! Breathe slow, stay inside it.');
    }
    return true;
  }

  flash(text) {
    this.message = text;
    this.messageUntil = this.time + 3;
  }

  step(dt, input) {
    if (this.status !== SCREEN_PLAY) return EVENT_NONE;
    this.time += dt;
    let events = EVENT_NONE;

    // --- thief movement ---
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      this.moveCircle(this.player, (mx / len) * PLAYER_SPEED * dt, (my / len) * PLAYER_SPEED * dt);
    }
    if (input.tool) {
      const tool = input.tool;
      input.tool = null;
      this.useTool(tool, input.toolX, input.toolY);
    }

    // --- guards: patrol, investigate, chase ---
    const chasing = this.alarm >= CHASE_ABOVE;
    for (const g of this.guards) {
      let target = null;
      let speed = GUARD_SPEED;
      if (this.decoy && this.time < this.decoy.until) {
        target = this.decoy;
        g.state = 'investigate';
      } else if (chasing) {
        target = this.player;
        speed = GUARD_CHASE_SPEED;
        g.state = 'chase';
      } else {
        g.state = 'patrol';
      }
      if (target) {
        const dx = target.x - g.x;
        const dy = target.y - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          g.angle = Math.atan2(dy, dx);
          const nx = g.x + (dx / dist) * speed * dt;
          const ny = g.y + (dy / dist) * speed * dt;
          if (!this.blockedAt(nx, g.y)) g.x = nx;
          if (!this.blockedAt(g.x, ny)) g.y = ny;
        }
      } else {
        if (g.pause > 0) {
          g.pause -= dt;
        } else {
          const wp = g.path[g.leg];
          const dx = wp.x - g.x;
          const dy = wp.y - g.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 5) {
            g.leg += g.dir;
            if (g.leg >= g.path.length || g.leg < 0) {
              g.dir *= -1;
              g.leg += g.dir * 2;
            }
            g.pause = g.pauseAt;
          } else {
            g.angle = Math.atan2(dy, dx);
            const nx = g.x + (dx / dist) * GUARD_SPEED * dt;
            const ny = g.y + (dy / dist) * GUARD_SPEED * dt;
            if (!this.blockedAt(nx, g.y)) g.x = nx;
            if (!this.blockedAt(g.x, ny)) g.y = ny;
          }
        }
      }
    }

    // --- being seen ---
    const watchers = this.currentWatchers();
    let seen = 0;
    let seer = null;
    for (const w of watchers) {
      const v = watcherSees(this.grid, w, this.player.x, this.player.y);
      if (v > seen) { seen = v; seer = w; }
    }
    if (this.inSmoke) seen = 0;
    this.spotted = seen > 0;
    if (seen > 0) {
      const rate = ALARM_RISE_FAR + (ALARM_RISE_CLOSE - ALARM_RISE_FAR) * seen;
      this.alarm = Math.min(ALARM_MAX, this.alarm + rate * dt);
      if (!(events & EVENT_SPOTTED)) events |= EVENT_SPOTTED;
      if (this.alarm >= ALARM_MAX) {
        this.status = SCREEN_LOSE;
        this.screen = SCREEN_LOSE;
        this.caughtBy = seer ? 'spotted' : 'alarm';
        return events | EVENT_CAUGHT;
      }
    } else {
      this.alarm = Math.max(0, this.alarm - (this.inSmoke ? ALARM_DECAY_SMOKE : ALARM_DECAY) * dt);
    }

    // --- a guard that reaches the thief catches them ---
    for (const g of this.guards) {
      if (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 26) {
        this.status = SCREEN_LOSE;
        this.screen = SCREEN_LOSE;
        this.caughtBy = 'guard';
        return events | EVENT_CAUGHT;
      }
    }

    // --- loot ---
    for (const loot of this.loots) {
      if (!loot.taken && Math.hypot(loot.x - this.player.x, loot.y - this.player.y) < 34) {
        loot.taken = true;
        this.score += loot.value;
        events |= EVENT_PICKUP;
        this.flash(loot.kind === 'swan'
          ? 'THE AMBER SWAN IS YOURS! Now run for the east door!'
          : `Lifted a painting (+${loot.value}). ${this.lootLeft} piece${this.lootLeft === 1 ? '' : 's'} left.`);
      }
    }

    // --- the exit ---
    if (this.lootLeft === 0 && Math.hypot(this.exit.x - this.player.x, this.exit.y - this.player.y) < 36) {
      const timeBonus = Math.max(0, Math.round((this.def.par - this.time) * 5));
      this.score += timeBonus;
      this.status = SCREEN_WIN;
      this.screen = SCREEN_WIN;
      this.best = Math.max(this.best, this.score);
      return events | EVENT_WIN;
    }
    return events;
  }
}
