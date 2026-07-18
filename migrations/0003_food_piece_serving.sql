-- Add piece-based serving support to food_presets.
-- pieceSize = grams per piece (e.g. 53 for one egg, 500 for one pack of skyrl)
-- pieceName = label for the piece (e.g. "Ei", "Packung", "Becher")
-- When null, the preset is gram-only (default behavior).

ALTER TABLE food_presets ADD COLUMN piece_size REAL;
ALTER TABLE food_presets ADD COLUMN piece_name TEXT;