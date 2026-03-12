// ============================================================
// Bicep Parameters File
// Copy to main.parameters.json and fill in values
// ============================================================
using './main.bicep'

param location = 'southeastasia'
param acrName = 'foodorderingacr'
param cosmosDbAccountName = 'food-ordering-cosmos'
param environmentName = 'food-ordering-env'
param logAnalyticsName = 'food-ordering-logs'
param jwtSecret = 'REPLACE_WITH_STRONG_SECRET'
param rabbitMqUrl = 'amqps://REPLACE_WITH_CLOUDAMQP_URL'
param imageTag = 'latest'
