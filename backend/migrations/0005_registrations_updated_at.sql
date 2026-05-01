-- Add write timestamp for near real-time sync observability.
ALTER TABLE registrations ADD COLUMN updated_at TEXT;

-- Backfill historical rows so existing records have a value.
UPDATE registrations
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS idx_reg_event_updated ON registrations(event_id, updated_at);
