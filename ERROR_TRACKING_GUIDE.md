# FPay Error Tracking and Instrumentation System

## Overview

FPay now has a comprehensive error tracking and instrumentation system that automatically captures, logs, and helps resolve both server-side and client-side errors.

## Architecture

### 1. Error Log Collection (MongoDB)
- **Model**: `models/ErrorLog.js`
- **Collection**: `errorlogs`
- All errors are stored with full context including:
  - Error message and stack trace
  - Source (server or client)
  - URL, user agent, IP address
  - Request/response details
  - Occurrence count and timestamps
  - Resolution status and notes

### 2. Server-Side Error Tracking
- **Middleware**: `middleware/errorLogger.js`
- **Features**:
  - Automatic capture of all Express errors
  - Unhandled promise rejection tracking
  - Uncaught exception handling
  - Request data sanitization (passwords, tokens redacted)
  - Severity classification (low, medium, high, critical)
  - Error deduplication (similar errors within 1 hour are grouped)

### 3. Client-Side Error Tracking
- **Script**: `public/assets/js/error-tracker.js`
- **Features**:
  - Global JavaScript error handler
  - Unhandled promise rejection tracking
  - Network error monitoring (fetch failures)
  - Error deduplication (5-second debounce)
  - Offline support with localStorage fallback
  - Automatic retry of failed error submissions

### 4. Error Management API
- **Routes**: `routes/errors.js`
- **Base Path**: `/api/errors`

## How Errors Are Captured

### Server-Side Errors
Automatically captured for:
- Uncaught exceptions in route handlers
- Database errors (MongoDB)
- Validation errors
- API errors
- Unhandled promise rejections

Example automatic capture:
```javascript
// Any error in this route handler is automatically logged
app.get('/api/carriers/:id', async (req, res) => {
    const carrier = await Carrier.findById(req.params.id); // If this fails, error is logged
    res.json(carrier);
});
```

### Client-Side Errors
Automatically captured for:
- JavaScript runtime errors
- Unhandled promise rejections
- Network/fetch errors
- Uncaught exceptions

Manual error logging:
```javascript
// Log custom errors from JavaScript
window.FPayErrorTracker.log('Custom error message', {
    additionalData: 'some context'
});
```

## Accessing Error Logs

### 1. Error Monitoring Dashboard
**URL**: `https://fpay-webapp.azurewebsites.net/errors.html`

**Features**:
- Real-time statistics (total errors, unresolved, last 24 hours, critical)
- Filter by source, status, severity
- Full-text search across error messages and stack traces
- View detailed error information including full stack traces
- Mark errors as resolved
- Delete individual or bulk errors
- Auto-refresh every 30 seconds

### 2. API Endpoints

#### Get All Errors
```bash
GET /api/errors?page=1&limit=20&source=server&status=new&severity=critical
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `source`: Filter by source (server/client)
- `status`: Filter by status (new/investigating/resolved/ignored)
- `severity`: Filter by severity (low/medium/high/critical)
- `search`: Full-text search
- `sortBy`: Sort field (default: createdAt)
- `sortOrder`: Sort order (asc/desc)

#### Get Error Statistics
```bash
GET /api/errors/stats
```

Returns:
```json
{
  "success": true,
  "data": {
    "total": 156,
    "unresolved": 42,
    "bySource": [
      { "_id": "server", "count": 89 },
      { "_id": "client", "count": 67 }
    ],
    "bySeverity": [
      { "_id": "critical", "count": 12 },
      { "_id": "high", "count": 23 },
      { "_id": "medium", "count": 78 },
      { "_id": "low", "count": 43 }
    ],
    "recent": [{ "last24Hours": 18 }]
  }
}
```

#### Get Specific Error
```bash
GET /api/errors/:id
```

#### Update Error Status
```bash
PATCH /api/errors/:id
Content-Type: application/json

{
  "status": "resolved",
  "resolutionNotes": "Fixed by updating validation logic",
  "resolvedBy": "Claude"
}
```

#### Delete Error
```bash
DELETE /api/errors/:id
```

#### Bulk Operations
```bash
# Bulk update
POST /api/errors/bulk-update
{
  "ids": ["error1", "error2"],
  "status": "resolved"
}

# Bulk delete
POST /api/errors/bulk-delete
{
  "ids": ["error1", "error2"]
}
```

## How Claude Code Can Resolve Errors

### Method 1: Via Error Dashboard
1. Navigate to `/errors.html`
2. Review errors with filters (e.g., status=new, severity=critical)
3. Click on an error to see full details including stack trace
4. Identify the issue from the stack trace and context
5. Fix the code
6. Mark error as resolved with notes

### Method 2: Via API
1. Fetch recent unresolved errors:
```bash
curl https://fpay-webapp.azurewebsites.net/api/errors?status=new&limit=10
```

2. Analyze error details including:
   - Error message
   - Stack trace
   - URL where error occurred
   - Request context (method, headers, body)
   - User agent and browser info

3. Fix the code based on the error details

4. Mark as resolved:
```bash
curl -X PATCH https://fpay-webapp.azurewebsites.net/api/errors/:id \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved", "resolutionNotes": "Fixed in commit abc123", "resolvedBy": "Claude"}'
```

### Method 3: Automated Analysis
Create a script to fetch and analyze errors:

```javascript
async function analyzeErrors() {
    // Get all critical unresolved errors
    const response = await fetch('/api/errors?severity=critical&status=new');
    const data = await response.json();

    for (const error of data.data) {
        console.log('Error:', error.message);
        console.log('Stack:', error.stack);
        console.log('Occurred at:', error.url);
        console.log('Times:', error.occurrenceCount);

        // Analyze and fix...
    }
}
```

## Error Severity Levels

### Critical
- Server crashes
- Database connection failures
- Unhandled exceptions that crash the process
- Syntax errors
- MongoDB errors

### High
- Authentication/authorization failures (401, 403)
- Database operation errors
- TypeErrors, ReferenceErrors

### Medium
- Validation errors
- 400-level HTTP errors
- Network errors
- Promise rejections

### Low
- Informational errors
- Expected errors with fallback handling

## Error Status Workflow

1. **new** - Error just occurred, needs investigation
2. **investigating** - Error is being analyzed
3. **resolved** - Error has been fixed
4. **ignored** - Error is expected/acceptable, no action needed

## Best Practices

### For Developers
1. Check `/errors.html` daily for new critical errors
2. Prioritize critical and high severity errors
3. Add resolution notes when marking errors as resolved
4. Use error patterns to prevent similar issues

### For Claude Code
1. Fetch errors via API: `GET /api/errors?status=new`
2. Analyze stack traces and context
3. Fix the underlying issue in code
4. Update error status with resolution notes
5. Verify fix by checking if error recurs

### For Monitoring
1. Set up alerts for critical errors
2. Review error trends (increasing/decreasing)
3. Monitor error occurrence counts
4. Clear resolved errors periodically

## Error Deduplication

The system automatically groups similar errors:
- Errors with same message, URL, and source within 1 hour are grouped
- `occurrenceCount` increments for each occurrence
- `firstOccurrence` and `lastOccurrence` track timespan

## Data Retention

Consider implementing:
- Auto-delete resolved errors older than 30 days
- Archive critical errors for long-term analysis
- Export error trends for reporting

## Troubleshooting

### Errors not appearing in dashboard
1. Check browser console for client-side errors
2. Verify error-tracker.js is loaded: `window.FPayErrorTracker`
3. Check network tab for failed POST to `/api/errors/log`

### Server errors not being logged
1. Check middleware order in server.js
2. Verify ErrorLog model is imported correctly
3. Check MongoDB connection

### Debug mode
Enable debug logging in client:
```javascript
window.FPayErrorTracker.enableDebug();
```

## Security Considerations

### Sensitive Data Protection
- Passwords, tokens, API keys are automatically redacted
- Request headers are sanitized
- Stack traces may contain code - restrict access to errors dashboard

### Access Control
Currently, the errors dashboard is publicly accessible. Consider:
- Adding authentication to `/errors.html`
- Protecting `/api/errors` endpoints with middleware
- Role-based access (admin-only)

## Example: Claude Code Workflow

1. **Check for errors**:
```bash
curl https://fpay-webapp.azurewebsites.net/api/errors/stats
```

2. **Get unresolved critical errors**:
```bash
curl "https://fpay-webapp.azurewebsites.net/api/errors?severity=critical&status=new"
```

3. **Analyze specific error**:
```bash
curl https://fpay-webapp.azurewebsites.net/api/errors/[error-id]
```

4. **Fix the code** based on stack trace and context

5. **Mark as resolved**:
```bash
curl -X PATCH https://fpay-webapp.azurewebsites.net/api/errors/[error-id] \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolutionNotes": "Fixed null reference in carriers.html line 797 by adding null check",
    "resolvedBy": "Claude Code"
  }'
```

6. **Verify fix** by monitoring for recurrence

## Metrics to Track

- Error rate trend (daily/weekly)
- Mean time to resolution
- Errors by severity distribution
- Most common error messages
- Server vs client error ratio
- Error recurrence after resolution

## Future Enhancements

Consider adding:
- Email/Slack notifications for critical errors
- Error analytics dashboard with charts
- Integration with monitoring tools (Sentry, New Relic)
- Error grouping by similarity (using ML)
- Automatic error assignment to components
- Error impact analysis (affected users)

## Conclusion

The error tracking system provides comprehensive visibility into FPay application errors, enabling faster debugging and resolution. Claude Code can leverage the API to automatically detect, analyze, and resolve issues, creating a self-healing application.
