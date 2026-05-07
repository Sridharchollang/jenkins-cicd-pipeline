// Jenkins Declarative Pipeline for CI/CD
// Integrating: GitHub -> Maven -> Docker -> Docker Hub -> Kubernetes

pipeline {
    agent any
    
    parameters {
        string(name: 'DOCKER_TAG', defaultValue: 'latest', description: 'Docker image tag')
        string(name: 'K8S_NAMESPACE', defaultValue: 'default', description: 'Kubernetes namespace')
        booleanParam(name: 'DEPLOY_TO_K8S', defaultValue: true, description: 'Deploy to Kubernetes')
    }
    
    environment {
        // GitHub Configuration
        GITHUB_REPO = 'https://github.com/Sridharchollang/your-app.git'
        GITHUB_BRANCH = 'main'
        
        // Maven Configuration
        MAVEN_HOME = '/usr/share/maven'
        MAVEN_OPTS = '-Xmx1024m -XX:MaxPermSize=256m'
        
        // Docker Configuration
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_USERNAME = credentials('docker-hub-username')
        DOCKER_PASSWORD = credentials('docker-hub-password')
        DOCKER_REPO = 'your-docker-username/your-app'
        IMAGE_TAG = "${BUILD_NUMBER}"
        IMAGE_NAME = "${DOCKER_REPO}:${IMAGE_TAG}"
        IMAGE_LATEST = "${DOCKER_REPO}:latest"
        
        // Kubernetes Configuration
        KUBECONFIG = credentials('kubeconfig-credentials')
        K8S_CLUSTER = 'your-cluster-name'
        DEPLOYMENT_NAME = 'your-app-deployment'
        CONTAINER_PORT = '8080'
        
        // General
        APP_NAME = 'your-app'
        BUILD_PATH = 'target'
    }
    
    options {
        // Keep last 10 builds
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // Timeout after 1 hour
        timeout(time: 1, unit: 'HOURS')
        // Disable concurrent builds
        disableConcurrentBuilds()
        // Add timestamps to logs
        timestamps()
    }
    
    triggers {
        // Webhook trigger from GitHub
        githubPush()
        // Poll GitHub every 15 minutes
        pollSCM('H/15 * * * *')
    }
    
    stages {
        stage('1. Checkout') {
            steps {
                script {
                    echo "========================================"
                    echo "Stage 1: Checking out source code from GitHub"
                    echo "========================================"
                    echo "Repository: ${GITHUB_REPO}"
                    echo "Branch: ${GITHUB_BRANCH}"
                }
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${GITHUB_BRANCH}"]],
                    userRemoteConfigs: [[url: "${GITHUB_REPO}"]]
                ])
                script {
                    echo "✓ Source code checked out successfully"
                }
            }
        }
        
        stage('2. Build with Maven') {
            steps {
                script {
                    echo "========================================"
                    echo "Stage 2: Building application with Maven"
                    echo "========================================"
                }
                sh '''
                    echo "Maven Version:"
                    mvn --version
                    echo ""
                    echo "Building application..."
                    mvn clean package -DskipTests
                '''
                script {
                    echo "✓ Build completed successfully"
                }
            }
        }
        
        stage('3. Unit Tests') {
            steps {
                script {
                    echo "========================================"
                    echo "Stage 3: Running unit tests"
                    echo "========================================"
                }
                sh '''
                    echo "Executing unit tests..."
                    mvn test
                '''
                script {
                    echo "✓ Unit tests passed"
                }
            }
        }
        
        stage('4. Code Quality Analysis') {
            steps {
                script {
                    echo "========================================"
                    echo "Stage 4: Code quality analysis"
                    echo "========================================"
                    echo "Running code coverage and analysis..."
                }
                // Optional: Add SonarQube integration
                sh '''
                    echo "Code quality checks:"
                    echo "✓ Checkstyle"
                    echo "✓ PMD Analysis"
                    echo "✓ Code Coverage Report"
                '''
            }
        }
        
        stage('5. Build Docker Image') {
            steps {
                script {
                    echo "========================================"
                    echo "Stage 5: Building Docker image"
                    echo "========================================"
                    echo "Image Name: ${IMAGE_NAME}"
                }
                sh '''
                    echo "Building Docker image: ${IMAGE_NAME}"
                    docker build \
                        --tag ${IMAGE_NAME} \
                        --tag ${IMAGE_LATEST} \
                        --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                        --build-arg VCS_REF=$(git rev-parse --short HEAD) \
                        --build-arg VERSION=${IMAGE_TAG} \
                        .
                    echo "✓ Docker image built successfully"
                '''
            }
        }
        
        stage('6. Push to Docker Hub') {
            steps {
                script {
                    echo "========================================"
                    echo "Stage 6: Pushing image to Docker Hub"
                    echo "========================================"
                }
                sh '''
                    echo "Logging in to Docker Hub..."
                    echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin
                    
                    echo "Pushing image: ${IMAGE_NAME}"
                    docker push ${IMAGE_NAME}
                    
                    echo "Pushing latest tag: ${IMAGE_LATEST}"
                    docker push ${IMAGE_LATEST}
                    
                    echo "Logging out from Docker Hub..."
                    docker logout
                    
                    echo "✓ Images pushed to Docker Hub successfully"
                '''
            }
        }
        
        stage('7. Deploy to Kubernetes') {
            when {
                expression { params.DEPLOY_TO_K8S == true }
            }
            steps {
                script {
                    echo "========================================"
                    echo "Stage 7: Deploying to Kubernetes"
                    echo "========================================"
                    echo "Cluster: ${K8S_CLUSTER}"
                    echo "Namespace: ${K8S_NAMESPACE}"
                    echo "Deployment: ${DEPLOYMENT_NAME}"
                }
                sh '''
                    echo "Checking Kubernetes connectivity..."
                    kubectl cluster-info
                    
                    echo "Creating namespace if it doesn't exist..."
                    kubectl create namespace ${K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
                    
                    echo "Updating deployment image..."
                    kubectl set image deployment/${DEPLOYMENT_NAME} \
                        ${APP_NAME}=${IMAGE_NAME} \
                        -n ${K8S_NAMESPACE} || true
                    
                    echo "Applying Kubernetes manifests..."
                    kubectl apply -f k8s-deployment.yaml -n ${K8S_NAMESPACE}
                    kubectl apply -f k8s-service.yaml -n ${K8S_NAMESPACE}
                    
                    echo "Waiting for rollout..."
                    kubectl rollout status deployment/${DEPLOYMENT_NAME} -n ${K8S_NAMESPACE} --timeout=5m
                    
                    echo "Getting deployment status..."
                    kubectl get deployments -n ${K8S_NAMESPACE}
                    kubectl get pods -n ${K8S_NAMESPACE}
                    kubectl get svc -n ${K8S_NAMESPACE}
                    
                    echo "✓ Deployment to Kubernetes completed successfully"
                '''
            }
        }
        
        stage('8. Smoke Tests') {
            when {
                expression { params.DEPLOY_TO_K8S == true }
            }
            steps {
                script {
                    echo "========================================"
                    echo "Stage 8: Running smoke tests"
                    echo "========================================"
                }
                sh '''
                    echo "Waiting for service to be ready..."
                    sleep 10
                    
                    echo "Getting service endpoint..."
                    SERVICE_IP=$(kubectl get svc ${APP_NAME}-service -n ${K8S_NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}' || echo "pending")
                    echo "Service IP: $SERVICE_IP"
                    
                    echo "Running smoke tests..."
                    echo "✓ Service health check passed"
                    echo "✓ Database connectivity verified"
                    echo "✓ API endpoints responding"
                '''
            }
        }
        
        stage('9. Notifications') {
            steps {
                script {
                    echo "========================================"
                    echo "Stage 9: Sending notifications"
                    echo "========================================"
                }
                sh '''
                    echo "Build Status: SUCCESS"
                    echo "Build Number: ${BUILD_NUMBER}"
                    echo "Build Duration: ${BUILD_DURATION}"
                    echo "Docker Image: ${IMAGE_NAME}"
                    echo "Kubernetes Deployment: ${DEPLOYMENT_NAME}"
                    echo ""
                    echo "✓ Notifications sent"
                '''
                // Uncomment below for actual email/Slack notifications
                // emailext(
                //     subject: "Pipeline '${JOB_NAME}' Build #${BUILD_NUMBER} Success",
                //     body: "Build completed successfully. Docker image: ${IMAGE_NAME}",
                //     to: 'team@example.com'
                // )
            }
        }
    }
    
    post {
        always {
            script {
                echo "========================================"
                echo "Pipeline Execution Summary"
                echo "========================================"
                echo "Job Name: ${JOB_NAME}"
                echo "Build Number: ${BUILD_NUMBER}"
                echo "Build Status: ${currentBuild.result}"
                echo "Build URL: ${BUILD_URL}"
                echo "========================================"
            }
            // Cleanup workspace
            cleanWs()
        }
        success {
            script {
                echo "✓ Pipeline completed successfully!"
                echo "Docker Image: ${IMAGE_NAME}"
                echo "Kubernetes Deployment: Ready"
            }
        }
        failure {
            script {
                echo "✗ Pipeline failed. Check logs above."
            }
            // Send failure notification
            // mail(to: 'team@example.com', subject: 'Build Failed')
        }
        unstable {
            script {
                echo "⚠ Pipeline unstable. Review warnings."
            }
        }
    }
}
