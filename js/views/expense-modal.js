// views/expense-modal.js — modal reutilizável de adicionar/editar despesa (Dashboard e Expenses)
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../components/toast.js';
import { formatDateISO, round2 } from '../utils/format.js';
import { categoryLabel } from '../utils/helpers.js';
import '../components/app-modal.js';

// categories: lista de categorias selecionáveis (sem "savings" — isso é tratado na tela de Poupança)
export function openExpenseModal(hostContainer, { categories, currency, expense = null, presetDate = null, onSaved, onDeleted }) {
  const isEdit = !!expense;
  const accounts = DB.getAccounts();
  const el = document.createElement('app-modal');
  el.setAttribute('modal-title', isEdit ? I18n.t('expense.editTitle') : I18n.t('expense.addTitle'));
  el.innerHTML = `
    <label class="field">
      <span class="field__label">${I18n.t('expense.description')}</span>
      <input type="text" id="ex-desc" placeholder="${I18n.t('expense.descriptionPlaceholder')}" value="${expense ? escapeAttr(expense.description) : ''}">
    </label>
    <div class="field-row">
      <label class="field">
        <span class="field__label">${I18n.t('expense.amount')}</span>
        <input type="number" min="0" step="0.01" id="ex-amount" value="${expense ? expense.amount : ''}">
      </label>
      <label class="field">
        <span class="field__label">${I18n.t('expense.date')}</span>
        <input type="date" id="ex-date" value="${expense ? expense.date : (presetDate || formatDateISO())}">
      </label>
    </div>
    <label class="field">
      <span class="field__label">${I18n.t('expense.category')}</span>
      <select id="ex-category">
        ${categories.map(c => `<option value="${c.key}" ${expense && expense.categoryKey === c.key ? 'selected' : ''}>${categoryLabel(c)}</option>`).join('')}
      </select>
    </label>
    ${accounts.length > 0 ? `
    <label class="field">
      <span class="field__label">${I18n.t('expense.account')}</span>
      <select id="ex-account">
        <option value="">${I18n.t('common.none')}</option>
        ${accounts.map(a => `<option value="${a.id}" ${expense && expense.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
      </select>
    </label>` : ''}
    <div class="app-modal__actions" style="justify-content:${isEdit ? 'space-between' : 'flex-end'};">
      ${isEdit ? `<button class="btn btn--danger" id="ex-delete">${icon('trash', 15)}${I18n.t('expense.delete')}</button>` : ''}
      <div class="u-flex u-gap-sm">
        <button class="btn btn--ghost" id="ex-cancel">${I18n.t('common.cancel')}</button>
        <button class="btn btn--primary" id="ex-save">${I18n.t('expense.save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.open();

  // AppModal.close() toggles the class and fires 'modal-close' once — that single event
  // is what removes the element, whether the close was triggered by us, the × button, or
  // a backdrop click. Buttons below only ever call el.close(), never remove() directly,
  // so there is exactly one removal per close, however it was triggered.
  el.addEventListener('modal-close', () => setTimeout(() => el.remove(), 200));
  function close() { el.close(); }

  el.querySelector('#ex-cancel').addEventListener('click', close);

  el.querySelector('#ex-save').addEventListener('click', () => {
    const description = el.querySelector('#ex-desc').value.trim();
    const amount = parseFloat(el.querySelector('#ex-amount').value);
    const date = el.querySelector('#ex-date').value || formatDateISO();
    const categoryKey = el.querySelector('#ex-category').value;
    const accountEl = el.querySelector('#ex-account');
    const accountId = accountEl ? (accountEl.value || null) : null;
    if (!description || !Number.isFinite(amount) || amount <= 0 || !categoryKey) return;

    if (isEdit) {
      DB.updateExpense(expense.id, { description, amount: round2(amount), date, categoryKey, accountId });
    } else {
      DB.addExpense({ description, amount: round2(amount), date, categoryKey, accountId, source: 'manual' });
    }
    showToast(I18n.t('toast.expenseSaved'), 'success');
    close();
    onSaved?.();
  });

  if (isEdit) {
    el.querySelector('#ex-delete').addEventListener('click', () => {
      if (!window.confirm(I18n.t('expense.deleteConfirm'))) return;
      DB.deleteExpense(expense.id);
      showToast(I18n.t('toast.expenseDeleted'), 'success');
      close();
      onDeleted?.();
      onSaved?.();
    });
  }
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}
