'use strict';

function buildAssemblyPrompt(pack, library) {
  return [
    '你是 ReelForge 的素材装配智能体。',
    '请根据模板包中的角色、场景和脚本槽位，把素材库中的真实素材 id 装配到最合适的位置。',
    '约束：bindings 只能引用素材库真实存在的 materialId；无法匹配时放入 unmatched 并给出补拍或补充建议。',
    '',
    'TemplatePack:',
    JSON.stringify(pack, null, 2),
    '',
    'MaterialLibrary:',
    JSON.stringify(library, null, 2),
  ].join('\n');
}

module.exports = { buildAssemblyPrompt };
