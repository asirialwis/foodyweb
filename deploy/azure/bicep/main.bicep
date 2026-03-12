// ============================================================
// Azure Bicep Template - Food Ordering App Infrastructure
// Deploys: ACR, Container Apps Environment, Cosmos DB, Microservices
// Usage: az deployment group create --resource-group food-ordering-rg \
//          --template-file main.bicep --parameters acrName=foodorderingacr
// ============================================================

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Azure Container Registry name (must be globally unique)')
param acrName string = 'foodorderingacr'

@description('Cosmos DB account name')
param cosmosDbAccountName string = 'food-ordering-cosmos'

@description('Container Apps environment name')
param environmentName string = 'food-ordering-env'

@description('Log Analytics workspace name')
param logAnalyticsName string = 'food-ordering-logs'

@description('JWT Secret for authentication')
@secure()
param jwtSecret string

@description('RabbitMQ URL (CloudAMQP or self-hosted)')
@secure()
param rabbitMqUrl string

@description('Docker image tag to deploy')
param imageTag string = 'latest'

// ==================== Log Analytics ====================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ==================== Azure Container Registry ====================
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ==================== Cosmos DB (MongoDB API) ====================
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: cosmosDbAccountName
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    apiProperties: {
      serverVersion: '7.0'
    }
  }
}

// Create MongoDB databases
var databaseNames = ['user-service', 'restaurant-service', 'order-service', 'delivery-service']

resource mongoDatabases 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' = [for dbName in databaseNames: {
  parent: cosmosAccount
  name: dbName
  properties: {
    resource: {
      id: dbName
    }
  }
}]

// ==================== Container Apps Environment ====================
resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ==================== Microservices ====================
var services = [
  { name: 'user-service', port: 3001, db: 'user-service' }
  { name: 'restaurant-service', port: 3002, db: 'restaurant-service' }
  { name: 'order-service', port: 3003, db: 'order-service' }
  { name: 'delivery-service', port: 3004, db: 'delivery-service' }
]

resource containerApps 'Microsoft.App/containerApps@2023-05-01' = [for service in services: {
  name: service.name
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: service.port
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'mongodb-uri'
          value: '${cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString}&database=${service.db}'
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
        {
          name: 'rabbitmq-url'
          value: rabbitMqUrl
        }
      ]
    }
    template: {
      containers: [
        {
          name: service.name
          image: '${acr.properties.loginServer}/${service.name}:${imageTag}'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'PORT', value: string(service.port) }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'MONGODB_URI', secretRef: 'mongodb-uri' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'JWT_EXPIRATION', value: '3600s' }
            { name: 'RABBITMQ_URL', secretRef: 'rabbitmq-url' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: service.port
              }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: service.port
              }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}]

// ==================== Outputs ====================
output acrLoginServer string = acr.properties.loginServer
output containerAppUrls array = [for (service, i) in services: {
  name: service.name
  url: 'https://${containerApps[i].properties.configuration.ingress.fqdn}'
  swagger: 'https://${containerApps[i].properties.configuration.ingress.fqdn}/api'
  health: 'https://${containerApps[i].properties.configuration.ingress.fqdn}/health'
}]
output cosmosDbEndpoint string = cosmosAccount.properties.documentEndpoint
output logAnalyticsId string = logAnalytics.properties.customerId
