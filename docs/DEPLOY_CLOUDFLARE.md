# Deploying MM to Cloudflare

MM uses a split deployment strategy:
- **Frontend**: Cloudflare Pages (Next.js static export)
- **Backend API**: VPS or dedicated GPU server (FastAPI needs GPU for ML models)
- **Email**: Cloudflare Email Routing (free custom domain email)

## Why this split?

The ML models (MusicGen, XTTS, Demucs) require GPU. Cloudflare Workers/Pages don't have GPU access. So:
- Frontend (Next.js) → Cloudflare Pages (fast, global CDN, free)
- Backend (FastAPI + ML) → GPU VPS (e.g., Lambda Labs, RunPod, or your own machine)

## Step 1: Get a domain

```bash
# If you already have a domain on Cloudflare, skip this
# Otherwise, register one at cloudflare.com or transfer an existing domain
```

## Step 2: Set up Cloudflare Email Routing (free)

1. Go to Cloudflare Dashboard → Your Domain → Email → Email Routing
2. Enable Email Routing
3. Add a catch-all route or specific addresses:
   - `hello@yourdomain.com` → forwards to your Gmail/personal email
   - `support@yourdomain.com` → forwards to your Gmail/personal email
4. Cloudflare adds the necessary MX and TXT records automatically

This gives you free custom domain email without any mail server.

## Step 3: Deploy Frontend to Cloudflare Pages

### Option A: Connect GitHub repo (recommended)

1. Go to Cloudflare Dashboard → Workers & Pages → Create
2. Connect your GitHub account
3. Select the `MM` repository
4. Configure build:
   - **Framework preset**: Next.js
   - **Build command**: `cd frontend && npm run build`
   - **Build output directory**: `frontend/.next`
   - **Root directory**: `/`
   - **Environment variables**:
     - `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com` (your GPU server)

### Option B: Manual deploy via Wrangler

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Build frontend
cd frontend
npm run build

# Deploy
npx @cloudflare/next-on-pages
wrangler pages deploy .vercel/output/static --project-name=mm-music-maker
```

## Step 4: Set up API server (GPU)

The backend needs to run on a machine with GPU. Options:

### Option A: Your local machine (development)
```bash
# Already running locally
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Option B: GPU VPS
```bash
# Lambda Labs, RunPod, Vast.ai, etc.
# SSH in, clone repo, run docker-compose
git clone https://github.com/clarencestephen/MM.git
cd MM
docker-compose up -d
```

### Configure Cloudflare DNS
Add an A record pointing `api.yourdomain.com` to your server's IP.

### Cloudflare Tunnel (recommended for security)
Instead of exposing your server directly:

```bash
# Install cloudflared on your GPU server
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create mm-api

# Configure
cat > ~/.cloudflared/config.yml << EOF
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
EOF

# Route DNS
cloudflared tunnel route dns mm-api api.yourdomain.com

# Run
cloudflared tunnel run mm-api
```

## Step 5: Configure CORS

Update `.env` on your API server:
```
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Step 6: SSL/TLS

Cloudflare handles SSL automatically for both:
- Frontend (Pages) → automatic HTTPS
- API (via Tunnel) → automatic HTTPS

## Architecture Summary

```
User → Cloudflare CDN → Pages (Next.js frontend)
                      → Tunnel → GPU Server (FastAPI backend)
                      → Email Routing → Gmail
```

Everything is encrypted. No ports exposed. Free email. Global CDN.
