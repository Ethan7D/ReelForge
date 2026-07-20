'use strict';

const { dataPath, readJson, listJsonFiles } = require('../dataStore');

function packPath(packId) {
  const safeId = String(packId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return dataPath('template_packs', `${safeId}.json`);
}

function listTemplatePacks() {
  return listJsonFiles(dataPath('template_packs')).map((file) => {
    const pack = readJson(file);
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description || '',
      characterCount: Array.isArray(pack.characters) ? pack.characters.length : 0,
      sceneCount: Array.isArray(pack.scenes) ? pack.scenes.length : 0,
      scriptCount: Array.isArray(pack.scriptTemplates) ? pack.scriptTemplates.length : 0,
    };
  });
}

function getTemplatePack(packId) {
  return readJson(packPath(packId));
}

function registerTemplatePackTools(registry) {
  registry.registerTool({
    name: 'list_template_packs',
    description: 'List available ReelForge template packs.',
    input_schema: { type: 'object', properties: {} },
    handler: async () => ({ packs: listTemplatePacks() }),
  });

  registry.registerTool({
    name: 'get_template_pack',
    description: 'Read a full template pack including characters, scenes and script slots.',
    input_schema: {
      type: 'object',
      properties: { pack_id: { type: 'string' } },
      required: ['pack_id'],
    },
    handler: async ({ pack_id }) => getTemplatePack(pack_id),
  });
}

module.exports = {
  listTemplatePacks,
  getTemplatePack,
  registerTemplatePackTools,
};
