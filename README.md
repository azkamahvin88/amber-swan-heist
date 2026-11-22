# amber-swan-heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/azkamahvin88/amber-swan-heist/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/azkamahvin88/amber-swan-heist/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**Amber Swan Heist** — a top-down stealth heist game, built for
[make.fun's "Make the best heist game" bounty](https://make.fun/bounty/best-heist-game-20261122-0559).

One thief. One gallery. One golden swan. Slip through the Amber Swan Gallery
at night, lift the paintings and the jewel-encrusted Amber Swan, and reach the
east door before the alarm hits 100 — while guards and wall cameras sweep
their vision cones across the floor.

## Play

Serve `game/` with any static server and open it in a desktop browser, or run:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests: every file the game loads lives under
`game/`, and all art is drawn in code and all sound is synthesised with
WebAudio.

- **Move:** WASD or arrow keys (mouse click throws a decoy where you point)
- **Tools, each with a cost:** `Q` decoy (lures a guard away) · `E` EMP
  (blinds every camera for 6s, but the noise stirs the guards) · `F` smoke
  (hide inside it while the alarm cools down)
- **Win:** grab every loot, then reach the green EXIT door.
- **Lose:** the alarm reaches 100, or a guard lays a hand on you.
- **Three galleries**, each harder than the last: more guards, more cameras,
  tighter cover. `M` mutes the sound.

## Screenshots

Real renders of the game's own code, taken in Chromium:

1. `1-cover.jpg` — mid-heist: thief, guards and cones, camera, the Swan
   glowing on its pedestal, a painting, the exit, and the alarm meter, all in
   one frame.
2. `2-stealth.jpg` — the thief tucked behind a display case as a cone sweeps
   past.
3. `3-loot.jpg` — the Swan just lifted, alarm already warm.
4. `4-win.jpg` — the getaway screen.

## Structure

- `game/index.html` — the page; `game/src/main.js` — the loop and screens
- `game/src/world.js` — state and one fixed step of simulation
- `game/src/levels.js` — the three galleries
- `game/src/vision.js` — vision cones and line of sight
- `game/src/render.js` — everything drawn on the canvas
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised sound (WebAudio)
- `game/src/shots.js` — the staged screenshot scenes (real rules, autopilot)
- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with `buildDossier` from
  `vendor/makefun-game.ts` (the kit's copy, unchanged)

## License

MIT — see [LICENSE](LICENSE).
