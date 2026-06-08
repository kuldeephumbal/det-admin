const budgetService = require('../../lib/services/budget.service');
const expenseService = require('../../lib/services/expense.service');
const Notification = require('../../lib/models/Notification');
const { ensureDb, makeUser, makeCategory } = require('../helpers');

beforeAll(ensureDb);

const currentMonthKey = () => {
  const d = new Date();
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
};

describe('budget.service', () => {
  describe('status', () => {
    it('reports usedPct/state correctly across ok/warning/over thresholds', async () => {
      const user = await makeUser();
      const cat = await makeCategory(user);

      const b = await budgetService.create(user._id, {
        category: null, period: 'monthly',
        year: new Date().getUTCFullYear(), month: currentMonthKey(),
        amount: 100, alertThreshold: 80,
      });

      // 30% — ok
      await expenseService.create(user._id, { amount: 30, category: cat._id, date: new Date() });
      let status = await budgetService.status(user._id);
      let item = status.items.find((i) => i.id === b.id);
      expect(item.used).toBe(30);
      expect(item.usedPct).toBeCloseTo(30);
      expect(item.state).toBe('ok');

      // 85% — warning
      await expenseService.create(user._id, { amount: 55, category: cat._id, date: new Date() });
      status = await budgetService.status(user._id);
      item = status.items.find((i) => i.id === b.id);
      expect(item.usedPct).toBeCloseTo(85);
      expect(item.state).toBe('warning');

      // 130% — over
      await expenseService.create(user._id, { amount: 45, category: cat._id, date: new Date() });
      status = await budgetService.status(user._id);
      item = status.items.find((i) => i.id === b.id);
      expect(item.state).toBe('over');
      expect(item.used).toBe(130);
      expect(item.remaining).toBe(0);
    });

    it('scopes per-category budgets to only that category', async () => {
      const user = await makeUser();
      const food = await makeCategory(user, { name: 'Food' });
      const fuel = await makeCategory(user, { name: 'Fuel' });

      const foodBudget = await budgetService.create(user._id, {
        category: food._id,
        period: 'monthly',
        year: new Date().getUTCFullYear(),
        month: currentMonthKey(),
        amount: 200,
      });

      await expenseService.create(user._id, { amount: 50, category: food._id, date: new Date() });
      await expenseService.create(user._id, { amount: 80, category: fuel._id, date: new Date() }); // not counted

      const status = await budgetService.status(user._id);
      const item = status.items.find((i) => i.id === foodBudget.id);
      expect(item.used).toBe(50);
    });
  });

  describe('checkAndAlert (fired by expense.service.create)', () => {
    it('creates a budget_alert notification when crossing threshold, only once', async () => {
      const user = await makeUser();
      const cat = await makeCategory(user);

      await budgetService.create(user._id, {
        category: null, period: 'monthly',
        year: new Date().getUTCFullYear(), month: currentMonthKey(),
        amount: 100, alertThreshold: 80,
      });

      // Cross threshold with a single 90 expense.
      await expenseService.create(user._id, { amount: 90, category: cat._id, date: new Date() });
      // The threshold check is fire-and-forget — wait one tick for it to finish.
      await new Promise((r) => setImmediate(r));

      let alerts = await Notification.find({ user: user._id, type: 'budget_alert' });
      expect(alerts).toHaveLength(1);

      // Another expense above threshold should NOT create a second alert.
      await expenseService.create(user._id, { amount: 5, category: cat._id, date: new Date() });
      await new Promise((r) => setImmediate(r));

      alerts = await Notification.find({ user: user._id, type: 'budget_alert' });
      expect(alerts).toHaveLength(1);
    });

    it('does not alert before the threshold is crossed', async () => {
      const user = await makeUser();
      const cat = await makeCategory(user);
      await budgetService.create(user._id, {
        category: null, period: 'monthly',
        year: new Date().getUTCFullYear(), month: currentMonthKey(),
        amount: 100, alertThreshold: 80,
      });
      await expenseService.create(user._id, { amount: 50, category: cat._id, date: new Date() });
      await new Promise((r) => setImmediate(r));
      const alerts = await Notification.find({ user: user._id, type: 'budget_alert' });
      expect(alerts).toHaveLength(0);
    });
  });
});
