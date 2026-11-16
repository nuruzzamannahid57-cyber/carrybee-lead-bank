# Carrybee Lead Bank — Enterprise Acquisition & COD Incentive Portal

Confidential multi-role B2B Lead Bank dashboard, Google Sheets 1-to-1 tab dual-sync, automatic 2-day follow-up engine, and **Carrybee Hive (`https://hive.carrybee.com/orders`)** Manifest V3 Chrome Extension with **2% COD Incentive** tracking.

## Key Capabilities

1. **Role-Based Access & Strict Lead Privacy**
   - **Nuruzzaman Nahid** (`nuruzzaman.nahid@carrybee.com`) — `Super Admin` (Sheet Tab: `Nuruzzaman Nahid`, pre-seeded with `1,951` deduplicated leads)
   - **Ahmed Asif Rashid** (`asif.rashid@carrybee.com`) — `Team Leader` (Sheet Tab: `Ahmed Asif Rashid`)
   - **Tanzim Iniat Islam** (`iniat.islam@carrybee.com`) — `Team Member` (Sheet Tab: `Tanzim`)
   - **Zero-Leak Isolation:** PostgreSQL Row-Level Security (`auth.uid() = owner_id`) ensures nobody—not even Super Admin or Team Leader—can view another member's private lead rows. Team Leader & Super Admin view aggregate progression counts only via `public.get_team_progression()`.

2. **Confidential Auto-Generated Passwords + Sent Mail Auto-Purge**
   - Passwords are generated cryptographically on the server, stored strictly as encrypted hashes in Supabase, emailed directly to each member, and immediately purged from the sender's Sent Mail.
   - Supports both Email + Confidential Password login and Google OAuth.

3. **Dual Storage (Supabase + Google Sheets)**
   - Adding, editing, or deleting a lead updates Supabase and syncs to the member's own tab in the `Lead Bank` Google Sheet (`1f46_Wp-j4RNf2B5ojEVDJQXuayjNojuuh5u6GJimavM`).
   - Adding a new member as Super Admin automatically provisions a dedicated tab in the Google Sheet and dispatches their confidential auto-generated password.

4. **Progression Tab & 2-Day Follow-Up Reminder Engine**
   - Tracks `New Leads Collected`, `Connected`, `2-Day Follow-Up Due`, and `Onboarded`.
   - Automatically triggers follow-up alerts 48 hours after a lead is marked `Connected` or `Follow-Up`.

5. **Money Tab + Carrybee Hive (`https://hive.carrybee.com/orders`) Chrome Extension**
   - Unpacked source in `./chrome-extension` and downloadable bundle at `/carrybee-hive-tracker-extension.zip`.
   - Tracks onboarded merchant order counts and daily COD across **Days 1–31** of each month:
     - **Day 1 starters:** tracked across all `30/31` days of that month.
     - **Mid-month starters (e.g. Day 16):** tracked across the remaining days of the start month (`15d`) **plus** the full `30/31` days of the next month.
   - Displays the **Incentives Card (`2%` of Total Eligible COD)**.

## Live Deployment & Repository

- **Production Dashboard (Vercel):** https://carrybee-lead-bank-gamma.vercel.app
- **Carrybee Hive Chrome Extension Bundle:** https://carrybee-lead-bank-gamma.vercel.app/carrybee-hive-tracker-extension.zip
- **GitHub Repository (Auto-Deploys on Push to `main`):** https://github.com/nuruzzamannahid57-cyber/carrybee-lead-bank
- **Supabase Project (`ap-southeast-1`):** `ssfuduqemmjndsdvgmjk` (`lead-bank-dashboard`)
- **Connected Google Sheet (`Asia/Dhaka`):** `1f46_Wp-j4RNf2B5ojEVDJQXuayjNojuuh5u6GJimavM`
