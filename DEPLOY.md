# Deployment Instructions

## Prerequisites

1. Access to tritton.uberspace.de server
2. PM2 installed globally on the server
3. `sshpass` installed for automated SSH password authentication:
   ```bash
   # On macOS
   brew install esolitos/ipa/sshpass

   # On Ubuntu/Debian
   sudo apt-get install sshpass
   ```
4. Proper `.env.production` configuration:
   ```bash
   # Server URLs
   SAMPLE_SERVER_URL=https://tritton.uberspace.de/works/api
   FRONTEND_BASE_URL=https://tritton.uberspace.de/works

   # API Keys (replace XXX with actual values)
   FREESOUND_API_KEY=XXX_PRODUCTION_FREESOUND_API_KEY_XXX

   # SSH Configuration
   SSH_HOST=tritton.uberspace.de
   SSH_USER=eggman2
   SSH_PASSWORD=XXX_YOUR_SSH_PASSWORD_XXX

   # Remote Paths
   REMOTE_SERVER_PATH=/home/eggman2/Projekte/sample-server
   REMOTE_FRONTEND_PATH=/var/www/virtual/eggman2/html/works
   ```

## Initial Setup

1. Create your .env.production file:
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your actual values
   # Replace all XXX placeholders with real values
   ```

2. Install dependencies:
   ```bash
   # Install Node.js dependencies
   npm install

   # Install sample-server dependencies
   cd sample-server && npm install
   ```

## Deployment

1. Deploy the sample-server:
   ```bash
   ./deploy-server.sh
   ```
   This will:
   - Build the Next.js application
   - Deploy files to REMOTE_SERVER_PATH
   - Restart the PM2 process

2. Deploy the frontend:
   ```bash
   ./deploy-frontend.sh
   ```
   This will:
   - Build the frontend with webpack
   - Deploy files to REMOTE_FRONTEND_PATH

The deployment scripts will validate your environment variables and check for required tools before proceeding.

## Security Note

The deployment scripts use `sshpass` for password authentication. While convenient for development, consider using SSH keys for production environments.

## Troubleshooting

1. Check script permissions:
   ```bash
   chmod +x deploy-frontend.sh deploy-server.sh
   ```

2. Verify sshpass installation:
   ```bash
   which sshpass
   ```

3. Test SSH connection:
   ```bash
   ssh $SSH_USER@$SSH_HOST "echo 'SSH connection successful'"
   ```

4. Check PM2 process status:
   ```bash
   ssh $SSH_USER@$SSH_HOST "pm2 status"
   ```

5. Common issues:
   - Missing environment variables: Check .env.production file
   - Permission denied: Verify SSH credentials
   - Build errors: Check webpack or Next.js build output
   - PM2 errors: Check PM2 logs on the server