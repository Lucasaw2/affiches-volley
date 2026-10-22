/*
 * Moteur de rendu : dessine une affiche dans un <canvas> à partir des données
 * du formulaire et de la mise en page de js/config.js. Les tailles s'adaptent
 * toutes seules (scores à 1 ou 2 chiffres, noms d'équipe longs...).
 */
(function () {
  const CFG = window.FC_CONFIG;
  const SYSTEM_FALLBACK = {
    impact: 'Impact, "Arial Black", sans-serif',
    arial: 'Arial, Helvetica, sans-serif',
    arialBold: 'Arial, Helvetica, sans-serif',
  };
  const loaded = {};   // police -> fichier réellement utilisé (ou null)
  const ratios = {};   // police -> { cap } hauteur de majuscule en proportion de la taille
  let fontsPromise = null;

  async function loadFont(def) {
    for (const entry of def.files) {
      const file = typeof entry === 'string' ? { url: entry } : entry;
      try {
        const face = new FontFace(def.family, `url("${file.url}")`, { weight: def.weight });
        await face.load();
        document.fonts.add(face);
        return file;
      } catch (e) { /* fichier absent : on essaie le suivant */ }
    }
    return null;
  }

  // Réglages propres à la police réellement chargée (police de remplacement).
  const stretchOf = (key) => (loaded[key] && loaded[key].stretch) || 1;
  const sizeAdjustOf = (key) => (loaded[key] && loaded[key].sizeAdjust) || 1;
  const trackingOf = (key, fallback) => (loaded[key] && loaded[key].tracking != null ? loaded[key].tracking : fallback);

  function font(key, px) {
    const def = CFG.fonts[key];
    const weight = key === 'arialBold' && !loaded[key] ? 'bold ' : '';
    const family = loaded[key] ? `"${def.family}", ${SYSTEM_FALLBACK[key]}` : SYSTEM_FALLBACK[key];
    return `${weight}${(px * sizeAdjustOf(key)).toFixed(2)}px ${family}`;
  }

  // Approche Photoshop (1/1000 de cadratin) -> px, pour une taille donnée.
  const trackPx = (key, tracking, size) => (trackingOf(key, tracking || 0) / 1000) * size * sizeAdjustOf(key);

  window.FC_loadFonts = function () {
    if (!fontsPromise) {
      fontsPromise = Promise.all(Object.entries(CFG.fonts).map(async ([key, def]) => {
        loaded[key] = await loadFont(def);
      })).then(() => {
        const ctx = document.createElement('canvas').getContext('2d');
        for (const key of Object.keys(CFG.fonts)) {
          ctx.font = font(key, 100);
          ratios[key] = { cap: ctx.measureText('H').actualBoundingBoxAscent / 100 };
        }
        return { ...loaded };
      });
    }
    return fontsPromise;
  };

  // Mesure un texte avec espacement des lettres (le kerning est conservé).
  // Début de la lettre i = largeur du texte jusqu'à i inclus - largeur de la lettre i seule :
  // ainsi le crénage d'une paire (ex. « To ») s'applique bien entre ces deux lettres.
  function measure(ctx, text, tracking) {
    const chars = Array.from(text);
    const xs = chars.map((ch, i) =>
      ctx.measureText(chars.slice(0, i + 1).join('')).width - ctx.measureText(ch).width + i * tracking);
    let left = Infinity, right = -Infinity, ascent = 0, descent = 0;
    chars.forEach((ch, i) => {
      if (!ch.trim()) return;
      const m = ctx.measureText(ch);
      left = Math.min(left, xs[i] - m.actualBoundingBoxLeft);
      right = Math.max(right, xs[i] + m.actualBoundingBoxRight);
      ascent = Math.max(ascent, m.actualBoundingBoxAscent);
      descent = Math.max(descent, m.actualBoundingBoxDescent);
    });
    if (left === Infinity) { left = 0; right = 0; }
    return { text, chars, xs, tracking, left, right, width: right - left, ascent, descent };
  }

  // Épaississement du texte en px (imite le lissage "Fort" de Photoshop).
  let boost = 0;

  // Dessine un texte mesuré : le bord gauche de l'encre est placé en inkLeft.
  function draw(ctx, m, inkLeft, baseline) {
    const ox = inkLeft - m.left;
    const put = (text, x) => {
      ctx.fillText(text, x, baseline);
      if (boost) {
        ctx.lineWidth = boost;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = ctx.fillStyle;
        ctx.strokeText(text, x, baseline);
      }
    };
    if (!m.tracking) { put(m.text, ox); return; }
    m.chars.forEach((ch, i) => put(ch, ox + m.xs[i]));
  }

  // Version élargie horizontalement (m.width est déjà multipliée par sx).
  function drawStretched(ctx, m, inkLeft, baseline, sx) {
    if (sx === 1) { draw(ctx, m, inkLeft, baseline); return; }
    ctx.save();
    ctx.translate(inkLeft, 0);
    ctx.scale(sx, 1);
    draw(ctx, m, 0, baseline);
    ctx.restore();
  }

  function drawCover(ctx, src, W, H) {
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    const k = Math.max(W / sw, H / sh);
    const dw = sw * k, dh = sh * k;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  /**
   * data = { type: 'set'|'match', set, label, team1, team2, score1, score2 }
   */
  window.FC_renderPoster = async function (canvas, data, formatKey) {
    const type = CFG.types[data.type] || CFG.types.match;
    const fmt = CFG.formats[formatKey];
    const lay = type.layouts[formatKey];
    const st = CFG.style;
    const [, bg] = await Promise.all([window.FC_loadFonts(), window.FC_getBackground(formatKey, fmt)]);

    const W = fmt.width, H = fmt.height, cx = W / 2;
    const margin = fmt.margin;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    drawCover(ctx, bg.source, W, H);

    // Texte centré sur une ligne de base, réduit s'il dépasse les marges.
    const centered = (key, text) => {
      const spec = lay[key], style = st[key];
      let size = spec.size;
      ctx.font = font(style.font, size);
      let m = measure(ctx, text, trackPx(style.font, spec.tracking, size));
      if (m.width > W - 2 * margin) {
        size *= (W - 2 * margin) / m.width;
        ctx.font = font(style.font, size);
        m = measure(ctx, text, trackPx(style.font, spec.tracking, size));
      }
      ctx.fillStyle = style.color;
      boost = style.boost || 0;
      draw(ctx, m, cx - m.width / 2, spec.y);
      boost = 0;
    };

    const label = (data.label || '').trim().toUpperCase();
    if (label) centered('label', label);                                // OPEN 4
    centered('title', type.title);                                      // FIN
    centered('subtitle', type.subtitle.replace('{set}', data.set || 1)); // DU SET x / DU MATCH

    // Score. Deux façons de l'aligner (style.score.align) :
    //  - 'columns' : deux colonnes de même largeur, tiret au centre, chaque score
    //                placé dans sa colonne ("25 - 7" reste symétrique) ;
    //  - 'group'   : le bloc "25 - 7" entier est centré, collé au tiret.
    const sc = lay.score, ss = st.score;
    const columns = (ss.align || 'columns') === 'columns';
    const sx = stretchOf(ss.font);
    // "7" -> "07" si le type impose 2 chiffres : les deux scores ont alors la même largeur.
    const digits = (v) => {
      const str = String(v ?? '');
      return str && type.scoreDigits ? str.padStart(type.scoreDigits, '0') : str;
    };
    let k = 1; // réduction si les scores sont trop larges
    const measureScore = () => {
      ctx.font = font(ss.font, sc.size * k);
      const t = trackPx(ss.font, sc.tracking, sc.size * k);
      const widen = (m) => ({ ...m, width: m.width * sx });
      return {
        home: widen(measure(ctx, digits(data.score1), t)),
        away: widen(measure(ctx, digits(data.score2), t)),
        zero: ctx.measureText('0'),
        dashW: sc.dash.width * k,
      };
    };
    const colOf = (m, side) => (columns ? Math.max(m.home.width, m.away.width) : m[side].width);
    const groupWidth = (m) => colOf(m, 'home') + m.dashW + colOf(m, 'away') + 2 * sc.gap * k;
    let sm = measureScore();
    const fullAsc = sm.zero.actualBoundingBoxAscent;
    if (groupWidth(sm) > W - 2 * margin) {
      k = (W - 2 * margin) / groupWidth(sm);
      sm = measureScore();
    }
    // Si le score a été réduit, il reste centré verticalement au même endroit.
    const midY = sc.y - fullAsc / 2;
    const baseline = midY + sm.zero.actualBoundingBoxAscent / 2;
    const gap = sc.gap * k;
    const groupLeft = cx - groupWidth(sm) / 2;
    const groupRight = cx + groupWidth(sm) / 2;
    const dashLeft = groupLeft + colOf(sm, 'home') + gap;
    const pull = ss.pull || 0;
    const homeLeft = groupLeft + (colOf(sm, 'home') - sm.home.width) * (1 + pull) / 2;
    const homeRight = homeLeft + sm.home.width;
    const awayLeft = dashLeft + sm.dashW + gap + (colOf(sm, 'away') - sm.away.width) * (1 - pull) / 2;
    ctx.fillStyle = ss.color;
    drawStretched(ctx, sm.home, homeLeft, baseline, sx);
    drawStretched(ctx, sm.away, awayLeft, baseline, sx);
    const dashMid = midY + (sc.dash.y + sc.dash.height / 2 - midY) * k;
    const dashH = sc.dash.height * k;
    ctx.fillRect(dashLeft, dashMid - dashH / 2, sm.dashW, dashH);

    // Noms des équipes, centrés sous leur score. Un nom trop long passe sur
    // 2 lignes ; les deux noms gardent toujours la même taille.
    const tl = lay.teams, ts = st.teams;
    const gutter = ts.gutter || 0;
    const colW = cx - gutter - margin;
    ctx.font = font(ts.font, tl.size);
    const widthOf = (t) => measure(ctx, t, trackPx(ts.font, tl.tracking, tl.size)).width;
    const planTeam = (name) => {
      name = (name || '').trim();
      if (!name) return null;
      const oneW = widthOf(name);
      if (oneW <= colW) return { lines: [name], k: 1 };
      let best = null;
      for (let i = 1; i < name.length - 1; i++) {
        const ch = name[i];
        if (ch !== ' ' && ch !== '-') continue;
        const lines = [name.slice(0, ch === '-' ? i + 1 : i).trim(), name.slice(i + 1).trim()];
        const w = Math.max(widthOf(lines[0]), widthOf(lines[1]));
        if (!best || w < best.w) best = { lines, w };
      }
      const k1 = colW / oneW;
      if (best && k1 < 0.8) return { lines: best.lines, k: Math.min(1, colW / best.w) };
      return { lines: [name], k: k1 };
    };
    const plans = [planTeam(data.team1), planTeam(data.team2)];
    const tk = Math.min(1, ...plans.filter(Boolean).map((p) => p.k));
    const teamSize = tl.size * tk;
    ctx.font = font(ts.font, teamSize);
    const lineGap = ratios[ts.font].cap * teamSize * sizeAdjustOf(ts.font) * 1.5;
    const placeTeam = (plan, scoreCenter, minX, maxX) => {
      if (!plan) return null;
      const ms = plan.lines.map((t) => measure(ctx, t, trackPx(ts.font, tl.tracking, teamSize)));
      const width = Math.max(...ms.map((m) => m.width));
      const left = Math.min(Math.max(scoreCenter - width / 2, minX), maxX - width);
      return { ms, width, left, right: left + width };
    };
    const homeCenter = sm.home.width ? homeRight - sm.home.width / 2 : cx - colW / 2;
    const awayCenter = sm.away.width ? awayLeft + sm.away.width / 2 : cx + colW / 2;
    const t1 = placeTeam(plans[0], homeCenter, margin, cx - gutter);
    const t2 = placeTeam(plans[1], awayCenter, cx + gutter, W - margin);
    ctx.fillStyle = ts.color;
    boost = ts.boost || 0;
    for (const t of [t1, t2]) {
      if (!t) continue;
      t.ms.forEach((m, i) => draw(ctx, m, t.left + (t.width - m.width) / 2, tl.y + i * lineGap));
    }
    boost = 0;

    // Trait horizontal : longueur fixe, ou englobe les scores et les noms.
    const ln = lay.line;
    let half;
    if (ln.width) {
      half = ln.width / 2;
    } else {
      const lefts = [groupLeft, t1 && t1.left].filter((v) => v != null);
      const rights = [groupRight, t2 && t2.right].filter((v) => v != null);
      half = Math.max(cx - Math.min(...lefts), Math.max(...rights) - cx) + (ln.padding || 0);
    }
    half = Math.min(half, cx - margin / 2);
    ctx.fillStyle = st.line.color;
    ctx.fillRect(Math.round(cx - half), Math.round(ln.y), Math.round(half * 2), Math.max(1, Math.round(ln.thickness)));

    return canvas;
  };

  window.FC_fontInfo = () => ({ ...loaded });
})();
