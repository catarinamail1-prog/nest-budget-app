// modules/funds.js — catálogo de "tipos" de cofrinho (ícone + cor) e cálculo de progresso a partir das contribuições
import { round2 } from '../utils/format.js';

export const FUND_TYPE_DEFS = {
  general: { icon: 'piggy', color: 'good' },
  emergency: { icon: 'target', color: 'utilities' },
  vacation: { icon: 'sparkles', color: 'personal' },
  home: { icon: 'house', color: 'housing' },
  vehicle: { icon: 'car', color: 'car' },
  family: { icon: 'heart', color: 'health' },
  other: { icon: 'sparkle', color: 'extra' }
};

export const FUND_TYPE_ORDER = ['general', 'emergency', 'vacation', 'home', 'vehicle', 'family', 'other'];

// Total guardado num cofrinho = soma de todas as contribuições vinculadas (all-time, não reseta por mês —
// diferente da antiga meta mensal única, um cofrinho é uma poupança acumulada rumo a um objetivo específico).
export function computeFundSaved(fund, savingsExpenses) {
  return round2(savingsExpenses.filter(e => e.fundId === fund.id).reduce((s, e) => s + e.amount, 0));
}
