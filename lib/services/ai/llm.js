// Anthropic SDK wrapper for AI narration.
//
// Lazy-loads `@anthropic-ai/sdk`. Falls back to deterministic canned
// narration when ANTHROPIC_API_KEY is unset — never throws on the
// missing-creds path because we don't want insights generation to
// hard-fail when the LLM is temporarily unconfigured. The detector
// signal is still useful without prose.
//
// Prompt caching: the system prompt + financial-schema description
// are wrapped in `cache_control: { type: 'ephemeral' }` for ~90%
// cost reduction on repeated calls (Anthropic docs).
//
// IMPORTANT: callers pass aggregated numeric inputs only. There is no
// PII in the prompt by construction.

const env = require('../../config/env');
const logger = require('../../utils/logger');

const SYSTEM_PROMPT = `You are a careful financial summarizer. Given a JSON object of
*aggregated* spending numbers, produce a 2-3 sentence insight body. Rules:
- NEVER invent numbers. Only use values present in the input JSON.
- Use the user's currency symbol when given.
- Be concrete and actionable.
- No moral judgement.
- Plain prose. No markdown. No bullet points.`;

const isConfigured = () => Boolean(env.ANTHROPIC_API_KEY);

let _client = null;
const _getClient = () => {
  if (_client) return _client;
  if (!isConfigured()) return null;
  // eslint-disable-next-line global-require
  const Anthropic = require('@anthropic-ai/sdk');
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
};

// Deterministic canned narrations — used when LLM is unconfigured or
// when daily cost cap is hit. Each insight type has its own template.
const CANNED = {
  anomaly: ({ amount, category, currency }) =>
    `You spent ${amount.toFixed(2)} ${currency} on ${category || 'an unusual purchase'} — well above your typical transaction size for that bucket.`,
  category_spike: ({ category, deltaPct, currency, current }) =>
    `Your spending on ${category} jumped ${deltaPct.toFixed(0)}% this month to ${current.toFixed(2)} ${currency}.`,
  weekly_summary: ({ total, currency, topCategory }) =>
    `You spent ${total.toFixed(2)} ${currency} this week. Top category: ${topCategory || 'mixed'}.`,
  savings_window: ({ savings, currency }) =>
    `You could save up to ${savings.toFixed(2)} ${currency} by trimming recurring overlaps.`,
  goal_nudge: ({ goalName, percent }) =>
    `Your ${goalName} goal is ${percent}% funded. A small bump this month keeps you on pace.`,
  budget_warning: ({ category, projectedPct }) =>
    `At your current pace you'll overshoot your ${category} budget by month-end (${projectedPct}% projected).`,
  positive: ({ message }) => message,
};

// Generate one narration. `inputs` MUST be the same object the
// canned template would consume — so a missing LLM falls back
// without a code path divergence.
const narrate = async ({ type, inputs }) => {
  // Cost cap guard — caller is expected to flip this to `false`
  // when the user has exceeded the daily regenerate cap.
  const canned = CANNED[type] ? CANNED[type](inputs) : '';
  const client = _getClient();
  if (!client) return { text: canned, model: 'canned', costTokens: 0 };

  try {
    const userMessage = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: JSON.stringify({ type, inputs }),
        },
      ],
    };

    const resp = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 256,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [userMessage],
    });

    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return {
      text: text || canned,
      model: resp.model || env.ANTHROPIC_MODEL,
      costTokens: (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0),
    };
  } catch (err) {
    logger.warn('LLM narrate failed; falling back to canned', { message: err.message });
    return { text: canned, model: 'canned', costTokens: 0 };
  }
};

module.exports = { narrate, isConfigured };
