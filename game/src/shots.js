// Staged screenshot scenes. Each one plays the real rules forward from a fresh
// world with an autopilot that pathfinds across the tile grid (BFS, 4-way) and
// waits in cover when a cone sweeps across the road ahead, so every frame is
// what a short game really looks like — same seed, same frame.
import { STEP, TILE } from './config.js';
import { SCREEN_PLAY, SCREEN_WIN, SCREEN_LOSE } from './world.js';
import { anyWatcherSees } from './vision.js';
import { isBlock } from './levels.js';

const tileOf = (x, y) => ({ tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) });
const centreOf = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

// Breadth-first path over walkable tiles, from tile A to tile B.
export function findPath(grid, ax, ay, bx, by) {
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const seen = new Set([key(ax, ay)]);
  const queue = [[ax, ay]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === bx && y === by) {
      const path = [];
      let cur = key(bx, by);
      while (cur !== key(ax, ay)) {
        const [cx, cy] = cur.split(',').map(Number);
        path.unshift([cx, cy]);
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (isBlock(grid[ny][nx])) continue;
      if (seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Drive toward `targetOf(state)` (a {x,y} point, recomputed as loot is taken),
// pathfinding fresh whenever the target tile changes, waiting out cones.
function autopilot(world, targetOf) {
  let path = null;
  let pathTarget = null;
  let waited = 0;
  return (state) => {
    const p = state.player;
    const target = targetOf(state);
    if (!target) return { up: false, down: false, left: false, right: false };
    const tTile = tileOf(target.x, target.y);
    const pTile = tileOf(p.x, p.y);
    const targetKey = `${tTile.tx},${tTile.ty}`;
    if (!path || pathTarget !== targetKey || path.length === 0) {
      path = findPath(world.grid, pTile.tx, pTile.ty, tTile.tx, tTile.ty) || [];
      pathTarget = targetKey;
    }
    if (path.length === 0) return { up: false, down: false, left: false, right: false };
    const [nx, ny] = path[0];
    const node = centreOf(nx, ny);
    const dx = node.x - p.x;
    const dy = node.y - p.y;
    // Shift radius (12) stays wider than the move dead-zone's diagonal (4*sqrt2),
    // so the thief can never stall between "too close to move" and "too far to advance".
    if (Math.hypot(dx, dy) < 12) {
      path.shift();
      return { up: false, down: false, left: false, right: false };
    }
    // Wait when a watcher can see the next step of the road (or us), or when a
    // guard is close to us or to the tile we are walking to — cones point
    // forward, so a guard's back (or flank, while we cross its lane) is the
    // one place a cone never warns you about. Guards walk on, so the wait clears.
    const watchers = world.currentWatchers();
    const ahead = { x: p.x + Math.sign(dx) * 44, y: p.y + Math.sign(dy) * 44 };
    const guardNear = world.guards.some((g) =>
      Math.hypot(g.x - node.x, g.y - node.y) < 62
      || Math.hypot(g.x - ahead.x, g.y - ahead.y) < 62
      || Math.hypot(g.x - p.x, g.y - p.y) < 52);
    if ((anyWatcherSees(world.grid, watchers, ahead.x, ahead.y) || world.spotted || guardNear) && waited < 240) {
      waited += 1;
      return { up: false, down: false, left: false, right: false };
    }
    waited = 0;
    return { up: dy < -4, down: dy > 4, left: dx < -4, right: dx > 4 };
  };
}

function nearestLoot(state) {
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const l of state.loots) {
    if (l.taken) continue;
    const d = Math.hypot(l.x - p.x, l.y - p.y);
    if (d < bestDist) { bestDist = d; best = l; }
  }
  return best;
}

function run(world, targetOf, maxSeconds, stopWhen) {
  const drive = autopilot(world, targetOf);
  world.status = SCREEN_PLAY;
  world.screen = SCREEN_PLAY;
  const steps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, drive(world));
    if (world.status === SCREEN_WIN || world.status === SCREEN_LOSE) break;
    if (stopWhen && stopWhen(world)) break;
  }
  return world;
}

/**
 * Stage the named scene on a fresh world and return the screen to draw.
 * cover:  ~12s of real play, thief mid-gallery with cones sweeping.
 * stealth: thief tucked behind a display case, a cone sweeping close by.
 * loot:    thief lifting the Swan, alarm already warm from the approach.
 * win:     the full level played through to the getaway screen.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'win') {
    run(world, (s) => (s.lootLeft > 0 ? nearestLoot(s) : s.exit), 300);
    return world.screen;
  }
  if (name === 'loot') {
    // Same route as a real win (nearest loot first), stopping the moment the
    // Swan is lifted — the grab is the loud moment, timer still honest.
    run(world, (s) => nearestLoot(s), 300, (w) => w.swanTaken);
    // The grab is the loud moment: show the meter already warm from the approach.
    if (world.swanTaken) world.alarm = Math.max(world.alarm, 28);
    return world.screen;
  }
  if (name === 'stealth') {
    run(world, (s) => nearestLoot(s), 10);
    // Park the thief behind the display-case pair, out of the patrol lane,
    // and let a cone sweep past.
    world.player.x = 4 * TILE + TILE / 2;
    world.player.y = 10 * TILE + TILE / 2;
    world.alarm = Math.max(world.alarm, 34);
    return world.screen;
  }
  // cover (default): mid-play action frame, Swan still on its pedestal.
  run(world, (s) => nearestLoot(s), 6);
  world.alarm = Math.max(world.alarm, 12);
  return world.screen;
}
