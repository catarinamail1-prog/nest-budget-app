// views/networth.js — Net Worth: ativos (contas) vs. passivos (cartões de crédito + dívidas) num só lugar.
// Tela somente leitura de propósito — editar continua nas abas Contas/Dívidas, pra não duplicar a fonte da verdade.
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, round2 } from '../utils/format.js';
import { ACCOUNT_TYPE_DEFS, isLiabilityAccount, accountTypeColors, computeAccountBalance } from '../modules/accounts.js';
import { DEBT_TYPE_DEFS } from '../modules/debts.js';

function debtTypeColors(colorKey) {
  if (colorKey === 'danger') return { fg: 'var(--danger)', bg: 'var(--danger-bg)' };
  return { fg: `var(--cat-${colorKey})`, bg: `var(--cat-${colorKey}-bg)` };
}

function row(name, metaLabel, iconName, colors, amount, currency, amountColor) {
  return `
    <div class="tx-row">
      <span class="tx-row__icon" style="background:${colors.bg}; color:${colors.fg};">${icon(iconName, 15)}</span>
      <div class="tx-row__body">
        <div class="tx-row__title">${name}</div>
        <div class="tx-row__meta">${metaLabel}</div>
      </div>
      <span class="tx-row__amount" style="color:${amountColor};">${formatCurrency(amount, currency)}</span>
    </div>
  `;
}

export function renderNetWorth(container) {
  function paint() {
    const currency = DB.getSettings().currency;
    const accounts = DB.getAccounts();
    const debts = DB.getDebts();
    const expenses = DB.getExpenses();
    const incomes = DB.getIncomes();

    const accountsWithBalance = accounts.map(a => ({ ...a, balance: computeAccountBalance(a, expenses, incomes) }));
    const assetAccounts = accountsWithBalance.filter(a => !isLiabilityAccount(a));
    const liabilityAccounts = accountsWithBalance.filter(a => isLiabilityAccount(a));

    const totalAssets = round2(assetAccounts.reduce((s, a) => s + a.balance, 0));
    const totalLiabilities = round2(liabilityAccounts.reduce((s, a) => s + a.balance, 0) + debts.reduce((s, d) => s + d.balance, 0));
    const netWorth = round2(totalAssets - totalLiabilities);

    const hasAnything = accounts.length > 0 || debts.length > 0;

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('networth.kpiAssets')}</span>
          <span class="kpi-card__value kpi-card__value--good">${formatCurrency(totalAssets, currency)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('networth.kpiLiabilities')}</span>
          <span class="kpi-card__value ${totalLiabilities > 0 ? 'kpi-card__value--danger' : ''}">${formatCurrency(totalLiabilities, currency)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">${I18n.t('networth.kpiNet')}</span>
          <span class="kpi-card__value ${netWorth < 0 ? 'kpi-card__value--danger' : 'kpi-card__value--good'}">${formatCurrency(netWorth, currency)}</span>
        </div>
      </div>

      ${!hasAnything ? `
        <div class="empty-state u-mt-md">${I18n.t('networth.empty')}</div>
      ` : `
        <div class="card u-mt-md">
          <h3 class="section-title u-mb-sm">${I18n.t('networth.assetsTitle')}</h3>
          ${assetAccounts.length === 0
            ? `<p class="u-text-muted u-text-sm">${I18n.t('networth.noAssets')}</p>`
            : assetAccounts.map(a => {
                const def = ACCOUNT_TYPE_DEFS[a.type] || ACCOUNT_TYPE_DEFS.checking;
                const colors = accountTypeColors(def.color);
                return row(a.name, I18n.t('accountType.' + a.type), def.icon, colors, a.balance, currency, 'var(--good)');
              }).join('')}
        </div>

        <div class="card u-mt-md">
          <h3 class="section-title u-mb-sm">${I18n.t('networth.liabilitiesTitle')}</h3>
          ${(liabilityAccounts.length === 0 && debts.length === 0)
            ? `<p class="u-text-muted u-text-sm">${I18n.t('networth.noLiabilities')}</p>`
            : liabilityAccounts.map(a => {
                const def = ACCOUNT_TYPE_DEFS[a.type] || ACCOUNT_TYPE_DEFS.credit_card;
                const colors = accountTypeColors(def.color);
                return row(a.name, I18n.t('accountType.' + a.type), def.icon, colors, a.balance, currency, 'var(--danger)');
              }).join('') + debts.map(d => {
                const def = DEBT_TYPE_DEFS[d.type] || DEBT_TYPE_DEFS.other;
                const colors = debtTypeColors(def.color);
                return row(d.name, I18n.t('debtType.' + d.type), def.icon, colors, d.balance, currency, 'var(--danger)');
              }).join('')}
        </div>

        <p class="u-text-muted u-text-sm u-mt-sm">${I18n.t('networth.editHint')}</p>
      `}
    `;
  }

  paint();
}
