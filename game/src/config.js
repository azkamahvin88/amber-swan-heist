// Shared tuning numbers for Amber Swan Heist. One place, so the whole game agrees.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const W = COLS * TILE; // 1280
export const H = ROWS * TILE; // 720
export const HUD_H = 46;

export const PLAYER_SPEED = 178;
export const PLAYER_RADIUS = 13;
export const GUARD_SPEED = 96;
export const GUARD_CHASE_SPEED = 152;
export const GUARD_PAUSE = 0.9;

export const CONE_RANGE = 215;
export const CONE_HALF = 0.62; // ~35 degrees each side
export const CAM_RANGE = 235;
export const CAM_HALF = 0.5;

export const ALARM_MAX = 100;
export const ALARM_RISE_CLOSE = 34; // per second, thief near the watcher
export const ALARM_RISE_FAR = 13; // per second, thief at the cone's edge
export const ALARM_DECAY = 7; // per second while unseen
export const ALARM_DECAY_SMOKE = 26;
export const CHASE_ABOVE = 55; // alarm level where guards start hunting
export const CALM_BELOW = 28;

export const STEP = 1 / 60;
export const EMP_SECONDS = 6;
export const DECOY_SECONDS = 5;
export const SMOKE_SECONDS = 5;
export const START_TOOLS = { emp: 2, decoy: 3, smoke: 2 };
