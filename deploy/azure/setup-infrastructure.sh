#!/bin/bash
# ============================================================
# Azure Infrastructure Setup Script
# Food Ordering App - Microservices
# Sets up: Resource Group, ACR, Azure Container Apps,
#           Azure Service Bus / RabbitMQ, CosmosDB (MongoDB API)
# ============================================================
set -e

# ==================== Configuration ====================
RESOURCE_GROUP="${RESOURCE_GROUP:-food-ordering-rg}"
LOCATION="${LOCATION:-southeastasia}"
ACR_NAME="${ACR_NAME:-foodorderingacr}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-food-ordering-env}"
LOG_ANALYTICS_WORKSPACE="${LOG_ANALYTICS_WORKSPACE:-food-ordering-logs}"
COSMOSDB_ACCOUNT="${COSMOSDB_ACCOUNT:-food-ordering-cosmos}"
RABBITMQ_CONTAINER_NAME="rabbitmq"

# Service names
SERVICES=("user-service" "restaurant-service" "order-service" "delivery-service")
PORTS=(3001 3002 3003 3004)
MONGODB_DBS=("user-service" "restaurant-service" "order-service" "delivery-service")

# ==================== Functions ====================
print_header() {
  echo ""
  echo "============================================"
  echo "  $1"
  echo "============================================"
}

print_step() {
  echo ""
  echo "[$1] $2"
  echo "--------------------------------------------"
}

# ==================== Main Script ====================
print_header "Azure Infrastructure Setup - Food Ordering App"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location:       $LOCATION"
echo "ACR Name:       $ACR_NAME"
echo "Environment:    $ENVIRONMENT_NAME"

# Check Azure CLI
print_step "1/8" "Checking Azure CLI..."
az account show > /dev/null 2>&1 || { echo "ERROR: Run 'az login' first"; exit 1; }
echo "✓ Authenticated as: $(az account show --query user.name -o tsv)"
echo "✓ Subscription: $(az account show --query name -o tsv)"

# Install Container Apps extension
echo "Installing Container Apps extension..."
az extension add --name containerapp --upgrade --yes 2>/dev/null || true
az provider register --namespace Microsoft.App --wait 2>/dev/null || true
az provider register --namespace Microsoft.OperationalInsights --wait 2>/dev/null || true

# Create Resource Group
print_step "2/8" "Creating Resource Group..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output table

# Create Azure Container Registry
print_step "3/8" "Creating Azure Container Registry..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output table

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

echo "✓ ACR Login Server: $ACR_LOGIN_SERVER"

# Create Log Analytics Workspace
print_step "4/8" "Creating Log Analytics Workspace..."
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --location "$LOCATION" \
  --output table

LOG_ANALYTICS_WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --query customerId -o tsv)

LOG_ANALYTICS_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --query primarySharedKey -o tsv)

echo "✓ Log Analytics Workspace ID: $LOG_ANALYTICS_WORKSPACE_ID"

# Create Azure Container Apps Environment
print_step "5/8" "Creating Container Apps Environment..."
az containerapp env create \
  --name "$ENVIRONMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --logs-workspace-id "$LOG_ANALYTICS_WORKSPACE_ID" \
  --logs-workspace-key "$LOG_ANALYTICS_KEY" \
  --output table

echo "✓ Container Apps Environment created"

# Create Azure Cosmos DB with MongoDB API (Free Tier)
print_step "6/8" "Creating Azure Cosmos DB (MongoDB API)..."
az cosmosdb create \
  --name "$COSMOSDB_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --kind MongoDB \
  --server-version "7.0" \
  --default-consistency-level Session \
  --enable-free-tier true \
  --locations regionName="$LOCATION" failoverPriority=0 \
  --output table

# Create databases
for DB in "${MONGODB_DBS[@]}"; do
  echo "Creating database: $DB..."
  az cosmosdb mongodb database create \
    --account-name "$COSMOSDB_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DB" \
    --output table 2>/dev/null || echo "  Database $DB may already exist"
done

COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name "$COSMOSDB_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv)

echo "✓ Cosmos DB created with MongoDB API"

# Deploy RabbitMQ as a Container App
print_step "7/8" "Deploying RabbitMQ as Container App..."
az containerapp create \
  --name "$RABBITMQ_CONTAINER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image rabbitmq:3-management \
  --target-port 5672 \
  --transport tcp \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    RABBITMQ_DEFAULT_USER=admin \
    RABBITMQ_DEFAULT_PASS=RabbitMQ_P@ssw0rd_2026 \
  --output table

RABBITMQ_FQDN=$(az containerapp show \
  --name "$RABBITMQ_CONTAINER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

RABBITMQ_URL="amqp://admin:RabbitMQ_P@ssw0rd_2026@${RABBITMQ_FQDN}:5672"

echo "✓ RabbitMQ deployed internally at: $RABBITMQ_FQDN"

# Deploy Microservices
print_step "8/8" "Deploying Microservices..."
JWT_SECRET="your-super-secret-jwt-key-change-in-production-$(openssl rand -hex 16)"

for i in "${!SERVICES[@]}"; do
  SERVICE="${SERVICES[$i]}"
  PORT="${PORTS[$i]}"
  DB_NAME="${MONGODB_DBS[$i]}"
  
  echo ""
  echo "Deploying $SERVICE on port $PORT..."
  
  # Construct per-service MongoDB URI
  # Extract connection string components and append DB name
  MONGODB_URI="${COSMOS_CONNECTION}${DB_NAME}?retryWrites=false&ssl=true"
  
  az containerapp create \
    --name "$SERVICE" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENVIRONMENT_NAME" \
    --image "$ACR_LOGIN_SERVER/$SERVICE:latest" \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$ACR_USERNAME" \
    --registry-password "$ACR_PASSWORD" \
    --target-port "$PORT" \
    --ingress external \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 0.25 \
    --memory 0.5Gi \
    --env-vars \
      PORT="$PORT" \
      NODE_ENV=production \
      MONGODB_URI="$MONGODB_URI" \
      JWT_SECRET="$JWT_SECRET" \
      JWT_EXPIRATION=3600s \
      RABBITMQ_URL="$RABBITMQ_URL" \
    --output table
  
  SERVICE_FQDN=$(az containerapp show \
    --name "$SERVICE" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv)
  
  echo "✓ $SERVICE deployed at: https://$SERVICE_FQDN"
  echo "  Swagger: https://$SERVICE_FQDN/api"
done

# Print Summary
print_header "Deployment Summary"
echo ""
echo "Resource Group:  $RESOURCE_GROUP"
echo "Location:        $LOCATION"
echo "ACR:             $ACR_LOGIN_SERVER"
echo "Cosmos DB:       $COSMOSDB_ACCOUNT.mongo.cosmos.azure.com"
echo "RabbitMQ:        $RABBITMQ_FQDN (internal)"
echo ""
echo "Service URLs:"
for SERVICE in "${SERVICES[@]}"; do
  FQDN=$(az containerapp show \
    --name "$SERVICE" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null)
  echo "  $SERVICE: https://$FQDN"
  echo "    Swagger: https://$FQDN/api"
  echo "    Health:  https://$FQDN/health"
done

echo ""
print_header "GitHub Secrets Required"
echo "AZURE_ACR_LOGIN_SERVER = $ACR_LOGIN_SERVER"
echo "AZURE_ACR_USERNAME     = $ACR_USERNAME"
echo "AZURE_ACR_PASSWORD     = $ACR_PASSWORD"
echo "AZURE_RESOURCE_GROUP   = $RESOURCE_GROUP"
echo ""
echo "For CI/CD with Azure credentials (Service Principal):"
echo "  az ad sp create-for-rbac --name food-ordering-cicd \\"
echo "    --role contributor \\"
echo "    --scopes /subscriptions/\$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP \\"
echo "    --sdk-auth"
echo ""
echo "Store the output JSON as AZURE_CREDENTIALS GitHub secret"
echo "============================================"
