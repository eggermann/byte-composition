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