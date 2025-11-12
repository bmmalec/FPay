const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const Payment = require('./models/Payment');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rallyadmin:h0Gsl9Eb25pU3ubi@rallydevcluster.nmgh40m.mongodb.net/fpay-dev?retryWrites=true&w=majority&appName=RallyDevCluster';

// Sample invoice data
const sampleInvoices = [
    {
        invoiceNumber: 'INV-2025-001',
        shipment: {
            origin: {
                address: '1234 Warehouse Rd',
                city: 'Los Angeles',
                state: 'CA',
                zip: '90001',
                country: 'USA'
            },
            destination: {
                address: '5678 Delivery St',
                city: 'New York',
                state: 'NY',
                zip: '10001',
                country: 'USA'
            },
            trackingNumber: 'TRK-LA-NY-001',
            weight: 1500,
            weightUnit: 'lbs',
            dimensions: {
                length: 48,
                width: 40,
                height: 36,
                unit: 'in'
            }
        },
        carrier: {
            name: 'FedEx Freight',
            scac: 'FXFE',
            carrierReference: 'REF-FEDEX-001'
        },
        customer: {
            name: 'ABC Manufacturing',
            email: 'billing@abcmfg.com',
            phone: '555-0100',
            company: 'ABC Manufacturing Inc.',
            accountNumber: 'ACC-12345'
        },
        amount: {
            baseRate: 850.00,
            fuelSurcharge: 127.50,
            accessorialCharges: 50.00,
            tax: 82.00,
            discount: 0
        },
        status: 'sent',
        dueDate: new Date('2025-12-15'),
        issueDate: new Date('2025-11-01'),
        terms: 'Net 30'
    },
    {
        invoiceNumber: 'INV-2025-002',
        shipment: {
            origin: {
                address: '9876 Factory Ln',
                city: 'Chicago',
                state: 'IL',
                zip: '60601',
                country: 'USA'
            },
            destination: {
                address: '3456 Distribution Dr',
                city: 'Dallas',
                state: 'TX',
                zip: '75201',
                country: 'USA'
            },
            trackingNumber: 'TRK-CHI-DAL-002',
            weight: 2200,
            weightUnit: 'lbs',
            dimensions: {
                length: 52,
                width: 48,
                height: 42,
                unit: 'in'
            }
        },
        carrier: {
            name: 'UPS Freight',
            scac: 'UPGF',
            carrierReference: 'REF-UPS-002'
        },
        customer: {
            name: 'XYZ Electronics',
            email: 'ap@xyzelectronics.com',
            phone: '555-0200',
            company: 'XYZ Electronics Corp.',
            accountNumber: 'ACC-67890'
        },
        amount: {
            baseRate: 1200.00,
            fuelSurcharge: 180.00,
            accessorialCharges: 75.00,
            tax: 116.40,
            discount: 50.00
        },
        status: 'paid',
        dueDate: new Date('2025-12-20'),
        issueDate: new Date('2025-11-05'),
        paidDate: new Date('2025-11-10'),
        terms: 'Net 30'
    },
    {
        invoiceNumber: 'INV-2025-003',
        shipment: {
            origin: {
                address: '7890 Port Access Rd',
                city: 'Seattle',
                state: 'WA',
                zip: '98101',
                country: 'USA'
            },
            destination: {
                address: '2345 Commerce Blvd',
                city: 'Miami',
                state: 'FL',
                zip: '33101',
                country: 'USA'
            },
            trackingNumber: 'TRK-SEA-MIA-003',
            weight: 3500,
            weightUnit: 'lbs',
            dimensions: {
                length: 60,
                width: 48,
                height: 48,
                unit: 'in'
            }
        },
        carrier: {
            name: 'Old Dominion Freight',
            scac: 'ODFL',
            carrierReference: 'REF-ODFL-003'
        },
        customer: {
            name: 'Global Imports LLC',
            email: 'payments@globalimports.com',
            phone: '555-0300',
            company: 'Global Imports LLC',
            accountNumber: 'ACC-24680'
        },
        amount: {
            baseRate: 1850.00,
            fuelSurcharge: 277.50,
            accessorialCharges: 125.00,
            tax: 180.20,
            discount: 100.00
        },
        status: 'sent',
        dueDate: new Date('2025-12-25'),
        issueDate: new Date('2025-11-08'),
        terms: 'Net 45'
    }
];

async function seedDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await Invoice.deleteMany({});
        await Payment.deleteMany({});
        console.log('✅ Cleared existing data');

        // Insert invoices
        console.log('📄 Creating sample invoices...');
        const createdInvoices = await Invoice.insertMany(sampleInvoices);
        console.log(`✅ Created ${createdInvoices.length} invoices`);

        // Create payments for paid invoice
        console.log('💳 Creating sample payments...');
        const paidInvoice = createdInvoices.find(inv => inv.status === 'paid');

        if (paidInvoice) {
            const samplePayment = {
                invoiceId: paidInvoice._id,
                amount: paidInvoice.totalAmount,
                currency: 'USD',
                paymentMethod: 'ach',
                status: 'completed',
                transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                paymentDate: paidInvoice.paidDate,
                payer: {
                    name: paidInvoice.customer.name,
                    email: paidInvoice.customer.email,
                    phone: paidInvoice.customer.phone,
                    company: paidInvoice.customer.company
                },
                processingFee: 15.00,
                notes: 'Payment processed via ACH transfer'
            };

            await Payment.create(samplePayment);
            console.log('✅ Created 1 payment');
        }

        // Display summary
        console.log('\n📊 Database Seeding Summary:');
        console.log('================================');
        console.log(`Invoices: ${createdInvoices.length}`);
        createdInvoices.forEach(inv => {
            console.log(`  - ${inv.invoiceNumber}: $${inv.totalAmount.toFixed(2)} (${inv.status})`);
        });

        const paymentCount = await Payment.countDocuments();
        console.log(`\nPayments: ${paymentCount}`);

        const payments = await Payment.find().populate('invoiceId');
        payments.forEach(pay => {
            console.log(`  - ${pay.transactionId}: $${pay.totalAmount.toFixed(2)} (${pay.status})`);
        });

        console.log('\n✅ Database seeding completed successfully!');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the seed script
seedDatabase();
