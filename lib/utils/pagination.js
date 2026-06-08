const { PAGINATION } = require('../config/constants');

const parsePagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT;
  limit = Math.min(Math.max(1, limit), PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const parseSort = (sort, allowed, fallback = { createdAt: -1 }) => {
  if (!sort || typeof sort !== 'string') return fallback;
  const out = {};
  for (const part of sort.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const dir = trimmed.startsWith('-') ? -1 : 1;
    const key = trimmed.replace(/^[-+]/, '');
    if (allowed.includes(key)) out[key] = dir;
  }
  return Object.keys(out).length ? out : fallback;
};

// Convert URLSearchParams to a plain object (handles repeated keys → array).
const searchParamsToObject = (sp) => {
  const out = {};
  for (const [k, v] of sp.entries()) {
    if (out[k] === undefined) out[k] = v;
    else if (Array.isArray(out[k])) out[k].push(v);
    else out[k] = [out[k], v];
  }
  return out;
};

module.exports = { parsePagination, parseSort, searchParamsToObject };
