/**
 * EDI 210 Motor Carrier Freight Details and Invoice Generator
 * Standard format for freight billing in transportation industry
 */

const fs = require('fs').promises;
const path = require('path');

class EDI210Generator {
    constructor() {
        this.segmentTerminator = '~';
        this.elementSeparator = '*';
        this.controlNumber = this.generateControlNumber();
    }

    generateControlNumber() {
        return Math.floor(100000000 + Math.random() * 900000000).toString();
    }

    pad(str, length, char = '0') {
        return str.toString().padStart(length, char);
    }

    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear().toString().slice(-2);
        const month = this.pad(d.getMonth() + 1, 2);
        const day = this.pad(d.getDate(), 2);
        return `${year}${month}${day}`;
    }

    formatTime(date) {
        const d = new Date(date);
        const hours = this.pad(d.getHours(), 2);
        const minutes = this.pad(d.getMinutes(), 2);
        return `${hours}${minutes}`;
    }

    /**
     * Generate EDI 210 from invoice data
     * @param {Object} data - Invoice data
     * @returns {String} EDI 210 formatted string
     */
    generate(data) {
        const segments = [];
        const interchangeControl = this.generateControlNumber();
        const groupControl = this.generateControlNumber();
        const transactionControl = this.generateControlNumber();
        const currentDate = new Date();

        // ISA - Interchange Control Header
        segments.push([
            'ISA',
            '00', '          ', // Authorization info
            '00', '          ', // Security info
            'ZZ', this.pad(data.senderId || 'FPAY', 15),
            'ZZ', this.pad(data.receiverId || 'CARRIER', 15),
            this.formatDate(currentDate),
            this.formatTime(currentDate),
            'U', // Standards ID
            '00401', // Version
            interchangeControl,
            '0', // Acknowledgment requested
            'P', // Usage indicator (P=Production, T=Test)
            ':'
        ].join(this.elementSeparator));

        // GS - Functional Group Header
        segments.push([
            'GS',
            'QM', // Motor Carrier Load Tender
            data.senderId || 'FPAY',
            data.receiverId || 'CARRIER',
            this.formatDate(currentDate),
            this.formatTime(currentDate),
            groupControl,
            'X',
            '004010'
        ].join(this.elementSeparator));

        // ST - Transaction Set Header
        segments.push([
            'ST',
            '210', // Transaction set identifier code
            transactionControl
        ].join(this.elementSeparator));

        // B3 - Beginning Segment for Carriers Invoice
        segments.push([
            'B3',
            data.invoiceNumber || this.generateControlNumber(),
            data.shipmentId || this.generateControlNumber(),
            '', // Standard Carrier Alpha Code
            this.formatDate(data.invoiceDate || currentDate),
            data.netAmount || data.amount?.total || 0,
            'PP', // Payment method code (PP=Prepaid)
            'L' // Shipment method of payment (L=Lump Sum)
        ].join(this.elementSeparator));

        // N9 - Reference Identification
        if (data.referenceNumber || data.proNumber) {
            segments.push([
                'N9',
                'BM', // Reference ID Qualifier (BM=Bill of Lading Number)
                data.referenceNumber || data.proNumber || data.shipmentId
            ].join(this.elementSeparator));
        }

        // G62 - Date/Time
        segments.push([
            'G62',
            '10', // Date Qualifier (10=Shipped)
            this.formatDate(data.shipmentDate || data.pickupDate || currentDate)
        ].join(this.elementSeparator));

        if (data.deliveryDate) {
            segments.push([
                'G62',
                '70', // Date Qualifier (70=Delivery Requested)
                this.formatDate(data.deliveryDate)
            ].join(this.elementSeparator));
        }

        // N1 Loop - Shipper
        if (data.shipper) {
            segments.push([
                'N1',
                'SH', // Entity Identifier Code (SH=Shipper)
                data.shipper.name || ''
            ].join(this.elementSeparator));

            if (data.shipper.address) {
                segments.push([
                    'N3',
                    data.shipper.address.street || ''
                ].join(this.elementSeparator));

                segments.push([
                    'N4',
                    data.shipper.address.city || '',
                    data.shipper.address.state || '',
                    data.shipper.address.zip || ''
                ].join(this.elementSeparator));
            }
        }

        // N1 Loop - Consignee
        if (data.consignee) {
            segments.push([
                'N1',
                'CN', // Entity Identifier Code (CN=Consignee)
                data.consignee.name || ''
            ].join(this.elementSeparator));

            if (data.consignee.address) {
                segments.push([
                    'N3',
                    data.consignee.address.street || ''
                ].join(this.elementSeparator));

                segments.push([
                    'N4',
                    data.consignee.address.city || '',
                    data.consignee.address.state || '',
                    data.consignee.address.zip || ''
                ].join(this.elementSeparator));
            }
        }

        // N1 Loop - Bill To
        if (data.billTo || data.customer) {
            const billTo = data.billTo || data.customer;
            segments.push([
                'N1',
                'BT', // Entity Identifier Code (BT=Bill-to-Party)
                billTo.name || ''
            ].join(this.elementSeparator));

            if (billTo.address) {
                segments.push([
                    'N3',
                    billTo.address.street || ''
                ].join(this.elementSeparator));

                segments.push([
                    'N4',
                    billTo.address.city || '',
                    billTo.address.state || '',
                    billTo.address.zip || ''
                ].join(this.elementSeparator));
            }
        }

        // LX Loop - Line Items
        const lineItems = data.lineItems || this.createDefaultLineItem(data);
        lineItems.forEach((item, index) => {
            // LX - Assigned Number
            segments.push([
                'LX',
                (index + 1).toString()
            ].join(this.elementSeparator));

            // L5 - Description
            segments.push([
                'L5',
                '1', // Lading Line Item Number
                item.description || 'FREIGHT CHARGES',
                item.commodityCode || 'FAK' // Freight All Kinds
            ].join(this.elementSeparator));

            // L0 - Line Item - Quantity and Weight
            segments.push([
                'L0',
                item.quantity || 1,
                item.ladingQuantity || 1,
                'PLT', // Packaging form code (PLT=Pallet)
                item.weight || 0,
                'L', // Weight Unit Code (L=Pounds)
                '', // Volume
                '', // Volume Unit Qualifier
                item.quantity || 1,
                'PC' // Packaging form code for count (PC=Piece)
            ].join(this.elementSeparator));

            // L1 - Rate and Charges
            segments.push([
                'L1',
                '', // Lading Line Item Number
                item.chargeAmount || item.amount || 0,
                'FR', // Freight Rate Qualifier
                item.rateAmount || item.rate || 0,
                '', // Rate Value Qualifier
                '', // Charge
                'L' // Special Charge Code (L=Lump Sum)
            ].join(this.elementSeparator));
        });

        // L3 - Total Weight and Charges
        const totalWeight = lineItems.reduce((sum, item) => sum + (item.weight || 0), 0);
        const totalCharges = data.netAmount || data.amount?.total ||
            lineItems.reduce((sum, item) => sum + (item.chargeAmount || item.amount || 0), 0);

        segments.push([
            'L3',
            totalWeight,
            'L', // Weight Unit Code
            '', // Freight Rate
            '', // Rate/Value Qualifier
            totalCharges,
            '', // Charges
            '', // Advances
            '', // Prepaid Amount
            '', // Special Charge Description
            '', // Volume
            '', // Volume Unit Qualifier
            '', // Lading Quantity
            'PLT' // Weight Qualifier
        ].join(this.elementSeparator));

        // SE - Transaction Set Trailer
        segments.push([
            'SE',
            (segments.length - 2 + 1).toString(), // Number of included segments
            transactionControl
        ].join(this.elementSeparator));

        // GE - Functional Group Trailer
        segments.push([
            'GE',
            '1', // Number of transaction sets
            groupControl
        ].join(this.elementSeparator));

        // IEA - Interchange Control Trailer
        segments.push([
            'IEA',
            '1', // Number of functional groups
            interchangeControl
        ].join(this.elementSeparator));

        return segments.join(this.segmentTerminator) + this.segmentTerminator;
    }

    createDefaultLineItem(data) {
        return [{
            description: 'FREIGHT CHARGES',
            commodityCode: 'FAK',
            quantity: 1,
            ladingQuantity: 1,
            weight: data.shipment?.weight || 1000,
            chargeAmount: data.amount?.baseRate || data.netAmount || 0,
            rateAmount: data.amount?.baseRate || data.netAmount || 0
        }];
    }

    /**
     * Save EDI 210 file to disk
     * @param {String} ediContent - EDI 210 content
     * @param {String} filename - Filename (optional)
     * @returns {Promise<String>} File path
     */
    async saveToFile(ediContent, filename) {
        // Azure App Service: /home/site/wwwroot is read-only
        // Use /home/edi_files for writable persistent storage
        const ediDir = process.env.EDI_FILES_PATH || path.join('/home', 'edi_files');

        // Create directory if it doesn't exist - with robust error handling
        try {
            await fs.mkdir(ediDir, { recursive: true });
            console.log('✅ EDI directory ready:', ediDir);
        } catch (error) {
            // If mkdir fails, try to check if directory exists
            try {
                await fs.access(ediDir);
                console.log('✅ EDI directory already exists:', ediDir);
            } catch (accessError) {
                console.error('❌ Error creating/accessing EDI directory:', error.message);
                throw new Error(`Cannot create EDI directory: ${error.message}`);
            }
        }

        const fileName = filename || `EDI210_${Date.now()}.edi`;
        const filePath = path.join(ediDir, fileName);

        try {
            await fs.writeFile(filePath, ediContent, 'utf8');
            console.log('✅ EDI file saved:', fileName);
        } catch (error) {
            console.error('❌ Error writing EDI file:', error.message);
            throw new Error(`Cannot write EDI file: ${error.message}`);
        }

        return filePath;
    }

    /**
     * Parse EDI 210 file and extract invoice data
     * @param {String} ediContent - EDI 210 content
     * @returns {Object} Parsed invoice data
     */
    parse(ediContent) {
        const segments = ediContent.split(this.segmentTerminator).filter(s => s.trim());
        const data = {
            lineItems: [],
            amount: {}
        };

        let currentLineItem = null;

        segments.forEach(segment => {
            const elements = segment.split(this.elementSeparator);
            const segmentId = elements[0];

            switch (segmentId) {
                case 'B3':
                    data.invoiceNumber = elements[1];
                    data.shipmentId = elements[2];
                    data.invoiceDate = this.parseDate(elements[4]);
                    data.netAmount = parseFloat(elements[5]) || 0;
                    break;

                case 'N9':
                    if (elements[1] === 'BM') {
                        data.referenceNumber = elements[2];
                    }
                    break;

                case 'G62':
                    if (elements[1] === '10') {
                        data.shipmentDate = this.parseDate(elements[2]);
                    } else if (elements[1] === '70') {
                        data.deliveryDate = this.parseDate(elements[2]);
                    }
                    break;

                case 'N1':
                    const entityType = elements[1];
                    const entityName = elements[2];

                    if (entityType === 'SH') {
                        data.shipper = { name: entityName, address: {} };
                    } else if (entityType === 'CN') {
                        data.consignee = { name: entityName, address: {} };
                    } else if (entityType === 'BT') {
                        data.billTo = { name: entityName, address: {} };
                    }
                    break;

                case 'N3':
                    // Address line - add to the most recently defined entity
                    const addressLine = elements[1];
                    if (data.billTo && !data.billTo.address.street) {
                        data.billTo.address.street = addressLine;
                    } else if (data.consignee && !data.consignee.address.street) {
                        data.consignee.address.street = addressLine;
                    } else if (data.shipper && !data.shipper.address.street) {
                        data.shipper.address.street = addressLine;
                    }
                    break;

                case 'N4':
                    // City, State, Zip
                    const city = elements[1];
                    const state = elements[2];
                    const zip = elements[3];

                    if (data.billTo && data.billTo.address.street && !data.billTo.address.city) {
                        data.billTo.address.city = city;
                        data.billTo.address.state = state;
                        data.billTo.address.zip = zip;
                    } else if (data.consignee && data.consignee.address.street && !data.consignee.address.city) {
                        data.consignee.address.city = city;
                        data.consignee.address.state = state;
                        data.consignee.address.zip = zip;
                    } else if (data.shipper && data.shipper.address.street && !data.shipper.address.city) {
                        data.shipper.address.city = city;
                        data.shipper.address.state = state;
                        data.shipper.address.zip = zip;
                    }
                    break;

                case 'LX':
                    // Start new line item
                    if (currentLineItem) {
                        data.lineItems.push(currentLineItem);
                    }
                    currentLineItem = {};
                    break;

                case 'L5':
                    if (currentLineItem) {
                        currentLineItem.description = elements[2];
                        currentLineItem.commodityCode = elements[3];
                    }
                    break;

                case 'L0':
                    if (currentLineItem) {
                        currentLineItem.quantity = parseInt(elements[1]) || 1;
                        currentLineItem.weight = parseFloat(elements[4]) || 0;
                    }
                    break;

                case 'L1':
                    if (currentLineItem) {
                        currentLineItem.chargeAmount = parseFloat(elements[2]) || 0;
                        currentLineItem.rateAmount = parseFloat(elements[4]) || 0;
                    }
                    break;

                case 'L3':
                    const totalWeight = parseFloat(elements[1]) || 0;
                    const totalCharges = parseFloat(elements[5]) || 0;

                    data.shipment = data.shipment || {};
                    data.shipment.weight = totalWeight;
                    data.amount.total = totalCharges;
                    data.amount.baseRate = totalCharges;
                    break;
            }
        });

        // Add last line item
        if (currentLineItem && Object.keys(currentLineItem).length > 0) {
            data.lineItems.push(currentLineItem);
        }

        return data;
    }

    parseDate(yymmdd) {
        if (!yymmdd || yymmdd.length !== 6) return null;

        const yy = yymmdd.substring(0, 2);
        const mm = yymmdd.substring(2, 4);
        const dd = yymmdd.substring(4, 6);

        // Assume 20xx for years
        const year = `20${yy}`;

        return new Date(`${year}-${mm}-${dd}`);
    }
}

module.exports = EDI210Generator;
