/**
 * Test script for the Semrush Heatmap Lambda function
 * This script demonstrates how to test the Lambda function locally
 */

import { handler } from './index.mjs';

// Test configuration
const TEST_CONFIG = {
  // You need to replace these with your actual values
  // Get these from running: node auth-cli.mjs campaigns
  // and: node auth-cli.mjs keywords <campaignId>
  campaignId: "382738af-b6ae-4002-b6f6-c4c907b2b024", // Replace with your campaign ID
  keywordId: "319565ed-b433-4195-82cb-4146253d3311",   // Replace with your keyword ID
  cid: "7947215078713107333",                          // Replace with your business CID
  reportDate: "2024-07-05T12:39:22.611Z"              // Optional: specific report date
};

/**
 * Test the Lambda function with sample data
 */
async function testLambdaFunction() {
  console.log('🧪 Testing Semrush Heatmap Lambda Function');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if access token is set
  if (!process.env.SEMRUSH_ACCESS_TOKEN) {
    console.error('❌ SEMRUSH_ACCESS_TOKEN environment variable is not set.');
    console.log('\n💡 To get an access token, run:');
    console.log('   node auth-cli.mjs get-token');
    console.log('\n💡 Then set the environment variable:');
    console.log('   export SEMRUSH_ACCESS_TOKEN="your-token-here"');
    return;
  }

  console.log('🔑 Access Token: ' + process.env.SEMRUSH_ACCESS_TOKEN.substring(0, 20) + '...');
  console.log('📋 Test Event:', JSON.stringify(TEST_CONFIG, null, 2));
  console.log('\n🚀 Invoking Lambda function...\n');

  try {
    const result = await handler(TEST_CONFIG);
    
    console.log('✅ Lambda function executed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Status Code: ${result.statusCode}`);
    
    // Parse and pretty print the response
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200 && responseBody.success) {
      console.log('✅ Request successful!');
      console.log(`🗝️  Keyword: ${responseBody.data.data.keyword.name}`);
      console.log(`📅 Report Date: ${responseBody.data.data.date}`);
      console.log(`📍 Number of Positions: ${responseBody.data.data.positions.length}`);
      
      if (responseBody.data.data.positions.length > 0) {
        console.log('\n📍 Sample Position Data:');
        const firstPosition = responseBody.data.data.positions[0];
        console.log(`   🎯 Position: ${firstPosition.position}`);
        console.log(`   📍 Coordinates: ${firstPosition.point.coordinates.lat}, ${firstPosition.point.coordinates.lng}`);
        console.log(`   📈 Diff: ${firstPosition.diff}`);
      }
    } else {
      console.log('❌ Request failed:');
      console.log(JSON.stringify(responseBody, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Lambda function failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Test with missing parameters to verify validation
 */
async function testValidation() {
  console.log('\n🧪 Testing Parameter Validation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const invalidEvents = [
    { description: 'Missing campaignId', event: { keywordId: 'test', cid: 'test' } },
    { description: 'Missing keywordId', event: { campaignId: 'test', cid: 'test' } },
    { description: 'Missing cid and placeIds', event: { campaignId: 'test', keywordId: 'test' } }
  ];

  for (const test of invalidEvents) {
    console.log(`🔍 Testing: ${test.description}`);
    
    try {
      const result = await handler(test.event);
      const responseBody = JSON.parse(result.body);
      
      console.log(`   📊 Status: ${result.statusCode}`);
      console.log(`   📝 Message: ${responseBody.error}`);
      
      if (result.statusCode === 400) {
        console.log('   ✅ Validation working correctly\n');
      } else {
        console.log('   ❌ Unexpected status code\n');
      }
    } catch (error) {
      console.log(`   ❌ Unexpected error: ${error.message}\n`);
    }
  }
}

/**
 * Test with invalid access token
 */
async function testInvalidToken() {
  console.log('🧪 Testing Invalid Access Token');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Save original token
  const originalToken = process.env.SEMRUSH_ACCESS_TOKEN;
  
  // Set invalid token
  process.env.SEMRUSH_ACCESS_TOKEN = 'invalid-token-12345';
  
  try {
    const result = await handler(TEST_CONFIG);
    const responseBody = JSON.parse(result.body);
    
    console.log(`📊 Status: ${result.statusCode}`);
    console.log(`📝 Error: ${responseBody.error}`);
    
    if (result.statusCode === 401) {
      console.log('✅ Authentication error handling working correctly');
    } else {
      console.log('❌ Unexpected response for invalid token');
    }
  } catch (error) {
    console.log(`❌ Unexpected error: ${error.message}`);
  }
  
  // Restore original token
  process.env.SEMRUSH_ACCESS_TOKEN = originalToken;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🔬 Starting Semrush Lambda Function Test Suite\n');
  
  await testLambdaFunction();
  await testValidation();
  await testInvalidToken();
  
  console.log('\n✅ Test suite completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Replace TEST_CONFIG values with your actual campaign/keyword IDs');
  console.log('   2. Deploy the function to AWS Lambda');
  console.log('   3. Set up environment variables in AWS Lambda console');
  console.log('   4. Test with real API Gateway events');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
}

export { testLambdaFunction, testValidation, testInvalidToken };
