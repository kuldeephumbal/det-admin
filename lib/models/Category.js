const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: [true, 'Category name is required'], trim: true, minlength: 1, maxlength: 40 },
    icon: { type: String, default: 'category', trim: true },
    color: {
      type: String,
      default: '#78909C',
      trim: true,
      match: [/^#([0-9a-fA-F]{3}){1,2}$/, 'Color must be a valid hex code'],
    },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

categorySchema.index(
  { user: 1, name: 1, deletedAt: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } }
);

categorySchema.index(
  { name: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true, user: null } }
);

categorySchema.statics.findForUser = function findForUser(userId) {
  return this.find({
    deletedAt: null,
    isActive: true,
    $or: [{ user: userId }, { isDefault: true, user: null }],
  }).sort({ sortOrder: 1, name: 1 });
};

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
