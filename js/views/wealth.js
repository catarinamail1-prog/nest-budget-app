// views/wealth.js — hub "Patrimônio": abas Contas | Dívidas | Net Worth (as duas últimas ainda são placeholder)
import { I18n } from '../utils/i18n.js';
import { renderAccounts } from './accounts.js';
import { renderDebts } from './debts.js';
import { renderNetWorth } from './networth.js';

export function renderWealth(container) {
  let activeTab = 'accounts';

  function paint() {
    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${I18n.t('wealth.title')}</h1>
          <p class="view-subtitle">${I18n.t('wealth.subtitle')}</p>
        </div>
      </div>
      <div class="subtabs">
        <button class="subtab ${activeTab === 'accounts' ? 'is-active' : ''}" data-tab="accounts">${I18n.t('wealth.tabAccounts')}</button>
        <button class="subtab ${activeTab === 'debts' ? 'is-active' : ''}" data-tab="debts">${I18n.t('wealth.tabDebts')}</button>
        <button class="subtab ${activeTab === 'networth' ? 'is-active' : ''}" data-tab="networth">${I18n.t('wealth.tabNetWorth')}</button>
      </div>
      <div id="wealth-tab-body"></div>
    `;

    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        paint();
      });
    });

    const body = container.querySelector('#wealth-tab-body');
    if (activeTab === 'accounts') {
      renderAccounts(body);
    } else if (activeTab === 'debts') {
      renderDebts(body);
    } else {
      renderNetWorth(body);
    }
  }

  paint();
}
