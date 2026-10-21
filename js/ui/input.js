// Pointer (mouse/touch/pen) + keyboard → semantic callbacks.

export function bindInput(canvas, handlers) {
  let downAt = null;

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') handlers.hover(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') handlers.hover(-1, -1);
  });
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.offsetX, y: e.offsetY, t: performance.now(), type: e.pointerType };
    handlers.anyInput();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const dx = e.offsetX - downAt.x;
    const dy = e.offsetY - downAt.y;
    if (dx * dx + dy * dy < 24 * 24) handlers.tap(e.offsetX, e.offsetY, downAt.type);
    downAt = null;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    handlers.anyInput();
    const k = e.key;
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
      Enter: 'throw', ' ': 'end', e: 'end', E: 'end', z: 'undo', Z: 'undo', Backspace: 'undo',
      Escape: 'menu', t: 'tip', T: 'tip', Tab: 'nextSlot', i: 'intents', I: 'intents',
    };
    if (k >= '1' && k <= '4') {
      handlers.key('slot', Number(k) - 1);
      e.preventDefault();
      return;
    }
    const cmd = map[k];
    if (!cmd) return;
    if (handlers.key(cmd) !== false) e.preventDefault();
  });
}
