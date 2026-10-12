ALTER TABLE `email_login_codes` ADD `window_started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `email_login_codes` ADD `send_count` integer DEFAULT 0 NOT NULL;