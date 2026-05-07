#!/bin/bash

# Jenkins CI/CD Pipeline Setup Script
# This script helps configure Jenkins for CI/CD pipeline

set -e

echo "========================================"
echo "Jenkins CI/CD Pipeline Setup"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Linux or macOS
OS=$(uname -s)

echo -e "${YELLOW}Step 1: System Requirements Check${NC}"
echo "Operating System: $OS"
echo ""

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo -e "${YELLOW}Checking required tools...${NC}"

required_tools=("docker" "kubectl" "git" "mvn")
for tool in "${required_tools[@]}"; do
    if command_exists "$tool"; then
        echo -e "${GREEN}✓${NC} $tool is installed"
    else
        echo -e "${RED}✗${NC} $tool is NOT installed"
    fi
done
echo ""

echo -e "${YELLOW}Step 2: Docker Configuration${NC}"
echo "Verifying Docker daemon is running..."

if command_exists docker; then
    if docker ps > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Docker daemon is running"
        echo "Docker Version: $(docker --version)"
    else
        echo -e "${RED}✗${NC} Docker daemon is NOT running"
        echo "Please start Docker daemon"
    fi
else
    echo -e "${RED}✗${NC} Docker is not installed"
fi
echo ""

echo -e "${YELLOW}Step 3: Kubernetes Configuration${NC}"
echo "Verifying Kubernetes connectivity..."

if command_exists kubectl; then
    if kubectl cluster-info > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Kubernetes cluster is accessible"
        echo "Cluster Info:"
        kubectl cluster-info | head -2
        echo ""
        echo "Current Context:"
        kubectl config current-context
    else
        echo -e "${YELLOW}⚠${NC} Kubernetes cluster is NOT accessible"
        echo "Ensure kubeconfig is properly configured"
    fi
else
    echo -e "${RED}✗${NC} kubectl is not installed"
fi
echo ""

echo -e "${YELLOW}Step 4: GitHub Repository Setup${NC}"
echo "Required GitHub setup:"
echo "1. Create webhook pointing to Jenkins URL: http://your-jenkins:8080/github-webhook/"
echo "2. Add Jenkins SSH key to GitHub Deploy Keys"
echo "3. Create Personal Access Token for authentication"
echo ""

echo -e "${YELLOW}Step 5: Docker Hub Setup${NC}"
echo "Required Docker Hub credentials:"
echo "1. Username: your-docker-username"
echo "2. Password: your-docker-password"
echo "3. Configure these in Jenkins Credentials Manager"
echo ""

echo -e "${YELLOW}Step 6: Jenkins Credentials Configuration${NC}"
echo "Add these credentials in Jenkins:"
echo ""
echo "1. GitHub SSH Key"
echo "   - Kind: SSH Username with private key"
echo "   - ID: github-ssh-key"
echo ""
echo "2. Docker Hub"
echo "   - Kind: Username with password"
echo "   - ID: docker-hub-username and docker-hub-password"
echo ""
echo "3. Kubernetes Config"
echo "   - Kind: Secret file"
echo "   - ID: kubeconfig-credentials"
echo ""

echo -e "${YELLOW}Step 7: Jenkins Plugins Required${NC}"
echo "Install these plugins in Jenkins:"
echo "- Pipeline"
echo "- Git"
echo "- Docker"
echo "- Docker Pipeline"
echo "- Kubernetes"
echo "- Kubernetes CLI"
echo "- GitHub Integration"
echo "- Email Extension"
echo "- Slack Integration (optional)"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Instructions Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Create new Pipeline job in Jenkins"
echo "2. Point to this repository's Jenkinsfile"
echo "3. Configure GitHub webhook"
echo "4. Add credentials"
echo "5. Run first build"
echo ""
echo "Documentation: Check README.md for detailed instructions"
