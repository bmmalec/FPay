# FPay - Freight Payment Platform

A comprehensive freight payment processing platform with MongoDB backend designed to streamline payment operations for freight services.

## Features

- **Secure Payment Processing** - Complete payment lifecycle management
- **Invoice Management** - Full CRUD operations for freight invoices
- **MongoDB Integration** - Scalable document database for freight data
- **RESTful API** - Well-documented API endpoints
- **Real-time Health Monitoring** - Live system status and database connectivity
- **Enterprise-grade Security** - Production-ready security middleware
- **Fast Transaction Handling** - Optimized for high-volume operations

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB Atlas
- **Frontend**: HTML5, CSS3, JavaScript
- **Deployment**: Azure Web App
- **CI/CD**: Azure DevOps Pipelines

## Project Structure

```
FPay/
├── server.js               # Main Express server
├── package.json            # Node.js dependencies
├── models/
│   ├── Payment.js          # Payment data model
│   └── Invoice.js          # Invoice data model
├── routes/
│   ├── payments.js         # Payment API endpoints
│   └── invoices.js         # Invoice API endpoints
├── public/
│   └── index.html          # Frontend application
├── azure-pipelines.yml     # Azure DevOps CI/CD pipeline
└── README.md               # This file
```

## API Endpoints

### Health & Info
- `GET /api/health` - System health check
- `GET /api` - API information

### Payments
- `GET /api/payments` - List all payments
- `GET /api/payments/:id` - Get payment by ID
- `POST /api/payments` - Create new payment
- `PATCH /api/payments/:id/status` - Update payment status
- `GET /api/payments/stats/summary` - Payment statistics

### Invoices
- `GET /api/invoices` - List all invoices
- `GET /api/invoices/:id` - Get invoice by ID
- `GET /api/invoices/number/:invoiceNumber` - Get invoice by number
- `POST /api/invoices` - Create new invoice
- `PUT /api/invoices/:id` - Update invoice
- `PATCH /api/invoices/:id/status` - Update invoice status
- `DELETE /api/invoices/:id` - Delete invoice
- `GET /api/invoices/stats/summary` - Invoice statistics

## Azure Pipeline Setup Instructions

See `AZURE_SETUP.md` for detailed instructions on setting up the Azure Pipeline and deployment.

## Development

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- MongoDB connection (MongoDB Atlas recommended)

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (optional, defaults provided):
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
npm start
```

## Environment Variables

- `MONGODB_URI` - MongoDB connection string (required)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Deployment

The application is automatically deployed to Azure Web App through Azure DevOps Pipelines when changes are pushed to the main or claude/* branches.

The pipeline:
1. Installs Node.js dependencies
2. Runs tests
3. Packages the application
4. Deploys to Azure Web App
5. Configures MongoDB connection string

## License

Proprietary - All rights reserved
