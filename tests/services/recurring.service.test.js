const recurring = require('../../lib/services/recurring.service');
const Expense = require('../../lib/models/Expense');
const { ensureDb, makeUser, makeCategory } = require('../helpers');

beforeAll(ensureDb);

describe('recurring.service.advance', () => {
  it('advances daily', () => {
    const next = recurring.advance(new Date(Date.UTC(2026, 4, 1)), { frequency: 'daily', interval: 1 });
    expect(next.toISOString().startsWith('2026-05-02')).toBe(true);
  });

  it('advances weekly with interval', () => {
    const next = recurring.advance(new Date(Date.UTC(2026, 4, 1)), { frequency: 'weekly', interval: 2 });
    expect(next.toISOString().startsWith('2026-05-15')).toBe(true);
  });

  it('advances monthly and clamps the day for short months', () => {
    // Jan 31 → Feb 28 (2026 is not a leap year)
    const next = recurring.advance(
      new Date(Date.UTC(2026, 0, 31)),
      { frequency: 'monthly', interval: 1, dayOfMonth: 31 }
    );
    expect(next.toISOString().startsWith('2026-02-28')).toBe(true);
  });

  it('advances yearly', () => {
    const next = recurring.advance(new Date(Date.UTC(2026, 0, 1)), { frequency: 'yearly', interval: 1 });
    expect(next.toISOString().startsWith('2027-01-01')).toBe(true);
  });
});

describe('recurring.service.runDueNow', () => {
  it('materializes catch-up occurrences and advances nextRunAt past now', async () => {
    await ensureDb();
    const user = await makeUser();
    const cat = await makeCategory(user, { name: 'Subs' });

    // Start 90 days ago, daily — should catch up to today.
    const start = new Date(Date.now() - 90 * 86400_000);

    const created = await recurring.create(user._id, {
      title: 'Newspaper',
      amount: 1,
      category: cat._id,
      frequency: 'daily',
      interval: 1,
      paymentMethod: 'cash',
      startDate: start,
    });

    const result = await recurring.runDueNow({ now: new Date() });
    expect(result.expensesCreated).toBeGreaterThan(50); // 50 cap per row
    expect(result.recurringProcessed).toBeGreaterThan(0);

    const rows = await Expense.find({ user: user._id, recurringSource: created.id });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e) => String(e.recurringSource) === String(created.id))).toBe(true);
  });

  it('deactivates after maxOccurrences', async () => {
    const user = await makeUser({ email: 'mo@example.com' });
    const cat = await makeCategory(user);
    await recurring.create(user._id, {
      title: 'Capped',
      amount: 1,
      category: cat._id,
      frequency: 'daily',
      interval: 1,
      paymentMethod: 'cash',
      startDate: new Date(Date.now() - 30 * 86400_000),
      maxOccurrences: 3,
    });

    await recurring.runDueNow({ now: new Date() });
    const list = await recurring.list(user._id, { activeOnly: false });
    expect(list[0].occurrenceCount).toBe(3);
    expect(list[0].isActive).toBe(false);
    const expenses = await Expense.find({ user: user._id });
    expect(expenses).toHaveLength(3);
  });
});
