-- Unify machines into exercises: every exercise gets a `type` field
-- ("machine" | "free-weight" | "bodyweight") plus optional image_url and notes.

-- Add type, image_url, notes columns to exercises
ALTER TABLE exercises ADD COLUMN type TEXT NOT NULL DEFAULT 'free-weight';
ALTER TABLE exercises ADD COLUMN image_url TEXT;
ALTER TABLE exercises ADD COLUMN notes TEXT;

-- Migrate all existing machines into exercises (same IDs so machine_logs.machineId
-- continues to resolve against the exercises table too).
INSERT OR IGNORE INTO exercises (
  id, user_id, name, category, muscle_group, equipment, instructions,
  is_public, type, image_url, notes, created_at, updated_at
)
SELECT
  id, user_id, name, 'strength', muscle_group, NULL, NULL,
  0, 'machine', image_url, notes, created_at, updated_at
FROM machines;

-- Index the new type column for the machines-as-exercises query path.
CREATE INDEX IF NOT EXISTS `exercises_type_idx` ON `exercises` (`type`);