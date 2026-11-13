(() => {
  const canvas = document.getElementById('ascii');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const chars = ' .:-=+*#%@';
  let width = 0, height = 0, dpr = 1, cols = 0, rows = 0, frameId = 0;
  let paused = reduced.matches, last = 0, pointer = { x: 0.5, y: 0.5, active: false };
  const cellW = 8, cellH = 14;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / cellW);
    rows = Math.ceil(height / cellH);
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';
  }
  function draw(now) {
    frameId = 0;
    if (paused || document.hidden) return;
    if (now - last < 50) { frameId = requestAnimationFrame(draw); return; }
    last = now;
    ctx.fillStyle = '#050907';
    ctx.fillRect(0, 0, width, height);
    const t = now * 0.00022;
    ctx.fillStyle = 'rgba(165, 255, 159, 0.62)';
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const nx = x / cols, ny = y / rows;
        const dx = nx - (pointer.active ? pointer.x : 0.5);
        const dy = ny - (pointer.active ? pointer.y : 0.5);
        const radius = Math.hypot(dx, dy);
        const wave = Math.sin(radius * 22 - t * 3.2 + Math.sin(nx * 8 + t) * 1.4)
          + Math.cos(ny * 18 + t * 2.0 + Math.sin(radius * 15 - t) * 1.1);
        const fade = Math.max(0, Math.min(1, (radius - 0.12) * 2.2));
        const value = Math.max(0, Math.min(chars.length - 1, Math.floor((wave + 2) * 2.3 * fade)));
        line += chars[value];
      }
      ctx.fillText(line, 0, y * cellH);
    }
    frameId = requestAnimationFrame(draw);
  }
  function start() { if (!paused && !document.hidden && !frameId) frameId = requestAnimationFrame(draw); }
  function stop() { if (frameId) cancelAnimationFrame(frameId); frameId = 0; }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', e => { pointer.x = e.clientX / width; pointer.y = e.clientY / height; pointer.active = true; }, { passive: true });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  reduced.addEventListener('change', e => { paused = e.matches; paused ? stop() : start(); });
  resize();
  start();
})();
