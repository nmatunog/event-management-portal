CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  venue TEXT,
  start_date TEXT,
  end_date TEXT,
  organizer TEXT,
  attendee_goal INTEGER DEFAULT 0,
  budget_goal REAL DEFAULT 0,
  config_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  attendee_type TEXT DEFAULT 'Standard',
  status TEXT DEFAULT 'pre-registered',
  total_fee REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  payment_plan TEXT DEFAULT 'full',
  checked_in_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing_ledger (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  due_date TEXT NOT NULL,
  amount_due REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  company TEXT NOT NULL,
  tier TEXT DEFAULT 'Bronze',
  amount REAL DEFAULT 0,
  paid INTEGER DEFAULT 0,
  booth TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  supplier TEXT,
  category TEXT,
  amount REAL DEFAULT 0,
  expense_type TEXT DEFAULT 'fixed',
  approved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS program_sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  speaker TEXT,
  location TEXT,
  start_time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'next',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'sent',
  invitation_type TEXT DEFAULT 'standard',
  sent_at TEXT,
  last_opened_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_ledger_registration ON billing_ledger(registration_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_event ON sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_expense_event ON expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_session_event ON program_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_invite_event ON invitations(event_id);
