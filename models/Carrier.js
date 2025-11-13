const mongoose = require('mongoose');

const carrierSchema = new mongoose.Schema({
    // Company Information
    companyName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    mcNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    dotNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    scac: {
        type: String,
        trim: true,
        maxlength: 4,
        uppercase: true
    },

    // Contact Information
    contact: {
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        },
        alternatePhone: String,
        fax: String,
        website: String
    },

    // Address
    address: {
        street: {
            type: String,
            required: true
        },
        street2: String,
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true,
            maxlength: 2,
            uppercase: true
        },
        zip: {
            type: String,
            required: true
        },
        country: {
            type: String,
            default: 'USA'
        }
    },

    // Business Details
    businessType: {
        type: String,
        enum: ['corporation', 'llc', 'sole_proprietor', 'partnership'],
        default: 'llc'
    },
    serviceTypes: [{
        type: String,
        enum: ['LTL', 'FTL', 'Refrigerated', 'Flatbed', 'Intermodal', 'Hazmat', 'Expedited', 'Parcel', 'White Glove', 'Oversize']
    }],

    // Financial Information
    paymentTerms: {
        type: String,
        enum: ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Quick Pay'],
        default: 'Net 30'
    },
    quickPayDiscount: {
        type: Number,
        default: 0,
        min: 0,
        max: 10 // Percentage
    },
    creditLimit: {
        type: Number,
        default: 0
    },

    // Insurance Information
    insurance: {
        cargoInsurance: {
            provider: String,
            policyNumber: String,
            amount: Number,
            expirationDate: Date
        },
        liabilityInsurance: {
            provider: String,
            policyNumber: String,
            amount: Number,
            expirationDate: Date
        }
    },

    // Status and Compliance
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending_approval'],
        default: 'pending_approval',
        index: true
    },
    onboardingComplete: {
        type: Boolean,
        default: false
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,

    // Performance Metrics
    metrics: {
        totalShipments: {
            type: Number,
            default: 0
        },
        totalRevenue: {
            type: Number,
            default: 0
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        onTimeDeliveryRate: {
            type: Number,
            default: 100,
            min: 0,
            max: 100
        }
    },

    // Notes and Metadata
    notes: String,
    tags: [String],

    // AI Generation Metadata
    generatedByAI: {
        type: Boolean,
        default: false
    },
    aiMetadata: {
        model: String,
        generatedAt: Date,
        prompt: String
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes for search and filtering
carrierSchema.index({ companyName: 'text', mcNumber: 'text', dotNumber: 'text' });
carrierSchema.index({ status: 1, createdAt: -1 });

// Virtual for full address
carrierSchema.virtual('fullAddress').get(function() {
    let addr = `${this.address.street}`;
    if (this.address.street2) addr += `, ${this.address.street2}`;
    addr += `, ${this.address.city}, ${this.address.state} ${this.address.zip}`;
    return addr;
});

// Method to check if insurance is valid
carrierSchema.methods.hasValidInsurance = function() {
    const now = new Date();
    const cargoValid = this.insurance.cargoInsurance?.expirationDate > now;
    const liabilityValid = this.insurance.liabilityInsurance?.expirationDate > now;
    return cargoValid && liabilityValid;
};

// Method to approve carrier
carrierSchema.methods.approve = function(approvedByUserId) {
    this.status = 'active';
    this.approvedBy = approvedByUserId;
    this.approvedAt = new Date();
    this.onboardingComplete = true;
    return this.save();
};

// Static method to get carriers by service type
carrierSchema.statics.findByServiceType = function(serviceType) {
    return this.find({
        serviceTypes: serviceType,
        status: 'active'
    });
};

// Static method to get statistics
carrierSchema.statics.getStatistics = async function() {
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
        active: 0,
        inactive: 0,
        suspended: 0,
        pending_approval: 0
    };

    stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
    });

    return result;
};

const Carrier = mongoose.model('Carrier', carrierSchema);

module.exports = Carrier;
