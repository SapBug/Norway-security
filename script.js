/* =========================================================
   Економічна безпека Норвегії — спільний скрипт сайту
   Автор: Клен Андрій, 2026
   ---------------------------------------------------------
   1) Мобільне меню (обидві сторінки)
   2) Анімація появи блоків при прокрутці
   3) Графіки Chart.js (лише analysis.html)
   ========================================================= */

/* ---------- 1. Мобільне меню ---------- */
(function initMenu() {
  const btn = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden') === false;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
  });
  menu.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      menu.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    })
  );
})();

/* ---------- 2. Поява блоків при прокрутці ---------- */
(function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(el => io.observe(el));
})();

/* ---------- 3. Графіки ---------- */

// Вихідні дані (World Bank, 2019–2023)
const YEARS = ['2019', '2020', '2021', '2022', '2023'];
const DATA = {
  cereal:   [45.1, 46.2, 44.5, 48.0, 47.5],   // ц/га
  exports:  [37.0, 34.1, 42.5, 71.3, 45.0],   // % ВВП
  imports:  [31.5, 28.6, 29.2, 33.1, 35.5],   // % ВВП
  coverage: [1.17, 1.19, 1.45, 2.15, 1.26],   // експорт / імпорт
  rd:       [2.15, 2.28, 2.24, 2.10, 2.12],   // % ВВП
  debt:     [40.5, 46.5, 43.2, 37.4, 38.1]    // % ВВП
};

// Кольори рівнів безпеки
const LEVEL = {
  opt:   { name: 'Оптимальний',         color: '#059669', band: 'rgba(16,185,129,0.12)' },
  sat:   { name: 'Задовільний',         color: '#0284c7', band: 'rgba(14,165,233,0.10)' },
  unsat: { name: 'Незадовільний',       color: '#d97706', band: 'rgba(245,158,11,0.12)' },
  dang:  { name: 'Небезпечний',         color: '#ea580c', band: 'rgba(249,115,22,0.12)' },
  crit:  { name: 'Абсолютна небезпека', color: '#be123c', band: 'rgba(225,29,72,0.10)' }
};

// Рівні коефіцієнта покриття за роками (згідно з оцінюванням)
const COVERAGE_LEVELS = ['opt', 'opt', 'dang', 'crit', 'unsat'];
// Рівні державного боргу за роками (30–40% — незадовільний, 40–50% — небезпечний)
const DEBT_LEVELS = DATA.debt.map(v => (v >= 40 ? 'dang' : v >= 30 ? 'unsat' : 'opt'));

const fmt = (v, d = 1) => Number(v).toLocaleString('uk-UA', { minimumFractionDigits: d, maximumFractionDigits: d });

/* Плагін: кольорові смуги порогових інтервалів на тлі графіка */
const thresholdBands = {
  id: 'thresholdBands',
  beforeDatasetsDraw(chart, _args, opts) {
    const bands = opts && opts.bands;
    if (!bands || !bands.length) return;
    const { ctx, chartArea, scales: { y } } = chart;
    ctx.save();
    bands.forEach(b => {
      const top = y.getPixelForValue(Math.min(b.to, y.max));
      const bottom = y.getPixelForValue(Math.max(b.from, y.min));
      if (bottom <= top) return;
      ctx.fillStyle = b.color;
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
    });
    ctx.restore();
  },
  // Підписи смуг малюються поверх даних — на напівпрозорій «пігулці», щоб не зливатися зі стовпцями
  afterDatasetsDraw(chart, _args, opts) {
    const bands = opts && opts.bands;
    if (!bands || !bands.length) return;
    const { ctx, chartArea, scales: { y } } = chart;
    ctx.save();
    ctx.font = '600 11px Manrope, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    bands.forEach(b => {
      if (!b.label) return;
      const top = y.getPixelForValue(Math.min(b.to, y.max));
      const bottom = y.getPixelForValue(Math.max(b.from, y.min));
      const yPos = b.labelPos === 'bottom' ? bottom - 11 : top + 11;
      const w = ctx.measureText(b.label).width + 12;
      const x = chartArea.right - 6;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - w, yPos - 9, w, 18, 9); ctx.fill(); }
      else ctx.fillRect(x - w, yPos - 9, w, 18);
      ctx.fillStyle = b.textColor || 'rgba(15,23,42,0.6)';
      ctx.fillText(b.label, x - 6, yPos + 0.5);
    });
    ctx.restore();
  }
};

/* Плагін: підписи значень над точками / стовпцями */
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.enabled) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '700 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden || ds.noLabels) return;
      meta.data.forEach((el, j) => {
        ctx.fillStyle = '#0b1424';
        ctx.fillText(fmt(ds.data[j], opts.decimals ?? 1), el.x, el.y - 8);
      });
    });
    ctx.restore();
  }
};

function initCharts() {
  if (typeof Chart === 'undefined') return;           // головна сторінка або CDN недоступний
  if (!document.getElementById('debtChart')) return;

  Chart.register(thresholdBands, valueLabels);

  // Загальні налаштування
  Chart.defaults.font.family = 'Manrope, system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#475569';
  Chart.defaults.borderColor = 'rgba(148,163,184,0.18)';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.tooltip.backgroundColor = '#0b1424';
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.titleFont = { weight: '700' };
  Chart.defaults.maintainAspectRatio = false;

  const gridX = { grid: { display: false }, border: { display: false } };
  const gridY = { border: { display: false } };

  /* 3.1 Державний борг */
  new Chart(document.getElementById('debtChart'), {
    type: 'line',
    data: {
      labels: YEARS,
      datasets: [{
        label: 'Борг центрального уряду, % ВВП',
        data: DATA.debt,
        borderColor: '#1b2d50',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 6,
        pointHoverRadius: 9,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointBackgroundColor: DEBT_LEVELS.map(l => LEVEL[l].color),
        fill: false
      }]
    },
    options: {
      layout: { padding: { top: 20 } },
      scales: {
        x: gridX,
        y: { ...gridY, min: 25, max: 52, ticks: { callback: v => v + '%' } }
      },
      plugins: {
        legend: { display: false },
        valueLabels: { enabled: true, decimals: 1 },
        thresholdBands: {
          bands: [
            { from: 40, to: 50, color: LEVEL.dang.band, label: 'Небезпечний · 40–50%', textColor: '#c2410c' },
            { from: 30, to: 40, color: LEVEL.unsat.band, label: 'Незадовільний · 30–40%', textColor: '#b45309', labelPos: 'bottom' }
          ]
        },
        tooltip: {
          callbacks: {
            label: c => ` ${fmt(c.parsed.y)}% ВВП — ${LEVEL[DEBT_LEVELS[c.dataIndex]].name}`
          }
        }
      }
    }
  });

  /* 3.2 Коефіцієнт покриття імпорту експортом */
  new Chart(document.getElementById('coverageChart'), {
    type: 'bar',
    data: {
      labels: YEARS,
      datasets: [{
        label: 'Коефіцієнт покриття',
        data: DATA.coverage,
        backgroundColor: COVERAGE_LEVELS.map(l => LEVEL[l].color),
        borderRadius: 8,
        maxBarThickness: 46
      }]
    },
    options: {
      layout: { padding: { top: 20 } },
      scales: {
        x: gridX,
        y: { ...gridY, min: 0, max: 2.4, ticks: { stepSize: 0.4, callback: v => fmt(v, 1) } }
      },
      plugins: {
        legend: { display: false },
        valueLabels: { enabled: true, decimals: 2 },
        thresholdBands: {
          bands: [{ from: 1.0, to: 1.2, color: 'rgba(16,185,129,0.18)', label: 'Оптимум 1,0–1,2', textColor: '#047857', labelPos: 'bottom' }]
        },
        tooltip: {
          callbacks: {
            label: c => ` ${fmt(c.parsed.y, 2)} — ${LEVEL[COVERAGE_LEVELS[c.dataIndex]].name}`
          }
        }
      }
    }
  });

  /* 3.3 Експорт vs імпорт */
  new Chart(document.getElementById('tradeChart'), {
    type: 'bar',
    data: {
      labels: YEARS,
      datasets: [
        { label: 'Експорт', data: DATA.exports, backgroundColor: '#233b69', borderRadius: 6, maxBarThickness: 28 },
        { label: 'Імпорт',  data: DATA.imports, backgroundColor: '#8aa7d3', borderRadius: 6, maxBarThickness: 28 }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: gridX,
        y: { ...gridY, beginAtZero: true, max: 80, ticks: { callback: v => v + '%' } }
      },
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y)}% ВВП`,
            footer: items => {
              const i = items[0].dataIndex;
              return `Коеф. покриття: ${fmt(DATA.coverage[i], 2)}`;
            }
          }
        }
      }
    }
  });

  /* 3.4 Витрати на R&D */
  new Chart(document.getElementById('rdChart'), {
    type: 'line',
    data: {
      labels: YEARS,
      datasets: [{
        label: 'Витрати на R&D, % ВВП',
        data: DATA.rd,
        borderColor: '#0284c7',
        backgroundColor: 'rgba(2,132,199,0.10)',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#0284c7',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: 'origin'
      }]
    },
    options: {
      layout: { padding: { top: 20 } },
      scales: {
        x: gridX,
        y: { ...gridY, min: 1.5, max: 3.5, ticks: { stepSize: 0.5, callback: v => fmt(v, 1) + '%' } }
      },
      plugins: {
        legend: { display: false },
        valueLabels: { enabled: true, decimals: 2 },
        thresholdBands: {
          bands: [
            { from: 3.0, to: 3.5, color: LEVEL.opt.band, label: 'Оптимальний · понад 3%', textColor: '#047857' },
            { from: 2.0, to: 3.0, color: LEVEL.sat.band, label: 'Задовільний · 2–3%', textColor: '#0369a1' }
          ]
        },
        tooltip: { callbacks: { label: c => ` ${fmt(c.parsed.y, 2)}% ВВП — Задовільний` } }
      }
    }
  });

  /* 3.5 Урожайність зернових */
  new Chart(document.getElementById('cerealChart'), {
    type: 'line',
    data: {
      labels: YEARS,
      datasets: [{
        label: 'Урожайність, ц/га',
        data: DATA.cereal,
        borderColor: '#059669',
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: DATA.cereal.map(v => (v >= 45 ? LEVEL.opt.color : LEVEL.sat.color)),
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      layout: { padding: { top: 20 } },
      scales: {
        x: gridX,
        y: { ...gridY, min: 40, max: 52, ticks: { stepSize: 2 } }
      },
      plugins: {
        legend: { display: false },
        valueLabels: { enabled: true, decimals: 1 },
        thresholdBands: {
          bands: [{ from: 45, to: 55, color: LEVEL.opt.band, label: 'Оптимальний · 45–55 ц/га', textColor: '#047857' }]
        },
        tooltip: {
          callbacks: {
            label: c => ` ${fmt(c.parsed.y)} ц/га — ${c.parsed.y >= 45 ? 'Оптимальний' : 'Задовільний'}`
          }
        }
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCharts);
} else {
  initCharts();
}
