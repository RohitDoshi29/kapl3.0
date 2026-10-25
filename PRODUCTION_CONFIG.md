# KAPL 3.0 Production Configuration Guide

## Environment Variables

### Required for Production

```bash
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_URL=https://your-project.supabase.co

# Environment Indicator
VITE_ENVIRONMENT=production

# Error Tracking
VITE_SENTRY_DSN=https://key@sentry.io/project-id

# Analytics (Optional)
VITE_ANALYTICS_KEY=your_analytics_key

# Feature Flags (Optional)
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_AUDIT_LOGGING=true
VITE_ENABLE_BACKUPS=true
```

### Setting Variables in Vercel

1. Go to Vercel Project Settings
2. Navigate to "Environment Variables"
3. Add each variable for production environment
4. Mark as "Sensitive" for security keys
5. Deploy to apply changes

---

## Database Configuration

### 1. Create Audit Logs Table

```sql
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  action TEXT NOT NULL,
  user_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read all logs
CREATE POLICY "Admin can read audit logs" ON public.audit_logs
  FOR SELECT
  USING (auth.jwt() ->> 'user_role' = 'admin');
```

### 2. Create Backups Table

```sql
-- Create backups table
CREATE TABLE public.backups (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  backup_name TEXT NOT NULL,
  backup_type TEXT NOT NULL, -- 'manual', 'automatic'
  backup_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT NOT NULL
);

-- Create indexes
CREATE INDEX idx_backups_status ON public.backups(status);
CREATE INDEX idx_backups_created_at ON public.backups(created_at DESC);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Admin can read/write backups
CREATE POLICY "Admin can manage backups" ON public.backups
  FOR ALL
  USING (auth.jwt() ->> 'user_role' = 'admin');
```

### 3. Optimize Existing Tables

```sql
-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_tournament_id ON public.players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_auction_status ON public.players(auction_status);
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON public.teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_sales_timestamp ON public.player_sales(created_at DESC);

-- Vacuum and analyze for statistics
VACUUM ANALYZE public.players;
VACUUM ANALYZE public.teams;
VACUUM ANALYZE public.player_sales;
```

---

## Supabase Configuration

### 1. Enable Row Level Security (RLS)

All tables should have RLS enabled:

```sql
-- Enable RLS on all tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Example RLS policy: Anyone can read, only admins can write players
CREATE POLICY "Anyone can read players" ON public.players
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert players" ON public.players
  FOR INSERT WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Only admins can update players" ON public.players
  FOR UPDATE USING (auth.jwt() ->> 'user_role' = 'admin');
```

### 2. Real-Time Configuration

Enable real-time for critical tables:

1. Go to Supabase Console
2. Click "Replication" under "Database"
3. Enable replication for:
   - `players`
   - `teams`
   - `player_sales`
   - `tournaments`

### 3. Connection Pooling

```
Supabase Dashboard → Database → Connection Pooling
- Enabled: Yes
- Mode: Transaction
- Pool size: 15 (adjust based on load)
```

### 4. Backup Configuration

```
Supabase Dashboard → Database → Backups
- Daily backups: Enabled
- Retention: 7 days
- Point-in-time recovery: Enabled
```

---

## Monitoring Setup

### 1. Sentry Configuration

Create `src/lib/sentry-setup.ts`:

```typescript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export function initSentry() {
  if (!import.meta.env.PROD) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT,
    integrations: [
      new BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(),
      }),
    ],
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Filter out certain errors if needed
      return event;
    },
  });
}
```

### 2. Health Check Monitoring

Set up external monitoring to check `/health` endpoint every 5 minutes:

```
UptimeRobot Configuration:
- URL: https://kapl-app.vercel.app/health
- Interval: 5 minutes
- Alert if down: Yes
- Notification: Email + Slack
```

### 3. Performance Monitoring

Monitor Core Web Vitals:

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function initWebVitals() {
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);
}
```

---

## Deployment Configuration

### 1. Vercel Settings

Project Settings → General:
- Framework: Vite
- Build Command: `npm run build:prod`
- Output Directory: `dist`
- Environment: Production

### 2. Vercel Regions

Configure deployment regions:
- Primary: sfo1 (San Francisco)
- Fallback: iad1 (Virginia)

### 3. Vercel Analytics

Enable analytics in Vercel Dashboard:
- Web Analytics: Enabled
- Speed Insights: Enabled

---

## CI/CD Pipeline Configuration

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm install
      
      - name: Lint
        run: npm run lint
      
      - name: Build
        run: npm run build:prod
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
      
      - name: Deploy to Vercel
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

---

## Backup & Recovery

### 1. Automated Backups

Supabase creates daily backups automatically. To verify:

```sql
SELECT * FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 2. Manual Backup

Export player data:

```typescript
const { data } = await supabase
  .from('players')
  .select('*');

// Save as JSON
localStorage.setItem('backup_players', JSON.stringify(data));
```

### 3. Restore from Backup

```sql
-- Drop and recreate table
DROP TABLE public.players CASCADE;
-- Re-run migrations
-- Restore data from backup
```

---

## Security Hardening

### 1. Update Supabase Secrets

```bash
# Rotate JWT secret every 6 months
supabase update-jwt-secret
```

### 2. Configure CORS

Supabase → Project Settings → API:
```
CORS URLs: https://kapl-app.vercel.app
```

### 3. Rate Limiting

Supabase → Project Settings → Rate Limiting:
- Enable: Yes
- Limit: 500 requests per minute per IP

### 4. Enable SAML/OAuth (Optional)

For enterprise deployments, enable:
- Google OAuth
- GitHub OAuth
- SAML 2.0

---

## Performance Tuning

### 1. Database Query Optimization

```sql
-- Explain query plans
EXPLAIN ANALYZE SELECT * FROM players WHERE tournament_id = 'kapl-3-mens';

-- Create covering indexes if needed
CREATE INDEX idx_players_tournament_include_status 
  ON public.players(tournament_id) 
  INCLUDE (auction_status, base_price);
```

### 2. Connection Pool Tuning

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Adjust pool size based on peak load
-- Start with: max_connections = (CPU_cores × 4)
```

### 3. Caching Strategy

```
Vercel Cache-Control Headers:
- Assets: max-age=31536000, immutable
- Pages: max-age=0, must-revalidate
- API: no-cache, no-store
```

---

## Compliance & Legal

### 1. Privacy Policy

- [ ] Privacy policy published
- [ ] Data processing agreement in place
- [ ] GDPR compliance verified
- [ ] User consent obtained where needed

### 2. Terms of Service

- [ ] Terms of service published
- [ ] Liability disclaimers in place
- [ ] User responsibilities documented

### 3. Audit Trail

- All user actions logged in audit_logs table
- Retention: 1 year (or as per regulations)
- Access restricted to admins only

---

## Disaster Recovery Plan

### Recovery Time Objectives (RTO)
- Critical outage: < 1 hour
- Degraded service: < 4 hours
- Full service: < 24 hours

### Recovery Point Objectives (RPO)
- Data loss: < 1 hour
- Transaction loss: < 5 minutes

### Recovery Procedures

1. **Full Database Recovery**
   - Stop all write operations
   - Restore from latest backup
   - Verify data integrity
   - Rerun migrations if needed
   - Resume operations

2. **Partial Data Recovery**
   - Identify corrupted records
   - Restore specific tables from backup
   - Verify relationships
   - Update affected users

3. **Application Recovery**
   - Rollback to previous version
   - Verify all services healthy
   - Monitor error rate
   - Re-deploy if stable

