CREATE TABLE IF NOT EXISTS speaker_material_uploads (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT 'presentation.pdf',
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_data TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_speaker_material_uploads_event ON speaker_material_uploads(event_id);
