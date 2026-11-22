// Vision cones and line of sight. A watcher (guard or camera) sees the thief only
// when the thief is inside its cone, inside its range, and no wall or cover
// stands between them. Cover is honest: a display case really hides you.
import { CONE_HALF, CONE_RANGE, CAM_HALF, CAM_RANGE, TILE } from './config.js';
import { isBlock } from './levels.js';

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// True when the segment from (x0,y0) to (x1,y1) crosses no blocking tile.
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const cx = Math.floor((x0 + dx * t) / TILE);
    const cy = Math.floor((y0 + dy * t) / TILE);
    if (cy < 0 || cy >= grid.length || cx < 0 || cx >= grid[0].length) return false;
    if (isBlock(grid[cy][cx])) return false;
  }
  return true;
}

// 0 when the thief is not seen by this watcher, otherwise 0..1 by closeness
// (1 = right on top of the watcher). `watcher` = {x, y, angle, range, half}.
export function watcherSees(grid, watcher, px, py) {
  const dx = px - watcher.x;
  const dy = py - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > watcher.range) return 0;
  const toThief = Math.atan2(dy, dx);
  if (Math.abs(normAngle(toThief - watcher.angle)) > watcher.half) return 0;
  if (!hasLineOfSight(grid, watcher.x, watcher.y, px, py)) return 0;
  return 1 - dist / watcher.range;
}

export function guardWatcher(guard) {
  return { x: guard.x, y: guard.y, angle: guard.angle, range: CONE_RANGE, half: CONE_HALF };
}

export function cameraWatcher(camera, time) {
  const angle = camera.base + Math.sin(time * camera.speed) * camera.sweep;
  return { x: camera.x, y: camera.y, angle, range: CAM_RANGE, half: CAM_HALF };
}

// True when any watcher can see point (px,py) right now (used by the autopilot
// and by the "danger ahead" hint). Guards and cameras are passed in already
// resolved to watcher shapes.
export function anyWatcherSees(grid, watchers, px, py) {
  for (const w of watchers) {
    if (watcherSees(grid, w, px, py) > 0) return true;
  }
  return false;
}
