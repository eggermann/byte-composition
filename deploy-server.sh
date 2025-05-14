#!/bin/bash
set -e

# Load environment variables
if [ ! -f .env.production ]; then
    echo "Error: .env.production file not found"
    exit 1
fi

source .env.production

# Validate required environment variables
required_vars=("SSH_USER" "SSH_HOST" "SSH_PASSWORD" "REMOTE_SERVER_PATH")
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

# Build the server
echo "Building sample-server..."
cd sample-server
NODE_ENV=production npx next build

# Deploy using sshpass
echo "Deploying sample-server to production..."
cd ..
sshpass -p "$SSH_PASSWORD" rsync -avz --progress sample-server/ "$SSH_USER@$SSH_HOST:$REMOTE_SERVER_PATH/"

# Restart server using sshpass
echo "Restarting server..."
sshpass -p "$SSH_PASSWORD" ssh "$SSH_USER@$SSH_HOST" "cd $REMOTE_SERVER_PATH && pm2 restart sample-server"

echo "Server deployment completed successfully."