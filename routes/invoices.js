const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

// Get all invoices
router.get('/', async (req, res) => {
    try {
        const { status, limit = 50, skip = 0 } = req.query;
        const query = status ? { status } : {};

        const invoices = await Invoice.find(query)
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .sort({ createdAt: -1 });

        const total = await Invoice.countDocuments(query);

        res.json({
            success: true,
            data: invoices,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
                hasMore: skip + invoices.length < total
            }
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invoices',
            message: error.message
        });
    }
});

// Get invoice by ID
router.get('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            data: invoice
        });
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invoice',
            message: error.message
        });
    }
});

// Get invoice by invoice number
router.get('/number/:invoiceNumber', async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            invoiceNumber: req.params.invoiceNumber
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            data: invoice
        });
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invoice',
            message: error.message
        });
    }
});

// Create new invoice
router.post('/', async (req, res) => {
    try {
        const invoiceData = req.body;

        // Generate invoice number if not provided
        if (!invoiceData.invoiceNumber) {
            const count = await Invoice.countDocuments();
            invoiceData.invoiceNumber = `INV-${Date.now()}-${String(count + 1).padStart(4, '0')}`;
        }

        const invoice = new Invoice(invoiceData);
        await invoice.save();

        res.status(201).json({
            success: true,
            data: invoice,
            message: 'Invoice created successfully'
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to create invoice',
            message: error.message
        });
    }
});

// Update invoice
router.put('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Migrate old string notes to array format (schema migration)
        if (invoice.notes && typeof invoice.notes === 'string') {
            invoice.notes = [{
                content: invoice.notes,
                createdBy: 'System',
                createdAt: invoice.updatedAt || invoice.createdAt || new Date(),
                category: 'general',
                pinned: false
            }];
        }

        // Ensure notes is initialized as empty array if undefined
        if (!invoice.notes) {
            invoice.notes = [];
        }

        // Ensure auditTrail is initialized as empty array if undefined
        if (!invoice.auditTrail) {
            invoice.auditTrail = [];
        }

        Object.assign(invoice, req.body);
        await invoice.save();

        res.json({
            success: true,
            data: invoice,
            message: 'Invoice updated successfully'
        });
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to update invoice',
            message: error.message
        });
    }
});

// Update invoice status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        const validStatuses = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        const updateData = { status };
        if (status === 'paid') {
            updateData.paidDate = new Date();
        }

        const invoice = await Invoice.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            data: invoice,
            message: 'Invoice status updated successfully'
        });
    } catch (error) {
        console.error('Error updating invoice status:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to update invoice status',
            message: error.message
        });
    }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findByIdAndDelete(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            message: 'Invoice deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete invoice',
            message: error.message
        });
    }
});

// Get invoice statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await Invoice.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $add: [
                                '$amount.baseRate',
                                '$amount.fuelSurcharge',
                                '$amount.accessorialCharges',
                                '$amount.tax',
                                { $multiply: ['$amount.discount', -1] }
                            ]
                        }
                    }
                }
            }
        ]);

        const totalInvoices = await Invoice.countDocuments();
        const overdueInvoices = await Invoice.countDocuments({
            status: { $nin: ['paid', 'cancelled'] },
            dueDate: { $lt: new Date() }
        });

        res.json({
            success: true,
            data: {
                totalInvoices,
                overdueInvoices,
                byStatus: stats
            }
        });
    } catch (error) {
        console.error('Error fetching invoice stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invoice statistics',
            message: error.message
        });
    }
});

// Add a note to an invoice
router.post('/:id/notes', async (req, res) => {
    try {
        const { content, createdBy, category, pinned } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Note content is required'
            });
        }

        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        invoice.addNote(content, createdBy || 'Admin', category || 'general', pinned || false);
        await invoice.save();

        res.json({
            success: true,
            message: 'Note added successfully',
            data: invoice.notes[invoice.notes.length - 1]
        });
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add note',
            message: error.message
        });
    }
});

// Get notes for an invoice
router.get('/:id/notes', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).select('notes invoiceNumber');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            data: {
                invoiceNumber: invoice.invoiceNumber,
                notes: invoice.notes.sort((a, b) => b.createdAt - a.createdAt)
            }
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notes',
            message: error.message
        });
    }
});

// Get audit trail for an invoice
router.get('/:id/audit-trail', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).select('auditTrail invoiceNumber');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            data: {
                invoiceNumber: invoice.invoiceNumber,
                auditTrail: invoice.auditTrail.sort((a, b) => b.timestamp - a.timestamp)
            }
        });
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit trail',
            message: error.message
        });
    }
});

// Get recent activity across all invoices
router.get('/activity/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const activity = await Invoice.getRecentActivity(limit);

        res.json({
            success: true,
            data: activity
        });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent activity',
            message: error.message
        });
    }
});

module.exports = router;
