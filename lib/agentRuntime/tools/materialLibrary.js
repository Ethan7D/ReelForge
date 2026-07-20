'use strict';

const { dataPath, readJson, listJsonFiles } = require('../dataStore');

function libraryPath(libraryId) {
  const safeId = String(libraryId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return dataPath('material_libraries', `${safeId}.json`);
}

function listMaterialLibraries() {
  return listJsonFiles(dataPath('material_libraries')).map((file) => {
    const lib = readJson(file);
    return {
      id: lib.id,
      name: lib.name,
      itemCount: Array.isArray(lib.items) ? lib.items.length : 0,
    };
  });
}

function queryMaterialLibrary(libraryId) {
  const lib = readJson(libraryPath(libraryId));
  return {
    id: lib.id,
    name: lib.name,
    items: (lib.items || []).map((item) => ({
      id: item.id,
      type: item.type,
      text: item.text || '',
      image_path: item.image_path || null,
      tags: item.tags || [],
    })),
  };
}

function registerMaterialLibraryTools(registry) {
  registry.registerTool({
    name: 'list_material_libraries',
    description: 'List available user material libraries.',
    input_schema: { type: 'object', properties: {} },
    handler: async () => ({ libraries: listMaterialLibraries() }),
  });

  registry.registerTool({
    name: 'query_material_library',
    description: 'Read a material library and return id/type/text/tags for matching.',
    input_schema: {
      type: 'object',
      properties: { library_id: { type: 'string' } },
      required: ['library_id'],
    },
    handler: async ({ library_id }) => queryMaterialLibrary(library_id),
  });
}

module.exports = {
  listMaterialLibraries,
  queryMaterialLibrary,
  registerMaterialLibraryTools,
};
