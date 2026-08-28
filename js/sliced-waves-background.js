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
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16)
  ];
}

function mixColor(a, b, amount) {
  const t = clamp(amount);
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function tuneColor(rgb, brightness, contrast) {
  return rgb.map((channel) => {
    let value = (channel / 255) * brightness;
    value = (value - 0.5) * contrast + 0.5;
    return Math.round(clamp(value) * 255);
  });
}

function createNoisePattern(ctx, intensity) {
  const size = 112;
  const noise = document.createElement('canvas');
  noise.width = size;
  noise.height = size;
  const nctx = noise.getContext('2d');
  if (!nctx) return null;

  const image = nctx.createImageData(size, size);
  const alphaScale = Math.round(255 * clamp(intensity, 0, 0.2));
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = Math.random() > 0.5 ? 255 : 0;
    image.data[i] = shade;
    image.data[i + 1] = shade;
    image.data[i + 2] = shade;
    image.data[i + 3] = Math.round(Math.random() * alphaScale);
  }
  nctx.putImageData(image, 0, 0);
  return ctx.createPattern(noise, 'repeat');
}

function initSlicedWaves() {
  const host = document.querySelector('#sliced-waves-background');
  if (!host) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const color1 = hexToRgb(CONFIG.color1);
  const color2 = hexToRgb(CONFIG.color2);
  const color3 = hexToRgb(CONFIG.color3);
  const noisePattern = CONFIG.grain ? createNoisePattern(ctx, CONFIG.grainIntensity) : null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let cssWidth = 1;
  let cssHeight = 1;
  let dpr = 1;
  let raf = 0;
  let startedAt = performance.now();
  let pageVisible = !document.hidden;
  let currentMouse = { x: 0.5, y: 0.5, active: 0 };
  let targetMouse = { x: 0.5, y: 0.5, active: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssWidth = Math.max(1, window.innerWidth);
    cssHeight = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function mouseInfluence(cx, cy) {
    if (!CONFIG.mouseInteraction || currentMouse.active <= 0.001) return 0;
    const dx = cx / cssWidth - currentMouse.x;
    const dy = cy / cssHeight - currentMouse.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= CONFIG.mouseRadius) return 0;
    const normalized = 1 - dist / Math.max(CONFIG.mouseRadius, 0.001);
    const eased = normalized * normalized * (3 - 2 * normalized);
    return eased * CONFIG.mouseStrength * currentMouse.active;
  }

  function draw(time) {
    const elapsed = (time - startedAt) / 1000;
    const speed = reduceMotion.matches ? CONFIG.speed * 0.25 : CONFIG.speed;
    const phaseTime = elapsed * speed * Math.PI * 2;

    currentMouse.x += (targetMouse.x - currentMouse.x) * 0.055;
    currentMouse.y += (targetMouse.y - currentMouse.y) * 0.055;
    currentMouse.active += (targetMouse.active - currentMouse.active) * 0.055;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const columns = Math.max(1, Math.round(CONFIG.columns));
    const rows = Math.max(1, Math.round(CONFIG.rows));
    const cellW = cssWidth / columns;
    const cellH = cssHeight / rows;
    const horizontal = CONFIG.orientation !== 'vertical';

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const waveId = horizontal ? col : row;
        const offsetId = horizontal ? row : col;
        const direction = CONFIG.alternate && offsetId % 2 === 1 ? -1 : 1;
        const phase = phaseTime + waveId * CONFIG.waveSpread + Math.cos(offsetId * CONFIG.rowOffset);
        let movement = Math.sin(phase) * 0.5 + 0.5;
        if (direction < 0) movement = 1 - movement;

        const cellX = col * cellW;
        const cellY = row * cellH;
        const centerX = cellX + cellW * 0.5;
        const centerY = cellY + cellH * 0.5;
        const influence = mouseInfluence(centerX, centerY);
        const thicknessRatio = clamp(CONFIG.barThickness + influence * 0.25, 0.02, 0.95);

        const along = horizontal ? centerX / cssWidth : centerY / cssHeight;
        const baseTint = mixColor(color2, color1, movement);
        const mixed = mixColor(baseTint, color3, clamp(along) * 0.45);
        const tuned = tuneColor(mixed, CONFIG.brightness * (1 + influence * 0.16), CONFIG.contrast);
        const alpha = CONFIG.opacity * (0.8 + influence * 0.2);
        ctx.fillStyle = `rgba(${tuned[0]}, ${tuned[1]}, ${tuned[2]}, ${alpha})`;

        if (horizontal) {
          const barH = Math.max(1.5, cellH * thicknessRatio);
          const travelPx = cellH * CONFIG.travel;
          const offset = (0.5 - movement) * travelPx;
          const x = cellX + cellW * 0.045;
          const y = centerY + offset - barH * 0.5;
          const w = cellW * 0.91;
          const radius = Math.max(1, barH * (0.28 + CONFIG.softness));
          ctx.beginPath();
          ctx.roundRect(x, y, w, barH, radius);
          ctx.fill();
        } else {
          const barW = Math.max(1.5, cellW * thicknessRatio);
          const travelPx = cellW * CONFIG.travel;
          const offset = (0.5 - movement) * travelPx;
          const x = centerX + offset - barW * 0.5;
          const y = cellY + cellH * 0.045;
          const h = cellH * 0.91;
          const radius = Math.max(1, barW * (0.28 + CONFIG.softness));
          ctx.beginPath();
          ctx.roundRect(x, y, barW, h, radius);
          ctx.fill();
        }
      }
    }

    if (noisePattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = noisePattern;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.restore();
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
    targetMouse.x = clamp(event.clientX / Math.max(cssWidth, 1));
    targetMouse.y = clamp(event.clientY / Math.max(cssHeight, 1));
    targetMouse.active = 1;
  }

  function onPointerOut(event) {
    if (event.relatedTarget) return;
    targetMouse.active = 0;
  }

  function onVisibilityChange() {
    pageVisible = !document.hidden;
    if (pageVisible) start();
    else stop();
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerout', onPointerOut, { passive: true });
  window.addEventListener('blur', () => { targetMouse.active = 0; }, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSlicedWaves, { once: true });
} else {
  initSlicedWaves();
}
