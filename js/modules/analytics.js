// modules/analytics.js — motor das Análises por período: matemática de intervalos de datas
// (mês/trimestre/semestre/ano) e o cálculo do relatório em si (renda, gastos, cofrinhos, patrimônio),
// sempre comparando com o período equivalente anterior. Nada aqui lê/escreve localStorage — tudo
// recebe as coleções já carregadas (mesmo padrão de modules/paycheck.js), pra ficar fácil de testar.
import { round2, formatDateISO } from '../utils/format.js';
import { CONFIG } from '../config.js';
import { computeAccountBalance, isLiabilityAccount } from './accounts.js';

export const PERIOD_TYPES = ['month', 'quarter', 'semester', 'year'];

// Quantos meses cada granularidade cobre — usado pra "esticar" o orçamento mensal de cada
// categoria (o app só guarda um valor de orçamento por mês) pro tamanho do período selecionado.
export function monthsInPeriod(type) {
  if (type === 'quarter') return 3;
  if (type === 'semester') return 6;
  if (type === 'year') return 12;
  return 1; // month
}

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

// Intervalo [start, end] (strings ISO 'YYYY-MM-DD', comparáveis lexicograficamente) do período
// da granularidade `type` que contém `anchor`. anchorMonth/n ficam junto pra montar o rótulo depois.
export function getPeriodRange(type, anchor = new Date()) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth(); // 0-indexed
  const span = monthsInPeriod(type);
  const startMonth = Math.floor(m / span) * span;
  const endMonth = startMonth + span - 1;
  const endYearOverflow = Math.floor(endMonth / 12);
  const endMonthNorm = endMonth % 12;
  const endYear = y + endYearOverflow;
  return {
    type,
    start: ymd(y, startMonth, 1),
    end: ymd(endYear, endMonthNorm, daysInMonth(endYear, endMonthNorm)),
    year: y,
    startMonth,
    n: Math.floor(startMonth / span) + 1, // número do trimestre/semestre dentro do ano (1-based)
    months: span
  };
}

// Anchor (Date) do período anterior/seguinte na mesma granularidade — usa dia 1 pra nunca
// estourar o fim do mês, já que só year/month do anchor importam pra getPeriodRange.
export function shiftAnchor(type, anchor, direction) {
  const span = monthsInPeriod(type);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction * span, 1);
}

// "Próximo" só fica habilitado se ainda existe um período (passado ou o atual) pra frente —
// nunca deixa navegar pra um período totalmente no futuro.
export function canGoNext(range, today = new Date()) {
  return range.end < formatDateISO(today);
}

function sum(list) {
  return round2(list.reduce((s, item) => s + item.amount, 0));
}

// Patrimônio líquido na data `dateISO`: contas somam/subtraem só os lançamentos até aquela data
// (histórico real, porque expense/income têm data); dívidas da Calculadora não têm histórico de
// saldo — o app só guarda o valor atual cadastrado — então entram com o mesmo saldo em qualquer
// período. É uma simplificação honesta dada a modelagem de dados atual (ver networth.js, que já
// trata dívidas do mesmo jeito hoje, sem histórico).
function netWorthAsOf(dateISO, accounts, debts, allExpenses, allIncomes) {
  const expUpTo = allExpenses.filter(e => e.date <= dateISO);
  const incUpTo = allIncomes.filter(i => i.date <= dateISO);
  const withBalance = accounts.map(a => ({ ...a, balance: computeAccountBalance(a, expUpTo, incUpTo) }));
  const assets = round2(withBalance.filter(a => !isLiabilityAccount(a)).reduce((s, a) => s + a.balance, 0));
  const liabilities = round2(
    withBalance.filter(a => isLiabilityAccount(a)).reduce((s, a) => s + a.balance, 0) +
    debts.reduce((s, d) => s + d.balance, 0)
  );
  return round2(assets - liabilities);
}

// Relatório completo de um período: renda, gastos (total + por categoria vs. orçado no período),
// saldo (renda - gastos), cofrinhos (contribuições no período, por cofrinho) e patrimônio líquido
// no fim do período — cada métrica já vem com o valor do período equivalente anterior ao lado,
// pra tela só precisar montar o badge de variação.
export function computeAnalyticsReport({ type, anchor, categories, expenses, incomes, funds, accounts, debts }) {
  const range = getPeriodRange(type, anchor);
  const prevAnchor = shiftAnchor(type, anchor, -1);
  const prevRange = getPeriodRange(type, prevAnchor);

  const inRange = (dateStr, r) => dateStr >= r.start && dateStr <= r.end;
  const isSavings = (e) => e.categoryKey === CONFIG.SAVINGS_CATEGORY_KEY;

  const periodExpenses = expenses.filter(e => !isSavings(e) && inRange(e.date, range));
  const prevPeriodExpenses = expenses.filter(e => !isSavings(e) && inRange(e.date, prevRange));
  const periodIncomes = incomes.filter(i => inRange(i.date, range));
  const prevPeriodIncomes = incomes.filter(i => inRange(i.date, prevRange));
  const periodSavings = expenses.filter(e => isSavings(e) && inRange(e.date, range));
  const prevPeriodSavings = expenses.filter(e => isSavings(e) && inRange(e.date, prevRange));

  const spentTotal = sum(periodExpenses);
  const prevSpentTotal = sum(prevPeriodExpenses);
  const incomeTotal = sum(periodIncomes);
  const prevIncomeTotal = sum(prevPeriodIncomes);
  const savedTotal = sum(periodSavings);
  const prevSavedTotal = sum(prevPeriodSavings);

  const budgetTotal = round2(categories.reduce((s, c) => s + c.budget, 0) * range.months);

  const catSpend = {};
  periodExpenses.forEach(e => { catSpend[e.categoryKey] = round2((catSpend[e.categoryKey] || 0) + e.amount); });
  const byCategory = categories.map(c => ({ ...c, spent: catSpend[c.key] || 0, periodBudget: round2(c.budget * range.months) }));
  const knownKeys = new Set(categories.map(c => c.key));
  const orphanSpent = round2(periodExpenses.filter(e => !knownKeys.has(e.categoryKey)).reduce((s, e) => s + e.amount, 0));
  if (orphanSpent > 0) byCategory.push({ key: 'other', icon: 'sparkle', color: null, budget: 0, periodBudget: 0, spent: orphanSpent });

  const fundContrib = {};
  periodSavings.forEach(e => { if (e.fundId) fundContrib[e.fundId] = round2((fundContrib[e.fundId] || 0) + e.amount); });
  const byFund = funds.map(f => ({ ...f, contributed: fundContrib[f.id] || 0 }));

  const netWorthEnd = netWorthAsOf(range.end, accounts, debts, expenses, incomes);
  const netWorthPrevEnd = netWorthAsOf(prevRange.end, accounts, debts, expenses, incomes);

  const hasAnyData = periodExpenses.length > 0 || periodIncomes.length > 0 || periodSavings.length > 0;

  return {
    range, prevRange,
    income: { total: incomeTotal, prevTotal: prevIncomeTotal },
    expenses: { total: spentTotal, prevTotal: prevSpentTotal, budgetTotal, byCategory },
    net: { total: round2(incomeTotal - spentTotal), prevTotal: round2(prevIncomeTotal - prevSpentTotal) },
    savings: { total: savedTotal, prevTotal: prevSavedTotal, byFund },
    netWorth: { end: netWorthEnd, prevEnd: netWorthPrevEnd },
    hasAccountsOrDebts: accounts.length > 0 || debts.length > 0,
    hasAnyData
  };
}
