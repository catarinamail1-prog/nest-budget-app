// views/fund-modal.js — modal reutilizável de adicionar/editar um cofrinho (sinking fund)
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../components/toast.js';
import { round2 } from '../utils/format.js';
import { FUND_TYPE_ORDER } from '../modules/funds.js';
import '../components/app-modal.js';

export function openFundModal(hostContainer, { fund = null, onSaved, onDeleted }) {
  const isEdit = !!fund;
  const el = document.createElement('app-modal');
  el.setAttribute('modal-title', isEdit ? I18n.t('funds.editTitle') : I18n.t('funds.addTitle'));
  el.innerHTML = `
    <label class="field">
      <span class="field__label">${I18n.t('funds.name')}</span>
      <input type="text" id="fund-name" placeholder="${I18n.t('funds.namePlaceholder')}" value="${fund ? escapeAttr(fund.name) : ''}">
    </label>
    <label class="field">
      <span class="field__label">${I18n.t('funds.type')}</span>
      <select id="fund-type">
        ${FUND_TYPE_ORDER.map(t => `<option value="${t}" ${fund && fund.type === t ? 'selected' : ''}>${I18n.t('fundType.' + t)}</option>`).join('')}
      </select>
    </label>
    <div class="field-row">
      <label class="field">
        <span class="field__label">${I18n.t('funds.target')}</span>
        <input type="number" min="0" step="0.01" id="fund-target" value="${fund ? fund.target : ''}">
      </label>
      <label class="field">
        <span class="field__label">${I18n.t('funds.targetDate')}</span>
        <input type="date" id="fund-date" value="${fund && fund.targetDate ? fund.targetDate : ''}">
      </label>
    </div>
    <p class="u-text-muted u-text-sm" style="margin:-6px 0 0;">${I18n.t('funds.targetDateHint')}</p>
    <div class="app-modal__actions" style="justify-content:${isEdit ? 'space-between' : 'flex-end'};">
      ${isEdit ? `<button class="btn btn--danger" id="fund-delete">${icon('trash', 15)}${I18n.t('funds.delete')}</button>` : ''}
      <div class="u-flex u-gap-sm">
        <button class="btn btn--ghost" id="fund-cancel">${I18n.t('common.cancel')}</button>
        <button class="btn btn--primary" id="fund-save">${I18n.t('funds.save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.open();

  el.addEventListener('modal-close', () => setTimeout(() => el.remove(), 200));
  function close() { el.close(); }

  el.querySelector('#fund-cancel').addEventListener('click', close);

  el.querySelector('#fund-save').addEventListener('click', () => {
    const name = el.querySelector('#fund-name').value.trim();
    const type = el.querySelector('#fund-type').value;
    const target = parseFloat(el.querySelector('#fund-target').value);
    const targetDate = el.querySelector('#fund-date').value || null;
    if (!name || !type || !Number.isFinite(target) || target < 0) return;

    if (isEdit) {
      DB.updateFund(fund.id, { name, type, target: round2(target), targetDate });
      showToast(I18n.t('toast.fundUpdated'), 'success');
    } else {
      DB.addFund({ name, type, target: round2(target), targetDate });
      showToast(I18n.t('toast.fundAdded'), 'success');
    }
    close();
    onSaved?.();
  });

  if (isEdit) {
    el.querySelector('#fund-delete').addEventListener('click', () => {
      if (!window.confirm(I18n.t('funds.deleteConfirm'))) return;
      DB.deleteFund(fund.id);
      showToast(I18n.t('toast.fundDeleted'), 'success');
      close();
      onDeleted?.();
      onSaved?.();
    });
  }
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}
