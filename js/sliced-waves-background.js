const CONFIG = {
  color1: '#EAB308',
  color2: '#10B981',
  color3: '#cb1f3d',
  columns: 14,
  rows: 8,
  barThickness: 0.1,
  speed: 0.25,
  travel: 0.55,
  waveSpread: 0.9,
  rowOffset: 0.7,
  softness: 0.05,
  glow: 0,
  brightness: 1,
  contrast: 1,
  opacity: 0.5,
  orientation: 'horizontal',
  alternate: false,
  mouseInteraction: true,
  mouseStrength: 1,
  mouseRadius: 0.3,
  grain: true,
  grainIntensity: 0.05
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return [255, 255, 255];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function mixColor(a, b, amount) {
  const t = clamp(amount);
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function initSlicedWaves() {
  const host = document.querySelector('#sliced-waves-background');
  if (!host) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'sliced-waves-canvas';
  host.append(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    host.classList.add('is-fallback-only');
    return;
  }

  const color1 = hexToRgb(CONFIG.color1);
  const color2 = hexToRgb(CONFIG.color2);
  const color3 = hexToRgb(CONFIG.color3);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let width = 1;
  let height = 1;
  let dpr = 1;
  let raf = 0;
  let startedAt = performance.now();
  let pageVisible = !document.hidden;
  let currentMouse = { x: 0.5, y: 0.5, active: 0 };
  let targetMouse = { x: 0.5, y: 0.5, active: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pointerInfluence(x, y) {
    if (!CONFIG.mouseInteraction || currentMouse.active < 0.001) return 0;
    const dx = x / width - currentMouse.x;
    const dy = y / height - currentMouse.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= CONFIG.mouseRadius) return 0;
    const t = 1 - distance / CONFIG.mouseRadius;
    return t * t * (3 - 2 * t) * CONFIG.mouseStrength * currentMouse.active;
  }

  function draw(time) {
    try {
      const elapsed = (time - startedAt) / 1000;
      const speed = reducedMotion.matches ? CONFIG.speed * 0.2 : CONFIG.speed;
      const phaseTime = elapsed * speed * Math.PI * 2;

      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.06;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.06;
      currentMouse.active += (targetMouse.active - currentMouse.active) * 0.06;

      ctx.clearRect(0, 0, width, height);

      const columns = Math.max(1, Math.round(CONFIG.columns));
      const rows = Math.max(1, Math.round(CONFIG.rows));
      const cellW = width / columns;
      const cellH = height / rows;
      const horizontal = CONFIG.orientation !== 'vertical';

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const waveId = horizontal ? col : row;
          const offsetId = horizontal ? row : col;
          const phase = phaseTime + waveId * CONFIG.waveSpread + Math.cos(offsetId * CONFIG.rowOffset);
          let movement = Math.sin(phase) * 0.5 + 0.5;
          if (CONFIG.alternate && offsetId % 2 === 1) movement = 1 - movement;

          const cellX = col * cellW;
          const cellY = row * cellH;
          const centerX = cellX + cellW * 0.5;
          const centerY = cellY + cellH * 0.5;
          const influence = pointerInfluence(centerX, centerY);
          const thickness = clamp(CONFIG.barThickness + influence * 0.25, 0.025, 0.95);
          const along = horizontal ? centerX / width : centerY / height;

          const firstMix = mixColor(color2, color1, movement);
          const color = mixColor(firstMix, color3, clamp(along) * 0.45);
          const alpha = clamp(CONFIG.opacity * (0.9 + influence * 0.2), 0, 0.75);
          ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;

          if (horizontal) {
            const barH = Math.max(2, cellH * thickness);
            const travelPx = cellH * CONFIG.travel;
            const offset = (0.5 - movement) * travelPx;
            const x = cellX + cellW * 0.035;
            const y = centerY + offset - barH * 0.5;
            const barW = cellW * 0.93;
            ctx.fillRect(x, y, barW, barH);

            if (CONFIG.softness > 0) {
              ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.12})`;
              ctx.fillRect(x, y - barH * 0.45, barW, barH * 1.9);
            }
          } else {
            const barW = Math.max(2, cellW * thickness);
            const travelPx = cellW * CONFIG.travel;
            const offset = (0.5 - movement) * travelPx;
            const x = centerX + offset - barW * 0.5;
            const y = cellY + cellH * 0.035;
            const barH = cellH * 0.93;
            ctx.fillRect(x, y, barW, barH);
          }
        }
      }

      if (CONFIG.grain) {
        ctx.save();
        ctx.globalAlpha = CONFIG.grainIntensity * 0.34;
        for (let i = 0; i < 170; i += 1) {
          const shade = Math.random() > 0.5 ? 255 : 0;
          ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
          ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
        }
        ctx.restore();
      }

      host.classList.add('is-running');
    } catch (error) {
      console.warn('Sliced waves background fallback active', error);
      host.classList.add('is-fallback-only');
      raf = 0;
      return;
    }

    if (pageVisible) raf = requestAnimationFrame(draw);
  }

  function start() {
    if (raf || !pageVisible) return;
    startedAt = performance.now();
    raf = requestAnimationFrame(draw);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function onPointerMove(event) {
    targetMouse.x = clamp(event.clientX / Math.max(width, 1));
    targetMouse.y = clamp(event.clientY / Math.max(height, 1));
    targetMouse.active = 1;
  }

  function onPointerLeave() {
    targetMouse.active = 0;
  }

  function onVisibilityChange() {
    pageVisible = !document.hidden;
    pageVisible ? start() : stop();
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('blur', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSlicedWaves, { once: true });
} else {
  initSlicedWaves();
}
