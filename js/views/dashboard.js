// views/dashboard.js — visão geral: KPIs, gastos por categoria, gráfico de distribuição, gastos recentes
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatDateShort, monthLabel, monthShortLabel, daysLeftInMonth, isSameMonth, round2 } from '../utils/format.js';
import { categoryLabel } from '../utils/helpers.js';
import { showToast } from '../components/toast.js';
import '../components/app-modal.js';
import { openExpenseModal } from './expense-modal.js';
import { compute503020 } from '../modules/budget-rule.js';
import { scanReceiptImage } from '../modules/receipt-ai.js';
import { renderInsightHTML } from '../modules/insights-ai.js';

// Necessidades/desejos usam a mesma cor de categoria já associada a elas em outras telas
// (housing/personal); poupança reaproveita o azul --cat-car, o mesmo já usado pro KPI de meta
// aqui do Dashboard e pra contribuição de cofrinho no Calendário/Análises.
const RULE_GROUP_STYLE = {
  needs: { fg: 'var(--cat-housing)', bg: 'var(--cat-housing-bg)', higherIsBetter: false },
  wants: { fg: 'var(--cat-personal)', bg: 'var(--cat-personal-bg)', higherIsBetter: false },
  savings: { fg: 'var(--cat-car)', bg: 'var(--cat-car-bg)', higherIsBetter: true }
};

function ruleRow(group, rule, currency) {
  const style = RULE_GROUP_STYLE[group];
  const actualPct = rule.pct[group];
  const targetPct = rule.target[group];
  const isGood = style.higherIsBetter ? actualPct >= targetPct : actualPct <= targetPct;
  const fillWidth = Math.min(100, actualPct);
  return `
    <div class="rule-row">
      <div class="rule-row__top">
        <span class="rule-row__label">${I18n.t('budgetRule.' + group)}</span>
        <span class="rule-row__amounts">
          ${formatCurrency(rule[group], currency)}
          <strong style="color:${isGood ? 'var(--good)' : 'var(--danger)'};">${actualPct}%</strong>
          <span class="u-text-faint">${I18n.t('budgetRule.targetPct', { pct: targetPct })}</span>
        </span>
      </div>
      <div class="progress-track rule-row__track">
        <div class="progress-fill" style="width:${fillWidth}%; background:${style.fg};"></div>
        <span class="rule-row__target-mark" style="left:${Math.min(100, targetPct)}%;"></span>
      </div>
    </div>
  `;
}

function buildDonutSegments(items, total) {
  if (total <= 0) return '';
  const r = 54, c = 2 * Math.PI * r;
  const gap = 3; // px de folga entre fatias, pra abrir a divisão branca (cor do fundo) que o Lovable usa
  let acc = 0;
  return items.filter(i => i.spent > 0).map(i => {
    const frac = i.spent / total;
    const len = frac * c;
    const drawLen = Math.max(len - gap, 0.5);
    const seg = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${i.strokeColor}" stroke-width="16" stroke-dasharray="${drawLen.toFixed(1)} ${(c - drawLen).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}"></circle>`;
    acc += len;
    return seg;
  }).join('');
}

export function renderDashboard(container, { onNavigate } = {}) {
  const lang = I18n.getLang();
  const settings = DB.getSettings();
  const currency = settings.currency;
  const categories = DB.getCategories();
  const allExpenses = DB.getExpenses();
  const now = new Date();

  const monthExpenses = allExpenses.filter(e => e.categoryKey !== CONFIG.SAVINGS_CATEGORY_KEY && isSameMonth(e.date, now));
  const spentThisMonth = round2(monthExpenses.reduce((s, e) => s + e.amount, 0));
  const totalBudget = round2(categories.reduce((s, c) => s + c.budget, 0));
  const remaining = round2(totalBudget - spentThisMonth);
  const daysLeft = daysLeftInMonth(now);

  const allIncomes = DB.getIncomes();
  const incomeThisMonth = round2(allIncomes.filter(i => isSameMonth(i.date, now)).reduce((s, i) => s + i.amount, 0));
  const netThisMonth = round2(incomeThisMonth - spentThisMonth);

  // Cofrinhos: soma acumulada (all-time, não só do mês) guardada em todos os cofrinhos vs. a soma dos alvos.
  const funds = DB.getFunds();
  const totalSaved = round2(
    allExpenses.filter(e => e.categoryKey === CONFIG.SAVINGS_CATEGORY_KEY).reduce((s, e) => s + e.amount, 0)
  );
  const totalFundsTarget = round2(funds.reduce((s, f) => s + f.target, 0));

  const catSpend = {};
  monthExpenses.forEach(e => { catSpend[e.categoryKey] = round2((catSpend[e.categoryKey] || 0) + e.amount); });

  const displayCats = categories.map(c => ({ ...c, spent: catSpend[c.key] || 0 }));
  const knownKeys = new Set(categories.map(c => c.key));
  const orphanSpent = round2(monthExpenses.filter(e => !knownKeys.has(e.categoryKey)).reduce((s, e) => s + e.amount, 0));
  if (orphanSpent > 0) displayCats.push({ key: 'other', icon: 'sparkle', color: null, budget: 0, spent: orphanSpent });

  const onTrackCount = categories.filter(c => (catSpend[c.key] || 0) <= c.budget).length;
  const donutTotal = round2(displayCats.reduce((s, c) => s + c.spent, 0));

  const rule = compute503020({ categories, expenses: allExpenses, incomes: allIncomes, referenceDate: now });

  // Tendência de gastos (últimos 6 meses, mês atual incluso) — dá ao Dashboard um gráfico de
  // barras além da rosca, junto com o card de KPIs colorido, pra ficar mais "cheio"/visual.
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d;
  });
  const trendData = trendMonths.map(d => ({
    date: d,
    total: round2(allExpenses
      .filter(e => e.categoryKey !== CONFIG.SAVINGS_CATEGORY_KEY && isSameMonth(e.date, d))
      .reduce((s, e) => s + e.amount, 0))
  }));
  const trendMax = Math.max(1, ...trendData.map(t => t.total));

  // Análise por IA (card "logo abaixo" do 50/30/20): sob demanda, não gerada sozinha a cada
  // abertura do Dashboard — cada geração consome crédito da chave da própria pessoa, então só
  // roda quando ela pede. O resultado fica em cache (DB.getAIInsight/saveAIInsight) até o mês
  // virar ou ela pedir pra gerar de novo, pra não perder a última análise ao só recarregar a página.
  const aiSettings = DB.getAISettings();
  const hasAIKey = !!(aiSettings && aiSettings.apiKey);
  const monthKey = now.toISOString().slice(0, 7);
  const cachedInsight = DB.getAIInsight();
  const hasInsightForThisMonth = !!(cachedInsight && cachedInsight.month === monthKey);
  const hasAnalyticsData = incomeThisMonth > 0 || spentThisMonth > 0;

  const recent = allExpenses
    .filter(e => e.categoryKey !== CONFIG.SAVINGS_CATEGORY_KEY)
    .slice()
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
    .slice(0, 5);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">${I18n.t('dashboard.overviewTitle', { month: monthLabel(lang, now) })}</h1>
        <p class="view-subtitle">${I18n.t('dashboard.subtitle')}</p>
      </div>
      <div class="u-flex u-gap-sm">
        <button class="btn btn--ghost" id="btn-scan">${icon('scanFrame', 17)}${I18n.t('dashboard.scanReceipt')}</button>
        <input type="file" accept="image/*" id="scan-file-input" class="u-hidden">
        <button class="btn btn--primary" id="btn-add">${icon('plus', 17, 2)}${I18n.t('dashboard.addExpense')}</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card" style="background:var(--good-bg); border-color:oklch(0.55 0.1 150 / 0.25);">
        <span class="kpi-card__icon" style="color:var(--good);">${icon('wallet', 19)}</span>
        <span class="kpi-card__label">${I18n.t('dashboard.kpiIncome')}</span>
        <span class="kpi-card__value" style="color:var(--good);">${formatCurrency(incomeThisMonth, currency)}</span>
        <span class="kpi-card__sub">${I18n.t('dashboard.kpiIncomeSub', { net: formatCurrency(netThisMonth, currency) })}</span>
      </div>
      <div class="kpi-card" style="background:var(--cat-personal-bg); border-color:oklch(0.72 0.11 30 / 0.25);">
        <span class="kpi-card__icon" style="color:var(--cat-personal);">${icon('cart', 19)}</span>
        <span class="kpi-card__label">${I18n.t('dashboard.kpiSpent')}</span>
        <span class="kpi-card__value" style="color:var(--cat-personal);">${formatCurrency(spentThisMonth, currency)}</span>
        <span class="kpi-card__sub">${I18n.t('dashboard.kpiSpentSub', { budget: formatCurrency(totalBudget, currency) })}</span>
      </div>
      <div class="kpi-card" style="background:var(--cat-utilities-bg); border-color:oklch(0.79 0.13 78 / 0.3);">
        <span class="kpi-card__icon" style="color:var(--cat-utilities);">${icon('calendar', 19)}</span>
        <span class="kpi-card__label">${I18n.t('dashboard.kpiRemaining')}</span>
        <span class="kpi-card__value ${remaining < 0 ? 'kpi-card__value--danger' : 'kpi-card__value--good'}">${formatCurrency(remaining, currency)}</span>
        <span class="kpi-card__sub">${remaining < 0 ? I18n.t('dashboard.kpiRemainingSubOver') : I18n.t('dashboard.kpiRemainingSubLeft', { days: daysLeft })}</span>
      </div>
      <div class="kpi-card" style="background:var(--cat-car-bg); border-color:oklch(0.66 0.09 230 / 0.25);">
        <span class="kpi-card__icon" style="color:var(--cat-car);">${icon('piggy', 19)}</span>
        <span class="kpi-card__label">${I18n.t('dashboard.kpiGoal')}</span>
        <span class="kpi-card__value" style="color:var(--cat-car);">${funds.length > 0 ? formatCurrency(totalSaved, currency) : '—'}</span>
        <span class="kpi-card__sub">${funds.length > 0 ? I18n.t('dashboard.kpiGoalSub', { saved: formatCurrency(totalSaved, currency), goal: formatCurrency(totalFundsTarget, currency) }) : I18n.t('dashboard.kpiGoalSubNoGoal')}</span>
      </div>
      <div class="kpi-card" style="background:var(--cat-kids-bg); border-color:oklch(0.6 0.12 350 / 0.25);">
        <span class="kpi-card__icon" style="color:var(--cat-kids);">${icon('checkCircle', 19)}</span>
        <span class="kpi-card__label">${I18n.t('dashboard.kpiOnTrack')}</span>
        <span class="kpi-card__value" style="color:var(--cat-kids);">${onTrackCount}</span>
        <span class="kpi-card__sub">${I18n.t('dashboard.kpiOnTrackSub', { total: categories.length })}</span>
      </div>
    </div>

    <div class="card u-mb-md">
      <div class="u-flex u-justify-between u-items-center u-mb-sm">
        <h3 class="section-title">${I18n.t('dashboard.spendingTrend')}</h3>
        <span class="u-text-faint u-text-sm">${I18n.t('dashboard.last6Months')}</span>
      </div>
      <div class="trend-chart">
        ${trendData.map((t, idx) => {
          const isCurrent = idx === trendData.length - 1;
          const h = trendMax > 0 ? Math.max(4, Math.round((t.total / trendMax) * 100)) : 4;
          return `
            <div class="trend-bar-col">
              <span class="trend-bar-col__amount">${t.total > 0 ? formatCurrency(t.total, currency) : ''}</span>
              <div class="trend-bar" style="height:${h}%; background:${isCurrent ? 'var(--accent)' : 'var(--accent-tint)'};"></div>
              <span class="trend-bar-label">${monthShortLabel(lang, t.date)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card u-mb-md">
      <div class="u-flex u-justify-between u-items-center u-mb-sm">
        <h3 class="section-title">${I18n.t('dashboard.rule503020Title')}</h3>
        <span class="u-text-faint u-text-sm">${I18n.t('dashboard.rule503020Subtitle')}</span>
      </div>
      ${!rule.hasIncome
        ? `<div class="empty-state">${I18n.t('dashboard.rule503020NoIncome')}</div>`
        : `<div class="rule-rows">${ruleRow('needs', rule, currency)}${ruleRow('wants', rule, currency)}${ruleRow('savings', rule, currency)}</div>`}
    </div>

    <div class="card u-mb-md" id="ai-insight-card">
      <div class="u-flex u-justify-between u-items-center u-mb-sm">
        <h3 class="section-title">${I18n.t('dashboard.aiInsightTitle')}</h3>
        ${hasInsightForThisMonth ? `<span class="u-text-faint u-text-sm">${I18n.t('dashboard.aiInsightGeneratedAt', { date: formatDateShort(cachedInsight.generatedAt.slice(0, 10), lang) })}</span>` : ''}
      </div>
      ${!hasAIKey ? `
        <p class="u-text-muted u-text-sm" style="margin:0 0 10px;">${I18n.t('dashboard.aiInsightNoKeyBody')}</p>
        <button class="btn btn--ghost" id="ai-insight-go-settings">${I18n.t('expense.scanNoKeyGoSettings')}</button>
      ` : !hasAnalyticsData ? `
        <p class="u-text-muted u-text-sm" style="margin:0;">${I18n.t('dashboard.aiInsightEmpty')}</p>
      ` : hasInsightForThisMonth ? `
        <div class="ai-insight-teaser">${renderInsightHTML(String(cachedInsight.text || '').split(/\n{2,}/)[0])}</div>
        <button class="btn btn--ghost u-mt-sm" id="ai-insight-view">${I18n.t('dashboard.aiInsightViewFull')}</button>
      ` : `
        <p class="u-text-muted u-text-sm" style="margin:0 0 10px;">${I18n.t('dashboard.aiInsightIntro')}</p>
        <button class="btn btn--ghost" id="ai-insight-view">${I18n.t('dashboard.aiInsightGenerate')}</button>
      `}
    </div>

    <div class="dash-body" style="display:grid; grid-template-columns:1.35fr 1fr; gap:22px;">
      <div class="card">
        <div class="u-flex u-justify-between u-items-center u-mb-sm">
          <h3 class="section-title">${I18n.t('dashboard.spendingByCategory')}</h3>
          <span class="u-text-faint u-text-sm">${I18n.t('dashboard.categoriesCount', { count: categories.length })}</span>
        </div>
        ${categories.length === 0
          ? `<div class="empty-state">${I18n.t('dashboard.noExpenses')}</div>`
          : `<div class="cat-row__legend">${I18n.t('dashboard.spentVsBudget')}</div>` + categories.map(c => {
              const spent = catSpend[c.key] || 0;
              const pct = c.budget > 0 ? Math.min(100, Math.round((spent / c.budget) * 100)) : (spent > 0 ? 100 : 0);
              return `
                <div class="cat-row">
                  <span class="cat-chip" style="background:var(--cat-${c.color}-bg); color:var(--cat-${c.color});">${icon(c.icon, 18)}</span>
                  <div class="cat-row__body">
                    <div class="cat-row__top">
                      <span class="cat-row__name">${categoryLabel(c)}</span>
                      <span class="cat-row__amounts" data-edit-budget="${c.key}">${formatCurrency(spent, currency)} / ${formatCurrency(c.budget, currency)}</span>
                    </div>
                    <div class="progress-track"><div class="progress-fill" style="width:${pct}%; background:var(--cat-${c.color});"></div></div>
                  </div>
                </div>
              `;
            }).join('')}
      </div>

      <div class="u-flex-col u-gap-md">
        <div class="card u-flex-col u-items-center u-gap-sm">
          <h3 class="section-title" style="align-self:flex-start;">${I18n.t('dashboard.spendingBreakdown')}</h3>
          <div class="donut-wrap">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="54" fill="none" stroke="var(--surface-2)" stroke-width="16"></circle>
              <g transform="rotate(-90 70 70)">
                ${buildDonutSegments(displayCats.map(c => ({ ...c, strokeColor: c.color ? `var(--cat-${c.color})` : 'var(--ink-faint)' })), donutTotal)}
              </g>
            </svg>
            <div class="donut-center">
              <span class="donut-center__value">${formatCurrency(donutTotal, currency)}</span>
              <span class="donut-center__label">${I18n.t('dashboard.thisMonth')}</span>
            </div>
          </div>
          <div class="legend">
            ${displayCats.filter(c => c.spent > 0).map(c => `
              <span class="legend__item">
                <span class="legend__dot" style="background:${c.color ? `var(--cat-${c.color})` : 'var(--ink-faint)'};"></span>
                ${categoryLabel(c)} ${donutTotal > 0 ? Math.round((c.spent / donutTotal) * 100) : 0}%
              </span>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="u-flex u-justify-between u-items-center u-mb-sm">
            <h3 class="section-title">${I18n.t('dashboard.recentExpenses')}</h3>
            ${allExpenses.length > 5 ? `<button class="btn btn--text btn--sm" id="btn-view-all">${I18n.t('dashboard.viewAll')}</button>` : ''}
          </div>
          ${recent.length === 0
            ? `<div class="empty-state">${I18n.t('dashboard.noExpenses')}</div>`
            : recent.map(e => `
                <div class="tx-row">
                  <span class="tx-row__icon">${icon(e.source === 'scan' ? 'camera' : 'pencil', 15)}</span>
                  <div class="tx-row__body">
                    <div class="tx-row__title">${e.description}</div>
                    <div class="tx-row__meta">${(() => { const c = categories.find(x => x.key === e.categoryKey); return c ? categoryLabel(c) : I18n.t('category.other'); })()} · ${formatDateShort(e.date, lang)}</div>
                  </div>
                  <span class="tx-row__amount">${formatCurrency(e.amount, currency)}</span>
                </div>
              `).join('')}
        </div>
      </div>
    </div>

    <app-modal modal-title="${I18n.t('expense.scanNoKeyTitle')}" id="scan-modal">
      <p class="u-text-muted" style="margin:0;">${I18n.t('expense.scanNoKeyBody')}</p>
      <div class="app-modal__actions">
        <button class="btn btn--ghost" id="scan-manual">${I18n.t('expense.scanNoKeyManual')}</button>
        <button class="btn btn--primary" id="scan-go-settings">${I18n.t('expense.scanNoKeyGoSettings')}</button>
      </div>
    </app-modal>

    <app-modal modal-title="${I18n.t('dashboard.spendingByCategory')}" id="budget-modal">
      <div class="field">
        <span class="field__label" id="budget-modal-label"></span>
        <input type="number" min="0" step="1" id="budget-input">
      </div>
      <div class="app-modal__actions">
        <button class="btn btn--ghost" id="budget-cancel">${I18n.t('common.cancel')}</button>
        <button class="btn btn--primary" id="budget-save">${I18n.t('common.save')}</button>
      </div>
    </app-modal>
  `;

  // Escanear recibo: sem chave de IA configurada, abre um aviso levando a Configurações (ou
  // deixa adicionar manualmente); com chave configurada, pula o aviso e abre direto o seletor de
  // arquivos do computador — nunca uma câmera ao vivo dentro do painel (mais fácil no computador,
  // e no celular o próprio seletor do sistema já oferece "tirar foto" como uma das opções).
  const scanModal = container.querySelector('#scan-modal');
  const scanBtn = container.querySelector('#btn-scan');
  const scanFileInput = container.querySelector('#scan-file-input');
  const scanBtnDefaultHTML = scanBtn.innerHTML;

  scanBtn.addEventListener('click', () => {
    if (hasAIKey) {
      scanFileInput.click();
    } else {
      scanModal.open();
    }
  });
  container.querySelector('#scan-go-settings').addEventListener('click', () => {
    scanModal.close();
    onNavigate?.('settings');
  });
  container.querySelector('#scan-manual').addEventListener('click', () => {
    scanModal.close();
    openExpenseModal(container, { categories, currency, onSaved: () => renderDashboard(container, { onNavigate }) });
  });
  scanFileInput.addEventListener('change', async () => {
    const file = scanFileInput.files[0];
    scanFileInput.value = ''; // limpa pra escolher o mesmo arquivo de novo ainda disparar 'change'
    if (!file) return;
    scanBtn.disabled = true;
    scanBtn.innerHTML = `${icon('scanFrame', 17)}${I18n.t('expense.scanReading')}`;
    try {
      const result = await scanReceiptImage({ provider: aiSettings.provider, apiKey: aiSettings.apiKey, model: aiSettings.model, file, categories });
      openExpenseModal(container, { categories, currency, presetValues: result, source: 'scan', onSaved: () => renderDashboard(container, { onNavigate }) });
    } catch (err) {
      // Anexa a mensagem crua do provedor (ex: "model not found", "invalid x-api-key") ao toast —
      // sem isso o erro genérico não dava pra diagnosticar (foi o caso real de "claude-3-5-sonnet-latest"
      // ter sido descontinuado pela Anthropic e a mensagem só dizer "confira sua conta e tente de novo").
      showToast(`${I18n.t('expense.scanError')} (${err?.message || err})`, 'error');
      openExpenseModal(container, { categories, currency, onSaved: () => renderDashboard(container, { onNavigate }) });
    } finally {
      scanBtn.disabled = false;
      scanBtn.innerHTML = scanBtnDefaultHTML;
    }
  });

  // Análise por IA: o card do Dashboard é só uma prévia/atalho (título + primeiro parágrafo da
  // última análise, se houver) — a geração em si (botão gerar/regenerar, texto completo) mora na
  // página dedicada "Análise da IA" (views/ai-insights.js), aberta pelo ícone novo na barra lateral
  // ou por este atalho. Fica assim mais visível (tem destino próprio) sem duplicar a lógica de
  // chamada da IA em dois lugares.
  const insightGoSettingsBtn = container.querySelector('#ai-insight-go-settings');
  if (insightGoSettingsBtn) {
    insightGoSettingsBtn.addEventListener('click', () => onNavigate?.('settings'));
  }
  const insightViewBtn = container.querySelector('#ai-insight-view');
  if (insightViewBtn) {
    insightViewBtn.addEventListener('click', () => onNavigate?.('ai-insights'));
  }

  container.querySelector('#btn-add').addEventListener('click', () => {
    openExpenseModal(container, { categories, currency, onSaved: () => renderDashboard(container, { onNavigate }) });
  });

  const viewAllBtn = container.querySelector('#btn-view-all');
  if (viewAllBtn) viewAllBtn.addEventListener('click', () => onNavigate?.('expenses'));

  const budgetModal = container.querySelector('#budget-modal');
  let editingKey = null;
  container.querySelectorAll('[data-edit-budget]').forEach(el => {
    el.addEventListener('click', () => {
      editingKey = el.dataset.editBudget;
      const cat = categories.find(c => c.key === editingKey);
      container.querySelector('#budget-modal-label').textContent = cat ? categoryLabel(cat) : I18n.t('category.other');
      container.querySelector('#budget-input').value = cat ? cat.budget : 0;
      budgetModal.open();
    });
  });
  container.querySelector('#budget-cancel').addEventListener('click', () => budgetModal.close());
  container.querySelector('#budget-save').addEventListener('click', () => {
    const val = parseFloat(container.querySelector('#budget-input').value);
    DB.updateCategoryBudget(editingKey, Number.isFinite(val) ? val : 0);
    budgetModal.close();
    showToast(I18n.t('toast.budgetUpdated'), 'success');
    renderDashboard(container, { onNavigate });
  });
}
