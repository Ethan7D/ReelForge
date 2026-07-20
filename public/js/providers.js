/* ===========================================================================
   ReelForge -- 供应商单一真源（2025-2026 主流大模型全量版）
   所有页面（API 接入中心 / 工作台模型下拉）共用同一份供应商列表，
   保证「API 接入页」与「工作台选择模型」永远一致、可联动。
   修改供应商/模型只需改这里。

   caps = 该供应商所有模型的并集能力标签，用于工作台按步骤筛选：
     text  → 剧本/人物/分镜步骤可用
     image → 人物/分镜步骤可用
     video → 视频制作步骤可用
   个别模型的精确能力由 studio.js 的 MODEL_CAPS 覆盖。
   =========================================================================== */
window.ReelForgeProviders = [

  // ======== 文本大模型（海外） ========
  { id: 'openai',     label: 'OpenAI',                icon: '🤖', base: 'https://api.openai.com/v1',                                models: 'GPT‑4o, GPT‑4.1, GPT‑4.1-mini, o1, o3-mini, DALL·E 3', caps: ['text','image'] },
  { id: 'anthropic',  label: 'Anthropic Claude',       icon: '🧠', base: 'https://api.anthropic.com',                               models: 'Claude 4 Sonnet, Claude 3.5 Sonnet, Claude 3 Opus', caps: ['text'] },
  { id: 'google',     label: 'Google Gemini',          icon: '🌐', base: 'https://generativelanguage.googleapis.com/v1beta',         models: 'Gemini 2.5 Pro, Gemini 2.0 Flash, Gemma 3', caps: ['text','image'] },
  { id: 'mistral',    label: 'Mistral AI',             icon: '🌀', base: 'https://api.mistral.ai/v1',                             models: 'Mistral Large, Codestral, Pixtral 12B', caps: ['text'] },
  { id: 'xai',        label: 'xAI Grok',               icon: '⚡', base: 'https://api.x.ai/v1',                                    models: 'Grok 3, Grok 2', caps: ['text'] },

  // ======== 文本大模型（国内） ========
  { id: 'deepseek',   label: 'DeepSeek',               icon: '🔍', base: 'https://api.deepseek.com/v1',                            models: 'DeepSeek‑V3, DeepSeek‑R1, DeepSeek‑V3.2, Coder V2', caps: ['text'] },
  { id: 'qwen',       label: '阿里云 · 通义',            icon: '☁️', base: 'https://dashscope.aliyuncs.com',                       models: 'Qwen‑Max, Qwen‑Plus, Qwen‑VL‑Max, wanx2.1, wanx2.1‑t2v‑turbo, wanx2.1‑i2v‑turbo', caps: ['text','image','video'] },
  { id: 'zhipu',      label: '智谱 AI (GLM)',           icon: '🔬', base: 'https://open.bigmodel.cn/api/paas/v4',                  models: 'GLM‑5, GLM‑4 Plus, GLM‑4V, GLM‑4.7‑Flash, CogView‑4', caps: ['text','image','video'] },
  { id: 'moonshot',   label: 'Kimi / 月之暗面',          icon: '🌙', base: 'https://api.moonshot.cn/v1',                           models: 'Kimi K2.5, Kimi K2, moonshot-v1‑128k, moonshot-v1‑auto', caps: ['text'] },
  { id: 'doubao',     label: '豆包 / 字节火山引擎',       icon: '🫘', base: 'https://ark.cn-beijing.volces.com/api/v3',            models: 'Doubao‑pro‑32k, Doubao‑lite‑32k, Doubao‑seed‑1.6', caps: ['text','image','video'] },
  { id: 'baidu',      label: '百度千帆 (文心)',          icon: '🐻', base: 'https://qianfan.baidubce.com/v2',                      models: 'ERNIE 4.0, ERNIE Speed, ERNIE Lite, ERNIE 3.5', caps: ['text','image'] },
  { id: 'minimax',    label: 'MiniMax / 海螺 AI',        icon: '🐚', base: 'https://api.minimax.chat/v1',                          models: 'MiniMax‑Text‑01, abab‑6.5s-chat', caps: ['text','video'] },
  { id: 'tencent',    label: '腾讯混元',                 icon: '🐧', base: 'https://api.hunyuan.cloud.tencent.com/v1',              models: 'hunyuan‑pro, hunyuan‑lite, hunyuan‑vision', caps: ['text','image','video'] },
  { id: 'spark',      label: '讯飞星火',                 icon: '✨', base: 'https://spark-api.xfyun.cn/v1',                         models: 'Spark Lite, Spark Pro, Spark Max, Spark 4.0 Ultra', caps: ['text'] },

  // ======== 视频生成 ========
  { id: 'kling',      label: '可灵 AI（视频）',          icon: '🎬', base: 'https://api.klingai.com',                              models: 'kling‑v3, kling‑v2.6, kling‑video‑o1', caps: ['video'] },
  { id: 'jimeng',     label: '即梦 AI（视频）',          icon: '🎥', base: 'https://api.jimeng.jianying.com',                      models: '即梦 v1, 即梦 2.1', caps: ['video'] },
  { id: 'runway',     label: 'Runway Gen‑4/Gen‑3',      icon: '🏃', base: 'https://api.runwayml.com/v1',                          models: 'gen‑4, gen‑3‑turbo', caps: ['video'] },
  { id: 'vidu',       label: 'Vidu AI（视频）',          icon: '🎞️', base: 'https://api.vidu.ai',                                  models: 'vidu‑1, vidu‑1.5', caps: ['video'] },

  // ======== 聚合代理（多厂商统一入口） ========
  { id: 'siliconflow',label: '硅基流动 SiliconFlow',    icon: '💎', base: 'https://api.siliconflow.cn/v1',                       models: '聚合：Qwen/DeepSeek/GLM 等全系', caps: ['text','image','video'] },
  { id: 'openrouter', label: 'OpenRouter（聚合）',       icon: '🔗', base: 'https://openrouter.ai/api/v1',                        models: '聚合：GPT/Claude/Gemini 等数百款', caps: ['text','image','video'] },

  // ======== 自定义 ========
  { id: 'custom',     label: '自定义 / OpenAI 兼容',    icon: '⚙️', base: '',                                                    models: '请填写兼容 OpenAI 格式的 API 地址与模型名', caps: ['text','image','video'] },
];
