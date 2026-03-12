#!/bin/bash
# ============================================================
# Deploy/Update Individual Container App
# Usage: ./deploy-service.sh <service-name> [image-tag]
# Example: ./deploy-service.sh user-service latest
# ============================================================
set -e

SERVICE_NAME="${1:?Usage: ./deploy-service.sh <service-name> [image-tag]}"
IMAGE_TAG="${2:-latest}"

RESOURCE_GROUP="${RESOURCE_GROUP:-food-ordering-rg}"
ACR_NAME="${ACR_NAME:-foodorderingacr}"
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"

echo "============================================"
echo "  Deploying $SERVICE_NAME:$IMAGE_TAG"
echo "============================================"

# Update the container app with new image
az containerapp update \
  --name "$SERVICE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_LOGIN_SERVER/$SERVICE_NAME:$IMAGE_TAG" \
  --output table

# Get the FQDN
FQDN=$(az containerapp show \
  --name "$SERVICE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "✓ $SERVICE_NAME updated successfully!"
echo "  URL:     https://$FQDN"
echo "  Swagger: https://$FQDN/api"
echo "  Health:  https://$FQDN/health"
echo "============================================"
