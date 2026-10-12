CREATE TABLE `project_dependencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`from_project_id` integer NOT NULL,
	`to_project_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`from_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_dependencies_edge` ON `project_dependencies` (`user_id`,`from_project_id`,`to_project_id`);--> statement-breakpoint
CREATE INDEX `idx_project_dependencies_target` ON `project_dependencies` (`user_id`,`to_project_id`);