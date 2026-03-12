# AWS Cloud Deployment Guide

## Quick Reference — What Goes Where

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Cloud                                │
│                                                              │
│  ┌──────────────┐    ┌──────────────────────────────────┐   │
│  │  Amazon ECR   │    │  Amazon ECS (Fargate)             │   │
│  │  ────────────│    │  ──────────────────────────────── │   │
│  │  Container    │───→│  user-service      (Port 3001)   │   │
│  │  Registry     │───→│  restaurant-service (Port 3002)  │   │
│  │  (stores      │───→│  order-service      (Port 3003)  │   │
│  │   images)     │───→│  delivery-service   (Port 3004)  │   │
│  └──────────────┘    └──────────┬───────────────────────┘   │
│                                  │                           │
│                        ┌─────────▼─────────┐                │
│                        │   Amazon MQ        │                │
│                        │   (RabbitMQ)       │                │
│                        │   Port 5671 (TLS)  │                │
│                        └───────────────────┘                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  MongoDB Atlas                        │   │
│  │  user-service DB | restaurant-service DB              │   │
│  │  order-service DB | delivery-service DB               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │ SSM Parameter    │  │ CloudWatch Logs   │                  │
│  │ Store (secrets)  │  │ (monitoring)      │                  │
│  └─────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Deployment

### Step 1: Set Up MongoDB Atlas (Free Tier)

1. Go to https://cloud.mongodb.com → Create free account
2. Create a **free M0 cluster** in `ap-southeast-1` (Singapore)
3. Create database user (username + password)
4. In **Network Access** → Add `0.0.0.0/0` (allow from anywhere) or your VPC CIDR
5. Get connection strings for 4 databases:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/user-service
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/restaurant-service
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/order-service
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/delivery-service
   ```

### Step 2: Set Up RabbitMQ on AWS

#### Option A: Amazon MQ (Recommended for AWS)

```bash
# Create RabbitMQ broker
aws mq create-broker \
  --broker-name food-ordering-rabbitmq \
  --engine-type RABBITMQ \
  --engine-version "3.11" \
  --host-instance-type mq.t3.micro \
  --deployment-mode SINGLE_INSTANCE \
  --publicly-accessible \
  --users '[{"Username":"admin","Password":"YourStrongPass123!","Groups":["admin"]}]' \
  --region ap-southeast-1

# Wait ~15 minutes for it to be ready, then get the endpoint:
aws mq describe-broker \
  --broker-id YOUR_BROKER_ID \
  --query 'BrokerInstances[0].Endpoints' \
  --output table
```

**Connection URL**: `amqps://admin:YourStrongPass123!@BROKER_ENDPOINT:5671`

> Note: Amazon MQ uses port **5671** (TLS) not 5672

#### Option B: CloudAMQP (Simpler, Free Tier)

1. Go to https://www.cloudamqp.com → Sign up free
2. Create a **Little Lemur** instance (free)
3. Select region close to your AWS region
4. Copy the AMQP URL from the dashboard
   ```
   amqps://username:password@host.cloudamqp.com/username
   ```

### Step 3: Push Docker Images to AWS ECR

```bash
# 1. Configure AWS CLI (if not done)
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-southeast-1)

# 2. Create ECR repositories
cd deploy/aws
chmod +x ecr-setup.sh
./ecr-setup.sh

# 3. Build and push all images
chmod +x ecr-push.sh
./ecr-push.sh
```

**What happens:**
```
Your Code → Docker Build → Tag Image → Push to ECR
                                           ↓
                              xxxxxxxx.dkr.ecr.ap-southeast-1.amazonaws.com/
                                food-ordering-app/user-service:latest
                                food-ordering-app/restaurant-service:latest
                                food-ordering-app/order-service:latest
                                food-ordering-app/delivery-service:latest
```

### Step 4: Deploy to AWS ECS (Fargate)

#### Option A: Quick Deploy (EC2 + docker-compose) — Current Setup

Since you already have an EC2 instance at `54.179.184.235`:

```bash
# SSH into your EC2
ssh -i your-key.pem ec2-user@54.179.184.235

# Pull latest code
cd microservice
git pull

# Create production .env file
cp .env.production .env
# Edit .env with your actual MongoDB Atlas + RabbitMQ URLs
nano .env

# Login to ECR and pull images
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com

# Start with production compose
docker-compose -f docker-compose.prod.yml --env-file .env up -d
```

#### Option B: Full ECS Fargate Deployment (Production-grade)

```bash
# 1. Store secrets in SSM Parameter Store
aws ssm put-parameter --name "/food-ordering/jwt-secret" --type SecureString --value "your-jwt-secret"
aws ssm put-parameter --name "/food-ordering/rabbitmq-url" --type SecureString --value "amqps://admin:pass@broker.mq.amazonaws.com:5671"
aws ssm put-parameter --name "/food-ordering/user-service/mongodb-uri" --type SecureString --value "mongodb+srv://..."
aws ssm put-parameter --name "/food-ordering/restaurant-service/mongodb-uri" --type SecureString --value "mongodb+srv://..."
aws ssm put-parameter --name "/food-ordering/order-service/mongodb-uri" --type SecureString --value "mongodb+srv://..."
aws ssm put-parameter --name "/food-ordering/delivery-service/mongodb-uri" --type SecureString --value "mongodb+srv://..."

# 2. Create ECS Cluster
aws ecs create-cluster --cluster-name food-ordering-cluster

# 3. Register Task Definitions (replace YOUR_ACCOUNT_ID in JSON files first)
aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/user-service.json
aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/restaurant-service.json
aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/order-service.json
aws ecs register-task-definition --cli-input-json file://ecs-task-definitions/delivery-service.json

# 4. Create ECS Services
for SERVICE in user-service restaurant-service order-service delivery-service; do
  aws ecs create-service \
    --cluster food-ordering-cluster \
    --service-name ${SERVICE} \
    --task-definition ${SERVICE} \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
done
```

### Step 5: Configure Interconnections

All services connect through **RabbitMQ** — there's no direct service-to-service URL needed.

```
Service A → RabbitMQ Queue → Service B
         (RABBITMQ_URL)
```

**The only environment variables each service needs:**

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Its own MongoDB Atlas connection string |
| `JWT_SECRET` | Same across all 4 services |
| `RABBITMQ_URL` | Same across all 4 services (your Amazon MQ endpoint) |

Since all services use the **same** `RABBITMQ_URL`, they automatically discover each other through named queues:
- `user_queue`, `restaurant_queue`, `order_queue`, `delivery_queue`

**No service URLs needed!** This is the advantage of message broker architecture.

### Step 6: Set Up GitHub Actions Secrets

In your GitHub repo → Settings → Secrets → Actions:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key |

Now when you push to `main`, the CI/CD pipeline will:
1. Test → Security Scan → Build Docker image → Push to ECR → Deploy to ECS

---

## Verify Deployment

```bash
# Check all containers are running
docker ps

# Check health endpoints
curl http://YOUR_IP:3001/health
curl http://YOUR_IP:3002/health
curl http://YOUR_IP:3003/health
curl http://YOUR_IP:3004/health

# Check Swagger UI
# Open in browser: http://YOUR_IP:3001/api

# Check RabbitMQ Management (Amazon MQ)
# Open in AWS Console → Amazon MQ → Your Broker → RabbitMQ Web Console

# Test full order flow
# 1. Register user:  POST http://YOUR_IP:3001/auth/register
# 2. Login:          POST http://YOUR_IP:3001/auth/login
# 3. Create restaurant: POST http://YOUR_IP:3002/restaurants
# 4. Add menu item:  POST http://YOUR_IP:3002/menu-items
# 5. Place order:    POST http://YOUR_IP:3003/orders
# 6. Check delivery: GET  http://YOUR_IP:3004/deliveries
```

---

## Cost Estimate (Free Tier / Minimal)

| Service | Free Tier | Paid (Minimal) |
|---------|-----------|----------------|
| EC2 (t2.micro) | 12 months free | ~$8/month |
| MongoDB Atlas (M0) | Free forever | $0 |
| CloudAMQP (Lemur) | Free forever | $0 |
| Amazon MQ (mq.t3.micro) | Not free | ~$25/month |
| ECR | 500MB free | ~$0.10/GB/month |
| ECS Fargate | Not free | ~$15/month (4 services) |

**Cheapest option for assignment**: EC2 + MongoDB Atlas + CloudAMQP = **~$0-8/month**
