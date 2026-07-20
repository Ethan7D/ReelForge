'use strict';

const openaiProvider = require('./modelGateway/openai');
const ollamaProvider = require('./modelGateway/ollama');

class ModelGateway {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = process.env.DEFAULT_MODEL_PROVIDER || process.env.REELFORGE_MODEL_PROVIDER || 'openai';
    this.registerProvider('openai', openaiProvider);
    this.registerProvider('ollama', ollamaProvider);
  }

  registerProvider(name, providerImpl) {
    if (!name || !providerImpl) return;
    this.providers.set(name, providerImpl);
  }

  setDefault(providerName) {
    if (this.providers.has(providerName)) this.defaultProvider = providerName;
  }

  getProvider(name) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Unknown model provider: ${providerName}`);
    return provider;
  }

  async chat(messages, opts = {}) {
    const provider = this.getProvider(opts.provider);
    return provider.chat(messages, opts);
  }

  async structured(messages, jsonSchema, opts = {}) {
    const provider = this.getProvider(opts.provider);
    const content = await provider.structured(messages, jsonSchema, opts);
    if (typeof content === 'object' && content !== null) return content;
    return parseJsonContent(content);
  }
}

function parseJsonContent(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Model returned empty structured content');
  }
  const direct = content.trim();
  try {
    return JSON.parse(direct);
  } catch (_err) {
    const fenced = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const start = direct.indexOf('{');
    const end = direct.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(direct.slice(start, end + 1));
    throw _err;
  }
}

module.exports = new ModelGateway();
module.exports.ModelGateway = ModelGateway;
