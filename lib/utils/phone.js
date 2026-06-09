// Phone-number normalization for split-expenses contact matching.
// Returns the E.164 form (e.g. +919876543210) or null if unparseable.
// Default region is India (the app's primary market) so local-format
// numbers from a contact list normalize correctly.

const { parsePhoneNumberFromString } = require('libphonenumber-js');

const normalize = (raw, defaultCountry = 'IN') => {
  if (!raw) return null;
  try {
    const p = parsePhoneNumberFromString(String(raw).trim(), defaultCountry);
    return p && p.isValid() ? p.number : null; // E.164
  } catch (_) {
    return null;
  }
};

// Normalize a batch, returning a Map<rawInput, e164|null> so the caller
// can correlate matches back to the contact they came from.
const normalizeMany = (list = [], defaultCountry = 'IN') => {
  const out = new Map();
  for (const raw of list) out.set(raw, normalize(raw, defaultCountry));
  return out;
};

module.exports = { normalize, normalizeMany };
