// views/accounts.js — contas bancárias e cartões de crédito: KPIs de patrimônio + lista com saldo computado
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, round2 } from '../utils/format.js';
import { openAccountModal } from './account-modal.js';
import { showToast } from '../components/toast.js';
import { ACCOUNT_TYPE_DEFS, isLiabilityAccount, accountTypeColors, computeAccountBalance } from '../modules/accounts.js';

export function renderAccounts(container) {
  const currency = DB.getSettings().currency;

  function paint() {
    const accounts = DB.getAccounts();
    const expenses = DB.getExpenses();
    const incomes = DB.getIncomes();

    const withBalance = accounts.map(a => ({ ...a, balance: computeAccountBalance(a, expenses, incomes) }));
    const totalAssets = round2(withBalance.filter(a => !isLiabilityAccount(a)).reduce((s, a) => s + a.balance, 0));
    const totalOwed = round2(withBalance.filter(a => isLiabilityAccount(a)).reduce((s, a) => s + a.balance, 0));
    const net = round2(totalAssets - totalOwed);

    container.innerHTML = `
      <div class="u-flex u-justify-between u-items-center u-mb-md" style="flex-wrap:wrap; gap:12px;">
        <div class="kpi-grid" style="flex:1; margin-bottom:0;">
          <div class="kpi-card">
            <span class="kpi-card__label">${I18n.t('accounts.kpiTotal')}</span>
            <span class="kpi-card__value">${formatCurrency(totalAssets, currency)}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-card__label">${I18n.t('accounts.kpiOwed')}</span>
            <span class="kpi-card__value ${totalOwed > 0 ? 'kpi-card__value--danger' : ''}">${formatCurrency(totalOwed, currency)}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-card__label">${I18n.t('accounts.kpiNet')}</span>
            <span class="kpi-card__value ${net < 0 ? 'kpi-card__value--danger' : 'kpi-card__value--good'}">${formatCurrency(net, currency)}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="u-flex u-justify-between u-items-center u-mb-sm">
          <h3 class="section-title">${I18n.t('wealth.tabAccounts')}</h3>
          <button class="btn btn--primary btn--sm" id="btn-add-account">${icon('plus', 16, 2)}${I18n.t('accounts.addAccount')}</button>
        </div>
        ${withBalance.length === 0
          ? `<div class="empty-state">${I18n.t('accounts.empty')}</div>`
          : withBalance.map(a => {
              const def = ACCOUNT_TYPE_DEFS[a.type] || ACCOUNT_TYPE_DEFS.checking;
              const colors = accountTypeColors(def.color);
              const liability = isLiabilityAccount(a);
              return `
              <div class="tx-row">
                <span class="tx-row__icon" style="background:${colors.bg}; color:${colors.fg};">${icon(def.icon, 15)}</span>
                <div class="tx-row__body">
                  <div class="tx-row__title">${a.name}</div>
                  <div class="tx-row__meta">${I18n.t('accountType.' + a.type)}</div>
                </div>
                <span class="tx-row__amount" style="color:${liability && a.balance > 0 ? 'var(--danger)' : 'var(--ink)'};">${formatCurrency(a.balance, currency)}</span>
                <div class="tx-row__actions">
                  <button class="icon-btn" data-edit="${a.id}" aria-label="${I18n.t('common.edit')}">${icon('pencil', 15)}</button>
                  <button class="icon-btn icon-btn--danger" data-del="${a.id}" aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>
                </div>
              </div>
            `;
            }).join('')}
      </div>
    `;

    container.querySelector('#btn-add-account').addEventListener('click', () => {
      openAccountModal(container, { onSaved: paint });
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const account = DB.getAccounts().find(a => a.id === btn.dataset.edit);
        if (account) openAccountModal(container, { account, onSaved: paint });
      });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('accounts.deleteConfirm'))) return;
        DB.deleteAccount(btn.dataset.del);
        showToast(I18n.t('toast.accountDeleted'), 'success');
        paint();
      });
    });
  }

  paint();
}
