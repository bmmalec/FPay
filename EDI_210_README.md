# EDI 210 - Motor Carrier Freight Details and Invoice

This module provides EDI 210 transaction set generation and processing capabilities for the FPay Freight Payment Platform.

## Overview

EDI 210 is the standard Electronic Data Interchange transaction set used in the transportation industry for Motor Carrier Freight Details and Invoice. It contains detailed freight billing information including:

- Invoice details (number, date, amount)
- Shipment information (tracking, weight, dates)
- Party information (shipper, consignee, bill-to)
- Line item details (charges, rates, descriptions)
- Reference numbers and identifiers

## Features

### 1. EDI 210 File Generation
- Generate standard-compliant EDI 210 files from freight data
- Automatic control number generation
- Support for multiple line items
- Party address information (shipper, consignee, bill-to)
- Date and time formatting per EDI standards

### 2. EDI 210 File Processing
- Parse EDI 210 files into structured JSON data
- Extract all relevant invoice and shipment information
- Validate EDI format and structure
- Create invoices directly from EDI files

### 3. File Management
- Save EDI files to local filesystem (`edi_files/` folder)
- List all generated EDI files with metadata
- View EDI file contents
- Process EDI files to create invoices in database

## API Endpoints

### Generate EDI 210
```
POST /api/edi210/generate
Content-Type: application/json

{
  "invoiceNumber": "INV-001",
  "shipmentId": "SHIP-001",
  "netAmount": 1250.50,
  "shipper": {
    "name": "ABC Manufacturing",
    "address": {
      "street": "123 Industrial Way",
      "city": "Los Angeles",
      "state": "CA",
      "zip": "90001"
    }
  },
  "consignee": { ... },
  "billTo": { ... },
  "shipment": {
    "weight": 2500
  },
  "amount": {
    "baseRate": 1000.00,
    "total": 1250.50
  }
}
```

### Generate EDI 210 from Invoice ID
```
POST /api/edi210/generate-from-invoice/:id
```

### Process EDI 210 Content
```
POST /api/edi210/process
Content-Type: application/json

{
  "ediContent": "ISA*00*...",
  "fileName": "optional-filename.edi"
}
```

### Process EDI 210 File by Name
```
POST /api/edi210/process-file/:fileName
```

### List All EDI Files
```
GET /api/edi210/files
```

### Get Specific EDI File
```
GET /api/edi210/files/:fileName
```

## Admin Panel Integration

The admin panel (`/admin.html`) includes a dedicated EDI 210 management section:

1. **Generate EDI 210 Form**: Create EDI files from custom freight data
   - Input invoice number, shipment ID
   - Specify shipper and consignee information
   - Define origin and destination locations
   - Set weight and total amount

2. **EDI Files List**: View all generated EDI 210 files
   - File name, size, and creation date
   - Actions: Process (create invoice) or View (display content)

3. **Processing**: Convert EDI files to invoices with one click
   - Automatically parses EDI content
   - Creates invoice record in MongoDB
   - Updates database statistics

## EDI 210 Format

The generated EDI 210 files follow the ANSI X12 standard format:

```
ISA - Interchange Control Header
GS  - Functional Group Header
ST  - Transaction Set Header (210)
B3  - Beginning Segment for Carriers Invoice
N9  - Reference Identification
G62 - Date/Time
N1  - Name (Shipper)
N3  - Address Information
N4  - Geographic Location
N1  - Name (Consignee)
N3  - Address Information
N4  - Geographic Location
N1  - Name (Bill-To)
N3  - Address Information
N4  - Geographic Location
LX  - Assigned Number (Line Item Loop)
L5  - Description, Marks and Numbers
L0  - Line Item - Quantity and Weight
L1  - Rate and Charges
L3  - Total Weight and Charges
SE  - Transaction Set Trailer
GE  - Functional Group Trailer
IEA - Interchange Control Trailer
```

## Usage Examples

### JavaScript Example (Frontend)
```javascript
// Generate EDI 210
const ediData = {
  invoiceNumber: 'INV-12345',
  shipmentId: 'SHIP-67890',
  netAmount: 850.00,
  shipper: { name: 'ABC Corp', address: {...} },
  consignee: { name: 'XYZ Inc', address: {...} },
  billTo: { name: 'Customer Co', address: {...} },
  shipment: { weight: 1500 },
  amount: { baseRate: 850.00, total: 850.00 }
};

const response = await fetch('/api/edi210/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ediData)
});

const result = await response.json();
console.log('EDI File:', result.fileName);
```

### Node.js Example (Backend)
```javascript
const EDI210Generator = require('./utils/edi210Generator');

const generator = new EDI210Generator();
const ediContent = generator.generate(freightData);
const filePath = await generator.saveToFile(ediContent);

// Parse EDI file
const parsedData = generator.parse(ediContent);
```

## File Storage

EDI 210 files are stored in the `edi_files/` directory at the project root:
- Files are named: `EDI210_[invoiceNumber]_[timestamp].edi`
- The directory is created automatically if it doesn't exist
- Files are excluded from git via `.gitignore`

## Testing

Run the test script to verify EDI 210 functionality:

```bash
node test-edi.js
```

This will:
- Generate a sample EDI 210 file
- Parse the generated content
- Validate all fields match expected values
- Display the EDI content and parsed JSON

## Security Considerations

- Admin panel is PIN-protected (PIN: 4534)
- EDI files are stored locally on the server
- No external EDI transmission (VAN/AS2) is implemented
- File processing validates data before creating invoices

## Future Enhancements

Potential improvements for production use:
- EDI 997 (Functional Acknowledgment) generation
- Integration with EDI VAN providers (AS2, SFTP)
- Additional transaction sets (EDI 204, 214, etc.)
- Batch processing of multiple EDI files
- EDI validation against stricter compliance rules
- Trading partner-specific EDI profiles

## References

- ANSI X12 EDI Standards: https://x12.org/
- EDI 210 Specification: Motor Carrier Freight Details and Invoice
- Implementation Guide Version: 004010

## Support

For issues or questions about EDI 210 functionality:
1. Check the API endpoints for correct data format
2. Review the generated EDI content using the View button
3. Verify MongoDB connection for invoice creation
4. Check server logs for detailed error messages
