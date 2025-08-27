#!/usr/bin/env node

/**
 * CLI tool for Semrush OAuth 2.0 token generation
 * Usage: node auth-cli.mjs [command]
 * 
 * Commands:
 *   get-token    - Get a new access token using Device Authorization Grant
 *   refresh      - Refresh an existing token
 *   validate     - Validate an existing token
 *   campaigns    - List campaigns (requires valid token)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
  getAccessToken,
  refreshAccessToken,
  validateAccessToken,
  getCampaigns,
  getCampaign,
  getKeywords
} from './semrush-auth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TOKEN_FILE = join(__dirname, '.semrush-tokens.json');

// Helper functions
function saveTokens(tokens) {
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  console.log(`Tokens saved to ${TOKEN_FILE}`);
}

function loadTokens() {
  if (!existsSync(TOKEN_FILE)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading token file:', error.message);
    return null;
  }
}

function printTokenInfo(tokens) {
  console.log('\n📋 Token Information:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔑 Access Token: ${tokens.access_token.substring(0, 20)}...`);
  console.log(`♻️  Refresh Token: ${tokens.refresh_token.substring(0, 20)}...`);
  console.log(`⏰ Expires In: ${tokens.expires_in} seconds (${Math.round(tokens.expires_in / 86400)} days)`);
  console.log(`📅 Generated: ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n💾 Save this access token to your environment:');
  console.log(`export SEMRUSH_ACCESS_TOKEN="${tokens.access_token}"`);
  
  console.log('\n🚀 Or use it in your Lambda environment variables:');
  console.log(`SEMRUSH_ACCESS_TOKEN=${tokens.access_token}`);
}

// Command handlers
async function handleGetToken() {
  try {
    console.log('🔐 Getting new access token...\n');
    const tokens = await getAccessToken();
    saveTokens({ ...tokens, created_at: new Date().toISOString() });
    printTokenInfo(tokens);
  } catch (error) {
    console.error('❌ Error getting token:', error.message);
    process.exit(1);
  }
}

async function handleRefreshToken() {
  try {
    const existingTokens = loadTokens();
    if (!existingTokens?.refresh_token) {
      console.error('❌ No refresh token found. Please get a new token first.');
      process.exit(1);
    }
    
    console.log('♻️  Refreshing access token...\n');
    const newTokens = await refreshAccessToken(existingTokens.refresh_token);
    saveTokens({ ...newTokens, created_at: new Date().toISOString() });
    printTokenInfo(newTokens);
  } catch (error) {
    console.error('❌ Error refreshing token:', error.message);
    process.exit(1);
  }
}

async function handleValidateToken() {
  try {
    const tokens = loadTokens();
    if (!tokens?.access_token) {
      console.error('❌ No access token found. Please get a token first.');
      process.exit(1);
    }
    
    console.log('🔍 Validating access token...\n');
    const isValid = await validateAccessToken(tokens.access_token);
    
    if (isValid) {
      console.log('✅ Token is valid!');
      console.log(`🔑 Access Token: ${tokens.access_token.substring(0, 20)}...`);
    } else {
      console.log('❌ Token is invalid or expired.');
      
      if (tokens.refresh_token) {
        console.log('💡 Try refreshing the token with: node auth-cli.mjs refresh');
      } else {
        console.log('💡 Get a new token with: node auth-cli.mjs get-token');
      }
    }
  } catch (error) {
    console.error('❌ Error validating token:', error.message);
    process.exit(1);
  }
}

async function handleListCampaigns() {
  try {
    const tokens = loadTokens();
    if (!tokens?.access_token) {
      console.error('❌ No access token found. Please get a token first.');
      process.exit(1);
    }
    
    console.log('📋 Fetching campaigns...\n');
    const response = await getCampaigns(tokens.access_token, { size: 10 });
    
    if (response.data?.content?.length > 0) {
      console.log('📊 Your Campaigns:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      response.data.content.forEach((campaign, index) => {
        console.log(`${index + 1}. 📍 ${campaign.business?.name || 'Unnamed Campaign'}`);
        console.log(`   🆔 ID: ${campaign.id}`);
        console.log(`   📍 Location: ${campaign.business?.address || 'No address'}`);
        console.log(`   🗝️  Keywords: ${campaign.keywordsNumber || 0}`);
        console.log(`   📊 Points: ${campaign.pointsNumber || 0}`);
        console.log(`   🌍 Country: ${campaign.countryCode || 'Unknown'}`);
        console.log(`   📅 Created: ${campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : 'Unknown'}`);
        console.log(`   📈 Status: ${campaign.status || 'Unknown'}`);
        console.log('');
      });
      
      console.log(`📊 Total campaigns: ${response.data.totalElements}`);
      
      if (response.data.content.length > 0) {
        const firstCampaign = response.data.content[0];
        console.log('\n💡 To get keywords for the first campaign, run:');
        console.log(`node auth-cli.mjs keywords ${firstCampaign.id}`);
      }
    } else {
      console.log('📭 No campaigns found.');
    }
  } catch (error) {
    console.error('❌ Error fetching campaigns:', error.message);
    process.exit(1);
  }
}

async function handleGetKeywords(campaignId) {
  try {
    const tokens = loadTokens();
    if (!tokens?.access_token) {
      console.error('❌ No access token found. Please get a token first.');
      process.exit(1);
    }
    
    if (!campaignId) {
      console.error('❌ Campaign ID is required. Usage: node auth-cli.mjs keywords <campaignId>');
      process.exit(1);
    }
    
    console.log(`🔍 Fetching keywords for campaign ${campaignId}...\n`);
    const response = await getKeywords(tokens.access_token, campaignId);
    
    if (response.data?.keywords?.length > 0) {
      console.log('🗝️  Keywords:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      response.data.keywords.forEach((item, index) => {
        console.log(`${index + 1}. 🏷️  "${item.keyword.name}"`);
        console.log(`   🆔 ID: ${item.keyword.id}`);
        console.log(`   📊 Status: ${item.status}`);
        console.log('');
      });
      
      console.log('💡 Example heatmap request:');
      const firstKeyword = response.data.keywords[0];
      console.log(JSON.stringify({
        campaignId: campaignId,
        keywordId: firstKeyword.keyword.id,
        cid: "your-business-cid",
        reportDate: "2024-07-05T12:39:22.611Z"
      }, null, 2));
    } else {
      console.log('📭 No keywords found for this campaign.');
    }
  } catch (error) {
    console.error('❌ Error fetching keywords:', error.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
🔐 Semrush OAuth 2.0 CLI Tool
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: node auth-cli.mjs [command] [args]

Commands:
  get-token     Get a new access token using Device Authorization Grant
  refresh       Refresh an existing access token
  validate      Validate an existing access token
  campaigns     List your Map Rank Tracker campaigns
  keywords <id> Get keywords for a specific campaign
  help          Show this help message

Examples:
  node auth-cli.mjs get-token
  node auth-cli.mjs campaigns
  node auth-cli.mjs keywords 382738af-b6ae-4002-b6f6-c4c907b2b024

Notes:
  • Tokens are saved to .semrush-tokens.json
  • Access tokens expire after 7 days
  • Refresh tokens expire after 30 days
  • The Map Rank Tracker API doesn't consume API units
`);
}

// Main execution
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  switch (command) {
    case 'get-token':
      await handleGetToken();
      break;
    case 'refresh':
      await handleRefreshToken();
      break;
    case 'validate':
      await handleValidateToken();
      break;
    case 'campaigns':
      await handleListCampaigns();
      break;
    case 'keywords':
      await handleGetKeywords(arg);
      break;
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });
}
