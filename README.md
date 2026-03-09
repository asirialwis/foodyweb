# Food Ordering App — Complete Architecture & Deep Explanation

> **Project**: Cloud-Native Food Ordering Microservices Application  
> **Framework**: NestJS (TypeScript)  
> **Date**: February 2026

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [The Four Microservices](#2-the-four-microservices)
3. [Complete Order Flow](#3-complete-order-flow)
4. [RabbitMQ Communication](#4-how-rabbitmq-communication-works)
5. [Security Layers](#5-security--multiple-layers)
6. [Database Design](#6-database-design--one-db-per-service)
7. [Docker Containerization](#7-docker--how-containers-are-built)
8. [CI/CD Pipeline](#8-cicd-pipeline--per-service)
9. [Startup Sequence](#9-how-everything-starts)
10. [API Endpoints Reference](#10-api-endpoints-reference)
11. [Environment Variables](#11-environment-variables)
12. [Deployment Plan](#12-deployment-plan)
13. [Project Structure](#13-project-structure)
14. [Technology Summary](#14-technology-summary)

---

## 1. High-Level Architecture

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

The application follows the **microservices architecture pattern** where each service:
- Is independently deployable
- Has its own database (Database per Service pattern)
- Communicates with other services via RabbitMQ (asynchronous messaging)
- Exposes REST APIs for external clients (HTTP)
- Runs inside a Docker container

---

## 2. The Four Microservices

### 2.1 User Service (Port 3001) — The Gatekeeper

**Purpose**: Authentication, user management, JWT token issuance

**Responsibilities**:
- User registration with password hashing (bcrypt)
- User login with JWT token generation
- Profile management (CRUD operations)
- Role-based access control (customer, restaurant_owner, delivery_driver, admin)
- Token validation for other services via RabbitMQ

**Database Collections**: `users`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2b$10$...(hashed)",
  "role": "customer",
  "phone": "+1234567890",
  "address": { "street": "123 Main St", "city": "NYC", "zipCode": "10001" }
}
```

**RabbitMQ Handlers**:
| Pattern | Type | Purpose |
|---------|------|---------|
| `validate_user` | MessagePattern | Validate a user ID exists and return user data |
| `get_user` | MessagePattern | Retrieve user details by ID |

---

### 2.2 Restaurant Service (Port 3002) — The Catalog

**Purpose**: Restaurant and menu management

**Responsibilities**:
- Restaurant CRUD (create, read, update, delete)
- Menu item management (linked to restaurants)
- Search and filter restaurants by cuisine, rating, location
- Restaurant validation for Order Service

**Database Collections**: `restaurants`, `menuitems`
```json
// Restaurant
{
  "name": "Pizza Palace",
  "address": { "street": "456 Oak Ave", "city": "NYC" },
  "cuisine": ["Italian", "Pizza"],
  "rating": 4.5,
  "isActive": true,
  "openingHours": { "open": "10:00", "close": "22:00" },
  "ownerId": "user_id_here"
}

// Menu Item
{
  "name": "Margherita Pizza",
  "description": "Classic pizza with tomato and mozzarella",
  "price": 12.99,
  "category": "Pizza",
  "restaurantId": "restaurant_id_here",
  "isAvailable": true
}
```

**RabbitMQ Handlers**:
| Pattern | Type | Purpose |
|---------|------|---------|
| `get_restaurant` | MessagePattern | Get restaurant by ID |
| `validate_restaurant` | MessagePattern | Verify restaurant exists and is active |
| `get_menu_items` | MessagePattern | Get all menu items for a restaurant |
| `get_menu_item` | MessagePattern | Get a single menu item by ID |

---

### 2.3 Order Service (Port 3003) — The Brain

**Purpose**: Order orchestration, payment tracking, status management

This is the **most complex service** — it coordinates with Restaurant Service and Delivery Service during order placement.

**Responsibilities**:
- Order placement (validates restaurant, creates delivery)
- Order status lifecycle management
- Payment status tracking
- Order cancellation (notifies Delivery Service)
- Listens for delivery status updates

**Database Collections**: `orders`
```json
{
  "userId": "user_id",
  "restaurantId": "restaurant_id",
  "items": [
    { "menuItemId": "item_id", "name": "Margherita Pizza", "quantity": 2, "price": 12.99 }
  ],
  "totalAmount": 25.98,
  "status": "pending",
  "paymentStatus": "pending",
  "deliveryId": "delivery_id",
  "deliveryAddress": { "street": "789 Elm St", "city": "NYC" }
}
```

**Order Status Lifecycle**:
```
pending → confirmed → preparing → ready → picked_up → delivered
   │                                                      
   └─────────────────→ cancelled
```

**RabbitMQ Handlers**:
| Pattern | Type | Purpose |
|---------|------|---------|
| `get_order` | MessagePattern | Get order by ID |
| `get_orders_by_user` | MessagePattern | Get all orders for a user |
| `delivery_status_updated` | EventPattern | React to delivery status changes |

**RabbitMQ Outbound Messages**:
| Pattern | Target | Purpose |
|---------|--------|---------|
| `validate_restaurant` | Restaurant Service | Verify restaurant before order |
| `create_delivery` | Delivery Service | Create delivery record for new order |
| `cancel_delivery` | Delivery Service | Cancel delivery on order cancellation |

---

### 2.4 Delivery Service (Port 3004) — The Last Mile

**Purpose**: Delivery tracking, driver management, GPS location

**Responsibilities**:
- Delivery creation (triggered by Order Service via RabbitMQ)
- Delivery status management
- Driver registration and management
- Driver assignment to deliveries
- Real-time GPS location updates
- Notifies Order Service on status changes

**Database Collections**: `deliveries`, `drivers`
```json
// Delivery
{
  "orderId": "order_id",
  "driverId": "driver_id",
  "status": "in_transit",
  "pickupAddress": { "street": "456 Oak Ave", "city": "NYC" },
  "deliveryAddress": { "street": "789 Elm St", "city": "NYC" },
  "currentLocation": { "latitude": 40.7128, "longitude": -74.0060 },
  "estimatedDeliveryTime": "2026-02-27T14:30:00Z"
}

// Driver
{
  "userId": "user_id",
  "name": "Jane Driver",
  "phone": "+1234567890",
  "vehicleType": "motorcycle",
  "vehicleNumber": "AB-1234",
  "currentLocation": { "latitude": 40.7128, "longitude": -74.0060 },
  "isAvailable": true,
  "isVerified": true
}
```

**Delivery Status Lifecycle**:
```
pending → assigned → picked_up → in_transit → delivered
   │                                              
   └──────────────────────────→ failed (cancelled)
```

**RabbitMQ Handlers**:
| Pattern | Type | Purpose |
|---------|------|---------|
| `create_delivery` | MessagePattern | Create delivery for a new order |
| `get_delivery` | MessagePattern | Get delivery details |
| `get_delivery_by_order` | MessagePattern | Get delivery by order ID |
| `cancel_delivery` | EventPattern | Cancel/fail a delivery |

**RabbitMQ Outbound Events**:
| Pattern | Target | Purpose |
|---------|--------|---------|
| `delivery_status_updated` | Order Service | Notify order of delivery status change |

---

## 3. Complete Order Flow

### Phase 1: User Registration & Login
```
1. Customer → POST /auth/register → User Service
   - Validates input (class-validator DTOs)
   - Hashes password with bcrypt (10 salt rounds)
   - Saves user to MongoDB
   - Returns 201 Created

2. Customer → POST /auth/login → User Service
   - Finds user by email
   - Compares password hash
   - Generates JWT token (contains: userId, email, role)
   - Returns { access_token: "eyJhbGciOi..." }
```

### Phase 2: Browse Restaurants & Menus
```
3. Customer → GET /restaurants → Restaurant Service
   - Returns list of active restaurants
   - Supports filtering by cuisine, rating

4. Customer → GET /menu-items/restaurant/:id → Restaurant Service
   - Returns all available menu items for chosen restaurant
```

### Phase 3: Place Order (The Complex Part)
```
5. Customer → POST /orders → Order Service (with JWT in header)
   a. JwtAuthGuard extracts userId from token
   b. Order Service sends 'validate_restaurant' message to RabbitMQ
   c. Restaurant Service receives message, validates restaurant exists & is active
   d. Restaurant Service responds with restaurant data (or null)
   e. Order Service calculates total amount from items
   f. Order Service saves order to MongoDB (status: 'pending')
   g. Order Service sends 'create_delivery' message to RabbitMQ
   h. Delivery Service receives message, creates delivery record
   i. Delivery Service responds with delivery data
   j. Order Service updates order with deliveryId
   k. Order Service returns complete order to customer
```

### Phase 4: Delivery Lifecycle
```
6. Driver assigned to delivery
   → PATCH /deliveries/:id/assign → Delivery Service

7. Driver picks up food
   → PATCH /deliveries/:id/status {status: 'picked_up'} → Delivery Service
   → Delivery Service emits 'delivery_status_updated' event
   → Order Service receives event, updates order status to 'picked_up'

8. Driver updates GPS location
   → PATCH /deliveries/:id/location {lat, lng} → Delivery Service

9. Driver delivers food
   → PATCH /deliveries/:id/status {status: 'delivered'} → Delivery Service
   → Delivery Service emits 'delivery_status_updated' event
   → Order Service receives event, updates order status to 'delivered'
```

### Phase 5: Order Cancellation (Alternative Flow)
```
10. Customer → POST /orders/:id/cancel → Order Service
    a. Order Service updates order status to 'cancelled'
    b. Order Service emits 'cancel_delivery' event via RabbitMQ
    c. Delivery Service receives event
    d. Delivery Service updates delivery status to 'failed'
```

---

## 4. How RabbitMQ Communication Works

### Hybrid Application Pattern

Each NestJS service runs as a **hybrid application** — two servers in one process:

```typescript
// main.ts of each service
const app = await NestFactory.create(AppModule);

// Connect to RabbitMQ as microservice
app.connectMicroservice({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL],
    queue: 'service_queue_name',
    queueOptions: { durable: false },
  },
});

await app.startAllMicroservices(); // Start RabbitMQ listener
await app.listen(PORT);            // Start HTTP server
```

### Two Communication Patterns

#### Pattern 1: `@MessagePattern` — Request/Response (Synchronous-like)

```
Order Service → RabbitMQ → Restaurant Service → RabbitMQ → Order Service
     send('validate_restaurant', data)     returns { restaurant }
```

**Code in sender (Order Service)**:
```typescript
const restaurant = await firstValueFrom(
  this.restaurantClient.send('validate_restaurant', { restaurantId }).pipe(
    timeout(5000),
    catchError(err => of(null)),
  ),
);
```

**Code in receiver (Restaurant Service)**:
```typescript
@MessagePattern('validate_restaurant')
async handleValidateRestaurant(@Payload() data: { restaurantId: string }) {
  return await this.restaurantsService.findById(data.restaurantId);
}
```

- The sender **waits** for a response (with 5-second timeout)
- Used when the sender NEEDS data back before proceeding
- Examples: validate restaurant, get menu items, create delivery

#### Pattern 2: `@EventPattern` — Fire-and-Forget (Asynchronous)

```
Delivery Service → RabbitMQ → Order Service
     emit('delivery_status_updated', data)     (no response)
```

**Code in emitter (Delivery Service)**:
```typescript
this.orderClient.emit('delivery_status_updated', {
  orderId: delivery.orderId,
  deliveryId: delivery._id,
  status: newStatus,
});
```

**Code in listener (Order Service)**:
```typescript
@EventPattern('delivery_status_updated')
async handleDeliveryStatusUpdate(@Payload() data) {
  // Update order status based on delivery status
}
```

- The emitter does NOT wait — sends and moves on immediately
- Used for notifications where no response is needed
- Examples: delivery status changed, cancel delivery

### RabbitMQ Queue Architecture

```
RabbitMQ Broker (Port 5672)
├── user_queue         ← User Service listens
│   ├── validate_user (MessagePattern)
│   └── get_user (MessagePattern)
│
├── restaurant_queue   ← Restaurant Service listens
│   ├── get_restaurant (MessagePattern)
│   ├── validate_restaurant (MessagePattern)
│   ├── get_menu_items (MessagePattern)
│   └── get_menu_item (MessagePattern)
│
├── order_queue        ← Order Service listens
│   ├── get_order (MessagePattern)
│   ├── get_orders_by_user (MessagePattern)
│   └── delivery_status_updated (EventPattern)
│
└── delivery_queue     ← Delivery Service listens
    ├── create_delivery (MessagePattern)
    ├── get_delivery (MessagePattern)
    ├── get_delivery_by_order (MessagePattern)
    └── cancel_delivery (EventPattern)
```

### RMQ Module (Shared Configuration)

Each service has a `rmq/rmq.module.ts` that configures RabbitMQ clients:

```typescript
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'RESTAURANT_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'restaurant_queue',
            queueOptions: { durable: false },
          },
        }),
        inject: [ConfigService],
      },
      // ... other service clients
    ]),
  ],
  exports: [ClientsModule],
})
export class RmqModule {}
```

---

## 5. Security — Multiple Layers

### Layer 1: Network Security
| Mechanism | What It Does |
|-----------|-------------|
| Docker Network Isolation | Services communicate only within `food-ordering-network` |
| CORS | Restricts which domains can call the APIs |

### Layer 2: Transport Security
| Mechanism | What It Does |
|-----------|-------------|
| Helmet.js | Sets secure HTTP headers (X-Frame-Options, CSP, etc.) |
| Rate Limiting | 100 requests per 15 minutes per IP address |

### Layer 3: Authentication & Authorization
| Mechanism | What It Does |
|-----------|-------------|
| JWT Tokens | Stateless authentication via Passport.js |
| bcrypt | Password hashing with 10 salt rounds |
| Role-based Access | `customer`, `restaurant_owner`, `delivery_driver`, `admin` |

**How JWT works across services**:
1. User logs into User Service → receives JWT token
2. Client sends JWT in `Authorization: Bearer <token>` header to ANY service
3. Each service has a `JwtAuthGuard` that decodes the token locally (all services share the same `JWT_SECRET`)
4. Guard extracts userId and role, attaches to request object
5. RabbitMQ handlers bypass JWT guards (internal service-to-service trust)

### Layer 4: Input Validation
| Mechanism | What It Does |
|-----------|-------------|
| class-validator | Validates all incoming DTOs (Data Transfer Objects) |
| Mongoose Schema | Database-level validation and type enforcement |
| ValidationPipe | Global NestJS pipe that auto-validates all request bodies |

### Layer 5: DevSecOps
| Mechanism | What It Does |
|-----------|-------------|
| SonarCloud | Static Application Security Testing (SAST) in CI/CD |
| npm audit | Checks for known vulnerabilities in dependencies |
| Non-root Docker | Containers run as user `nestjs` (UID 1001), not root |
| Multi-stage Docker | Production image contains only compiled code, not source |

---

## 6. Database Design — One DB Per Service

### Why Separate Databases?

This follows the **Database per Service** pattern — a core microservices principle:

| Benefit | Explanation |
|---------|-------------|
| Independent Deployment | Change one service's schema without affecting others |
| No Schema Coupling | Teams can evolve their data models independently |
| Independent Scaling | Scale each database based on its own load |
| Fault Isolation | A DB failure in one service doesn't crash others |
| Technology Freedom | Each service could use a different DB if needed |

### Database Mapping

| Service | Database Name | Port | Collections |
|---------|--------------|------|-------------|
| User Service | `user-service` | 27017 | `users` |
| Restaurant Service | `restaurant-service` | 27018 | `restaurants`, `menuitems` |
| Order Service | `order-service` | 27019 | `orders` |
| Delivery Service | `delivery-service` | 27020 | `deliveries`, `drivers` |

### Data Relationships (Cross-Service References)

Since services can't join across databases, they store **IDs as references** and resolve them via RabbitMQ:

```
Order Document:
{
  userId: "65a1..."       → Belongs to User Service DB
  restaurantId: "65b2..." → Belongs to Restaurant Service DB  
  deliveryId: "65c3..."   → Belongs to Delivery Service DB
  items[].menuItemId      → Belongs to Restaurant Service DB
}
```

When Order Service needs restaurant details, it sends a `get_restaurant` message to Restaurant Service via RabbitMQ, rather than querying the restaurant database directly.

---

## 7. Docker — How Containers Are Built

### Multi-Stage Dockerfile (Each Service)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules prod_node_modules
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nestjs && adduser -S nestjs -u 1001
WORKDIR /app
COPY --from=builder --chown=nestjs:nestjs /app/prod_node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main"]
```

**Why multi-stage?**
- Stage 1 has everything (source, devDependencies, TypeScript compiler) → ~800MB
- Stage 2 has only compiled JS + production dependencies → ~150MB
- Source code never exists in the production image (security)

**Why non-root user?**
- If the container is compromised, the attacker has limited permissions
- Cannot install packages, modify system files, or escalate privileges

### Docker Compose — 6 Containers

```
docker-compose up --build
```

Starts:
1. `rabbitmq` — Message broker with management UI (port 15672)
2. `mongodb-user` — MongoDB for User Service (port 27017)
3. `mongodb-restaurant` — MongoDB for Restaurant Service (port 27018)
4. `mongodb-order` — MongoDB for Order Service (port 27019)
5. `mongodb-delivery` — MongoDB for Delivery Service (port 27020)
6. `user-service` → `restaurant-service` → `order-service` → `delivery-service`

**Startup order**: MongoDB containers start first, then RabbitMQ (with health check), then services start only after RabbitMQ is healthy.

---

## 8. CI/CD Pipeline — Per Service

Each service has its **own independent GitHub Actions workflow** file:

```
.github/workflows/
├── user-service.yml
├── restaurant-service.yml
├── order-service.yml
└── delivery-service.yml
```

### Pipeline Stages

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌──────────┐
│  Stage 1:   │───→│    Stage 2:      │───→│    Stage 3:       │───→│ Stage 4: │
│  Test       │    │  Security Scan   │    │  Build & Push     │    │ Deploy   │
│             │    │                  │    │                   │    │          │
│ - npm lint  │    │ - npm audit      │    │ - Docker build    │    │ - Deploy │
│ - npm test  │    │ - SonarCloud     │    │ - Docker push     │    │   to     │
│ - npm build │    │   SAST scan      │    │   to registry     │    │   cloud  │
└─────────────┘    └──────────────────┘    └───────────────────┘    └──────────┘
```

**Why separate pipelines per service?**
- If you only change Order Service code, only `order-service.yml` runs
- Other services are NOT rebuilt, tested, or deployed — saving time and resources
- Each team member can own their CI/CD pipeline independently

### Trigger Rules

Each workflow triggers only when its service directory changes:

```yaml
on:
  push:
    branches: [main]
    paths: ['order-service/**']  # Only triggers for order-service changes
```

---

## 9. How Everything Starts

### With Docker Compose (Production-like)
```
docker-compose up --build

1. Docker creates bridge network: food-ordering-network
2. MongoDB containers start (4 instances, ports 27017-27020)
3. RabbitMQ starts, runs health check (ping every 10 seconds)
4. Once RabbitMQ is healthy → all 4 NestJS services start simultaneously
5. Each service:
   a. Loads environment variables from Docker Compose
   b. Connects to its own MongoDB instance
   c. Starts HTTP server (Express) on its designated port
   d. Connects to RabbitMQ and subscribes to its named queue
   e. Registers Swagger docs at /api endpoint
   f. Applies global middleware: Helmet, CORS, rate limiting, ValidationPipe
6. System is ready — all services accepting HTTP and RabbitMQ messages
```

### Locally (Development)
```bash
# Terminal 1: Start RabbitMQ (Docker required)
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Terminal 2-5: Start each service
cd user-service && cp .env.example .env && npm install && npm run start:dev
cd restaurant-service && cp .env.example .env && npm install && npm run start:dev
cd order-service && cp .env.example .env && npm install && npm run start:dev
cd delivery-service && cp .env.example .env && npm install && npm run start:dev
```

---

## 10. API Endpoints Reference

### User Service (Port 3001)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| GET | `/auth/profile` | Get current user profile | JWT |
| GET | `/users` | List all users | JWT (Admin) |
| GET | `/users/:id` | Get user by ID | JWT |
| PATCH | `/users/:id` | Update user | JWT |
| DELETE | `/users/:id` | Delete user | JWT |
| GET | `/health` | Health check | No |

### Restaurant Service (Port 3002)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/restaurants` | Create restaurant | JWT |
| GET | `/restaurants` | List restaurants | No |
| GET | `/restaurants/:id` | Get restaurant | No |
| PATCH | `/restaurants/:id` | Update restaurant | JWT |
| DELETE | `/restaurants/:id` | Delete restaurant | JWT |
| POST | `/menu-items` | Create menu item | JWT |
| GET | `/menu-items` | List menu items | No |
| GET | `/menu-items/restaurant/:id` | Menu by restaurant | No |
| GET | `/menu-items/:id` | Get menu item | No |
| PATCH | `/menu-items/:id` | Update menu item | JWT |
| DELETE | `/menu-items/:id` | Delete menu item | JWT |
| GET | `/health` | Health check | No |

### Order Service (Port 3003)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/orders` | Create order | JWT |
| GET | `/orders` | List orders | JWT |
| GET | `/orders/:id` | Get order | JWT |
| GET | `/orders/user/:userId` | Orders by user | JWT |
| GET | `/orders/restaurant/:id` | Orders by restaurant | JWT |
| PATCH | `/orders/:id/status` | Update order status | JWT |
| PATCH | `/orders/:id/payment` | Update payment status | JWT |
| POST | `/orders/:id/cancel` | Cancel order | JWT |
| GET | `/health` | Health check | No |

### Delivery Service (Port 3004)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/deliveries` | Create delivery | JWT |
| GET | `/deliveries` | List deliveries | JWT |
| GET | `/deliveries/:id` | Get delivery | JWT |
| GET | `/deliveries/order/:orderId` | Delivery by order | JWT |
| GET | `/deliveries/driver/:driverId` | Deliveries by driver | JWT |
| PATCH | `/deliveries/:id/status` | Update delivery status | JWT |
| PATCH | `/deliveries/:id/assign` | Assign driver | JWT |
| PATCH | `/deliveries/:id/location` | Update GPS location | JWT |
| POST | `/drivers` | Register as driver | JWT |
| GET | `/drivers` | List drivers | No |
| GET | `/drivers/available` | Available drivers | No |
| GET | `/drivers/:id` | Get driver | No |
| PATCH | `/drivers/:id` | Update driver | JWT |
| PATCH | `/drivers/:id/location` | Update driver GPS | JWT |
| PATCH | `/drivers/:id/availability` | Toggle availability | JWT |
| DELETE | `/drivers/:id` | Delete driver | JWT |
| GET | `/health` | Health check | No |

### Swagger Documentation

Each service has auto-generated Swagger docs:

| Service | Swagger URL |
|---------|------------|
| User Service | http://localhost:3001/api |
| Restaurant Service | http://localhost:3002/api |
| Order Service | http://localhost:3003/api |
| Delivery Service | http://localhost:3004/api |

---

## 11. Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Service port | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/user-service` |
| `JWT_SECRET` | JWT signing secret (shared across services) | `your-jwt-secret-key` |
| `JWT_EXPIRATION` | Token expiration time | `3600s` |
| `RABBITMQ_URL` | RabbitMQ connection URL | `amqp://guest:guest@localhost:5672` |

---

## 12. Deployment Plan

### Local Development
```bash
docker-compose up --build
# All services at localhost:3001-3004
# RabbitMQ Management at localhost:15672
```

### Production Deployment

| Step | Action | Tool |
|------|--------|------|
| 1 | Push code to GitHub `main` branch | `git push` |
| 2 | GitHub Actions CI/CD triggers (4 independent workflows) | Automatic |
| 3 | Test & lint | `npm run lint && npm test` |
| 4 | Security scan | SonarCloud + `npm audit` |
| 5 | Build Docker image | Multi-stage Dockerfile |
| 6 | Push to container registry | Docker Hub / AWS ECR / Azure ACR |
| 7 | Deploy to cloud | ECS Fargate / Azure Container Apps / Kubernetes |

### Recommended Cloud Stack

| Component | Local | Production |
|-----------|-------|------------|
| MongoDB | Docker containers | MongoDB Atlas (managed) |
| RabbitMQ | Docker container | CloudAMQP or Amazon MQ (managed) |
| Services | Docker Compose | AWS ECS Fargate / Azure Container Apps |
| Networking | Docker bridge | VPC + Security Groups |
| Monitoring | Logs only | CloudWatch / Azure Monitor |

---

## 13. Project Structure

```
food-ordering-app/
├── .github/
│   └── workflows/
│       ├── user-service.yml          # CI/CD for User Service
│       ├── restaurant-service.yml    # CI/CD for Restaurant Service
│       ├── order-service.yml         # CI/CD for Order Service
│       └── delivery-service.yml      # CI/CD for Delivery Service
│
├── user-service/                     # Student 1
│   ├── src/
│   │   ├── auth/                     # Authentication module
│   │   │   ├── auth.controller.ts    # Login/Register endpoints
│   │   │   ├── auth.service.ts       # Auth business logic
│   │   │   ├── auth.module.ts        # Module definition
│   │   │   ├── jwt.strategy.ts       # Passport JWT strategy
│   │   │   └── dto/                  # Request validation DTOs
│   │   ├── users/                    # Users module
│   │   │   ├── users.controller.ts   # User CRUD + RabbitMQ handlers
│   │   │   ├── users.service.ts      # User business logic
│   │   │   ├── schemas/              # Mongoose schemas
│   │   │   └── dto/                  # Request validation DTOs
│   │   ├── rmq/                      # RabbitMQ client module
│   │   │   └── rmq.module.ts         # Client configuration
│   │   ├── health/                   # Health check endpoint
│   │   ├── common/                   # Guards, decorators, filters
│   │   ├── app.module.ts             # Root module
│   │   └── main.ts                   # Entry point (hybrid app)
│   ├── Dockerfile                    # Multi-stage Docker build
│   ├── .dockerignore
│   ├── .env.example                  # Environment template
│   ├── sonar-project.properties      # SonarCloud config
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── package.json
│
├── restaurant-service/               # Student 2
│   ├── src/
│   │   ├── restaurants/              # Restaurants CRUD module
│   │   ├── menu-items/               # Menu items module
│   │   ├── rmq/                      # RabbitMQ client module
│   │   ├── health/
│   │   ├── common/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   └── ...
│
├── order-service/                    # Student 3
│   ├── src/
│   │   ├── orders/                   # Order orchestration module
│   │   ├── rmq/                      # RabbitMQ client module
│   │   ├── health/
│   │   ├── common/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   └── ...
│
├── delivery-service/                 # Student 4
│   ├── src/
│   │   ├── deliveries/               # Delivery tracking module
│   │   ├── drivers/                  # Driver management module
│   │   ├── rmq/                      # RabbitMQ client module
│   │   ├── health/
│   │   ├── common/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   └── ...
│
├── docker-compose.yml                # Full stack orchestration
├── README.md                         # Project documentation
├── ARCHITECTURE.md                   # This file
└── .gitignore
```

---

## 14. Technology Summary

| Concern | Technology | Why |
|---------|-----------|-----|
| Framework | NestJS v10 (TypeScript) | Modular, built-in microservices support, decorators |
| Database | MongoDB + Mongoose | Flexible schema, one DB per service |
| Messaging | RabbitMQ (@nestjs/microservices) | Async communication, decoupling, event-driven |
| Auth | JWT + Passport.js | Stateless tokens, works across services with shared secret |
| API Docs | Swagger/OpenAPI | Auto-generated from decorators at `/api` |
| Validation | class-validator + class-transformer | Decorator-based DTO validation |
| Security | Helmet + express-rate-limit + bcrypt | Defense in depth (headers, brute-force, passwords) |
| Containers | Docker (multi-stage builds) | Small images (~150MB), non-root user, reproducible |
| Orchestration | Docker Compose | Single command to start entire stack |
| CI/CD | GitHub Actions (4 workflows) | Independent pipelines per service |
| SAST | SonarCloud | Static code analysis for vulnerabilities |
| Package Manager | npm | Dependency management per service |

---

## Team Responsibilities

| Student | Service | Key Skills Demonstrated |
|---------|---------|------------------------|
| Student 1 | User Service | JWT auth, bcrypt, Passport.js, role-based access, RabbitMQ handlers |
| Student 2 | Restaurant Service | CRUD operations, search/filter, Mongoose schemas, RabbitMQ handlers |
| Student 3 | Order Service | Service orchestration, RabbitMQ send/emit, timeout handling, event processing |
| Student 4 | Delivery Service | GPS tracking, driver management, event emission, status lifecycle |

---

*CTSE Cloud Computing Assignment — February 2026*
