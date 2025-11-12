const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    shipment: {
        origin: {
            address: String,
            city: String,
            state: String,
            zip: String,
            country: { type: String, default: 'USA' }
        },
        destination: {
            address: String,
            city: String,
            state: String,
            zip: String,
            country: { type: String, default: 'USA' }
        },
        trackingNumber: String,
        weight: Number,
        weightUnit: { type: String, enum: ['lbs', 'kg'], default: 'lbs' },
        dimensions: {
            length: Number,
            width: Number,
            height: Number,
            unit: { type: String, enum: ['in', 'cm'], default: 'in' }
        }
    },
    carrier: {
        name: {
            type: String,
            required: true
        },
        scac: String, // Standard Carrier Alpha Code
        carrierReference: String
    },
    customer: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: String,
        company: String,
        accountNumber: String
    },
    amount: {
        baseRate: {
            type: Number,
            required: true,
            min: 0
        },
        fuelSurcharge: {
            type: Number,
            default: 0
        },
        accessorialCharges: {
            type: Number,
            default: 0
        },
        tax: {
            type: Number,
            default: 0
        },
        discount: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        required: true,
        enum: ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    dueDate: {
        type: Date,
        required: true
    },
    issueDate: {
        type: Date,
        default: Date.now
    },
    paidDate: Date,
    terms: {
        type: String,
        default: 'Net 30'
    },
    notes: String,
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true
});

// Indexes
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ 'customer.email': 1 });
invoiceSchema.index({ 'carrier.name': 1 });

// Virtual for total amount
invoiceSchema.virtual('totalAmount').get(function() {
    return (
        this.amount.baseRate +
        this.amount.fuelSurcharge +
        this.amount.accessorialCharges +
        this.amount.tax -
        this.amount.discount
    );
});

// Virtual for amount due (considering partial payments)
invoiceSchema.virtual('amountDue').get(function() {
    // This would need to calculate based on payments
    // For now, returning total amount
    return this.totalAmount;
});

// Method to check if invoice is overdue
invoiceSchema.methods.isOverdue = function() {
    return this.status !== 'paid' && this.dueDate < new Date();
};

// Ensure virtuals are included in JSON
invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
