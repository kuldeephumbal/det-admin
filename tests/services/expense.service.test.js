const expenseService = require('../../lib/services/expense.service');
const { ensureDb, makeUser, makeCategory, seedDefaultCategories } = require('../helpers');

beforeAll(ensureDb);

describe('expense.service', () => {
  describe('create', () => {
    it('persists an expense scoped to the user and populates the category', async () => {
      const user = await makeUser();
      const cat = await makeCategory(user, { name: 'Coffee', color: '#8D6E63' });

      const e = await expenseService.create(user._id, {
        amount: 12.5,
        category: cat._id,
        date: new Date(),
        note: 'latte',
        paymentMethod: 'card',
      });

      expect(e.amount).toBe(12.5);
      expect(e.category).toEqual(
        expect.objectContaining({ id: String(cat._id), name: 'Coffee', color: '#8D6E63' })
      );
    });

    it('refuses an expense pointing at someone else’s category', async () => {
      const a = await makeUser({ email: 'a@example.com' });
      const b = await makeUser({ email: 'b@example.com' });
      const bsCat = await makeCategory(b, { name: 'Private' });

      await expect(
        expenseService.create(a._id, {
          amount: 10,
          category: bsCat._id,
          date: new Date(),
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('accepts a system-default category', async () => {
      await seedDefaultCategories();
      const user = await makeUser();
      const Category = require('../../lib/models/Category');
      const food = await Category.findOne({ user: null, isDefault: true, name: 'Food' });

      const e = await expenseService.create(user._id, {
        amount: 5,
        category: food._id,
        date: new Date(),
      });
      expect(e.category.name).toBe('Food');
    });
  });

  describe('list', () => {
    it('paginates and filters by category', async () => {
      const user = await makeUser();
      const c1 = await makeCategory(user, { name: 'A' });
      const c2 = await makeCategory(user, { name: 'B' });

      for (let i = 0; i < 5; i++) await expenseService.create(user._id, {
        amount: 10 + i, category: c1._id, date: new Date(),
      });
      for (let i = 0; i < 3; i++) await expenseService.create(user._id, {
        amount: 50 + i, category: c2._id, date: new Date(),
      });

      const onlyA = await expenseService.list(user._id, { category: String(c1._id) });
      expect(onlyA.total).toBe(5);
      expect(onlyA.items.every((e) => e.category.id === String(c1._id))).toBe(true);

      const page1 = await expenseService.list(user._id, { page: 1, limit: 3 });
      expect(page1.items).toHaveLength(3);
      expect(page1.total).toBe(8);
    });

    it('escapes regex metacharacters in note search', async () => {
      const user = await makeUser();
      const cat = await makeCategory(user);
      await expenseService.create(user._id, { amount: 1, category: cat._id, date: new Date(), note: 'foo.bar' });
      await expenseService.create(user._id, { amount: 1, category: cat._id, date: new Date(), note: 'fooXbar' });

      const res = await expenseService.list(user._id, { search: 'foo.bar' });
      // Only the literal "foo.bar" should match — "fooXbar" should not.
      expect(res.total).toBe(1);
      expect(res.items[0].note).toBe('foo.bar');
    });

    it('does not surface other users’ expenses', async () => {
      const a = await makeUser({ email: 'a2@example.com' });
      const b = await makeUser({ email: 'b2@example.com' });
      const aCat = await makeCategory(a);
      const bCat = await makeCategory(b);
      await expenseService.create(a._id, { amount: 1, category: aCat._id, date: new Date() });
      await expenseService.create(b._id, { amount: 999, category: bCat._id, date: new Date() });

      const aSees = await expenseService.list(a._id, {});
      expect(aSees.total).toBe(1);
      expect(aSees.items[0].amount).toBe(1);
    });
  });

  describe('softDelete', () => {
    it('does not surface deleted expenses in subsequent lists', async () => {
      const user = await makeUser();
      const cat = await makeCategory(user);
      const e = await expenseService.create(user._id, { amount: 7, category: cat._id, date: new Date() });

      await expenseService.softDelete(user._id, e.id);
      const after = await expenseService.list(user._id, {});
      expect(after.total).toBe(0);
    });

    it('404s when deleting someone else’s expense', async () => {
      const a = await makeUser({ email: 'aa@example.com' });
      const b = await makeUser({ email: 'bb@example.com' });
      const cat = await makeCategory(a);
      const e = await expenseService.create(a._id, { amount: 1, category: cat._id, date: new Date() });

      await expect(expenseService.softDelete(b._id, e.id))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
