#!/bin/bash
# ==============================================================
# Create AWS ECR Repositories for all microservices
# ==============================================================
# Run this ONCE before pushing images
# ==============================================================

set -e

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
PROJECT_NAME="food-ordering-app"

SERVICES=("user-service" "restaurant-service" "order-service" "delivery-service")

echo "Creating ECR Repositories in ${AWS_REGION}..."

for SERVICE in "${SERVICES[@]}"; do
  REPO_NAME="${PROJECT_NAME}/${SERVICE}"
  
  echo "Creating repository: ${REPO_NAME}"
  aws ecr create-repository \
    --repository-name ${REPO_NAME} \
    --region ${AWS_REGION} \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability MUTABLE \
    2>/dev/null || echo "  (Repository ${REPO_NAME} already exists)"
  
  # Set lifecycle policy to keep only last 10 images
  aws ecr put-lifecycle-policy \
    --repository-name ${REPO_NAME} \
    --region ${AWS_REGION} \
    --lifecycle-policy-text '{
      "rules": [
        {
          "rulePriority": 1,
          "description": "Keep only last 10 images",
          "selection": {
            "tagStatus": "any",
            "countType": "imageCountMoreThan",
            "countNumber": 10
          },
          "action": {
            "type": "expire"
          }
        }
      ]
    }' 2>/dev/null || true
    
  echo "  ✓ ${REPO_NAME} ready"
done

echo ""
echo "All ECR repositories created successfully!"
echo "Now run: ./ecr-push.sh to build and push images"
