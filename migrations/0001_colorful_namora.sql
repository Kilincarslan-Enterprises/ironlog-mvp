CREATE TABLE `machine_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`machine_id` text NOT NULL,
	`user_id` text NOT NULL,
	`weight` real NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`reps` integer,
	`sets` integer DEFAULT 1,
	`logged_at` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `machine_logs_machine_id_idx` ON `machine_logs` (`machine_id`);--> statement-breakpoint
CREATE INDEX `machine_logs_user_id_idx` ON `machine_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `machine_logs_logged_at_idx` ON `machine_logs` (`logged_at`);--> statement-breakpoint
CREATE TABLE `machines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`muscle_group` text,
	`image_url` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `machines_user_id_idx` ON `machines` (`user_id`);--> statement-breakpoint
CREATE INDEX `machines_muscle_group_idx` ON `machines` (`muscle_group`);--> statement-breakpoint
CREATE TABLE `schedule_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`plan_id` text,
	`label` text NOT NULL,
	`override_date` text,
	`override_label` text,
	`override_plan_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`override_plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `schedule_templates_user_id_idx` ON `schedule_templates` (`user_id`);--> statement-breakpoint
CREATE INDEX `schedule_templates_day_idx` ON `schedule_templates` (`day_of_week`);--> statement-breakpoint
CREATE INDEX `schedule_templates_override_date_idx` ON `schedule_templates` (`override_date`);