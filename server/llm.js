import { LLM } from './config.js';
import { db } from './db.js';

export class LlmError extends Error {}

export async function chat({ agentId, system, prompt, maxTokens = 4000 }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  let res;
  try {
    res = await fetch(`${LLM.url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LLM.key && { Authorization: `Bearer ${LLM.key}` }),
      },
      body: JSON.stringify({ model: LLM.model, messages, max_tokens: maxTokens, stream: false }),
      signal: AbortSignal.timeout(LLM.timeoutMs),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'kelamaan, gak ada jawaban' : 'gak bisa disambungin';
    throw new LlmError(`9router ${reason} (${LLM.url}). Pastikan 9router jalan.`);
  }

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

async function probeHealth() {
  try {
    const res = await fetch(`${LLM.url}/models`, {
      headers: LLM.key ? { Authorization: `Bearer ${LLM.key}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, url: LLM.url, model: LLM.model };
  } catch {
    return { ok: false, url: LLM.url, model: LLM.model };
  }
}

// 9router sometimes takes several seconds to answer while it is busy with a request.
// The office polls every few seconds, so it gets the last known result and a fresh probe
// runs in the background instead of every page load waiting on it.
const HEALTH_TTL_MS = 10_000;
let lastHealth = null;
let probing = null;

export async function checkHealth() {
  if (lastHealth && Date.now() - lastHealth.at < HEALTH_TTL_MS) return lastHealth.result;
  probing ??= probeHealth().then((result) => {
    lastHealth = { result, at: Date.now() };
    probing = null;
    return result;
  });
  return lastHealth ? lastHealth.result : probing;
}
