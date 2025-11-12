# FPay - MongoDB Integration Test

A Node.js server application demonstrating MongoDB integration with async data retrieval and display on an HTML page.

## Features

- MongoDB Atlas connection using connection string
- Express.js web server
- Test collection with sample payment record
- Async data fetching and display
- Beautiful, responsive HTML interface
- REST API endpoint for records

## Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account (connection string provided)

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Running the Application

Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

- `GET /` - Serves the main HTML page with MongoDB records
- `GET /api/records` - Returns JSON data of all records
- `GET /health` - Health check endpoint

## Project Structure

```
FPay/
├── server.js           # Main server file with MongoDB connection
├── public/
│   └── index.html      # Frontend HTML page
├── package.json        # Project dependencies
└── README.md           # This file
```

## MongoDB Connection

The application connects to MongoDB Atlas using the provided connection string and:
- Creates a test collection named `test_records`
- Inserts a sample payment record with metadata
- Retrieves and displays the record on the web page

## Technologies Used

- Node.js
- Express.js
- MongoDB Driver for Node.js
- Vanilla JavaScript (Frontend)
- CSS3 (Responsive Design)
