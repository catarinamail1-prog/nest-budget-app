// views/income-modal.js — modal reutilizável de adicionar/editar entrada (renda)
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../components/toast.js';
import { formatDateISO, round2 } from '../utils/format.js';
import { INCOME_TYPE_ORDER } from '../modules/income-types.js';
import '../components/app-modal.js';

export function openIncomeModal(hostContainer, { income = null, presetDate = null, onSaved, onDeleted }) {
  const isEdit = !!income;
  const accounts = DB.getAccounts();
  const el = document.createElement('app-modal');
  el.setAttribute('modal-title', isEdit ? I18n.t('income.editTitle') : I18n.t('income.addTitle'));
  el.innerHTML = `
    <label class="field">
      <span class="field__label">${I18n.t('income.description')}</span>
      <input type="text" id="in-desc" placeholder="${I18n.t('income.descriptionPlaceholder')}" value="${income ? escapeAttr(income.description) : ''}">
    </label>
    <div class="field-row">
      <label class="field">
        <span class="field__label">${I18n.t('income.amount')}</span>
        <input type="number" min="0" step="0.01" id="in-amount" value="${income ? income.amount : ''}">
      </label>
      <label class="field">
        <span class="field__label">${I18n.t('income.date')}</span>
        <input type="date" id="in-date" value="${income ? income.date : (presetDate || formatDateISO())}">
      </label>
    </div>
    <label class="field">
      <span class="field__label">${I18n.t('income.type')}</span>
      <select id="in-type">
        ${INCOME_TYPE_ORDER.map(t => `<option value="${t}" ${income && income.type === t ? 'selected' : ''}>${I18n.t('income.type' + capitalize(t))}</option>`).join('')}
      </select>
    </label>
    ${accounts.length > 0 ? `
    <label class="field">
      <span class="field__label">${I18n.t('income.account')}</span>
      <select id="in-account">
        <option value="">${I18n.t('common.none')}</option>
        ${accounts.map(a => `<option value="${a.id}" ${income && income.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
      </select>
    </label>` : ''}
    <div class="app-modal__actions" style="justify-content:${isEdit ? 'space-between' : 'flex-end'};">
      ${isEdit ? `<button class="btn btn--danger" id="in-delete">${icon('trash', 15)}${I18n.t('income.delete')}</button>` : ''}
      <div class="u-flex u-gap-sm">
        <button class="btn btn--ghost" id="in-cancel">${I18n.t('common.cancel')}</button>
        <button class="btn btn--primary" id="in-save">${I18n.t('income.save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.open();

  el.addEventListener('modal-close', () => setTimeout(() => el.remove(), 200));
  function close() { el.close(); }

  el.querySelector('#in-cancel').addEventListener('click', close);

  el.querySelector('#in-save').addEventListener('click', () => {
    const description = el.querySelector('#in-desc').value.trim();
    const amount = parseFloat(el.querySelector('#in-amount').value);
    const date = el.querySelector('#in-date').value || formatDateISO();
    const type = el.querySelector('#in-type').value;
    const accountEl = el.querySelector('#in-account');
    const accountId = accountEl ? (accountEl.value || null) : null;
    if (!description || !Number.isFinite(amount) || amount <= 0) return;

    if (isEdit) {
      DB.updateIncome(income.id, { description, amount: round2(amount), date, type, accountId });
    } else {
      DB.addIncome({ description, amount: round2(amount), date, type, accountId, source: 'manual' });
    }
    showToast(I18n.t('toast.incomeSaved'), 'success');
    close();
    onSaved?.();
  });

  if (isEdit) {
    el.querySelector('#in-delete').addEventListener('click', () => {
      if (!window.confirm(I18n.t('income.deleteConfirm'))) return;
      DB.deleteIncome(income.id);
      showToast(I18n.t('toast.incomeDeleted'), 'success');
      close();
      onDeleted?.();
      onSaved?.();
    });
  }
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
