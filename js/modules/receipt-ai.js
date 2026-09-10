// modules/receipt-ai.js — leitura de recibo por IA (BYOK: a pessoa cola a própria chave de API
// em Configurações). A foto e a chave viajam DIRETO do navegador pro provedor escolhido — nunca
// passam por um servidor nosso, porque o app não tem servidor nenhum, é só HTML/JS estático.
// Cada provedor tem endpoint, cabeçalhos e formato de resposta próprios; esse módulo padroniza
// os três atrás de uma única função (scanReceiptImage) que sempre devolve o mesmo formato de saída.

// Modelo padrão do provedor — multimodal (lê imagem) e de custo baixo. É só um ponto de
// partida: a pessoa pode trocar em Configurações se o catálogo da Anthropic mudar depois.
// Só a Anthropic/Claude fica disponível como provedor de IA no app (OpenAI e Gemini foram
// removidos dos templates de propósito — é a que dá os melhores resultados pra este uso).
export const AI_PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-5',
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys'
  }
};

export const AI_PROVIDER_ORDER = ['anthropic'];

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
    // thinking desligado: é só leitura de recibo -> JSON, não precisa de raciocínio, e sem isso
    // modelos mais novos (Claude Sonnet 5+) ligam "adaptive thinking" sozinhos — o que consome o
    // max_tokens (aqui só 400) antes de sobrar espaço pra resposta, e faz content[0] virar um bloco
    // { type: "thinking" } em vez de texto (ver nota igual em modules/insights-ai.js).
    body: JSON.stringify({
      // max_tokens com folga: o tokenizer dos modelos mais novos (Sonnet 5+) gasta mais tokens por
      // resposta que os antigos, mesmo com thinking desligado — 400 era justo demais.
      model,
      max_tokens: 700,
      thinking: { type: 'disabled' },
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
  if (data?.stop_reason === 'refusal') throw new Error('anthropic_refusal');
  // Nunca ler content[0].text por posição — filtra por type (mesmo motivo do módulo de insights).
  const text = (Array.isArray(data?.content) ? data.content : []).filter(b => b?.type === 'text').map(b => b.text).join('\n').trim();
  if (!text) {
    // Diagnóstico rico em vez de só "empty_response" (mesmo motivo do módulo de insights).
    const blockTypes = (Array.isArray(data?.content) ? data.content : []).map(b => b?.type).join(',') || 'none';
    throw new Error(`empty_response (stop_reason=${data?.stop_reason ?? 'unknown'}, blocks=${blockTypes})`);
  }
  return extractJSON(text);
}

const CALLERS = { anthropic: callAnthropic };

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
