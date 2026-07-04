PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT, -- chest, back, legs, shoulders, arms, core, cardio
    equipment TEXT, -- barbell, dumbbell, machine, cable, bodyweight
    muscle_group TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_template_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    sets_target INTEGER DEFAULT 3,
    reps_target TEXT,
    weight_default REAL,
    rest_seconds INTEGER DEFAULT 90,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_template_id INTEGER,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    notes TEXT,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workout_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight_kg REAL,
    rpe INTEGER CHECK(rpe BETWEEN 1 AND 10),
    notes TEXT,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    scopes TEXT, -- comma-separated
    prefix TEXT,
    hashed_secret TEXT NOT NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- Seed a few default exercises
INSERT OR IGNORE INTO exercises (name, category, equipment, muscle_group) VALUES
("Bench Press", "chest", "barbell", "chest"),
("Squat", "legs", "barbell", "quads"),
("Deadlift", "back", "barbell", "posterior chain"),
("Overhead Press", "shoulders", "barbell", "shoulders"),
("Pull-Up", "back", "bodyweight", "lats"),
("Dumbbell Curl", "arms", "dumbbell", "biceps");

-- Seed a default Push template
INSERT OR IGNORE INTO workout_templates (name, description, is_active) VALUES
("Push", "Chest, shoulders, triceps", 1);

INSERT OR IGNORE INTO workout_template_exercises (workout_template_id, exercise_id, sets_target, reps_target, weight_default, order_index)
SELECT wt.id, e.id, 3, "8-12", 60.0, 1
FROM workout_templates wt, exercises e
WHERE wt.name = "Push" AND e.name = "Bench Press";

INSERT OR IGNORE INTO workout_template_exercises (workout_template_id, exercise_id, sets_target, reps_target, weight_default, order_index)
SELECT wt.id, e.id, 3, "8-12", 40.0, 2
FROM workout_templates wt, exercises e
WHERE wt.name = "Push" AND e.name = "Overhead Press";
