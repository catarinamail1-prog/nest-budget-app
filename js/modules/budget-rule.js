// modules/budget-rule.js — regra 50/30/20 (necessidades / desejos / poupança), sem estado, sem DOM.
// "Poupança" nunca vem da classificação de uma categoria: é sempre a contribuição de cofrinho do
// mês (categoryKey === CONFIG.SAVINGS_CATEGORY_KEY), o mesmo corte que Dashboard/Análises já usam.
// Necessidade/desejo vêm de categoryGroup() — padrão do catálogo, reclassificável em Configurações.
import { round2, isSameMonth } from '../utils/format.js';
import { CONFIG } from '../config.js';
import { categoryGroup } from './categories.js';

export const RULE_TARGET_PCT = { needs: 50, wants: 30, savings: 20 };

export function compute503020({ categories, expenses, incomes, referenceDate = new Date() }) {
  const monthExpenses = expenses.filter(e => isSameMonth(e.date, referenceDate));
  const monthIncomes = incomes.filter(i => isSameMonth(i.date, referenceDate));
  const income = round2(monthIncomes.reduce((s, i) => s + i.amount, 0));

  let needs = 0, wants = 0, savings = 0;
  monthExpenses.forEach(e => {
    if (e.categoryKey === CONFIG.SAVINGS_CATEGORY_KEY) { savings += e.amount; return; }
    const cat = categories.find(c => c.key === e.categoryKey);
    if (categoryGroup(cat) === 'needs') needs += e.amount;
    else wants += e.amount;
  });
  needs = round2(needs);
  wants = round2(wants);
  savings = round2(savings);
  const spent = round2(needs + wants + savings);

  const pctOfIncome = (value) => (income > 0 ? round2((value / income) * 100) : 0);

  return {
    income,
    spent,
    needs, wants, savings,
    pct: { needs: pctOfIncome(needs), wants: pctOfIncome(wants), savings: pctOfIncome(savings) },
    target: RULE_TARGET_PCT,
    hasIncome: income > 0
  };
}
