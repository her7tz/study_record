CREATE TABLE `project_experiments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`intensity_score` integer DEFAULT 3 NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_experiments_user_project` ON `project_experiments` (`user_id`,`project_id`,`deleted_at`,`status`,`sort_order`);