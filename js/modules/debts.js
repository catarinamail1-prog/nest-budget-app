// modules/debts.js — catálogo de tipos de dívida + motor de simulação da calculadora (snowball/avalanche/custom)
import { round2 } from '../utils/format.js';

export const DEBT_TYPE_DEFS = {
  credit_card: { icon: 'creditCard', color: 'danger' },
  student_loan: { icon: 'graduationCap', color: 'kids' },
  auto_loan: { icon: 'car', color: 'car' },
  personal_loan: { icon: 'banknote', color: 'personal' },
  medical: { icon: 'heart', color: 'health' },
  other: { icon: 'sparkle', color: 'extra' }
};

export const DEBT_TYPE_ORDER = ['credit_card', 'student_loan', 'auto_loan', 'personal_loan', 'medical', 'other'];

export const DEBT_STRATEGIES = ['snowball', 'avalanche', 'custom'];

// Ordena as dívidas (só as com saldo > 0) segundo a estratégia escolhida:
// snowball = menor saldo primeiro (vitórias rápidas), avalanche = maior juros (APR) primeiro (menos juros no total),
// custom = ordem manual guardada em debt.order (o comprador reordena com as setas na lista).
export function orderDebts(debts, strategy) {
  const list = debts.filter(d => d.balance > 0);
  if (strategy === 'avalanche') return [...list].sort((a, b) => (b.apr || 0) - (a.apr || 0));
  if (strategy === 'custom') return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return [...list].sort((a, b) => a.balance - b.balance); // snowball (padrão)
}

export function totalMinPayments(debts) {
  return round2(debts.filter(d => d.balance > 0).reduce((s, d) => s + (d.minPayment || 0), 0));
}

export function weightedAvgApr(debts) {
  const list = debts.filter(d => d.balance > 0);
  const total = list.reduce((s, d) => s + d.balance, 0);
  if (total <= 0) return 0;
  return round2(list.reduce((s, d) => s + (d.apr || 0) * d.balance, 0) / total);
}

// Simula mês a mês o método "waterfall": paga o mínimo em tudo, joga todo o valor extra na dívida
// prioritária da estratégia e, assim que uma dívida quita, rola o mínimo dela pro extra do mês seguinte
// (o "efeito bola de neve/avalanche" clássico). Retorna o total de meses até quitar tudo, o total de juros
// pago no caminho e em que mês cada dívida específica é quitada.
export function simulatePayoffPlan(debts, extraMonthly, strategy) {
  const ordered = orderDebts(debts, strategy).map(d => ({
    id: d.id, name: d.name, balance: d.balance, apr: d.apr || 0, minPayment: d.minPayment || 0
  }));
  if (ordered.length === 0) {
    return { months: 0, totalInterest: 0, payoffOrder: [], reachable: true };
  }

  let extra = Math.max(0, extraMonthly || 0);
  let totalInterest = 0;
  let month = 0;
  const payoffOrder = [];
  const MAX_MONTHS = 600; // trava de segurança (50 anos) contra loop infinito quando extra+mínimos não cobrem os juros

  while (ordered.some(d => d.balance > 0.01) && month < MAX_MONTHS) {
    month++;
    // 1) juros do mês incidem sobre o saldo de cada dívida em aberto
    ordered.forEach(d => {
      if (d.balance <= 0) return;
      const monthlyRate = (d.apr / 100) / 12;
      const interest = round2(d.balance * monthlyRate);
      totalInterest += interest;
      d.balance = round2(d.balance + interest);
    });
    // 2) paga o mínimo de cada dívida
    ordered.forEach(d => {
      if (d.balance <= 0) return;
      d.balance = round2(d.balance - Math.min(d.minPayment || 0, d.balance));
    });
    // 3) o valor extra vai inteiro pra dívida prioritária da estratégia; sobra passa pra próxima
    let pool = extra;
    for (const d of ordered) {
      if (pool <= 0) break;
      if (d.balance <= 0) continue;
      const pay = Math.min(pool, d.balance);
      d.balance = round2(d.balance - pay);
      pool -= pay;
    }
    // 4) dívida quitada libera o próprio mínimo pro pool de extra dos meses seguintes (efeito bola de neve)
    ordered.forEach(d => {
      if (d.balance <= 0.01 && !payoffOrder.find(p => p.id === d.id)) {
        d.balance = 0;
        payoffOrder.push({ id: d.id, name: d.name, month });
        extra += (d.minPayment || 0);
      }
    });
  }

  const reachable = !ordered.some(d => d.balance > 0.01);
  return { months: month, totalInterest: round2(Math.max(0, totalInterest)), payoffOrder, reachable };
}
