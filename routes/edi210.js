const express = require('express');
const router = express.Router();
const EDI210Generator = require('../utils/edi210Generator');
const Invoice = require('../models/Invoice');
const EDIDocument = require('../models/EDIDocument');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * POST /api/edi210/generate
 * Generate EDI 210 document and save to database
 */
router.post('/generate', async (req, res) => {
    try {
        const invoiceData = req.body;

        // Validate required fields
        if (!invoiceData.invoiceNumber && !invoiceData.shipmentId) {
            return res.status(400).json({
                success: false,
                error: 'Invoice number or shipment ID is required'
            });
        }

        const generator = new EDI210Generator();
        const ediContent = generator.generate(invoiceData);
        const controlNumber = generator.controlNumber;

        // Parse the generated EDI to extract key data
        const parsedData = generator.parse(ediContent);

        // Save to database
        const ediDoc = new EDIDocument({
            ediType: '210',
            controlNumber: controlNumber,
            ediContent: ediContent,
            parsedData: {
                invoiceNumber: parsedData.invoiceNumber,
                shipmentId: parsedData.shipmentId,
                shipperName: parsedData.shipper?.name,
                consigneeName: parsedData.consignee?.name,
                billToName: parsedData.billTo?.name,
                weight: parsedData.shipment?.weight,
                amount: parsedData.netAmount || parsedData.amount?.total,
                shipmentDate: parsedData.shipmentDate,
                deliveryDate: parsedData.deliveryDate
            },
            status: 'received',
            source: 'manual',
            receivedAt: new Date()
        });

        await ediDoc.save();

        res.json({
            success: true,
            message: 'EDI 210 document created successfully',
            document: {
                id: ediDoc._id,
                controlNumber: ediDoc.controlNumber,
                parsedData: {
                    invoiceNumber: ediDoc.parsedData.invoiceNumber
                },
                status: ediDoc.status,
                receivedAt: ediDoc.receivedAt
            }
        });
    } catch (error) {
        console.error('Error generating EDI 210:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/edi210/generate-with-claude
 * Generate EDI 210 documents using Claude API with optional error injection
 */
router.post('/generate-with-claude', async (req, res) => {
    try {
        const { shipmentType, quantity } = req.body;

        if (!shipmentType || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Shipment type and quantity are required'
            });
        }

        if (quantity < 1 || quantity > 20) {
            return res.status(400).json({
                success: false,
                error: 'Quantity must be between 1 and 20'
            });
        }

        // Check if Claude API key is available
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'Claude API key not configured. Please set ANTHROPIC_API_KEY environment variable.'
            });
        }

        const anthropic = new Anthropic({ apiKey: apiKey });
        const model = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';
        console.log(`Using Claude model: ${model}`);

        // Call Claude API to generate realistic freight data
        const prompt = `Generate ${quantity} realistic freight shipment data entries for EDI 210 Motor Carrier Freight Bills with the following specifications:

Shipment Type: ${shipmentType}

For each shipment, generate realistic data including:
- Unique invoice number (format: INV-YYYYMMDD-XXX)
- Unique shipment/PRO number (format: SHIP-XXX or PRO-XXX)
- Shipper company name and full address (realistic US company and location)
- Consignee company name and full address (realistic US company and location)
- Bill-to customer name (can be same as shipper or consignee)
- Origin city, state, ZIP
- Destination city, state, ZIP (different from origin)
- Weight in pounds (appropriate for ${shipmentType})
- Total freight charges in USD (realistic for the weight and distance)
- Current date for shipment date

Make the data realistic based on the shipment type. For example:
- LTL (Less Than Truckload): 500-10,000 lbs, shorter distances
- FTL (Full Truckload): 20,000-45,000 lbs, longer distances
- Refrigerated: Food/pharmaceutical companies, temperature-controlled rates
- Flatbed: Construction materials, heavy equipment
- Intermodal: Rail + truck combination, longer distances
- Hazmat: Chemical companies, special handling rates
- Expedited: High value cargo, premium rates
- Parcel: Small packages, residential delivery
- White Glove: High-value items, specialized handling

Return ONLY a valid JSON array with this exact structure (no additional text):
[
  {
    "invoiceNumber": "INV-20251113-001",
    "shipmentId": "SHIP-001",
    "shipperName": "ABC Manufacturing Corp",
    "shipperAddress": "123 Industrial Way",
    "shipperCity": "Los Angeles",
    "shipperState": "CA",
    "shipperZip": "90001",
    "consigneeName": "XYZ Distribution Center",
    "consigneeAddress": "456 Warehouse Blvd",
    "consigneeCity": "New York",
    "consigneeState": "NY",
    "consigneeZip": "10001",
    "billToName": "ABC Manufacturing Corp",
    "weight": 5000,
    "amount": 1250.50
  }
]`;

        const message = await anthropic.messages.create({
            model: model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
        });

        // Extract JSON from Claude's response
        let responseText = message.content[0].text;
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                         responseText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            responseText = jsonMatch[1];
        }

        const shipmentData = JSON.parse(responseText);
        if (!Array.isArray(shipmentData)) {
            throw new Error('Invalid response format from Claude API');
        }

        // Generate EDI documents with 10-30% error rate
        const generator = new EDI210Generator();
        const generatedDocs = [];
        const errorRate = 0.1 + Math.random() * 0.2; // 10-30%

        for (const shipment of shipmentData) {
            const shouldHaveError = Math.random() < errorRate;
            let ediData = { ...shipment };

            // Inject intentional errors for testing
            if (shouldHaveError) {
                const errorTypes = ['missing_weight', 'missing_amount', 'missing_billto', 'invalid_weight', 'invalid_amount'];
                const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];

                switch (errorType) {
                    case 'missing_weight':
                        delete ediData.weight;
                        break;
                    case 'missing_amount':
                        delete ediData.amount;
                        break;
                    case 'missing_billto':
                        delete ediData.billToName;
                        break;
                    case 'invalid_weight':
                        ediData.weight = -100;
                        break;
                    case 'invalid_amount':
                        ediData.amount = 0;
                        break;
                }
            }

            // Generate EDI content
            const fullEdiData = {
                invoiceNumber: ediData.invoiceNumber,
                shipmentId: ediData.shipmentId,
                invoiceDate: new Date(),
                netAmount: ediData.amount,
                shipper: {
                    name: ediData.shipperName,
                    address: {
                        street: ediData.shipperAddress,
                        city: ediData.shipperCity,
                        state: ediData.shipperState,
                        zip: ediData.shipperZip
                    }
                },
                consignee: {
                    name: ediData.consigneeName,
                    address: {
                        street: ediData.consigneeAddress,
                        city: ediData.consigneeCity,
                        state: ediData.consigneeState,
                        zip: ediData.consigneeZip
                    }
                },
                billTo: {
                    name: ediData.billToName,
                    address: {
                        street: ediData.shipperAddress,
                        city: ediData.shipperCity,
                        state: ediData.shipperState,
                        zip: ediData.shipperZip
                    }
                },
                shipment: {
                    weight: ediData.weight
                },
                amount: {
                    baseRate: ediData.amount,
                    total: ediData.amount
                }
            };

            const ediContent = generator.generate(fullEdiData);
            const parsedData = generator.parse(ediContent);

            // Save to database
            const ediDoc = new EDIDocument({
                ediType: '210',
                controlNumber: generator.generateControlNumber(),
                ediContent: ediContent,
                parsedData: {
                    invoiceNumber: parsedData.invoiceNumber,
                    shipmentId: parsedData.shipmentId,
                    shipperName: parsedData.shipper?.name,
                    consigneeName: parsedData.consignee?.name,
                    billToName: parsedData.billTo?.name,
                    weight: parsedData.shipment?.weight,
                    amount: parsedData.netAmount || parsedData.amount?.total,
                    shipmentDate: parsedData.shipmentDate,
                    deliveryDate: parsedData.deliveryDate
                },
                status: 'received',
                source: 'claude_ai',
                sourceMetadata: {
                    shipmentType: shipmentType,
                    model: model,
                    intentionalError: shouldHaveError
                },
                receivedAt: new Date()
            });

            await ediDoc.save();

            generatedDocs.push({
                id: ediDoc._id,
                controlNumber: ediDoc.controlNumber,
                invoiceNumber: ediDoc.parsedData.invoiceNumber,
                shipmentId: ediDoc.parsedData.shipmentId,
                shipper: ediDoc.parsedData.shipperName,
                consignee: ediDoc.parsedData.consigneeName,
                weight: ediDoc.parsedData.weight,
                amount: ediDoc.parsedData.amount,
                hasIntentionalError: shouldHaveError,
                status: ediDoc.status
            });
        }

        res.json({
            success: true,
            message: `Generated ${generatedDocs.length} EDI 210 documents using Claude API`,
            shipmentType: shipmentType,
            documents: generatedDocs,
            count: generatedDocs.length,
            errorRate: Math.round(errorRate * 100)
        });

    } catch (error) {
        console.error('Error generating EDI with Claude:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/edi210/documents
 * List EDI documents with paging, sorting, and filtering
 */
router.get('/documents', async (req, res) => {
    try {
        // Parse query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status; // Filter by status
        const source = req.query.source; // Filter by source
        const sortBy = req.query.sortBy || 'receivedAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        // Build filter
        const filter = {};
        if (status) filter.status = status;
        if (source) filter.source = source;

        // Calculate skip
        const skip = (page - 1) * limit;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder;

        // Query database
        const [documents, total] = await Promise.all([
            EDIDocument.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select('-ediContent') // Exclude large content field from list
                .lean(),
            EDIDocument.countDocuments(filter)
        ]);

        // Get statistics
        const stats = await EDIDocument.getStatistics();

        res.json({
            success: true,
            data: documents,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            },
            statistics: stats,
            filter: { status, source }
        });
    } catch (error) {
        console.error('Error listing EDI documents:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/edi210/documents/:id
 * Get specific EDI document with full content
 */
router.get('/documents/:id', async (req, res) => {
    try {
        const doc = await EDIDocument.findById(req.params.id)
            .populate('createdInvoiceId');

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: 'EDI document not found'
            });
        }

        res.json({
            success: true,
            document: doc
        });
    } catch (error) {
        console.error('Error fetching EDI document:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/edi210/process/:id
 * Process an EDI document and create invoice
 */
router.post('/process/:id', async (req, res) => {
    try {
        const doc = await EDIDocument.findById(req.params.id);

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: 'EDI document not found'
            });
        }

        if (doc.status === 'processed_success') {
            return res.status(400).json({
                success: false,
                error: 'This EDI document has already been processed successfully'
            });
        }

        // Update status to processing
        doc.status = 'processing';
        await doc.save();

        // Validate before processing
        const validation = doc.validateForProcessing();
        if (!validation.valid) {
            doc.status = 'validation_error';
            doc.validationErrors = validation.errors;
            await doc.save();

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                validationErrors: validation.errors
            });
        }

        // Parse EDI content
        const generator = new EDI210Generator();
        const parsedData = generator.parse(doc.ediContent);

        // Create invoice with all required fields
        const invoice = new Invoice({
            invoiceNumber: parsedData.invoiceNumber || `INV-${Date.now()}`,
            invoiceDate: parsedData.invoiceDate || new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: 'draft', // Valid status: draft, sent, viewed, partially_paid, paid, overdue, cancelled
            carrier: {
                name: 'EDI Import Carrier',
                scac: 'EDIC'
            },
            customer: {
                name: parsedData.billTo?.name || 'EDI Customer',
                email: 'edi@example.com', // Required field - using placeholder
                company: parsedData.billTo?.name || 'EDI Customer'
            },
            shipment: {
                trackingNumber: parsedData.shipmentId || `TRK-${Date.now()}`,
                origin: {
                    city: parsedData.shipper?.address?.city || '',
                    state: parsedData.shipper?.address?.state || '',
                    zip: parsedData.shipper?.address?.zip || ''
                },
                destination: {
                    city: parsedData.consignee?.address?.city || '',
                    state: parsedData.consignee?.address?.state || '',
                    zip: parsedData.consignee?.address?.zip || ''
                },
                weight: parsedData.shipment?.weight || 0,
                weightUnit: 'lbs'
            },
            amount: {
                baseRate: parsedData.amount?.baseRate || parsedData.netAmount || 0,
                fuelSurcharge: 0,
                accessorialCharges: 0,
                tax: 0,
                discount: 0
            },
            terms: 'Net 30',
            notes: `Generated from EDI 210 document (ID: ${doc._id})`
        });

        await invoice.save();

        // Mark EDI document as processed
        await doc.markProcessed(true, invoice._id);

        res.json({
            success: true,
            message: 'Invoice created from EDI 210 document',
            ediDocument: {
                id: doc._id,
                status: doc.status,
                processedAt: doc.processedAt
            },
            invoice: {
                id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: invoice.totalAmount
            }
        });
    } catch (error) {
        console.error('Error processing EDI document:', error);

        // Update EDI document with error
        try {
            const doc = await EDIDocument.findById(req.params.id);
            if (doc) {
                await doc.markProcessed(false, null, error);
            }
        } catch (updateError) {
            console.error('Error updating EDI document status:', updateError);
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/edi210/statistics
 * Get EDI document statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const stats = await EDIDocument.getStatistics();

        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
