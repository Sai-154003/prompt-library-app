# Supabase Migration

Run this SQL in the Supabase SQL Editor at:
https://supabase.com/dashboard/project/yaiewmzgdldncnwtgnap/sql

## Step 1 — Run this SQL

```sql
-- Create app_users table for role and approval management
CREATE TABLE IF NOT EXISTS app_users (
  id               TEXT PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'user',
  status           TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at       BIGINT NOT NULL DEFAULT 0,
  approved_at      BIGINT,
  approved_by      TEXT,
  last_login_at    BIGINT
);

-- Add approval columns to prompts table
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS status           TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by      TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at      BIGINT;

-- All existing prompts are already approved
UPDATE prompts SET status = 'approved' WHERE status IS NULL OR status = '';

-- Grant access (RLS is disabled)
GRANT ALL ON app_users TO anon, authenticated;
```

## Step 2 — Set the first admin

After logging into the app once (which will auto-create your app_users record as approved), run:

```sql
UPDATE app_users SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';
```

Replace `YOUR_EMAIL_HERE` with your actual login email (lowercase).

## Step 3 — Verify

```sql
SELECT * FROM app_users;
SELECT status, COUNT(*) FROM prompts GROUP BY status;
```

## How it works

- **New users**: After email OTP verification, a `pending` record is created in `app_users`. The user cannot log in until an admin approves them.
- **Existing users**: On first login after this migration, if no `app_users` record exists, one is auto-created as `approved` (backward compatibility).
- **New prompts**: Regular users submit prompts as `pending`. Admins see them in the Admin Panel and can approve or reject with an optional reason.
- **Admin prompts**: Prompts submitted by admins go live immediately (`approved`).
- **Admin Panel**: Available at `admin.html`. Only accessible to users with `role = 'admin'`.
