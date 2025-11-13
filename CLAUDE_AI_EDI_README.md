# Claude AI-Powered EDI 210 Generation

This feature uses Claude AI to generate realistic freight shipment data and automatically create EDI 210 files.

## Overview

Instead of manually entering shipment details, you can now use Claude AI to generate realistic freight data including:
- Company names and addresses
- Realistic weights based on shipment type
- Appropriate freight charges
- Origin and destination locations
- All necessary EDI 210 fields

## Features

### Shipment Types Supported

The system supports 10 different shipment types, each with type-specific characteristics:

1. **LTL (Less Than Truckload)**
   - Weight: 500-10,000 lbs
   - Typical use: Smaller shipments, shorter distances
   - Rate: Moderate

2. **FTL (Full Truckload)**
   - Weight: 20,000-45,000 lbs
   - Typical use: Full trailer loads, longer distances
   - Rate: Standard truckload rates

3. **Refrigerated/Reefer**
   - Temperature-controlled transport
   - Typical cargo: Food, pharmaceuticals
   - Rate: Premium due to special equipment

4. **Flatbed**
   - Open trailer transport
   - Typical cargo: Construction materials, heavy equipment
   - Rate: Standard to moderate

5. **Intermodal**
   - Rail + truck combination
   - Typical use: Long distances, cost-effective
   - Rate: Economical for long haul

6. **Hazmat**
   - Hazardous materials transport
   - Typical cargo: Chemicals, dangerous goods
   - Rate: Premium due to special handling

7. **Expedited**
   - High-priority, time-sensitive shipments
   - Typical cargo: High-value items, urgent deliveries
   - Rate: Premium pricing

8. **Parcel/Small Package**
   - Small packages and parcels
   - Typical use: Residential delivery, small items
   - Rate: Per-package pricing

9. **White Glove**
   - High-value items with special handling
   - Typical cargo: Furniture, art, electronics
   - Rate: Premium service

10. **Oversize/Heavy Haul**
    - Oversized or extremely heavy loads
    - Typical cargo: Industrial equipment, machinery
    - Rate: Specialized pricing

## How to Use

### Step 1: Access Admin Panel
1. Navigate to `/admin.html`
2. Enter PIN: `4534`
3. Scroll to "AI-Powered EDI Generation with Claude" section

### Step 2: Configure Generation
1. Select a shipment type from the dropdown
2. Enter quantity (1-20 EDI files)
3. Click "Generate EDI 210 Files with Claude AI"

### Step 3: Review Generated Files
- Claude will generate realistic freight data
- EDI 210 files are automatically created
- Files appear in the EDI files list
- Each file shows: Invoice number, shipper, consignee, weight, and amount

### Step 4: Process Files
- Click "Process & Create Invoice" to convert EDI to invoice records
- Or click "View" to see the raw EDI content

## API Endpoint

### POST /api/edi210/generate-with-claude

**Request:**
```json
{
  "shipmentType": "LTL (Less Than Truckload)",
  "quantity": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated 3 EDI 210 files using Claude API",
  "shipmentType": "LTL (Less Than Truckload)",
  "files": [
    {
      "fileName": "EDI210_INV-20251113-001_1731456789.edi",
      "invoiceNumber": "INV-20251113-001",
      "shipmentId": "SHIP-001",
      "shipper": "ABC Manufacturing Corp",
      "consignee": "XYZ Distribution Center",
      "weight": 5000,
      "amount": 1250.50
    }
  ],
  "count": 3
}
```

## Configuration

### Environment Variable Required

Add to your `.env` file or Azure Web App Configuration:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Note:** The feature gracefully handles missing API keys by showing an error message to the user.

### Get an API Key

1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Add to environment variables

## Technical Details

### Claude Model Used
- **Model:** `claude-3-5-sonnet-20241022`
- **Max Tokens:** 4096
- **Purpose:** Generate structured freight data in JSON format

### Data Generation Process

1. **User selects shipment type and quantity**
2. **Backend sends prompt to Claude** with:
   - Shipment type specifications
   - Required data structure
   - Realistic data requirements
3. **Claude generates JSON array** with freight data
4. **Backend parses JSON response**
5. **EDI 210 files are generated** for each entry
6. **Files saved to `edi_files/` folder**
7. **Response sent to frontend** with file details

### Error Handling

The system handles several error scenarios:

- **Missing API key:** Shows configuration error
- **Invalid quantity:** Validates 1-20 range
- **Claude API errors:** Catches and displays error message
- **JSON parsing errors:** Handles malformed responses
- **File system errors:** Reports file creation issues

## Benefits

### Time Savings
- Generate multiple realistic shipments in seconds
- No need to manually enter company names, addresses, etc.
- Instant EDI 210 file creation

### Data Quality
- Realistic company names and locations
- Appropriate weights for shipment types
- Accurate freight charges based on industry standards
- Proper address formatting

### Testing & Development
- Quickly create test data for development
- Generate diverse shipment scenarios
- Populate database with realistic records
- Test EDI processing workflows

## Limitations

- Maximum 20 files per request (to control API costs)
- Requires valid Anthropic API key
- Claude API rate limits apply
- Internet connection required

## Cost Considerations

### Claude API Pricing (as of Nov 2024)
- Claude 3.5 Sonnet: ~$3 per million input tokens, ~$15 per million output tokens
- Typical request: ~500 input tokens, ~1000 output tokens
- Estimated cost per generation: ~$0.02-0.05 for 10 shipments

**Tip:** Use the manual EDI generation form for single shipments to minimize API costs.

## Troubleshooting

### "Claude API key not configured" Error
**Solution:** Add `ANTHROPIC_API_KEY` to your environment variables

### "Invalid response format from Claude API" Error
**Solution:** Check Claude API status and try again

### Files not appearing in list
**Solution:** Click the "Refresh File List" button

### edi_files directory missing
**Solution:** Restart the server - it will create the directory automatically on startup

## Security Notes

- API key is stored server-side only
- Never expose API key in client-side code
- Pin protection prevents unauthorized EDI generation
- Files are stored locally on server
- Consider adding rate limiting for production use

## Future Enhancements

Potential improvements:
- Batch processing of large quantities
- Custom company/location preferences
- Historical data patterns
- Integration with real carrier rate tables
- Multi-language support for international shipments
- Custom templates per trading partner

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify ANTHROPIC_API_KEY is set correctly
3. Ensure internet connectivity
4. Check Claude API status at https://status.anthropic.com/
5. Review generated files for data quality

## Example Output

When you generate 3 LTL shipments, Claude might create:

**Shipment 1:**
- Invoice: INV-20251113-001
- Shipper: Acme Manufacturing (Los Angeles, CA)
- Consignee: Better Distribution (Phoenix, AZ)
- Weight: 3,500 lbs
- Amount: $875.00

**Shipment 2:**
- Invoice: INV-20251113-002
- Shipper: Quality Goods Inc (Chicago, IL)
- Consignee: Central Warehouse (Kansas City, MO)
- Weight: 6,200 lbs
- Amount: $1,240.00

**Shipment 3:**
- Invoice: INV-20251113-003
- Shipper: Pacific Supplies (Seattle, WA)
- Consignee: Mountain Depot (Denver, CO)
- Weight: 4,100 lbs
- Amount: $1,025.00

All three will have complete EDI 210 files ready to process into invoices!
