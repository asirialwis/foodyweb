#!/bin/bash
# ============================================================
# Deploy All Microservices to Azure Container Apps
# Builds, pushes, and deploys all 4 services
# ============================================================
set -e

RESOURCE_GROUP="${RESOURCE_GROUP:-food-ordering-rg}"
ACR_NAME="${ACR_NAME:-foodorderingacr}"
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
IMAGE_TAG="${TAG:-latest}"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

SERVICES=("user-service" "restaurant-service" "order-service" "delivery-service")

echo "============================================"
echo "  Full Deployment Pipeline"
echo "============================================"
echo "ACR:  $ACR_LOGIN_SERVER"
echo "Tag:  $IMAGE_TAG + $TIMESTAMP"
echo "============================================"

# Step 1: Login to ACR
echo ""
echo "[1/3] Logging into ACR..."
az acr login --name "$ACR_NAME"

# Step 2: Build and push all images
echo ""
echo "[2/3] Building and pushing images..."
for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "--- Building $SERVICE ---"
  docker build \
    -t "$ACR_LOGIN_SERVER/$SERVICE:$IMAGE_TAG" \
    -t "$ACR_LOGIN_SERVER/$SERVICE:$TIMESTAMP" \
    "./$SERVICE"
  
  docker push "$ACR_LOGIN_SERVER/$SERVICE:$IMAGE_TAG"
  docker push "$ACR_LOGIN_SERVER/$SERVICE:$TIMESTAMP"
  echo "✓ $SERVICE pushed"
done

# Step 3: Update Container Apps
echo ""
echo "[3/3] Updating Container Apps..."
for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "--- Updating $SERVICE ---"
  az containerapp update \
    --name "$SERVICE" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/$SERVICE:$IMAGE_TAG" \
    --output table
  echo "✓ $SERVICE updated"
done

# Print all URLs
echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
for SERVICE in "${SERVICES[@]}"; do
  FQDN=$(az containerapp show \
    --name "$SERVICE" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null)
  echo "  $SERVICE: https://$FQDN"
done
echo "============================================"
