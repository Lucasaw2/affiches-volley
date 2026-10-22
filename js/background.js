/*
 * Fonds des affiches.
 * Utilise l'image du dossier assets/ si elle existe, sinon génère un fond
 * bleu "soie + fumée". La génération est déterministe (même résultat sur
 * PC et téléphone), ce qui est indispensable pour le lien du QR code.
 */
(function () {
  const cache = {};

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bruit de Perlin 2D classique.
  function makeNoise(seed) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(512);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const grad = (h, x, y) => {
      switch (h & 7) {
        case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
        case 4: return x; case 5: return -x; case 6: return y; default: return -y;
      }
    };
    return function (x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const a = p[X] + Y, b = p[X + 1] + Y;
      const n00 = grad(p[a], x, y), n10 = grad(p[b], x - 1, y);
      const n01 = grad(p[a + 1], x, y - 1), n11 = grad(p[b + 1], x - 1, y - 1);
      const nx0 = n00 + u * (n10 - n00), nx1 = n01 + u * (n11 - n01);
      return nx0 + v * (nx1 - nx0); // ~[-1, 1]
    };
  }

  function fbm(noise, x, y, octaves) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x * freq, y * freq);
      freq *= 2.03; amp *= 0.5;
    }
    return sum;
  }

  const smooth = (a, b, t) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Flou "gaussien" (3 flous en boîte successifs) sur une image opaque.
  function blurOpaque(img, w, h, r) {
    const src = img.data;
    let a = new Float32Array(w * h * 3), b = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      a[i * 3] = src[i * 4]; a[i * 3 + 1] = src[i * 4 + 1]; a[i * 3 + 2] = src[i * 4 + 2];
    }
    const pass = (from, to, len, count, stride, step) => {
      const norm = 1 / (2 * r + 1);
      for (let line = 0; line < count; line++) {
        const base = line * stride;
        for (let k = 0; k < 3; k++) {
          const at = (i) => from[(base + Math.min(len - 1, Math.max(0, i)) * step) * 3 + k];
          let sum = 0;
          for (let i = -r; i <= r; i++) sum += at(i);
          for (let i = 0; i < len; i++) {
            to[(base + i * step) * 3 + k] = sum * norm;
            sum += at(i + r + 1) - at(i - r);
          }
        }
      }
    };
    for (let p = 0; p < 3; p++) {
      pass(a, b, w, h, w, 1); // horizontal
      pass(b, a, h, w, 1, w); // vertical
    }
    for (let i = 0; i < w * h; i++) {
      src[i * 4] = a[i * 3]; src[i * 4 + 1] = a[i * 3 + 1]; src[i * 4 + 2] = a[i * 3 + 2]; src[i * 4 + 3] = 255;
    }
  }

  // Dessine en basse résolution, floute, puis agrandit par paliers :
  // donne un rendu très doux, identique sur tous les navigateurs.
  function softLayer(ctx, W, H, div, alpha, draw, blur = 0) {
    let c = makeCanvas(Math.ceil(W / div), Math.ceil(H / div));
    const g = c.getContext('2d');
    g.save();
    g.scale(c.width / W, c.height / H);
    draw(g);
    g.restore();
    if (blur) {
      const img = g.getImageData(0, 0, c.width, c.height);
      blurOpaque(img, c.width, c.height, Math.max(1, Math.round(blur / div)));
      g.putImageData(img, 0, 0);
    }
    while (c.width * 2 < W) {
      const n = makeCanvas(c.width * 2, c.height * 2);
      const ng = n.getContext('2d');
      ng.imageSmoothingEnabled = true;
      ng.imageSmoothingQuality = 'high';
      ng.drawImage(c, 0, 0, n.width, n.height);
      c.width = 0;
      c = n;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, W, H);
    ctx.restore();
    c.width = 0;
  }

  // Plis de "soie" bleus.
  function drawSilk(ctx, W, H, recipe) {
    const stroke = (g, pts, width, color, alpha) => {
      g.save();
      g.globalAlpha = alpha;
      g.strokeStyle = color;
      g.lineWidth = width * W;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(pts[0] * W, pts[1] * H);
      g.bezierCurveTo(pts[2] * W, pts[3] * H, pts[4] * W, pts[5] * H, pts[6] * W, pts[7] * H);
      g.stroke();
      g.restore();
    };
    const glow = (g, x, y, r, color) => {
      const grd = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
      grd.addColorStop(0, color);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    };

    softLayer(ctx, W, H, 4, 1, (g) => {
      const base = g.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, '#03174a');
      base.addColorStop(0.5, '#010b2b');
      base.addColorStop(1, '#03144a');
      g.fillStyle = base;
      g.fillRect(0, 0, W, H);
      for (const gl of recipe.glows) glow(g, gl.x, gl.y, gl.r, gl.color);
      for (const w of recipe.waves) stroke(g, w.pts, w.width, w.color, w.alpha);
      for (const w of recipe.waves) if (w.sheen) stroke(g, w.pts, w.width * 0.22, '#8fe3ff', w.sheen);
    }, recipe.blur || 34);
  }

  // Fumée bleue claire dans les coins (bruit fractal + masque radial).
  function drawSmoke(ctx, W, H, spots, seed) {
    const div = 3;
    const w = Math.ceil(W / div), h = Math.ceil(H / div);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const d = img.data;
    const noise = makeNoise(seed);
    const noise2 = makeNoise(seed + 101);
    const sc = 3.4 / w; // échelle du bruit

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fx = x / w, fy = (y * div) / W; // coordonnées en "largeurs"
        // masque : somme des taches de fumée
        let m = 0;
        for (const s of spots) {
          const dx = fx - s.x, dy = fy - s.y * (H / W);
          const dist = Math.sqrt(dx * dx + dy * dy) / s.r;
          m = Math.max(m, 1 - dist);
        }
        if (m <= -0.25) continue;
        const nx = x * sc, ny = y * sc;
        const wx = fbm(noise2, nx * 0.8, ny * 0.8, 3);
        const wy = fbm(noise2, nx * 0.8 + 5.2, ny * 0.8 + 1.3, 3);
        const n = fbm(noise, nx + wx * 0.7, ny + wy * 0.7, 6) * 0.5 + 0.5; // 0..1
        const dens = smooth(0.4, 0.72, n + m * 0.6 - 0.2);
        if (dens <= 0) continue;
        const detail = fbm(noise, nx * 2.2 + 9, ny * 2.2 + 3, 4) * 0.5 + 0.5;
        const light = smooth(0.25, 0.85, detail * 0.6 + n * 0.6 - 0.1);
        const i = (y * w + x) * 4;
        d[i] = 20 + 110 * light;
        d[i + 1] = 120 + 105 * light;
        d[i + 2] = 200 + 55 * light;
        d[i + 3] = Math.min(255, dens * 225);
      }
    }
    g.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, W, H);
  }

  // Coordonnées en proportion de la largeur (x) et de la hauteur (y).
  const RECIPES = {
    post: {
      glows: [
        { x: 0.95, y: 0.12, r: 0.75, color: 'rgba(16,86,225,0.85)' },
        { x: 0.15, y: 0.95, r: 0.7, color: 'rgba(0,150,255,0.7)' },
        { x: 0.75, y: 0.62, r: 0.45, color: 'rgba(0,120,240,0.55)' },
      ],
      waves: [
        { pts: [-0.15, 0.28, 0.3, 0.48, 0.6, 0.0, 1.15, 0.2], width: 0.2, color: '#0f5be0', alpha: 0.75 },
        { pts: [-0.15, 0.92, 0.25, 0.6, 0.55, 0.98, 1.15, 0.58], width: 0.17, color: '#0cb4ff', alpha: 0.9, sheen: 0.45 },
        { pts: [-0.15, 0.58, 0.3, 0.38, 0.65, 0.82, 1.15, 0.4], width: 0.14, color: '#010923', alpha: 0.85 },
        { pts: [-0.15, 0.08, 0.35, 0.22, 0.6, -0.08, 1.15, 0.02], width: 0.1, color: '#010923', alpha: 0.7 },
      ],
      smoke: [
        { x: -0.02, y: -0.02, r: 0.42 }, { x: -0.05, y: 0.55, r: 0.2 },
        { x: 1.05, y: 1.02, r: 0.62 }, { x: 0.55, y: 1.08, r: 0.32 }, { x: 1.05, y: 0.62, r: 0.22 },
      ],
      seed: 4,
    },
    story: {
      glows: [
        { x: 0.95, y: 0.1, r: 0.8, color: 'rgba(16,86,225,0.85)' },
        { x: 0.2, y: 0.9, r: 0.8, color: 'rgba(0,150,255,0.7)' },
        { x: 0.8, y: 0.55, r: 0.5, color: 'rgba(0,120,240,0.55)' },
      ],
      waves: [
        { pts: [-0.15, 0.24, 0.3, 0.38, 0.6, 0.02, 1.15, 0.16], width: 0.22, color: '#0f5be0', alpha: 0.75 },
        { pts: [-0.15, 0.74, 0.25, 0.5, 0.55, 0.8, 1.15, 0.48], width: 0.19, color: '#0cb4ff', alpha: 0.9, sheen: 0.45 },
        { pts: [-0.15, 0.5, 0.3, 0.34, 0.65, 0.66, 1.15, 0.34], width: 0.15, color: '#010923', alpha: 0.85 },
        { pts: [-0.15, 0.95, 0.4, 0.8, 0.7, 1.0, 1.15, 0.84], width: 0.16, color: '#0a6fe0', alpha: 0.7 },
      ],
      smoke: [
        { x: -0.02, y: 0.0, r: 0.62 }, { x: 1.05, y: 0.04, r: 0.3 }, { x: -0.04, y: 0.58, r: 0.24 },
        { x: 0.5, y: 1.1, r: 0.8 }, { x: 1.05, y: 0.72, r: 0.3 },
      ],
      seed: 7,
    },
  };

  function generate(formatKey, fmt) {
    const W = fmt.width, H = fmt.height;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const recipe = RECIPES[formatKey] || RECIPES.post;
    drawSilk(ctx, W, H, recipe);
    drawSmoke(ctx, W, H, recipe.smoke, recipe.seed);
    return c;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function drawLayer(ctx, img, layer, W, H) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.globalCompositeOperation = layer.blend || 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (layer.x == null && layer.y == null) {
      // remplit toute l'affiche (recadrage centré)
      const k = Math.max(W / iw, H / ih);
      ctx.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
    } else {
      const s = layer.scale ?? 1;
      ctx.drawImage(img, layer.x || 0, layer.y || 0, layer.width ?? iw * s, layer.height ?? ih * s);
    }
    ctx.restore();
  }

  /**
   * Retourne { source, generated } : le fond complet (calques assemblés) du format.
   * fmt peut contenir des réglages propres au type d'affiche.
   */
  window.FC_getBackground = function (formatKey, fmt) {
    fmt = fmt || window.FC_CONFIG.formats[formatKey];
    const layers = typeof fmt.background === 'string' ? [{ src: fmt.background }] : (fmt.background || []);
    const key = `${formatKey}|${fmt.width}x${fmt.height}|${JSON.stringify(layers)}`;
    if (!cache[key]) {
      cache[key] = Promise.all(layers.map((l) => loadImage(l.src))).then((imgs) => {
        if (!imgs[0]) return { source: generate(formatKey, fmt), generated: true };
        const c = makeCanvas(fmt.width, fmt.height);
        const ctx = c.getContext('2d');
        layers.forEach((layer, i) => { if (imgs[i]) drawLayer(ctx, imgs[i], layer, fmt.width, fmt.height); });
        return { source: c, generated: false };
      });
    }
    return cache[key];
  };
})();
