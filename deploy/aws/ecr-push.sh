#!/bin/bash
# ==============================================================
# Push all microservice Docker images to AWS ECR
# ==============================================================
# Prerequisites:
#   1. AWS CLI installed and configured (aws configure)
#   2. Docker installed and running
#   3. ECR repositories created (run ecr-setup.sh first)
# ==============================================================

set -e

# ==================== Configuration ====================
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
PROJECT_NAME="food-ordering-app"

SERVICES=("user-service" "restaurant-service" "order-service" "delivery-service")

echo "============================================"
echo "  AWS ECR Push Script"
echo "  Registry: ${ECR_REGISTRY}"
echo "  Region:   ${AWS_REGION}"
echo "============================================"

# Step 1: Login to ECR
echo ""
echo "[1/3] Logging in to AWS ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Step 2: Build all images
echo ""
echo "[2/3] Building Docker images..."
for SERVICE in "${SERVICES[@]}"; do
  echo "  Building ${SERVICE}..."
  docker build -t ${PROJECT_NAME}/${SERVICE}:latest ../${SERVICE}/
  echo "  ✓ ${SERVICE} built"
done

# Step 3: Tag and push all images
echo ""
echo "[3/3] Tagging and pushing images to ECR..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

for SERVICE in "${SERVICES[@]}"; do
  ECR_REPO="${ECR_REGISTRY}/${PROJECT_NAME}/${SERVICE}"
  
  # Tag with latest and timestamp
  docker tag ${PROJECT_NAME}/${SERVICE}:latest ${ECR_REPO}:latest
  docker tag ${PROJECT_NAME}/${SERVICE}:latest ${ECR_REPO}:${TIMESTAMP}
  
  # Push both tags
  echo "  Pushing ${SERVICE}..."
  docker push ${ECR_REPO}:latest
  docker push ${ECR_REPO}:${TIMESTAMP}
  echo "  ✓ ${SERVICE} pushed to ${ECR_REPO}"
done

echo ""
echo "============================================"
echo "  All images pushed successfully!"
echo "  Images available at:"
for SERVICE in "${SERVICES[@]}"; do
  echo "    ${ECR_REGISTRY}/${PROJECT_NAME}/${SERVICE}:latest"
done
echo "============================================"
