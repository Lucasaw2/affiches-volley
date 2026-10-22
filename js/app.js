/*
 * Interface : choix du type, formulaire, aperçu en direct, mémoire des
 * dernières saisies, QR code et téléchargement / partage.
 */
(function () {
  const CFG = window.FC_CONFIG;
  const FORMAT_KEYS = Object.keys(CFG.formats);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  // ---------- Mémoire (localStorage) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* navigation privée */ }
    },
  };
  const LAST_KEY = 'fc.last';
  const TEAMS_KEY = 'fc.teams';

  function rememberedTeams() { return store.get(TEAMS_KEY, []); }

  function remember(st) {
    const last = store.get(LAST_KEY, {});
    store.set(LAST_KEY, {
      type: st.type, set: st.set, label: st.label,
      formatsByType: { ...(last.formatsByType || {}), [st.type]: st.formats },
      team1: st.team1, team2: st.team2, ts: Date.now(),
    });
    const teams = rememberedTeams().filter((t) => t !== st.team1 && t !== st.team2);
    [st.team2, st.team1].forEach((t) => { if (t) teams.unshift(t); });
    store.set(TEAMS_KEY, teams.slice(0, 30));
    fillTeamList();
  }

  function fillTeamList() {
    $('#team-list').innerHTML = rememberedTeams()
      .map((t) => `<option value="${t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"></option>`)
      .join('');
  }

  // ---------- État ----------
  let state = null;

  function freshState(type) {
    const last = store.get(LAST_KEY, {});
    const recent = last.ts && Date.now() - last.ts < 6 * 3600 * 1000;
    const savedFormats = ((last.formatsByType || {})[type] || []).filter((f) => CFG.formats[f]);
    return {
      type,
      set: type === 'set' && last.type === 'set' && recent ? Math.min((last.set || 0) + 1, 5) : 1,
      formats: savedFormats.length ? savedFormats : (CFG.types[type].defaultFormats || FORMAT_KEYS).slice(),
      label: last.label ?? CFG.defaults.label,
      team1: last.team1 ?? CFG.defaults.team1,
      team2: last.team2 ?? CFG.defaults.team2,
      score1: '',
      score2: '',
    };
  }

  // ---------- Lien partageable (QR code) ----------
  function toParams(st) {
    const p = new URLSearchParams();
    p.set('type', st.type);
    if (st.type === 'set') p.set('set', st.set);
    p.set('s1', st.score1);
    p.set('s2', st.score2);
    p.set('e1', st.team1);
    p.set('e2', st.team2);
    if (st.label) p.set('cat', st.label);
    p.set('f', st.formats.join(','));
    return p;
  }

  function fromParams(search) {
    const p = new URLSearchParams(search);
    const type = p.get('type');
    if (!CFG.types[type] || !p.has('s1') || !p.has('s2')) return null;
    const formats = (p.get('f') || '').split(',').filter((f) => CFG.formats[f]);
    return {
      type,
      set: Math.min(Math.max(parseInt(p.get('set'), 10) || 1, 1), 9),
      formats: formats.length ? formats : FORMAT_KEYS.slice(),
      label: p.get('cat') || '',
      team1: p.get('e1') || '',
      team2: p.get('e2') || '',
      score1: (p.get('s1') || '').replace(/\D/g, '').slice(0, 2),
      score2: (p.get('s2') || '').replace(/\D/g, '').slice(0, 2),
    };
  }

  function shareUrl(st) {
    return `${location.origin}${location.pathname}?${toParams(st).toString()}`;
  }

  // ---------- Navigation entre les étapes ----------
  function show(step) {
    $$('.step').forEach((s) => { s.hidden = s.id !== `step-${step}`; });
    window.scrollTo(0, 0);
  }

  function go(step, { replace = false } = {}) {
    const url = step === 'result' ? `?${toParams(state).toString()}` : location.pathname;
    history[replace ? 'replaceState' : 'pushState']({ step, state }, '', url);
    enter(step);
  }

  function enter(step) {
    if (step === 'form') { fillForm(); schedulePreview(); }
    if (step === 'result') buildResult();
    show(step);
  }

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.step) {
      if (e.state.state) state = e.state.state;
      enter(e.state.step);
    } else {
      show('home');
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go="home"]');
    if (t) { e.preventDefault(); go('home'); }
  });

  $$('.type-card').forEach((btn) => btn.addEventListener('click', () => {
    state = freshState(btn.dataset.type);
    go('form');
    setTimeout(() => $('#score1').focus({ preventScroll: true }), 50);
  }));

  // ---------- Formulaire ----------
  const form = $('#poster-form');

  function fillForm() {
    $('#form-title').textContent = CFG.types[state.type].name;
    $('#set-card').hidden = state.type !== 'set';
    $$('#set-chips .chip').forEach((c) => {
      const on = Number(c.dataset.set) === Number(state.set);
      c.classList.toggle('on', on);
      c.setAttribute('aria-checked', on);
      c.setAttribute('role', 'radio');
    });
    $$('input[name="format"]').forEach((cb) => { cb.checked = state.formats.includes(cb.value); });
    $('#label').value = state.label;
    $('#team1').value = state.team1;
    $('#team2').value = state.team2;
    $('#score1').value = state.score1;
    $('#score2').value = state.score2;
    $('#format-error').hidden = true;
    $('#score-error').hidden = true;
  }

  function readForm() {
    state.formats = $$('input[name="format"]:checked').map((cb) => cb.value);
    state.label = $('#label').value.trim();
    state.team1 = $('#team1').value.trim();
    state.team2 = $('#team2').value.trim();
    state.score1 = $('#score1').value.replace(/\D/g, '').slice(0, 2);
    state.score2 = $('#score2').value.replace(/\D/g, '').slice(0, 2);
  }

  form.addEventListener('input', (e) => {
    if (e.target.classList.contains('score-input')) {
      const clean = e.target.value.replace(/\D/g, '').slice(0, 2);
      if (clean !== e.target.value) e.target.value = clean;
    }
    readForm();
    if (state.formats.length) $('#format-error').hidden = true;
    schedulePreview();
  });

  $$('#set-chips .chip').forEach((chip) => chip.addEventListener('click', () => {
    state.set = Number(chip.dataset.set);
    fillForm();
    schedulePreview();
  }));

  $$('.step-btn').forEach((btn) => btn.addEventListener('click', () => {
    const input = $(`#${btn.dataset.step}`);
    const v = Math.min(99, Math.max(0, (parseInt(input.value, 10) || 0) + Number(btn.dataset.delta)));
    input.value = v;
    readForm();
    schedulePreview();
  }));

  $('#swap').addEventListener('click', () => {
    readForm();
    [state.team1, state.team2] = [state.team2, state.team1];
    [state.score1, state.score2] = [state.score2, state.score1];
    fillForm();
    schedulePreview();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    readForm();
    let ok = true;
    $('#format-error').hidden = state.formats.length > 0;
    if (!state.formats.length) ok = false;
    const scoresOk = state.score1 !== '' && state.score2 !== '';
    $('#score-error').hidden = scoresOk;
    if (!scoresOk) ok = false;
    if (!ok) {
      const err = $$('.field-error').find((el) => !el.hidden);
      if (err) err.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    remember(state);
    go('result');
  });

  // ---------- Aperçu en direct ----------
  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 60);
  }

  function posterData(st) {
    return {
      type: st.type, set: st.set, label: st.label, team1: st.team1, team2: st.team2,
      score1: st.score1 === '' ? '0' : st.score1,
      score2: st.score2 === '' ? '0' : st.score2,
    };
  }

  async function renderPreview() {
    const data = posterData(state);
    const shown = state.formats.length ? state.formats : FORMAT_KEYS;
    await Promise.all($$('.preview-item').map((fig) => {
      const key = fig.dataset.format;
      fig.hidden = !shown.includes(key);
      fig.classList.toggle('dim', !state.formats.includes(key));
      if (fig.hidden) return null;
      return window.FC_renderPoster($('canvas', fig), data, key);
    }));
  }

  // ---------- Résultat ----------
  let results = []; // { key, blob, url, name }

  function slug(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'equipe';
  }

  function fileName(st, key) {
    const what = st.type === 'set' ? `fin-set-${st.set}` : 'fin-match';
    return `${what}_${slug(st.team1)}-${st.score1}-${st.score2}-${slug(st.team2)}_${key}.${CFG.export.extension}`;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export impossible'))), CFG.export.type, CFG.export.quality);
    });
  }

  let resultToken = 0;
  async function buildResult() {
    const token = ++resultToken;
    const st = { ...state };
    const type = CFG.types[st.type];
    const digits = (v) => (type.scoreDigits ? String(v).padStart(type.scoreDigits, '0') : v);
    $('#result-sub').textContent =
      `${type.name}${st.type === 'set' ? ` ${st.set}` : ''} · ${st.team1 || '—'} ${digits(st.score1)} – ${digits(st.score2)} ${st.team2 || '—'}`;

    results.forEach((r) => URL.revokeObjectURL(r.url));
    results = [];
    const wrap = $('#result-images');
    wrap.innerHTML = st.formats.map((key) => `
      <figure class="result-item ${key}" data-format="${key}">
        <div class="result-img loading" style="aspect-ratio:${CFG.formats[key].width}/${CFG.formats[key].height}"></div>
        <figcaption>
          <span>${CFG.formats[key].name} <small>${CFG.formats[key].ratio}</small></span>
          <button type="button" class="ghost-btn small" data-dl="${key}" disabled>Télécharger</button>
        </figcaption>
      </figure>`).join('');

    renderQr(shareUrl(st));
    setupActions();

    for (const key of st.formats) {
      const canvas = document.createElement('canvas');
      try {
        await window.FC_renderPoster(canvas, posterData(st), key);
        const blob = await canvasToBlob(canvas);
        if (token !== resultToken) return;
        const r = { key, blob, url: URL.createObjectURL(blob), name: fileName(st, key) };
        results.push(r);
        const box = $(`.result-item[data-format="${key}"] .result-img`, wrap);
        box.classList.remove('loading');
        box.innerHTML = `<img src="${r.url}" alt="Affiche ${CFG.formats[key].name}">`;
        $(`[data-dl="${key}"]`, wrap).disabled = false;
      } catch (err) {
        console.error(err);
        toast("Erreur pendant la création de l'image");
      } finally {
        canvas.width = canvas.height = 0;
      }
    }
  }

  $('#result-images').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dl]');
    if (!btn) return;
    const r = results.find((x) => x.key === btn.dataset.dl);
    if (r) download(r);
  });

  function download(r) {
    const a = document.createElement('a');
    a.href = r.url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadAll() {
    if (!results.length) return;
    for (let i = 0; i < results.length; i++) {
      download(results[i]);
      if (i < results.length - 1) await new Promise((res) => setTimeout(res, 500));
    }
  }

  function shareFiles() {
    return results.map((r) => new File([r.blob], r.name, { type: r.blob.type }));
  }

  function canShareFiles() {
    try {
      const probe = new File([new Blob(['x'], { type: CFG.export.type })], `x.${CFG.export.extension}`, { type: CFG.export.type });
      return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch (e) { return false; }
  }

  async function share() {
    if (!results.length) return;
    let files = shareFiles();
    try {
      if (!navigator.canShare({ files })) files = files.slice(0, 1);
      await navigator.share({ files });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      downloadAll();
    }
  }

  function setupActions() {
    const sharing = isTouch && canShareFiles();
    const shareBtn = $('#share-btn');
    const dlBtn = $('#download-all');
    shareBtn.hidden = !sharing;
    $('#save-hint').hidden = !sharing;
    dlBtn.className = sharing ? 'ghost-btn wide' : 'primary-btn big';
    dlBtn.textContent = state.formats.length > 1 ? 'Télécharger les 2 images' : "Télécharger l'image";

    // Sur téléphone, le QR code est replié (on y est déjà).
    $('#qr-card').hidden = isTouch;
    $('#qr-toggle').hidden = !isTouch;
    $('#qr-toggle').textContent = 'Afficher le QR code';
    const host = location.hostname;
    $('#qr-local-warn').hidden = !(location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '');
  }

  $('#share-btn').addEventListener('click', share);
  $('#download-all').addEventListener('click', downloadAll);
  $('#qr-toggle').addEventListener('click', () => {
    const card = $('#qr-card');
    card.hidden = !card.hidden;
    $('#qr-toggle').textContent = card.hidden ? 'Afficher le QR code' : 'Masquer le QR code';
  });
  $('#edit-btn').addEventListener('click', () => go('form'));
  $('#copy-link').addEventListener('click', async () => {
    const input = $('#share-link');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (e) {
      input.select();
      document.execCommand('copy');
    }
    toast('Lien copié');
  });

  function renderQr(url) {
    $('#share-link').value = url;
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 3;
    const canvas = $('#qr-canvas');
    const css = 236;
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = css * dpr;
    canvas.style.width = canvas.style.height = `${css}px`;
    const ctx = canvas.getContext('2d');
    const cell = canvas.width / (n + quiet * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#04102e';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(Math.floor((c + quiet) * cell), Math.floor((r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
  }

  // ---------- Petit message ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- Démarrage ----------
  fillTeamList();
  window.FC_loadFonts(); // préchargement
  FORMAT_KEYS.forEach((k) => window.FC_getBackground(k));

  const fromLink = fromParams(location.search);
  if (fromLink) {
    state = fromLink;
    go('result', { replace: true });
  } else {
    state = freshState('set');
    go('home', { replace: true });
  }
})();
