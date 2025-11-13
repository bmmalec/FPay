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
    carrierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Carrier',
        index: true
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
            enum: ['general', 'payment', 'dispute', 'follow-up', 'internal'],
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
            enum: ['created', 'updated', 'status_changed', 'sent', 'viewed', 'payment_received', 'cancelled', 'note_added']
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

// Method to add a note
invoiceSchema.methods.addNote = function(content, createdBy = 'System', category = 'general', pinned = false) {
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
invoiceSchema.methods.addAuditEntry = function(action, performedBy = 'System', changes = {}, metadata = {}, ipAddress = null, userAgent = null) {
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
invoiceSchema.methods.changeStatus = function(newStatus, performedBy = 'System', reason = null) {
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
invoiceSchema.statics.getRecentActivity = async function(limit = 10) {
    const invoices = await this.find()
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('invoiceNumber status auditTrail customer.name totalAmount updatedAt');

    return invoices;
};

// Ensure virtuals are included in JSON
invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
