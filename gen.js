'use strict';
// ReelForge — 视频生成适配层（供应商中立骨架）
// 当前适配：通义万相（阿里云百炼 DashScope）文生视频
// Key 优先级：调用时传入的 opts.apiKey（用户在「API 接入」页配置并设为默认）> 环境变量 REELFORGE_VIDEO_API_KEY

const ENV_KEY = process.env.REELFORGE_VIDEO_API_KEY || '';
const ENV_MODEL = process.env.REELFORGE_VIDEO_MODEL || 'wanx2.1-t2v-turbo';

// 视频类供应商：在「API 接入」页配置后可用于「一键生成」
const VIDEO_PROVIDERS = ['wanx', 'qwen', 'kling', 'jimeng', 'custom'];

// 当前仅通义万相（dashscope）实现了完整协议；其它视频供应商会复用 dashscope 端点
// （用户可在「API 接入」填写正确的 base_url 覆盖主域，后续可逐家补齐协议）。
function isConfigured(userKey) {
  return !!(userKey || ENV_KEY);
}

// 依据 baseUrl 推导通义万相的提交 / 任务端点
function dashscopeEndpoints(baseUrl) {
  let host = 'https://dashscope.aliyuncs.com';
  if (baseUrl) {
    try { host = new URL(baseUrl).origin; }
    catch (e) { host = baseUrl.replace(/\/+$/, ''); }
  }
  return {
    submitUrl: host + '/api/v1/services/aigc/video-generation/video-generation',
    taskUrl: host + '/api/v1/tasks/',
  };
}

// 提交一个文生视频任务，返回 { taskId, provider }
// opts: { apiKey, baseUrl, model, duration, resolution }
async function submitTextToVideo(prompt, opts = {}) {
  const apiKey = opts.apiKey || ENV_KEY;
  if (!apiKey) throw new Error('NO_API_KEY');
  const model = opts.model || ENV_MODEL;
  const { submitUrl } = dashscopeEndpoints(opts.baseUrl);
  const body = {
    model: model,
    input: { prompt: prompt },
    parameters: {
      duration: opts.duration || 5,
      resolution: opts.resolution || '1280*720',
    },
  };
  const resp = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('SUBMIT_FAILED:' + resp.status + ' ' + txt);
  }
  const data = await resp.json();
  const taskId = data.output && data.output.task_id;
  if (!taskId) throw new Error('NO_TASK_ID:' + JSON.stringify(data));
  return { taskId, provider: 'dashscope' };
}

// 查询任务状态，返回 { status, videoUrl }
// DashScope 状态：PENDING / RUNNING / SUCCEEDED / FAILED
async function queryTask(taskId, opts = {}) {
  const apiKey = opts.apiKey || ENV_KEY;
  if (!apiKey) throw new Error('NO_API_KEY');
  const { taskUrl } = dashscopeEndpoints(opts.baseUrl);
  const resp = await fetch(taskUrl + taskId, {
    headers: { Authorization: 'Bearer ' + apiKey },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('QUERY_FAILED:' + resp.status + ' ' + txt);
  }
  const data = await resp.json();
  const st = (data.output && data.output.task_status) || 'PENDING';
  const statusMap = { PENDING: 'queued', RUNNING: 'rendering', SUCCEEDED: 'done', FAILED: 'failed' };
  let videoUrl = null;
  const results = data.output && data.output.results;
  if (Array.isArray(results) && results[0]) {
    videoUrl = results[0].url || results[0].video_url || null;
  }
  return { status: statusMap[st] || 'queued', videoUrl };
}

module.exports = { isConfigured, submitTextToVideo, queryTask, VIDEO_PROVIDERS, provider: 'dashscope' };
