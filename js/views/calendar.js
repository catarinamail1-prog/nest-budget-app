// views/calendar.js — Calendário: visão mensal com um golpe de vista sobre renda/gastos/cofrinhos
// dia a dia, cada categoria com sua própria cor (mesmo esquema --cat-* do resto do app), mais o total
// da semana em cada linha. Clicar num dia abre a lista de lançamentos daquele dia, com atalho pra
// editar cada um ou adicionar um novo já com a data preenchida.
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatDateISO, formatDateLong, monthLabel, weekdayShortLabels, round2 } from '../utils/format.js';
import { categoryLabel } from '../utils/helpers.js';
import { shiftAnchor } from '../modules/analytics.js';
import { buildMonthGrid, summarizeDay, summarizeWeek } from '../modules/calendar.js';
import { openExpenseModal } from './expense-modal.js';
import { openIncomeModal } from './income-modal.js';
import { showToast } from '../components/toast.js';
import '../components/app-modal.js';

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Até 3 pastilhas por célula (renda, poupado, categorias de gasto por valor decrescente) — o
// resto vira um "+N" pra não estourar a altura do dia.
function buildDayPills(summary, currency) {
  const pills = [];
  if (summary.incomeTotal > 0) {
    pills.push({ label: formatCurrency(summary.incomeTotal, currency), fg: 'var(--good)', bg: 'var(--good-bg)' });
  }
  if (summary.savingsTotal > 0) {
    pills.push({ label: formatCurrency(summary.savingsTotal, currency), fg: 'var(--cat-car)', bg: 'var(--cat-car-bg)' });
  }
  summary.byCategory.forEach(c => {
    pills.push({
      label: formatCurrency(c.amount, currency),
      fg: c.color ? `var(--cat-${c.color})` : 'var(--ink-faint)',
      bg: c.color ? `var(--cat-${c.color}-bg)` : 'var(--surface-2)'
    });
  });
  const visible = pills.slice(0, 3);
  const extra = pills.length - visible.length;
  return { visible, extra };
}

export function renderCalendar(container) {
  const lang = I18n.getLang();
  let anchor = new Date();

  function paint() {
    const currency = DB.getSettings().currency;
    const categories = DB.getCategories();
    const expenses = DB.getExpenses();
    const incomes = DB.getIncomes();
    const todayISO = formatDateISO();

    const grid = buildMonthGrid(anchor);
    const weekdayLabels = weekdayShortLabels(lang);
    const monthLabelStr = capitalize(`${monthLabel(lang, anchor)} ${anchor.getFullYear()}`);

    let monthIncome = 0, monthExpense = 0;
    grid.weeks.flat().filter(d => d.inMonth).forEach(d => {
      const s = summarizeDay(d.date, expenses, incomes, categories);
      monthIncome += s.incomeTotal;
      monthExpense += s.expenseTotal + s.savingsTotal;
    });
    monthIncome = round2(monthIncome);
    monthExpense = round2(monthExpense);
    const monthNet = round2(monthIncome - monthExpense);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${I18n.t('calendar.title')}</h1>
          <p class="view-subtitle">${I18n.t('calendar.subtitle')}</p>
        </div>
      </div>

      <div class="period-nav">
        <button class="icon-btn" id="cal-prev" aria-label="${I18n.t('calendar.prevMonth')}">${icon('chevronLeft', 18)}</button>
        <span class="period-nav__label">${monthLabelStr}</span>
        <button class="icon-btn" id="cal-next" aria-label="${I18n.t('calendar.nextMonth')}">${icon('chevronRight', 18)}</button>
      </div>

      <div class="kpi-grid" style="grid-template-columns:repeat(3, 1fr);">
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--good-bg); color:var(--good);">${icon('wallet', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiIncome')}</span>
          <span class="kpi-card__value" style="color:var(--good);">${formatCurrency(monthIncome, currency)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--cat-personal-bg); color:var(--cat-personal);">${icon('cart', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiExpenses')}</span>
          <span class="kpi-card__value">${formatCurrency(monthExpense, currency)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__icon" style="background:var(--cat-utilities-bg); color:var(--cat-utilities);">${icon('income', 19)}</span>
          <span class="kpi-card__label">${I18n.t('analytics.kpiNet')}</span>
          <span class="kpi-card__value ${monthNet < 0 ? 'kpi-card__value--danger' : 'kpi-card__value--good'}">${formatCurrency(monthNet, currency)}</span>
        </div>
      </div>

      <div class="calendar-wrap">
        <div class="calendar-grid calendar-grid--head">
          ${weekdayLabels.map(w => `<div class="calendar-weekday">${w}</div>`).join('')}
          <div class="calendar-weekday calendar-weekday--week">${I18n.t('calendar.week')}</div>
        </div>
        ${grid.weeks.map(week => {
          const weekSummary = summarizeWeek(week, expenses, incomes, categories);
          return `
          <div class="calendar-grid calendar-grid--row">
            ${week.map(d => {
              const summary = summarizeDay(d.date, expenses, incomes, categories);
              const { visible, extra } = buildDayPills(summary, currency);
              const isToday = d.date === todayISO;
              return `
                <div class="calendar-day ${!d.inMonth ? 'calendar-day--muted' : ''} ${isToday ? 'calendar-day--today' : ''}" data-date="${d.date}">
                  <span class="calendar-day__num">${d.day}</span>
                  ${summary.hasActivity ? `
                    <div class="calendar-day__pills">
                      ${visible.map(p => `<span class="calendar-pill" style="background:${p.bg}; color:${p.fg};">${p.label}</span>`).join('')}
                      ${extra > 0 ? `<span class="calendar-pill calendar-pill--more">+${extra}</span>` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
            <div class="calendar-week-total">
              <span class="calendar-week-total__label">${I18n.t('calendar.week')}</span>
              <span class="calendar-week-total__value ${weekSummary.net < 0 ? 'kpi-card__value--danger' : 'kpi-card__value--good'}">${formatCurrency(weekSummary.net, currency)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    container.querySelector('#cal-prev').addEventListener('click', () => { anchor = shiftAnchor('month', anchor, -1); paint(); });
    container.querySelector('#cal-next').addEventListener('click', () => { anchor = shiftAnchor('month', anchor, 1); paint(); });
    container.querySelectorAll('.calendar-day').forEach(el => {
      el.addEventListener('click', () => openDayModal(el.dataset.date));
    });

    function openDayModal(dateISO) {
      const currency2 = DB.getSettings().currency;
      const categories2 = DB.getCategories();
      const summary = summarizeDay(dateISO, DB.getExpenses(), DB.getIncomes(), categories2);

      const el = document.createElement('app-modal');
      el.setAttribute('modal-title', capitalize(formatDateLong(dateISO, lang)));
      const rows = [
        ...summary.incomes.map(i => rowHtml({
          id: i.id, kind: 'income', title: i.description,
          meta: I18n.t('income.type' + capitalize(i.type)),
          amount: `+${formatCurrency(i.amount, currency2)}`,
          amountColor: 'var(--good)',
          iconName: 'income', iconColors: { fg: 'var(--good)', bg: 'var(--good-bg)' }
        })),
        ...summary.expenses.map(e => {
          const cat = categories2.find(c => c.key === e.categoryKey);
          return rowHtml({
            id: e.id, kind: 'expense', title: e.description,
            meta: cat ? categoryLabel(cat) : I18n.t('category.other'),
            amount: `−${formatCurrency(e.amount, currency2)}`,
            amountColor: 'var(--ink)',
            iconName: cat ? cat.icon : 'sparkle',
            iconColors: cat ? { fg: `var(--cat-${cat.color})`, bg: `var(--cat-${cat.color}-bg)` } : { fg: 'var(--ink-faint)', bg: 'var(--surface-2)' }
          });
        }),
        ...summary.savings.map(e => rowHtml({
          id: e.id, kind: 'expense', title: e.description,
          meta: I18n.t('nav.funds'),
          amount: `−${formatCurrency(e.amount, currency2)}`,
          amountColor: 'var(--cat-car)',
          iconName: 'piggy', iconColors: { fg: 'var(--cat-car)', bg: 'var(--cat-car-bg)' }
        }))
      ].join('');

      el.innerHTML = `
        <div class="u-flex u-gap-sm u-mb-sm" style="justify-content:space-between;">
          <div class="u-text-sm u-text-faint">${I18n.t('analytics.kpiIncome')}<br><strong style="color:var(--good); font-size:15px;">${formatCurrency(summary.incomeTotal, currency2)}</strong></div>
          <div class="u-text-sm u-text-faint">${I18n.t('analytics.kpiExpenses')}<br><strong style="font-size:15px;">${formatCurrency(round2(summary.expenseTotal + summary.savingsTotal), currency2)}</strong></div>
          <div class="u-text-sm u-text-faint">${I18n.t('analytics.kpiNet')}<br><strong style="font-size:15px; color:${summary.net < 0 ? 'var(--danger)' : 'var(--good)'};">${formatCurrency(summary.net, currency2)}</strong></div>
        </div>
        ${summary.hasActivity ? rows : `<div class="empty-state">${I18n.t('calendar.noActivity')}</div>`}
        <div class="app-modal__actions" style="justify-content:flex-start;">
          <button class="btn btn--ghost btn--sm" id="day-add-expense">${icon('plus', 15, 2)}${I18n.t('dashboard.addExpense')}</button>
          <button class="btn btn--ghost btn--sm" id="day-add-income">${icon('plus', 15, 2)}${I18n.t('income.addTitle')}</button>
        </div>
      `;
      document.body.appendChild(el);
      el.open();
      el.addEventListener('modal-close', () => setTimeout(() => el.remove(), 200));

      el.querySelectorAll('[data-edit-expense]').forEach(btn => {
        btn.addEventListener('click', () => {
          const expense = DB.getExpense(btn.dataset.editExpense);
          el.close();
          if (expense) openExpenseModal(container, { categories: categories2, currency: currency2, expense, onSaved: () => { paint(); openDayModal(dateISO); } });
        });
      });
      el.querySelectorAll('[data-del-expense]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!window.confirm(I18n.t('expense.deleteConfirm'))) return;
          DB.deleteExpense(btn.dataset.delExpense);
          showToast(I18n.t('toast.expenseDeleted'), 'success');
          el.close();
          paint();
          openDayModal(dateISO);
        });
      });
      el.querySelectorAll('[data-edit-income]').forEach(btn => {
        btn.addEventListener('click', () => {
          const income = DB.getIncome(btn.dataset.editIncome);
          el.close();
          if (income) openIncomeModal(container, { income, onSaved: () => { paint(); openDayModal(dateISO); } });
        });
      });
      el.querySelectorAll('[data-del-income]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!window.confirm(I18n.t('income.deleteConfirm'))) return;
          DB.deleteIncome(btn.dataset.delIncome);
          showToast(I18n.t('toast.incomeDeleted'), 'success');
          el.close();
          paint();
          openDayModal(dateISO);
        });
      });
      el.querySelector('#day-add-expense').addEventListener('click', () => {
        el.close();
        openExpenseModal(container, { categories: categories2, currency: currency2, presetDate: dateISO, onSaved: () => { paint(); openDayModal(dateISO); } });
      });
      el.querySelector('#day-add-income').addEventListener('click', () => {
        el.close();
        openIncomeModal(container, { presetDate: dateISO, onSaved: () => { paint(); openDayModal(dateISO); } });
      });
    }
  }

  function rowHtml({ id, kind, title, meta, amount, amountColor, iconName, iconColors }) {
    const editAttr = kind === 'income' ? `data-edit-income="${id}"` : `data-edit-expense="${id}"`;
    const delAttr = kind === 'income' ? `data-del-income="${id}"` : `data-del-expense="${id}"`;
    return `
      <div class="tx-row">
        <span class="tx-row__icon" style="background:${iconColors.bg}; color:${iconColors.fg};">${icon(iconName, 15)}</span>
        <div class="tx-row__body">
          <div class="tx-row__title">${title}</div>
          <div class="tx-row__meta">${meta}</div>
        </div>
        <span class="tx-row__amount" style="color:${amountColor};">${amount}</span>
        <div class="tx-row__actions">
          <button class="icon-btn" ${editAttr} aria-label="${I18n.t('common.edit')}">${icon('pencil', 15)}</button>
          <button class="icon-btn icon-btn--danger" ${delAttr} aria-label="${I18n.t('common.delete')}">${icon('trash', 15)}</button>
        </div>
      </div>
    `;
  }

  paint();
}
