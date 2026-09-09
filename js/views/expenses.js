// views/expenses.js — histórico completo de despesas: busca, filtro por categoria, editar/excluir
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatDateShort, round2 } from '../utils/format.js';
import { categoryLabel } from '../utils/helpers.js';
import { openExpenseModal } from './expense-modal.js';
import { showToast } from '../components/toast.js';

export function renderExpenses(container) {
  const lang = I18n.getLang();
  const currency = DB.getSettings().currency;
  const categories = DB.getCategories();
  let search = '';
  let filterKey = 'all';

  function catLabel(key) {
    const known = categories.find(c => c.key === key);
    return known ? categoryLabel(known) : I18n.t('category.other');
  }

  function paint() {
    const all = DB.getExpenses().filter(e => e.categoryKey !== CONFIG.SAVINGS_CATEGORY_KEY);
    const filtered = all
      .filter(e => filterKey === 'all' || e.categoryKey === filterKey)
      .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    const total = round2(filtered.reduce((s, e) => s + e.amount, 0));

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${I18n.t('expenses.title')}</h1>
          <p class="view-subtitle">${I18n.t('expenses.total', { amount: formatCurrency(total, currency) })}</p>
          <p class="u-text-faint u-text-sm u-mt-xs">${I18n.t('expenses.monthlyNote')}</p>
        </div>
        <button class="btn btn--primary" id="btn-add-expense">${icon('plus', 17, 2)}${I18n.t('dashboard.addExpense')}</button>
      </div>

      <div class="card u-flex u-gap-sm u-wrap u-mb-md" style="padding:14px 16px;">
        <div class="field" style="flex:1; min-width:200px;">
          <div class="u-flex u-items-center u-gap-xs" style="border:1.5px solid var(--border); border-radius:10px; padding:8px 12px;">
            <span class="u-text-faint">${icon('search', 16)}</span>
            <input type="text" id="ex-search" placeholder="${I18n.t('expenses.search')}" value="${search}" style="border:none; outline:none; flex:1; background:transparent; font-size:14.5px;">
          </div>
        </div>
        <select id="ex-filter" style="border:1.5px solid var(--border); border-radius:10px; padding:10px 12px; background:var(--surface);">
          <option value="all">${I18n.t('expenses.filterAll')}</option>
          ${categories.map(c => `<option value="${c.key}" ${filterKey === c.key ? 'selected' : ''}>${categoryLabel(c)}</option>`).join('')}
        </select>
      </div>

      <div class="card">
        ${filtered.length === 0
          ? `<div class="empty-state">${all.length === 0 ? I18n.t('expenses.emptyAll') : I18n.t('expenses.empty')}</div>`
          : filtered.map(e => `
              <div class="tx-row">
                <span class="tx-row__icon">${icon(e.source === 'scan' ? 'camera' : 'pencil', 15)}</span>
                <div class="tx-row__body">
                  <div class="tx-row__title">${e.description}</div>
                  <div class="tx-row__meta">${catLabel(e.categoryKey)} · ${formatDateShort(e.date, lang)}</div>
                </div>
                <span class="tx-row__amount">${formatCurrency(e.amount, currency)}</span>
                <div class="tx-row__actions">
                  <button class="icon-btn" data-edit="${e.id}" aria-label="${I18n.t('common.edit')}">${icon('pencil', 15)}</button>
                  <button class="icon-btn icon-btn--danger" data-del="${e.id}" aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>
                </div>
              </div>
            `).join('')}
      </div>
    `;

    container.querySelector('#ex-search').addEventListener('input', (e) => { search = e.target.value; paint(); });
    container.querySelector('#ex-filter').addEventListener('change', (e) => { filterKey = e.target.value; paint(); });
    container.querySelector('#btn-add-expense').addEventListener('click', () => {
      openExpenseModal(container, { categories, currency, onSaved: paint });
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const expense = DB.getExpense(btn.dataset.edit);
        if (expense) openExpenseModal(container, { categories, currency, expense, onSaved: paint });
      });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm(I18n.t('expense.deleteConfirm'))) return;
        DB.deleteExpense(btn.dataset.del);
        showToast(I18n.t('toast.expenseDeleted'), 'success');
        paint();
      });
    });
  }

  paint();
}
