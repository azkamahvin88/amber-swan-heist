// Everything the player sees, drawn on one canvas. Night palette: deep blue-black
// floor, warm amber lamplight, red-yellow vision cones, the Swan glowing gold.
import { TILE, COLS, ROWS, W, H, HUD_H, CONE_RANGE, CONE_HALF, CAM_RANGE, CAM_HALF, ALARM_MAX } from './config.js';
import { SCREEN_TITLE, SCREEN_WIN, SCREEN_LOSE } from './world.js';
import { cameraWatcher, guardWatcher } from './vision.js';

// Deterministic speckles so the floor reads as old parquet, not flat paint.
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function conePath(ctx, x, y, angle, half, range) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - half, angle + half);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, half, range, hot) {
  const grad = ctx.createRadialGradient(x, y, 10, x, y, range);
  if (hot) {
    grad.addColorStop(0, 'rgba(255,60,40,0.42)');
    grad.addColorStop(1, 'rgba(255,60,40,0.05)');
  } else {
    grad.addColorStop(0, 'rgba(255,210,90,0.34)');
    grad.addColorStop(1, 'rgba(255,210,90,0.04)');
  }
  conePath(ctx, x, y, angle, half, range);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = hot ? 'rgba(255,80,60,0.5)' : 'rgba(255,220,120,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawSwan(ctx, x, y, t, big) {
  const s = big ? 1.15 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Glow.
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
  glow.addColorStop(0, 'rgba(255,190,60,0.55)');
  glow.addColorStop(1, 'rgba(255,190,60,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
  // Body: a plump amber ellipse.
  ctx.fillStyle = '#ffb52e';
  ctx.beginPath(); ctx.ellipse(-2, 4, 13, 9, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd97a';
  ctx.beginPath(); ctx.ellipse(-2, 2, 11, 7, -0.15, 0, Math.PI * 2); ctx.fill();
  // Neck rising in an S, head, beak.
  ctx.strokeStyle = '#ffb52e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.quadraticCurveTo(14, -8, 10, -14);
  ctx.stroke();
  ctx.fillStyle = '#ffdf8a';
  ctx.beginPath(); ctx.arc(10, -15, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e2543e';
  ctx.beginPath(); ctx.moveTo(14, -16); ctx.lineTo(20, -14); ctx.lineTo(14, -12); ctx.closePath(); ctx.fill();
  // Wing + sparkle.
  ctx.strokeStyle = 'rgba(120,60,0,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(-3, 3, 8, 5, -0.2, 0.3, Math.PI - 0.4); ctx.stroke();
  const tw = (Math.sin(t * 3) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,220,${0.5 + tw * 0.5})`;
  ctx.beginPath(); ctx.arc(-14, -10, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, 10, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPainting(ctx, x, y, t, hue) {
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
  glow.addColorStop(0, 'rgba(255,220,130,0.4)');
  glow.addColorStop(1, 'rgba(255,220,130,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a6d2f';
  ctx.fillRect(-13, -10, 26, 20);
  ctx.fillStyle = `hsl(${hue}, 55%, 32%)`;
  ctx.fillRect(-10, -7, 20, 14);
  ctx.strokeStyle = `hsl(${hue}, 70%, 60%)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-2, 0, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, 7); ctx.lineTo(10, -7); ctx.stroke();
  const tw = (Math.sin(t * 4 + hue) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,220,${0.4 + tw * 0.6})`;
  ctx.beginPath(); ctx.arc(11, -9, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawThief(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 10, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Hooded body.
  ctx.fillStyle = '#232733';
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2e3442';
  ctx.beginPath(); ctx.arc(0, -2, 10, Math.PI, 0); ctx.fill();
  // Amber scarf + mask slit.
  ctx.strokeStyle = '#ffb52e';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 4, 8, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.fillStyle = '#0c0e14';
  ctx.fillRect(-7, -4, 14, 3.5);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(-3.5, -2.5, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3.5, -2.5, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGuard(ctx, x, y, angle, state, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 11, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Navy uniform + cap brim toward facing.
  ctx.fillStyle = state === 'chase' ? '#5a1f24' : '#1f2d52';
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8c98a';
  ctx.beginPath(); ctx.arc(Math.cos(angle) * 9, Math.sin(angle) * 9, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#141a2e';
  ctx.beginPath(); ctx.arc(0, -3, 8, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#e8e2c8';
  ctx.beginPath(); ctx.arc(-3.5, -1, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3.5, -1, 1.3, 0, Math.PI * 2); ctx.fill();
  if (state === 'chase' || state === 'investigate') {
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -20 - Math.sin(t * 6) * 2);
  }
  ctx.restore();
}

function drawCamera(ctx, x, y, angle, disabled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = disabled ? '#3a3f4a' : '#20242e';
  ctx.fillRect(-3, -6, 16, 12);
  ctx.fillStyle = disabled ? '#666' : '#ff5040';
  ctx.beginPath(); ctx.arc(14, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0c0e14';
  ctx.fillRect(-6, -8, 5, 16);
  ctx.restore();
}

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(8,10,18,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,90,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawWorld(ctx, world, t) {
  const { grid } = world;
  // --- floor ---
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const px = x * TILE;
      const py = y * TILE;
      const v = hash2(x, y);
      ctx.fillStyle = (x + y) % 2 === 0 ? '#171a26' : '#191d2b';
      ctx.fillRect(px, py, TILE, TILE);
      if (v > 0.86) {
        ctx.fillStyle = 'rgba(255,200,110,0.05)';
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      }
      // Warm lamplight pools along the hall.
      if ((x % 8 === 4) && (y % 6 === 2)) {
        const g = ctx.createRadialGradient(px + 20, py + 20, 4, px + 20, py + 20, 90);
        g.addColorStop(0, 'rgba(255,190,90,0.07)');
        g.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 70, py - 70, 180, 180);
      }
    }
  }
  // --- walls, cases, statues, plants ---
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#2c3040';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#3a3f55';
        ctx.fillRect(px, py, TILE, 4);
        ctx.fillStyle = 'rgba(255,200,90,0.18)';
        ctx.fillRect(px, py + TILE - 3, TILE, 2);
      } else if (ch === 'D') {
        ctx.fillStyle = '#4a3d22';
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = 'rgba(170,220,255,0.28)';
        ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        ctx.strokeStyle = '#c9a44a';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px + 10, py + 8); ctx.lineTo(px + 22, py + 30); ctx.stroke();
      } else if (ch === 'S') {
        ctx.fillStyle = '#5c5348';
        ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
        ctx.fillStyle = '#cfc4ae';
        ctx.beginPath(); ctx.arc(px + 20, py + 16, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8f8672';
        ctx.fillRect(px + 17, py + 22, 6, 8);
      } else if (ch === 'V') {
        ctx.fillStyle = '#7a4a28';
        ctx.fillRect(px + 13, py + 24, 14, 10);
        ctx.fillStyle = '#2e6b34';
        ctx.beginPath(); ctx.arc(px + 20, py + 16, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3f8a46';
        ctx.beginPath(); ctx.arc(px + 15, py + 12, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 25, py + 13, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // --- exit door ---
  const ex = world.exit;
  const pulse = 0.5 + Math.sin(t * 3) * 0.2;
  const eg = ctx.createRadialGradient(ex.x, ex.y, 4, ex.x, ex.y, 52);
  eg.addColorStop(0, `rgba(80,255,140,${0.35 * pulse + 0.15})`);
  eg.addColorStop(1, 'rgba(80,255,140,0)');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(ex.x, ex.y, 52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = world.lootLeft === 0 ? '#2fae5f' : '#3a5a44';
  ctx.fillRect(ex.x - 14, ex.y - 16, 28, 32);
  ctx.strokeStyle = world.lootLeft === 0 ? '#7dffab' : '#5a7a64';
  ctx.lineWidth = 2;
  ctx.strokeRect(ex.x - 14, ex.y - 16, 28, 32);
  ctx.fillStyle = '#0c0e14';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex.x, ex.y + 4);
  // --- loot ---
  world.loots.forEach((loot, i) => {
    if (loot.taken) return;
    if (loot.kind === 'swan') drawSwan(ctx, loot.x, loot.y, t, true);
    else drawPainting(ctx, loot.x, loot.y, t, 40 + i * 55);
  });
  // --- decoy + smoke ---
  if (world.decoy && t < world.decoy.until) {
    const k = 1 - (world.decoy.until - t) / 5;
    ctx.strokeStyle = `rgba(255,220,120,${0.9 - k * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(world.decoy.x, world.decoy.y, 8 + k * 26, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd25e';
    ctx.beginPath(); ctx.arc(world.decoy.x, world.decoy.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (world.smoke && t < world.smoke.until) {
    ctx.fillStyle = 'rgba(180,190,210,0.30)';
    for (let i = 0; i < 7; i += 1) {
      const a = hash2(i, 7) * Math.PI * 2;
      const r = hash2(i, 3) * 55;
      ctx.beginPath();
      ctx.arc(world.smoke.x + Math.cos(a) * r, world.smoke.y + Math.sin(a) * r, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // --- vision cones (under the watchers, over the floor) ---
  for (const g of world.guards) {
    const w = guardWatcher(g);
    drawCone(ctx, w.x, w.y, w.angle, w.half, w.range, g.state === 'chase');
  }
  for (const c of world.cameras) {
    if (world.time < c.disabledUntil || world.empActive) continue;
    const w = cameraWatcher(c, t);
    drawCone(ctx, w.x, w.y, w.angle, w.half, w.range, false);
  }
  // --- cameras + guards + thief ---
  for (const c of world.cameras) {
    drawCamera(ctx, c.x, c.y, cameraWatcher(c, t).angle, world.time < c.disabledUntil || world.empActive);
  }
  for (const g of world.guards) drawGuard(ctx, g.x, g.y, g.angle, g.state, t);
  drawThief(ctx, world.player.x, world.player.y, t);
  // --- spotted flash on the thief ---
  if (world.spotted) {
    ctx.strokeStyle = `rgba(255,60,40,${0.5 + Math.sin(t * 10) * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(world.player.x, world.player.y, 20, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawHud(ctx, world) {
  ctx.fillStyle = 'rgba(6,8,14,0.82)';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = 'rgba(255,200,90,0.35)';
  ctx.fillRect(0, HUD_H - 1, W, 1);
  ctx.fillStyle = '#f2e8c9';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(world.def.name, 14, 19);
  ctx.fillStyle = '#9aa3b5';
  ctx.font = '12px sans-serif';
  ctx.fillText(world.def.sub, 14, 36);
  // Alarm meter.
  const ax = 560;
  const aw = 300;
  ctx.fillStyle = '#0c0e14';
  ctx.beginPath(); ctx.roundRect(ax, 12, aw, 22, 6); ctx.fill();
  const frac = world.alarm / ALARM_MAX;
  const col = frac < 0.35 ? '#3fbf5f' : frac < 0.7 ? '#ffb52e' : '#ff5040';
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.roundRect(ax + 2, 14, Math.max(4, (aw - 4) * frac), 18, 5); ctx.fill();
  ctx.fillStyle = '#f2e8c9';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ALARM ${Math.round(world.alarm)}`, ax + 8, 27);
  // Loot, tools, score, time.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd25e';
  ctx.font = 'bold 14px sans-serif';
  const got = world.lootTotal - world.lootLeft;
  ctx.fillText(`◆ ${got}/${world.lootTotal}`, 920, 20);
  ctx.fillStyle = '#c9d2e8';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Q decoy ×${world.tools.decoy}   E EMP ×${world.tools.emp}   F smoke ×${world.tools.smoke}`, 920, 37);
  ctx.fillStyle = '#f2e8c9';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`Score ${world.score}`, 1100, 20);
  ctx.fillStyle = '#9aa3b5';
  ctx.font = '12px sans-serif';
  const mm = Math.floor(world.time / 60);
  const ss = Math.floor(world.time % 60).toString().padStart(2, '0');
  ctx.fillText(`${mm}:${ss}  ·  par ${world.def.par}s`, 1100, 37);
  ctx.textAlign = 'left';
  // Toast message.
  if (world.time < world.messageUntil && world.message) {
    panel(ctx, 340, H - 56, 600, 34, 0.85);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, 640, H - 34);
    ctx.textAlign = 'left';
  }
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(4,6,12,0.78)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 340, 190, 600, 300, 0.95);
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 640, 250);
  ctx.fillStyle = '#e8e2c8';
  ctx.font = '15px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, 640, 292 + i * 26));
  ctx.fillStyle = '#9aa3b5';
  ctx.font = '13px sans-serif';
  ctx.fillText('Press Space or click to continue', 640, 292 + lines.length * 26 + 18);
  ctx.textAlign = 'left';
}

export function draw(ctx, world, t) {
  ctx.clearRect(0, 0, W, H);
  if (world.screen === SCREEN_TITLE) {
    drawWorld(ctx, world, t);
    overlay(ctx, 'AMBER SWAN HEIST', [
      'One thief. One gallery. One golden swan.',
      'WASD / arrows to move — stay out of the red and yellow cones.',
      'Grab every loot, then reach the EXIT door before the alarm hits 100.',
      'Q decoy · E EMP (blinds cameras) · F smoke · M mute',
    ], '#ffb52e');
    return;
  }
  drawWorld(ctx, world, t);
  drawHud(ctx, world);
  if (world.screen === SCREEN_WIN) {
    const last = world.levelIndex === 2;
    overlay(ctx, last ? 'CLEAN GETAWAY!' : 'GALLERY CLEARED!', [
      `Score ${world.score}  ·  time ${Math.floor(world.time)}s (par ${world.def.par}s)`,
      last ? 'The Swan is yours. Three galleries, zero alarms left ringing.'
        : 'The Swan is yours — but the next gallery is already waking up.',
      last ? 'Thanks for playing Amber Swan Heist.' : 'Press Space for the next gallery.',
    ], '#7dffab');
  } else if (world.screen === SCREEN_LOSE) {
    overlay(ctx, 'CAUGHT!', [
      world.caughtBy === 'guard'
        ? 'A guard laid a hand on your shoulder. The cones were watching.'
        : 'The alarm hit 100 and the gallery locked down around you.',
      `Score ${world.score}  ·  loot ${world.lootTotal - world.lootLeft}/${world.lootTotal}`,
      'The patrols are readable — watch the cones, use the cover, try again.',
    ], '#ff5040');
  }
}
