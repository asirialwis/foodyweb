#!/bin/bash
# ============================================================
# Azure Container Registry (ACR) Setup Script
# Food Ordering App - Microservices
# ============================================================
set -e

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-food-ordering-rg}"
LOCATION="${LOCATION:-southeastasia}"
ACR_NAME="${ACR_NAME:-foodorderingacr}"  # Must be globally unique, lowercase alphanumeric

echo "============================================"
echo "  Azure Container Registry Setup"
echo "============================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location:       $LOCATION"
echo "ACR Name:       $ACR_NAME"
echo "============================================"

# Check if Azure CLI is logged in
echo ""
echo "[1/5] Checking Azure CLI authentication..."
az account show > /dev/null 2>&1 || { echo "ERROR: Please login first with 'az login'"; exit 1; }
echo "✓ Authenticated as: $(az account show --query user.name -o tsv)"

# Create Resource Group
echo ""
echo "[2/5] Creating Resource Group..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output table

# Create Azure Container Registry
echo ""
echo "[3/5] Creating Azure Container Registry..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output table

# Get ACR credentials
echo ""
echo "[4/5] Retrieving ACR credentials..."
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

echo ""
echo "[5/5] Setup Complete!"
echo "============================================"
echo "  ACR Details"
echo "============================================"
echo "Login Server: $ACR_LOGIN_SERVER"
echo "Username:     $ACR_USERNAME"
echo "Password:     $ACR_PASSWORD"
echo ""
echo "To login to ACR:"
echo "  az acr login --name $ACR_NAME"
echo ""
echo "Or with Docker:"
echo "  docker login $ACR_LOGIN_SERVER -u $ACR_USERNAME -p $ACR_PASSWORD"
echo ""
echo "============================================"
echo "  GitHub Secrets to Set"
echo "============================================"
echo "AZURE_ACR_LOGIN_SERVER = $ACR_LOGIN_SERVER"
echo "AZURE_ACR_USERNAME     = $ACR_USERNAME"
echo "AZURE_ACR_PASSWORD     = $ACR_PASSWORD"
echo "============================================"
