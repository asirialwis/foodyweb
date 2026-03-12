# Azure Deployment Guide - Food Ordering App

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Azure Cloud                                   │
│                                                                       │
│  ┌───────────────┐    ┌──────────────────────────────────────────┐  │
│  │  Azure         │    │  Azure Container Apps Environment         │  │
│  │  Container     │    │                                            │  │
│  │  Registry      │───▶│  ┌──────────┐  ┌───────────────────┐    │  │
│  │  (ACR)         │    │  │ user     │  │ restaurant        │    │  │
│  │                │    │  │ service  │  │ service            │    │  │
│  │  - user-svc    │    │  │ :3001    │  │ :3002              │    │  │
│  │  - rest-svc    │    │  └─────┬────┘  └──────────┬────────┘    │  │
│  │  - order-svc   │    │        │                   │              │  │
│  │  - deliv-svc   │    │        │   ┌───────────┐   │              │  │
│  └───────────────┘    │        └──▶│ RabbitMQ  │◀──┘              │  │
│                        │        ┌──▶│ (internal)│◀──┐              │  │
│                        │        │   └───────────┘   │              │  │
│  ┌───────────────┐    │  ┌─────┴────┐  ┌──────────┴────────┐    │  │
│  │  Azure         │    │  │ order    │  │ delivery           │    │  │
│  │  Cosmos DB     │◀───│  │ service  │  │ service            │    │  │
│  │  (MongoDB API) │    │  │ :3003    │  │ :3004              │    │  │
│  │                │    │  └──────────┘  └───────────────────┘    │  │
│  │  - user-db     │    │                                            │  │
│  │  - restaurant  │    └──────────────────────────────────────────┘  │
│  │  - order-db    │                                                   │
│  │  - delivery-db │    ┌──────────────────────────────────────────┐  │
│  └───────────────┘    │  Log Analytics / Azure Monitor             │  │
│                        └──────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  GitHub Actions CI/CD → ACR → Azure Container Apps           │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Step 1: Azure Setup](#2-step-1-azure-setup)
3. [Step 2: Create Container Registry (ACR)](#3-step-2-create-container-registry-acr)
4. [Step 3: Setup MongoDB (Cosmos DB)](#4-step-3-setup-mongodb-cosmos-db)
5. [Step 4: Setup RabbitMQ](#5-step-4-setup-rabbitmq)
6. [Step 5: Build & Push Docker Images](#6-step-5-build--push-docker-images)
7. [Step 6: Deploy with Azure Container Apps](#7-step-6-deploy-with-azure-container-apps)
8. [Step 7: Configure CI/CD (GitHub Actions)](#8-step-7-configure-cicd-github-actions)
9. [Step 8: Verify Deployment](#9-step-8-verify-deployment)
10. [Alternative: VM Deployment with Docker Compose](#10-alternative-vm-deployment-with-docker-compose)
11. [Monitoring & Logging](#11-monitoring--logging)
12. [Cost Estimates](#12-cost-estimates)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

- **Azure Account** — [Free tier](https://azure.microsoft.com/free/) includes $200 credit
- **Azure CLI** — [Install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Docker Desktop** — Running locally for building images
- **Git** — For version control

### Verify Installation

```bash
az --version          # Azure CLI 2.x+
docker --version      # Docker 20.x+
git --version         # Git 2.x+
```

### Login to Azure

```bash
az login
az account show       # Verify active subscription
```

---

## 2. Step 1: Azure Setup

### Option A: Automated (Recommended)

Run our infrastructure setup script:

```bash
# From project root
chmod +x deploy/azure/setup-infrastructure.sh
./deploy/azure/setup-infrastructure.sh
```

This creates everything: Resource Group, ACR, Cosmos DB, Container Apps Environment, RabbitMQ, and deploys all 4 services.

### Option B: Manual (Step by Step)

Follow sections 3-7 below.

### Configuration Variables

```bash
export RESOURCE_GROUP="food-ordering-rg"
export LOCATION="southeastasia"          # Choose your nearest region
export ACR_NAME="foodorderingacr"        # Must be globally unique
export ENVIRONMENT_NAME="food-ordering-env"
```

### Create Resource Group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

---

## 3. Step 2: Create Container Registry (ACR)

```bash
# Create ACR (Basic tier - cheapest)
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Get login credentials
az acr credential show --name $ACR_NAME
# Note the "username" and "passwords[0].value"

# Login to ACR
az acr login --name $ACR_NAME
```

Or use the setup script:

```bash
chmod +x deploy/azure/acr-setup.sh
./deploy/azure/acr-setup.sh
```

---

## 4. Step 3: Setup MongoDB (Cosmos DB)

### Option A: Azure Cosmos DB (MongoDB API) — Native Azure

```bash
# Create Cosmos DB account with MongoDB API (Free tier available!)
az cosmosdb create \
  --name food-ordering-cosmos \
  --resource-group $RESOURCE_GROUP \
  --kind MongoDB \
  --server-version "7.0" \
  --enable-free-tier true \
  --locations regionName=$LOCATION failoverPriority=0

# Create databases for each service
az cosmosdb mongodb database create \
  --account-name food-ordering-cosmos \
  --resource-group $RESOURCE_GROUP \
  --name user-service

az cosmosdb mongodb database create \
  --account-name food-ordering-cosmos \
  --resource-group $RESOURCE_GROUP \
  --name restaurant-service

az cosmosdb mongodb database create \
  --account-name food-ordering-cosmos \
  --resource-group $RESOURCE_GROUP \
  --name order-service

az cosmosdb mongodb database create \
  --account-name food-ordering-cosmos \
  --resource-group $RESOURCE_GROUP \
  --name delivery-service

# Get connection string
az cosmosdb keys list \
  --name food-ordering-cosmos \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings
```

**Connection string format:**
```
mongodb://<account>:<key>@<account>.mongo.cosmos.azure.com:10255/<db-name>?ssl=true&retryWrites=false
```

### Option B: MongoDB Atlas (Free M0 Cluster) — Simpler

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free M0 cluster (Azure region: Southeast Asia)
3. Create database user
4. Whitelist `0.0.0.0/0` (for Azure Container Apps)
5. Get connection string for each database

---

## 5. Step 4: Setup RabbitMQ

### Option A: CloudAMQP (Recommended for Cost — FREE)

1. Go to [CloudAMQP](https://www.cloudamqp.com)
2. Sign up → Create instance
3. Plan: **Lemur (Free)** — 1M messages/month
4. Region: Azure / Southeast Asia
5. Copy the AMQP URL

```
amqps://username:password@host/vhost
```

### Option B: RabbitMQ on Azure Container Apps (Self-managed)

The `setup-infrastructure.sh` script deploys RabbitMQ as an internal Container App:

```bash
az containerapp create \
  --name rabbitmq \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
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
    RABBITMQ_DEFAULT_PASS=SecurePassword123
```

### Option C: Azure Service Bus (Enterprise)

Azure Service Bus supports AMQP but requires a protocol adapter for RabbitMQ compatibility. Not recommended for this project.

---

## 6. Step 5: Build & Push Docker Images

### Build and push all 4 services:

```bash
# Login to ACR
az acr login --name $ACR_NAME

ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

# Build and push each service
for SERVICE in user-service restaurant-service order-service delivery-service; do
  echo "Building $SERVICE..."
  docker build -t $ACR_SERVER/$SERVICE:latest ./$SERVICE
  docker push $ACR_SERVER/$SERVICE:latest
  echo "✓ $SERVICE pushed"
done
```

Or use the push script:

```bash
chmod +x deploy/azure/acr-push.sh
./deploy/azure/acr-push.sh
```

### Verify images in ACR:

```bash
az acr repository list --name $ACR_NAME --output table
az acr repository show-tags --name $ACR_NAME --repository user-service --output table
```

---

## 7. Step 6: Deploy with Azure Container Apps

### Create Container Apps Environment

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group $RESOURCE_GROUP \
  --workspace-name food-ordering-logs

LOG_ID=$(az monitor log-analytics workspace show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name food-ordering-logs \
  --query customerId -o tsv)

LOG_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group $RESOURCE_GROUP \
  --workspace-name food-ordering-logs \
  --query primarySharedKey -o tsv)

# Create Container Apps Environment
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --logs-workspace-id $LOG_ID \
  --logs-workspace-key $LOG_KEY
```

### Deploy Each Service

```bash
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USER=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# Set your connection strings
COSMOS_CONN="your-cosmos-connection-string"
RABBITMQ_URL="your-rabbitmq-url"
JWT_SECRET="your-jwt-secret"

# Deploy user-service
az containerapp create \
  --name user-service \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_SERVER/user-service:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --target-port 3001 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars \
    PORT=3001 \
    NODE_ENV=production \
    MONGODB_URI="${COSMOS_CONN}user-service?ssl=true&retryWrites=false" \
    JWT_SECRET=$JWT_SECRET \
    JWT_EXPIRATION=3600s \
    RABBITMQ_URL=$RABBITMQ_URL

# Deploy restaurant-service
az containerapp create \
  --name restaurant-service \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_SERVER/restaurant-service:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --target-port 3002 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars \
    PORT=3002 \
    NODE_ENV=production \
    MONGODB_URI="${COSMOS_CONN}restaurant-service?ssl=true&retryWrites=false" \
    JWT_SECRET=$JWT_SECRET \
    RABBITMQ_URL=$RABBITMQ_URL

# Deploy order-service
az containerapp create \
  --name order-service \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_SERVER/order-service:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --target-port 3003 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars \
    PORT=3003 \
    NODE_ENV=production \
    MONGODB_URI="${COSMOS_CONN}order-service?ssl=true&retryWrites=false" \
    JWT_SECRET=$JWT_SECRET \
    RABBITMQ_URL=$RABBITMQ_URL

# Deploy delivery-service
az containerapp create \
  --name delivery-service \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_SERVER/delivery-service:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --target-port 3004 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars \
    PORT=3004 \
    NODE_ENV=production \
    MONGODB_URI="${COSMOS_CONN}delivery-service?ssl=true&retryWrites=false" \
    JWT_SECRET=$JWT_SECRET \
    RABBITMQ_URL=$RABBITMQ_URL
```

### Get Service URLs

```bash
for SERVICE in user-service restaurant-service order-service delivery-service; do
  FQDN=$(az containerapp show --name $SERVICE --resource-group $RESOURCE_GROUP \
    --query "properties.configuration.ingress.fqdn" -o tsv)
  echo "$SERVICE: https://$FQDN"
done
```

---

## 8. Step 7: Configure CI/CD (GitHub Actions)

### Step 7a: Create Azure Service Principal

```bash
# Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "food-ordering-cicd" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth
```

Save the JSON output — you'll need it for GitHub Secrets.

### Step 7b: Set GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | Value |
|---|---|
| `AZURE_CREDENTIALS` | Full JSON output from service principal creation |
| `AZURE_ACR_LOGIN_SERVER` | `foodorderingacr.azurecr.io` |
| `AZURE_ACR_USERNAME` | ACR admin username |
| `AZURE_ACR_PASSWORD` | ACR admin password |

### Step 7c: CI/CD Pipeline Flow

The updated workflows (`.github/workflows/*.yml`) now:

1. **Test** → Run lint, unit tests, coverage
2. **Security Scan** → npm audit + SonarCloud
3. **Build & Push** → Build Docker image → Push to ACR
4. **Deploy** → Azure Login → Deploy to Azure Container Apps

```
Push to main → Test → Security Scan → Build & Push to ACR → Deploy to Container Apps
```

---

## 9. Step 8: Verify Deployment

### Health Checks

```bash
# Get URLs
for SERVICE in user-service restaurant-service order-service delivery-service; do
  FQDN=$(az containerapp show --name $SERVICE --resource-group $RESOURCE_GROUP \
    --query "properties.configuration.ingress.fqdn" -o tsv)
  echo "Checking $SERVICE..."
  curl -s "https://$FQDN/health" | jq .
  echo ""
done
```

### Swagger UI

Open in browser:
- User Service: `https://<user-service-fqdn>/api`
- Restaurant Service: `https://<restaurant-service-fqdn>/api`
- Order Service: `https://<order-service-fqdn>/api`
- Delivery Service: `https://<delivery-service-fqdn>/api`

### Test Inter-Service Communication

1. Register a user via User Service Swagger
2. Login to get JWT token
3. Create a restaurant via Restaurant Service
4. Create a menu item
5. Place an order via Order Service (this triggers RabbitMQ messages)
6. Check delivery status via Delivery Service

---

## 10. Alternative: VM Deployment with Docker Compose

If you prefer a simpler deployment on an Azure VM:

### Create VM

```bash
# Create VM with Docker pre-installed
az vm create \
  --resource-group $RESOURCE_GROUP \
  --name food-ordering-vm \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard

# Open ports
az vm open-port --resource-group $RESOURCE_GROUP --name food-ordering-vm --port 3001-3004 --priority 1001
az vm open-port --resource-group $RESOURCE_GROUP --name food-ordering-vm --port 15672 --priority 1002
```

### Install Docker on VM

```bash
# SSH into VM
VM_IP=$(az vm show -d --resource-group $RESOURCE_GROUP --name food-ordering-vm --query publicIps -o tsv)
ssh azureuser@$VM_IP

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for docker group
exit
ssh azureuser@$VM_IP
```

### Deploy on VM

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/microservice.git
cd microservice

# Option 1: Use local containers (dev - simplest)
docker-compose up -d --build

# Option 2: Pull from ACR (prod)
az acr login --name $ACR_NAME
docker-compose -f docker-compose.azure.yml --env-file .env.azure up -d
```

---

## 11. Monitoring & Logging

### View Container App Logs

```bash
# Real-time logs
az containerapp logs show \
  --name user-service \
  --resource-group $RESOURCE_GROUP \
  --follow

# System logs
az containerapp logs show \
  --name user-service \
  --resource-group $RESOURCE_GROUP \
  --type system
```

### Log Analytics Queries (Azure Portal)

Go to **Log Analytics Workspace** → **Logs** and run:

```kusto
// All container app logs
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "user-service"
| order by TimeGenerated desc
| take 100

// Error logs across all services
ContainerAppConsoleLogs_CL
| where Log_s contains "error" or Log_s contains "Error"
| order by TimeGenerated desc
| take 50

// Request count per service
ContainerAppConsoleLogs_CL
| summarize count() by ContainerAppName_s, bin(TimeGenerated, 1h)
| render timechart
```

### Azure Monitor Alerts

```bash
# Create alert for container restart
az monitor metrics alert create \
  --name "service-restart-alert" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP" \
  --condition "count RestartCount > 3" \
  --description "Alert when a service restarts more than 3 times"
```

---

## 12. Cost Estimates

### Container Apps (Pay-per-use)

| Resource | Free Tier | Estimated Cost |
|---|---|---|
| Container Apps | 2M requests/month free | ~$0-5/month |
| ACR Basic | — | ~$5/month |
| Cosmos DB (Free Tier) | 1000 RU/s + 25GB free | $0/month |
| CloudAMQP (Lemur) | 1M messages free | $0/month |
| Log Analytics | 5GB/month free | ~$0/month |
| **Total** | | **~$5-10/month** |

### VM Deployment (Fixed cost)

| Resource | Size | Estimated Cost |
|---|---|---|
| Azure VM (B2s) | 2 vCPU, 4GB RAM | ~$30/month |
| Managed Disk | 30GB | ~$1.50/month |
| Public IP | Static | ~$3/month |
| MongoDB Atlas (Free) | M0 | $0/month |
| CloudAMQP (Free) | Lemur | $0/month |
| **Total** | | **~$35/month** |

### Azure for Students

- **$100 free credit** (no credit card required!)
- Register: https://azure.microsoft.com/free/students/
- Includes free tier of most services

---

## 13. Troubleshooting

### Common Issues

#### 1. ACR Login Fails
```bash
# Ensure admin enabled
az acr update --name $ACR_NAME --admin-enabled true
# Re-login
az acr login --name $ACR_NAME
```

#### 2. Container App Won't Start
```bash
# Check logs
az containerapp logs show --name user-service --resource-group $RESOURCE_GROUP --type system
# Check revision status
az containerapp revision list --name user-service --resource-group $RESOURCE_GROUP --output table
```

#### 3. RabbitMQ Connection Refused
- Verify the RABBITMQ_URL env var is correct
- If using internal Container App, ensure services are in the same environment
- CloudAMQP: check that the instance is active

#### 4. Cosmos DB Connection Error
- Ensure `retryWrites=false` in connection string (required for Cosmos MongoDB API)
- Ensure `ssl=true` is in connection string  
- Whitelist `0.0.0.0/0` in Cosmos DB firewall for Container Apps

#### 5. Service Can't Reach Another Service via RabbitMQ
- All services must use the **same RABBITMQ_URL**
- Queue names are hardcoded: `user_queue`, `restaurant_queue`, `order_queue`, `delivery_queue`
- RabbitMQ handles service discovery — no direct URLs needed

### Useful Commands

```bash
# List all container apps
az containerapp list --resource-group $RESOURCE_GROUP --output table

# Scale a service
az containerapp update --name user-service --resource-group $RESOURCE_GROUP --min-replicas 2 --max-replicas 5

# Update environment variable
az containerapp update --name user-service --resource-group $RESOURCE_GROUP \
  --set-env-vars "JWT_SECRET=new-secret-value"

# Restart a service (new revision)
az containerapp update --name user-service --resource-group $RESOURCE_GROUP \
  --image $ACR_SERVER/user-service:latest

# Delete everything when done
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

---

## Quick Reference: Interconnections

```
┌──────────────────────────────────────────────────────────┐
│                    Shared Configuration                    │
│                                                            │
│  RABBITMQ_URL = amqps://...  (same for ALL 4 services)   │
│  JWT_SECRET   = abc123...    (same for ALL 4 services)   │
│  MONGODB_URI  = unique per service (different databases)  │
│                                                            │
│  Services communicate via RabbitMQ named queues:          │
│    user_queue       ← User Service listens                │
│    restaurant_queue ← Restaurant Service listens          │
│    order_queue      ← Order Service listens               │
│    delivery_queue   ← Delivery Service listens            │
│                                                            │
│  No direct HTTP calls between services!                   │
│  RabbitMQ handles all inter-service messaging.            │
└──────────────────────────────────────────────────────────┘
```
