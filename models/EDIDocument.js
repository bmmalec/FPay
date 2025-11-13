const mongoose = require('mongoose');

const ediDocumentSchema = new mongoose.Schema({
    // EDI Identification
    ediType: {
        type: String,
        required: true,
        default: '210' // EDI 210 - Motor Carrier Freight Details and Invoice
    },
    controlNumber: {
        type: String,
        required: true,
        unique: true
    },

    // EDI Content
    ediContent: {
        type: String,
        required: true
    },

    // Parsed Data (for quick access without re-parsing)
    parsedData: {
        invoiceNumber: String,
        shipmentId: String,
        shipperName: String,
        consigneeName: String,
        billToName: String,
        weight: Number,
        amount: Number,
        shipmentDate: Date,
        deliveryDate: Date
    },

    // Status Tracking
    status: {
        type: String,
        required: true,
        enum: ['received', 'validating', 'validation_error', 'processing', 'processed_success', 'processed_error'],
        default: 'received'
    },

    // Timestamps
    receivedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    processedAt: Date,

    // Processing Results
    processingSuccess: {
        type: Boolean,
        default: null
    },
    createdInvoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice'
    },

    // Error Tracking
    validationErrors: [{
        field: String,
        message: String,
        code: String
    }],
    processingError: {
        message: String,
        stack: String,
        code: String
    },

    // Source Information
    source: {
        type: String,
        enum: ['manual', 'claude_ai', 'api', 'upload'],
        default: 'manual'
    },
    sourceMetadata: {
        shipmentType: String, // For Claude AI generated
        model: String, // Claude model used
        intentionalError: Boolean // Flag for test data with intentional errors
    },

    // User/System Info
    createdBy: String,
    notes: String
}, {
    timestamps: true
});

// Indexes for efficient querying
ediDocumentSchema.index({ controlNumber: 1 }, { unique: true });
ediDocumentSchema.index({ status: 1 });
ediDocumentSchema.index({ receivedAt: -1 }); // Latest first
ediDocumentSchema.index({ 'parsedData.invoiceNumber': 1 });
ediDocumentSchema.index({ source: 1 });
ediDocumentSchema.index({ processingSuccess: 1 });

// Method to validate EDI data before processing
ediDocumentSchema.methods.validateForProcessing = function() {
    const errors = [];

    if (!this.parsedData) {
        errors.push({
            field: 'parsedData',
            message: 'EDI content has not been parsed',
            code: 'MISSING_PARSED_DATA'
        });
        return { valid: false, errors };
    }

    // Required fields for invoice creation
    if (!this.parsedData.invoiceNumber) {
        errors.push({
            field: 'invoiceNumber',
            message: 'Invoice number is required',
            code: 'MISSING_INVOICE_NUMBER'
        });
    }

    if (!this.parsedData.billToName) {
        errors.push({
            field: 'billToName',
            message: 'Bill-to customer name is required',
            code: 'MISSING_BILL_TO'
        });
    }

    if (!this.parsedData.amount || this.parsedData.amount <= 0) {
        errors.push({
            field: 'amount',
            message: 'Valid amount is required',
            code: 'INVALID_AMOUNT'
        });
    }

    if (!this.parsedData.weight || this.parsedData.weight <= 0) {
        errors.push({
            field: 'weight',
            message: 'Valid weight is required',
            code: 'INVALID_WEIGHT'
        });
    }

    if (!this.parsedData.shipperName) {
        errors.push({
            field: 'shipperName',
            message: 'Shipper name is required',
            code: 'MISSING_SHIPPER'
        });
    }

    if (!this.parsedData.consigneeName) {
        errors.push({
            field: 'consigneeName',
            message: 'Consignee name is required',
            code: 'MISSING_CONSIGNEE'
        });
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
};

// Method to mark as processed
ediDocumentSchema.methods.markProcessed = function(success, invoiceId = null, error = null) {
    this.status = success ? 'processed_success' : 'processed_error';
    this.processedAt = new Date();
    this.processingSuccess = success;

    if (invoiceId) {
        this.createdInvoiceId = invoiceId;
    }

    if (error) {
        this.processingError = {
            message: error.message || error.toString(),
            stack: error.stack,
            code: error.code || 'PROCESSING_ERROR'
        };
    }

    return this.save();
};

// Static method to generate statistics
ediDocumentSchema.statics.getStatistics = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        total: 0,
        received: 0,
        validating: 0,
        validation_error: 0,
        processing: 0,
        processed_success: 0,
        processed_error: 0
    };

    stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
    });

    return result;
};

// Ensure virtuals are included in JSON
ediDocumentSchema.set('toJSON', { virtuals: true });
ediDocumentSchema.set('toObject', { virtuals: true });

const EDIDocument = mongoose.model('EDIDocument', ediDocumentSchema);

module.exports = EDIDocument;
