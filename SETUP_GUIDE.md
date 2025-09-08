# Snoball Modern PaaS Setup Guide

This guide walks you through setting up the Snoball trading platform using modern Platform-as-a-Service (PaaS) providers for simplified deployment and management.

## Prerequisites

- GitHub account for code repository
- PlanetScale account (Postgres database)
- Render account (backend hosting)
- Vercel account (frontend hosting)
- Alpaca Markets account (trading API)
- WorkOS account (authentication)
- Node.js 18+ with Bun runtime
- Docker (for local development)

## Environment Setup

1. Copy the example environment file:
```bash
cp .env.local.example .env.local
```

2. Fill in the values as you complete each service setup below.

---

## 1. PlanetScale Postgres Setup

PlanetScale provides a managed Postgres database with branching, automatic scaling, and connection pooling.

### Steps:

1. **Create PlanetScale Account**
   - Go to [PlanetScale](https://planetscale.com)
   - Sign up for a free account

2. **Create Database**
   ```bash
   # Install PlanetScale CLI
   brew install planetscale/tap/pscale
   
   # Login to PlanetScale
   pscale auth login
   
   # Create database with cluster size
   # PS-10 = Hobby plan (free), PS-20 = Scaler plan ($29/month)
   pscale database create snoball-prod --cluster-size PS-10
   
   # Create development branch
   pscale branch create snoball-prod dev
   ```

3. **Get Connection Strings**
   ```bash
   # Get connection string for main branch (production)
   pscale connect snoball-prod main --format=connection-string
   
   # Get connection string for dev branch
   pscale connect snoball-prod dev --format=connection-string
   ```

4. **Configure Environment Variables**
   
   **Method 1: Atomic Variables (Recommended)**
   ```bash
   DATABASE_HOST=aws-us-east-1-portal.23.psdb.cloud
   DATABASE_PORT=5432
   DATABASE_NAME=snoball-prod
   DATABASE_USERNAME=your_username
   DATABASE_PASSWORD=your_password
   DATABASE_SSL=require
   DATABASE_POOLING_PORT=6432
   ```
   
   **Method 2: Full URLs (Alternative)**
   ```bash
   DATABASE_URL=postgresql://username:password@aws-us-east-1-portal.23.psdb.cloud:5432/snoball-prod?sslmode=require
   DATABASE_URL_POOLED=postgresql://username:password@aws-us-east-1-portal.23.psdb.cloud:6432/snoball-prod?sslmode=require
   ```

### Important Notes:
- Port 5432: Direct connections for persistent services
- Port 6432: PgBouncer connection pooling for serverless functions
- SSL is required for all connections (`sslmode=require`)
- Automatic backups and point-in-time recovery included

---

## 2. Alpaca Markets Trading API

Alpaca provides commission-free trading APIs for stocks and crypto.

### Steps:

1. **Create Alpaca Account**
   - Go to [Alpaca Markets](https://alpaca.markets)
   - Sign up for a free account

2. **Get Paper Trading API Keys** (for testing)
   - Log into [Alpaca Dashboard](https://app.alpaca.markets)
   - Select "Paper Trading" environment
   - Go to "API Keys" section
   - Generate new API keys if needed
   
   Add to `.env.local`:
   - `ALPACA_API_KEY`: Your API Key ID
   - `ALPACA_SECRET_KEY`: Your Secret Key
   - `ALPACA_ENDPOINT`: `https://paper-api.alpaca.markets`

3. **For Live Trading** (optional, requires approval)
   - Complete identity verification
   - Fund your account
   - Switch to "Live Trading" environment
   - Generate production API keys
   - Update `ALPACA_ENDPOINT`: `https://api.alpaca.markets`

### Important Notes:
- Paper trading uses virtual money for testing
- Live trading requires real funds and regulatory compliance
- API rate limits: 200 requests/minute for most endpoints
- WebSocket connections available for real-time data

---

## 3. WorkOS Authentication Setup

WorkOS provides enterprise-grade authentication with SSO support.

### Steps:

1. **Create WorkOS Account**
   - Go to [WorkOS](https://workos.com)
   - Sign up for a free account

2. **Create New Project**
   - In WorkOS dashboard, create a new project
   - Name it "Snoball Trading Platform"

3. **Configure Authentication**
   - Enable "AuthKit" for authentication
   - Set redirect URI: `http://localhost:3000/api/auth/callback/workos` (dev)
   - For production, add: `https://your-app.vercel.app/api/auth/callback/workos`

4. **Get API Keys**
   - Copy API Key → `WORKOS_API_KEY`
   - Copy Client ID → `WORKOS_CLIENT_ID`
   - Generate webhook secret → `WORKOS_WEBHOOK_SECRET`

5. **NextAuth Configuration**
   - Generate secret: `openssl rand -base64 32` → `NEXTAUTH_SECRET`
   - Set URL: `NEXTAUTH_URL=http://localhost:3000` (dev)

---

## 4. Local Development Setup

### Using Docker Compose

1. **Start Local Services**
   ```bash
   # Start PostgreSQL and Redis locally
   docker-compose up -d
   
   # This starts:
   # - PostgreSQL 15.4 on port 5432
   # - Redis 7-alpine on port 6379
   # - pgAdmin on port 8080 (optional)
   ```

2. **Install Dependencies**
   ```bash
   # Install all workspace dependencies
   bun install
   ```

3. **Run Database Migrations**
   ```bash
   # Run migrations against local database
   bun run db:migrate
   ```

4. **Start Development Servers**
   ```bash
   # Start all services in development mode
   bun run dev
   
   # Or start individual services:
   bun run dev:web        # Frontend on port 3000
   bun run dev:server     # Trade server on port 9090
   ```

### Local Environment Variables

```bash
# Database Configuration (Atomic Variables)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=snoball_dev
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=local-dev-password
DATABASE_SSL=false
DATABASE_POOLING_PORT=6432

# Redis (Local Docker) 
REDIS_URL=redis://default:local-dev-password@localhost:6379

# Trading API (Paper trading)
ALPACA_API_KEY=your_paper_trading_key
ALPACA_SECRET_KEY=your_paper_trading_secret
ALPACA_ENDPOINT=https://paper-api.alpaca.markets

# Authentication
WORKOS_API_KEY=your_workos_api_key
WORKOS_CLIENT_ID=your_workos_client_id
WORKOS_WEBHOOK_SECRET=your_workos_webhook_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Application
NODE_ENV=development
ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:9090

# Security
ENCRYPTION_KEY=your_32_character_encryption_key

# AI (Optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## 5. Production Deployment

### Backend Deployment (Render)

1. **Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select the repository containing `render.yaml`

2. **Configure Services**
   Render automatically creates from `render.yaml`:
   - Trade Server (Web Service on port 9090)
   - Background Worker (order processing)
   - Market Analysis (Cron Job)
   - Redis Cache

3. **Set Environment Variables**
   
   In Render dashboard, go to each service → Environment → Add Environment Variable:
   
   **Database Configuration (use atomic variables):**
   ```bash
   DATABASE_HOST=aws-us-east-1-portal.23.psdb.cloud
   DATABASE_PORT=5432
   DATABASE_NAME=snoball-prod
   DATABASE_USERNAME=your_planetscale_username
   DATABASE_PASSWORD=your_planetscale_password
   DATABASE_SSL=require
   DATABASE_POOLING_PORT=6432
   ```
   
   **Trading & Authentication:**
   ```bash
   ALPACA_API_KEY=your_alpaca_key
   ALPACA_SECRET_KEY=your_alpaca_secret
   ALPACA_ENDPOINT=https://paper-api.alpaca.markets
   WORKOS_API_KEY=your_workos_key
   WORKOS_CLIENT_ID=your_workos_client_id
   WORKOS_WEBHOOK_SECRET=your_workos_webhook_secret
   ```
   
   **Security & Application:**
   ```bash
   ENCRYPTION_KEY=$(openssl rand -hex 32)
   NEXTAUTH_SECRET=$(openssl rand -hex 32)
   NODE_ENV=production
   ENVIRONMENT=production
   ```

### Frontend Deployment (Vercel)

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Build Settings**
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `bun run build`
   - Install Command: `bun install`

3. **Set Environment Variables**
   
   In Vercel dashboard, go to Project Settings → Environment Variables:
   
   **API Configuration:**
   ```bash
   NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
   ```
   
   **Database (use atomic variables for serverless):**
   ```bash
   DATABASE_HOST=aws-us-east-1-portal.23.psdb.cloud
   DATABASE_PORT=5432
   DATABASE_NAME=snoball-prod
   DATABASE_USERNAME=your_planetscale_username
   DATABASE_PASSWORD=your_planetscale_password
   DATABASE_SSL=require
   DATABASE_POOLING_PORT=6432
   ```
   
   **Authentication:**
   ```bash
   WORKOS_API_KEY=your_workos_key
   WORKOS_CLIENT_ID=your_workos_client_id
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=https://your-app.vercel.app
   ```

---

## 6. Environment Variables Reference

### Required for All Environments:

**Database (Atomic Variables - Recommended):**
```bash
DATABASE_HOST=your_database_host
DATABASE_PORT=5432
DATABASE_NAME=your_database_name
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
DATABASE_SSL=require  # or 'false' for local
DATABASE_POOLING_PORT=6432
```

**Trading:**
```bash
ALPACA_API_KEY=pk_test_xxx
ALPACA_SECRET_KEY=xxx
ALPACA_ENDPOINT=https://paper-api.alpaca.markets
```

**Authentication:**
```bash
WORKOS_API_KEY=sk_test_xxx
WORKOS_CLIENT_ID=client_xxx
WORKOS_WEBHOOK_SECRET=wh_xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://your-domain.com
```

**Security:**
```bash
ENCRYPTION_KEY=32_character_random_string
```

**Application:**
```bash
NODE_ENV=production
ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

**Cache:**
```bash
REDIS_URL=redis://red-xxx.onrender.com:6379
```

**AI (Optional):**
```bash
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 7. Platform Dashboard Environment Setup

After setting up your services, you need to configure environment variables in each platform's dashboard. Here's a comprehensive guide for each platform:

### 7.1. Render Dashboard Setup

**Location**: [Render Dashboard](https://dashboard.render.com) → Your Service → Environment

**For Each Service (Trade Server, Background Worker, Cron Job):**

1. **Database Variables (Atomic)**:
   ```bash
   DATABASE_HOST=aws-us-east-1-portal.23.psdb.cloud
   DATABASE_PORT=5432
   DATABASE_NAME=snoball-prod
   DATABASE_USERNAME=your_planetscale_username
   DATABASE_PASSWORD=your_planetscale_password
   DATABASE_SSL=require
   DATABASE_POOLING_PORT=6432
   ```

2. **Trading API**:
   ```bash
   ALPACA_API_KEY=your_alpaca_api_key
   ALPACA_SECRET_KEY=your_alpaca_secret_key
   ALPACA_ENDPOINT=https://paper-api.alpaca.markets
   ```

3. **Authentication**:
   ```bash
   WORKOS_API_KEY=your_workos_api_key
   WORKOS_CLIENT_ID=your_workos_client_id
   WORKOS_WEBHOOK_SECRET=your_workos_webhook_secret
   ```

4. **Security**:
   ```bash
   ENCRYPTION_KEY=87a7bd3a8720709e5d018924dfc8060bb42340e96d8deafec75f25f9c046e992
   NEXTAUTH_SECRET=6e9053e70e8021aa8508907f31fb16e14cb4b5b66ed76bcda58f339d2ab9b264
   ```
   *Generate with: `openssl rand -hex 32`*

5. **Application**:
   ```bash
   NODE_ENV=production
   ENVIRONMENT=production
   PORT=9090
   ```

6. **AI APIs (Optional)**:
   ```bash
   OPENAI_API_KEY=sk-proj-xxx
   ANTHROPIC_API_KEY=sk-ant-xxx
   ```

**Redis URL**: Render automatically provides `REDIS_URL` when you add a Redis service.

### 7.2. Vercel Dashboard Setup

**Location**: [Vercel Dashboard](https://vercel.com/dashboard) → Project → Settings → Environment Variables

**Set these for Production, Preview, and Development environments:**

1. **API Configuration**:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
   ```

2. **Database (Atomic Variables)**:
   ```bash
   DATABASE_HOST=aws-us-east-1-portal.23.psdb.cloud
   DATABASE_PORT=5432
   DATABASE_NAME=snoball-prod
   DATABASE_USERNAME=your_planetscale_username
   DATABASE_PASSWORD=your_planetscale_password
   DATABASE_SSL=require
   DATABASE_POOLING_PORT=6432
   ```

3. **Authentication**:
   ```bash
   WORKOS_API_KEY=your_workos_api_key
   WORKOS_CLIENT_ID=your_workos_client_id
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=https://your-app.vercel.app
   ```

4. **Application**:
   ```bash
   NODE_ENV=production
   ENVIRONMENT=production
   ```

### 7.3. PlanetScale Dashboard Setup

**Location**: [PlanetScale Dashboard](https://app.planetscale.com) → Your Database → Settings

1. **Get Connection Details**:
   - Click "Connect" button
   - Select "General" or "Node.js"
   - Copy the connection details:
     - **Host**: `aws-us-east-1-portal.23.psdb.cloud`
     - **Username**: `your_generated_username`
     - **Password**: `your_generated_password`
     - **Database**: `snoball-prod`

2. **Use Atomic Variables**:
   ```bash
   DATABASE_HOST=aws-us-east-1-portal.23.psdb.cloud
   DATABASE_PORT=5432
   DATABASE_NAME=snoball-prod
   DATABASE_USERNAME=your_planetscale_username
   DATABASE_PASSWORD=your_planetscale_password
   DATABASE_SSL=require
   DATABASE_POOLING_PORT=6432
   ```

### 7.4. WorkOS Dashboard Setup

**Location**: [WorkOS Dashboard](https://dashboard.workos.com) → Your Project

1. **Get API Keys**:
   - API Key: Copy from "API Keys" section
   - Client ID: Copy from "Configuration" section
   - Webhook Secret: Generate in "Webhooks" section

2. **Configure Redirect URIs**:
   ```bash
   # Development
   http://localhost:3000/api/auth/callback/workos
   
   # Production
   https://your-app.vercel.app/api/auth/callback/workos
   ```

3. **Environment Variables**:
   ```bash
   WORKOS_API_KEY=sk_test_xxx
   WORKOS_CLIENT_ID=client_xxx
   WORKOS_WEBHOOK_SECRET=wh_xxx
   ```

### 7.5. Alpaca Markets Dashboard Setup

**Location**: [Alpaca Dashboard](https://app.alpaca.markets) → API Keys

1. **Paper Trading (Development)**:
   ```bash
   ALPACA_API_KEY=pk_test_xxx
   ALPACA_SECRET_KEY=xxx
   ALPACA_ENDPOINT=https://paper-api.alpaca.markets
   ```

2. **Live Trading (Production)**:
   ```bash
   ALPACA_API_KEY=pk_live_xxx
   ALPACA_SECRET_KEY=xxx
   ALPACA_ENDPOINT=https://api.alpaca.markets
   ```

### 7.6. Environment Variable Management Tips

**Security Best Practices**:
- ✅ Never commit `.env` files to git
- ✅ Use different credentials for each environment
- ✅ Rotate API keys regularly
- ✅ Use strong encryption keys (32+ characters)
- ✅ Enable MFA on all service accounts

**Debugging Tips**:
```bash
# Test database connection locally
bun run db:test

# Validate environment variables
node -e "console.log(process.env.DATABASE_HOST)"

# Test API connections
curl -H "Authorization: Bearer $ALPACA_API_KEY" https://paper-api.alpaca.markets/v2/account
```

**Common Issues**:
- **Database connection fails**: Check DATABASE_SSL setting
- **API key invalid**: Verify correct endpoint (paper vs live)
- **Authentication errors**: Ensure redirect URIs match exactly
- **Build failures**: Missing environment variables in platform dashboard

---

## 8. Verifying Your Setup

Run these commands to verify everything works:

```bash
# Test database connection
bun run db:test

# Test Alpaca API connection
bun run trading:test

# Start development servers
bun run dev

# Run tests
bun test

# Type checking
bun run type-check

# Linting
bun run lint
```

---

## 9. Security Best Practices

1. **API Keys**: Never commit `.env` files to version control
2. **Encryption**: Use strong encryption keys for sensitive data
3. **Authentication**: Use WorkOS for enterprise-grade auth
4. **Database**: Always use SSL connections (`sslmode=require`)
5. **Secrets**: Use platform-native secret management
6. **HTTPS**: Enforce HTTPS on all services
7. **Environment Separation**: Use different credentials per environment

### Key Security Features:
- API keys encrypted at rest with AES-256-GCM
- Database connections use SSL/TLS
- JWT tokens with secure refresh logic
- Webhook signature verification
- Rate limiting on all endpoints

---

## 10. Cost Estimates

### Development Environment (Free Tiers)
- PlanetScale: Free (5GB storage, 1 billion row reads/month)
- Render: Free (750 hours/month web service)
- Vercel: Free (unlimited personal projects)
- Alpaca: Free (paper trading)
- WorkOS: Free (up to 1M MAUs)
- **Total: $0/month**

### Production Environment
- PlanetScale: ~$29/month (Scaler plan)
- Render Services: ~$28/month (4 × $7 starter plans)
- Vercel: ~$20/month (Pro plan)
- Alpaca: Free API (commission per trade)
- WorkOS: ~$49/month (up to 1000 MAUs)
- **Total: ~$126/month**

### Scaling Considerations:
- PlanetScale automatically scales connections
- Render can auto-scale services based on load
- Vercel has automatic edge scaling
- All services include monitoring and alerts

---

## 11. Monitoring & Observability

### Built-in Platform Features:
- **Render**: Service metrics, logs, health checks
- **Vercel**: Analytics, function metrics, build logs  
- **PlanetScale**: Query insights, connection metrics
- **WorkOS**: Authentication analytics

### Application Monitoring:
- Structured logging with Winston/Pino
- Custom metrics via platform APIs
- Error tracking with Sentry (optional)
- Performance monitoring built-in

---

## 12. Troubleshooting

### Common Issues:

**Database Connection Errors**
```bash
# Test connection
bun run db:test

# Check SSL requirement
psql $DATABASE_URL -c "SELECT version();"
```

**WebSocket Connection Issues**
```bash
# Test from browser console
const ws = new WebSocket('wss://your-service.onrender.com');
ws.onopen = () => console.log('Connected');
```

**Build Failures**
- Check build logs in Render/Vercel dashboards
- Verify bun.lockb is committed
- Ensure all environment variables are set

### Getting Help:
1. Check service status pages
2. Review platform documentation
3. Use built-in logging and metrics
4. Open GitHub issues for code problems

---

## 13. Migration from AWS

If migrating from AWS infrastructure:

1. **Export Data**: Use `pg_dump` to export existing data
2. **Import to PlanetScale**: Use standard PostgreSQL import tools
3. **Update DNS**: Point domains to new services
4. **Environment Variables**: Update all service configurations
5. **Test Thoroughly**: Verify all functionality before DNS switch

---

## 14. Support & Resources

- [PlanetScale Docs](https://planetscale.com/docs)
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Alpaca API Docs](https://alpaca.markets/docs)
- [WorkOS Docs](https://workos.com/docs)
- [Next.js Docs](https://nextjs.org/docs)

For project-specific questions, please refer to the main README.md or open an issue on GitHub.

---

**🎯 Success Criteria**: Local development running, all services deployed, authentication working, trading API connected, database migrations complete.