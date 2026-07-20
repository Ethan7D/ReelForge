'use strict';

class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  registerTool(def) {
    if (!def || !def.name || typeof def.handler !== 'function') {
      throw new Error('Invalid tool definition');
    }
    this.tools.set(def.name, def);
  }

  getToolSchemas() {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.input_schema || { type: 'object', properties: {} },
    }));
  }

  async dispatch(name, args = {}, ctx = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.handler(args, ctx);
  }
}

module.exports = { ToolRegistry };
