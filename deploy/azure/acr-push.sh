#!/bin/bash
# ============================================================
# Build and Push Docker Images to Azure Container Registry
# Food Ordering App - Microservices
# ============================================================
set -e

# Configuration
ACR_NAME="${ACR_NAME:-foodorderingacr}"
ACR_LOGIN_SERVER="${ACR_LOGIN_SERVER:-${ACR_NAME}.azurecr.io}"
TAG="${TAG:-latest}"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

SERVICES=("user-service" "restaurant-service" "order-service" "delivery-service")

echo "============================================"
echo "  Build & Push to Azure Container Registry"
echo "============================================"
echo "ACR: $ACR_LOGIN_SERVER"
echo "Tag: $TAG, $TIMESTAMP"
echo "============================================"

# Login to ACR
echo ""
echo "[1/3] Logging into ACR..."
az acr login --name "$ACR_NAME"

# Build and push each service
echo ""
echo "[2/3] Building and pushing images..."
for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "---------- $SERVICE ----------"
  
  if [ ! -d "$SERVICE" ]; then
    echo "WARNING: Directory $SERVICE not found, skipping..."
    continue
  fi

  IMAGE="$ACR_LOGIN_SERVER/$SERVICE"
  
  echo "Building $IMAGE..."
  docker build -t "$IMAGE:$TAG" -t "$IMAGE:$TIMESTAMP" "./$SERVICE"
  
  echo "Pushing $IMAGE:$TAG..."
  docker push "$IMAGE:$TAG"
  
  echo "Pushing $IMAGE:$TIMESTAMP..."
  docker push "$IMAGE:$TIMESTAMP"
  
  echo "✓ $SERVICE pushed successfully"
done

# List images in ACR
echo ""
echo "[3/3] Verifying images in ACR..."
for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "$SERVICE tags:"
  az acr repository show-tags --name "$ACR_NAME" --repository "$SERVICE" --output table 2>/dev/null || echo "  (not found yet)"
done

echo ""
echo "============================================"
echo "  All images pushed successfully!"
echo "============================================"
echo ""
echo "Images available at:"
for SERVICE in "${SERVICES[@]}"; do
  echo "  $ACR_LOGIN_SERVER/$SERVICE:$TAG"
done
echo "============================================"
