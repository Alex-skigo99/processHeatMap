import axios from 'axios';

/**
 * Semrush OAuth 2.0 Authentication Helper
 * Implements Device Authorization Grant flow for Semrush API v4
 */

const SEMRUSH_OAUTH_BASE = 'https://oauth.semrush.com';
const SEMRUSH_API_BASE = 'https://api.semrush.com/apis/v4/map-rank-tracker/v0';

/**
 * Step 1: Request device authorization code
 * @returns {Promise<Object>} Device authorization response
 */
export async function requestDeviceAuthorization() {
  try {
    const response = await axios.post(`${SEMRUSH_OAUTH_BASE}/dag/device/code`);
    
    console.log('Device authorization response:', response.data);
    console.log(`\nTo authorize the device, open this URL in your browser:`);
    console.log(`${response.data.verification_uri}`);
    console.log(`\nUser code: ${response.data.user_code}`);
    console.log(`\nThis code expires in ${response.data.expires_in} seconds`);
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to request device authorization: ${error.message}`);
  }
}

/**
 * Step 2: Poll for access token using device code
 * @param {string} deviceCode - Device code from step 1
 * @param {number} interval - Polling interval in seconds
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<Object>} Access token response
 */
export async function pollForAccessToken(deviceCode, interval = 5, expiresIn = 300) {
  const startTime = Date.now();
  const timeoutMs = expiresIn * 1000;
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await axios.post(`${SEMRUSH_OAUTH_BASE}/dag/device/token`, 
        new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      console.log('Access token obtained successfully!');
      return response.data;
      
    } catch (error) {
      if (error.response?.data?.error === 'authorization_pending') {
        console.log('Waiting for user authorization...');
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        continue;
      } else if (error.response?.data?.error === 'slow_down') {
        console.log('Slowing down polling...');
        await new Promise(resolve => setTimeout(resolve, (interval + 5) * 1000));
        continue;
      } else {
        throw new Error(`Failed to get access token: ${error.response?.data?.error || error.message}`);
      }
    }
  }
  
  throw new Error('Device authorization expired. Please try again.');
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New access token response
 */
export async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(`${SEMRUSH_OAUTH_BASE}/dag/device/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('Access token refreshed successfully!');
    return response.data;
    
  } catch (error) {
    throw new Error(`Failed to refresh access token: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Complete Device Authorization Grant flow
 * @returns {Promise<Object>} Access token response
 */
export async function getAccessToken() {
  console.log('Starting Semrush OAuth 2.0 Device Authorization Grant flow...\n');
  
  // Step 1: Request device authorization
  const deviceAuth = await requestDeviceAuthorization();
  
  // Step 2: Poll for access token
  const tokenResponse = await pollForAccessToken(
    deviceAuth.device_code,
    deviceAuth.interval,
    deviceAuth.expires_in
  );
  
  return tokenResponse;
}

/**
 * Get list of campaigns
 * @param {string} accessToken - Bearer access token
 * @param {Object} options - Query options (page, size, sort, query)
 * @returns {Promise<Object>} Campaigns response
 */
export async function getCampaigns(accessToken, options = {}) {
  const params = new URLSearchParams(options);
  const url = `${SEMRUSH_API_BASE}/campaigns${params.toString() ? '?' + params.toString() : ''}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get campaigns: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get campaign details
 * @param {string} accessToken - Bearer access token
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Campaign details response
 */
export async function getCampaign(accessToken, campaignId) {
  try {
    const response = await axios.get(`${SEMRUSH_API_BASE}/campaigns/${campaignId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get campaign: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get keywords for a campaign
 * @param {string} accessToken - Bearer access token
 * @param {string} campaignId - Campaign ID
 * @param {string} reportDate - Optional report date
 * @returns {Promise<Object>} Keywords response
 */
export async function getKeywords(accessToken, campaignId, reportDate = null) {
  const params = reportDate ? `?reportDate=${encodeURIComponent(reportDate)}` : '';
  
  try {
    const response = await axios.get(`${SEMRUSH_API_BASE}/campaigns/${campaignId}/keywords${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get keywords: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get heatmap data
 * @param {string} accessToken - Bearer access token
 * @param {string} campaignId - Campaign ID
 * @param {Object} params - Heatmap parameters
 * @returns {Promise<Object>} Heatmap response
 */
export async function getHeatmap(accessToken, campaignId, params) {
  const { keywordId, cid, placeIds, reportDate } = params;
  
  // Validate required parameters
  if (!keywordId) throw new Error('keywordId is required');
  if (!cid && !placeIds) throw new Error('Either cid or placeIds is required');
  
  const queryParams = new URLSearchParams({
    keywordId,
    ...(cid && { cid }),
    ...(placeIds && { placeIds }),
    ...(reportDate && { reportDate })
  });
  
  try {
    const response = await axios.get(`${SEMRUSH_API_BASE}/campaigns/${campaignId}/heatmap?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get heatmap: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Validate access token by making a test API call
 * @param {string} accessToken - Bearer access token
 * @returns {Promise<boolean>} True if token is valid
 */
export async function validateAccessToken(accessToken) {
  try {
    await getCampaigns(accessToken, { size: 1 });
    return true;
  } catch (error) {
    return false;
  }
}
