# KAPL 3.0 Deployment Guide

## Prerequisites
- Node.js 18+
- npm or yarn
- Vercel account (for hosting)
- Supabase project
- Sentry account (for error tracking)

---

## Environment Setup

### 1. Development Environment
```bash
# Install dependencies
npm install

# Create .env.development
cp .env.example .env.development

# Start dev server
npm run dev
```

### 2. Staging Environment
```bash
# Build for staging
npm run build:staging

# Deploy to staging
vercel --prod --env staging
```

Environment variables in `.env.staging`:
- `VITE_ENVIRONMENT=staging`
- `VITE_SUPABASE_URL=<staging-supabase-url>`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<staging-key>`
- `VITE_SENTRY_DSN=<staging-sentry-dsn>`

### 3. Production Environment
```bash
# Build for production
npm run build:prod

# Deploy to production (via Vercel)
vercel --prod
```

Environment variables in `.env.production`:
- `VITE_ENVIRONMENT=production`
- `VITE_SUPABASE_URL=<prod-supabase-url>`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<prod-key>`
- `VITE_SENTRY_DSN=<prod-sentry-dsn>`

---

## Pre-Deployment Checklist

### Code Quality
- [ ] `npm run lint` passes
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] All tests pass (if applicable)
- [ ] Code reviewed by 2+ team members

### Security
- [ ] No hardcoded secrets in code
- [ ] Environment variables properly configured
- [ ] Security headers in vercel.json
- [ ] CORS configuration reviewed
- [ ] Rate limiting enabled

### Database
- [ ] Backups created and tested
- [ ] Migration scripts reviewed
- [ ] Read replicas configured (if needed)
- [ ] Connection pooling configured

### Performance
- [ ] Bundle size < 250KB gzipped
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals meet thresholds
- [ ] Database queries optimized

### Monitoring
- [ ] Sentry project configured
- [ ] Error thresholds set
- [ ] Performance monitoring enabled
- [ ] Health check endpoint working

---

## Deployment Steps

### Step 1: Prepare Release
```bash
# Create release branch
git checkout -b release/v3.0.0

# Update version in package.json
npm version patch

# Commit and push
git add .
git commit -m "chore: bump version to 3.0.0"
git push origin release/v3.0.0
```

### Step 2: Test in Staging
```bash
# Deploy staging
npm run build:staging
vercel --prod --env staging

# Run smoke tests
# - Visit https://staging-app.vercel.app
# - Check /health endpoint
# - Test critical user flows
# - Verify Sentry is logging errors
```

### Step 3: Production Deployment
```bash
# Build production
npm run build:prod

# Deploy to production
vercel --prod

# Verify deployment
curl https://kapl-app.vercel.app/health
```

### Step 4: Post-Deployment
```bash
# Monitor error logs
# - Check Sentry for new errors
# - Monitor database performance
# - Check user feedback

# If issues found:
git revert <commit-hash>
vercel --prod --regions sfo1
```

---

## Monitoring & Health Checks

### Health Check Endpoint
```bash
curl https://kapl-app.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "3.0.0",
  "environment": "production",
  "timestamp": "2026-10-25T10:00:00Z",
  "database": "connected",
  "realtimeAvailable": true
}
```

### Key Metrics to Monitor
- Error rate (should be < 1%)
- Response time (should be < 500ms)
- Database query time (should be < 200ms)
- Real-time subscription health
- User session duration

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 0.5% | > 2% |
| Response Time | > 1s | > 5s |
| DB Connection | > 10 | > 50 |
| Sentry Issues | > 5/min | > 20/min |

---

## Rollback Procedure

### Quick Rollback (< 5 minutes)
```bash
# View deployment history
vercel ls

# Rollback to previous version
vercel rollback

# Verify rollback
curl https://kapl-app.vercel.app/health
```

### Manual Rollback
```bash
# Deploy previous commit
git checkout <previous-commit>
npm run build:prod
vercel --prod --force
```

### Database Rollback (if needed)
```bash
# Restore from backup
supabase db reset --linked

# Sync players from vault
npm run verify
```

---

## Incident Response

### If Production is Down

1. **Assess Impact** (1 min)
   - Check /health endpoint
   - Check Sentry for errors
   - Check database connectivity

2. **Immediate Action** (5 min)
   - Rollback to previous version
   - Post status update to stakeholders
   - Enable manual monitoring mode

3. **Investigation** (15 min)
   - Review Sentry errors
   - Check database logs
   - Review recent deployments

4. **Root Cause Analysis** (1 hour)
   - Identify what broke
   - Create fix
   - Test in staging

5. **Redeploy** (15 min)
   - Deploy fixed version
   - Monitor closely
   - Post post-mortem

---

## Performance Optimization Tips

### Bundle Size
```bash
# Analyze bundle
npm run build:prod
npm install -g source-map-explorer
source-map-explorer 'dist/**/*.js'
```

### Database Queries
- Use indexes on frequently filtered columns
- Implement query result caching
- Use read replicas for reporting

### Caching Strategy
- Cache static assets for 1 year
- Cache API responses for 5 minutes
- Use service worker for offline support

---

## Troubleshooting

### High Error Rate
1. Check Sentry for error patterns
2. Check database connections
3. Check API rate limiting
4. Check Supabase real-time subscriptions

### Slow Response Times
1. Check database query performance
2. Check bundle size
3. Check network latency
4. Profile with Chrome DevTools

### Database Connection Issues
1. Check Supabase status page
2. Check connection pool exhaustion
3. Check firewall rules
4. Restart connection pool

---

## Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Tech Lead | - | - | - |
| Database Admin | - | - | - |
| Ops Lead | - | - | - |
| On-Call | - | - | - |

---

## Documentation Links

- [Vercel Deployment Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Sentry Docs](https://docs.sentry.io)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
