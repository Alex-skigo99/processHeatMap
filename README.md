# Semrush Map Rank Tracker Heatmap Lambda Function

This AWS Lambda function fetches heatmap data from the Semrush Map Rank Tracker API.

## Features

- Fetches heatmap data for specific campaigns and keywords
- Handles OAuth 2.0 Bearer token authentication
- Comprehensive error handling and logging
- CORS enabled for web applications
- Validates required parameters
- Returns structured JSON responses

## Prerequisites

### 1. Semrush Account and API Access

- You need a Semrush account with access to Map Rank Tracker
- The Map Rank Tracker API is available to all Semrush users (no API units required)
- You need to obtain OAuth 2.0 credentials

### 2. Get OAuth 2.0 Access Token

Choose one of two authentication methods:

#### Option A: Device Authorization Grant (Recommended)

1. **Request Device Authorization:**
```bash
curl -X POST https://oauth.semrush.com/dag/device/code
```

2. **Response will include:**
```json
{
  "device_code": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "user_code": "YYYYYYYYYYY",
  "verification_uri": "https://oauth.semrush.com/dag/auth/verify_code?code=ZZZZZZZZZZZ",
  "expires_in": 300,
  "interval": 5
}
```

3. **Open the verification_uri in your browser and authenticate with your Semrush account**

4. **Poll for access token:**
```bash
curl -X POST https://oauth.semrush.com/dag/device/token \
  -d device_code=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  -d grant_type=urn:ietf:params:oauth:grant-type:device_code
```

5. **You'll receive:**
```json
{
  "access_token": "e3wLk3PtqyVPHM7Ele61OhuZFWtKCFK4O1HQslzh",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "YWza6vpqkW628wtMldRsQNalEu9k33Vg75PQiXGi"
}
```

#### Option B: Semrush Auth (Requires Client Credentials)

Contact [Semrush Tech Support](https://www.semrush.com/kb/support/) to obtain client_id and client_secret, then follow the OAuth flow in the [documentation](https://developer.semrush.com/api/v4/basic-docs/#semrush-auth).

## Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy to AWS Lambda

You can deploy this function using:

- AWS CLI
- AWS SAM
- Serverless Framework
- AWS Console

### 3. Set Environment Variables

Set the following environment variable in your Lambda function:

- `SEMRUSH_ACCESS_TOKEN`: Your OAuth 2.0 Bearer token

## Usage

### Event Parameters

The Lambda function accepts the following parameters in the event object:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `campaignId` | string | Yes | Unique ID of the campaign |
| `keywordId` | string | Yes | Unique ID of the keyword |
| `cid` | string | Conditional | Business ID (required if placeIds not provided) |
| `placeIds` | string | Conditional | Comma-separated list of place IDs (required if cid not provided) |
| `reportDate` | string | No | Date for heatmap report (ISO-8601 format). If not provided, uses latest report date |

### Example Event

```json
{
  "campaignId": "382738af-b6ae-4002-b6f6-c4c907b2b024",
  "keywordId": "319565ed-b433-4195-82cb-4146253d3311",
  "cid": "7947215078713107333",
  "placeIds": "ChIJD61nCjmD4BQRhaNSCAIuSm4",
  "reportDate": "2024-07-05T12:39:22.611Z"
}
```

### Response Format

#### Success Response

```json
{
  "success": true,
  "data": {
    "meta": {
      "success": true,
      "status_code": 200,
      "request_id": "api-flb-b26b3089b265a968f0158aaaacd16"
    },
    "data": {
      "keyword": {
        "id": "319565ed-b433-4195-82cb-4146253d3311",
        "name": "travel agency"
      },
      "date": "2024-07-05T12:39:22.611Z",
      "positions": [
        {
          "point": {
            "id": "95782b87-d0bc-4ea4-a61b-4355a48b6ba2",
            "coordinates": {
              "lat": 34.901978091462624,
              "lng": 33.64292406980698
            }
          },
          "position": 1,
          "diff": 1
        }
      ]
    }
  },
  "timestamp": "2024-08-27T10:30:00.000Z",
  "requestParams": {
    "campaignId": "382738af-b6ae-4002-b6f6-c4c907b2b024",
    "keywordId": "319565ed-b433-4195-82cb-4146253d3311",
    "cid": "7947215078713107333",
    "placeIds": "ChIJD61nCjmD4BQRhaNSCAIuSm4",
    "reportDate": "2024-07-05T12:39:22.611Z"
  }
}
```

#### Error Response

```json
{
  "error": "Semrush API error",
  "message": "Campaign not found",
  "semrushError": {
    "meta": {
      "success": false,
      "status_code": 404
    },
    "error": {
      "code": 404,
      "message": "Campaign not found"
    }
  },
  "timestamp": "2024-08-27T10:30:00.000Z"
}
```

## Testing Locally

You can test the function locally:

```javascript
import { handler } from './index.mjs';

const testEvent = {
  campaignId: "your-campaign-id",
  keywordId: "your-keyword-id",
  cid: "your-business-cid",
  reportDate: "2024-07-05T12:39:22.611Z"
};

// Set environment variable
process.env.SEMRUSH_ACCESS_TOKEN = "your-access-token";

const result = await handler(testEvent);
console.log(JSON.stringify(result, null, 2));
```

## Getting Campaign and Keyword IDs

To find your campaign and keyword IDs, you can use other Semrush API endpoints:

### Get Campaigns

```bash
curl -X GET \
  "https://api.semrush.com/apis/v4/map-rank-tracker/v0/campaigns" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Campaign Details

```bash
curl -X GET \
  "https://api.semrush.com/apis/v4/map-rank-tracker/v0/campaigns/CAMPAIGN_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Keywords for Campaign

```bash
curl -X GET \
  "https://api.semrush.com/apis/v4/map-rank-tracker/v0/campaigns/CAMPAIGN_ID/keywords" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Token Refresh

Access tokens expire after 7 days. You can refresh them using the refresh token:

```bash
curl -X POST \
  "https://oauth.semrush.com/dag/device/token" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=YOUR_REFRESH_TOKEN"
```

## Error Handling

The function handles various error scenarios:

- **400 Bad Request**: Missing required parameters
- **401 Unauthorized**: Invalid or expired access token
- **404 Not Found**: Campaign, keyword, or business not found
- **500 Internal Server Error**: Environment variables not set or unexpected errors
- **502 Bad Gateway**: Network connectivity issues

## Security Considerations

- Store the access token securely (AWS Secrets Manager recommended for production)
- Use IAM roles with minimal permissions
- Enable CloudWatch logging for monitoring
- Consider implementing rate limiting if called frequently

## API Documentation

For more details about the Semrush Map Rank Tracker API:
- [API Documentation](https://developer.semrush.com/api/v4/map-rank-tracker-2/v002/)
- [Authentication Guide](https://developer.semrush.com/api/v4/basic-docs/#authentication)

## Support

For API-related issues, contact [Semrush Support](https://www.semrush.com/kb/support/).