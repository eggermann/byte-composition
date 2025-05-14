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

build_local() {
    echo "Building Next.js application locally..."
    cd sample-server
    NODE_ENV=production npx next build
    cd ..
}

prepare_deployment() {
    echo "Preparing deployment directory..."
    rm -rf "${DEPLOY_DIR}"
    mkdir -p "${DEPLOY_DIR}"

    echo "Copying server files..."
    rsync -av --progress \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='public/buffer' \
        sample-server/ "${DEPLOY_DIR}/"
}

deploy_to_remote() {
    echo "Deploying to remote server..."
    echo "Creating remote directory..."
    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "mkdir -p $REMOTE_SERVER_PATH"

    echo "Copying files to remote server..."
    sshpass -p "$SSH_PASSWORD" rsync -avz --progress "${DEPLOY_DIR}/" "$SSH_USER@$SSH_HOST:$REMOTE_SERVER_PATH/"
}

setup_supervisor() {
    echo "Setting up supervisor service..."
    local service_name="sample-server"
    local service_path="~/etc/services.d"

    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" bash <<EOF
set -e
mkdir -p $REMOTE_SERVER_PATH
cd $REMOTE_SERVER_PATH
npm ci --production
mkdir -p $service_path
cat > $service_path/${service_name}.ini <<CONFIG
[program:${service_name}]
command=/opt/nodejs20/bin/npx next start -p ${PORT}
directory=${REMOTE_SERVER_PATH}
environment=NODE_ENV="production"
autostart=yes
autorestart=yes
startsecs=5
startretries=3
stdout_logfile=${REMOTE_SERVER_PATH}/app.log
stderr_logfile=${REMOTE_SERVER_PATH}/error.log
stopasgroup=true
killasgroup=true
CONFIG
pkill -f 'next start' || true
supervisorctl reread
supervisorctl update
sleep 5
supervisorctl status ${service_name}
tail -n 20 ${REMOTE_SERVER_PATH}/error.log || true
EOF
}

verify_deployment() {
    echo "Verifying deployment..."
    sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "
        echo 'Checking supervisor status...' && \
        supervisorctl status ${service_name}  && \
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
    build_local
    prepare_deployment
    deploy_to_remote
    setup_supervisor
    verify_deployment
    cleanup

    echo "Server deployment completed."
    echo "Your application should be available at: https://${SSH_USER}.uber.space:${PORT}"
    echo "Check the logs above for any startup issues"
}

# Allow running individual functions for testing
if [ "$1" ]; then
    $1
else
    main
fi