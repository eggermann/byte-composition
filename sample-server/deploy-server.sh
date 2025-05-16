#!/bin/bash

# Enable error handling
set -e

# Functions
check_env() {
    if [ ! -f .env.production ]; then
        echo "Error: .env.production file not found"
        exit 1
    fi
    source .env.production

    local required_vars=("SSH_USER" "SSH_HOST" "SSH_PASSWORD" "REMOTE_SERVER_PATH" "DEPLOY_DIR" "PORT")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=($var)
        fi
    done

    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "Error: Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "- $var"
        done
        echo "Please check your .env.production file"
        exit 1
    fi

    # Validate PORT is a number
    if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
        echo "Error: PORT must be a number"
        exit 1
    fi
}

check_dependencies() {
    if ! command -v sshpass &> /dev/null; then
        echo "Error: sshpass is not installed. Please install it first:"
        echo "  macOS: brew install esolitos/ipa/sshpass"
        echo "  Linux: sudo apt-get install sshpass"
        exit 1
    fi
}

prepare_deployment() {
    echo "Preparing deployment directory... ${DEPLOY_DIR}"
    rm -rf "${DEPLOY_DIR}"
    mkdir -p "${DEPLOY_DIR}"
    
    echo "Copying source files..."
    rsync -av --progress \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='public/buffer' \
        --exclude='package-lock.json' \
        ./ "${DEPLOY_DIR}/"
}

deploy_to_remote() {
    echo "Deploying to remote server..."
    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "rm -rf $REMOTE_SERVER_PATH"
    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "mkdir -p $REMOTE_SERVER_PATH"

    echo "Copying files to remote server..."
    sshpass -p "$SSH_PASSWORD" rsync -avz --progress "${DEPLOY_DIR}/" "$SSH_USER@$SSH_HOST:$REMOTE_SERVER_PATH/"
}

build_on_remote() {
    echo "Building Next.js application on remote server..."
    # Get parent directory for DB_PATH
    local DB_DIR=$(dirname "$REMOTE_SERVER_PATH")

    # Stop the supervisor service if running
    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "
        if command -v supervisorctl &> /dev/null; then
            echo 'Stopping supervisor service...'
            supervisorctl stop sample-server || true
            sleep 2
            echo 'Service stopped'
        else
            echo 'Supervisor not found, continuing...'
        fi"

    # Copy .env.production to remote server
    echo "Copying .env.production to remote server..."
    sshpass -p "$SSH_PASSWORD" scp .env.production "$SSH_USER@$SSH_HOST:$REMOTE_SERVER_PATH/"

    # Build the application
    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "cd $REMOTE_SERVER_PATH && \
        rm -rf node_modules .next package-lock.json && \
        npm install --no-package-lock && \
        source .env.production && \
        NODE_ENV=production PORT=5673 npm run build"
}

setup_supervisor() {
    echo "Setting up supervisor service..."
    # Get parent directory for DB_PATH
    local DB_DIR=$(dirname "$REMOTE_SERVER_PATH")
    
    # Read variables from .env.production
    local env_vars=""
    while IFS='=' read -r key value; do
        if [[ ! -z "$key" && ! "$key" =~ ^# ]]; then
            env_vars="${env_vars},${key}=\"${value}\""
        fi
    done < .env.production
    env_vars=$(echo "$env_vars" | sed 's/^,//')

    local config="[program:sample-server]
directory=${REMOTE_SERVER_PATH}
command=/bin/bash -c 'cd ${REMOTE_SERVER_PATH} && source .env.production && export PORT=5673 && exec /opt/nodejs20/bin/npm start'
environment=NODE_ENV=production,DB_PATH=${DB_DIR}/samples.db
autostart=yes
autorestart=yes
startsecs=5
startretries=3
stdout_logfile=${REMOTE_SERVER_PATH}/app.log
stderr_logfile=${REMOTE_SERVER_PATH}/error.log
stopasgroup=true
killasgroup=true
stopsignal=SIGTERM"

    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "set -e && \
        mkdir -p $REMOTE_SERVER_PATH && \
        cd $REMOTE_SERVER_PATH && \
        mkdir -p ~/etc/services.d && \
        echo '$config' > ~/etc/services.d/sample-server.ini && \
        supervisorctl reread && \
        supervisorctl update && \
        sleep 5 && \
        supervisorctl start sample-server && \
        supervisorctl status sample-server && \
        tail -n 20 ${REMOTE_SERVER_PATH}/error.log || true"
}

verify_deployment() {
    echo "Verifying deployment..."
    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "
        echo 'Checking supervisor status...' && \
        supervisorctl status sample-server && \
        echo 'Checking if port is in use...' && \
        netstat -tlpn 2>/dev/null | grep ${PORT} || echo 'Port ${PORT} is not in use' && \
        echo 'Recent logs:' && \
        tail -n 20 ${REMOTE_SERVER_PATH}/error.log || true"
}

cleanup() {
    echo "Cleaning up..."
    rm -rf "${DEPLOY_DIR}"
}

# Main deployment process
main() {
    echo "Starting server deployment process..."
    
    check_env
    check_dependencies
    prepare_deployment
    deploy_to_remote
    build_on_remote
    setup_supervisor
    verify_deployment
    cleanup

    echo "Server deployment completed."
    echo "Your application should be available at: https://${SSH_USER}.uber.space:${PORT}"
    echo "Check the logs above for any startup issues"
    echo "Database will be stored at: ${DB_DIR}/samples.db"
}

# Allow running individual functions for testing
if [ "$1" ]; then
    $1
else
    main
fi
