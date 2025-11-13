const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const EDI210Generator = require('../utils/edi210Generator');
const Invoice = require('../models/Invoice');

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

module.exports = router;
