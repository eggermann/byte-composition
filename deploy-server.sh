#!/bin/bash
set -e

# Load environment variables
if [ ! -f .env.production ]; then
    echo "Error: .env.production file not found"
    exit 1
fi

source .env.production

# Validate required environment variables
required_vars=("SSH_USER" "SSH_HOST" "SSH_PASSWORD" "REMOTE_SERVER_PATH" "DEPLOY_DIR")
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

echo "Starting server deployment process..."

# Build the server locally
echo "Building sample-server..."
cd sample-server
NODE_ENV=production npx next build

# Create a temporary deployment directory
cd ..
rm -rf "${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}"

# Copy server files excluding development/unnecessary files
echo "Copying server files..."
rsync -av --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='public/buffer' \
  sample-server/ "${DEPLOY_DIR}/"

# Deploy using sshpass
echo "Deploying server as ${DEPLOY_DIR}..."

# Remove existing deployment directory on remote server
echo "Removing existing deployment directory on remote server..."
sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "rm -rf $REMOTE_SERVER_PATH"

# Deploy new version
sshpass -p "$SSH_PASSWORD" rsync -avz --progress "${DEPLOY_DIR}/" "$SSH_USER@$SSH_HOST:$REMOTE_SERVER_PATH/"

# Set up Node.js server on remote
echo "Setting up Node.js server on remote..."
sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "cd $REMOTE_SERVER_PATH && \
    npm ci --production && \
    npm run build && \
    pm2 delete $(basename ${DEPLOY_DIR}) || true && \
    PORT=3000 pm2 start npm --name $(basename ${DEPLOY_DIR}) -- start"

# Clean up local deployment directory
rm -rf "${DEPLOY_DIR}"

echo "Server deployment completed successfully."