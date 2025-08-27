# AWS Lambda Deployment Guide

This guide walks you through deploying the Semrush Heatmap Lambda function to AWS.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- Access to AWS Lambda and IAM services

## Option 1: AWS CLI Deployment

### 1. Prepare the deployment package

```bash
# Install dependencies
npm install

# Create deployment package
npm run zip
```

This creates `lambda-function.zip` with all necessary files.

### 2. Create IAM role for Lambda

```bash
# Create trust policy for Lambda
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name semrush-heatmap-lambda-role \
  --assume-role-policy-document file://trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name semrush-heatmap-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 3. Create the Lambda function

```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create Lambda function
aws lambda create-function \
  --function-name semrush-heatmap \
  --runtime nodejs18.x \
  --role arn:aws:iam::${ACCOUNT_ID}:role/semrush-heatmap-lambda-role \
  --handler index.handler \
  --zip-file fileb://lambda-function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables='{
    "SEMRUSH_ACCESS_TOKEN":"YOUR_ACCESS_TOKEN_HERE"
  }'
```

### 4. Update the function (for subsequent deployments)

```bash
aws lambda update-function-code \
  --function-name semrush-heatmap \
  --zip-file fileb://lambda-function.zip
```

## Option 2: AWS Console Deployment

### 1. Create the function

1. Go to AWS Lambda Console
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `semrush-heatmap`
5. Runtime: Node.js 18.x
6. Click "Create function"

### 2. Upload the code

1. In the Code tab, click "Upload from" > ".zip file"
2. Upload the `lambda-function.zip` file
3. Click "Save"

### 3. Configure environment variables

1. Go to Configuration tab > Environment variables
2. Add: `SEMRUSH_ACCESS_TOKEN` = `your-access-token`
3. Click "Save"

### 4. Configure function settings

1. Go to Configuration tab > General configuration
2. Set timeout to 30 seconds
3. Set memory to 256 MB
4. Click "Save"

## Option 3: AWS SAM Deployment

### 1. Create SAM template

Create `template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Parameters:
  SemrushAccessToken:
    Type: String
    NoEcho: true
    Description: Semrush OAuth 2.0 access token

Resources:
  SemrushHeatmapFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: semrush-heatmap
      CodeUri: ./
      Handler: index.handler
      Runtime: nodejs18.x
      Timeout: 30
      MemorySize: 256
      Environment:
        Variables:
          SEMRUSH_ACCESS_TOKEN: !Ref SemrushAccessToken
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /heatmap
            Method: post

Outputs:
  ApiUrl:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/heatmap"
```

### 2. Deploy with SAM

```bash
# Build the application
sam build

# Deploy (first time)
sam deploy --guided

# Subsequent deployments
sam deploy
```

## Option 4: Serverless Framework

### 1. Install Serverless Framework

```bash
npm install -g serverless
```

### 2. Create `serverless.yml`

```yaml
service: semrush-heatmap

provider:
  name: aws
  runtime: nodejs18.x
  stage: prod
  region: us-east-1
  environment:
    SEMRUSH_ACCESS_TOKEN: ${env:SEMRUSH_ACCESS_TOKEN}

functions:
  heatmap:
    handler: index.handler
    timeout: 30
    memorySize: 256
    events:
      - http:
          path: heatmap
          method: post
          cors: true

plugins:
  - serverless-offline
```

### 3. Deploy

```bash
# Set environment variable
export SEMRUSH_ACCESS_TOKEN="your-access-token"

# Deploy
serverless deploy
```

## Environment Variables

Set these environment variables in your Lambda function:

| Variable | Required | Description |
|----------|----------|-------------|
| `SEMRUSH_ACCESS_TOKEN` | Yes | OAuth 2.0 Bearer token from Semrush |

## Testing the Deployed Function

### 1. Test via AWS Console

1. Go to your Lambda function in AWS Console
2. Click "Test" tab
3. Create a new test event with this JSON:

```json
{
  "campaignId": "your-campaign-id",
  "keywordId": "your-keyword-id",
  "cid": "your-business-cid",
  "reportDate": "2024-07-05T12:39:22.611Z"
}
```

### 2. Test via AWS CLI

```bash
aws lambda invoke \
  --function-name semrush-heatmap \
  --payload '{"campaignId":"your-campaign-id","keywordId":"your-keyword-id","cid":"your-business-cid"}' \
  response.json

cat response.json
```

### 3. Test via API Gateway (if configured)

```bash
curl -X POST \
  https://your-api-gateway-url/heatmap \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "your-campaign-id",
    "keywordId": "your-keyword-id",
    "cid": "your-business-cid"
  }'
```

## Monitoring and Logging

### CloudWatch Logs

View logs in AWS CloudWatch:
1. Go to CloudWatch Console
2. Navigate to Logs > Log groups
3. Find `/aws/lambda/semrush-heatmap`

### CloudWatch Metrics

Monitor these metrics:
- Invocations
- Duration
- Errors
- Throttles

### Set up Alarms

```bash
# Create alarm for errors
aws cloudwatch put-metric-alarm \
  --alarm-name "semrush-heatmap-errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=FunctionName,Value=semrush-heatmap \
  --evaluation-periods 1
```

## Security Best Practices

### 1. Use AWS Secrets Manager for tokens

Instead of environment variables, use AWS Secrets Manager:

```javascript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getAccessToken() {
  const command = new GetSecretValueCommand({
    SecretId: "semrush-access-token"
  });
  
  const response = await client.send(command);
  return response.SecretString;
}
```

### 2. IAM Permissions

Create minimal IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:semrush-access-token-*"
    }
  ]
}
```

### 3. VPC Configuration (if needed)

For private deployments, configure VPC:

```bash
aws lambda update-function-configuration \
  --function-name semrush-heatmap \
  --vpc-config SubnetIds=subnet-12345,SecurityGroupIds=sg-12345
```

## Cost Optimization

### 1. Right-size memory allocation

Monitor memory usage and adjust:

```bash
aws lambda update-function-configuration \
  --function-name semrush-heatmap \
  --memory-size 128  # Start with minimum and increase as needed
```

### 2. Set up provisioned concurrency (if needed)

For consistent performance:

```bash
aws lambda put-provisioned-concurrency-config \
  --function-name semrush-heatmap \
  --provisioned-concurrency-config ProvisionedConcurrencyCount=1
```

## Troubleshooting

### Common Issues

1. **Timeout errors**: Increase timeout to 30 seconds
2. **Memory errors**: Increase memory allocation
3. **Network errors**: Check VPC/subnet configuration
4. **Auth errors**: Verify access token is valid

### Debug locally

```bash
# Set environment variable
export SEMRUSH_ACCESS_TOKEN="your-token"

# Run test
npm test
```

### Check CloudWatch Logs

```bash
aws logs tail /aws/lambda/semrush-heatmap --follow
```

## Cleanup

To remove all resources:

```bash
# Delete Lambda function
aws lambda delete-function --function-name semrush-heatmap

# Delete IAM role
aws iam detach-role-policy \
  --role-name semrush-heatmap-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam delete-role --role-name semrush-heatmap-lambda-role
```

For SAM deployments:
```bash
sam delete
```

For Serverless Framework:
```bash
serverless remove
```
