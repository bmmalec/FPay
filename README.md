# FPay - Freight Payment Platform

A comprehensive freight payment processing platform designed to streamline payment operations for freight services.

## Features

- Secure payment processing
- Real-time analytics and reporting
- Enterprise-grade security
- Fast transaction handling

## Project Structure

```
FPay/
├── index.html              # Main application page
├── azure-pipelines.yml     # Azure DevOps CI/CD pipeline
└── README.md               # This file
```

## Azure Pipeline Setup Instructions

See `AZURE_SETUP.md` for detailed instructions on setting up the Azure Pipeline and deployment.

## Development

This is a static web application that can be served by any web server.

### Local Development

Simply open `index.html` in a web browser or use a local web server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server
```

## Deployment

The application is automatically deployed to Azure Web App through Azure DevOps Pipelines when changes are pushed to the main branch.

## License

Proprietary - All rights reserved
