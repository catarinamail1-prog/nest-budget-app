// views/debt-modal.js — modal reutilizável de adicionar/editar uma dívida (cartão, empréstimo, etc.)
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../components/toast.js';
import { round2 } from '../utils/format.js';
import { DEBT_TYPE_ORDER } from '../modules/debts.js';
import '../components/app-modal.js';

export function openDebtModal(hostContainer, { debt = null, onSaved, onDeleted }) {
  const isEdit = !!debt;
  const el = document.createElement('app-modal');
  el.setAttribute('modal-title', isEdit ? I18n.t('debts.editTitle') : I18n.t('debts.addTitle'));
  el.innerHTML = `
    <label class="field">
      <span class="field__label">${I18n.t('debts.name')}</span>
      <input type="text" id="debt-name" placeholder="${I18n.t('debts.namePlaceholder')}" value="${debt ? escapeAttr(debt.name) : ''}">
    </label>
    <label class="field">
      <span class="field__label">${I18n.t('debts.type')}</span>
      <select id="debt-type">
        ${DEBT_TYPE_ORDER.map(t => `<option value="${t}" ${debt && debt.type === t ? 'selected' : ''}>${I18n.t('debtType.' + t)}</option>`).join('')}
      </select>
    </label>
    <div class="field-row">
      <label class="field">
        <span class="field__label">${I18n.t('debts.balance')}</span>
        <input type="number" min="0" step="0.01" id="debt-balance" value="${debt ? debt.balance : ''}">
      </label>
      <label class="field">
        <span class="field__label">${I18n.t('debts.apr')}</span>
        <input type="number" min="0" step="0.01" id="debt-apr" value="${debt ? debt.apr : ''}" placeholder="0%">
      </label>
    </div>
    <label class="field">
      <span class="field__label">${I18n.t('debts.minPayment')}</span>
      <input type="number" min="0" step="0.01" id="debt-min" value="${debt ? debt.minPayment : ''}">
    </label>
    <p class="u-text-muted u-text-sm" style="margin:-6px 0 0;">${I18n.t('debts.formHint')}</p>
    <div class="app-modal__actions" style="justify-content:${isEdit ? 'space-between' : 'flex-end'};">
      ${isEdit ? `<button class="btn btn--danger" id="debt-delete">${icon('trash', 15)}${I18n.t('debts.delete')}</button>` : ''}
      <div class="u-flex u-gap-sm">
        <button class="btn btn--ghost" id="debt-cancel">${I18n.t('common.cancel')}</button>
        <button class="btn btn--primary" id="debt-save">${I18n.t('debts.save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.open();

  el.addEventListener('modal-close', () => setTimeout(() => el.remove(), 200));
  function close() { el.close(); }

  el.querySelector('#debt-cancel').addEventListener('click', close);

  el.querySelector('#debt-save').addEventListener('click', () => {
    const name = el.querySelector('#debt-name').value.trim();
    const type = el.querySelector('#debt-type').value;
    const balance = parseFloat(el.querySelector('#debt-balance').value);
    const aprVal = parseFloat(el.querySelector('#debt-apr').value);
    const minVal = parseFloat(el.querySelector('#debt-min').value);
    const apr = Number.isFinite(aprVal) && aprVal >= 0 ? aprVal : 0;
    const minPayment = Number.isFinite(minVal) && minVal >= 0 ? minVal : 0;
    if (!name || !type || !Number.isFinite(balance) || balance < 0) return;

    if (isEdit) {
      DB.updateDebt(debt.id, { name, type, balance: round2(balance), apr: round2(apr), minPayment: round2(minPayment) });
      showToast(I18n.t('toast.debtUpdated'), 'success');
    } else {
      DB.addDebt({ name, type, balance: round2(balance), apr: round2(apr), minPayment: round2(minPayment) });
      showToast(I18n.t('toast.debtAdded'), 'success');
    }
    close();
    onSaved?.();
  });

  if (isEdit) {
    el.querySelector('#debt-delete').addEventListener('click', () => {
      if (!window.confirm(I18n.t('debts.deleteConfirm'))) return;
      DB.deleteDebt(debt.id);
      showToast(I18n.t('toast.debtDeleted'), 'success');
      close();
      onDeleted?.();
      onSaved?.();
    });
  }
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}
