// Seed default system categories. Idempotent.
//   Usage: npm run seed

require('./_loadenv')({ verbose: true });

const mongoose = require('mongoose');
const connectDB = require('../lib/db');
const { DEFAULT_CATEGORIES } = require('../lib/config/constants');
const Category = require('../lib/models/Category');
const logger = require('../lib/utils/logger');

const run = async () => {
  await connectDB();

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const def = DEFAULT_CATEGORIES[i];
    const existing = await Category.findOne({
      user: null,
      isDefault: true,
      name: def.name,
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await Category.create({
      user: null,
      isDefault: true,
      name: def.name,
      icon: def.icon,
      color: def.color,
      sortOrder: i,
    });
    created += 1;
  }

  logger.info(`Seed complete — created ${created}, skipped ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error('Seed failed', { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
