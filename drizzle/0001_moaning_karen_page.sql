CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'blue' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_projects_user_name` ON `projects` (`user_id`,`name`);
--> statement-breakpoint
CREATE TABLE `__new_study_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`study_date` text NOT NULL,
	`subject` text NOT NULL,
	`project_id` integer,
	`intensity_score` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_study_records` (`id`, `user_id`, `study_date`, `subject`, `project_id`, `intensity_score`, `note`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `study_date`, `subject`, NULL,
	CASE
		WHEN `duration_minutes` <= 30 THEN 1
		WHEN `duration_minutes` <= 60 THEN 2
		WHEN `duration_minutes` <= 90 THEN 3
		WHEN `duration_minutes` <= 120 THEN 4
		ELSE 5
	END,
	`note`, `created_at`, `updated_at`
FROM `study_records`;
--> statement-breakpoint
DROP TABLE `study_records`;
--> statement-breakpoint
ALTER TABLE `__new_study_records` RENAME TO `study_records`;
--> statement-breakpoint
CREATE INDEX `idx_study_records_user_date` ON `study_records` (`user_id`,`study_date`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_study_records_user_project` ON `study_records` (`user_id`,`project_id`);
--> statement-breakpoint
PRAGMA optimize;
