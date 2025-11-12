const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

// Get all payments
router.get('/', async (req, res) => {
    try {
        const { status, limit = 50, skip = 0 } = req.query;
        const query = status ? { status } : {};

        const payments = await Payment.find(query)
            .populate('invoiceId', 'invoiceNumber totalAmount')
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .sort({ createdAt: -1 });

        const total = await Payment.countDocuments(query);

        res.json({
            success: true,
            data: payments,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
                hasMore: skip + payments.length < total
            }
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payments',
            message: error.message
        });
    }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('invoiceId');

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }

        res.json({
            success: true,
            data: payment
        });
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment',
            message: error.message
        });
    }
});

// Create new payment
router.post('/', async (req, res) => {
    try {
        const {
            invoiceId,
            amount,
            currency,
            paymentMethod,
            payer,
            notes
        } = req.body;

        // Verify invoice exists
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Create payment
        const payment = new Payment({
            invoiceId,
            amount,
            currency: currency || 'USD',
            paymentMethod,
            payer,
            notes,
            transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            status: 'processing'
        });

        await payment.save();

        res.status(201).json({
            success: true,
            data: payment,
            message: 'Payment created successfully'
        });
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to create payment',
            message: error.message
        });
    }
});

// Update payment status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'processing', 'completed', 'failed', 'refunded'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }

        res.json({
            success: true,
            data: payment,
            message: 'Payment status updated successfully'
        });
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to update payment',
            message: error.message
        });
    }
});

// Get payment statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await Payment.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const totalPayments = await Payment.countDocuments();
        const totalAmount = await Payment.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            success: true,
            data: {
                totalPayments,
                totalAmount: totalAmount[0]?.total || 0,
                byStatus: stats
            }
        });
    } catch (error) {
        console.error('Error fetching payment stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment statistics',
            message: error.message
        });
    }
});

module.exports = router;
