// views/fund-contribution-modal.js — modal de "adicionar dinheiro" a um cofrinho específico
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { showToast } from '../components/toast.js';
import { round2, formatDateISO } from '../utils/format.js';
import '../components/app-modal.js';

export function openContributionModal(hostContainer, { fund, onSaved }) {
  const el = document.createElement('app-modal');
  el.setAttribute('modal-title', I18n.t('funds.addMoneyTitle', { name: fund.name }));
  el.innerHTML = `
    <div class="field-row">
      <label class="field">
        <span class="field__label">${I18n.t('funds.addMoneyLabel')}</span>
        <input type="number" min="0" step="0.01" id="contrib-amount">
      </label>
      <label class="field">
        <span class="field__label">${I18n.t('expense.date')}</span>
        <input type="date" id="contrib-date" value="${formatDateISO()}">
      </label>
    </div>
    <div class="app-modal__actions">
      <button class="btn btn--ghost" id="contrib-cancel">${I18n.t('common.cancel')}</button>
      <button class="btn btn--primary" id="contrib-save">${I18n.t('common.save')}</button>
    </div>
  `;
  document.body.appendChild(el);
  el.open();

  el.addEventListener('modal-close', () => setTimeout(() => el.remove(), 200));
  function close() { el.close(); }

  el.querySelector('#contrib-cancel').addEventListener('click', close);
  el.querySelector('#contrib-save').addEventListener('click', () => {
    const val = parseFloat(el.querySelector('#contrib-amount').value);
    const date = el.querySelector('#contrib-date').value || formatDateISO();
    if (!Number.isFinite(val) || val <= 0) return;
    DB.addExpense({
      description: I18n.t('funds.contributionTo', { name: fund.name }),
      amount: round2(val),
      date,
      categoryKey: CONFIG.SAVINGS_CATEGORY_KEY,
      fundId: fund.id,
      source: 'manual'
    });
    close();
    showToast(I18n.t('toast.contributionAdded'), 'success');
    onSaved?.();
  });
}
