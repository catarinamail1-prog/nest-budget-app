// views/ai-insights.js — página dedicada "Análise da IA": mesmo card do Dashboard, só que em
// destaque, com ícone próprio na barra lateral (antes vivia só como um card discreto lá embaixo
// no Dashboard e ficou difícil de achar). Toda a lógica de geração mora aqui agora; o card do
// Dashboard virou só uma prévia/atalho que traz a pessoa pra cá (js/views/dashboard.js).
import { I18n } from '../utils/i18n.js';
import { DB } from '../storage/db.js';
import { CONFIG } from '../config.js';
import { formatDateShort, isSameMonth, round2 } from '../utils/format.js';
import { showToast } from '../components/toast.js';
import { compute503020 } from '../modules/budget-rule.js';
import { generateSpendingInsight, renderInsightHTML } from '../modules/insights-ai.js';
import { computeAnalyticsReport } from '../modules/analytics.js';

export function renderAIInsights(container, { onNavigate } = {}) {
  const lang = I18n.getLang();
  const settings = DB.getSettings();
  const currency = settings.currency;
  const categories = DB.getCategories();
  const allExpenses = DB.getExpenses();
  const allIncomes = DB.getIncomes();
  const funds = DB.getFunds();
  const accounts = DB.getAccounts();
  const debts = DB.getDebts();
  const now = new Date();

  const spentThisMonth = round2(allExpenses.filter(e => e.categoryKey !== CONFIG.SAVINGS_CATEGORY_KEY && isSameMonth(e.date, now)).reduce((s, e) => s + e.amount, 0));
  const incomeThisMonth = round2(allIncomes.filter(i => isSameMonth(i.date, now)).reduce((s, i) => s + i.amount, 0));
  const hasAnalyticsData = incomeThisMonth > 0 || spentThisMonth > 0;

  const rule = compute503020({ categories, expenses: allExpenses, incomes: allIncomes, referenceDate: now });

  const aiSettings = DB.getAISettings();
  const hasAIKey = !!(aiSettings && aiSettings.apiKey);
  const monthKey = now.toISOString().slice(0, 7);

  function paint() {
    const cachedInsight = DB.getAIInsight();
    const hasInsightForThisMonth = !!(cachedInsight && cachedInsight.month === monthKey);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">${I18n.t('aiInsights.title')}</h1>
          <p class="view-subtitle">${I18n.t('aiInsights.subtitle')}</p>
        </div>
      </div>

      <div class="card" id="ai-insight-page-card">
        <div class="u-flex u-justify-between u-items-center u-mb-sm">
          <h3 class="section-title">${I18n.t('dashboard.aiInsightTitle')}</h3>
          ${hasInsightForThisMonth ? `<span class="u-text-faint u-text-sm">${I18n.t('dashboard.aiInsightGeneratedAt', { date: formatDateShort(cachedInsight.generatedAt.slice(0, 10), lang) })}</span>` : ''}
        </div>
        ${!hasAIKey ? `
          <p class="u-text-muted" style="margin:0 0 14px;">${I18n.t('dashboard.aiInsightNoKeyBody')}</p>
          <button class="btn btn--primary" id="ai-insight-go-settings">${I18n.t('expense.scanNoKeyGoSettings')}</button>
        ` : !hasAnalyticsData ? `
          <p class="u-text-muted" style="margin:0;">${I18n.t('dashboard.aiInsightEmpty')}</p>
        ` : `
          <div id="ai-insight-body">
            ${hasInsightForThisMonth ? renderInsightHTML(cachedInsight.text) : `<p class="u-text-muted" style="margin:0 0 14px;">${I18n.t('dashboard.aiInsightIntro')}</p>`}
          </div>
          <button class="btn btn--primary u-mt-sm" id="ai-insight-generate">${hasInsightForThisMonth ? I18n.t('dashboard.aiInsightRegenerate') : I18n.t('dashboard.aiInsightGenerate')}</button>
        `}
      </div>
    `;

    const goSettingsBtn = container.querySelector('#ai-insight-go-settings');
    if (goSettingsBtn) {
      goSettingsBtn.addEventListener('click', () => onNavigate?.('settings'));
    }

    const genBtn = container.querySelector('#ai-insight-generate');
    if (genBtn) {
      genBtn.addEventListener('click', async () => {
        const originalLabel = genBtn.textContent;
        genBtn.disabled = true;
        genBtn.textContent = I18n.t('dashboard.aiInsightGenerating');
        try {
          const report = computeAnalyticsReport({ type: 'month', anchor: now, categories, expenses: allExpenses, incomes: allIncomes, funds, accounts, debts });
          const text = await generateSpendingInsight({ provider: aiSettings.provider, apiKey: aiSettings.apiKey, model: aiSettings.model, report, rule, lang, currency });
          DB.saveAIInsight({ text, month: monthKey });
          paint();
        } catch (err) {
          // Mostra o erro cru do provedor junto (ex: "model not found", "invalid x-api-key") —
          // sem isso não dava pra saber POR QUE falhou, só que falhou.
          showToast(`${I18n.t('dashboard.aiInsightError')} (${err?.message || err})`, 'error');
          genBtn.disabled = false;
          genBtn.textContent = originalLabel;
        }
      });
    }
  }

  paint();
}
