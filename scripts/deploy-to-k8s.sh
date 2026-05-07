#!/bin/bash

# Kubernetes Deployment Script
# This script deploys the application to Kubernetes cluster

set -e

echo "========================================"
echo "Kubernetes Deployment Script"
echo "========================================"
echo ""

# Configuration
NAMESPACE="${1:-default}"
DEPLOYMENT_NAME="your-app-deployment"
SERVICE_NAME="your-app-service"
IMAGE_NAME="${2:-your-docker-username/your-app:latest}"

echo "Configuration:"
echo "- Namespace: $NAMESPACE"
echo "- Deployment: $DEPLOYMENT_NAME"
echo "- Service: $SERVICE_NAME"
echo "- Image: $IMAGE_NAME"
echo ""

# Check kubectl connectivity
echo "Checking Kubernetes connectivity..."
if kubectl cluster-info > /dev/null 2>&1; then
    echo "✓ Connected to Kubernetes cluster"
    echo "Current context: $(kubectl config current-context)"
else
    echo "✗ Failed to connect to Kubernetes cluster"
    exit 1
fi
echo ""

# Create namespace if it doesn't exist
echo "Creating namespace if not exists..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo "✓ Namespace ready"
echo ""

# Apply deployment
echo "Applying Kubernetes deployment..."
kubectl apply -f k8s-deployment.yaml -n "$NAMESPACE"
echo "✓ Deployment applied"
echo ""

# Apply service
echo "Applying Kubernetes service..."
kubectl apply -f k8s-service.yaml -n "$NAMESPACE"
echo "✓ Service applied"
echo ""

# Update image if provided
if [ ! -z "$IMAGE_NAME" ]; then
    echo "Updating deployment image..."
    kubectl set image deployment/$DEPLOYMENT_NAME \
        your-app=$IMAGE_NAME \
        -n "$NAMESPACE"
    echo "✓ Image updated"
    echo ""
fi

# Wait for rollout
echo "Waiting for rollout to complete..."
if kubectl rollout status deployment/$DEPLOYMENT_NAME -n "$NAMESPACE" --timeout=5m; then
    echo "✓ Deployment successful"
else
    echo "✗ Deployment failed or timed out"
    exit 1
fi
echo ""

# Display deployment status
echo "Deployment Status:"
echo ""
echo "Deployments:"
kubectl get deployments -n "$NAMESPACE"
echo ""
echo "Pods:"
kubectl get pods -n "$NAMESPACE" -o wide
echo ""
echo "Services:"
kubectl get svc -n "$NAMESPACE"
echo ""

# Show service endpoint
echo "Getting service endpoint..."
SERVICE_IP=$(kubectl get svc $SERVICE_NAME -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
if [ "$SERVICE_IP" != "pending" ]; then
    echo "Application is accessible at: http://$SERVICE_IP"
else
    echo "Service IP is pending. Check status with:"
    echo "kubectl get svc $SERVICE_NAME -n $NAMESPACE"
fi
echo ""

echo "========================================"
echo "Deployment Complete!"
echo "========================================"
