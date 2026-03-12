#!/bin/bash
# ============================================================
# Deploy Azure Infrastructure using Bicep
# Usage: ./deploy-bicep.sh
# ============================================================
set -e

RESOURCE_GROUP="${RESOURCE_GROUP:-food-ordering-rg}"
LOCATION="${LOCATION:-southeastasia}"
TEMPLATE_FILE="$(dirname "$0")/bicep/main.bicep"

echo "============================================"
echo "  Bicep Deployment - Food Ordering App"
echo "============================================"

# Check login
az account show > /dev/null 2>&1 || { echo "ERROR: Run 'az login' first"; exit 1; }

# Create resource group
echo "[1/3] Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output table

# Prompt for secrets
echo ""
echo "[2/3] Collecting parameters..."
read -p "JWT Secret (or press Enter for auto-generated): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo "  Generated JWT Secret: $JWT_SECRET"
fi

read -p "RabbitMQ URL (CloudAMQP): " RABBITMQ_URL
if [ -z "$RABBITMQ_URL" ]; then
  echo "  WARNING: Using placeholder. Update after deployment."
  RABBITMQ_URL="amqp://guest:guest@localhost:5672"
fi

read -p "ACR Name (default: foodorderingacr): " ACR_NAME
ACR_NAME="${ACR_NAME:-foodorderingacr}"

read -p "Image Tag (default: latest): " IMAGE_TAG
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Deploy
echo ""
echo "[3/3] Deploying infrastructure..."
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$TEMPLATE_FILE" \
  --parameters \
    acrName="$ACR_NAME" \
    jwtSecret="$JWT_SECRET" \
    rabbitMqUrl="$RABBITMQ_URL" \
    imageTag="$IMAGE_TAG" \
  --output table

echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""

# Show outputs
az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs" \
  --output json
