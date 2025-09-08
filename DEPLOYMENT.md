# Snoball Trading Platform - Deployment Guide

## 🚀 Quick Deployment Overview

This guide covers deploying the Snoball trading platform using modern, native tools:

- **Frontend**: Vercel (Next.js)
- **Backend**: Render (WebSocket server + background workers)
- **Database**: PlanetScale Postgres
- **Cache**: Render Redis

## 📋 Prerequisites

- [ ] GitHub repository with your code
- [ ] Vercel account (free)
- [ ] Render account (free starter)
- [ ] PlanetScale account (free tier available)
- [ ] Alpaca Markets account (paper trading free)
- [ ] WorkOS account (authentication)

## 🏗️ Architecture Overview

```mermaid
graph TB
    A[User Browser] -->|HTTPS| B[Vercel Frontend]
    B -->|API Calls| C[Render Trade Server]
    C -->|WebSocket| D[Alpaca Markets]
    C -->|Database| E[PlanetScale Postgres]
    C -->|Cache| F[Render Redis]
    G[Background Worker] -->|Process Orders| E
    H[Cron Jobs] -->|Market Analysis| E

    subgraph Render
        C
        G
        H
        F
    end
```

## 🛠️ Step-by-Step Deployment

### 1. Database Setup (PlanetScale)

1. **Create Database**

   ```bash
   # Install PlanetScale CLI
   brew install planetscale/tap/pscale

   # Login to PlanetScale
   pscale auth login

   # Create database with cluster size
   # PS-10 = Hobby plan (free), PS-20 = Scaler plan ($29/month)
   pscale database create snoball-prod --cluster-size PS-10

   # Create branch for development
   pscale branch create snoball-prod dev
   ```

2. **Get Connection String**

   ```bash
   # Get connection string for main branch
   pscale connect snoball-prod main
   # Copy the connection string provided
   ```

3. **Run Migrations**

   ```bash
   # Connect to development branch
   pscale connect snoball-prod dev --port 3309

   # Run migrations (in another terminal)
   DATABASE_URL="postgresql://root@127.0.0.1:3309/snoball-prod" bun run db:migrate
   ```

### 2. Backend Deployment (Render)

1. **Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select the repository containing `render.yaml`

2. **Configure Services**
   Render will automatically detect the `render.yaml` file and create:
   - Trade Server (Web Service)
   - Background Worker
   - Market Analysis (Cron Job)
   - Redis Cache

3. **Set Environment Variables**
   For each service, set these variables in the Render dashboard:

   ```bash
   # Database (PlanetScale)
   DATABASE_URL=postgresql://username:password@aws-us-east-1-portal.23.psdb.cloud/snoball-prod?sslmode=require
   DATABASE_URL_POOLED=postgresql://username:password@aws-us-east-1-portal.23.psdb.cloud:6432/snoball-prod?sslmode=require

   # Trading APIs
   ALPACA_API_KEY=your_alpaca_api_key
   ALPACA_SECRET_KEY=your_alpaca_secret_key
   ALPACA_ENDPOINT=https://paper-api.alpaca.markets

   # Authentication (WorkOS)
   WORKOS_API_KEY=your_workos_api_key
   WORKOS_CLIENT_ID=your_workos_client_id
   WORKOS_WEBHOOK_SECRET=your_workos_webhook_secret

   # Security
   ENCRYPTION_KEY=$(openssl rand -hex 32)
   NEXTAUTH_SECRET=$(openssl rand -hex 32)
   NEXTAUTH_URL=https://your-app.vercel.app

   # Application
   NODE_ENV=production
   ENVIRONMENT=production
   ```

4. **Deploy Services**
   - Services will automatically deploy when environment variables are set
   - Monitor deployment logs in the Render dashboard

### 3. Frontend Deployment (Vercel)

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

   ```bash
   # API Configuration
   NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com

   # Database (for API routes - use pooled connection for serverless)
   DATABASE_URL=your_planetscale_pooled_connection_string

   # Authentication
   WORKOS_API_KEY=your_workos_api_key
   WORKOS_CLIENT_ID=your_workos_client_id
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=https://your-app.vercel.app
   ```

4. **Deploy**
   - Vercel automatically deploys on every commit to main branch
   - Preview deployments created for pull requests

## 🔧 Configuration Details

### Service Communication

```yaml
Frontend (Vercel):
  - Serves Next.js application
  - API routes for lightweight operations
  - Connects to Render services via HTTP/WebSocket

Trade Server (Render):
  - Handles WebSocket connections to Alpaca
  - Processes trading orders
  - Manages real-time market data
  - Port: 9090

Background Worker (Render):
  - Processes orders asynchronously
  - Handles PDT compliance checks
  - Manages trade settlements
  - Shares database with trade server

Cron Jobs (Render):
  - Runs every 30 minutes during market hours
  - Performs LLM market analysis
  - Generates trading signals
  - Cleans up expired cache entries
```

### Database Connections

```javascript
// Connection for persistent services (trade server, worker)
const db = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  ssl: "require",
});

// Connection for serverless functions (Vercel API routes)
const dbPooled = postgres(process.env.DATABASE_URL.replace(":5432", ":6432"), {
  max: 1,
  idle_timeout: 0,
  ssl: "require",
});
```

## 📊 Monitoring & Logs

### Render Monitoring

- **Logs**: Available in Render dashboard for each service
- **Metrics**: CPU, memory, request volume
- **Health Checks**: Automatic monitoring of `/health` endpoints
- **Alerts**: Email notifications on service failures

### Vercel Monitoring

- **Analytics**: Built-in web analytics
- **Functions**: Serverless function monitoring
- **Speed Insights**: Core Web Vitals tracking
- **Build Logs**: Deployment status and errors

### PlanetScale Monitoring

- **Insights**: Query performance and slow queries
- **Branching**: Safe schema changes with deploy requests
- **Backups**: Automatic daily backups
- **Scaling**: Automatic connection scaling

## 🔒 Security Checklist

- [ ] All API keys stored as environment variables
- [ ] Database connections use SSL
- [ ] Encryption key generated with `openssl rand -hex 32`
- [ ] WorkOS webhooks configured with proper secrets
- [ ] HTTPS enforced on all services
- [ ] Non-root Docker user configured
- [ ] Health check endpoints secured

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**

   ```bash
   # Test connection locally
   psql $DATABASE_URL -c "SELECT 1"

   # Check connection pooling
   psql ${DATABASE_URL/5432/6432} -c "SELECT 1"
   ```

2. **WebSocket Connection Fails**

   ```bash
   # Test from browser console
   const ws = new WebSocket('wss://your-service.onrender.com');
   ws.onopen = () => console.log('Connected');
   ws.onerror = (err) => console.error('Error:', err);
   ```

3. **Build Failures**
   ```bash
   # Check build logs in Render dashboard
   # Verify Dockerfile paths are correct
   # Ensure bun.lockb is committed to repo
   ```

### Service URLs

After deployment, your services will be available at:

- **Frontend**: `https://your-app.vercel.app`
- **API**: `https://your-service.onrender.com`
- **Database**: PlanetScale connection string
- **Redis**: `redis://red-xxxxx.onrender.com:6379`

## 💰 Cost Estimate

| Service                  | Plan    | Monthly Cost      |
| ------------------------ | ------- | ----------------- |
| Vercel                   | Pro     | $20/month         |
| Render Trade Server      | Starter | $7/month          |
| Render Background Worker | Starter | $7/month          |
| Render Cron Job          | Starter | $7/month          |
| Render Redis             | Starter | $7/month          |
| PlanetScale              | Hobby   | $0-$29/month      |
| **Total**                |         | **$48-$77/month** |

Compare to AWS ECS setup: ~$150-200/month

## 🚀 Going Live

1. **Switch to Production APIs**

   ```bash
   # Update environment variables
   ALPACA_ENDPOINT=https://api.alpaca.markets
   NODE_ENV=production
   ```

2. **Configure Custom Domain**
   - Vercel: Add domain in project settings
   - Render: Add custom domain in service settings

3. **Set up Monitoring**
   - Configure alerts for service failures
   - Set up log aggregation if needed
   - Monitor trading performance metrics

4. **Security Review**
   - Rotate all API keys
   - Review access logs
   - Test failover scenarios

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [PlanetScale Documentation](https://planetscale.com/docs)
- [Alpaca Markets API](https://alpaca.markets/docs/)
- [WorkOS Documentation](https://workos.com/docs)
- [Bun Runtime Documentation](https://bun.sh/docs)
- [Next.js App Router Guide](https://nextjs.org/docs/app)

## 🆘 Support

For deployment issues:

1. Check service logs in respective dashboards
2. Review this deployment guide
3. Test connections using provided troubleshooting steps
4. Open GitHub issues for code-related problems

---

**🎯 Success Criteria**: All services healthy, WebSocket connections stable, database migrations complete, frontend loading correctly.

