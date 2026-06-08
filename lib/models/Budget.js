const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly', index: true },
    month: { type: Number, index: true }, // YYYYMM
    year: { type: Number, required: true, index: true },
    amount: { type: Number, required: [true, 'Budget amount is required'], min: [0, 'Budget must be positive'] },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    alertThreshold: { type: Number, min: 0, max: 100, default: 80 },
    alertSentAt: { type: Date, default: null },
    rolloverUnused: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

budgetSchema.index(
  { user: 1, category: 1, period: 1, year: 1, month: 1, deletedAt: 1 },
  { unique: true }
);

budgetSchema.pre('validate', function setMonth(next) {
  if (this.period === 'monthly' && !this.month) {
    return next(new Error('month is required for monthly budgets (format: YYYYMM)'));
  }
  if (this.period === 'yearly') this.month = null;
  next();
});

module.exports = mongoose.models.Budget || mongoose.model('Budget', budgetSchema);
