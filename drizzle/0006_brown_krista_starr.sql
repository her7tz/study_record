DROP INDEX `idx_projects_user_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_projects_user_name` ON `projects` (`user_id`,`name`) WHERE "projects"."deleted_at" IS NULL;