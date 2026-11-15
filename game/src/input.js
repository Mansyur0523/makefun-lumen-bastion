// Mouse and keyboard input, translated into logical 1280x720 field coordinates.
// The renderer owns the canvas transform; this module reads it back through a
// `toLogical` callback the main loop supplies, so clicks land where the player sees them.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_WAVE = 8;
export const ACTION_SPEED = 16;
export const ACTION_MUTE = 32;
export const ACTION_BUILD_1 = 64;
export const ACTION_BUILD_2 = 128;
export const ACTION_BUILD_3 = 256;
export const ACTION_UPGRADE = 512;
export const ACTION_SELL = 1024;

const KEY_ACTIONS = {
  Space: ACTION_CONFIRM,
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyW: ACTION_WAVE,
  KeyF: ACTION_SPEED,
  KeyM: ACTION_MUTE,
  Digit1: ACTION_BUILD_1,
  Digit2: ACTION_BUILD_2,
  Digit3: ACTION_BUILD_3,
  KeyU: ACTION_UPGRADE,
  KeyX: ACTION_SELL,
};

export function createInput(canvas, toLogical) {
  let actions = 0;
  /** Queued clicks in logical coordinates, drained by takeClicks. */
  const clicks = [];
  /** Latest pointer position in logical coordinates (null until the pointer moves). */
  let pointer = null;
  let pointerDown = false;

  function logicalFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return toLogical(event.clientX - rect.left, event.clientY - rect.top);
  }

  canvas.addEventListener('pointermove', (event) => {
    pointer = logicalFromEvent(event);
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointer = logicalFromEvent(event);
    pointerDown = true;
    clicks.push({ x: pointer.x, y: pointer.y });
    event.preventDefault();
  });
  canvas.addEventListener('pointerup', () => {
    pointerDown = false;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
    pointerDown = false;
  });

  window.addEventListener('keydown', (event) => {
    const action = KEY_ACTIONS[event.code];
    if (action) {
      actions |= action;
      event.preventDefault();
    }
  });
  // Space/Enter scrolling the page is blocked above; arrows are not used by the game.

  return {
    get pointer() { return pointer; },
    get pointerDown() { return pointerDown; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
