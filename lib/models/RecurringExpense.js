const mongoose = require('mongoose');
const { PAYMENT_METHODS, CURRENCIES, RECURRING_FREQUENCIES } = require('../config/constants');

const recurringExpenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: [0, 'Amount must be positive'] },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    note: { type: String, trim: true, maxlength: 500 },

    frequency: { type: String, enum: RECURRING_FREQUENCIES, required: true },
    interval: { type: Number, default: 1, min: 1 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    weekday: { type: Number, min: 0, max: 6 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    nextRunAt: { type: Date, required: true, index: true },
    lastRunAt: { type: Date, default: null },
    occurrenceCount: { type: Number, default: 0 },
    maxOccurrences: { type: Number, default: null },

    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

recurringExpenseSchema.index({ user: 1, isActive: 1, nextRunAt: 1 });

module.exports =
  mongoose.models.RecurringExpense || mongoose.model('RecurringExpense', recurringExpenseSchema);
