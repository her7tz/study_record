CREATE TABLE `study_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`study_date` text NOT NULL,
	`subject` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_study_records_user_date` ON `study_records` (`user_id`,`study_date`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
