// modules/insights-ai.js — análise de gastos em texto, gerada pela mesma conta de IA (BYOK) do
// scanner de recibo. Reaproveita o catálogo de provedores de modules/receipt-ai.js (pra não ter
// dois lugares com o modelo padrão/rótulo de cada provedor), mas tem sua própria lógica de
// chamada — aqui é só texto (sem imagem), então o corpo de cada request é mais simples.
import { AI_PROVIDERS } from './receipt-ai.js';
import { formatCurrency } from '../utils/format.js';

const LANG_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian'
};

// Monta o prompt inteiro a partir do MESMO relatório que a tela de Análises já calcula
// (computeAnalyticsReport, período "month") — nenhuma matemática nova aqui, só formatação em
// texto pra IA ler. `fmt` já é o formatCurrency com a moeda certa, passado por quem chama.
function buildInsightPrompt({ report, rule, lang, fmt }) {
  const langName = LANG_NAMES[lang] || 'English';
  const categoryLines = report.expenses.byCategory
    .filter(c => c.spent > 0 || c.periodBudget > 0)
    .map(c => `- ${c.key}: spent ${fmt(c.spent)}, budget ${fmt(c.periodBudget)}`)
    .join('\n') || '- (no spending logged yet this month)';

  const ruleLine = rule.hasIncome
    ? `50/30/20 guideline — Needs: ${rule.pct.needs}% (target ${rule.target.needs}%), Wants: ${rule.pct.wants}% (target ${rule.target.wants}%), Savings: ${rule.pct.savings}% (target ${rule.target.savings}%).`
    : '50/30/20 guideline: not enough income logged yet to compute it — skip this part of the analysis.';

  return [
    'You are a friendly, concise financial assistant inside a household budgeting app called Nest.',
    'Using ONLY the data below, write a short spending analysis for this family. Plain conversational prose, 3 to 5 short paragraphs, separated by a blank line. NO markdown headers, NO bullet lists, NO asterisks, NO emoji.',
    'Cover, in this order, each as its own short paragraph:',
    '1) How this month compares to last month for income and spending.',
    "2) Call out any category that is significantly over its budget, with one specific and practical suggestion for THAT category. Skip this paragraph entirely if nothing is meaningfully over budget.",
    "3) One or two personalized money-saving tips based on THIS family's actual spending pattern shown below — not generic advice like \"cook at home more\".",
    '4) A short, encouraging comment on how the family is doing against the 50/30/20 guideline below, and if off target, what to shift to get closer. Skip if there is not enough income data (see note below).',
    'Keep the tone warm, specific and never judgmental. Do not invent numbers that are not present below. Write ONLY the analysis text, nothing else — no preamble, no sign-off.',
    `Respond in ${langName}.`,
    '',
    'DATA:',
    `Income this month: ${fmt(report.income.total)} (last month: ${fmt(report.income.prevTotal)})`,
    `Spending this month: ${fmt(report.expenses.total)} (last month: ${fmt(report.expenses.prevTotal)})`,
    `Net this month: ${fmt(report.net.total)} (last month: ${fmt(report.net.prevTotal)})`,
    'Spending by category this month:',
    categoryLines,
    ruleLine
  ].join('\n');
}

async function callAnthropicText({ apiKey, model, prompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `anthropic_http_${res.status}`);
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('empty_response');
  return text.trim();
}

async function callOpenAIText({ apiKey, model, prompt }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `openai_http_${res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('empty_response');
  return text.trim();
}

async function callGeminiText({ apiKey, model, prompt }) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `gemini_http_${res.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  if (!text) throw new Error('empty_response');
  return text.trim();
}

const CALLERS = { anthropic: callAnthropicText, openai: callOpenAIText, gemini: callGeminiText };

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// A IA devolve prosa simples (sem markdown); só precisamos preservar os parágrafos que ela
// separou por linha em branco, escapando tudo antes — nunca confiar em HTML vindo da IA. Centralizado
// aqui (em vez de duplicado por tela, como outros helpers pequenos do app) porque tanto o card do
// Dashboard quanto a página dedicada de Análise da IA precisam do MESMO escaping — duas cópias
// divergindo é como um dos dois lugares acaba renderizando HTML não escapado por engano.
export function renderInsightHTML(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(p => `<p class="ai-insight-para">${escapeHTML(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// report: o retorno de computeAnalyticsReport({ type: 'month', ... }). rule: o retorno de
// compute503020(...). currency: o código salvo em Settings — a formatação em si (fmt) é feita
// aqui dentro com o formatCurrency já importado por quem chama, pra não duplicar a lógica de
// símbolo/separador de milhar (ela já mora só em utils/format.js).
export async function generateSpendingInsight({ provider, apiKey, model, report, rule, lang, currency }) {
  const def = AI_PROVIDERS[provider];
  if (!def) throw new Error('unknown_provider');
  if (!apiKey) throw new Error('missing_api_key');
  const fmt = (n) => formatCurrency(n, currency);
  const prompt = buildInsightPrompt({ report, rule, lang, fmt });
  const caller = CALLERS[provider];
  return caller({ apiKey, model: model || def.defaultModel, prompt });
}
