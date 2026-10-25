# KAPL 3.0 Production - Quick Start Guide

## 5-Minute Overview

Your cricket auction app is **production-ready** with:
- ✅ Error logging (Sentry)
- ✅ Input validation (Zod)
- ✅ Rate limiting (deduplication)
- ✅ Security headers
- ✅ Health monitoring
- ✅ Audit logging
- ✅ Environment configs

---

## Deploy to Staging (5 minutes)

```bash
# Build for staging
npm run build:staging

# Deploy to Vercel
vercel --prod --env staging

# Verify
curl https://your-staging-app.vercel.app/health
```

---

## Deploy to Production (5 minutes)

```bash
# Build for production
npm run build:prod

# Deploy to Vercel
vercel --prod

# Verify
curl https://your-app.vercel.app/health
```

---

## Setup Checklist

### Required (Before Going Live)
- [ ] Create Sentry account → Get DSN → Add to `.env.production`
- [ ] Create Supabase project → Get URL & keys → Add to `.env.production`
- [ ] Run SQL to create `audit_logs` table (see PRODUCTION_CONFIG.md)
- [ ] Configure Supabase: RLS, connection pooling, backups
- [ ] Test staging deployment
- [ ] Setup Sentry alerts

### Recommended (For Monitoring)
- [ ] Setup UptimeRobot to monitor `/health`
- [ ] Configure Slack notifications
- [ ] Setup performance monitoring
- [ ] Create monitoring dashboard

---

## Environment Variables

### .env.production
```bash
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_ENVIRONMENT="production"
VITE_SENTRY_DSN="https://key@sentry.io/project-id"
```

### .env.staging
```bash
VITE_SUPABASE_PROJECT_ID="your-staging-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-staging-key"
VITE_SUPABASE_URL="https://your-staging-project.supabase.co"
VITE_ENVIRONMENT="staging"
VITE_SENTRY_DSN="https://key@sentry.io/staging-project-id"
```

---

## Verify Deployment

### Health Check
```bash
curl https://app.vercel.app/health

# Expected response:
{
  "status": "ok",
  "version": "3.0.0",
  "environment": "production",
  "database": "connected",
  "realtimeAvailable": true
}
```

### Test Critical Flows
1. [ ] Add player to auction
2. [ ] Place bid on player
3. [ ] View player stats
4. [ ] Export player data
5. [ ] View auction standings

---

## Monitoring

### Key Metrics to Watch
| Metric | Target | Alert |
|--------|--------|-------|
| Error Rate | < 1% | > 2% |
| Response Time | < 500ms | > 1s |
| DB Latency | < 200ms | > 500ms |

### Check Sentry
```
https://sentry.io/organizations/your-org/issues/
```

### Check Uptime
```
https://uptimerobot.com/dashboard
```

---

## Rollback (If Issues)

```bash
# Quick rollback
vercel rollback

# Or full rollback
git checkout previous-commit
npm run build:prod
vercel --prod --force
```

---

## New Features

### 1. Audit Logging
Tracks all admin actions:
```typescript
import { auditLogger } from '@/lib/audit';

auditLogger.playerAdded('p123', 'Virat Kohli', userId);
auditLogger.playerSold('p123', 'team1', 50000, userId);
```

### 2. Input Validation
Prevents bad data:
```typescript
import { validatePlayerInput } from '@/lib/schemas';

const result = validatePlayerInput(playerData);
if (!result.success) {
  toast.error(result.error); // Clear error message
}
```

### 3. Health Endpoint
Monitor app status:
```bash
GET /health

Response: {
  "status": "ok",
  "version": "3.0.0",
  "database": "connected"
}
```

### 4. Request Deduplication
Prevents duplicate submissions:
```typescript
import { useRequestQueue } from '@/hooks/useRequestQueue';

const { isPending, executeRequest } = useRequestQueue();
await executeRequest('add-player', async () => {
  // Add player
});
```

### 5. Error Logging
Automatic error tracking:
```typescript
import { logger } from '@/lib/logger';

logger.error('Player creation failed', error, { userId });
// Automatically sent to Sentry in production
```

---

## Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| PRODUCTION_READINESS.md | Implementation roadmap | 10 min |
| DEPLOYMENT_GUIDE.md | How to deploy | 15 min |
| PRODUCTION_CHECKLIST.md | Pre-launch checklist | 20 min |
| PRODUCTION_CONFIG.md | Configuration guide | 20 min |
| PRODUCTION_SUMMARY.md | What changed | 10 min |

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build:prod
```

### Health Endpoint Returns Error
```bash
# Check Supabase connection
# Check database is accessible
# Check RLS policies are configured
```

### Errors Not Appearing in Sentry
```bash
# Verify Sentry DSN is set correctly
# Check VITE_ENVIRONMENT is "production"
# Verify browser console shows errors
```

### Players Not Being Added
```bash
# Check validation in browser console
# Verify Supabase API keys are correct
# Check audit logs for error details
```

---

## Production Commands Reference

```bash
# Development
npm install
npm run dev

# Build for different environments
npm run build:dev      # Development
npm run build:staging  # Staging
npm run build:prod     # Production

# Deploy
vercel --prod          # Deploy to production
vercel --prod --env staging  # Deploy to staging

# Monitoring
curl https://app.vercel.app/health    # Check health
vercel logs                              # View logs
vercel rollback                          # Rollback version
```

---

## First 24 Hours Checklist

### First Hour
- [ ] Verify app loads
- [ ] Check health endpoint
- [ ] Test critical flows
- [ ] Monitor Sentry errors
- [ ] Check response times

### First 4 Hours
- [ ] Watch error rate
- [ ] Monitor user signups
- [ ] Check database performance
- [ ] Review Sentry issues

### First 24 Hours
- [ ] Analyze usage patterns
- [ ] Review user feedback
- [ ] Optimize slow queries
- [ ] Document issues

---

## Contact & Support

**Need Help?**
1. Check the documentation files
2. Review the deployment guide
3. Check Sentry for error details
4. Review audit logs

**Emergency Rollback:**
```bash
vercel rollback
```

---

## What's Next?

After 1-2 weeks of stable production:

1. **Implement Priority 2 Features** (optional)
   - Offline mode (service worker)
   - Backup & restore system
   - Performance monitoring
   - Real-time fallback

2. **Optimize Performance**
   - Analyze usage data
   - Optimize slow pages
   - Reduce bundle size
   - Cache optimization

3. **Enhance Monitoring**
   - Add custom dashboards
   - Setup advanced alerts
   - Performance profiling
   - User analytics

---

## Success Criteria

✅ Launch is successful if:
- Site loads and responds < 1s
- Error rate < 1%
- Health endpoint returns "ok"
- Players can be added
- Auction flows work
- No data loss
- Monitoring shows healthy metrics

---

**Status:** ✅ PRODUCTION-READY  
**Last Updated:** 2026-10-25  
**Build:** 210.24 KB gzipped  
**Commit:** 8e4e12a
