/**
 * Quick test script for EDI 210 functionality
 */

const EDI210Generator = require('./utils/edi210Generator');

console.log('Testing EDI 210 Generator...\n');

const generator = new EDI210Generator();

// Sample freight data
const sampleData = {
    invoiceNumber: 'INV-TEST-001',
    shipmentId: 'SHIP-TEST-001',
    invoiceDate: new Date(),
    netAmount: 1250.50,
    referenceNumber: 'REF-12345',
    proNumber: 'PRO-98765',
    shipper: {
        name: 'ABC Manufacturing',
        address: {
            street: '123 Industrial Way',
            city: 'Los Angeles',
            state: 'CA',
            zip: '90001'
        }
    },
    consignee: {
        name: 'XYZ Distribution Center',
        address: {
            street: '456 Warehouse Blvd',
            city: 'New York',
            state: 'NY',
            zip: '10001'
        }
    },
    billTo: {
        name: 'Customer Corp Inc.',
        address: {
            street: '789 Business Ave',
            city: 'New York',
            state: 'NY',
            zip: '10002'
        }
    },
    shipment: {
        weight: 2500,
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    },
    amount: {
        baseRate: 1000.00,
        fuelSurcharge: 150.00,
        accessorialCharges: 100.50,
        total: 1250.50
    },
    lineItems: [{
        description: 'FREIGHT - VAN',
        commodityCode: 'FAK',
        quantity: 10,
        weight: 2500,
        chargeAmount: 1250.50,
        rateAmount: 1000.00
    }]
};

console.log('Generating EDI 210 file...');
const ediContent = generator.generate(sampleData);

console.log('\n--- Generated EDI 210 Content ---');
console.log(ediContent);
console.log('\n--- End of EDI 210 Content ---\n');

console.log('Testing EDI 210 parser...');
const parsedData = generator.parse(ediContent);

console.log('\n--- Parsed Data ---');
console.log(JSON.stringify(parsedData, null, 2));
console.log('\n--- End of Parsed Data ---\n');

console.log('Validation:');
console.log(`✓ Invoice Number: ${parsedData.invoiceNumber === sampleData.invoiceNumber ? 'PASS' : 'FAIL'}`);
console.log(`✓ Shipment ID: ${parsedData.shipmentId === sampleData.shipmentId ? 'PASS' : 'FAIL'}`);
console.log(`✓ Net Amount: ${parsedData.netAmount === sampleData.netAmount ? 'PASS' : 'FAIL'}`);
console.log(`✓ Shipper Name: ${parsedData.shipper?.name === sampleData.shipper.name ? 'PASS' : 'FAIL'}`);
console.log(`✓ Consignee Name: ${parsedData.consignee?.name === sampleData.consignee.name ? 'PASS' : 'FAIL'}`);
console.log(`✓ Bill-To Name: ${parsedData.billTo?.name === sampleData.billTo.name ? 'PASS' : 'FAIL'}`);
console.log(`✓ Line Items: ${parsedData.lineItems?.length > 0 ? 'PASS' : 'FAIL'}`);

console.log('\n✅ EDI 210 Generator test completed!');
