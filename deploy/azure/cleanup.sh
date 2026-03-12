#!/bin/bash
# ============================================================
# Cleanup Script - Delete ALL Azure Resources
# WARNING: This deletes everything! Use with caution.
# ============================================================

RESOURCE_GROUP="${RESOURCE_GROUP:-food-ordering-rg}"

echo "============================================"
echo "  ⚠️  CLEANUP - DELETE ALL RESOURCES"
echo "============================================"
echo "Resource Group: $RESOURCE_GROUP"
echo ""
echo "This will delete:"
echo "  - All Container Apps"
echo "  - Azure Container Registry"
echo "  - Cosmos DB (all data!)"
echo "  - Log Analytics Workspace"
echo "  - Container Apps Environment"
echo "  - Everything in the resource group"
echo ""
read -p "Are you sure? Type 'DELETE' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "Deleting resource group '$RESOURCE_GROUP'..."
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo ""
echo "✓ Deletion initiated (running in background)"
echo "  Check status: az group show --name $RESOURCE_GROUP"
echo "  Full deletion may take 5-10 minutes."
