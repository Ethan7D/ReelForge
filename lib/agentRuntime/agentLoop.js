'use strict';

const gateway = require('../modelGateway');

const ToolCallSchema = {
  type: 'object',
  properties: {
    final: { type: 'string' },
    tool_calls: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          args: { type: 'object' },
        },
        required: ['name', 'args'],
      },
    },
  },
};

async function runAgent({ systemPrompt, tools, messages, ctx = {}, maxTurns = 6, providerOptions = {} }) {
  const history = [
    { role: 'system', content: buildSystemPrompt(systemPrompt, tools) },
    ...messages,
  ];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const response = await gateway.structured(history, ToolCallSchema, providerOptions);
    const calls = Array.isArray(response.tool_calls) ? response.tool_calls : [];
    if (!calls.length) return { content: response.final || '', history };

    for (const call of calls) {
      const result = await tools.dispatch(call.name, call.args || {}, ctx);
      history.push({
        role: 'assistant',
        content: JSON.stringify({ tool_call: call }),
      });
      history.push({
        role: 'user',
        content: JSON.stringify({ tool_result: call.name, result }),
      });
    }
  }

  return { content: 'Agent reached maxTurns before final response.', history };
}

function buildSystemPrompt(systemPrompt, tools) {
  return [
    systemPrompt,
    'Available tools:',
    JSON.stringify(tools.getToolSchemas(), null, 2),
    'When a tool is needed, return {"tool_calls":[{"name":"...","args":{...}}]}',
    'When finished, return {"final":"..."}',
  ].join('\n\n');
}

module.exports = { runAgent };
