'use strict';

function apiKey(opts = {}) {
  return opts.apiKey || process.env.OPENAI_API_KEY || process.env.REELFORGE_OPENAI_API_KEY;
}

function endpoint(opts = {}) {
  const base = opts.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  return base.replace(/\/+$/, '') + '/chat/completions';
}

function model(opts = {}) {
  return opts.model || process.env.OPENAI_MODEL || process.env.REELFORGE_MODEL || 'gpt-4.1-mini';
}

async function chat(messages, opts = {}) {
  const key = apiKey(opts);
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  const res = await fetch(endpoint(opts), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model(opts),
      messages,
      temperature: opts.temperature ?? 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible provider failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function structured(messages, schema, opts = {}) {
  const system = {
    role: 'system',
    content: 'Return only valid JSON that matches this schema. No markdown.\n' + JSON.stringify(schema),
  };
  return chat([system, ...messages], { ...opts, temperature: opts.temperature ?? 0 });
}

module.exports = { chat, structured };
