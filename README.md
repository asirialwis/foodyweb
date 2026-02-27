# Food Ordering App - Microservices Architecture

A secure, microservice-based food ordering application built with **NestJS**, **MongoDB**, **RabbitMQ**, and **Docker**, following DevOps best practices and cloud-native design principles.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                    │
├─────────────┬──────────────┬──────────────┬─────────────────────┤
│             │              │              │                     │
│  ┌──────────▼──────────┐  │  ┌───────────▼──────────┐          │
│  │   User Service      │  │  │  Restaurant Service  │          │
│  │   (Port 3001)       │  │  │  (Port 3002)         │          │
│  │   - Authentication  │  │  │  - Restaurant CRUD   │          │
│  │   - User Profiles   │  │  │  - Menu Management   │          │
│  │   - JWT Tokens      │  │  │  - Search/Filter     │          │
│  │   [MongoDB]         │  │  │  [MongoDB]            │          │
│  └──────────┬──────────┘  │  └───────────┬──────────┘          │
│             │              │              │                     │
│             └──────────┐   │   ┌──────────┘                    │
│                  ┌─────▼───▼───▼─────┐                         │
│                  │    RabbitMQ       │                         │
│                  │  Message Broker   │                         │
│                  │  (Port 5672)      │                         │
│                  └─────┬───────┬─────┘                         │
│             ┌──────────┘       └──────────┐                    │
│             │                             │                    │
│  ┌──────────▼──────────┐  ┌───────────────▼──────────┐         │
│  │   Order Service     │  │  Delivery Service        │         │
│  │   (Port 3003)       │  │  (Port 3004)             │         │
│  │   - Order Placement │  │  - Delivery Tracking     │         │
│  │   - Payment Status  │  │  - Driver Management     │         │
│  │   - Order History   │  │  - GPS Location          │         │
│  │   [MongoDB]         │  │  [MongoDB]                │         │
│  └─────────────────────┘  └──────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Microservices

| Service | Port | Description | Owner |
|---------|------|-------------|-------|
| **User Service** | 3001 | Authentication, registration, JWT tokens, user profiles | Student 1 |
| **Restaurant Service** | 3002 | Restaurant CRUD, menu management, food items | Student 2 |
| **Order Service** | 3003 | Order placement, status tracking, payment management | Student 3 |
| **Delivery Service** | 3004 | Delivery tracking, driver management, GPS locations | Student 4 |

## Inter-Service Communication (RabbitMQ)

All inter-service communication uses **RabbitMQ** as the message broker. Each service runs as a **hybrid application** (HTTP + RabbitMQ) using `@nestjs/microservices`.

### Message Patterns (Request/Response)

| Pattern | Producer | Consumer | Purpose |
|---------|----------|----------|----------|
| `validate_user` | Any Service | User Service | Validate user token/ID |
| `get_user` | Any Service | User Service | Get user details |
| `get_restaurant` | Order Service | Restaurant Service | Get restaurant details |
| `validate_restaurant` | Order Service | Restaurant Service | Validate restaurant exists |
| `get_menu_items` | Order Service | Restaurant Service | Get menu items |
| `get_menu_item` | Order Service | Restaurant Service | Get single menu item |
| `get_order` | Delivery Service | Order Service | Get order details |
| `get_orders_by_user` | Any Service | Order Service | Get orders for a user |
| `create_delivery` | Order Service | Delivery Service | Create delivery for order |
| `get_delivery` | Order Service | Delivery Service | Get delivery status |
| `get_delivery_by_order` | Order Service | Delivery Service | Get delivery by order ID |

### Event Patterns (Fire-and-Forget)

| Event | Emitter | Listener | Purpose |
|-------|---------|----------|----------|
| `delivery_status_updated` | Delivery Service | Order Service | Notify order of delivery status change |
| `cancel_delivery` | Order Service | Delivery Service | Cancel a delivery |

### RabbitMQ Queues

| Queue | Service | Description |
|-------|---------|-------------|
| `user_queue` | User Service | Handles user-related messages |
| `restaurant_queue` | Restaurant Service | Handles restaurant/menu messages |
| `order_queue` | Order Service | Handles order-related messages |
| `delivery_queue` | Delivery Service | Handles delivery messages |

## Tech Stack

- **Framework:** NestJS (TypeScript)
- **Database:** MongoDB (separate DB per service)
- **Message Broker:** RabbitMQ (via @nestjs/microservices)
- **Authentication:** JWT (JSON Web Tokens) with Passport.js
- **API Documentation:** Swagger/OpenAPI
- **Containerization:** Docker with multi-stage builds
- **CI/CD:** GitHub Actions
- **Security:** Helmet, Rate Limiting, CORS, bcrypt, IAM roles
- **DevSecOps:** SonarCloud integration for SAST

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- MongoDB (or use Docker)
- RabbitMQ (or use Docker)

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd food-ordering-app

# Start all services with Docker Compose
docker-compose up --build

# Services will be available at:
# User Service:       http://localhost:3001
# Restaurant Service: http://localhost:3002
# Order Service:      http://localhost:3003
# Delivery Service:   http://localhost:3004
# RabbitMQ Management: http://localhost:15672 (guest/guest)
```

### Option 2: Run Individually

```bash
# For each service (user-service, restaurant-service, order-service, delivery-service):
cd <service-name>
cp .env.example .env
npm install
npm run start:dev
```

## API Documentation (Swagger)

Each service has Swagger documentation available at `/api`:

- User Service: http://localhost:3001/api
- Restaurant Service: http://localhost:3002/api
- Order Service: http://localhost:3003/api
- Delivery Service: http://localhost:3004/api

## API Endpoints

### User Service (Port 3001)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /auth/register | Register new user | No |
| POST | /auth/login | Login user | No |
| GET | /auth/profile | Get current user profile | JWT |
| GET | /users | List all users | JWT (Admin) |
| GET | /users/:id | Get user by ID | JWT |
| PATCH | /users/:id | Update user | JWT |
| DELETE | /users/:id | Delete user | JWT |
| GET | /health | Health check | No |

### Restaurant Service (Port 3002)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /restaurants | Create restaurant | JWT |
| GET | /restaurants | List restaurants | No |
| GET | /restaurants/:id | Get restaurant | No |
| PATCH | /restaurants/:id | Update restaurant | JWT |
| DELETE | /restaurants/:id | Delete restaurant | JWT |
| POST | /menu-items | Create menu item | JWT |
| GET | /menu-items | List menu items | No |
| GET | /menu-items/restaurant/:id | Menu by restaurant | No |
| GET | /menu-items/:id | Get menu item | No |
| PATCH | /menu-items/:id | Update menu item | JWT |
| DELETE | /menu-items/:id | Delete menu item | JWT |
| GET | /health | Health check | No |

### Order Service (Port 3003)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /orders | Create order | JWT |
| GET | /orders | List orders | JWT |
| GET | /orders/:id | Get order | JWT |
| GET | /orders/user/:userId | Orders by user | JWT |
| GET | /orders/restaurant/:id | Orders by restaurant | JWT |
| PATCH | /orders/:id/status | Update order status | JWT |
| PATCH | /orders/:id/payment | Update payment status | JWT |
| POST | /orders/:id/cancel | Cancel order | JWT |
| GET | /health | Health check | No |

### Delivery Service (Port 3004)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /deliveries | Create delivery | JWT |
| GET | /deliveries | List deliveries | JWT |
| GET | /deliveries/:id | Get delivery | JWT |
| GET | /deliveries/order/:orderId | Delivery by order | JWT |
| GET | /deliveries/driver/:driverId | Deliveries by driver | JWT |
| PATCH | /deliveries/:id/status | Update delivery status | JWT |
| PATCH | /deliveries/:id/assign | Assign driver | JWT |
| PATCH | /deliveries/:id/location | Update GPS location | JWT |
| POST | /drivers | Register as driver | JWT |
| GET | /drivers | List drivers | No |
| GET | /drivers/available | Available drivers | No |
| GET | /drivers/:id | Get driver | No |
| PATCH | /drivers/:id | Update driver | JWT |
| PATCH | /drivers/:id/location | Update driver GPS | JWT |
| PATCH | /drivers/:id/availability | Toggle availability | JWT |
| DELETE | /drivers/:id | Delete driver | JWT |
| GET | /health | Health check | No |

## Security Measures

1. **Authentication & Authorization**
   - JWT-based authentication with Passport.js
   - Role-based access control (customer, restaurant_owner, delivery_driver, admin)

2. **API Security**
   - Helmet.js for HTTP security headers
   - Rate limiting (100 requests per 15 minutes per IP)
   - CORS configuration
   - Input validation with class-validator

3. **Data Security**
   - Password hashing with bcryptjs
   - MongoDB connection string via environment variables
   - Non-root Docker containers

4. **DevSecOps**
   - SonarCloud integration for SAST (Static Application Security Testing)
   - npm audit in CI/CD pipeline
   - Docker security best practices (multi-stage builds, non-root user)

5. **Infrastructure Security**
   - Separate databases per microservice
   - Environment-based configuration
   - Docker network isolation

## CI/CD Pipeline

Each service has its own GitHub Actions workflow with:

1. **Test Stage** - Run linting, unit tests, and build
2. **Security Scan** - npm audit + SonarCloud SAST analysis
3. **Build & Push** - Docker image build and push to container registry
4. **Deploy** - Deploy to cloud provider (AWS ECS / Azure Container Apps)

## Project Structure

```
food-ordering-app/
├── .github/
│   └── workflows/
│       ├── user-service.yml
│       ├── restaurant-service.yml
│       ├── order-service.yml
│       └── delivery-service.yml
├── user-service/           # Student 1
│   ├── src/
│   │   ├── auth/          # Authentication module
│   │   ├── users/         # Users module
│   │   ├── rmq/           # RabbitMQ client module
│   │   ├── health/        # Health check
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── sonar-project.properties
│   └── package.json
├── restaurant-service/     # Student 2
│   ├── src/
│   │   ├── restaurants/   # Restaurants module
│   │   ├── menu-items/    # Menu items module
│   │   ├── rmq/           # RabbitMQ client module
│   │   ├── health/        # Health check
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── sonar-project.properties
│   └── package.json
├── order-service/          # Student 3
│   ├── src/
│   │   ├── orders/        # Orders module
│   │   ├── rmq/           # RabbitMQ client module
│   │   ├── health/        # Health check
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── sonar-project.properties
│   └── package.json
├── delivery-service/       # Student 4
│   ├── src/
│   │   ├── deliveries/    # Deliveries module
│   │   ├── drivers/       # Drivers module
│   │   ├── rmq/           # RabbitMQ client module
│   │   ├── health/        # Health check
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── sonar-project.properties
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Environment Variables

Each service uses the following environment variables (see `.env.example` in each service):

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Service port | 3001 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/user-service |
| JWT_SECRET | JWT signing secret | your-jwt-secret-key |
| JWT_EXPIRATION | Token expiration | 3600s |
| RABBITMQ_URL | RabbitMQ connection URL | amqp://guest:guest@localhost:5672 |

## Cloud Deployment

The services are designed to be deployed on any major cloud provider:

### AWS (ECS)
- Push Docker images to Amazon ECR
- Deploy on Amazon ECS with Fargate
- Use Application Load Balancer for routing
- MongoDB Atlas for managed database

### Azure (Container Apps)
- Push Docker images to Azure Container Registry
- Deploy on Azure Container Apps
- Use Azure API Management for gateway
- MongoDB Atlas or Azure Cosmos DB

### Kubernetes (EKS/AKS/GKE)
- Deploy on managed Kubernetes
- Use Kubernetes Services for inter-service communication
- Use Ingress controller for external access

## Development

```bash
# Install dependencies for a service
cd user-service && npm install

# Run in development mode
npm run start:dev

# Run tests
npm run test

# Run test coverage
npm run test:cov

# Build for production
npm run build
```

## Team Members

| Student | Service | Responsibilities |
|---------|---------|-----------------|
| Student 1 | User Service | Authentication, JWT, user management |
| Student 2 | Restaurant Service | Restaurant CRUD, menu management |
| Student 3 | Order Service | Order lifecycle, payment tracking |
| Student 4 | Delivery Service | Delivery tracking, driver management |

## License

MIT
