// Unit tests for savings.service.
//
// Covers:
//   - free-tier 1-active-goal cap (plan §5 monetization)
//   - contribute → currentAmount stays in sync via _recomputeCurrentAmount
//   - goal completion transitions status + halts auto-contribution
//   - status() linear projection math
//   - auto-contribution cron picks up due rules

const { ensureDb, makeUser } = require('../helpers');
const savings = require('../../lib/services/savings.service');
const { SavingsGoal } = require('../../lib/models/SavingsGoal');
const { GoalContribution } = require('../../lib/models/GoalContribution');
const User = require('../../lib/models/User');
const { SUBSCRIPTION_PLANS } = require('../../lib/config/constants');

beforeAll(ensureDb);

const futureDate = (days) => new Date(Date.now() + days * 86400_000);

describe('savings.service.create', () => {
  it('caps free users at 1 active goal', async () => {
    const user = await makeUser({ email: 's-cap@example.com' });
    await savings.create(String(user._id), {
      name: 'Emergency fund',
      targetAmount: 50000,
      deadline: futureDate(180),
    });

    await expect(
      savings.create(String(user._id), {
        name: 'Vacation',
        targetAmount: 20000,
        deadline: futureDate(120),
      })
    ).rejects.toMatchObject({ code: 'PLAN_REQUIRED' });
  });

  it('allows premium users to create unlimited goals', async () => {
    const user = await makeUser({
      email: 's-premium@example.com',
      plan: SUBSCRIPTION_PLANS.PREMIUM,
    });
    for (let i = 0; i < 3; i++) {
      await savings.create(String(user._id), {
        name: `Goal ${i}`,
        targetAmount: 1000,
        deadline: futureDate(60),
      });
    }
    const items = await savings.list(String(user._id));
    expect(items.length).toBe(3);
  });

  it('stamps nextRunAt on auto-contribution rule', async () => {
    const user = await makeUser({ email: 's-auto@example.com' });
    const goal = await savings.create(String(user._id), {
      name: 'Weekly piggy',
      targetAmount: 1000,
      deadline: futureDate(365),
      contributionRule: {
        frequency: 'weekly',
        interval: 1,
        amount: 100,
      },
    });
    expect(goal.contributionRule).toBeTruthy();
    expect(new Date(goal.contributionRule.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('savings.service.contribute', () => {
  it('keeps currentAmount in lockstep with contributions', async () => {
    const user = await makeUser({ email: 's-contrib@example.com' });
    const goal = await savings.create(String(user._id), {
      name: 'Bike',
      targetAmount: 30000,
      deadline: futureDate(90),
    });

    await savings.contribute(String(user._id), goal.id, { amount: 500 });
    await savings.contribute(String(user._id), goal.id, { amount: 1500 });
    await savings.contribute(String(user._id), goal.id, { amount: -200 }); // withdrawal

    const reloaded = await SavingsGoal.findById(goal.id).lean();
    expect(reloaded.currentAmount).toBe(1800);
    expect(await GoalContribution.countDocuments({ goal: goal.id })).toBe(3);
  });

  it('completes a goal when target is met and stops auto-contribution', async () => {
    const user = await makeUser({ email: 's-complete@example.com' });
    const goal = await savings.create(String(user._id), {
      name: 'Phone',
      targetAmount: 1000,
      deadline: futureDate(60),
      contributionRule: { frequency: 'monthly', interval: 1, amount: 500 },
    });

    await savings.contribute(String(user._id), goal.id, { amount: 1000 });
    const reloaded = await SavingsGoal.findById(goal.id).lean();
    expect(reloaded.status).toBe('completed');
    expect(reloaded.completedAt).toBeInstanceOf(Date);
    expect(reloaded.contributionRule).toBeNull();
  });

  it('rejects contributions to a non-active goal', async () => {
    const user = await makeUser({ email: 's-rej@example.com' });
    const goal = await savings.create(String(user._id), {
      name: 'Stale',
      targetAmount: 100,
      deadline: futureDate(30),
    });
    await SavingsGoal.updateOne({ _id: goal.id }, { $set: { status: 'abandoned' } });
    await expect(
      savings.contribute(String(user._id), goal.id, { amount: 10 })
    ).rejects.toThrow(/abandoned/);
  });
});

describe('savings.service.status', () => {
  it('projects on-track when daily contributions cover the remaining target', async () => {
    const user = await makeUser({ email: 's-status@example.com' });
    const goal = await savings.create(String(user._id), {
      name: 'Steady',
      targetAmount: 1000,
      deadline: futureDate(20),
    });
    // Backdate three ₹100 contributions across the last 30 days — actual
    // daily rate ≈ 10. Remaining is 700 over 20 days = required 35/day.
    // So we're NOT on track at that rate.
    for (const dayOffset of [1, 10, 20]) {
      await savings.contribute(String(user._id), goal.id, {
        amount: 100,
        occurredAt: new Date(Date.now() - dayOffset * 86400_000),
      });
    }
    const s = await savings.status(String(user._id), goal.id);
    expect(s.currentAmount).toBe(300);
    expect(s.percent).toBe(30);
    expect(s.daysRemaining).toBe(20);
    expect(s.dailyRateRequired).toBeGreaterThan(s.dailyRateActual);
    expect(s.onTrack).toBe(false);
  });
});

describe('savings.service.runAutoContributions', () => {
  it('materializes due rules and advances nextRunAt', async () => {
    const user = await makeUser({ email: 's-auto-run@example.com' });
    const goal = await savings.create(String(user._id), {
      name: 'Drip',
      targetAmount: 10000,
      deadline: futureDate(365),
      contributionRule: { frequency: 'daily', interval: 1, amount: 50 },
    });
    // Force the rule to be due now.
    await SavingsGoal.updateOne(
      { _id: goal.id },
      { $set: { 'contributionRule.nextRunAt': new Date(Date.now() - 86400_000) } }
    );

    const result = await savings.runAutoContributions();
    expect(result.contributionsCreated).toBeGreaterThanOrEqual(1);

    const reloaded = await SavingsGoal.findById(goal.id).lean();
    expect(reloaded.currentAmount).toBeGreaterThanOrEqual(50);
    expect(reloaded.contributionRule.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });
});
