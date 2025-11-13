const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const EDI210Generator = require('../utils/edi210Generator');
const Invoice = require('../models/Invoice');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * POST /api/edi210/generate
 * Generate EDI 210 file from invoice data
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

        // Generate filename
        const fileName = `EDI210_${invoiceData.invoiceNumber || Date.now()}.edi`;
        const filePath = await generator.saveToFile(ediContent, fileName);

        res.json({
            success: true,
            message: 'EDI 210 file generated successfully',
            fileName: fileName,
            filePath: filePath,
            ediContent: ediContent
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
 * POST /api/edi210/generate-from-invoice/:id
 * Generate EDI 210 from existing invoice in database
 */
router.post('/generate-from-invoice/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Map invoice to EDI format
        const invoiceData = {
            invoiceNumber: invoice.invoiceNumber,
            shipmentId: invoice.shipment.trackingNumber,
            invoiceDate: invoice.invoiceDate,
            shipmentDate: invoice.shipment.pickupDate,
            deliveryDate: invoice.shipment.deliveryDate,
            netAmount: invoice.amount.baseRate + invoice.amount.fuelSurcharge + invoice.amount.accessorialCharges,
            referenceNumber: invoice.shipment.referenceNumber,
            proNumber: invoice.shipment.proNumber,
            shipper: {
                name: invoice.shipper.name,
                address: {
                    street: invoice.shipper.address.street,
                    city: invoice.shipper.address.city,
                    state: invoice.shipper.address.state,
                    zip: invoice.shipper.address.zip
                }
            },
            consignee: {
                name: invoice.consignee.name,
                address: {
                    street: invoice.consignee.address.street,
                    city: invoice.consignee.address.city,
                    state: invoice.consignee.address.state,
                    zip: invoice.consignee.address.zip
                }
            },
            billTo: {
                name: invoice.customer.name,
                address: {
                    street: invoice.customer.address.street,
                    city: invoice.customer.address.city,
                    state: invoice.customer.address.state,
                    zip: invoice.customer.address.zip
                }
            },
            shipment: {
                weight: invoice.shipment.weight
            },
            amount: {
                baseRate: invoice.amount.baseRate,
                total: invoice.amount.baseRate + invoice.amount.fuelSurcharge + invoice.amount.accessorialCharges
            },
            lineItems: [{
                description: `${invoice.shipment.equipmentType} Freight`,
                commodityCode: 'FAK',
                quantity: 1,
                weight: invoice.shipment.weight,
                chargeAmount: invoice.amount.baseRate + invoice.amount.fuelSurcharge + invoice.amount.accessorialCharges,
                rateAmount: invoice.amount.baseRate
            }]
        };

        const generator = new EDI210Generator();
        const ediContent = generator.generate(invoiceData);

        const fileName = `EDI210_${invoice.invoiceNumber}_${Date.now()}.edi`;
        const filePath = await generator.saveToFile(ediContent, fileName);

        res.json({
            success: true,
            message: 'EDI 210 file generated from invoice',
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            fileName: fileName,
            filePath: filePath,
            ediContent: ediContent
        });
    } catch (error) {
        console.error('Error generating EDI 210 from invoice:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/edi210/process
 * Process EDI 210 file and create invoice
 */
router.post('/process', async (req, res) => {
    try {
        const { fileName, ediContent } = req.body;

        if (!ediContent) {
            return res.status(400).json({
                success: false,
                error: 'EDI content is required'
            });
        }

        const generator = new EDI210Generator();
        const parsedData = generator.parse(ediContent);

        // Create invoice from parsed EDI data
        const invoice = new Invoice({
            invoiceNumber: parsedData.invoiceNumber || `INV-${Date.now()}`,
            invoiceDate: parsedData.invoiceDate || new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: 'pending',
            carrier: {
                name: 'EDI Import Carrier',
                scac: 'EDIC',
                dot: '0000000'
            },
            customer: {
                name: parsedData.billTo?.name || 'EDI Customer',
                customerId: 'EDI-CUST',
                address: {
                    street: parsedData.billTo?.address?.street || '',
                    city: parsedData.billTo?.address?.city || '',
                    state: parsedData.billTo?.address?.state || '',
                    zip: parsedData.billTo?.address?.zip || ''
                }
            },
            shipment: {
                trackingNumber: parsedData.shipmentId || `TRK-${Date.now()}`,
                referenceNumber: parsedData.referenceNumber || '',
                proNumber: parsedData.shipmentId || '',
                pickupDate: parsedData.shipmentDate || new Date(),
                deliveryDate: parsedData.deliveryDate || new Date(),
                equipmentType: 'Van',
                weight: parsedData.shipment?.weight || 0,
                pieces: parsedData.lineItems?.[0]?.quantity || 1
            },
            shipper: {
                name: parsedData.shipper?.name || 'EDI Shipper',
                address: {
                    street: parsedData.shipper?.address?.street || '',
                    city: parsedData.shipper?.address?.city || '',
                    state: parsedData.shipper?.address?.state || '',
                    zip: parsedData.shipper?.address?.zip || ''
                }
            },
            consignee: {
                name: parsedData.consignee?.name || 'EDI Consignee',
                address: {
                    street: parsedData.consignee?.address?.street || '',
                    city: parsedData.consignee?.address?.city || '',
                    state: parsedData.consignee?.address?.state || '',
                    zip: parsedData.consignee?.address?.zip || ''
                }
            },
            amount: {
                baseRate: parsedData.amount?.baseRate || parsedData.netAmount || 0,
                fuelSurcharge: 0,
                accessorialCharges: 0,
                tax: 0,
                discount: 0
            },
            notes: `Generated from EDI 210 file${fileName ? `: ${fileName}` : ''}`
        });

        await invoice.save();

        res.json({
            success: true,
            message: 'Invoice created from EDI 210 file',
            invoice: invoice,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber
        });
    } catch (error) {
        console.error('Error processing EDI 210:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/edi210/files
 * List all EDI 210 files
 */
router.get('/files', async (req, res) => {
    try {
        const ediDir = path.join(__dirname, '..', 'edi_files');

        // Create directory if it doesn't exist
        try {
            await fs.mkdir(ediDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        const files = await fs.readdir(ediDir);
        const ediFiles = files.filter(file => file.endsWith('.edi'));

        const fileDetails = await Promise.all(
            ediFiles.map(async (file) => {
                const filePath = path.join(ediDir, file);
                const stats = await fs.stat(filePath);
                return {
                    fileName: file,
                    filePath: filePath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            })
        );

        res.json({
            success: true,
            files: fileDetails,
            count: fileDetails.length
        });
    } catch (error) {
        console.error('Error listing EDI files:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/edi210/files/:fileName
 * Get specific EDI 210 file content
 */
router.get('/files/:fileName', async (req, res) => {
    try {
        const ediDir = path.join(__dirname, '..', 'edi_files');
        const filePath = path.join(ediDir, req.params.fileName);

        const content = await fs.readFile(filePath, 'utf8');

        res.json({
            success: true,
            fileName: req.params.fileName,
            content: content
        });
    } catch (error) {
        console.error('Error reading EDI file:', error);
        res.status(404).json({
            success: false,
            error: 'File not found'
        });
    }
});

/**
 * POST /api/edi210/process-file/:fileName
 * Process a specific EDI file by filename
 */
router.post('/process-file/:fileName', async (req, res) => {
    try {
        const ediDir = path.join(__dirname, '..', 'edi_files');
        const filePath = path.join(ediDir, req.params.fileName);

        const ediContent = await fs.readFile(filePath, 'utf8');

        // Process using the existing process endpoint logic
        const generator = new EDI210Generator();
        const parsedData = generator.parse(ediContent);

        const invoice = new Invoice({
            invoiceNumber: parsedData.invoiceNumber || `INV-${Date.now()}`,
            invoiceDate: parsedData.invoiceDate || new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'pending',
            carrier: {
                name: 'EDI Import Carrier',
                scac: 'EDIC',
                dot: '0000000'
            },
            customer: {
                name: parsedData.billTo?.name || 'EDI Customer',
                customerId: 'EDI-CUST',
                address: {
                    street: parsedData.billTo?.address?.street || '',
                    city: parsedData.billTo?.address?.city || '',
                    state: parsedData.billTo?.address?.state || '',
                    zip: parsedData.billTo?.address?.zip || ''
                }
            },
            shipment: {
                trackingNumber: parsedData.shipmentId || `TRK-${Date.now()}`,
                referenceNumber: parsedData.referenceNumber || '',
                proNumber: parsedData.shipmentId || '',
                pickupDate: parsedData.shipmentDate || new Date(),
                deliveryDate: parsedData.deliveryDate || new Date(),
                equipmentType: 'Van',
                weight: parsedData.shipment?.weight || 0,
                pieces: parsedData.lineItems?.[0]?.quantity || 1
            },
            shipper: {
                name: parsedData.shipper?.name || 'EDI Shipper',
                address: {
                    street: parsedData.shipper?.address?.street || '',
                    city: parsedData.shipper?.address?.city || '',
                    state: parsedData.shipper?.address?.state || '',
                    zip: parsedData.shipper?.address?.zip || ''
                }
            },
            consignee: {
                name: parsedData.consignee?.name || 'EDI Consignee',
                address: {
                    street: parsedData.consignee?.address?.street || '',
                    city: parsedData.consignee?.address?.city || '',
                    state: parsedData.consignee?.address?.state || '',
                    zip: parsedData.consignee?.address?.zip || ''
                }
            },
            amount: {
                baseRate: parsedData.amount?.baseRate || parsedData.netAmount || 0,
                fuelSurcharge: 0,
                accessorialCharges: 0,
                tax: 0,
                discount: 0
            },
            notes: `Generated from EDI 210 file: ${req.params.fileName}`
        });

        await invoice.save();

        res.json({
            success: true,
            message: 'Invoice created from EDI 210 file',
            fileName: req.params.fileName,
            invoice: invoice,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber
        });
    } catch (error) {
        console.error('Error processing EDI file:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/edi210/generate-with-claude
 * Generate EDI 210 files using Claude API for realistic freight data
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

        const anthropic = new Anthropic({
            apiKey: apiKey
        });

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
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        // Extract JSON from Claude's response
        let responseText = message.content[0].text;

        // Try to extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                         responseText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            responseText = jsonMatch[1];
        }

        const shipmentData = JSON.parse(responseText);

        if (!Array.isArray(shipmentData)) {
            throw new Error('Invalid response format from Claude API');
        }

        // Generate EDI 210 files for each shipment
        const generator = new EDI210Generator();
        const generatedFiles = [];

        for (const shipment of shipmentData) {
            const ediData = {
                invoiceNumber: shipment.invoiceNumber,
                shipmentId: shipment.shipmentId,
                invoiceDate: new Date(),
                netAmount: shipment.amount,
                shipper: {
                    name: shipment.shipperName,
                    address: {
                        street: shipment.shipperAddress,
                        city: shipment.shipperCity,
                        state: shipment.shipperState,
                        zip: shipment.shipperZip
                    }
                },
                consignee: {
                    name: shipment.consigneeName,
                    address: {
                        street: shipment.consigneeAddress,
                        city: shipment.consigneeCity,
                        state: shipment.consigneeState,
                        zip: shipment.consigneeZip
                    }
                },
                billTo: {
                    name: shipment.billToName,
                    address: {
                        street: shipment.shipperAddress,
                        city: shipment.shipperCity,
                        state: shipment.shipperState,
                        zip: shipment.shipperZip
                    }
                },
                shipment: {
                    weight: shipment.weight
                },
                amount: {
                    baseRate: shipment.amount,
                    total: shipment.amount
                }
            };

            const ediContent = generator.generate(ediData);
            const fileName = `EDI210_${shipment.invoiceNumber}_${Date.now()}.edi`;
            const filePath = await generator.saveToFile(ediContent, fileName);

            generatedFiles.push({
                fileName: fileName,
                invoiceNumber: shipment.invoiceNumber,
                shipmentId: shipment.shipmentId,
                shipper: shipment.shipperName,
                consignee: shipment.consigneeName,
                weight: shipment.weight,
                amount: shipment.amount
            });
        }

        res.json({
            success: true,
            message: `Generated ${generatedFiles.length} EDI 210 files using Claude API`,
            shipmentType: shipmentType,
            files: generatedFiles,
            count: generatedFiles.length
        });

    } catch (error) {
        console.error('Error generating EDI with Claude:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
