import { LLM } from './config.js';
import { db } from './db.js';

export class LlmError extends Error {}

export const modelFor = (agentId) => LLM.agentModels[agentId] || LLM.model;

async function request(model, messages, maxTokens) {
  try {
    return await fetch(`${LLM.url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LLM.key && { Authorization: `Bearer ${LLM.key}` }),
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: false }),
      signal: AbortSignal.timeout(LLM.timeoutMs),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'kelamaan, gak ada jawaban' : 'gak bisa disambungin';
    throw new LlmError(`9router ${reason} (${LLM.url}). Pastikan 9router jalan.`);
  }
}

export async function chat({ agentId, system, prompt, maxTokens = 4000 }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const wanted = modelFor(agentId);
  let res = await request(wanted, messages, maxTokens);
  // An agent's own model can run out of free quota; the office default keeps the work going.
  if (!res.ok && wanted !== LLM.model) res = await request(LLM.model, messages, maxTokens);

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new LlmError(`9router menolak (${res.status}): ${body}`);
  }

  // 9router answers with SSE for some providers even when stream is false.
  const isStream = (res.headers.get('content-type') || '').includes('event-stream');
  const { text, usage, model } = isStream ? readSse(await res.text()) : readJson(await res.json());

  if (usage) {
    db.prepare(`INSERT INTO llm_usage (agent_id, prompt_tokens, completion_tokens, model)
      VALUES (?, ?, ?, ?)`).run(agentId, usage.prompt_tokens || 0, usage.completion_tokens || 0, model || null);
  }

  const clean = stripThinking(text);
  if (!clean) throw new LlmError('Model balikin jawaban kosong.');
  return clean;
}

export async function chatJson(options) {
  const first = await chat(options);
  try {
    return extractJson(first);
  } catch {
    const retry = await chat({
      ...options,
      prompt: `${options.prompt}\n\nPENTING: jawab HANYA dengan satu objek JSON yang valid, tanpa teks lain.`,
    });
    return extractJson(retry);
  }
}

function readJson(body) {
  return {
    text: body.choices?.[0]?.message?.content ?? '',
    usage: body.usage,
    model: body.model,
  };
}

export function readSse(raw) {
  let text = '';
  let usage = null;
  let model = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      continue;
    }
    text += chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? '';
    usage = chunk.usage ?? usage;
    model = chunk.model ?? model;
  }
  return { text, usage, model };
}

export function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [text, fenced?.[1]];

  // Some free models narrate before the JSON, so fall back to the outermost braces.
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // try the next shape
    }
  }
  throw new LlmError('Jawaban model bukan JSON yang valid.');
}

// 9router's /api/health answers at once even when it's busy, so missing this means it's stuck.
// (/models lists every model, hundreds of them, and gets slow under load without anything wrong.)
const PROBE_TIMEOUT_MS = 15_000;

async function probe(url) {
  return fetch(url, {
    headers: LLM.key ? { Authorization: `Bearer ${LLM.key}` } : {},
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
}

async function probeHealth() {
  try {
    let res = await probe(`${LLM.url.replace(/\/v1$/, '')}/api/health`);
    // Another OpenAI-compatible gateway may not have the health route.
    if (res.status === 404) res = await probe(`${LLM.url}/models`);
    return { ok: res.ok, state: res.ok ? 'up' : 'error', url: LLM.url, model: LLM.model };
  } catch (err) {
    // A refused connection means 9router isn't running; a timeout means it's alive but stuck.
    const state = err.name === 'TimeoutError' ? 'slow' : 'down';
    return { ok: false, state, url: LLM.url, model: LLM.model };
  }
}

/**
 * What the office shows: one slow probe while 9router is busy is not an outage, so the
 * previous good result stands until the second slow probe in a row. "down" shows at once.
 */
export function nextHealth(previous, probe, slowStreak) {
  if (probe.state === 'slow' && slowStreak < 2 && previous?.ok) return previous;
  return probe;
}

// The office polls every few seconds, so it gets the last known result and a fresh probe
// runs in the background instead of every page load waiting on it.
const HEALTH_TTL_MS = 10_000;
let lastHealth = null;
let probing = null;
let slowStreak = 0;

export async function checkHealth() {
  if (lastHealth && Date.now() - lastHealth.at < HEALTH_TTL_MS) return lastHealth.result;
  probing ??= probeHealth().then((probe) => {
    slowStreak = probe.state === 'slow' ? slowStreak + 1 : 0;
    const result = nextHealth(lastHealth?.result, probe, slowStreak);
    lastHealth = { result, at: Date.now() };
    probing = null;
    return result;
  });
  // Right after a restart nothing is known yet; pages load now and the probe result shows on the next poll.
  return lastHealth ? lastHealth.result : { ok: false, state: 'checking', url: LLM.url, model: LLM.model };
}
