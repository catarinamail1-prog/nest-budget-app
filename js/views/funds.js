// views/funds.js — Cofrinhos (sinking funds): KPIs, gráfico de participação, progresso por cofrinho e contribuições
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatDateShort, round2, clamp } from '../utils/format.js';
import { FUND_TYPE_DEFS, computeFundSaved } from '../modules/funds.js';
import { openFundModal } from './fund-modal.js';
import { openContributionModal } from './fund-contribution-modal.js';
import { showToast } from '../components/toast.js';

// Mesmo padrão de accounts.js/debts.js: 'good'/'danger' não seguem a família --cat-* das categorias.
function fundTypeColors(colorKey) {
  if (colorKey === 'good') return { fg: 'var(--good)', bg: 'var(--good-bg)' };
  if (colorKey === 'danger') return { fg: 'var(--danger)', bg: 'var(--danger-bg)' };
  return { fg: `var(--cat-${colorKey})`, bg: `var(--cat-${colorKey}-bg)` };
}

// Mesmo desenho do donut de gastos do dashboard (gap de 3px entre fatias pra abrir a divisão branca),
// aqui aplicado à participação de cada cofrinho no total guardado.
function buildDonutSegments(items, total) {
  if (total <= 0) return '';
  const r = 54, c = 2 * Math.PI * r;
  const gap = 3;
  let acc = 0;
  return items.filter(i => i.value > 0).map(i => {
    const frac = i.value / total;
    const len = frac * c;
    const drawLen = Math.max(len - gap, 0.5);
    const seg = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${i.strokeColor}" stroke-width="16" stroke-dasharray="${drawLen.toFixed(1)} ${(c - drawLen).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}"></circle>`;
    acc += len;
    return seg;
  }).join('');
}

export function renderFunds(container) {
  const lang = I18n.getLang();

  function paint() {
    const currency = DB.getSettings().currency;
    const funds = DB.getFunds();
    const savingsExpenses = DB.getExpenses()
      .filter(e => e.categoryKey === CONFIG.SAVINGS_CATEGORY_KEY)
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

    const fundsWithSaved = funds.map(f => ({ ...f, saved: computeFundSaved(f, savingsExpenses) }));
    const totalSaved = round2(fundsWithSaved.reduce((s, f) => s + f.saved, 0));
    const totalTarget = round2(fundsWithSaved.reduce((s, f) => s + f.target, 0));
    const totalRemaining = round2(Math.max(0, totalTarget - totalSaved));

    const donutItems = fundsWithSaved.map(f => {
      const def = FUND_TYPE_DEFS[f.type] || FUND_TYPE_DEFS.general;
      return { ...f, value: f.saved, strokeColor: fundTypeColors(def.color).fg };
    });

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${I18n.t('funds.title')}</h1>
          <p class="view-subtitle">${I18n.t('funds.subtitle')}</p>
        </div>
        <button class="btn btn--primary" id="btn-add-fund">${icon('plus', 17, 2)}${I18n.t('funds.addFund')}</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('funds.kpiSaved')}</span>
          <span class="kpi-card__value kpi-card__value--good">${formatCurrency(totalSaved, currency)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('funds.kpiTarget')}</span>
          <span class="kpi-card__value">${formatCurrency(totalTarget, currency)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('funds.kpiRemaining')}</span>
          <span class="kpi-card__value">${formatCurrency(totalRemaining, currency)}</span>
        </div>
      </div>

      ${funds.length === 0 ? `
        <div class="empty-state u-mt-md">${I18n.t('funds.empty')}</div>
      ` : `
        <div class="dash-body" style="display:grid; grid-template-columns:1.35fr 1fr; gap:22px; margin-top:22px;">
          <div class="u-flex-col u-gap-md">
            ${fundsWithSaved.map(f => {
              const def = FUND_TYPE_DEFS[f.type] || FUND_TYPE_DEFS.general;
              const colors = fundTypeColors(def.color);
              const pct = f.target > 0 ? clamp(Math.round((f.saved / f.target) * 100), 0, 999) : (f.saved > 0 ? 100 : 0);
              const reached = f.target > 0 && f.saved >= f.target;
              return `
                <div class="card">
                  <div class="u-flex u-justify-between u-items-start u-mb-sm">
                    <div class="u-flex u-items-center u-gap-sm">
                      <span class="cat-chip" style="background:${colors.bg}; color:${colors.fg};">${icon(def.icon, 18)}</span>
                      <div>
                        <div style="font-weight:600;">${f.name}</div>
                        <div class="u-text-muted u-text-sm">${I18n.t('fundType.' + f.type)}${f.targetDate ? ' · ' + I18n.t('funds.targetDateLabel', { date: formatDateShort(f.targetDate, lang) }) : ''}</div>
                      </div>
                    </div>
                    <div class="tx-row__actions" style="opacity:1;">
                      <button class="icon-btn" data-add-money="${f.id}" aria-label="${I18n.t('funds.addMoney')}">${icon('plus', 15)}</button>
                      <button class="icon-btn" data-edit="${f.id}" aria-label="${I18n.t('common.edit')}">${icon('pencil', 15)}</button>
                      <button class="icon-btn icon-btn--danger" data-del="${f.id}" aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>
                    </div>
                  </div>
                  <div class="progress-track" style="height:8px;"><div class="progress-fill" style="width:${Math.min(100, pct)}%; background:${reached ? 'var(--good)' : colors.fg};"></div></div>
                  <p class="u-text-sm u-text-muted u-mt-xs" style="margin:6px 0 0;">
                    ${reached ? I18n.t('funds.reached') : I18n.t('funds.progress', { saved: formatCurrency(f.saved, currency), target: formatCurrency(f.target, currency), pct })}
                  </p>
                </div>
              `;
            }).join('')}
          </div>

          <div class="u-flex-col u-gap-md">
            <div class="card u-flex-col u-items-center u-gap-sm">
              <h3 class="section-title" style="align-self:flex-start;">${I18n.t('funds.breakdown')}</h3>
              <div class="donut-wrap">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="54" fill="none" stroke="var(--surface-2)" stroke-width="16"></circle>
                  <g transform="rotate(-90 70 70)">
                    ${buildDonutSegments(donutItems, totalSaved)}
                  </g>
                </svg>
                <div class="donut-center">
                  <span class="donut-center__value">${formatCurrency(totalSaved, currency)}</span>
                  <span class="donut-center__label">${I18n.t('funds.savedLabel')}</span>
                </div>
              </div>
              <div class="legend">
                ${donutItems.filter(f => f.saved > 0).map(f => `
                  <span class="legend__item">
                    <span class="legend__dot" style="background:${f.strokeColor};"></span>
                    ${f.name} ${totalSaved > 0 ? Math.round((f.saved / totalSaved) * 100) : 0}%
                  </span>
                `).join('')}
              </div>
              ${totalSaved <= 0 ? `<p class="u-text-muted u-text-sm" style="margin:0;">${I18n.t('funds.breakdownEmpty')}</p>` : ''}
            </div>

            <div class="card">
              <h3 class="section-title u-mb-sm">${I18n.t('funds.history')}</h3>
              ${savingsExpenses.length === 0
                ? `<div class="empty-state">${I18n.t('funds.historyEmpty')}</div>`
                : savingsExpenses.slice(0, 8).map(c => {
                    const f = funds.find(x => x.id === c.fundId);
                    return `
                      <div class="tx-row">
                        <span class="tx-row__icon">${icon('piggy', 15)}</span>
                        <div class="tx-row__body">
                          <div class="tx-row__title">${c.description || I18n.t('funds.addMoney')}</div>
                          <div class="tx-row__meta">${f ? f.name : I18n.t('funds.unassigned')} · ${formatDateShort(c.date, lang)}</div>
                        </div>
                        <span class="tx-row__amount">${formatCurrency(c.amount, currency)}</span>
                        <div class="tx-row__actions">
                          <button class="icon-btn icon-btn--danger" data-del-contrib="${c.id}" aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>
                        </div>
                      </div>
                    `;
                  }).join('')}
            </div>
          </div>
        </div>
      `}
    `;

    container.querySelector('#btn-add-fund').addEventListener('click', () => {
      openFundModal(container, { onSaved: paint });
    });
    container.querySelectorAll('[data-add-money]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fund = DB.getFunds().find(f => f.id === btn.dataset.addMoney);
        if (fund) openContributionModal(container, { fund, onSaved: paint });
      });
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fund = DB.getFunds().find(f => f.id === btn.dataset.edit);
        if (fund) openFundModal(container, { fund, onSaved: paint });
      });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('funds.deleteConfirm'))) return;
        DB.deleteFund(btn.dataset.del);
        showToast(I18n.t('toast.fundDeleted'), 'success');
        paint();
      });
    });
    container.querySelectorAll('[data-del-contrib]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('expense.deleteConfirm'))) return;
        DB.deleteExpense(btn.dataset.delContrib);
        showToast(I18n.t('toast.expenseDeleted'), 'success');
        paint();
      });
    });
  }

  paint();
}
