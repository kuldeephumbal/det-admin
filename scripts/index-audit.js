// Index audit. Walks every registered Mongoose model and prints its
// declared indexes alongside what's actually in Mongo. Helpful for
// catching drift between schema declarations and the live cluster.
//
//   npm run audit:indexes

require('./_loadenv')({ verbose: true });

const mongoose = require('mongoose');
const connectDB = require('../lib/db');
require('../lib/models'); // registers all models as a side effect

const main = async () => {
  await connectDB();

  const names = mongoose.modelNames().sort();
  console.log(`\n${names.length} models registered\n`);

  for (const name of names) {
    const model = mongoose.model(name);
    const declared = model.schema.indexes();
    let live = [];
    try {
      live = await model.collection.indexes();
    } catch (err) {
      console.warn(`  [${name}] could not read live indexes:`, err.message);
    }

    console.log('=='.repeat(28));
    console.log(`Model: ${name}   (collection: ${model.collection.name})`);
    console.log('--'.repeat(28));
    console.log(`Declared in schema (${declared.length}):`);
    if (declared.length === 0) console.log('  (none beyond _id)');
    for (const [keys, opts] of declared) {
      console.log('  ' + JSON.stringify({ keys, opts }));
    }
    console.log(`Live in Mongo (${live.length}):`);
    for (const idx of live) {
      const interesting = {
        name: idx.name,
        key: idx.key,
        ...(idx.unique && { unique: true }),
        ...(idx.partialFilterExpression && { partial: idx.partialFilterExpression }),
        ...(idx.expireAfterSeconds !== undefined && { ttl: idx.expireAfterSeconds }),
      };
      console.log('  ' + JSON.stringify(interesting));
    }
    console.log('');
  }

  await mongoose.disconnect();
  process.exit(0);
};

main().catch(async (err) => {
  console.error('index-audit failed:', err.message, err.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
