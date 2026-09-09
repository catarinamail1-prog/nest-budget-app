// views/paycheck-view.js — Visão por Contracheque: qual recebimento do mês cobre quais categorias do orçamento
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatDateShort, isSameMonth, round2 } from '../utils/format.js';
import { categoryLabel } from '../utils/helpers.js';
import { computePaycheckPlan } from '../modules/paycheck.js';
import { INCOME_TYPE_DEFS } from '../modules/income-types.js';

// Mesmo padrão de income.js: 'good'/'muted' não seguem a família --cat-* das categorias de despesa.
function incomeTypeColors(colorKey) {
  if (colorKey === 'good') return { fg: 'var(--good)', bg: 'var(--good-bg)' };
  if (colorKey === 'muted') return { fg: 'var(--ink-muted)', bg: 'var(--surface-2)' };
  return { fg: `var(--cat-${colorKey})`, bg: `var(--cat-${colorKey}-bg)` };
}

function catColorVar(color) {
  if (color === 'good') return 'var(--good)';
  if (color === 'danger') return 'var(--danger)';
  return `var(--cat-${color})`;
}

export function renderPaycheckView(container) {
  const lang = I18n.getLang();
  const currency = DB.getSettings().currency;
  const now = new Date();

  const categories = DB.getCategories();
  const incomes = DB.getIncomes()
    .filter(i => isSameMonth(i.date, now))
    .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));

  const totalIncome = round2(incomes.reduce((s, i) => s + i.amount, 0));
  const totalBudget = round2(categories.reduce((s, c) => s + c.budget, 0));
  const coveragePct = totalBudget > 0 ? Math.round((totalIncome / totalBudget) * 100) : (totalIncome > 0 ? 100 : 0);

  const { plan, shortfall, uncoveredCategories } = computePaycheckPlan(incomes, categories);

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-card__label">${I18n.t('paycheck.kpiIncome')}</span>
        <span class="kpi-card__value kpi-card__value--good">${formatCurrency(totalIncome, currency)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-card__label">${I18n.t('paycheck.kpiBudget')}</span>
        <span class="kpi-card__value">${formatCurrency(totalBudget, currency)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-card__label">${I18n.t('paycheck.kpiCoverage')}</span>
        <span class="kpi-card__value ${coveragePct < 100 ? 'kpi-card__value--danger' : 'kpi-card__value--good'}">${coveragePct}%</span>
      </div>
    </div>

    ${incomes.length === 0 ? `
      <div class="empty-state u-mt-md">${I18n.t('paycheck.empty')}</div>
    ` : `
      <div class="u-flex-col u-gap-md u-mt-md">
        ${plan.map((entry, i) => {
          const p = entry.paycheck;
          const def = INCOME_TYPE_DEFS[p.type] || INCOME_TYPE_DEFS.other;
          const colors = incomeTypeColors(def.color);
          return `
            <div class="card">
              <div class="u-flex u-justify-between u-items-center u-mb-sm" style="flex-wrap:wrap; gap:10px;">
                <div class="u-flex u-items-center u-gap-sm">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent-tint);color:var(--accent);font-weight:700;font-size:12px;flex-shrink:0;">${i + 1}</span>
                  <span class="tx-row__icon" style="background:${colors.bg}; color:${colors.fg};">${icon(def.icon, 15)}</span>
                  <div>
                    <div style="font-weight:600;">${p.description}</div>
                    <div class="u-text-muted u-text-sm">${formatDateShort(p.date, lang)}</div>
                  </div>
                </div>
                <span style="font-weight:700; color:var(--good); font-family:var(--font-display); font-size:18px;">+${formatCurrency(p.amount, currency)}</span>
              </div>
              ${entry.allocations.length === 0
                ? `<p class="u-text-muted u-text-sm" style="margin:0;">${I18n.t('paycheck.noneCovered')}</p>`
                : `<div class="legend" style="justify-content:flex-start;">
                    ${entry.allocations.map(a => {
                      const cat = categories.find(c => c.key === a.key);
                      return `<span class="legend__item"><span class="legend__dot" style="background:${catColorVar(a.color)};"></span>${categoryLabel(cat)} ${formatCurrency(a.amount, currency)}${a.isPartial ? ' <span class="u-text-faint">(' + I18n.t('paycheck.partial') + ')</span>' : ''}</span>`;
                    }).join('')}
                  </div>`}
              ${entry.leftover > 0 ? `<p class="u-text-sm" style="color:var(--good); margin:8px 0 0;">${I18n.t('paycheck.leftover', { amount: formatCurrency(entry.leftover, currency) })}</p>` : ''}
            </div>
          `;
        }).join('')}

        ${shortfall > 0 ? `
          <div class="card" style="border:1px solid var(--danger); background:var(--danger-bg);">
            <p style="margin:0; font-weight:600; color:var(--danger);">${I18n.t('paycheck.shortfallTitle', { amount: formatCurrency(shortfall, currency) })}</p>
            <div class="legend" style="justify-content:flex-start; margin-top:8px;">
              ${uncoveredCategories.map(c => {
                const cat = categories.find(x => x.key === c.key);
                return `<span class="legend__item"><span class="legend__dot" style="background:${catColorVar(c.color)};"></span>${categoryLabel(cat)} ${formatCurrency(c.remaining, currency)}</span>`;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `}
  `;
}
