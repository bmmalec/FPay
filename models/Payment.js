const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'CAD']
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['credit_card', 'ach', 'wire_transfer', 'check']
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    payer: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: String,
        company: String
    },
    metadata: {
        type: Map,
        of: String
    },
    notes: String,
    processingFee: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ 'payer.email': 1 });

// Virtual for total amount including fee
paymentSchema.virtual('totalAmount').get(function() {
    return this.amount + this.processingFee;
});

// Ensure virtuals are included in JSON
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
