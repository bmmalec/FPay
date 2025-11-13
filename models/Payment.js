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
    // Notes/Journaling System
    notes: [{
        content: {
            type: String,
            required: true
        },
        createdBy: {
            type: String,
            default: 'System'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        category: {
            type: String,
            enum: ['general', 'processing', 'dispute', 'refund', 'internal'],
            default: 'general'
        },
        pinned: {
            type: Boolean,
            default: false
        }
    }],

    // Audit Trail
    auditTrail: [{
        action: {
            type: String,
            required: true,
            enum: ['created', 'updated', 'status_changed', 'processed', 'completed', 'failed', 'refunded', 'note_added']
        },
        performedBy: {
            type: String,
            default: 'System'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        changes: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },
        metadata: {
            type: Map,
            of: String
        },
        ipAddress: String,
        userAgent: String
    }],

    metadata: {
        type: Map,
        of: String
    },
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

// Method to add a note
paymentSchema.methods.addNote = function(content, createdBy = 'System', category = 'general', pinned = false) {
    this.notes.push({
        content,
        createdBy,
        createdAt: new Date(),
        category,
        pinned
    });

    // Add audit trail entry
    this.addAuditEntry('note_added', createdBy, {
        noteContent: content,
        category: category
    });

    return this;
};

// Method to add audit trail entry
paymentSchema.methods.addAuditEntry = function(action, performedBy = 'System', changes = {}, metadata = {}, ipAddress = null, userAgent = null) {
    this.auditTrail.push({
        action,
        performedBy,
        timestamp: new Date(),
        changes: new Map(Object.entries(changes)),
        metadata: new Map(Object.entries(metadata)),
        ipAddress,
        userAgent
    });

    return this;
};

// Method to log status change
paymentSchema.methods.changeStatus = function(newStatus, performedBy = 'System', reason = null) {
    const oldStatus = this.status;
    this.status = newStatus;

    const changes = {
        field: 'status',
        oldValue: oldStatus,
        newValue: newStatus
    };

    if (reason) {
        changes.reason = reason;
    }

    this.addAuditEntry('status_changed', performedBy, changes);

    return this;
};

// Static method to get recent activity
paymentSchema.statics.getRecentActivity = async function(limit = 10) {
    const payments = await this.find()
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('amount status auditTrail payer.name paymentDate updatedAt')
        .populate('invoiceId', 'invoiceNumber');

    return payments;
};

// Ensure virtuals are included in JSON
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
