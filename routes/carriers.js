const express = require('express');
const router = express.Router();
const Carrier = require('../models/Carrier');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * GET /api/carriers
 * List carriers with search, filtering, and pagination
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const search = req.query.search;
        const serviceType = req.query.serviceType;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        // Build filter
        const filter = {};
        if (status) filter.status = status;
        if (serviceType) filter.serviceTypes = serviceType;

        // Text search
        if (search) {
            filter.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { mcNumber: { $regex: search, $options: 'i' } },
                { dotNumber: { $regex: search, $options: 'i' } },
                { scac: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        const sort = {};
        sort[sortBy] = sortOrder;

        const [carriers, total] = await Promise.all([
            Carrier.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Carrier.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: carriers,
            pagination: {
                page,
                limit,
                total,
                pages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching carriers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/carriers/statistics
 * Get carrier statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const stats = await Carrier.getStatistics();

        // Get additional metrics
        const activeCarriers = await Carrier.find({ status: 'active' });
        const totalRevenue = activeCarriers.reduce((sum, c) => sum + (c.metrics.totalRevenue || 0), 0);
        const avgRating = activeCarriers.length > 0
            ? activeCarriers.reduce((sum, c) => sum + (c.metrics.averageRating || 0), 0) / activeCarriers.length
            : 0;

        res.json({
            success: true,
            statistics: {
                ...stats,
                totalRevenue,
                averageRating: avgRating.toFixed(2)
            }
        });
    } catch (error) {
        console.error('Error fetching carrier statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/carriers/:id
 * Get a specific carrier by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const carrier = await Carrier.findById(req.params.id);

        if (!carrier) {
            return res.status(404).json({
                success: false,
                error: 'Carrier not found'
            });
        }

        res.json({
            success: true,
            data: carrier
        });
    } catch (error) {
        console.error('Error fetching carrier:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/carriers
 * Create a new carrier
 */
router.post('/', async (req, res) => {
    try {
        const carrierData = req.body;

        // Check if MC number or DOT number already exists
        const existingCarrier = await Carrier.findOne({
            $or: [
                { mcNumber: carrierData.mcNumber },
                { dotNumber: carrierData.dotNumber }
            ]
        });

        if (existingCarrier) {
            return res.status(400).json({
                success: false,
                error: 'Carrier with this MC Number or DOT Number already exists'
            });
        }

        const carrier = new Carrier(carrierData);
        await carrier.save();

        res.status(201).json({
            success: true,
            message: 'Carrier created successfully',
            data: carrier
        });
    } catch (error) {
        console.error('Error creating carrier:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/carriers/generate-with-ai
 * Generate carriers using Claude AI
 */
router.post('/generate-with-ai', async (req, res) => {
    try {
        const { quantity, serviceTypes } = req.body;

        if (!quantity || quantity < 1 || quantity > 10) {
            return res.status(400).json({
                success: false,
                error: 'Quantity must be between 1 and 10'
            });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'Claude API key not configured'
            });
        }

        const anthropic = new Anthropic({ apiKey });
        const model = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';

        const serviceTypesList = serviceTypes && serviceTypes.length > 0
            ? serviceTypes.join(', ')
            : 'LTL, FTL, Refrigerated, Flatbed, Intermodal';

        const prompt = `Generate ${quantity} realistic motor carrier company profiles for a freight payment platform. Each carrier should provide these service types: ${serviceTypesList}.

For each carrier, generate:
- Company name (realistic freight/trucking company name)
- MC Number (Motor Carrier number, format: MC-XXXXXX, 6 digits)
- DOT Number (Department of Transportation number, format: DOT-XXXXXXX, 7 digits)
- SCAC code (4-letter Standard Carrier Alpha Code, uppercase)
- Contact email (company domain email)
- Contact phone (US format: XXX-XXX-XXXX)
- Full business address (realistic US address with street, city, state, ZIP)
- Business type (corporation, llc, sole_proprietor, or partnership)
- Service types array (from: ${serviceTypesList})
- Payment terms (Net 15, Net 30, Net 45, Net 60, or Quick Pay)
- Quick pay discount percentage (0-5%)
- Credit limit ($50,000 - $500,000)
- Cargo insurance amount ($100,000 - $1,000,000)
- Liability insurance amount ($750,000 - $2,000,000)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "companyName": "ABC Freight Lines Inc",
    "mcNumber": "MC-123456",
    "dotNumber": "DOT-1234567",
    "scac": "ABCF",
    "contact": {
      "email": "dispatch@abcfreight.com",
      "phone": "555-123-4567",
      "website": "https://www.abcfreight.com"
    },
    "address": {
      "street": "123 Trucking Way",
      "city": "Chicago",
      "state": "IL",
      "zip": "60601",
      "country": "USA"
    },
    "businessType": "llc",
    "serviceTypes": ["LTL", "FTL"],
    "paymentTerms": "Net 30",
    "quickPayDiscount": 2.5,
    "creditLimit": 250000,
    "insurance": {
      "cargoInsurance": {
        "provider": "Progressive Commercial",
        "policyNumber": "CARGO-12345",
        "amount": 500000,
        "expirationDate": "2026-12-31"
      },
      "liabilityInsurance": {
        "provider": "Progressive Commercial",
        "policyNumber": "LIAB-12345",
        "amount": 1000000,
        "expirationDate": "2026-12-31"
      }
    }
  }
]`;

        const message = await anthropic.messages.create({
            model: model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
        });

        let responseText = message.content[0].text;

        // Try to extract JSON from code blocks first
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                         responseText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            responseText = jsonMatch[1];
        } else {
            // If no code blocks, try to find JSON array directly
            const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (arrayMatch) {
                responseText = arrayMatch[0];
            }
        }

        // Clean up any remaining text before/after JSON
        responseText = responseText.trim();

        const carriersData = JSON.parse(responseText);
        if (!Array.isArray(carriersData)) {
            throw new Error('Invalid response format from Claude API');
        }

        const createdCarriers = [];
        const errors = [];

        for (const carrierData of carriersData) {
            try {
                // Check for duplicates
                const existing = await Carrier.findOne({
                    $or: [
                        { mcNumber: carrierData.mcNumber },
                        { dotNumber: carrierData.dotNumber }
                    ]
                });

                if (existing) {
                    errors.push({
                        carrier: carrierData.companyName,
                        error: 'Duplicate MC or DOT number'
                    });
                    continue;
                }

                const carrier = new Carrier({
                    ...carrierData,
                    status: 'active', // Auto-approve AI-generated carriers
                    onboardingComplete: true,
                    generatedByAI: true,
                    aiMetadata: {
                        model: model,
                        generatedAt: new Date(),
                        prompt: 'AI-generated carrier'
                    }
                });

                await carrier.save();
                createdCarriers.push(carrier);
            } catch (error) {
                errors.push({
                    carrier: carrierData.companyName,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Generated ${createdCarriers.length} carriers using Claude AI`,
            data: createdCarriers,
            count: createdCarriers.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Error generating carriers with AI:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/carriers/:id
 * Update a carrier
 */
router.put('/:id', async (req, res) => {
    try {
        const carrier = await Carrier.findById(req.params.id);

        if (!carrier) {
            return res.status(404).json({
                success: false,
                error: 'Carrier not found'
            });
        }

        // Check if updating MC/DOT number conflicts with another carrier
        if (req.body.mcNumber || req.body.dotNumber) {
            const existingCarrier = await Carrier.findOne({
                _id: { $ne: req.params.id },
                $or: [
                    { mcNumber: req.body.mcNumber },
                    { dotNumber: req.body.dotNumber }
                ]
            });

            if (existingCarrier) {
                return res.status(400).json({
                    success: false,
                    error: 'Another carrier with this MC Number or DOT Number already exists'
                });
            }
        }

        Object.assign(carrier, req.body);
        await carrier.save();

        res.json({
            success: true,
            message: 'Carrier updated successfully',
            data: carrier
        });
    } catch (error) {
        console.error('Error updating carrier:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PATCH /api/carriers/:id/status
 * Update carrier status
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        if (!['active', 'inactive', 'suspended', 'pending_approval'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        const carrier = await Carrier.findById(req.params.id);

        if (!carrier) {
            return res.status(404).json({
                success: false,
                error: 'Carrier not found'
            });
        }

        carrier.status = status;
        if (status === 'active' && !carrier.onboardingComplete) {
            carrier.onboardingComplete = true;
            carrier.approvedAt = new Date();
        }

        await carrier.save();

        res.json({
            success: true,
            message: 'Carrier status updated successfully',
            data: carrier
        });
    } catch (error) {
        console.error('Error updating carrier status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/carriers/:id
 * Delete a carrier
 */
router.delete('/:id', async (req, res) => {
    try {
        const carrier = await Carrier.findById(req.params.id);

        if (!carrier) {
            return res.status(404).json({
                success: false,
                error: 'Carrier not found'
            });
        }

        // Instead of hard delete, mark as inactive
        carrier.status = 'inactive';
        await carrier.save();

        res.json({
            success: true,
            message: 'Carrier deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting carrier:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add a note to a carrier
router.post('/:id/notes', async (req, res) => {
    try {
        const { content, createdBy, category, pinned } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Note content is required'
            });
        }

        const carrier = await Carrier.findById(req.params.id);

        if (!carrier) {
            return res.status(404).json({
                success: false,
                error: 'Carrier not found'
            });
        }

        carrier.addNote(content, createdBy || 'Admin', category || 'general', pinned || false);
        await carrier.save();

        res.json({
            success: true,
            message: 'Note added successfully',
            data: carrier.notes[carrier.notes.length - 1]
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

// Get notes for a carrier
router.get('/:id/notes', async (req, res) => {
    try {
        const carrier = await Carrier.findById(req.params.id).select('notes companyName mcNumber');

        if (!carrier) {
            return res.status(404).json({
                success: false,
                error: 'Carrier not found'
            });
        }

        res.json({
            success: true,
            data: {
                companyName: carrier.companyName,
                mcNumber: carrier.mcNumber,
                notes: carrier.notes.sort((a, b) => b.createdAt - a.createdAt)
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

// Get audit trail for a carrier
router.get('/:id/audit-trail', async (req, res) => {
    try {
        const carrier = await Carrier.findById(req.params.id).select('auditTrail companyName mcNumber');

        if (!carrier) {
            return res.status(404).json({
                success: false,
                error: 'Carrier not found'
            });
        }

        res.json({
            success: true,
            data: {
                companyName: carrier.companyName,
                mcNumber: carrier.mcNumber,
                auditTrail: carrier.auditTrail.sort((a, b) => b.timestamp - a.timestamp)
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

// Get recent activity across all carriers
router.get('/activity/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const activity = await Carrier.getRecentActivity(limit);

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
