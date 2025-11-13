const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create edi_files directory on startup if it doesn't exist
const ediDir = path.join(__dirname, 'edi_files');
try {
    if (!fs.existsSync(ediDir)) {
        fs.mkdirSync(ediDir, { recursive: true });
        console.log('✅ Created edi_files directory:', ediDir);
    } else {
        console.log('✅ edi_files directory exists:', ediDir);
    }
} catch (error) {
    console.warn('⚠️ Could not create edi_files directory on startup:', error.message);
    console.warn('⚠️ Directory will be created on first use');
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for static HTML
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rallyadmin:h0Gsl9Eb25pU3ubi@rallydevcluster.nmgh40m.mongodb.net/fpay-dev?retryWrites=true&w=majority&appName=RallyDevCluster';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ Successfully connected to MongoDB');
    console.log('📊 Database: fpay-dev');
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
});

// Import routes
const paymentsRouter = require('./routes/payments');
const invoicesRouter = require('./routes/invoices');
const edi210Router = require('./routes/edi210');

// API Routes
app.use('/api/payments', paymentsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/edi210', edi210Router);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'FPay Freight Payment Platform API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            payments: '/api/payments',
            invoices: '/api/invoices',
            edi210: '/api/edi210'
        }
    });
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// 404 handler for other routes
app.use('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 FPay server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
});

module.exports = app;
