// modules/accounts.js — tipos de conta/cartão disponíveis e cálculo de saldo a partir dos lançamentos
import { round2 } from '../utils/format.js';

export const ACCOUNT_TYPE_DEFS = {
  checking: { icon: 'wallet', color: 'car' },
  savings: { icon: 'piggy', color: 'good' },
  cash: { icon: 'banknote', color: 'utilities' },
  investment: { icon: 'trendingUp', color: 'personal' },
  credit_card: { icon: 'creditCard', color: 'danger' }
};

export const ACCOUNT_TYPE_ORDER = ['checking', 'savings', 'cash', 'investment', 'credit_card'];

// Cartão de crédito é o único tipo passivo por enquanto — a Calculadora de Dívidas (rodada futura)
// vai trazer outros passivos (empréstimos etc.) que não são necessariamente "contas".
export const LIABILITY_TYPES = ['credit_card'];

export function isLiabilityAccount(account) {
  return LIABILITY_TYPES.includes(account.type);
}

// Mesmo problema de modules/income-types.js: 'good' e 'danger' não seguem o padrão --cat-${color}
// das categorias de despesa (não têm família --cat-good/--cat-danger), então mapeamos à mão.
export function accountTypeColors(colorKey) {
  if (colorKey === 'good') return { fg: 'var(--good)', bg: 'var(--good-bg)' };
  if (colorKey === 'danger') return { fg: 'var(--danger)', bg: 'var(--danger-bg)' };
  return { fg: `var(--cat-${colorKey})`, bg: `var(--cat-${colorKey}-bg)` };
}

// Saldo computado a partir do saldo inicial + lançamentos vinculados (expense.accountId/income.accountId).
// Sem FK/validação — mesmo padrão tolerante do resto do app (uma despesa apontando pra uma conta já
// apagada simplesmente não conta pra saldo de ninguém, não quebra nada).
export function computeAccountBalance(account, expenses, incomes) {
  const inc = incomes.filter(i => i.accountId === account.id).reduce((s, i) => s + i.amount, 0);
  const exp = expenses.filter(e => e.accountId === account.id).reduce((s, e) => s + e.amount, 0);
  const raw = isLiabilityAccount(account)
    ? account.startingBalance + exp - inc  // gasto no cartão aumenta o quanto se deve; um "income" vinculado reduz
    : account.startingBalance + inc - exp; // conta normal: entrada soma, saída subtrai
  return round2(raw);
}
