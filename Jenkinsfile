pipeline {
    agent any
    tools {
        nodejs 'NodeJS 20' // Ensure Node.js 20 is installed in Jenkins
    }
    environment {
        APP_DIR = "/home/ubuntu/sim-2025-be"  // Update if your app directory is different
    }
    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'development', url: 'https://github.com/MedhaTech/Sim-BE-2025.git' // Update with your repo 
            }
        }
        stage('Verify Node.js') {
            steps {
                sh 'node -v'
                sh 'npm -v'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'cd $APP_DIR && sudo npm install --force' 
            }
        }
        stage('Build Application') {
            steps {
                sh 'cd $APP_DIR && sudo npm run build' 
            }
        }
        stage('Restart Application') {
            steps {
                sh 'cd $APP_DIR && pm2 restart all && pm2 save -f'
            }
        }
    }
}
