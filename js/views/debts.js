// views/debts.js — Calculadora de Dívidas: KPIs, estratégia (snowball/avalanche/custom), plano de quitação e lista
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, round2 } from '../utils/format.js';
import { openDebtModal } from './debt-modal.js';
import { showToast } from '../components/toast.js';
import {
  DEBT_TYPE_DEFS, DEBT_STRATEGIES, orderDebts, totalMinPayments, weightedAvgApr, simulatePayoffPlan
} from '../modules/debts.js';

// Mesmo problema de accounts.js/income.js: 'danger'/'extra' não seguem todos o padrão --cat-*.
function debtTypeColors(colorKey) {
  if (colorKey === 'danger') return { fg: 'var(--danger)', bg: 'var(--danger-bg)' };
  return { fg: `var(--cat-${colorKey})`, bg: `var(--cat-${colorKey}-bg)` };
}

export function renderDebts(container) {
  const currency = DB.getSettings().currency;

  function paint() {
    const debts = DB.getDebts();
    const plan = DB.getDebtPlan();
    const strategy = plan.strategy || 'avalanche';
    const extraMonthly = plan.extraMonthly || 0;

    const totalDebt = round2(debts.reduce((s, d) => s + d.balance, 0));
    const avgApr = weightedAvgApr(debts);
    const minPayments = totalMinPayments(debts);
    const sim = simulatePayoffPlan(debts, extraMonthly, strategy);
    const ordered = orderDebts(debts, strategy);
    const payoffMonthByDebt = {};
    sim.payoffOrder.forEach(p => { payoffMonthByDebt[p.id] = p.month; });

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('debts.kpiTotal')}</span>
          <span class="kpi-card__value ${totalDebt > 0 ? 'kpi-card__value--danger' : ''}">${formatCurrency(totalDebt, currency)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('debts.kpiAvgApr')}</span>
          <span class="kpi-card__value">${avgApr.toFixed(1)}%</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('debts.kpiMinPayments')}</span>
          <span class="kpi-card__value">${formatCurrency(minPayments, currency)}</span>
        </div>
      </div>

      <div class="card u-mt-md">
        <h3 class="section-title u-mb-sm">${I18n.t('debts.planTitle')}</h3>
        <div class="quiz-stepper-row" style="padding:0; background:none;">
          <span style="font-weight:600;font-size:14px;">${I18n.t('debts.strategyLabel')}</span>
          <div class="pill-group">
            ${DEBT_STRATEGIES.map(s => `<div class="pill-btn pill-btn--text ${strategy === s ? 'is-selected' : ''}" data-strategy="${s}">${I18n.t('debtStrategy.' + s)}</div>`).join('')}
          </div>
        </div>
        <p class="u-text-muted u-text-sm u-mt-xs">${I18n.t('debtStrategy.' + strategy + 'Hint')}</p>
        <label class="field u-mt-sm">
          <span class="field__label">${I18n.t('debts.extraMonthly')}</span>
          <input type="number" min="0" step="1" id="debt-extra" value="${extraMonthly || ''}" placeholder="${formatCurrency(0, currency)}">
        </label>
        ${debts.length === 0 ? '' : `
          <div class="u-mt-md" style="background:var(--accent-tint); border-radius:var(--radius-md); padding:14px 16px;">
            ${sim.reachable ? `
              <p style="margin:0; font-weight:600; color:var(--accent-dark);">${sim.months <= 0 ? I18n.t('debts.debtFreeNow') : I18n.t('debts.payoffSummary', { months: sim.months })}</p>
              <p class="u-text-sm u-text-muted" style="margin:4px 0 0;">${I18n.t('debts.interestSummary', { amount: formatCurrency(sim.totalInterest, currency) })}</p>
            ` : `<p style="margin:0; font-weight:600; color:var(--danger);">${I18n.t('debts.unreachableWarning')}</p>`}
          </div>
        `}
      </div>

      <div class="card u-mt-md">
        <div class="u-flex u-justify-between u-items-center u-mb-sm">
          <h3 class="section-title">${I18n.t('wealth.tabDebts')}</h3>
          <button class="btn btn--primary btn--sm" id="btn-add-debt">${icon('plus', 16, 2)}${I18n.t('debts.addDebt')}</button>
        </div>
        ${debts.length === 0
          ? `<div class="empty-state">${I18n.t('debts.empty')}</div>`
          : ordered.map((d, i) => {
              const def = DEBT_TYPE_DEFS[d.type] || DEBT_TYPE_DEFS.other;
              const colors = debtTypeColors(def.color);
              const month = payoffMonthByDebt[d.id];
              return `
              <div class="tx-row">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent-tint);color:var(--accent);font-weight:700;font-size:12px;flex-shrink:0;">${i + 1}</span>
                <span class="tx-row__icon" style="background:${colors.bg}; color:${colors.fg};">${icon(def.icon, 15)}</span>
                <div class="tx-row__body">
                  <div class="tx-row__title">${d.name}</div>
                  <div class="tx-row__meta">${I18n.t('debtType.' + d.type)} · ${d.apr}% APR${month ? ' · ' + I18n.t('debts.payoffInMonth', { month }) : ''}</div>
                </div>
                <span class="tx-row__amount" style="color:var(--danger);">${formatCurrency(d.balance, currency)}</span>
                <div class="tx-row__actions">
                  ${strategy === 'custom' ? `
                    <button class="icon-btn" data-move-up="${d.id}" aria-label="${I18n.t('debts.moveUp')}" ${i === 0 ? 'disabled' : ''}>${icon('chevronUp', 15)}</button>
                    <button class="icon-btn" data-move-down="${d.id}" aria-label="${I18n.t('debts.moveDown')}" ${i === ordered.length - 1 ? 'disabled' : ''}>${icon('chevronDown', 15)}</button>
                  ` : ''}
                  <button class="icon-btn" data-edit="${d.id}" aria-label="${I18n.t('common.edit')}">${icon('pencil', 15)}</button>
                  <button class="icon-btn icon-btn--danger" data-del="${d.id}" aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>
                </div>
              </div>
            `;
            }).join('')}
      </div>
    `;

    container.querySelectorAll('[data-strategy]').forEach(btn => {
      btn.addEventListener('click', () => {
        DB.saveDebtPlan({ strategy: btn.dataset.strategy });
        paint();
      });
    });

    const extraInput = container.querySelector('#debt-extra');
    extraInput.addEventListener('input', () => {
      const val = parseFloat(extraInput.value);
      DB.saveDebtPlan({ extraMonthly: Number.isFinite(val) && val >= 0 ? round2(val) : 0 });
    });
    extraInput.addEventListener('change', paint);

    container.querySelector('#btn-add-debt').addEventListener('click', () => {
      openDebtModal(container, { onSaved: paint });
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const debtRecord = DB.getDebts().find(d => d.id === btn.dataset.edit);
        if (debtRecord) openDebtModal(container, { debt: debtRecord, onSaved: paint });
      });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('debts.deleteConfirm'))) return;
        DB.deleteDebt(btn.dataset.del);
        showToast(I18n.t('toast.debtDeleted'), 'success');
        paint();
      });
    });
    container.querySelectorAll('[data-move-up]').forEach(btn => {
      btn.addEventListener('click', () => swapOrder(btn.dataset.moveUp, -1));
    });
    container.querySelectorAll('[data-move-down]').forEach(btn => {
      btn.addEventListener('click', () => swapOrder(btn.dataset.moveDown, 1));
    });

    function swapOrder(id, dir) {
      const current = orderDebts(DB.getDebts(), 'custom');
      const idx = current.findIndex(d => d.id === id);
      const targetIdx = idx + dir;
      if (idx < 0 || targetIdx < 0 || targetIdx >= current.length) return;
      const a = current[idx];
      const b = current[targetIdx];
      const aOrder = a.order ?? idx;
      const bOrder = b.order ?? targetIdx;
      DB.updateDebt(a.id, { order: bOrder });
      DB.updateDebt(b.id, { order: aOrder });
      paint();
    }
  }

  paint();
}
