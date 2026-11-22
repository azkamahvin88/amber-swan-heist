// Keyboard + mouse, in one place. WASD or arrows to move; Q/E/F for tools;
// a mouse click throws the decoy where you point. Space/Enter advances screens.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    up: false, down: false, left: false, right: false,
    tool: null, toolX: 0, toolY: 0,
    mouseX: 0, mouseY: 0,
    // True for one frame when the player pressed a screen-advance key.
    advance: false,
    // True for one frame when the player pressed the mute key.
    mutePressed: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  function scaleMouse(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    const dir = KEYMAP[e.code];
    if (dir) input[dir] = true;
    if (e.code === 'Space' || e.code === 'Enter') input.advance = true;
    if (e.code === 'KeyM') input.mutePressed = true;
    if (e.code === 'KeyQ') { input.tool = 'decoy'; input.toolX = input.mouseX; input.toolY = input.mouseY; }
    if (e.code === 'KeyE') input.tool = 'emp';
    if (e.code === 'KeyF') input.tool = 'smoke';
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    const dir = KEYMAP[e.code];
    if (dir) input[dir] = false;
  });
  canvas.addEventListener('mousemove', scaleMouse);
  canvas.addEventListener('mousedown', (e) => {
    scaleMouse(e);
    // A click throws the decoy at the clicked spot (when one is charged).
    input.tool = 'decoy';
    input.toolX = input.mouseX;
    input.toolY = input.mouseY;
  });
  window.addEventListener('blur', () => {
    keys.clear();
    input.up = input.down = input.left = input.right = false;
  });
  return input;
}
