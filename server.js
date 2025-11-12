const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://rallyadmin:h0Gsl9Eb25pU3ubi@rallydevcluster.nmgh40m.mongodb.net/fpay-dev?retryWrites=true&w=majority&appName=RallyDevCluster';

// MongoDB client
let db;
let testCollection;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected successfully to MongoDB');

    db = client.db('fpay-dev');
    testCollection = db.collection('test_records');

    // Create a test record
    await createTestRecord();

  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Create a test record in the database
async function createTestRecord() {
  try {
    // Clear existing test records (optional)
    await testCollection.deleteMany({});

    // Insert a new test record
    const testRecord = {
      name: 'FPay Test Record',
      type: 'payment',
      amount: 100.00,
      currency: 'USD',
      status: 'active',
      createdAt: new Date(),
      metadata: {
        description: 'This is a test record for FPay MongoDB integration',
        version: '1.0'
      }
    };

    const result = await testCollection.insertOne(testRecord);
    console.log('Test record created with ID:', result.insertedId);

  } catch (error) {
    console.error('Error creating test record:', error);
  }
}

// Serve static files
app.use(express.static('public'));

// API endpoint to get test records
app.get('/api/records', async (req, res) => {
  try {
    const records = await testCollection.find({}).toArray();
    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch records'
    });
  }
});

// Root endpoint - serve HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: db ? 'connected' : 'disconnected'
  });
});

// Start server after MongoDB connection
connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
