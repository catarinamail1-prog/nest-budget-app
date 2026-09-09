// views/account-modal.js — modal reutilizável de adicionar/editar conta bancária ou cartão de crédito
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../components/toast.js';
import { round2 } from '../utils/format.js';
import { ACCOUNT_TYPE_ORDER, isLiabilityAccount } from '../modules/accounts.js';
import '../components/app-modal.js';

export function openAccountModal(hostContainer, { account = null, onSaved, onDeleted }) {
  const isEdit = !!account;
  const el = document.createElement('app-modal');
  el.setAttribute('modal-title', isEdit ? I18n.t('accounts.editTitle') : I18n.t('accounts.addTitle'));
  el.innerHTML = `
    <label class="field">
      <span class="field__label">${I18n.t('accounts.name')}</span>
      <input type="text" id="acc-name" placeholder="${I18n.t('accounts.namePlaceholder')}" value="${account ? escapeAttr(account.name) : ''}">
    </label>
    <label class="field">
      <span class="field__label">${I18n.t('accounts.type')}</span>
      <select id="acc-type">
        ${ACCOUNT_TYPE_ORDER.map(t => `<option value="${t}" ${account && account.type === t ? 'selected' : ''}>${I18n.t('accountType.' + t)}</option>`).join('')}
      </select>
    </label>
    <label class="field">
      <span class="field__label">${I18n.t('accounts.startingBalance')}</span>
      <input type="number" min="0" step="0.01" id="acc-balance" value="${account ? account.startingBalance : ''}">
    </label>
    <p class="u-text-muted u-text-sm" id="acc-balance-hint" style="margin:-6px 0 0;"></p>
    <div class="app-modal__actions" style="justify-content:${isEdit ? 'space-between' : 'flex-end'};">
      ${isEdit ? `<button class="btn btn--danger" id="acc-delete">${icon('trash', 15)}${I18n.t('accounts.delete')}</button>` : ''}
      <div class="u-flex u-gap-sm">
        <button class="btn btn--ghost" id="acc-cancel">${I18n.t('common.cancel')}</button>
        <button class="btn btn--primary" id="acc-save">${I18n.t('accounts.save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.open();

  el.addEventListener('modal-close', () => setTimeout(() => el.remove(), 200));
  function close() { el.close(); }

  const typeSelect = el.querySelector('#acc-type');
  const hint = el.querySelector('#acc-balance-hint');
  function paintHint() {
    hint.textContent = isLiabilityAccount({ type: typeSelect.value })
      ? I18n.t('accounts.startingBalanceHintCard')
      : I18n.t('accounts.startingBalanceHintAsset');
  }
  paintHint();
  typeSelect.addEventListener('change', paintHint);

  el.querySelector('#acc-cancel').addEventListener('click', close);

  el.querySelector('#acc-save').addEventListener('click', () => {
    const name = el.querySelector('#acc-name').value.trim();
    const type = typeSelect.value;
    const startingBalance = parseFloat(el.querySelector('#acc-balance').value);
    if (!name || !type || !Number.isFinite(startingBalance) || startingBalance < 0) return;

    if (isEdit) {
      DB.updateAccount(account.id, { name, type, startingBalance: round2(startingBalance) });
      showToast(I18n.t('toast.accountUpdated'), 'success');
    } else {
      DB.addAccount({ name, type, startingBalance: round2(startingBalance) });
      showToast(I18n.t('toast.accountAdded'), 'success');
    }
    close();
    onSaved?.();
  });

  if (isEdit) {
    el.querySelector('#acc-delete').addEventListener('click', () => {
      if (!window.confirm(I18n.t('accounts.deleteConfirm'))) return;
      DB.deleteAccount(account.id);
      showToast(I18n.t('toast.accountDeleted'), 'success');
      close();
      onDeleted?.();
      onSaved?.();
    });
  }
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}
