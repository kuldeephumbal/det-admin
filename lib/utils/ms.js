// Tiny ms-string parser: '15m', '30d', '2h', '45s'.
// Sufficient for our env values; avoids the extra dependency.
const parseMs = (str) => {
  const m = /^(\d+)([smhd])$/.exec(String(str).trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
};

module.exports = parseMs;
module.exports.parseMs = parseMs;
