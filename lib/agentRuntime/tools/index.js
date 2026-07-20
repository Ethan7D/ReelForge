'use strict';

const { ToolRegistry } = require('../toolRegistry');
const { registerMaterialLibraryTools } = require('./materialLibrary');
const { registerTemplatePackTools } = require('./templatePack');
const { registerAssemblyTools } = require('./assembly');

function createDefaultRegistry() {
  const registry = new ToolRegistry();
  registerMaterialLibraryTools(registry);
  registerTemplatePackTools(registry);
  registerAssemblyTools(registry);
  return registry;
}

module.exports = { createDefaultRegistry };
