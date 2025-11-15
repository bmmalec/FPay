const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
    // Error details
    message: {
        type: String,
        required: true
    },
    stack: {
        type: String
    },
    errorType: {
        type: String,
        required: true
    },

    // Source information
    source: {
        type: String,
        enum: ['server', 'client'],
        required: true
    },

    // Request/Context information
    url: {
        type: String,
        required: true
    },
    method: {
        type: String
    },
    userAgent: {
        type: String
    },
    ipAddress: {
        type: String
    },

    // Request details (for server errors)
    requestBody: {
        type: mongoose.Schema.Types.Mixed
    },
    requestQuery: {
        type: mongoose.Schema.Types.Mixed
    },
    requestParams: {
        type: mongoose.Schema.Types.Mixed
    },
    requestHeaders: {
        type: mongoose.Schema.Types.Mixed
    },

    // Response details
    statusCode: {
        type: Number
    },

    // Client context (for client errors)
    browserInfo: {
        platform: String,
        language: String,
        screenResolution: String,
        viewport: String
    },

    // User information (if available)
    userId: {
        type: String
    },
    sessionId: {
        type: String
    },

    // Error management
    status: {
        type: String,
        enum: ['new', 'investigating', 'resolved', 'ignored'],
        default: 'new'
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },

    // Resolution tracking
    resolvedAt: {
        type: Date
    },
    resolvedBy: {
        type: String
    },
    resolutionNotes: {
        type: String
    },

    // Occurrence tracking
    occurrenceCount: {
        type: Number,
        default: 1
    },
    firstOccurrence: {
        type: Date,
        default: Date.now
    },
    lastOccurrence: {
        type: Date,
        default: Date.now
    },

    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Index for fast queries
errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ source: 1, status: 1 });
errorLogSchema.index({ status: 1, severity: -1 });
errorLogSchema.index({ url: 1 });
errorLogSchema.index({ message: 'text', stack: 'text' });

// Static method to log an error
errorLogSchema.statics.logError = async function(errorData) {
    try {
        // Check if similar error exists (same message, url, source within last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const existingError = await this.findOne({
            message: errorData.message,
            url: errorData.url,
            source: errorData.source,
            lastOccurrence: { $gte: oneHourAgo }
        });

        if (existingError) {
            // Update existing error
            existingError.occurrenceCount += 1;
            existingError.lastOccurrence = new Date();
            existingError.stack = errorData.stack || existingError.stack;
            await existingError.save();
            return existingError;
        } else {
            // Create new error log
            const errorLog = new this(errorData);
            await errorLog.save();
            return errorLog;
        }
    } catch (err) {
        // Fallback: log to console if database logging fails
        console.error('Failed to log error to database:', err);
        console.error('Original error:', errorData);
        return null;
    }
};

// Static method to get error statistics
errorLogSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $facet: {
                bySource: [
                    { $group: { _id: '$source', count: { $sum: 1 } } }
                ],
                byStatus: [
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                bySeverity: [
                    { $group: { _id: '$severity', count: { $sum: 1 } } }
                ],
                recent: [
                    { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
                    { $count: 'last24Hours' }
                ]
            }
        }
    ]);

    return stats[0];
};

module.exports = mongoose.model('ErrorLog', errorLogSchema);
