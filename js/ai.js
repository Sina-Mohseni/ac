/* ============================================================
   INTELLIGENCE ARTIFICIELLE — BYOK (« apporte ta propre clé »)
   L'utilisateur fournit la clé de son fournisseur, la liste des
   modèles est chargée depuis ce fournisseur, puis il choisit le
   modèle à utiliser.

   La clé ne quitte jamais l'appareil autrement que vers le
   fournisseur choisi : elle est rangée dans IndexedDB (magasin
   « kv », clé « ai ») et envoyée uniquement dans l'en-tête
   d'authentification des requêtes ci-dessous.

   L'application est servie en modules ES sans étape de build :
   les appels passent donc par fetch(), pas par un SDK npm.
   ============================================================ */

import { getKV, setKV } from './db.js';

/* ---------- fournisseurs ---------- */

/* Modèles proposés d'office tant que la liste n'a pas été chargée. */
const SUGGEST = {
  anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  openai: ['gpt-5.1', 'gpt-5.1-mini', 'gpt-4.1'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest'],
  openrouter: ['anthropic/claude-opus-5', 'openai/gpt-5.1'],
  custom: []
};

export const PROVIDERS = {
  anthropic: {
    key: 'anthropic',
    name: 'Anthropic · Claude',
    base: 'https://api.anthropic.com',
    keyLabel: 'Clé API Anthropic',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-opus-5',
    note: "L'appel depuis le navigateur exige l'en-tête d'accès direct ; il est envoyé automatiquement."
  },
  openai: {
    key: 'openai',
    name: 'OpenAI',
    base: 'https://api.openai.com/v1',
    keyLabel: 'Clé API OpenAI',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-5.1'
  },
  google: {
    key: 'google',
    name: 'Google · Gemini',
    base: 'https://generativelanguage.googleapis.com',
    keyLabel: 'Clé API Google AI Studio',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.5-pro'
  },
  mistral: {
    key: 'mistral',
    name: 'Mistral AI',
    base: 'https://api.mistral.ai/v1',
    keyLabel: 'Clé API Mistral',
    keyHint: '…',
    keyUrl: 'https://console.mistral.ai/api-keys',
    defaultModel: 'mistral-large-latest'
  },
  openrouter: {
    key: 'openrouter',
    name: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    keyLabel: 'Clé API OpenRouter',
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    defaultModel: 'anthropic/claude-opus-5',
    note: 'Passerelle : un seul compte, les modèles de plusieurs fournisseurs.'
  },
  custom: {
    key: 'custom',
    name: 'Autre service compatible OpenAI',
    base: '',
    keyLabel: 'Clé API du service',
    keyHint: '…',
    keyUrl: '',
    defaultModel: '',
    custom: true,
    note: "Indique l'URL de base du service (elle doit exposer /models et /chat/completions)."
  }
};

export const providerOf = k => PROVIDERS[k] || PROVIDERS.anthropic;
export const suggestedModels = k => SUGGEST[k] || [];

/* ---------- configuration mémorisée ---------- */

export const AI_BLANK = {
  provider: 'anthropic',
  apiKey: '',
  baseUrl: '',
  model: '',
  models: [],
  checkedAt: 0
};

export const getAI = async () => ({ ...AI_BLANK, ...(await getKV('ai', {})) });
export const saveAI = cfg => setKV('ai', { ...AI_BLANK, ...cfg });
export const clearAI = () => setKV('ai', { ...AI_BLANK });

export const isReady = cfg => !!(cfg && cfg.apiKey && cfg.model);

/* Ne jamais afficher ni journaliser la clé en clair. */
export const maskKey = k => {
  const s = String(k || '');
  if (!s) return '';
  return s.length <= 10 ? '•'.repeat(s.length) : s.slice(0, 4) + '…' + s.slice(-4);
};

const baseOf = cfg => (cfg.baseUrl || providerOf(cfg.provider).base || '').replace(/\/+$/, '');

/* ---------- appels réseau ---------- */

/* Les erreurs sont remontées telles quelles, en français, sans jamais
   inclure la clé. Un échec CORS se présente comme un TypeError. */
async function req(url, init, what) {
  let r;
  try {
    r = await fetch(url, init);
  } catch (e) {
    throw new Error(`${what} : le navigateur n'a pas pu joindre le service `
      + `(réseau coupé, ou le fournisseur refuse les appels directs depuis une page web).`);
  }
  const txt = await r.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { /* réponse non JSON */ }
  if (!r.ok) {
    const msg = (data && (data.error?.message || data.message || data.error)) || `HTTP ${r.status}`;
    throw new Error(`${what} : ${typeof msg === 'string' ? msg : `HTTP ${r.status}`}`);
  }
  return data;
}

const headers = cfg => {
  const p = providerOf(cfg.provider);
  const h = { 'content-type': 'application/json' };
  if (p.key === 'anthropic') {
    h['x-api-key'] = cfg.apiKey;
    h['anthropic-version'] = '2023-06-01';
    /* Sans cet en-tête, l'API refuse les requêtes venant d'un navigateur. */
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  } else if (p.key === 'google') {
    h['x-goog-api-key'] = cfg.apiKey;
  } else {
    h.authorization = `Bearer ${cfg.apiKey}`;
  }
  return h;
};

/* Liste des modèles disponibles pour la clé fournie. */
export async function listModels(cfg) {
  const p = providerOf(cfg.provider);
  const base = baseOf(cfg);
  if (!cfg.apiKey) throw new Error('Aucune clé API enregistrée.');
  if (!base) throw new Error("Aucune URL de base : renseigne l'adresse du service.");
  const what = 'Liste des modèles';

  if (p.key === 'anthropic') {
    const d = await req(`${base}/v1/models?limit=100`, { headers: headers(cfg) }, what);
    return (d.data || []).map(m => ({ id: m.id, label: m.display_name || m.id }));
  }
  if (p.key === 'google') {
    const d = await req(`${base}/v1beta/models`, { headers: headers(cfg) }, what);
    return (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ id: String(m.name).replace(/^models\//, ''), label: m.displayName || m.name }));
  }
  const d = await req(`${base}/models`, { headers: headers(cfg) }, what);
  return (d.data || []).map(m => ({ id: m.id, label: m.name || m.id }));
}

/* Un échange court, utilisé par le bouton d'essai — et prêt à servir
   au reste de l'application. `messages` : [{ role, content }]. */
export async function chat(cfg, messages, opts = {}) {
  const p = providerOf(cfg.provider);
  const base = baseOf(cfg);
  const maxTokens = opts.maxTokens || 256;
  if (!cfg.apiKey) throw new Error('Aucune clé API enregistrée.');
  if (!cfg.model) throw new Error('Aucun modèle choisi.');
  const what = 'Message';

  if (p.key === 'anthropic') {
    const body = {
      model: cfg.model,
      max_tokens: maxTokens,
      messages: messages.filter(m => m.role !== 'system')
    };
    const sys = messages.find(m => m.role === 'system');
    if (sys) body.system = sys.content;
    const d = await req(`${base}/v1/messages`,
      { method: 'POST', headers: headers(cfg), body: JSON.stringify(body) }, what);
    if (d.stop_reason === 'refusal') throw new Error('Le modèle a refusé de répondre à cette demande.');
    return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }

  if (p.key === 'google') {
    const sys = messages.find(m => m.role === 'system');
    const body = {
      contents: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: { maxOutputTokens: maxTokens }
    };
    if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
    const d = await req(`${base}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
      { method: 'POST', headers: headers(cfg), body: JSON.stringify(body) }, what);
    const c = (d.candidates || [])[0];
    return ((c && c.content && c.content.parts) || []).map(x => x.text || '').join('').trim();
  }

  const d = await req(`${base}/chat/completions`, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: maxTokens })
  }, what);
  const ch = (d.choices || [])[0];
  return ((ch && ch.message && ch.message.content) || '').trim();
}
