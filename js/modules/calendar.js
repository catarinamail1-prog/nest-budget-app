// modules/calendar.js — matemática pura do grid mensal do Calendário (sem estado, sem DOM):
// monta as semanas (com os "dias vazando" do mês anterior/seguinte pra completar a grade) e resume
// renda/gastos/cofrinhos de um dia ou de uma semana. Nada aqui lê localStorage — mesmo padrão de
// modules/analytics.js e modules/paycheck.js, pra ficar fácil de testar isoladamente.
import { round2 } from '../utils/format.js';
import { CONFIG } from '../config.js';

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

// Grade completa (sempre múltiplo de 7 dias) do mês que contém `anchor`, com os dias do mês
// anterior/seguinte necessários pra fechar a primeira e a última semana (domingo a sábado).
export function buildMonthGrid(anchor = new Date()) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - startWeekday);

  const days = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    days.push({ date: ymd(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return {
    weeks,
    monthStart: ymd(firstOfMonth),
    monthEnd: ymd(new Date(year, month + 1, 0))
  };
}

// Resumo de um dia: total de renda, total de gastos (sem contribuições de cofrinho, mesmo corte
// que Dashboard/Análises usam), total poupado nesse dia, e o detalhamento por categoria (pra
// desenhar as pastilhas coloridas na célula e a lista da mesma cor no modal do dia).
export function summarizeDay(dateISO, expenses, incomes, categories = []) {
  const dayExpenses = expenses.filter(e => e.date === dateISO && e.categoryKey !== CONFIG.SAVINGS_CATEGORY_KEY);
  const daySavings = expenses.filter(e => e.date === dateISO && e.categoryKey === CONFIG.SAVINGS_CATEGORY_KEY);
  const dayIncomes = incomes.filter(i => i.date === dateISO);

  const expenseTotal = round2(dayExpenses.reduce((s, e) => s + e.amount, 0));
  const savingsTotal = round2(daySavings.reduce((s, e) => s + e.amount, 0));
  const incomeTotal = round2(dayIncomes.reduce((s, i) => s + i.amount, 0));

  const byKey = {};
  dayExpenses.forEach(e => { byKey[e.categoryKey] = round2((byKey[e.categoryKey] || 0) + e.amount); });
  const byCategory = Object.keys(byKey).map(key => {
    const cat = categories.find(c => c.key === key);
    return { key, color: cat ? cat.color : null, icon: cat ? cat.icon : 'sparkle', amount: byKey[key] };
  }).sort((a, b) => b.amount - a.amount);

  return {
    incomeTotal,
    expenseTotal,
    savingsTotal,
    net: round2(incomeTotal - expenseTotal - savingsTotal),
    byCategory,
    expenses: dayExpenses,
    incomes: dayIncomes,
    savings: daySavings,
    hasActivity: dayExpenses.length > 0 || daySavings.length > 0 || dayIncomes.length > 0
  };
}

// Resumo de uma semana (linha da grade): soma os dias visíveis naquela linha, incluindo os que
// "vazam" do mês vizinho — a coluna de total reflete exatamente o que está desenhado na linha.
export function summarizeWeek(weekDays, expenses, incomes, categories = []) {
  let incomeTotal = 0, expenseTotal = 0, savingsTotal = 0;
  weekDays.forEach(d => {
    const s = summarizeDay(d.date, expenses, incomes, categories);
    incomeTotal += s.incomeTotal;
    expenseTotal += s.expenseTotal;
    savingsTotal += s.savingsTotal;
  });
  incomeTotal = round2(incomeTotal);
  expenseTotal = round2(expenseTotal);
  savingsTotal = round2(savingsTotal);
  return { incomeTotal, expenseTotal, savingsTotal, net: round2(incomeTotal - expenseTotal - savingsTotal) };
}
