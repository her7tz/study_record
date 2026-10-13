ALTER TABLE `project_experiments` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `study_records` ADD `record_type` text DEFAULT 'learning' NOT NULL;