ALTER TABLE `projects` ADD `goal` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `target_date` text;