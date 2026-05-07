# Jenkins CI/CD Pipeline - Complete Guide

## Overview
This repository contains a comprehensive Jenkins CI/CD pipeline integrated with:
- **GitHub** - Source Code Management
- **Maven** - Build Tool
- **Docker Hub** - Container Registry
- **Kubernetes** - Orchestration Platform

## Architecture Diagram
```
┌──────────────────┐
│   GitHub    │ (Source Code Repository)
└──────────┬───────┘
       │ (Webhook Trigger)
       ▼
┌──────────────────────────────────────┐
│  Jenkins Master     │
│  ┌─────────────────────────────┐  │
│  │ 1. Build      │  │
│  │ 2. Test       │  │
│  │ 3. Package    │  │
│  └─────────────────────────────┘  │
└──────────────┬──────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│     Maven        │ (Build & Package)
│  - Unit Tests    │
│  - Code Quality  │
└──────────────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Docker Build    │ (Create Container Image)
│  - Dockerfile    │
│  - Tag Image     │
└──────────────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│   Docker Hub     │ (Push Image to Registry)
│  - Store Image   │
│  - Version Tag   │
└──────────────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Kubernetes      │ (Deploy)
│  - Pull Image    │
│  - Create Pods   │
│  - Run Service   │
└──────────────────────────────────┘
```

## Pipeline Stages

### 1. **Source Code Checkout** (GitHub)
- Clone repository from GitHub
- Checkout specific branch
- Verify code integrity

### 2. **Build** (Maven)
- Download dependencies
- Compile source code
- Run unit tests
- Generate build artifacts

### 3. **Test & Quality**
- Execute unit tests
- Code coverage analysis
- SonarQube integration (optional)

### 4. **Artifact Creation**
- Create WAR/JAR file
- Archive build artifacts

### 5. **Docker Image Build**
- Build Docker image from Dockerfile
- Tag image with version
- Optimize image size

### 6. **Push to Docker Hub**
- Login to Docker Hub registry
- Push image with tags (latest, version)
- Verify image availability

### 7. **Deploy to Kubernetes**
- Update deployment manifests
- Apply Kubernetes configs
- Scale replicas
- Verify deployment status

### 8. **Post-Deployment**
- Run smoke tests
- Verify service availability
- Send notifications

## Key Features

✅ Fully automated pipeline
✅ Continuous Integration from GitHub
✅ Containerized application with Docker
✅ Orchestrated deployment on Kubernetes
✅ Version management and tagging
✅ Rollback capabilities
✅ Monitoring and notifications

## Prerequisites
- Jenkins Server (2.300+)
- GitHub repository with webhook access
- Maven 3.6+
- Docker installed on Jenkins agents
- Docker Hub account
- Kubernetes cluster (1.20+)
- kubectl configured
- Docker registry credentials

## Files in This Repository
1. `Jenkinsfile` - Main pipeline definition
2. `Dockerfile` - Container image definition
3. `pom.xml` - Maven configuration
4. `k8s-deployment.yaml` - Kubernetes deployment manifest
5. `k8s-service.yaml` - Kubernetes service manifest
6. `scripts/` - Helper scripts
7. `Jenkins_CICD_Pipeline_Presentation.md` - Presentation slides

## Quick Start
1. Create GitHub webhook pointing to Jenkins
2. Configure Jenkins credentials
3. Create new Jenkins pipeline job
4. Point to repository Jenkinsfile
5. Trigger pipeline

## Security Best Practices
- Store credentials in Jenkins Credentials Store
- Use environment variables for sensitive data
- Implement branch protection rules
- Use RBAC in Kubernetes
- Scan Docker images for vulnerabilities
- Implement image signing

## Troubleshooting
- Check Jenkins logs for errors
- Verify GitHub webhook connectivity
- Validate Docker Hub credentials
- Check Kubernetes cluster health
- Review pipeline execution logs

---
**Created: 2026-05-07**
**For Presentation: 2026-05-08**
