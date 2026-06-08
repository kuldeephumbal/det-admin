// Tiny zero-dependency .env loader. Reads .env.local first, then .env.
// Variables already in process.env win — matches Next.js precedence.
//
//   require('./_loadenv')();
//
// Supports: KEY=value, '#' comments, blank lines, surrounding "" or ''.
// Does NOT support: multi-line values, variable expansion ${OTHER}.
// We've never needed either; keep it simple.

const fs = require('fs');
const path = require('path');

const parse = (content) => {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const loadFrom = (cwd, filename) => {
  const p = path.resolve(cwd, filename);
  if (!fs.existsSync(p)) return null;
  const vars = parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(vars)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return filename;
};

const loadEnv = ({ cwd = process.cwd(), verbose = false } = {}) => {
  const loaded = [];
  for (const f of ['.env.local', '.env']) {
    if (loadFrom(cwd, f)) loaded.push(f);
  }
  if (verbose) {
    if (loaded.length) console.log(`✓ loaded env from ${loaded.join(', ')}`);
    else console.log('ℹ no .env / .env.local file found');
  }
  return loaded;
};

module.exports = loadEnv;
