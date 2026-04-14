# Neha - Deployment Guide

## Local Development Setup

### Prerequisites
- Node.js 20+ (for Next.js frontend)
- Python 3.11+ (for FastAPI backend)
- `uv` (Python package manager — faster than pip)

### 1. Clone & Install Frontend

```bash
cd nehahr
npm install
```

### 2. Set Up Backend

```bash
cd backend
uv init
uv add fastapi uvicorn[standard] python-dotenv pydantic-settings \
    anthropic langgraph langchain-anthropic \
    twilio deepgram-sdk elevenlabs \
    sendgrid google-api-python-client google-auth-oauthlib \
    supabase redis[hiredis] \
    sqlalchemy alembic asyncpg \
    websockets python-multipart
```

### 3. Set Up External Services

| Service | Action | Free Tier |
|---------|--------|-----------|
| **Supabase** | Create project at supabase.com | 500MB DB, 2 projects |
| **Upstash** | Create Redis DB at upstash.com | 10k commands/day |
| **Twilio** | Create account, buy phone number (~$1.15/mo) | $15 trial credits |
| **Deepgram** | Sign up at deepgram.com | $200 free credits |
| **ElevenLabs** | Sign up at elevenlabs.io | 10k chars/month |
| **Anthropic** | Get API key at console.anthropic.com | Pay-as-you-go |
| **SendGrid** | Sign up at sendgrid.com | 100 emails/day forever |
| **Google Cloud** | Enable Calendar API, create OAuth credentials | Free |

### 4. Configure Environment

```bash
cp .env.example .env
# Fill in all values from the services above
```

### 5. Run Database Migrations

```bash
cd backend
alembic upgrade head
```

### 6. Start Development Servers

```bash
# Terminal 1: Frontend
npm run dev         # http://localhost:3000

# Terminal 2: Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Expose backend for Twilio webhooks (development only)
npx localtunnel --port 8000 --subdomain neha-dev
# OR
ngrok http 8000
```

> **Important:** Twilio needs a public URL for webhooks. Use localtunnel or ngrok during development. Update `BACKEND_URL` in `.env` with the tunnel URL.

---

## Production Deployment

### Frontend → Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL
```

### Backend → Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and init
railway login
railway init

# Deploy
railway up

# Set environment variables in Railway dashboard
# Configure custom domain for stable webhook URLs
```

**Alternative: Fly.io**

```bash
fly launch
fly deploy
fly secrets set ANTHROPIC_API_KEY=sk-ant-xxx ...
```

### Twilio Webhook Configuration (Production)

After deploying backend, update Twilio webhook URLs:
1. Go to Twilio Console → Phone Numbers → Your Number
2. Set Voice webhook: `https://your-backend.railway.app/api/webhooks/twilio/voice`
3. Set Status callback: `https://your-backend.railway.app/api/webhooks/twilio/status`

---

## Architecture Notes

- **WebSocket support required** for the backend host (Railway and Fly.io both support this)
- **Sticky sessions** not needed — call state is in Redis, not in-memory
- **Auto-scaling** — each call uses ~1 WebSocket connection, plan capacity accordingly
- **CORS** — configure FastAPI to allow requests from your Vercel domain
