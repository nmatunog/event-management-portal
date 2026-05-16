CREATE TABLE IF NOT EXISTS event_feedback (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  registration_id TEXT,
  respondent_email TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  highlights TEXT,
  suggestions TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_feedback_event_email ON event_feedback(event_id, respondent_email);
CREATE INDEX IF NOT EXISTS idx_event_feedback_event ON event_feedback(event_id);
