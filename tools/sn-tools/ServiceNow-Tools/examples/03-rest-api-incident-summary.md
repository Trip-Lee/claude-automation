# Example 3: Build Custom REST API for Incident Summary

## Scenario
Create a REST API endpoint that returns a summary of incidents by priority and state, useful for external dashboards and integrations.

## What You'll Learn
- Creating REST API resources
- HTTP methods (GET, POST)
- Response formatting
- API authentication

---

## Step 1: Analyze Requirements

**Request:**
```
Create a REST API endpoint that returns incident statistics grouped by priority and state
```

**Command:**
```bash
node sn-ai-operations-cli.js analyze "create REST API endpoint for incident statistics by priority and state"
```

**Expected Output:**
```
Suggested Operations:
  1. create_rest_api (High confidence)
     Description: Create a new REST API Web Service
     Complexity: Medium-High
```

---

## Step 2: Design the API

**API Specification:**
- **Resource:** `/api/tenon/incident_summary`
- **Method:** GET
- **Authentication:** Required (Basic Auth)
- **Response Format:** JSON
- **Query Parameters:**
  - `priority` (optional): Filter by priority (1,2,3,4,5)
  - `state` (optional): Filter by state (1-7)
  - `days` (optional): Last N days (default: 30)

**Example Response:**
```json
{
  "summary": {
    "total": 245,
    "by_priority": {
      "1-Critical": 12,
      "2-High": 45,
      "3-Moderate": 98,
      "4-Low": 67,
      "5-Planning": 23
    },
    "by_state": {
      "1-New": 34,
      "2-In Progress": 123,
      "3-On Hold": 15,
      "6-Resolved": 45,
      "7-Closed": 28
    }
  },
  "generated_at": "2025-11-07T17:00:00Z",
  "period_days": 30
}
```

---

## Step 3: Create API Resource

**Create input file: `incident-summary-api.json`**
```json
{
  "name": "Incident Summary Statistics",
  "web_service_path": "api/tenon/incident_summary",
  "http_method": "GET",
  "operation_script": "var params = request.queryParams;\nvar priority = params.priority || '';\nvar state = params.state || '';\nvar days = parseInt(params.days) || 30;\n\n// Calculate date range\nvar startDate = new GlideDateTime();\nstartDate.addDaysLocalTime(-days);\n\nvar gr = new GlideAggregate('incident');\ngr.addQuery('sys_created_on', '>=', startDate);\nif (priority) gr.addQuery('priority', priority);\nif (state) gr.addQuery('state', state);\n\nvar summary = {\n  total: 0,\n  by_priority: {},\n  by_state: {},\n  generated_at: new GlideDateTime().getValue(),\n  period_days: days\n};\n\n// Count by priority\ngr.groupBy('priority');\ngr.addAggregate('COUNT');\ngr.query();\nwhile (gr.next()) {\n  var priorityName = gr.priority.getDisplayValue();\n  var count = parseInt(gr.getAggregate('COUNT'));\n  summary.by_priority[priorityName] = count;\n  summary.total += count;\n}\n\n// Count by state  \ngr = new GlideAggregate('incident');\ngr.addQuery('sys_created_on', '>=', startDate);\nif (priority) gr.addQuery('priority', priority);\nif (state) gr.addQuery('state', state);\ngr.groupBy('state');\ngr.addAggregate('COUNT');\ngr.query();\nwhile (gr.next()) {\n  var stateName = gr.state.getDisplayValue();\n  var count = parseInt(gr.getAggregate('COUNT'));\n  summary.by_state[stateName] = count;\n}\n\nreturn JSON.stringify({ summary: summary }, null, 2);",
  "active": true
}
```

**Command:**
```bash
node sn-ai-operations-cli.js plan create_rest_api --input incident-summary-api.json
```

**Expected Output:**
```
Building operation plan for: create_rest_api

✓ Loaded user input
✓ Template loaded
✓ CRUD Auto-Detection analyzing script...

CRUD Analysis Results:
  Operations Detected:
    - READ: GlideAggregate('incident') (table: incident)
    - READ: gr.query() (query operation)
    - READ: gr.next() (iteration)
    - READ: gr.getAggregate('COUNT') (aggregation)
    - NO WRITE OPERATIONS (Read-only API) ✓

  HTTP Method Analysis:
    - Method: GET
    - Script operations: READ-only
    - Alignment: PERFECT ✓
    - This is a safe read-only API

  Security Considerations:
    - No data modification operations
    - ACL rules will be applied automatically
    - Consider rate limiting for public APIs
    - Query parameters are validated

  Performance Notes:
    - Using GlideAggregate (good for large datasets) ✓
    - Two separate queries (consider combining)
    - Query scope limited by date range ✓
    - Recommend adding indexes on: sys_created_on, priority, state

Operation Plan Created:
  Operation: create_rest_api

  Data to be created:
    sys_ws_operation:
      name: "Incident Summary Statistics"
      web_service_path: "api/tenon/incident_summary"
      http_method: "GET"
      operation_script: [1247 characters]
      active: true

  API Endpoint:
    URL: https://<instance>.service-now.com/api/tenon/incident_summary
    Method: GET
    Auth: Basic or OAuth
    Parameters: ?priority=1&state=2&days=7

Plan saved to: operation-plan-create_rest_api-1699387234.json
```

**What Happened:**
- CRUD detection confirmed READ-only operations
- Validated HTTP method matches operations (GET = READ)
- Identified as safe read-only API
- Provided performance recommendations
- Suggested database indexes

---

## Step 4: Validate & Optimize

**Command:**
```bash
node sn-ai-operations-cli.js validate create_rest_api --plan operation-plan-create_rest_api-1699387234.json
```

**Expected Output:**
```
Validation Results:

✓ Schema Validation: PASS
  - sys_ws_operation table exists
  - HTTP method is valid (GET)
  - Script is valid JavaScript

✓ Security Validation: PASS
  - Read-only operations (safe)
  - No direct user input injection
  - Query parameters are type-checked

⚠ Performance Recommendations:
  - Running 2 separate GlideAggregate queries
  - Consider caching results (high read frequency expected)
  - Add indexes: incident.sys_created_on, incident.priority, incident.state
  - Consider implementing rate limiting

✓ API Design: PASS
  - RESTful endpoint structure
  - Proper HTTP verb usage
  - JSON response format
  - Query parameters documented

Validation Status: PASS WITH RECOMMENDATIONS
```

---

## Step 5: Deploy API

**Manual Deployment:**
1. System Web Services > REST > API Explorer
2. Create new REST API Service
3. Add operation with details from plan
4. Set authentication requirements
5. Test in API Explorer

**Automated Deployment:**
```bash
# Deploy via sn-operations
node sn-operations.js create --plan operation-plan-create_rest_api-1699387234.json
```

---

## Step 6: Test the API

### Test 1: Basic Request

**cURL:**
```bash
curl -u admin:password \
  "https://dev12345.service-now.com/api/tenon/incident_summary?days=7"
```

**Expected Response:**
```json
{
  "summary": {
    "total": 45,
    "by_priority": {
      "1 - Critical": 5,
      "2 - High": 12,
      "3 - Moderate": 18,
      "4 - Low": 8,
      "5 - Planning": 2
    },
    "by_state": {
      "1 - New": 8,
      "2 - In Progress": 23,
      "3 - On Hold": 3,
      "6 - Resolved": 9,
      "7 - Closed": 2
    },
    "generated_at": "2025-11-07 17:00:00",
    "period_days": 7
  }
}
```

### Test 2: Filtered Request

**cURL with filters:**
```bash
curl -u admin:password \
  "https://dev12345.service-now.com/api/tenon/incident_summary?priority=1&days=30"
```

**Expected:** Only Critical priority incidents from last 30 days

### Test 3: Error Handling

**Invalid parameter:**
```bash
curl -u admin:password \
  "https://dev12345.service-now.com/api/tenon/incident_summary?days=invalid"
```

**Expected:** Defaults to 30 days (parseInt fallback)

---

## Step 7: Add Error Handling & Documentation

**Enhanced version with error handling:**
```javascript
(function process(request, response) {
  try {
    var params = request.queryParams;
    var priority = params.priority || '';
    var state = params.state || '';
    var days = parseInt(params.days) || 30;

    // Validate inputs
    if (days < 1 || days > 365) {
      response.setStatus(400);
      return JSON.stringify({
        error: "Invalid 'days' parameter. Must be between 1 and 365"
      });
    }

    // ... rest of logic ...

    response.setStatus(200);
    response.setHeader('Content-Type', 'application/json');
    return JSON.stringify({ summary: summary }, null, 2);

  } catch (error) {
    response.setStatus(500);
    return JSON.stringify({
      error: "Internal server error",
      message: error.message
    });
  }
})(request, response);
```

---

## Step 8: Monitor API Usage

**View API statistics:**
```bash
node sn-ai-monitor-cli.js summary | grep "rest_api"
```

**Check for errors:**
```bash
node sn-ai-monitor-cli.js errors --operation create_rest_api
```

**Generate usage report:**
```bash
node sn-ai-monitor-cli.js report --filter "api/tenon/incident_summary"
```

---

## Advanced: Add Rate Limiting

**Create Business Rule for rate limiting:**
```javascript
// Rate Limit API Calls
// Before query on sys_ws_operation_log

(function executeRule(current, previous) {
  var userId = gs.getUserID();
  var endpoint = current.operation;

  // Check last 60 seconds
  var gr = new GlideAggregate('sys_ws_operation_log');
  gr.addQuery('user', userId);
  gr.addQuery('operation', endpoint);
  gr.addQuery('sys_created_on', '>', gs.minutesAgoStart(1));
  gr.addAggregate('COUNT');
  gr.query();

  if (gr.next()) {
    var count = parseInt(gr.getAggregate('COUNT'));
    if (count > 60) {  // Max 60 requests per minute
      gs.addErrorMessage('Rate limit exceeded. Max 60 requests per minute.');
      current.setAbortAction(true);
    }
  }
})(current, previous);
```

---

## Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function getIncidentSummary(days = 30) {
  const response = await axios.get(
    'https://dev12345.service-now.com/api/tenon/incident_summary',
    {
      params: { days },
      auth: {
        username: 'api_user',
        password: 'api_password'
      }
    }
  );
  return response.data.summary;
}
```

### Python
```python
import requests
from requests.auth import HTTPBasicAuth

def get_incident_summary(days=30):
    response = requests.get(
        'https://dev12345.service-now.com/api/tenon/incident_summary',
        params={'days': days},
        auth=HTTPBasicAuth('api_user', 'api_password')
    )
    return response.json()['summary']
```

### PowerShell
```powershell
$creds = Get-Credential
$params = @{days=30}
$response = Invoke-RestMethod `
  -Uri "https://dev12345.service-now.com/api/tenon/incident_summary" `
  -Method Get `
  -Credential $creds `
  -Body $params
$response.summary
```

---

## Key Takeaways

✅ **CRUD Detection for APIs:**
   - Confirmed READ-only operations for GET method
   - Validated HTTP verb matches operations
   - Identified as safe read-only API

✅ **Performance Analysis:**
   - Detected aggregation queries
   - Recommended database indexes
   - Suggested caching strategy

✅ **Security Best Practices:**
   - No write operations on GET endpoint
   - Input validation recommendations
   - Rate limiting guidance

---

## Next Steps

- **Example 4:** Bulk analyze existing scripts for CRUD patterns
- **Advanced:** Add OAuth authentication
- **Advanced:** Implement response caching

---

## Troubleshooting

**Problem:** 401 Unauthorized
- **Solution:** Check credentials and API user roles

**Problem:** Empty response
- **Solution:** Verify date range has incidents, check ACL rules

**Problem:** Slow performance
- **Solution:** Add recommended indexes, implement caching

**Problem:** CORS errors from browser
- **Solution:** Configure CORS headers in ServiceNow

---

## Related Examples

- [Example 1: Incident Validation Rule](./01-incident-validation-rule.md)
- [Example 2: Priority Escalation Button](./02-priority-escalation-button.md)
