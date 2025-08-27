import axios from 'axios';

/**
 * Event Parameters:
 * - campaignId: Unique ID of the campaign (required)
 * - keywordId: Unique ID of the keyword (required)
 * - cid: Business ID (required if placeIds not provided)
 * - placeIds: List of unique place IDs (required if cid not provided)
 * - reportDate: Date for heatmap report (optional - uses latest if not provided)
 */
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    const accessToken = process.env.SEMRUSH_ACCESS_TOKEN;
    if (!accessToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'SEMRUSH_ACCESS_TOKEN environment variable is required'
        })
      };
    }

    const { campaignId, keywordId, cid, placeIds, reportDate } = event;

    if (!campaignId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'campaignId is required'
        })
      };
    }

    if (!keywordId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'keywordId is required'
        })
      };
    }

    if (!cid && !placeIds) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Either cid or placeIds is required'
        })
      };
    }

    const queryParams = new URLSearchParams({
      keywordId,
      ...(cid && { cid }),
      ...(placeIds && { placeIds }),
      ...(reportDate && { reportDate })
    });

    const apiUrl = `https://api.semrush.com/apis/v4/map-rank-tracker/v0/campaigns/${campaignId}/heatmap?${queryParams}`;

    console.log('Making request to:', apiUrl);

    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('Semrush API response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Enable CORS if needed
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: response.data,
        timestamp: new Date().toISOString(),
        requestParams: {
          campaignId,
          keywordId,
          cid,
          placeIds,
          reportDate
        }
      })
    };

  } catch (error) {
    console.error('Error fetching heatmap data:', error);

    if (error.response) {
      console.error('Semrush API error:', error.response.status, error.response.data);
      
      return {
        statusCode: error.response.status,
        body: JSON.stringify({
          error: 'Semrush API error',
          message: error.response.data?.error?.message || error.message,
          semrushError: error.response.data,
          timestamp: new Date().toISOString()
        })
      };
    } else if (error.request) {
      console.error('Network error:', error.message);
      
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'Network error',
          message: 'Failed to connect to Semrush API',
          timestamp: new Date().toISOString()
        })
      };
    } else {
      console.error('Unexpected error:', error.message);
      
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message,
          timestamp: new Date().toISOString()
        })
      };
    }
  }
};
