'use strict';

function endpoint(opts = {}) {
  return (opts.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '') + '/api/chat';
}

function model(opts = {}) {
  return opts.model || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
}

async function chat(messages, opts = {}) {
  const res = await fetch(endpoint(opts), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: model(opts),
      messages,
      stream: false,
      options: { temperature: opts.temperature ?? 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama provider failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.message?.content || '';
}

async function structured(messages, schema, opts = {}) {
  const system = {
    role: 'system',
    content: '只输出符合下列 JSON schema 的合法 JSON，不要输出 Markdown。\n' + JSON.stringify(schema),
  };
  return chat([system, ...messages], { ...opts, temperature: opts.temperature ?? 0 });
}

module.exports = { chat, structured };
