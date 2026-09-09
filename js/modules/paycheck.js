// modules/paycheck.js — motor da Visão por Contracheque: distribui o orçamento do mês entre os
// recebimentos (renda) do mês, na ordem em que caem, pra responder "esse contracheque cobre o quê?"
import { round2 } from '../utils/format.js';

// paychecks: entradas de renda do mês, já ordenadas por data crescente.
// categories: categorias com orçamento, na ordem de exibição do app (categories.js/CATEGORY_ORDER).
// Caminha pelos contracheques em ordem; cada um vai "comprando" o orçamento das categorias na ordem
// em que aparecem até acabar o valor recebido — uma categoria pode ficar dividida entre dois
// contracheques seguidos. Sobra de renda sem categoria pra cobrir vira "leftover" no contracheque;
// orçamento que nenhum contracheque cobre (renda insuficiente no mês) vira "uncoveredCategories".
export function computePaycheckPlan(paychecks, categories) {
  const budgeted = categories.filter(c => c.budget > 0);
  const queue = budgeted.map(c => ({ key: c.key, icon: c.icon, color: c.color, remaining: c.budget }));
  const plan = paychecks.map(p => ({ paycheck: p, allocations: [], leftover: 0 }));
  const splitCount = {}; // quantos pedaços cada categoria acabou levando, pra marcar isPartial depois

  let catIdx = 0;
  for (const entry of plan) {
    let remaining = entry.paycheck.amount;
    while (remaining > 0.004 && catIdx < queue.length) {
      const cat = queue[catIdx];
      const take = round2(Math.min(remaining, cat.remaining));
      if (take > 0.004) {
        entry.allocations.push({ key: cat.key, icon: cat.icon, color: cat.color, amount: take });
        splitCount[cat.key] = (splitCount[cat.key] || 0) + 1;
        cat.remaining = round2(cat.remaining - take);
        remaining = round2(remaining - take);
      }
      if (cat.remaining <= 0.004) catIdx++; else break; // acabou o contracheque no meio desta categoria
    }
    entry.leftover = round2(Math.max(0, remaining));
  }

  // uma categoria é "parcial" se ficou dividida entre >1 contracheque OU se sobrou orçamento dela sem cobertura
  const remainingByKey = {};
  queue.forEach(c => { remainingByKey[c.key] = c.remaining; });
  plan.forEach(entry => {
    entry.allocations.forEach(a => {
      a.isPartial = (splitCount[a.key] || 1) > 1 || remainingByKey[a.key] > 0.004;
    });
  });

  const uncoveredCategories = queue.filter(c => c.remaining > 0.004);
  const shortfall = round2(uncoveredCategories.reduce((s, c) => s + c.remaining, 0));

  return { plan, shortfall, uncoveredCategories };
}
