// views/income.js — histórico completo de entradas (renda): busca, filtro por tipo, editar/excluir
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatDateShort, round2 } from '../utils/format.js';
import { openIncomeModal } from './income-modal.js';
import { showToast } from '../components/toast.js';
import { INCOME_TYPE_DEFS, INCOME_TYPE_ORDER } from '../modules/income-types.js';
import { renderPaycheckView } from './paycheck-view.js';

// As cores dos tipos de entrada não seguem o padrão --cat-${color} das categorias de despesa —
// 'good' e 'muted' não têm variante -bg/-cor própria nesse namespace, então mapeamos à mão.
function incomeTypeColors(colorKey) {
  if (colorKey === 'good') return { fg: 'var(--good)', bg: 'var(--good-bg)' };
  if (colorKey === 'muted') return { fg: 'var(--ink-muted)', bg: 'var(--surface-2)' };
  return { fg: `var(--cat-${colorKey})`, bg: `var(--cat-${colorKey}-bg)` };
}

export function renderIncome(container) {
  const lang = I18n.getLang();
  const currency = DB.getSettings().currency;
  let search = '';
  let filterType = 'all';
  let activeTab = 'list';

  function typeLabel(type) {
    return I18n.t('income.type' + type.charAt(0).toUpperCase() + type.slice(1));
  }

  function paintShell() {
    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${I18n.t('income.title')}</h1>
        </div>
        <button class="btn btn--primary" id="btn-add-income">${icon('plus', 17, 2)}${I18n.t('income.addTitle')}</button>
      </div>
      <div class="subtabs">
        <button class="subtab ${activeTab === 'list' ? 'is-active' : ''}" data-tab="list">${I18n.t('income.tabList')}</button>
        <button class="subtab ${activeTab === 'paycheck' ? 'is-active' : ''}" data-tab="paycheck">${I18n.t('income.tabPaycheck')}</button>
      </div>
      <div id="income-tab-body"></div>
    `;

    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.tab; paintShell(); });
    });
    container.querySelector('#btn-add-income').addEventListener('click', () => {
      openIncomeModal(container, { onSaved: paintShell });
    });

    const body = container.querySelector('#income-tab-body');
    if (activeTab === 'list') {
      paintList(body);
    } else {
      renderPaycheckView(body);
    }
  }

  function paintList(container) {
    const all = DB.getIncomes();
    const filtered = all
      .filter(i => filterType === 'all' || i.type === filterType)
      .filter(i => !search || i.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    const total = round2(filtered.reduce((s, i) => s + i.amount, 0));

    container.innerHTML = `
      <p class="view-subtitle" style="margin:0 0 16px;">${I18n.t('income.total', { amount: formatCurrency(total, currency) })}</p>

      <div class="card u-flex u-gap-sm u-wrap u-mb-md" style="padding:14px 16px;">
        <div class="field" style="flex:1; min-width:200px;">
          <div class="u-flex u-items-center u-gap-xs" style="border:1.5px solid var(--border); border-radius:10px; padding:8px 12px;">
            <span class="u-text-faint">${icon('search', 16)}</span>
            <input type="text" id="in-search" placeholder="${I18n.t('income.search')}" value="${search}" style="border:none; outline:none; flex:1; background:transparent; font-size:14.5px;">
          </div>
        </div>
        <select id="in-filter" style="border:1.5px solid var(--border); border-radius:10px; padding:10px 12px; background:var(--surface);">
          <option value="all">${I18n.t('income.filterAll')}</option>
          ${INCOME_TYPE_ORDER.map(t => `<option value="${t}" ${filterType === t ? 'selected' : ''}>${typeLabel(t)}</option>`).join('')}
        </select>
      </div>

      <div class="card">
        ${filtered.length === 0
          ? `<div class="empty-state">${all.length === 0 ? I18n.t('income.emptyAll') : I18n.t('income.empty')}</div>`
          : filtered.map(i => {
              const def = INCOME_TYPE_DEFS[i.type] || INCOME_TYPE_DEFS.other;
              const colors = incomeTypeColors(def.color);
              return `
              <div class="tx-row">
                <span class="tx-row__icon" style="background:${colors.bg}; color:${colors.fg};">${icon(def.icon, 15)}</span>
                <div class="tx-row__body">
                  <div class="tx-row__title">${i.description}</div>
                  <div class="tx-row__meta">${typeLabel(i.type)} · ${formatDateShort(i.date, lang)}</div>
                </div>
                <span class="tx-row__amount" style="color:var(--good);">+${formatCurrency(i.amount, currency)}</span>
                <div class="tx-row__actions">
                  <button class="icon-btn" data-edit="${i.id}" aria-label="${I18n.t('common.edit')}">${icon('pencil', 15)}</button>
                  <button class="icon-btn icon-btn--danger" data-del="${i.id}" aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>
                </div>
              </div>
            `;
            }).join('')}
      </div>
    `;

    container.querySelector('#in-search').addEventListener('input', (e) => { search = e.target.value; paintList(container); });
    container.querySelector('#in-filter').addEventListener('change', (e) => { filterType = e.target.value; paintList(container); });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const income = DB.getIncome(btn.dataset.edit);
        if (income) openIncomeModal(container, { income, onSaved: () => paintList(container) });
      });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('income.deleteConfirm'))) return;
        DB.deleteIncome(btn.dataset.del);
        showToast(I18n.t('toast.incomeDeleted'), 'success');
        paintList(container);
      });
    });
  }

  paintShell();
}
