# Sample Server

A Next.js server that manages audio samples with flat-db storage, featuring endpoints to list all samples and fetch random samples from Freesound.org with a local buffer fallback.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
- Copy `.env` and add your Freesound API key:
```
FREESOUND_API_KEY=your_api_key_here
```

3. Start the development server:
```bash
npm run dev
```

## API Endpoints

### GET /api/samples
Lists all samples stored in the flat-db database.

**Response:**
```json
{
  "count": 1,
  "results": [
    {
      "id": "123456",
      "path": "/buffer/123456.mp3",
      "downloaded": "2025-05-13T20:08:55.000Z"
    }
  ]
}
```

### GET /api/random
Fetches a random sample from Freesound.org and saves it to the buffer. If fetching fails, returns a random sample from the buffer.

**Response:**
```json
{
  "id": "123456",
  "path": "/buffer/123456.mp3",
  "source": "freesound" // or "buffer" if falling back to cached sample
}
```

## Storage

- Samples are stored in the `buffer/` directory
- Sample metadata is stored in `samples.db` using flat-file-db
- The buffer serves as a fallback when Freesound API requests fail

## Error Handling

- All errors are logged to the console
- If fetching from Freesound fails, the system falls back to serving a random sample from the buffer
- If both API fetch and buffer fallback fail, returns a 500 error

## Project Structure

```
sample-server/
├── buffer/              # Downloaded sample storage
├── pages/
│   └── api/
│       ├── random.js    # Random sample endpoint
│       └── samples.js   # Sample listing endpoint
├── .env                # Environment configuration
├── next.config.js      # Next.js configuration
├── package.json        # Project dependencies
└── samples.db          # Flat-file database for sample metadata
## Deployment

The `deploy-server.sh` script automates the deployment of the server to a remote host. Below is a detailed guide on its purpose, prerequisites, and usage.

### Purpose

The script performs the following tasks:
1. Validates the environment configuration and required dependencies.
2. Prepares the deployment directory by copying necessary files.
3. Transfers the files to the remote server.
4. Builds the application on the remote server.
5. Configures and starts the server using Supervisor.
6. Verifies the deployment and cleans up temporary files.

### Prerequisites

Before running the script, ensure the following:
1. **Environment Configuration**: A `.env.production` file must exist in the root directory with the following variables:
   - `SSH_USER`: SSH username for the remote server.
   - `SSH_HOST`: Hostname or IP address of the remote server.
   - `SSH_PASSWORD`: Password for SSH authentication.
   - `REMOTE_SERVER_PATH`: Path on the remote server where the application will be deployed.
   - `DEPLOY_DIR`: Local directory used for preparing deployment files.
   - `PORT`: Port number for the server.

2. **Dependencies**: The `sshpass` utility must be installed on your system:
   - macOS: `brew install esolitos/ipa/sshpass`
   - Linux: `sudo apt-get install sshpass`

### Instructions

Follow these steps to deploy the server:

1. Open a terminal and navigate to the `sample-server` directory:
   ```bash
   cd sample-server
   ```

2. Ensure the `.env.production` file is correctly configured with all required variables.

3. Make the script executable (if not already):
   ```bash
   chmod +x deploy-server.sh
   ```

4. Run the deployment script:
   ```bash
   ./deploy-server.sh
   ```

5. Monitor the output for any errors or warnings. Upon successful deployment, the application will be available at:
   ```
   https://<SSH_USER>.uber.space:<PORT>
   ```

6. Check the logs for any startup issues or errors:
   ```bash
   tail -n 20 <REMOTE_SERVER_PATH>/error.log
   ```