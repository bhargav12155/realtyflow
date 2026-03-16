#!/bin/bash

# RestaurantFlow AWS Elastic Beanstalk Deployment Script
# Usage: ./scripts/deploy/deploy.sh

set -e

APP_NAME="restaurantflow-app"
ENV_NAME="restaurantflow-prod"
S3_BUCKET="elasticbeanstalk-us-east-2-117984642146"
REGION="us-east-2"

echo "🚀 Starting RestaurantFlow deployment..."

# Step 1: Build the application
echo "📦 Building application..."
npm run build

# Step 2: Create deployment package
echo "📁 Creating deployment package..."
VERSION_LABEL="v$(date +%Y%m%d-%H%M%S)"
DEPLOY_DIR="deploy-tmp"
DEPLOY_ZIP="deploy-$VERSION_LABEL.zip"

rm -rf "$DEPLOY_DIR"
mkdir "$DEPLOY_DIR"

# Copy build artifacts
cp -r dist "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp Procfile "$DEPLOY_DIR/"
cp -r .ebextensions "$DEPLOY_DIR/"

# Install production dependencies
echo "📥 Installing production dependencies..."
cd "$DEPLOY_DIR"
npm ci --omit=dev --silent
cd ..

# Create zip
echo "🗜️  Creating zip file..."
cd "$DEPLOY_DIR"
zip -rq "../$DEPLOY_ZIP" .
cd ..

# Cleanup temp directory
rm -rf "$DEPLOY_DIR"

# Step 3: Upload to S3
echo "☁️  Uploading to S3..."
aws s3 cp "$DEPLOY_ZIP" "s3://$S3_BUCKET/$APP_NAME/$DEPLOY_ZIP" --region "$REGION"

# Step 4: Create application version
echo "📝 Creating application version..."
aws elasticbeanstalk create-application-version \
  --application-name "$APP_NAME" \
  --version-label "$VERSION_LABEL" \
  --source-bundle "S3Bucket=$S3_BUCKET,S3Key=$APP_NAME/$DEPLOY_ZIP" \
  --region "$REGION" \
  --no-cli-pager

# Step 5: Deploy to environment
echo "🚀 Deploying to $ENV_NAME..."
aws elasticbeanstalk update-environment \
  --environment-name "$ENV_NAME" \
  --version-label "$VERSION_LABEL" \
  --region "$REGION" \
  --no-cli-pager

# Step 6: Wait for deployment
echo "⏳ Waiting for deployment to complete..."
echo "   This may take 2-5 minutes..."

while true; do
  STATUS=$(aws elasticbeanstalk describe-environments \
    --environment-names "$ENV_NAME" \
    --query 'Environments[0].Status' \
    --output text \
    --region "$REGION")
  
  HEALTH=$(aws elasticbeanstalk describe-environments \
    --environment-names "$ENV_NAME" \
    --query 'Environments[0].Health' \
    --output text \
    --region "$REGION")
  
  echo "   Status: $STATUS | Health: $HEALTH"
  
  if [ "$STATUS" = "Ready" ]; then
    break
  fi
  
  sleep 15
done

# Cleanup zip file
rm -f "$DEPLOY_ZIP"

# Get the URL
URL=$(aws elasticbeanstalk describe-environments \
  --environment-names "$ENV_NAME" \
  --query 'Environments[0].CNAME' \
  --output text \
  --region "$REGION")

echo ""
echo "✅ Deployment complete!"
echo "🌐 URL: http://$URL"
echo "📦 Version: $VERSION_LABEL"
echo "💚 Health: $HEALTH"
