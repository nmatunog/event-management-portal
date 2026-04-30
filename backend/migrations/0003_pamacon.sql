-- PAMACON 2026: flexible delegate fields + speakers + sponsor remarks
ALTER TABLE registrations ADD COLUMN metadata_json TEXT;
ALTER TABLE sponsors ADD COLUMN remarks TEXT;

CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  talk TEXT,
  name TEXT,
  topic TEXT,
  classification TEXT DEFAULT 'Others',
  honorarium REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_speakers_event ON speakers(event_id);
