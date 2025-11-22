# FreeLens Extension Registry

Automated package registry for FreeLens extensions. This registry automatically scans GitHub for repositories starting with `freelens-ext-` and provides an HTTP API for manual registration.

## How It Works

### Automatic Scanning (GitHub Actions)
- Runs every 5 minutes via GitHub Actions cron job
- Searches for all repos named `freelens-ext-*`
- Fetches repo metadata and package.json
- Creates/updates JSON files in the `packages/` directory
- Generates an index at `packages/index.json`

### Manual Registration (Cloudflare Worker)
- HTTP endpoint for developers to register their extensions immediately
- Validates repo exists and follows naming convention
- Triggers the GitHub Actions workflow to update the registry

## Setup

### 1. GitHub Repository Setup

This repository needs to be pushed to GitHub with Actions enabled.

#### Required GitHub Secret:
- `GITHUB_TOKEN` - Already provided automatically by GitHub Actions

### 2. Cloudflare Worker Setup

The worker provides the HTTP API endpoint for manual registration.

#### Install Wrangler CLI:
```bash
npm install -g wrangler
```

#### Login to Cloudflare:
```bash
wrangler login
```

#### Configure the Worker:

1. Edit `worker/wrangler.toml` and set your registry repo:
```toml
[vars]
REGISTRY_REPO = "yourusername/package-repo"
```

2. Set required secrets:
```bash
cd worker

# GitHub token with repo access (to trigger workflows)
wrangler secret put GITHUB_TOKEN

# Optional: API key for authentication
wrangler secret put API_KEY
```

#### Deploy the Worker:
```bash
cd worker
npm install
npm run deploy
```

Your API will be available at: `https://freelens-registry-api.your-subdomain.workers.dev`

## API Endpoints

### Register an Extension

Manually register a FreeLens extension:

```bash
POST /register
Content-Type: application/json

{
  "repo": "owner/freelens-ext-example"
}
```

**With API Key (if configured):**
```bash
curl -X POST https://your-worker.workers.dev/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"repo": "owner/freelens-ext-example"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Extension owner/freelens-ext-example registered successfully. It will appear in the registry within a few minutes.",
  "repo": "owner/freelens-ext-example"
}
```

### Trigger Full Scan

Manually trigger a full registry scan:

```bash
POST /scan
Authorization: Bearer YOUR_API_KEY
```

**Example:**
```bash
curl -X POST https://your-worker.workers.dev/scan \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Health Check

```bash
GET /health
```

## Package Metadata Format

Each extension is stored as a JSON file in `packages/` with the following structure:

```json
{
  "name": "freelens-ext-example",
  "fullName": "owner/freelens-ext-example",
  "description": "Extension description",
  "homepage": "https://github.com/owner/freelens-ext-example",
  "stars": 10,
  "forks": 2,
  "language": "JavaScript",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T00:00:00Z",
  "pushedAt": "2024-01-15T12:00:00Z",
  "defaultBranch": "main",
  "topics": ["freelens", "extension"],
  "license": "MIT",
  "owner": {
    "login": "owner",
    "avatarUrl": "https://avatars.githubusercontent.com/u/...",
    "url": "https://github.com/owner"
  },
  "repository": {
    "url": "https://github.com/owner/freelens-ext-example",
    "cloneUrl": "https://github.com/owner/freelens-ext-example.git",
    "sshUrl": "git@github.com:owner/freelens-ext-example.git"
  },
  "packageJson": {
    "name": "freelens-ext-example",
    "version": "1.0.0",
    ...
  },
  "lastScanned": "2024-01-15T12:30:00Z"
}
```

## For Extension Developers

### Naming Convention
Your repository MUST start with `freelens-ext-` to be included in the registry.

Examples:
- ✅ `freelens-ext-kubernetes`
- ✅ `freelens-ext-metrics-dashboard`
- ❌ `my-freelens-extension` (won't be detected)

### Automatic Inclusion
Once you create a repo with the correct naming:
1. It will be automatically discovered within 5 minutes
2. Or register it immediately via the API endpoint

### Recommended package.json
Include these fields for better registry display:
```json
{
  "name": "freelens-ext-yourname",
  "version": "1.0.0",
  "description": "Clear description of what your extension does",
  "keywords": ["freelens", "extension", "kubernetes"],
  "homepage": "https://github.com/yourusername/freelens-ext-yourname",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/freelens-ext-yourname"
  },
  "license": "MIT"
}
```

## Development

### Test the Scanner Locally
```bash
export GITHUB_TOKEN=your_github_token
node scripts/scan-github.js
```

### Test the Worker Locally
```bash
cd worker
npm install
npm run dev
```

Then test with:
```bash
curl -X POST http://localhost:8787/register \
  -H "Content-Type: application/json" \
  -d '{"repo": "owner/freelens-ext-test"}'
```

## Costs

- **GitHub Actions**: Free (2,000 minutes/month for public repos)
- **Cloudflare Workers**: Free tier (100,000 requests/day)

Total cost: $0/month for typical usage

## License

MIT
