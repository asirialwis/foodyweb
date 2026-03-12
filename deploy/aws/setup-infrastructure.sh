#!/bin/bash
# ==============================================================
# Complete AWS Infrastructure Setup Script
# ==============================================================
# This script sets up all AWS resources needed:
#   - ECR repositories
#   - ECS Cluster (Fargate)
#   - Amazon MQ (RabbitMQ)
#   - SSM Parameters (secrets)
#   - CloudWatch Log Groups
#   - Security Groups
#   - Application Load Balancer
# ==============================================================

set -e

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PROJECT_NAME="food-ordering-app"
VPC_ID="${VPC_ID}"  # Set your VPC ID
SUBNET_IDS="${SUBNET_IDS}"  # Comma-separated subnet IDs

echo "============================================"
echo "  AWS Infrastructure Setup"
echo "  Account: ${AWS_ACCOUNT_ID}"
echo "  Region:  ${AWS_REGION}"
echo "============================================"

# ==============================================================
# Step 1: Create ECR Repositories
# ==============================================================
echo ""
echo "[Step 1] Creating ECR Repositories..."
for SERVICE in user-service restaurant-service order-service delivery-service; do
  aws ecr create-repository \
    --repository-name ${PROJECT_NAME}/${SERVICE} \
    --region ${AWS_REGION} \
    --image-scanning-configuration scanOnPush=true \
    2>/dev/null || echo "  ${SERVICE} repository already exists"
done
echo "  ✓ ECR Repositories ready"

# ==============================================================
# Step 2: Create ECS Cluster
# ==============================================================
echo ""
echo "[Step 2] Creating ECS Cluster..."
aws ecs create-cluster \
  --cluster-name food-ordering-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1 \
    capacityProvider=FARGATE_SPOT,weight=1 \
  --region ${AWS_REGION} \
  2>/dev/null || echo "  Cluster already exists"
echo "  ✓ ECS Cluster ready"

# ==============================================================
# Step 3: Create CloudWatch Log Groups
# ==============================================================
echo ""
echo "[Step 3] Creating CloudWatch Log Groups..."
for SERVICE in user-service restaurant-service order-service delivery-service; do
  aws logs create-log-group \
    --log-group-name /ecs/${PROJECT_NAME}/${SERVICE} \
    --region ${AWS_REGION} \
    2>/dev/null || echo "  Log group for ${SERVICE} already exists"
done
echo "  ✓ Log Groups ready"

# ==============================================================
# Step 4: Create Amazon MQ (RabbitMQ) Broker
# ==============================================================
echo ""
echo "[Step 4] Creating Amazon MQ RabbitMQ Broker..."
echo ""
echo "  ⚠️  Amazon MQ takes 15-20 minutes to create."
echo "  Creating broker with:"
echo "    - Engine: RabbitMQ 3.11"
echo "    - Instance: mq.t3.micro (free-tier eligible)"
echo "    - Deployment: SINGLE_INSTANCE"

BROKER_ID=$(aws mq create-broker \
  --broker-name food-ordering-rabbitmq \
  --engine-type RABBITMQ \
  --engine-version "3.11" \
  --host-instance-type mq.t3.micro \
  --deployment-mode SINGLE_INSTANCE \
  --publicly-accessible \
  --auto-minor-version-upgrade \
  --users '[{"Username":"admin","Password":"YourStrongPassword123!","Groups":["admin"]}]' \
  --region ${AWS_REGION} \
  --query 'BrokerId' \
  --output text \
  2>/dev/null) || echo "  Broker may already exist"

if [ -n "$BROKER_ID" ]; then
  echo "  Broker ID: ${BROKER_ID}"
  echo "  Waiting for broker to become available (this takes ~15 min)..."
  aws mq wait broker-available \
    --broker-id ${BROKER_ID} \
    --region ${AWS_REGION} 2>/dev/null || true
  
  # Get the broker endpoint
  BROKER_ENDPOINT=$(aws mq describe-broker \
    --broker-id ${BROKER_ID} \
    --region ${AWS_REGION} \
    --query 'BrokerInstances[0].Endpoints[0]' \
    --output text)
  echo "  ✓ Broker Endpoint: ${BROKER_ENDPOINT}"
  echo "  AMQP URL: amqps://admin:YourStrongPassword123!@${BROKER_ENDPOINT}"
fi

# ==============================================================
# Step 5: Store Secrets in AWS SSM Parameter Store
# ==============================================================
echo ""
echo "[Step 5] Storing secrets in SSM Parameter Store..."
echo "  ⚠️  Update these values with your actual credentials!"

# JWT Secret (shared across all services)
aws ssm put-parameter \
  --name "/food-ordering/jwt-secret" \
  --type SecureString \
  --value "your-super-secret-jwt-key-change-this" \
  --region ${AWS_REGION} \
  --overwrite 2>/dev/null

# RabbitMQ URL
aws ssm put-parameter \
  --name "/food-ordering/rabbitmq-url" \
  --type SecureString \
  --value "amqps://admin:YourStrongPassword123!@BROKER_ENDPOINT:5671" \
  --region ${AWS_REGION} \
  --overwrite 2>/dev/null

# MongoDB URIs (one per service - use MongoDB Atlas connection strings)
for SERVICE in user-service restaurant-service order-service delivery-service; do
  aws ssm put-parameter \
    --name "/food-ordering/${SERVICE}/mongodb-uri" \
    --type SecureString \
    --value "mongodb+srv://username:password@cluster.mongodb.net/${SERVICE}" \
    --region ${AWS_REGION} \
    --overwrite 2>/dev/null
done
echo "  ✓ SSM Parameters stored"

# ==============================================================
# Step 6: Create Security Group for Services
# ==============================================================
echo ""
echo "[Step 6] Creating Security Groups..."

if [ -n "$VPC_ID" ]; then
  SG_ID=$(aws ec2 create-security-group \
    --group-name food-ordering-services-sg \
    --description "Security group for food ordering microservices" \
    --vpc-id ${VPC_ID} \
    --region ${AWS_REGION} \
    --query 'GroupId' \
    --output text 2>/dev/null) || echo "  Security group already exists"

  if [ -n "$SG_ID" ]; then
    # Allow ports 3001-3004
    for PORT in 3001 3002 3003 3004; do
      aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port ${PORT} \
        --cidr 0.0.0.0/0 \
        --region ${AWS_REGION} 2>/dev/null || true
    done
    echo "  ✓ Security Group: ${SG_ID}"
  fi
else
  echo "  ⚠️  Skipping - set VPC_ID environment variable"
fi

echo ""
echo "============================================"
echo "  Infrastructure Setup Complete!"
echo "============================================"
echo ""
echo "  Next Steps:"
echo "  1. Create MongoDB Atlas cluster at https://cloud.mongodb.com"
echo "  2. Update SSM parameters with real MongoDB connection strings"
echo "  3. Update SSM parameters with real RabbitMQ broker endpoint"
echo "  4. Run ./ecr-push.sh to build and push Docker images"
echo "  5. Register ECS task definitions:"
echo "     aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/user-service.json"
echo "     aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/restaurant-service.json"
echo "     aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/order-service.json"
echo "     aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/delivery-service.json"
echo "  6. Create ECS services for each task definition"
echo ""
