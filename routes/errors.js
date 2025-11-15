const express = require('express');
const router = express.Router();
const ErrorLog = require('../models/ErrorLog');
const { asyncHandler } = require('../middleware/errorLogger');

/**
 * POST /api/errors/log
 * Log client-side errors
 */
router.post('/log', asyncHandler(async (req, res) => {
    const {
        message,
        stack,
        url,
        userAgent,
        browserInfo,
        metadata
    } = req.body;

    // Validate required fields
    if (!message || !url) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: message and url'
        });
    }

    // Determine error type from message or stack
    let errorType = 'ClientError';
    if (stack) {
        const match = stack.match(/^(\w+Error):/);
        if (match) errorType = match[1];
    }

    // Determine severity based on error type
    let severity = 'medium';
    if (errorType.includes('TypeError') || errorType.includes('ReferenceError')) {
        severity = 'high';
    } else if (errorType.includes('SyntaxError')) {
        severity = 'critical';
    } else if (errorType.includes('NetworkError') || message.includes('fetch')) {
        severity = 'medium';
    }

    const errorData = {
        message,
        stack: stack || 'No stack trace available',
        errorType,
        source: 'client',
        url,
        userAgent: userAgent || req.get('user-agent'),
        ipAddress: req.ip || req.connection.remoteAddress,
        browserInfo: browserInfo || {},
        severity,
        metadata: {
            ...metadata,
            loggedAt: new Date().toISOString()
        }
    };

    const errorLog = await ErrorLog.logError(errorData);

    res.json({
        success: true,
        message: 'Error logged successfully',
        errorId: errorLog?._id
    });
}));

/**
 * GET /api/errors
 * Get error logs with filtering and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        source,
        status,
        severity,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    if (source) query.source = source;
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (search) {
        query.$text = { $search: search };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [errors, total] = await Promise.all([
        ErrorLog.find(query)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .limit(parseInt(limit))
            .skip(skip)
            .select('-__v'),
        ErrorLog.countDocuments(query)
    ]);

    res.json({
        success: true,
        data: errors,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
        }
    });
}));

/**
 * GET /api/errors/stats
 * Get error statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await ErrorLog.getStats();

    // Get total count
    const total = await ErrorLog.countDocuments();

    // Get unresolved count
    const unresolved = await ErrorLog.countDocuments({
        status: { $in: ['new', 'investigating'] }
    });

    res.json({
        success: true,
        data: {
            total,
            unresolved,
            ...stats
        }
    });
}));

/**
 * GET /api/errors/:id
 * Get a specific error log
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const error = await ErrorLog.findById(req.params.id);

    if (!error) {
        return res.status(404).json({
            success: false,
            error: 'Error log not found'
        });
    }

    res.json({
        success: true,
        data: error
    });
}));

/**
 * PATCH /api/errors/:id
 * Update error status/resolution
 */
router.patch('/:id', asyncHandler(async (req, res) => {
    const { status, resolutionNotes, resolvedBy } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    if (resolvedBy) updateData.resolvedBy = resolvedBy;

    if (status === 'resolved') {
        updateData.resolvedAt = new Date();
    }

    const error = await ErrorLog.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
    );

    if (!error) {
        return res.status(404).json({
            success: false,
            error: 'Error log not found'
        });
    }

    res.json({
        success: true,
        message: 'Error log updated successfully',
        data: error
    });
}));

/**
 * DELETE /api/errors/:id
 * Delete an error log (admin only)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const error = await ErrorLog.findByIdAndDelete(req.params.id);

    if (!error) {
        return res.status(404).json({
            success: false,
            error: 'Error log not found'
        });
    }

    res.json({
        success: true,
        message: 'Error log deleted successfully'
    });
}));

/**
 * POST /api/errors/bulk-update
 * Bulk update error statuses
 */
router.post('/bulk-update', asyncHandler(async (req, res) => {
    const { ids, status, resolutionNotes } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid or empty ids array'
        });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    if (status === 'resolved') updateData.resolvedAt = new Date();

    const result = await ErrorLog.updateMany(
        { _id: { $in: ids } },
        updateData
    );

    res.json({
        success: true,
        message: `Updated ${result.modifiedCount} error logs`,
        modified: result.modifiedCount
    });
}));

/**
 * DELETE /api/errors/bulk-delete
 * Bulk delete error logs
 */
router.post('/bulk-delete', asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid or empty ids array'
        });
    }

    const result = await ErrorLog.deleteMany({ _id: { $in: ids } });

    res.json({
        success: true,
        message: `Deleted ${result.deletedCount} error logs`,
        deleted: result.deletedCount
    });
}));

module.exports = router;
