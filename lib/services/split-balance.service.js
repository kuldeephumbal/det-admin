// Balance derivation + debt simplification for split-expense groups.
//
// Balances are NEVER stored — they're derived from the recorded
// SplitExpense + Settlement rows so editing/deleting either stays
// correct with nothing to patch (matching Splitwise). All functions here
// are pure (no DB) and unit-tested.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 0.005; // half a cent

// Derive per-pair balances and per-person net balances from a group's
// expenses and settlements.
//
//   expenses:    [{ paidBy, splits: [{ user, owed }] }]
//   settlements: [{ from, to, amount }]
//
// Returns:
//   net:  { [userId]: number }   (+ = owed money / creditor, - = owes / debtor)
//   pairs:[{ from, to, amount }] (from owes `amount` to `to`, amount > 0)
const derive = (expenses = [], settlements = []) => {
  const net = {};
  const bump = (u, v) => { net[u] = round2((net[u] || 0) + v); };

  // who owes whom, keyed "debtor|creditor"
  const pair = {};
  const owe = (debtor, creditor, amt) => {
    if (debtor === creditor || amt === 0) return;
    const k = `${debtor}|${creditor}`;
    pair[k] = round2((pair[k] || 0) + amt);
  };

  for (const e of expenses) {
    const payer = String(e.paidBy);
    for (const s of e.splits || []) {
      const member = String(s.user);
      const owed = Number(s.owed) || 0;
      // The member consumed their share; the payer fronted the whole bill
      // (this share included). For the payer's OWN share the two bumps
      // cancel, so the payer nets +(total - their own share) = what others
      // owe them — which is the correct net.
      bump(member, -owed);
      bump(payer, owed);
      if (member !== payer) {
        owe(member, payer, owed); // member owes payer their share
      }
    }
  }

  for (const st of settlements) {
    const from = String(st.from);
    const to = String(st.to);
    const amt = Number(st.amount) || 0;
    // `from` paid `to` → from's debt shrinks, to is owed less.
    bump(from, amt);
    bump(to, -amt);
    owe(from, to, -amt); // reduce what from owes to
  }

  // Collapse reciprocal pair debts into a single net direction.
  const seen = new Set();
  const pairs = [];
  for (const k of Object.keys(pair)) {
    const [a, b] = k.split('|');
    if (seen.has(k) || seen.has(`${b}|${a}`)) continue;
    seen.add(k);
    const net1 = pair[`${a}|${b}`] || 0;
    const net2 = pair[`${b}|${a}`] || 0;
    const diff = round2(net1 - net2);
    if (diff > EPS) pairs.push({ from: a, to: b, amount: diff });
    else if (diff < -EPS) pairs.push({ from: b, to: a, amount: round2(-diff) });
  }

  // Drop dust from net.
  for (const u of Object.keys(net)) {
    if (Math.abs(net[u]) < EPS) net[u] = 0;
  }

  return { net, pairs };
};

// Greedy debt simplification: minimize the number of paybacks while
// preserving every person's net balance. Repeatedly match the largest
// creditor against the largest debtor. NP-hard to truly minimize; this
// greedy heuristic is fast and what Splitwise-style apps use.
//
//   net: { [userId]: number }
// Returns: [{ from, to, amount }]  (suggested payments)
const simplify = (net = {}) => {
  const creditors = [];
  const debtors = [];
  for (const [user, raw] of Object.entries(net)) {
    const v = round2(raw);
    if (v > EPS) creditors.push({ user, amt: v });
    else if (v < -EPS) debtors.push({ user, amt: round2(-v) });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const payments = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = round2(Math.min(d.amt, c.amt));
    if (pay > 0) payments.push({ from: d.user, to: c.user, amount: pay });
    d.amt = round2(d.amt - pay);
    c.amt = round2(c.amt - pay);
    if (d.amt <= EPS) i += 1;
    if (c.amt <= EPS) j += 1;
  }
  return payments;
};

module.exports = { derive, simplify, round2 };
