/* ============================================================
   ActionEQA — JavaScript
   Dataset viewer uses HuggingFace Datasets Server API (parquet)
   ============================================================ */

'use strict';

/* ---------- Navbar ---------- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ---------- Mobile hamburger ---------- */
const hamburger = document.getElementById('nav-hamburger');
const mobileNav  = document.getElementById('nav-mobile');
hamburger.addEventListener('click', () => mobileNav.classList.toggle('open'));
mobileNav.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => mobileNav.classList.remove('open'))
);

/* ---------- Hero particles ---------- */
(function createParticles() {
  const container = document.getElementById('hero-particles');
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1.5;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random()*100}%;
      top:${50+Math.random()*60}%;
      animation-delay:${Math.random()*12}s;
      animation-duration:${8+Math.random()*10}s;
    `;
    container.appendChild(p);
  }
})();

/* ---------- Scroll-reveal ---------- */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const delay = parseInt(el.dataset.delay || '0');
    setTimeout(() => {
      el.classList.add('visible');
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay);
    revealObserver.unobserve(el);
  });
}, { threshold: 0.1 });

document.querySelectorAll('.highlight-card, .fade-in').forEach(el => revealObserver.observe(el));

/* Animate generic elements */
document.querySelectorAll('.stat-item, .source-card, .task-card, .finding-item').forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  el.dataset.delay = String(i * 70);
  revealObserver.observe(el);
});

/* ---------- Code tabs (download section) ---------- */
document.querySelectorAll('.ctab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ctab').forEach(b => b.classList.remove('ctab-active'));
    btn.classList.add('ctab-active');
    const tab = btn.dataset.ctab;
    ['hf','subsets','fields'].forEach(t =>
      document.getElementById('code-' + t).classList.toggle('hidden', t !== tab)
    );
  });
});

/* ---------- Copy BibTeX ---------- */
document.getElementById('copy-citation').addEventListener('click', function () {
  const text  = document.getElementById('bibtex-text').innerText;
  const label = document.getElementById('copy-label');
  navigator.clipboard.writeText(text).catch(() => {}).finally(() => {
    label.textContent = '✓ Copied!';
    this.classList.add('copied');
    setTimeout(() => { label.textContent = 'Copy BibTeX'; this.classList.remove('copied'); }, 2200);
  });
});

/* ---------- Copy code snippets ---------- */
document.querySelectorAll('.copy-code').forEach(btn => {
  btn.addEventListener('click', function () {
    const text = document.getElementById(this.dataset.target).innerText;
    const span = this.querySelector('span');
    navigator.clipboard.writeText(text).catch(() => {}).finally(() => {
      span.textContent = '✓ Copied!';
      this.classList.add('copied');
      setTimeout(() => { span.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
    });
  });
});

/* ---------- Active nav link highlighting ---------- */
const sections = document.querySelectorAll('section[id], header[id]');
window.addEventListener('scroll', () => {
  let current = '';
  const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 50;
  if (nearBottom) {
    current = sections[sections.length - 1].id;
  } else {
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
  }
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.style.color = '';
    if (a.getAttribute('href') === '#' + current) a.style.color = 'var(--gold-light)';
  });
}, { passive: true });

/* ============================================================
   DATASET VIEWER
   Uses HuggingFace Datasets Server parquet API to fetch real data
   ============================================================ */

const REPO = 'TianweiBao/ActionEQA';
const LABELS = ['A', 'B', 'C', 'D'];

let currentSamples = [];
let currentIdx     = 0;
let isForward      = true;
let isRevealed     = false;

const elStatus  = document.getElementById('viewer-status');
const elCard    = document.getElementById('viewer-card');
const elLoading = document.getElementById('viewer-loading');
const elError   = document.getElementById('viewer-error');
const elErrMsg  = document.getElementById('viewer-error-msg');
const elBody    = document.getElementById('viewer-body');
const elCounter = document.getElementById('viewer-counter');
const elAnswer  = document.getElementById('viewer-answer');
const elBadges  = document.getElementById('viewer-meta-badges');
const btnPrev   = document.getElementById('btn-prev');
const btnNext   = document.getElementById('btn-next');
const btnReveal = document.getElementById('btn-reveal');

/* ── Image zoom lightbox ── */
const zoomModal = document.getElementById('img-zoom-modal');
const zoomImg   = document.getElementById('img-zoom-img');
const zoomClose = document.getElementById('img-zoom-close');

function openZoom(src, caption) {
  zoomImg.src = src;
  zoomImg.alt = caption || '';
  zoomModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeZoom() {
  zoomModal.classList.remove('open');
  document.body.style.overflow = '';
  /* Clear src after fade-out so the old image doesn't flash next time */
  setTimeout(() => { if (!zoomModal.classList.contains('open')) zoomImg.src = ''; }, 230);
}

zoomClose.addEventListener('click', e => { e.stopPropagation(); closeZoom(); });
zoomModal.addEventListener('click', e => { if (e.target === zoomModal) closeZoom(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && zoomModal.classList.contains('open')) closeZoom();
});

/* Wire up static `.zoomable` images in the Empirical Findings section to the lightbox */
document.querySelectorAll('img.zoomable').forEach(img => {
  img.addEventListener('click', () => {
    if (img.src) openZoom(img.src, img.alt);
  });
});

/* ── Finding 01: Multi-model grouped V-shape bar chart ── */
(function () {
  const container = document.getElementById('f01-chart');
  if (!container) return;

  // Consistent level colors shared across all models — matching the legend
  const C_HIGH = '#6b46c1';  // purple
  const C_MID  = '#e53e3e';  // red
  const C_LOW  = '#3182ce';  // blue

  // Three most representative models (from overall_comparisons.tex)
  // high = hierarchical avg of H-SP & H-AI across all applicable datasets
  // mid  = avg of M-SP & M-AI; low = avg of L-SP & L-AI
  const models = [
    { name: 'Human',          type: 'human', high: 96.5, mid: 95.0, low: 95.1 },
    { name: 'Gemini-2.5-Pro', type: 'prop',  high: 68.2, mid: 43.4, low: 61.0 },
    { name: 'GLM-4.5V',       type: 'open',  high: 63.5, mid: 36.3, low: 47.8 },
  ];

  const rowStyle = {
    human: { bg: 'rgba(182,163,105,.08)', border: 'rgba(182,163,105,.5)',  barOpacity: 0.8 },
    prop:  { bg: 'rgba(107,70,193,.04)',  border: 'rgba(107,70,193,.25)', barOpacity: 0.8 },
    open:  { bg: 'rgba(47,133,90,.04)',   border: 'rgba(47,133,90,.25)',  barOpacity: 0.8 },
  };

  models.forEach(m => {
    const s = rowStyle[m.type];
    const row = document.createElement('div');
    row.className = 'f01-row' + (m.type === 'human' ? ' f01-row-human' : '');
    row.style.cssText = `background:${s.bg}; border-left:3px solid ${s.border};`;

    const typeLabel = m.type === 'prop' ? 'Prop.' : m.type === 'open' ? 'Open' : null;
    const typeCls   = m.type === 'prop' ? 'f01-type-prop' : 'f01-type-open';
    const badgeHtml = typeLabel ? `<span class="f01-type-badge ${typeCls}">${typeLabel}</span>` : '';

    row.innerHTML = `
      <div class="f01-row-head">
        <span class="f01-row-name">${m.name}</span>
        ${badgeHtml}
      </div>
      <div class="f01-row-bars">
        <div class="f01-bar-wrap" title="High-Level: ${m.high}%">
          <div class="f01-bar" style="width:${m.high}%; background:${C_HIGH}; opacity:${s.barOpacity};">
            <span class="f01-bar-label">${m.high}%</span>
          </div>
        </div>
        <div class="f01-bar-wrap" title="Mid-Level: ${m.mid}%">
          <div class="f01-bar f01-bar-mid-pulse" style="width:${m.mid}%; background:${C_MID}; opacity:${s.barOpacity};">
            <span class="f01-bar-label">${m.mid}%</span>
          </div>
        </div>
        <div class="f01-bar-wrap" title="Low-Level: ${m.low}%">
          <div class="f01-bar" style="width:${m.low}%; background:${C_LOW}; opacity:${s.barOpacity};">
            <span class="f01-bar-label">${m.low}%</span>
          </div>
        </div>
      </div>`;
    container.appendChild(row);
  });
})();

/* ── Finding 03A: Multi-view ablation line charts ── */
(function () {
  // Model palette — consistent with site theme
  const MODELS = [
    { name: 'GLM-4.5V',         short: 'GLM-4.5V',    color: '#B6A369', dashed: false }, // NU gold
    { name: 'InternVL3-14B',    short: 'InternVL3',   color: '#6b46c1', dashed: false }, // purple
    { name: 'Qwen2.5-VL-72B',   short: 'Qwen2.5',     color: '#3182ce', dashed: false }, // blue
    { name: 'Ovis2.5-9B',       short: 'Ovis2.5',     color: '#2f855a', dashed: false }, // green
    { name: 'Gemini-2.5-Flash', short: 'Gemini Flash', color: '#e53e3e', dashed: true  }, // red (degrades)
  ];

  // Data sourced directly from bridge_ablation_4_views_details.tex
  // overall = Avg row; sp = mean(H-SP, M-SP, L-SP); ai = mean(H-AI, M-AI, L-AI)
  const DATA = {
    overall: {
      'GLM-4.5V':         [49.6, 51.1, 49.7, 52.3],
      'InternVL3-14B':    [44.6, 46.2, 48.3, 49.8],
      'Qwen2.5-VL-72B':   [39.2, 46.6, 48.0, 45.4],
      'Ovis2.5-9B':       [42.0, 43.1, 42.7, 43.7],
      'Gemini-2.5-Flash': [47.3, 46.8, 43.3, 42.1],
    },
    sp: {
      'GLM-4.5V':         [55.1, 55.7, 53.0, 56.5],
      'InternVL3-14B':    [41.5, 43.0, 44.6, 47.3],
      'Qwen2.5-VL-72B':   [39.1, 48.4, 44.9, 36.9],
      'Ovis2.5-9B':       [34.0, 37.0, 34.3, 33.9],
      'Gemini-2.5-Flash': [43.5, 43.5, 42.2, 41.1],
    },
    ai: {
      'GLM-4.5V':         [44.2, 46.5, 46.4, 48.0],
      'InternVL3-14B':    [47.7, 49.4, 52.1, 52.3],
      'Qwen2.5-VL-72B':   [39.3, 44.8, 51.1, 53.8],
      'Ovis2.5-9B':       [49.9, 49.2, 51.1, 53.4],
      'Gemini-2.5-Flash': [51.1, 50.2, 44.3, 43.1],
    }
  };

  // Render a responsive SVG line chart into a host div
  function buildChart(hostId, series, opts) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const VW = opts.vw || 520, VH = opts.vh || 185;
    const ml = 40, mr = 16, mt = 18, mb = 30;
    const cw = VW - ml - mr, ch = VH - mt - mb;
    const xs = [0, 1, 2, 3].map(i => ml + i * (cw / 3));
    const yscale = v => mt + ch - ((v - opts.minY) / (opts.maxY - opts.minY)) * ch;
    const xlbls  = ['1 View', '2 Views', '3 Views', '4 Views'];

    let s = `<svg viewBox="0 0 ${VW} ${VH}" width="100%" xmlns="http://www.w3.org/2000/svg">`;

    // Horizontal grid lines + Y labels
    opts.yticks.forEach(y => {
      const sy = yscale(y).toFixed(1);
      s += `<line x1="${ml}" y1="${sy}" x2="${ml + cw}" y2="${sy}" stroke="rgba(78,42,132,.1)" stroke-width="1"/>`;
      s += `<text x="${ml - 5}" y="${(+sy + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="#7a6b8a" font-family="JetBrains Mono,monospace">${y}%</text>`;
    });

    // X-axis base line
    const ay = (mt + ch).toFixed(1);
    s += `<line x1="${ml}" y1="${ay}" x2="${ml + cw}" y2="${ay}" stroke="rgba(78,42,132,.18)" stroke-width="1.5"/>`;

    // X labels
    xlbls.forEach((lbl, i) => {
      s += `<text x="${xs[i].toFixed(1)}" y="${(mt + ch + 16).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#4a3f5c" font-family="Inter,sans-serif">${lbl}</text>`;
    });

    // Lines
    series.forEach(ds => {
      const pts = ds.values.map((v, i) => `${xs[i].toFixed(1)},${yscale(v).toFixed(1)}`).join(' ');
      const dash = ds.dashed ? 'stroke-dasharray="5,3"' : '';
      s += `<polyline points="${pts}" fill="none" stroke="${ds.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.92" ${dash}/>`;
    });

    // Dots (above lines)
    series.forEach(ds => {
      ds.values.forEach((v, i) => {
        s += `<circle cx="${xs[i].toFixed(1)}" cy="${yscale(v).toFixed(1)}" r="3.8" fill="${ds.color}" stroke="white" stroke-width="1.5"/>`;
      });
    });

    s += `</svg>`;
    host.innerHTML = s;
  }

  // Build shared legend once
  function buildLegend() {
    const el = document.getElementById('f03a-legend');
    if (!el) return;
    el.innerHTML = MODELS.map(m => {
      const lineStyle = m.dashed
        ? `background: repeating-linear-gradient(to right, ${m.color} 0, ${m.color} 5px, transparent 5px, transparent 8px); height:3px;`
        : `background:${m.color}; height:3px;`;
      return `<span class="f03a-leg-item">
        <span class="f03a-leg-line" style="${lineStyle}"></span>
        <span style="color:${m.color}; font-weight:600; font-size:.82rem;">${m.short}</span>
      </span>`;
    }).join('');
  }

  buildChart('f03a-overall',
    MODELS.map(m => ({ ...m, values: DATA.overall[m.name] })),
    { vw: 520, vh: 185, minY: 35, maxY: 55, yticks: [35, 40, 45, 50, 55] }
  );
  buildChart('f03a-sp',
    MODELS.map(m => ({ ...m, values: DATA.sp[m.name] })),
    { vw: 300, vh: 175, minY: 28, maxY: 62, yticks: [30, 40, 50, 60] }
  );
  buildChart('f03a-ai',
    MODELS.map(m => ({ ...m, values: DATA.ai[m.name] })),
    { vw: 300, vh: 175, minY: 28, maxY: 62, yticks: [30, 40, 50, 60] }
  );
  buildLegend();
})();

/* ── Finding 04: Custom donut charts ── */
(function () {
  const CX = 100, CY = 100;
  const OUTER_R = 68, OUTER_SW = 24;
  const INNER_R = 40, INNER_SW = 18;
  const GAP_PX  = 3;   // visual gap between segments in px

  function arc(cx, cy, r, sw, circ, segments) {
    let acc = 0;
    return segments.map(seg => {
      const len  = Math.max(0, circ * seg.pct / 100 - GAP_PX);
      const off  = -(acc * circ / 100);
      acc += seg.pct;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${seg.color}" stroke-width="${sw}"
        stroke-dasharray="${len.toFixed(2)} ${circ.toFixed(2)}"
        stroke-dashoffset="${off.toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})"
        stroke-linecap="butt" opacity="0.93"/>`;
    }).join('');
  }

  function build(hostId, outerSegs, innerSegs, centerLabel, centerPct, centerColor) {
    const el = document.getElementById(hostId);
    if (!el) return;
    const outerC = 2 * Math.PI * OUTER_R;
    const innerC = 2 * Math.PI * INNER_R;

    el.innerHTML = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
     width="100%" style="max-width:190px; display:block; margin:0 auto;">
  <circle cx="${CX}" cy="${CY}" r="${OUTER_R}" fill="none"
    stroke="rgba(78,42,132,.07)" stroke-width="${OUTER_SW}"/>
  <circle cx="${CX}" cy="${CY}" r="${INNER_R}" fill="none"
    stroke="rgba(78,42,132,.07)" stroke-width="${INNER_SW}"/>
  ${arc(CX, CY, OUTER_R, OUTER_SW, outerC, outerSegs)}
  ${arc(CX, CY, INNER_R, INNER_SW, innerC, innerSegs)}
  <text x="${CX}" y="${CY - 9}" text-anchor="middle"
    font-size="19" font-weight="900" fill="${centerColor}"
    font-family="JetBrains Mono,monospace">${centerPct}%</text>
  <text x="${CX}" y="${CY + 8}" text-anchor="middle"
    font-size="9" font-weight="600" fill="${centerColor}"
    font-family="Inter,sans-serif">${centerLabel}</text>
</svg>`;
  }

  // Gold family  = Perceptual  (NU Gold — #8F7F4E / #B6A369 / #D4C38A)
  // Purple family = Reasoning  (NU Purple — #3a1f63 / #4E2A84 / #7B5EA7)
  const CHARTS = [
    { id: 'f04-donut-high',
      outer: [
        { pct: 31, color: '#8F7F4E' },  // Neg Hallucination  — gold-dark
        { pct: 28, color: '#D4C38A' },  // Pos Hallucination  — gold-light
        { pct: 19, color: '#3a1f63' },  // Spatiotemporal     — purple-dark
        { pct: 22, color: '#7B5EA7' },  // Commonsense        — purple-light
      ],
      inner: [
        { pct: 59, color: '#B6A369' },  // Perceptual — NU gold
        { pct: 41, color: '#4E2A84' },  // Reasoning  — NU purple
      ],
      label: 'Perceptual', pct: 59, color: '#8F7F4E' },

    { id: 'f04-donut-mid',
      outer: [
        { pct: 23, color: '#8F7F4E' },
        { pct: 28, color: '#D4C38A' },
        { pct: 24, color: '#3a1f63' },
        { pct: 25, color: '#7B5EA7' },
      ],
      inner: [
        { pct: 51, color: '#B6A369' },
        { pct: 49, color: '#4E2A84' },
      ],
      label: 'Perceptual', pct: 51, color: '#8F7F4E' },

    { id: 'f04-donut-low',
      outer: [
        { pct: 21, color: '#8F7F4E' },
        { pct: 23, color: '#D4C38A' },
        { pct: 32, color: '#3a1f63' },
        { pct: 24, color: '#7B5EA7' },
      ],
      inner: [
        { pct: 44, color: '#B6A369' },
        { pct: 56, color: '#4E2A84' },
      ],
      label: 'Reasoning', pct: 56, color: '#4E2A84' },
  ];

  CHARTS.forEach(c => build(c.id, c.outer, c.inner, c.label, c.pct, c.color));
})();

/* Build subset name from selectors */
function getSubsetName() {
  const src   = document.getElementById('ctrl-source').value;
  const level = document.getElementById('ctrl-level').value;
  const type  = document.getElementById('ctrl-type').value;
  // rt1 only has high level
  const realLevel = (src === 'rt1') ? 'high' : level;
  if (src === 'rt1' && level !== 'high') {
    document.getElementById('ctrl-level').value = 'high';
  }
  return `${src}_${realLevel}_${type}`;
}

/* Fetch parquet rows using HuggingFace Datasets Server */
async function fetchRows(subset, numRows = 20) {
  // Determine a random offset so each reload shows a different set of samples
  let offset = 0;
  try {
    const infoUrl = `https://datasets-server.huggingface.co/info?dataset=${encodeURIComponent(REPO)}&config=${encodeURIComponent(subset)}`;
    const infoResp = await fetch(infoUrl);
    if (infoResp.ok) {
      const info = await infoResp.json();
      const totalRows = info?.dataset_info?.splits?.train?.num_examples ?? numRows;
      const maxOffset = Math.max(0, totalRows - numRows);
      offset = Math.floor(Math.random() * (maxOffset + 1));
    }
  } catch (_) {
    // Fall back to offset 0 if the info request fails
  }

  const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(REPO)}&config=${encodeURIComponent(subset)}&split=train&offset=${offset}&length=${numRows}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  const data = await resp.json();
  return data.rows || [];
}

/* Convert HuggingFace image object to displayable src */
function imgSrc(imgField) {
  if (!imgField) return null;
  // HF API returns { src: 'data:...' } or { url: '...' } or base64
  if (typeof imgField === 'string') return imgField;
  if (imgField.src) return imgField.src;
  if (imgField.url) return imgField.url;
  if (imgField.bytes) {
    // raw bytes — create data URL
    try {
      const bytes = new Uint8Array(imgField.bytes);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      return 'data:image/jpeg;base64,' + btoa(binary);
    } catch { return null; }
  }
  return null;
}

/* Build an .img-zoomable wrapper containing the image and a zoom button.
   - Clicking the card anywhere (including image area) → selects the choice.
   - Clicking the dedicated zoom button → opens lightbox only (stopPropagation
     prevents the parent card's selection handler from firing). */
function makeImgEl(src, cls, alt) {
  const wrap = document.createElement('div');
  wrap.className = 'img-zoomable';

  const img = document.createElement('img');
  img.className = cls;
  img.alt = alt || '';

  /* Magnifying-glass zoom button — only trigger for the lightbox */
  const btn = document.createElement('button');
  btn.className = 'img-zoom-btn';
  btn.setAttribute('aria-label', 'Zoom image');
  btn.setAttribute('tabindex', '-1');
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

  let loadFailed = !src;

  if (src) {
    img.src = src;
    img.onerror = () => {
      loadFailed = true;
      wrap.classList.add('img-load-failed');
      wrap.style.background = '#ede8f5';
      img.removeAttribute('src');
      img.title = 'Image unavailable';
    };
  } else {
    wrap.classList.add('img-load-failed');
    wrap.style.background = '#ede8f5';
  }

  /* Zoom button stops propagation so clicking it does NOT also select a choice */
  btn.addEventListener('click', e => {
    if (loadFailed) return;
    e.stopPropagation();
    openZoom(src, alt || '');
  });

  wrap.appendChild(img);
  wrap.appendChild(btn);
  return wrap;
}

function renderForward(row) {
  const d = row.row || row;
  const frameEl  = makeImgEl(imgSrc(d.frame1), 'vf-frame-img', 'Initial state');
  const optA     = makeImgEl(imgSrc(d.option_A), 'vf-choice-img', 'Option A');
  const optB     = makeImgEl(imgSrc(d.option_B), 'vf-choice-img', 'Option B');
  const optC     = makeImgEl(imgSrc(d.option_C), 'vf-choice-img', 'Option C');
  const optD     = makeImgEl(imgSrc(d.option_D), 'vf-choice-img', 'Option D');
  const action   = d.action || '(action not available)';
  const correct  = typeof d.correct_ans === 'number' ? d.correct_ans : parseInt(d.correct_ans);

  const choiceEls = [optA, optB, optC, optD];

  const wrap = document.createElement('div');
  wrap.className = 'vf-layout';
  /* 4-item 2×2 grid:
       col1 row1 = frame label    col2 row1 = (empty spacer)
       col1 row2 = frame image    col2 row2 = action box
     → image and action box sit in the same row and are vertically aligned */
  wrap.innerHTML = `
    <div class="vf-top">
      <div class="vf-frame-label">Initial State s<sub>t</sub></div>
      <div class="vf-top-spacer"></div>
      <div class="vf-frame-wrap"></div>
      <div class="vf-action-box">
        <div class="vf-action-label">Action a<sub>t</sub></div>
        <div class="vf-action-text"></div>
      </div>
    </div>
    <div>
      <div class="vf-choices-label">Which image represents the most logical state s<sub>t+1</sub> after action a<sub>t</sub> is executed?</div>
      <div class="vf-choices"></div>
    </div>
  `;

  wrap.querySelector('.vf-frame-wrap').appendChild(frameEl);
  wrap.querySelector('.vf-action-text').textContent = action;

  const choicesGrid = wrap.querySelector('.vf-choices');
  ['A','B','C','D'].forEach((letter, i) => {
    const div = document.createElement('div');
    div.className = 'vf-choice';
    div.dataset.idx = String(i);
    const lbl = document.createElement('div');
    lbl.className = 'vf-choice-label';
    lbl.textContent = letter;
    div.appendChild(lbl);
    div.appendChild(choiceEls[i]);
    div.addEventListener('click', () => {
      if (isRevealed) return;
      revealAnswer(correct, div.dataset.idx, choicesGrid.querySelectorAll('.vf-choice'));
    });
    choicesGrid.appendChild(div);
  });

  elBody.innerHTML = '';
  elBody.appendChild(wrap);

  elAnswer.textContent = LABELS[correct];
  return { correct, type: 'forward' };
}

function renderInverse(row) {
  const d = row.row || row;
  const frame1El = makeImgEl(imgSrc(d.frame1), 'vi-frame-img', 'Before state');
  const frame2El = makeImgEl(imgSrc(d.frame2), 'vi-frame-img', 'After state');
  const options  = [d.option_A, d.option_B, d.option_C, d.option_D];
  const correct  = typeof d.correct_ans === 'number' ? d.correct_ans : parseInt(d.correct_ans);

  const wrap = document.createElement('div');
  wrap.className = 'vi-layout';

  // Frame row
  const framesDiv = document.createElement('div');
  framesDiv.className = 'vi-frames';

  const w1 = document.createElement('div'); w1.className = 'vi-frame-wrap';
  const l1 = document.createElement('div'); l1.className = 'vf-frame-label'; l1.innerHTML = 'Before s<sub>t</sub>';
  w1.appendChild(l1); w1.appendChild(frame1El);

  const arrow = document.createElement('div'); arrow.className = 'vi-arrow'; arrow.textContent = '→';

  const w2 = document.createElement('div'); w2.className = 'vi-frame-wrap';
  const l2 = document.createElement('div'); l2.className = 'vf-frame-label'; l2.innerHTML = 'After s<sub>t+1</sub>';
  w2.appendChild(l2); w2.appendChild(frame2El);

  framesDiv.appendChild(w1);
  framesDiv.appendChild(arrow);
  framesDiv.appendChild(w2);
  wrap.appendChild(framesDiv);

  // Choices
  const choicesLabel = document.createElement('div');
  choicesLabel.className = 'vi-choices-label';
  choicesLabel.textContent = 'Which action a\u209c caused this transition?';
  wrap.appendChild(choicesLabel);

  const choicesGrid = document.createElement('div');
  choicesGrid.className = 'vi-choices';

  options.forEach((optText, i) => {
    const div = document.createElement('div');
    div.className = 'vi-choice';
    div.dataset.idx = String(i);
    const letter = document.createElement('div');
    letter.className = 'vi-choice-letter';
    letter.textContent = LABELS[i];
    const text = document.createElement('div');
    text.className = 'vi-choice-text';
    text.textContent = optText || '(option unavailable)';
    div.appendChild(letter);
    div.appendChild(text);
    div.addEventListener('click', () => {
      if (isRevealed) return;
      revealAnswer(correct, div.dataset.idx, choicesGrid.querySelectorAll('.vi-choice'));
    });
    choicesGrid.appendChild(div);
  });

  wrap.appendChild(choicesGrid);
  elBody.innerHTML = '';
  elBody.appendChild(wrap);

  elAnswer.textContent = LABELS[correct] + (options[correct] ? ' — ' + options[correct] : '');
  return { correct, type: 'inverse' };
}

function revealAnswer(correct, selected, allChoices) {
  isRevealed = true;
  allChoices.forEach((el, i) => {
    el.classList.remove('revealed-correct', 'revealed-wrong');
    if (i === correct) el.classList.add('revealed-correct');
    else if (i === parseInt(selected)) el.classList.add('revealed-wrong');
  });
  elAnswer.classList.add('shown');
  btnReveal.disabled = true;
  btnReveal.textContent = 'Revealed';
}

function renderSample(idx) {
  if (!currentSamples.length) return;
  isRevealed = false;
  const row  = currentSamples[idx];
  elAnswer.classList.remove('shown');
  elAnswer.textContent = '';
  btnReveal.disabled = false;
  btnReveal.textContent = 'Reveal Answer';
  elCounter.textContent = `${idx + 1} / ${currentSamples.length}`;
  btnPrev.disabled = idx === 0;
  btnNext.disabled = idx === currentSamples.length - 1;

  if (isForward) renderForward(row);
  else           renderInverse(row);
}

btnPrev.addEventListener('click', () => {
  if (currentIdx > 0) { currentIdx--; renderSample(currentIdx); }
});
btnNext.addEventListener('click', () => {
  if (currentIdx < currentSamples.length - 1) { currentIdx++; renderSample(currentIdx); }
});
btnReveal.addEventListener('click', () => {
  if (isRevealed) return;
  const correct = typeof currentSamples[currentIdx].row?.correct_ans === 'number'
    ? currentSamples[currentIdx].row.correct_ans
    : parseInt((currentSamples[currentIdx].row || currentSamples[currentIdx]).correct_ans);

  elAnswer.classList.add('shown');
  btnReveal.disabled = true;
  btnReveal.textContent = 'Revealed';

  // Visually highlight
  isRevealed = true;
  const allChoices = elBody.querySelectorAll('.vf-choice, .vi-choice');
  allChoices.forEach((el, i) => {
    if (i === correct) el.classList.add('revealed-correct');
  });
});

function buildMetaBadges(subset) {
  const parts = subset.split('_');
  const src   = parts[0];
  const level = parts[1];
  const type  = parts[2];

  const srcMap  = { bridge: 'BridgeData V2', droid: 'DROID', rt1: 'RT-1' };
  const lvlMap  = { high: 'High', mid: 'Mid', low: 'Low' };
  const typeMap = { forward: 'State Prediction', inverse: 'Action Inference' };

  elBadges.innerHTML = `
    <span class="meta-badge badge-source">${srcMap[src] || src}</span>
    <span class="meta-badge badge-${level}">${lvlMap[level] || level} Level</span>
    <span class="meta-badge badge-${type === 'forward' ? 'sp' : 'ai'}">${typeMap[type] || type}</span>
  `;
}

document.getElementById('btn-load-viewer').addEventListener('click', async () => {
  const subset = getSubsetName();
  isForward = subset.includes('forward');

  elCard.classList.add('hidden');
  elError.classList.add('hidden');
  elLoading.classList.remove('hidden');
  elStatus.textContent = `Loading subset "${subset}" from HuggingFace…`;

  try {
    const rows = await fetchRows(subset, 20);
    if (!rows.length) throw new Error('No data returned for this subset.');

    currentSamples = rows;
    currentIdx = 0;

    elLoading.classList.add('hidden');
    elCard.classList.remove('hidden');
    buildMetaBadges(subset);
    renderSample(0);
    elStatus.textContent = `Randomly loaded ${rows.length} samples from "${subset}".`;
  } catch (err) {
    elLoading.classList.add('hidden');
    elError.classList.remove('hidden');
    elErrMsg.textContent = err.message || 'Failed to load data.';
    elStatus.textContent = `Error loading "${subset}".`;
    console.error(err);
  }
});

/* Disable mid/low for RT-1 */
document.getElementById('ctrl-source').addEventListener('change', function () {
  const levelSel = document.getElementById('ctrl-level');
  if (this.value === 'rt1') {
    Array.from(levelSel.options).forEach(o => {
      if (o.value !== 'high') { o.disabled = true; o.text = o.text.replace(' (N/A)','') + ' (N/A)'; }
      else o.disabled = false;
    });
    levelSel.value = 'high';
  } else {
    Array.from(levelSel.options).forEach(o => {
      o.disabled = false;
      o.text = o.text.replace(' (N/A)','');
    });
  }
});

/* ============================================================
   LEADERBOARD — Benchmark Results
   Data sourced from overall_comparisons.tex
   ============================================================ */

(function initLeaderboard() {

  /* ---------- Model data ----------
     Columns: model, type, medal,
       droid: [H-SP, M-SP, L-SP, H-AI, M-AI, L-AI, Avg]
       bridge: [H-SP, M-SP, L-SP, H-AI, M-AI, L-AI, Avg]
       rt1: [H-SP, H-AI, Avg]
       overall (Overall Perf.)
  */
  const MODELS = [
    // Open-weights
    { model:'Gemma-3-27B',            type:'open', medal:null,
      droid: [45.9,34.4,29.5,51.3,26.0,32.6,36.6],
      bridge:[63.9,31.3,35.8,71.4,24.5,40.4,44.6],
      rt1:   [54.2,61.1,57.7], overall:40.5 },
    { model:'Gemma-3-12B',            type:'open', medal:null,
      droid: [39.1,29.3,26.1,48.4,24.1,49.2,36.0],
      bridge:[56.0,34.0,40.6,52.3,16.2,43.2,40.4],
      rt1:   [44.7,53.7,49.2], overall:38.2 },
    { model:'Gemma-3-4B',             type:'open', medal:null,
      droid: [27.8,25.5,27.7,45.3,29.0,40.5,32.6],
      bridge:[28.4,29.2,24.9,50.9,23.5,38.2,32.6],
      rt1:   [31.9,42.3,37.1], overall:32.5 },
    { model:'GLM-4.5V',               type:'open', medal:'gold',
      droid: [35.4,39.3,37.5,53.0,30.3,43.1,39.8],
      bridge:[74.1,40.9,50.2,54.5,29.2,48.8,49.6],
      rt1:   [70.8,65.2,68.0], overall:46.2 },
    { model:'GLM-4.1V',               type:'open', medal:null,
      droid: [35.1,20.6,16.3,39.1,23.7,40.7,29.3],
      bridge:[65.4,29.0,40.4,50.7,35.3,40.7,43.6],
      rt1:   [50.3,59.3,54.8], overall:37.2 },
    { model:'GLM-4V',                 type:'open', medal:null,
      droid: [26.3,23.6,24.4,49.9,25.8,50.4,33.4],
      bridge:[40.3,24.4,27.4,49.9,18.3,49.3,34.9],
      rt1:   [38.2,53.7,46.0], overall:34.7 },
    { model:'ERNIE-4.5-VL-28B',       type:'open', medal:null,
      droid: [43.3,30.1,24.8,41.6,30.5,31.6,33.7],
      bridge:[51.2,33.3,32.2,44.6,31.9,27.6,36.8],
      rt1:   [55.7,48.3,52.0], overall:36.0 },
    { model:'Llama-4-Scout-17B-16E',  type:'open', medal:null,
      droid: [30.9,32.8,28.1,37.4,30.5,50.4,35.0],
      bridge:[41.3,28.8,28.8,44.5,31.3,54.2,38.2],
      rt1:   [33.5,46.5,40.0], overall:36.7 },
    { model:'Llama-4-Mav-17B-128E',   type:'open', medal:null,
      droid: [34.0,27.9,32.8,42.8,26.4,60.3,37.4],
      bridge:[49.4,35.6,40.2,43.5,26.5,61.8,42.8],
      rt1:   [39.8,47.7,43.8], overall:40.2 },
    { model:'InternVL3-14B',          type:'open', medal:'bronze',
      droid: [46.5,26.7,28.5,59.5,27.2,45.0,38.9],
      bridge:[58.5,27.9,38.1,63.7,32.5,46.8,44.6],
      rt1:   [62.9,59.3,61.1], overall:42.2 },
    { model:'InternVL3-8B',           type:'open', medal:null,
      droid: [39.1,29.7,30.5,46.5,25.4,35.0,34.4],
      bridge:[49.6,26.0,37.0,62.6,39.0,38.4,42.1],
      rt1:   [49.0,60.9,55.0], overall:38.8 },
    { model:'InternVL3-2B',           type:'open', medal:null,
      droid: [30.3,29.5,27.5,41.1,28.2,22.3,29.8],
      bridge:[33.1,35.6,30.6,51.4,29.4,27.8,34.7],
      rt1:   [31.0,51.7,41.4], overall:32.5 },
    { model:'InternVL2.5-8B-MPO',     type:'open', medal:null,
      droid: [34.8,22.8,26.5,45.3,26.0,30.7,31.0],
      bridge:[61.6,23.1,39.3,59.7,30.8,33.2,41.3],
      rt1:   [61.1,59.3,60.2], overall:37.2 },
    { model:'InternVL2.5-2B-MPO',     type:'open', medal:null,
      droid: [24.9,23.6,25.1,30.6,18.6,18.6,23.6],
      bridge:[25.4,24.4,28.5,42.4,17.6,24.6,27.2],
      rt1:   [27.2,30.8,29.0], overall:25.2 },
    { model:'InternVL2.5-8B',         type:'open', medal:null,
      droid: [30.3,27.3,28.9,47.9,29.9,37.3,33.6],
      bridge:[55.8,24.0,37.0,58.2,33.1,43.3,41.9],
      rt1:   [54.1,59.8,57.0], overall:38.7 },
    { model:'InternVL2.5-2B',         type:'open', medal:null,
      droid: [26.9,23.6,25.1,30.6,17.8,21.4,24.2],
      bridge:[35.1,24.4,27.6,44.8,22.7,24.8,29.9],
      rt1:   [25.6,33.2,29.4], overall:26.5 },
    { model:'Qwen3-VL-8B-Ins',        type:'open', medal:null,
      droid: [40.5,29.9,32.0,56.7,28.4,33.1,36.8],
      bridge:[41.4,32.0,29.9,58.3,33.3,32.6,37.9],
      rt1:   [47.7,78.0,62.9], overall:38.9 },
    { model:'Qwen2.5-VL-72B-Ins',     type:'open', medal:null,
      droid: [38.8,32.0,27.3,41.1,28.6,46.4,35.7],
      bridge:[52.6,31.7,33.1,49.8,21.8,46.4,39.2],
      rt1:   [41.3,76.0,58.7], overall:38.9 },
    { model:'Qwen2.5-VL-32B-Ins',     type:'open', medal:null,
      droid: [32.0,27.1,31.2,33.1,33.1,45.3,33.6],
      bridge:[50.5,30.4,37.9,42.5,21.7,45.8,38.1],
      rt1:   [50.6,71.0,60.8], overall:38.2 },
    { model:'Qwen2.5-VL-7B-Ins',      type:'open', medal:null,
      droid: [35.4,25.9,23.8,36.0,29.9,45.9,32.8],
      bridge:[46.1,26.7,27.4,39.7,34.8,45.2,36.7],
      rt1:   [51.5,72.1,61.8], overall:37.2 },
    { model:'Qwen2.5-VL-3B-Ins',      type:'open', medal:null,
      droid: [23.5,23.6,25.1,37.1,27.8,36.2,28.9],
      bridge:[24.3,24.4,23.1,36.0,32.2,36.7,29.5],
      rt1:   [25.0,63.1,44.1], overall:30.7 },
    { model:'Qwen2-VL-7B-Ins',        type:'open', medal:null,
      droid: [36.0,24.2,25.0,43.6,27.2,35.5,31.9],
      bridge:[54.3,30.1,29.0,45.1,31.0,31.0,36.8],
      rt1:   [36.9,60.7,48.8], overall:34.8 },
    { model:'Qwen2-VL-2B-Ins',        type:'open', medal:null,
      droid: [24.6,23.6,27.3,32.3,28.8,20.4,26.2],
      bridge:[25.9,24.4,23.7,35.3,24.7,19.3,25.6],
      rt1:   [27.4,40.5,34.0], overall:26.4 },
    { model:'Ovis2.5-9B',             type:'open', medal:'silver',
      droid: [42.8,29.5,29.5,61.5,28.6,55.1,41.2],
      bridge:[49.2,21.9,30.8,63.5,32.2,54.1,42.0],
      rt1:   [57.7,66.3,62.0], overall:42.4 },
    { model:'Ovis2.5-2B',             type:'open', medal:null,
      droid: [38.2,25.1,28.1,59.8,20.2,26.6,38.0],
      bridge:[37.8,32.2,33.6,62.8,12.0,29.7,34.7],
      rt1:   [31.5,57.5,44.5], overall:33.3 },
    { model:'MiniCPM-V-4.5',          type:'open', medal:null,
      droid: [34.8,34.6,32.0,56.9,23.9,51.6,39.0],
      bridge:[36.5,22.4,33.3,59.9,30.7,55.4,39.7],
      rt1:   [44.1,57.7,50.9], overall:39.8 },
    // Proprietary
    { model:'Gemini-2.5-Pro',         type:'prop', medal:'gold',
      droid: [52.7,44.6,48.9,70.3,42.5,73.9,55.5],
      bridge:[75.6,42.2,51.8,77.1,44.4,71.3,60.4],
      rt1:   [68.8,77.8,73.3], overall:58.4 },
    { model:'Gemini-2.5-Flash',       type:'prop', medal:'silver',
      droid: [43.3,33.2,40.3,68.6,33.5,50.9,45.0],
      bridge:[68.9,27.9,33.6,70.8,33.1,49.5,47.3],
      rt1:   [69.2,71.0,70.1], overall:46.9 },
    { model:'Gemini-2.5-Flash-Lite',  type:'prop', medal:null,
      droid: [45.0,24.6,31.6,58.9,30.5,56.5,41.2],
      bridge:[54.0,25.8,39.3,64.0,24.5,58.6,44.4],
      rt1:   [57.5,61.8,59.7], overall:43.2 },
    { model:'Gemini-2.0-Flash',       type:'prop', medal:null,
      droid: [47.6,24.8,32.6,56.7,29.0,58.0,41.5],
      bridge:[69.6,24.7,34.7,64.3,31.8,59.7,47.5],
      rt1:   [70.6,68.1,69.4], overall:45.5 },
    { model:'GPT-4.1',                type:'prop', medal:'bronze',
      droid: [50.7,30.3,36.3,62.9,30.9,35.7,41.1],
      bridge:[80.4,48.4,46.8,71.6,26.0,34.0,51.2],
      rt1:   [66.5,71.4,69.0], overall:46.4 },
    { model:'o4-mini',                type:'prop', medal:null,
      droid: [38.0,29.5,34.0,52.1,31.5,30.1,35.9],
      bridge:[48.3,26.7,29.2,52.2,36.0,30.9,37.2],
      rt1:   [59.3,65.4,62.4], overall:38.2 },
    { model:'Claude-Opus-4',          type:'prop', medal:null,
      droid: [27.8,31.0,29.5,44.2,28.6,71.9,38.8],
      bridge:[44.0,32.9,35.8,52.2,24.8,74.2,44.0],
      rt1:   [42.3,57.1,49.7], overall:42.3 },
    { model:'Claude-Sonnet-4',        type:'prop', medal:null,
      droid: [28.3,27.1,26.3,39.9,24.9,65.3,35.3],
      bridge:[51.1,35.4,42.7,41.6,25.7,67.4,44.0],
      rt1:   [43.6,43.4,43.5], overall:40.0 },
    // Human
    { model:'Human Performance',      type:'human', medal:null,
      droid: [95.7,91.2,96.7,92.9,95.3,92.6,94.1],
      bridge:[99.6,97.7,97.3,99.4,95.7,93.7,97.2],
      rt1:   [96.4,96.0,96.2], overall:95.6 },
  ];

  /* ---------- Column definitions ---------- */
  const DROID_COLS  = ['H-SP','M-SP','L-SP','H-AI','M-AI','L-AI','Avg.'];
  const BRIDGE_COLS = ['H-SP','M-SP','L-SP','H-AI','M-AI','L-AI','Avg.'];
  const RT1_COLS    = ['H-SP','H-AI','Avg.'];

  /* State */
  let activeDataset = 'all';  // 'all' | 'droid' | 'bridge' | 'rt1'
  let activeType    = 'all';  // 'all' | 'open' | 'prop'
  let sortCol       = null;   // column key string
  let sortDir       = 'desc'; // 'asc' | 'desc'

  const thead = document.getElementById('lb-thead');
  const tbody = document.getElementById('lb-tbody');

  /* ---------- Build column schema for current dataset view ---------- */
  function getColumns() {
    const cols = [];
    if (activeDataset === 'all' || activeDataset === 'droid') {
      DROID_COLS.forEach((c, i) => cols.push({ key:`droid_${i}`, label:c, dataset:'droid', group:'DROID', first: i===0 }));
    }
    if (activeDataset === 'all' || activeDataset === 'bridge') {
      BRIDGE_COLS.forEach((c, i) => cols.push({ key:`bridge_${i}`, label:c, dataset:'bridge', group:'BridgeData V2', first: i===0 }));
    }
    if (activeDataset === 'all' || activeDataset === 'rt1') {
      RT1_COLS.forEach((c, i) => cols.push({ key:`rt1_${i}`, label:c, dataset:'rt1', group:'RT-1', first: i===0 }));
    }
    cols.push({ key:'overall', label:'Overall Perf.', group:'', first:true, isOverall:true });
    return cols;
  }

  /* ---------- Get value from model for a column key ---------- */
  function getValue(m, key) {
    if (key === 'overall') return m.overall;
    const [ds, idx] = key.split('_');
    const arr = m[ds];
    if (!arr) return null;
    return arr[parseInt(idx)];
  }

  /* ---------- Build header ---------- */
  function buildHeader(cols) {
    thead.innerHTML = '';
    const tr = document.createElement('tr');

    // Rank
    const thRank = document.createElement('th');
    thRank.textContent = '#'; thRank.style.cursor='default';
    tr.appendChild(thRank);

    // Model
    const thModel = document.createElement('th');
    thModel.textContent = 'Model'; thModel.style.cursor='default';
    thModel.style.textAlign = 'left'; thModel.style.paddingLeft = '14px';
    tr.appendChild(thModel);

    // Metric cols
    let lastGroup = null;
    cols.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      th.dataset.key = col.key;
      th.className = 'sortable';
      if (col.group && col.group !== lastGroup && col.first) {
        th.classList.add('lb-th-group');
        lastGroup = col.group;
      }
      if (sortCol === col.key) {
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      }

      // Sort icon
      const icon = document.createElement('span');
      icon.className = 'lb-sort-icon';
      if (sortCol === col.key) {
        icon.textContent = sortDir === 'asc' ? '▲' : '▼';
      } else {
        icon.textContent = '⇅';
      }
      th.appendChild(icon);

      // Group tooltip
      if (col.group) th.title = col.group;

      th.addEventListener('click', () => onSortClick(col.key));
      tr.appendChild(th);
    });

    // Group label row
    if (activeDataset === 'all') {
      const groupTr = document.createElement('tr');

      const emptyRank = document.createElement('td'); emptyRank.colSpan = 2;
      emptyRank.style.background = 'rgba(30,16,53,.97)';
      emptyRank.style.borderBottom = '1px solid rgba(255,255,255,.1)';
      groupTr.appendChild(emptyRank);

      [
        { label:'DROID', span: DROID_COLS.length },
        { label:'BridgeData V2', span: BRIDGE_COLS.length },
        { label:'RT-1', span: RT1_COLS.length },
        { label:'', span: 1 },
      ].forEach(g => {
        const td = document.createElement('td');
        td.colSpan = g.span;
        td.textContent = g.label;
        td.style.cssText = `
          background:rgba(30,16,53,.97);
          color:rgba(255,255,255,.3);
          font-size:.62rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em;
          padding:4px 12px 6px;
          border-bottom:1px solid rgba(255,255,255,.1);
          text-align:center;
          border-left: 1px solid rgba(255,255,255,.08);
        `;
        groupTr.appendChild(td);
      });

      thead.appendChild(groupTr);
    }

    thead.appendChild(tr);
  }

  /* ---------- Compute in-group ranks for medals ---------- */
  function computeGroupRanks(filtered, cols) {
    // For each column, rank within open and prop separately
    const ranks = {}; // key -> { open: [modelIdx sorted], prop: [modelIdx sorted] }
    cols.forEach(col => {
      const openVals = filtered
        .map((m,i) => ({ i, v: getValue(m, col.key) }))
        .filter(x => x.v !== null && filtered[x.i].type === 'open')
        .sort((a,b) => b.v - a.v);
      const propVals = filtered
        .map((m,i) => ({ i, v: getValue(m, col.key) }))
        .filter(x => x.v !== null && filtered[x.i].type === 'prop')
        .sort((a,b) => b.v - a.v);
      ranks[col.key] = { open: openVals.slice(0,3).map(x=>x.i), prop: propVals.slice(0,3).map(x=>x.i) };
    });
    return ranks;
  }

  /* ---------- Build body ---------- */
  function buildBody(cols) {
    tbody.innerHTML = '';

    /* Filter */
    let data = MODELS.filter(m => {
      if (activeType === 'open') return m.type === 'open';
      if (activeType === 'prop') return m.type === 'prop';
      return true;
    });

    /* Sort */
    if (sortCol) {
      data = [...data].sort((a, b) => {
        // human always last
        if (a.type === 'human') return 1;
        if (b.type === 'human') return -1;
        const av = getValue(a, sortCol) ?? -Infinity;
        const bv = getValue(b, sortCol) ?? -Infinity;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    } else {
      // Default: open-weights first by overall desc, then prop by overall desc, human last
      const open = data.filter(m=>m.type==='open').sort((a,b)=>b.overall-a.overall);
      const prop = data.filter(m=>m.type==='prop').sort((a,b)=>b.overall-a.overall);
      const human= data.filter(m=>m.type==='human');
      data = [...open, ...prop, ...human];
    }

    /* Ranks for highlight coloring */
    const ranks = computeGroupRanks(data, cols);

    /* Overall max for bar */
    const overallMax = 100;

    let rank = 0;
    let lastType = null;

    data.forEach((m, rowIdx) => {
      const isHuman = m.type === 'human';

      // Group separator row when switching open → prop (only when no type filter)
      if (!isHuman && m.type !== lastType && !sortCol) {
        if (lastType !== null) {
          const sepTr = document.createElement('tr');
          sepTr.className = 'lb-group-header';
          const td = document.createElement('td');
          td.colSpan = 2 + cols.length;
          td.textContent = m.type === 'prop' ? '— Proprietary Models —' : '— Open-Weights Models —';
          sepTr.appendChild(td);
          tbody.appendChild(sepTr);
        } else {
          const sepTr = document.createElement('tr');
          sepTr.className = 'lb-group-header';
          const td = document.createElement('td');
          td.colSpan = 2 + cols.length;
          td.textContent = m.type === 'open' ? '— Open-Weights Models —' : '— Proprietary Models —';
          sepTr.appendChild(td);
          tbody.appendChild(sepTr);
        }
        lastType = m.type;
        rank = 0;
      }

      if (!isHuman) rank++;

      const tr = document.createElement('tr');
      tr.className = isHuman ? 'lb-row lb-row-human' : 'lb-row';

      /* Rank cell */
      const tdRank = document.createElement('td');
      if (isHuman) {
        tdRank.innerHTML = '<span style="font-size:.85rem">🧑‍💻</span>';
      } else {
        const medalMap = { gold:'🥇', silver:'🥈', bronze:'🥉' };
        if (rank <= 3 && !sortCol) {
          const medals = ['🥇','🥈','🥉'];
          tdRank.innerHTML = `<span class="lb-rank-medal">${medals[rank-1]}</span>`;
        } else {
          tdRank.innerHTML = `<span class="lb-rank">${rank}</span>`;
        }
      }
      tr.appendChild(tdRank);

      /* Model name cell */
      const tdModel = document.createElement('td');
      const dotClass = m.type === 'open' ? 'lb-type-dot-open' : m.type === 'prop' ? 'lb-type-dot-prop' : '';
      const typeLabel = m.type === 'open' ? 'Open-Weights' : m.type === 'prop' ? 'Proprietary' : 'Human';
      tdModel.innerHTML = `
        <div class="lb-model-name">
          ${!isHuman ? `<span class="lb-type-dot ${dotClass}"></span>` : ''}
          <span class="lb-model-label">${m.model}</span>
        </div>
      `;
      tr.appendChild(tdModel);

      /* Metric cells */
      cols.forEach(col => {
        const td = document.createElement('td');
        const val = getValue(m, col.key);

        if (val === null || val === undefined) {
          td.innerHTML = `<span class="lb-val-dash">—</span>`;
          tr.appendChild(td);
          return;
        }

        if (col.isOverall) {
          td.className = 'lb-perf-cell';
          const fillClass = isHuman ? 'lb-perf-bar-fill-human'
            : m.type === 'prop' ? 'lb-perf-bar-fill-prop'
            : 'lb-perf-bar-fill';
          const pct = Math.min(100, (val / overallMax) * 100).toFixed(1);
          td.innerHTML = `
            <div class="lb-perf-wrap">
              <div class="lb-perf-bar-bg">
                <div class="lb-perf-bar-fill ${fillClass}" style="width:${pct}%"></div>
              </div>
              <span class="lb-perf-num ${isHuman ? 'lb-val-human' : ''}">${val.toFixed(1)}</span>
            </div>
          `;
        } else {
          // Highlight top-3 in group
          let hlClass = '';
          if (!isHuman) {
            const grpKey = m.type; // 'open' | 'prop'
            const grpRanks = ranks[col.key]?.[grpKey] || [];
            const posInGroup = grpRanks.indexOf(rowIdx);
            if (posInGroup >= 0) {
              hlClass = m.type === 'open' ? 'lb-val-highlight-open' : 'lb-val-highlight-prop';
            }
          }
          td.innerHTML = `<span class="lb-val ${isHuman ? 'lb-val-human' : ''} ${hlClass}">${val.toFixed(1)}</span>`;
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  /* ---------- Sort click handler ---------- */
  function onSortClick(key) {
    if (sortCol === key) {
      sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      sortCol = key;
      sortDir = 'desc';
    }
    render();
  }

  /* ---------- Render ---------- */
  function render() {
    const cols = getColumns();
    buildHeader(cols);
    buildBody(cols);
  }

  /* ---------- Dataset tabs ---------- */
  document.getElementById('lb-dataset-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.lb-tab');
    if (!btn) return;
    document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('lb-tab-active'));
    btn.classList.add('lb-tab-active');
    activeDataset = btn.dataset.dataset;
    sortCol = null; // reset sort on dataset change
    render();
  });

  /* ---------- Type chips ---------- */
  document.getElementById('lb-type-chips').addEventListener('click', e => {
    const btn = e.target.closest('.lb-chip');
    if (!btn) return;
    document.querySelectorAll('.lb-chip').forEach(b => b.classList.remove('lb-chip-active'));
    btn.classList.add('lb-chip-active');
    activeType = btn.dataset.type;
    sortCol = null;
    render();
  });

  /* ---------- Initial render ---------- */
  render();

})();

