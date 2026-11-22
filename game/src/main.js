// Amber Swan Heist — main loop. Normal play runs the rAF loop; ?shot=cover|
// stealth|loot|win stages one deterministic scene and renders a single frame,
// which is how the screenshots are taken.
import { W, H, STEP } from './config.js';
import { World, SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN, SCREEN_LOSE, EVENT_PICKUP, EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { draw } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const world = new World(0);

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startLevel(index) {
  world.levelIndex = index;
  world.reset();
  world.status = SCREEN_PLAY;
  world.screen = SCREEN_PLAY;
  audio.unlock();
  announce(`${world.def.name}. Grab the loot, reach the exit.`);
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot mode: one staged frame, no loop, no interaction.
  stageShot(shot, world);
  draw(ctx, world, world.time);
  document.title = `Amber Swan Heist — ${shot}`;
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (input.mutePressed) {
      input.mutePressed = false;
      const m = audio.toggleMute();
      world.flash(m ? 'Sound off.' : 'Sound on.');
    }
    if (world.screen === SCREEN_TITLE && input.advance) {
      input.advance = false;
      audio.click();
      startLevel(0);
    } else if (world.screen === SCREEN_WIN && input.advance) {
      input.advance = false;
      audio.click();
      if (world.levelIndex < 2) startLevel(world.levelIndex + 1);
      else startLevel(0);
    } else if (world.screen === SCREEN_LOSE && input.advance) {
      input.advance = false;
      audio.click();
      startLevel(world.levelIndex);
    }
    if (world.status === SCREEN_PLAY) {
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 8) {
        const events = world.step(STEP, input);
        acc -= STEP;
        guard += 1;
        if (events & EVENT_PICKUP) audio.pickup(world.swanTaken);
        if (events & EVENT_CAUGHT) audio.caught();
        if (events & EVENT_WIN) audio.win();
      }
      if (world.spotted) audio.spottedTick(world.alarm, dt);
      if (world.status === SCREEN_WIN) announce(`Getaway! Score ${world.score}.`);
      if (world.status === SCREEN_LOSE) announce('Caught! Press Space to try again.');
    }
    draw(ctx, world, world.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Exposed for the Playwright play-test: drive the game headlessly.
window.__heist = {
  world,
  start: (i = 0) => startLevel(i),
  state: () => ({
    screen: world.screen,
    status: world.status,
    alarm: world.alarm,
    score: world.score,
    lootLeft: world.lootLeft,
    x: world.player.x,
    y: world.player.y,
    time: world.time,
  }),
  move: (dx, dy) => {
    input.left = dx < 0; input.right = dx > 0;
    input.up = dy < 0; input.down = dy > 0;
  },
  stop: () => { input.left = input.right = input.up = input.down = false; },
  tool: (name, x, y) => { input.tool = name; input.toolX = x ?? 0; input.toolY = y ?? 0; },
};
