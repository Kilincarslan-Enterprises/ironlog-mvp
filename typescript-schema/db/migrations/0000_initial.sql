-- IronLog D1 initial schema migration
-- Generated for Drizzle ORM on Cloudflare D1 (SQLite)

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`unit_system` text DEFAULT 'metric' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`target_value` real NOT NULL,
	`unit` text,
	`period` text DEFAULT 'daily' NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`serving_size` real DEFAULT 100 NOT NULL,
	`serving_unit` text DEFAULT 'g' NOT NULL,
	`calories_per_serving` real NOT NULL,
	`protein_per_serving` real DEFAULT 0 NOT NULL,
	`carbs_per_serving` real DEFAULT 0 NOT NULL,
	`fat_per_serving` real DEFAULT 0 NOT NULL,
	`fiber_per_serving` real DEFAULT 0 NOT NULL,
	`sugar_per_serving` real DEFAULT 0 NOT NULL,
	`sodium_per_serving` real DEFAULT 0 NOT NULL,
	`is_verified` integer DEFAULT 0 NOT NULL,
	`source` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meal_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`items` text NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`meal_type` text NOT NULL,
	`food_id` text,
	`preset_id` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`quantity_unit` text DEFAULT 'serving' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`preset_id`) REFERENCES `meal_presets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`muscle_group` text,
	`equipment` text,
	`instructions` text,
	`video_url` text,
	`is_verified` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`frequency_days` integer,
	`difficulty` text,
	`is_public` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_plan_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`day_index` integer DEFAULT 1 NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`default_sets` integer DEFAULT 3,
	`default_reps` integer,
	`default_weight_kg` real,
	`default_duration_sec` integer,
	`rest_sec` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text,
	`name` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_sec` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `workout_session_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`session_exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`duration_sec` integer,
	`distance_m` real,
	`rpe` integer,
	`is_failure` integer DEFAULT 0 NOT NULL,
	`is_warmup` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `workout_session_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `supplements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text DEFAULT 'g' NOT NULL,
	`default_dose` real,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `supplement_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`supplement_id` text NOT NULL,
	`date` integer NOT NULL,
	`dose` real NOT NULL,
	`taken_at` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`body_fat_percent` real,
	`muscle_mass_kg` real,
	`water_percent` real,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`last_used_at` integer,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_api_tokens_token_hash_unique` ON `agent_api_tokens` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`data` text,
	`read_at` integer,
	`sent_at` integer,
	`channel` text DEFAULT 'in_app' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);
--> statement-breakpoint
CREATE INDEX `goals_user_id_idx` ON `goals` (`user_id`);
--> statement-breakpoint
CREATE INDEX `foods_owner_id_idx` ON `foods` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);
--> statement-breakpoint
CREATE INDEX `foods_barcode_idx` ON `foods` (`barcode`);
--> statement-breakpoint
CREATE INDEX `meal_presets_owner_id_idx` ON `meal_presets` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `meals_user_id_date_idx` ON `meals` (`user_id`, `date`);
--> statement-breakpoint
CREATE INDEX `meals_food_id_idx` ON `meals` (`food_id`);
--> statement-breakpoint
CREATE INDEX `meals_preset_id_idx` ON `meals` (`preset_id`);
--> statement-breakpoint
CREATE INDEX `exercises_owner_id_idx` ON `exercises` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `exercises_name_idx` ON `exercises` (`name`);
--> statement-breakpoint
CREATE INDEX `workout_plans_owner_id_idx` ON `workout_plans` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `wpe_plan_id_idx` ON `workout_plan_exercises` (`plan_id`);
--> statement-breakpoint
CREATE INDEX `wpe_exercise_id_idx` ON `workout_plan_exercises` (`exercise_id`);
--> statement-breakpoint
CREATE INDEX `wpe_plan_day_idx` ON `workout_plan_exercises` (`plan_id`, `day_index`);
--> statement-breakpoint
CREATE INDEX `workout_sessions_user_id_idx` ON `workout_sessions` (`user_id`, `started_at`);
--> statement-breakpoint
CREATE INDEX `wse_session_id_idx` ON `workout_session_exercises` (`session_id`);
--> statement-breakpoint
CREATE INDEX `wse_exercise_id_idx` ON `workout_session_exercises` (`exercise_id`);
--> statement-breakpoint
CREATE INDEX `workout_sets_session_exercise_id_idx` ON `workout_sets` (`session_exercise_id`);
--> statement-breakpoint
CREATE INDEX `supplements_owner_id_idx` ON `supplements` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `supplements_name_idx` ON `supplements` (`name`);
--> statement-breakpoint
CREATE INDEX `supplement_logs_user_id_date_idx` ON `supplement_logs` (`user_id`, `date`);
--> statement-breakpoint
CREATE INDEX `weight_entries_user_id_recorded_at_idx` ON `weight_entries` (`user_id`, `recorded_at`);
--> statement-breakpoint
CREATE INDEX `agent_api_tokens_user_id_idx` ON `agent_api_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX `notifications_user_id_read_at_idx` ON `notifications` (`user_id`, `read_at`);
