#!/bin/bash
set -e

# Load environment variables
if [ ! -f .env.production ]; then
    echo "Error: .env.production file not found"
    exit 1
fi

source .env.production

# Validate required environment variables
required_vars=("SSH_USER" "SSH_HOST" "SSH_PASSWORD" "REMOTE_FRONTEND_PATH" "DEPLOY_DIR")
missing_vars=()

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

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed. Please install it first:"
    echo "  macOS: brew install esolitos/ipa/sshpass"
    echo "  Linux: sudo apt-get install sshpass"
    exit 1
fi

echo "Starting frontend deployment process..."

# Build the frontend using webpack
echo "Building frontend..."
NODE_ENV=production npx webpack --config webpack.config.js --mode production

# Deploy using sshpass directly
echo "Deploying frontend build as ${DEPLOY_DIR}..."

# Create temporary directory with desired name
rm -rf "${DEPLOY_DIR}"
mv dist "${DEPLOY_DIR}"

# Deploy with rsync
sshpass -p "$SSH_PASSWORD" rsync -avz --progress "${DEPLOY_DIR}/" "$SSH_USER@$SSH_HOST:$REMOTE_FRONTEND_PATH/"

# Clean up
rm -rf "${DEPLOY_DIR}"

echo "Frontend deployment completed successfully."