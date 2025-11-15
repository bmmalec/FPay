const ErrorLog = require('../models/ErrorLog');

/**
 * Sanitize sensitive information from request data
 */
function sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie'];

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
}

/**
 * Determine error severity based on status code and error type
 */
function determineSeverity(error, statusCode) {
    // Critical errors
    if (statusCode >= 500) return 'critical';
    if (error.name === 'MongoError' || error.name === 'MongooseError') return 'high';

    // High severity errors
    if (statusCode === 401 || statusCode === 403) return 'high';
    if (error.name === 'ValidationError') return 'medium';

    // Medium severity
    if (statusCode >= 400) return 'medium';

    return 'low';
}

/**
 * Express error logging middleware
 * This should be placed BEFORE other error handlers
 */
async function errorLogger(err, req, res, next) {
    try {
        const statusCode = err.statusCode || err.status || 500;
        const severity = determineSeverity(err, statusCode);

        // Prepare error data
        const errorData = {
            message: err.message || 'Internal Server Error',
            stack: err.stack,
            errorType: err.name || 'Error',
            source: 'server',
            url: req.originalUrl || req.url,
            method: req.method,
            userAgent: req.get('user-agent'),
            ipAddress: req.ip || req.connection.remoteAddress,
            statusCode: statusCode,
            severity: severity,

            // Sanitize sensitive information
            requestBody: sanitizeData(req.body),
            requestQuery: sanitizeData(req.query),
            requestParams: sanitizeData(req.params),
            requestHeaders: sanitizeData(req.headers),

            // Session/user info if available
            userId: req.user?.id || req.session?.userId,
            sessionId: req.sessionID,

            // Additional metadata
            metadata: {
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development'
            }
        };

        // Log to database (async, don't block response)
        ErrorLog.logError(errorData).catch(dbErr => {
            console.error('Failed to log error to database:', dbErr);
        });

        // Log to console in development
        if (process.env.NODE_ENV !== 'production') {
            console.error('ERROR LOGGED:', {
                message: err.message,
                url: req.url,
                method: req.method,
                stack: err.stack
            });
        }

    } catch (loggingError) {
        console.error('Error in error logging middleware:', loggingError);
    }

    // Pass error to next middleware
    next(err);
}

/**
 * Final error handler - sends response to client
 * This should be placed AFTER errorLogger
 */
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || err.status || 500;

    // Determine if we should expose error details
    const isProduction = process.env.NODE_ENV === 'production';
    const errorResponse = {
        success: false,
        error: isProduction ? 'An error occurred' : err.message,
        statusCode: statusCode
    };

    // Include stack trace in development
    if (!isProduction) {
        errorResponse.stack = err.stack;
        errorResponse.details = err;
    }

    res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper to catch errors in async route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Log unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);

    ErrorLog.logError({
        message: reason?.message || String(reason),
        stack: reason?.stack || new Error().stack,
        errorType: 'UnhandledPromiseRejection',
        source: 'server',
        url: 'N/A',
        severity: 'critical',
        metadata: {
            reason: String(reason),
            timestamp: new Date().toISOString()
        }
    }).catch(err => {
        console.error('Failed to log unhandled rejection:', err);
    });
});

/**
 * Log uncaught exceptions
 */
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);

    ErrorLog.logError({
        message: error.message || 'Uncaught Exception',
        stack: error.stack,
        errorType: error.name || 'UncaughtException',
        source: 'server',
        url: 'N/A',
        severity: 'critical',
        metadata: {
            timestamp: new Date().toISOString()
        }
    }).catch(err => {
        console.error('Failed to log uncaught exception:', err);
    }).finally(() => {
        // Give time for logging then exit
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
});

module.exports = {
    errorLogger,
    errorHandler,
    asyncHandler
};
