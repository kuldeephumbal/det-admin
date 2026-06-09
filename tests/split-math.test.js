const { computeSplits } = require('../lib/services/split-expense.service');
const { derive, simplify } = require('../lib/services/split-balance.service');

const sumOwed = (rows) => Math.round(rows.reduce((a, r) => a + r.owed, 0) * 100) / 100;

describe('computeSplits', () => {
  test('equal split distributes the remainder cent', () => {
    const rows = computeSplits('equal', 10, { participants: ['a', 'b', 'c'] });
    expect(rows).toHaveLength(3);
    expect(sumOwed(rows)).toBe(10);
    expect(rows[0].owed).toBeCloseTo(3.34, 2);
    expect(rows[1].owed).toBeCloseTo(3.33, 2);
  });

  test('exact split must sum to the total', () => {
    expect(() =>
      computeSplits('exact', 10, { splits: [{ user: 'a', value: 6 }, { user: 'b', value: 3 }] })
    ).toThrow();
    const rows = computeSplits('exact', 10, { splits: [{ user: 'a', value: 6 }, { user: 'b', value: 4 }] });
    expect(sumOwed(rows)).toBe(10);
  });

  test('percentage must sum to 100 and allocate exactly', () => {
    expect(() =>
      computeSplits('percentage', 100, { splits: [{ user: 'a', value: 50 }, { user: 'b', value: 40 }] })
    ).toThrow();
    const rows = computeSplits('percentage', 100, {
      splits: [{ user: 'a', value: 50 }, { user: 'b', value: 30 }, { user: 'c', value: 20 }],
    });
    expect(sumOwed(rows)).toBe(100);
  });

  test('shares allocate proportionally and sum exactly', () => {
    const rows = computeSplits('shares', 100, {
      splits: [{ user: 'a', value: 2 }, { user: 'b', value: 1 }, { user: 'c', value: 1 }],
    });
    expect(sumOwed(rows)).toBe(100);
    expect(rows.find((r) => r.user === 'a').owed).toBeCloseTo(50, 2);
  });

  test('uneven percentage still sums exactly (no lost cents)', () => {
    const rows = computeSplits('percentage', 100, {
      splits: [{ user: 'a', value: 33.33 }, { user: 'b', value: 33.33 }, { user: 'c', value: 33.34 }],
    });
    expect(sumOwed(rows)).toBe(100);
  });
});

describe('derive + simplify', () => {
  test('equal expense yields correct nets and per-pair debts', () => {
    const expenses = [{ paidBy: 'A', splits: [{ user: 'A', owed: 30 }, { user: 'B', owed: 30 }, { user: 'C', owed: 30 }] }];
    const { net, pairs } = derive(expenses, []);
    expect(net.A).toBeCloseTo(60, 2);
    expect(net.B).toBeCloseTo(-30, 2);
    expect(net.C).toBeCloseTo(-30, 2);
    expect(pairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'B', to: 'A', amount: 30 }),
        expect.objectContaining({ from: 'C', to: 'A', amount: 30 }),
      ])
    );
  });

  test('simplify preserves nets and zeroes everyone out', () => {
    const net = { A: 60, B: -30, C: -30 };
    const payments = simplify(net);
    const after = { ...net };
    for (const p of payments) { after[p.from] += p.amount; after[p.to] -= p.amount; }
    for (const k of Object.keys(after)) expect(Math.abs(after[k])).toBeLessThan(0.01);
    expect(payments).toHaveLength(2);
  });

  test('a settlement reduces the balance to zero', () => {
    const expenses = [{ paidBy: 'A', splits: [{ user: 'A', owed: 50 }, { user: 'B', owed: 50 }] }];
    const { net } = derive(expenses, [{ from: 'B', to: 'A', amount: 50 }]);
    expect(Math.abs(net.A)).toBeLessThan(0.01);
    expect(Math.abs(net.B)).toBeLessThan(0.01);
  });

  test('chained debts simplify to a single direct payment (A→C)', () => {
    const expenses = [
      { paidBy: 'B', splits: [{ user: 'A', owed: 20 }] }, // A owes B 20
      { paidBy: 'C', splits: [{ user: 'B', owed: 20 }] }, // B owes C 20
    ];
    const { net } = derive(expenses, []);
    expect(net.A).toBeCloseTo(-20, 2);
    expect(Math.abs(net.B || 0)).toBeLessThan(0.01);
    expect(net.C).toBeCloseTo(20, 2);
    const payments = simplify(net);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ from: 'A', to: 'C', amount: 20 });
  });
});
