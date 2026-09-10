// modules/receipt-ai.js — leitura de recibo por IA (BYOK: a pessoa cola a própria chave de API
// em Configurações). A foto e a chave viajam DIRETO do navegador pro provedor escolhido — nunca
// passam por um servidor do Nest, porque o Nest não tem servidor nenhum, é só HTML/JS estático.
// Cada provedor tem endpoint, cabeçalhos e formato de resposta próprios; esse módulo padroniza
// os três atrás de uma única função (scanReceiptImage) que sempre devolve o mesmo formato de saída.

// Modelo padrão de cada provedor — todos multimodais (leem imagem) e de custo baixo. É só um
// ponto de partida: a pessoa pode trocar em Configurações se o provedor mudar o catálogo depois.
export const AI_PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-5',
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys'
  },
  openai: {
    label: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  gemini: {
    label: 'Google (Gemini)',
    defaultModel: 'gemini-3.8-flash',
    keyPlaceholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  }
};

export const AI_PROVIDER_ORDER = ['anthropic', 'openai', 'gemini'];

// Lê um File (input type="file") e devolve { base64, mimeType } — base64 SEM o prefixo
// "data:...;base64," (cada provedor espera o dado puro, cada um encaixa o prefixo do seu jeito).
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('file_read_error'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve({ base64: comma >= 0 ? result.slice(comma + 1) : result, mimeType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  });
}

// Mesma instrução pros três provedores — pede um JSON só, sem markdown, com as chaves de
// categoria REAIS do comprador (pra já vir compatível com DB.addExpense sem nenhum mapeamento).
function buildPrompt(categories) {
  const keys = categories.map(c => c.key).join(', ');
  return [
    'You are reading a purchase receipt photo for a personal budgeting app.',
    'Extract the following fields and respond with ONLY a raw JSON object, no markdown fences, no extra text:',
    '{ "description": string (short, e.g. merchant name or what was bought), "amount": number (total paid, no currency symbol), "date": string in YYYY-MM-DD format (use your best guess from the receipt; if unreadable, omit the field), "category": string, one of exactly these keys or null if none fits well: [' + keys + '] }',
    'If the image is not a receipt or you cannot read it, respond with { "error": "not_a_receipt" }.'
  ].join('\n');
}

// Tira o texto de dentro de um bloco ```json ... ``` (comum mesmo quando a gente pede pra não
// vir markdown) e faz o parse do primeiro objeto { ... } encontrado no texto.
function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0 || end < start) throw new Error('no_json_found');
  return JSON.parse(raw.slice(start, end + 1));
}

async function callAnthropic({ apiKey, model, base64, mimeType, prompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `anthropic_http_${res.status}`);
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('empty_response');
  return extractJSON(text);
}

async function callOpenAI({ apiKey, model, base64, mimeType, prompt }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `openai_http_${res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('empty_response');
  return extractJSON(text);
}

async function callGemini({ apiKey, model, base64, mimeType, prompt }) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `gemini_http_${res.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  if (!text) throw new Error('empty_response');
  return extractJSON(text);
}

const CALLERS = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini };

// Ponto único de entrada — devolve sempre { description, amount, date, categoryKey } (campos
// ausentes/ilegíveis viram null, quem chama decide o fallback). Lança erro com uma mensagem
// curta em caso de chave inválida, rede, "não é recibo" etc — a view decide como mostrar.
export async function scanReceiptImage({ provider, apiKey, model, file, categories }) {
  const def = AI_PROVIDERS[provider];
  if (!def) throw new Error('unknown_provider');
  if (!apiKey) throw new Error('missing_api_key');
  const caller = CALLERS[provider];
  const { base64, mimeType } = await fileToBase64(file);
  const prompt = buildPrompt(categories);
  const parsed = await caller({ apiKey, model: model || def.defaultModel, base64, mimeType, prompt });
  if (parsed.error) throw new Error(parsed.error);

  const knownKeys = new Set(categories.map(c => c.key));
  const amount = Number(parsed.amount);
  return {
    description: typeof parsed.description === 'string' ? parsed.description.slice(0, 120) : '',
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null,
    date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
    categoryKey: typeof parsed.category === 'string' && knownKeys.has(parsed.category) ? parsed.category : null
  };
}
