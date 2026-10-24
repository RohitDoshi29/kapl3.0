# 🏏 KAPL 3.0 – Premier Cricket Tournament Platform
### Official Real-Time Scoring, IPL-Style Live Auction, & Tournament Operations Suite

**KAPL 3.0** is an enterprise-grade cricket tournament operating system powering both **Men's & Women's Championships**. Built with React, Vite, Tailwind CSS, TypeScript, and Supabase Realtime, it delivers sub-30ms live scoreboard synchronization, comprehensive franchise management, an IPL-style live hammer auction with multi-category spotlighting, and dual-scorer consensus verification.

---

## ⚡ Core Platform Capabilities

### 1. 🔴 Live Match Operations & Ball-by-Ball Scoring
- **Sub-30ms Realtime Broadcasting**: Ultra-low latency match deltas propagated via Supabase Realtime and WebSocket mesh.
- **Rules Engine & Negative Runs**: Complete support for KAPL rules including negative penalty runs (-1, -2), extra balls (Wides, No-Balls), and over limits.
- **Dual-Scorer Consensus System**: Primary scorer and secondary scorer tab with active live discrepancy tracking and sync locks.
- **Resilient Offline Queue**: LocalStorage-backed per-tournament offline scoring queue that automatically flushes when network connectivity recovers.
- **Dynamic Commentary & Sound Effects**: Automated cricket sound effects (cheers, appeals, boundaries, fanfare) and rich commentary logs.

### 2. 🔨 IPL-Style Live Franchise Auction
- **Multi-League Segregation**: Independent player pools and team purse allocations for KAPL 3.0 Men's and Women's tournaments.
- **Spotlight Stage & Live Hammer**: Real-time spotlighting, fair-warning countdown timers, and team bids broadcast instantly to spectators.
- **Atomic Sales Transaction**: Database RPC (`sell_player_to_team`) enforcing atomic purse deduction, squad cap limits, and roster updates.
- **Real-Time Purses & Squad Tracker**: Dynamic team purse breakdown, remaining purse calculation, and squad size limits.
- **Cloud Auction History**: Persistent bid history and sales records synchronized directly with PostgreSQL.

### 3. 🛡️ Security & Role Governance
- **Row-Level Security (RLS)**: Public read with authenticated admin/scorer write barriers across all operational tables.
- **Atomic RPC Barriers**: Access-controlled functions (`reset_all_players_and_teams`, `delete_player_by_id`, `register_new_player`, `sell_player_to_team`) verifying caller roles inside PostgreSQL.
- **Sensitive Data Privacy**: Column-level protection revoking public anonymous access to user identifiers and phone numbers.
- **Role Hierarchy**: Elevated privileges for Super Admins, Co-Admins, Franchise Owners, Primary Scorers, and Players.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/RohitDoshi29/kapl3.0.git
cd kaplseason2-main

# Install dependencies
npm install

# Setup environment variables
# Copy .env.example to .env and configure your Supabase URL & Anon Key
```

### Development Server
```bash
npm run dev
```

### Production Build & Verification
```bash
npm run build
npm run verify
```

---

## 📁 Database Migrations & Supabase Setup
All database migrations and setup scripts are located in `supabase/migrations/`:
- `supabase/full_schema_setup.sql`: Complete consolidated schema with tables, RLS policies, indexes, and atomic RPCs.
- `supabase/migrations/20261024120000_security_and_schema_sync.sql`: Latest security hardening, captain fields, and atomic auction sale RPC.

---

## 📜 Tournament Rules Summary
| Event | Effect | Legal Ball? |
|---|---|---|
| +1, +4, +6 | Standard runs | Yes |
| -1, -2 | Negative penalty runs | Yes |
| Wide (Wd) | +1 extra run | No |
| No Ball (Nb) | +1 extra run | No |
| Wicket (W) | Batter dismissed | Yes |

---
© 2026 KAPL. All rights reserved.
