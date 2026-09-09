// views/analytics.js — Análises: fechamento de mês/trimestre/semestre/ano, sempre comparado com o
// período equivalente anterior. Tela só de leitura — reaproveita os mesmos dados de gastos, renda,
// cofrinhos, contas e dívidas que o resto do app já mantém, sem nenhum modelo de dado novo.
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, monthLabel, round2 } from '../utils/format.js';
import { categoryLabel } from '../utils/helpers.js';
import { PERIOD_TYPES, getPeriodRange, shiftAnchor, canGoNext, computeAnalyticsReport } from '../modules/analytics.js';
import { FUND_TYPE_DEFS } from '../modules/funds.js';

// Mesmo padrão duplicado em funds.js/accounts.js: 'good'/'danger' não seguem a família --cat-*.
function fundTypeColors(colorKey) {
  if (colorKey === 'good') return { fg: 'var(--good)', bg: 'var(--good-bg)' };
  if (colorKey === 'danger') return { fg: 'var(--danger)', bg: 'var(--danger-bg)' };
  return { fg: `var(--cat-${colorKey})`, bg: `var(--cat-${colorKey}-bg)` };
}

// Mesmo desenho do donut do dashboard/cofrinhos (gap de 3px entre fatias).
function buildDonutSegments(items, total) {
  if (total <= 0) return '';
  const r = 54, c = 2 * Math.PI * r;
  const gap = 3;
  let acc = 0;
  return items.filter(i => i.spent > 0).map(i => {
    const frac = i.spent / total;
    const len = frac * c;
    const drawLen = Math.max(len - gap, 0.5);
    const seg = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${i.strokeColor}" stroke-width="16" stroke-dasharray="${drawLen.toFixed(1)} ${(c - drawLen).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}"></circle>`;
    acc += len;
    return seg;
  }).join('');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function periodLabel(type, range, lang) {
  if (type === 'month') {
    const startMonth = Number(range.start.slice(5, 7)) - 1;
    const d = new Date(range.year, startMonth, 1);
    return capitalize(`${monthLabel(lang, d)} ${range.year}`);
  }
  if (type === 'quarter') return I18n.t('analytics.quarterLabel', { n: range.n, year: range.year });
  if (type === 'semester') return I18n.t('analytics.semesterLabel', { n: range.n, year: range.year });
  return String(range.year);
}

// Badge de variação vs. período anterior — a seta/cor dependem de "subir é bom ou ruim" pra cada
// métrica (gastos subir é ruim, renda/saldo/poupado/patrimônio subir é bom).
function deltaBadge(current, prev, currency, higherIsBetter) {
  const delta = round2(current - prev);
  if (Math.abs(delta) < 0.005) {
    return `<span class="delta-badge delta-badge--flat">${I18n.t('analytics.noChange')}</span>`;
  }
  const isUp = delta > 0;
  const isGood = isUp === higherIsBetter;
  const pct = prev !== 0 ? Math.round((Math.abs(delta) / Math.abs(prev)) * 100) : null;
  const sign = isUp ? '+' : '−';
  const amountStr = formatCurrency(Math.abs(delta), currency);
  const pctStr = pct !== null ? ` (${sign}${pct}%)` : '';
  return `
    <span class="delta-badge ${isGood ? 'delta-badge--good' : 'delta-badge--bad'}">
      ${icon(isUp ? 'trendingUp' : 'trendingDown', 13, 2.2)}${sign}${amountStr}${pctStr}
    </span>
    <span class="delta-badge__label">${I18n.t('analytics.vsPrevious')}</span>
  `;
}

export function renderAnalytics(container) {
  const lang = I18n.getLang();
  let periodType = 'month';
  let anchor = new Date();

  function paint() {
    const currency = DB.getSettings().currency;
    const categories = DB.getCategories();
    const expenses = DB.getExpenses();
    const incomes = DB.getIncomes();
    const funds = DB.getFunds();
    const accounts = DB.getAccounts();
    const debts = DB.getDebts();

    const report = computeAnalyticsReport({ type: periodType, anchor, categories, expenses, incomes, funds, accounts, debts });
    const label = periodLabel(periodType, report.range, lang);
    const nextEnabled = canGoNext(report.range);

    const donutTotal = round2(report.expenses.byCategory.reduce((s, c) => s + c.spent, 0));
    const fundsWithContribution = report.savings.byFund.filter(f => f.contributed > 0).sort((a, b) => b.contributed - a.contributed);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${I18n.t('analytics.title')}</h1>
          <p class="view-subtitle">${I18n.t('analytics.subtitle')}</p>
        </div>
      </div>

      <div class="subtabs">
        ${PERIOD_TYPES.map(t => `<button class="subtab ${periodType === t ? 'is-active' : ''}" data-period-type="${t}">${I18n.t('analytics.period' + t.charAt(0).toUpperCase() + t.slice(1))}</button>`).join('')}
      </div>

      <div class="period-nav">
        <button class="icon-btn" id="period-prev" aria-label="${I18n.t('analytics.prevPeriod')}">${icon('chevronLeft', 18)}</button>
        <span class="period-nav__label">${label}</span>
        <button class="icon-btn" id="period-next" aria-label="${I18n.t('analytics.nextPeriod')}" ${nextEnabled ? '' : 'disabled'}>${icon('chevronRight', 18)}</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--good-bg); color:var(--good);">${icon('wallet', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiIncome')}</span>
          <span class="kpi-card__value" style="color:var(--good);">${formatCurrency(report.income.total, currency)}</span>
          <span class="kpi-card__sub">${deltaBadge(report.income.total, report.income.prevTotal, currency, true)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--cat-personal-bg); color:var(--cat-personal);">${icon('cart', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiExpenses')}</span>
          <span class="kpi-card__value">${formatCurrency(report.expenses.total, currency)}</span>
          <span class="kpi-card__sub">${deltaBadge(report.expenses.total, report.expenses.prevTotal, currency, false)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--cat-utilities-bg); color:var(--cat-utilities);">${icon('income', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiNet')}</span>
          <span class="kpi-card__value ${report.net.total < 0 ? 'kpi-card__value--danger' : 'kpi-card__value--good'}">${formatCurrency(report.net.total, currency)}</span>
          <span class="kpi-card__sub">${deltaBadge(report.net.total, report.net.prevTotal, currency, true)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--cat-car-bg); color:var(--cat-car);">${icon('piggy', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiSaved')}</span>
          <span class="kpi-card__value">${formatCurrency(report.savings.total, currency)}</span>
          <span class="kpi-card__sub">${deltaBadge(report.savings.total, report.savings.prevTotal, currency, true)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--cat-kids-bg); color:var(--cat-kids);">${icon('wallet', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiNetWorth')}</span>
          <span class="kpi-card__value ${report.netWorth.end < 0 ? 'kpi-card__value--danger' : ''}">${formatCurrency(report.netWorth.end, currency)}</span>
          <span class="kpi-card__sub">${deltaBadge(report.netWorth.end, report.netWorth.prevEnd, currency, true)}</span>
        </div>
      </div>

      ${!report.hasAnyData ? `
        <div class="empty-state">${I18n.t('analytics.emptyPeriod')}</div>
      ` : `
        <div class="dash-body" style="display:grid; grid-template-columns:1.35fr 1fr; gap:22px;">
          <div class="card">
            <div class="u-flex u-justify-between u-items-center u-mb-sm">
              <h3 class="section-title">${I18n.t('analytics.spendingByCategory')}</h3>
              <span class="u-text-faint u-text-sm">${I18n.t('analytics.budgetForPeriod')}</span>
            </div>
            ${report.expenses.byCategory.length === 0
              ? `<div class="empty-state">${I18n.t('analytics.noCategories')}</div>`
              : report.expenses.byCategory.map(c => {
                  const pct = c.periodBudget > 0 ? Math.min(100, Math.round((c.spent / c.periodBudget) * 100)) : (c.spent > 0 ? 100 : 0);
                  return `
                    <div class="cat-row">
                      <span class="cat-chip" style="background:${c.color ? `var(--cat-${c.color}-bg)` : 'var(--surface-2)'}; color:${c.color ? `var(--cat-${c.color})` : 'var(--ink-faint)'};">${icon(c.icon, 18)}</span>
                      <div class="cat-row__body">
                        <div class="cat-row__top">
                          <span class="cat-row__name">${c.color ? categoryLabel(c) : I18n.t('category.other')}</span>
                          <span class="cat-row__amounts">${formatCurrency(c.spent, currency)} / ${formatCurrency(c.periodBudget, currency)}</span>
                        </div>
                        <div class="progress-track"><div class="progress-fill" style="width:${pct}%; background:${c.color ? `var(--cat-${c.color})` : 'var(--ink-faint)'};"></div></div>
                      </div>
                    </div>
                  `;
                }).join('')}
          </div>

          <div class="u-flex-col u-gap-md">
            <div class="card u-flex-col u-items-center u-gap-sm">
              <h3 class="section-title" style="align-self:flex-start;">${I18n.t('dashboard.spendingBreakdown')}</h3>
              <div class="donut-wrap">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="54" fill="none" stroke="var(--surface-2)" stroke-width="16"></circle>
                  <g transform="rotate(-90 70 70)">
                    ${buildDonutSegments(report.expenses.byCategory.map(c => ({ ...c, strokeColor: c.color ? `var(--cat-${c.color})` : 'var(--ink-faint)' })), donutTotal)}
                  </g>
                </svg>
                <div class="donut-center">
                  <span class="donut-center__value">${formatCurrency(donutTotal, currency)}</span>
                  <span class="donut-center__label">${I18n.t('analytics.periodTotalShort')}</span>
                </div>
              </div>
              ${donutTotal === 0 ? `<p class="u-text-muted u-text-sm">${I18n.t('analytics.noSpending')}</p>` : `
                <div class="legend">
                  ${report.expenses.byCategory.filter(c => c.spent > 0).map(c => `
                    <span class="legend__item">
                      <span class="legend__dot" style="background:${c.color ? `var(--cat-${c.color})` : 'var(--ink-faint)'};"></span>
                      ${c.color ? categoryLabel(c) : I18n.t('category.other')} ${Math.round((c.spent / donutTotal) * 100)}%
                    </span>
                  `).join('')}
                </div>
              `}
            </div>

            <div class="card">
              <h3 class="section-title u-mb-sm">${I18n.t('analytics.fundsTitle')}</h3>
              ${fundsWithContribution.length === 0
                ? `<p class="u-text-muted u-text-sm" style="margin:0;">${I18n.t('analytics.noFundContributions')}</p>`
                : fundsWithContribution.map(f => {
                    const def = FUND_TYPE_DEFS[f.type] || FUND_TYPE_DEFS.general;
                    const colors = fundTypeColors(def.color);
                    return `
                      <div class="tx-row">
                        <span class="tx-row__icon" style="background:${colors.bg}; color:${colors.fg};">${icon(def.icon, 15)}</span>
                        <div class="tx-row__body">
                          <div class="tx-row__title">${f.name}</div>
                        </div>
                        <span class="tx-row__amount" style="color:var(--good);">+${formatCurrency(f.contributed, currency)}</span>
                      </div>
                    `;
                  }).join('')}
            </div>
          </div>
        </div>
      `}

      ${report.hasAccountsOrDebts ? `<p class="u-text-muted u-text-sm u-mt-md">${I18n.t('analytics.netWorthNote')}</p>` : ''}
    `;

    container.querySelectorAll('[data-period-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        periodType = btn.dataset.periodType;
        anchor = new Date();
        paint();
      });
    });
    container.querySelector('#period-prev').addEventListener('click', () => {
      anchor = shiftAnchor(periodType, anchor, -1);
      paint();
    });
    const nextBtn = container.querySelector('#period-next');
    if (nextEnabled) {
      nextBtn.addEventListener('click', () => {
        anchor = shiftAnchor(periodType, anchor, 1);
        paint();
      });
    }
  }

  paint();
}
