CREATE TABLE `email_identities` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`verified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_identities_user_id_unique` ON `email_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `email_login_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_login_codes_email_purpose` ON `email_login_codes` (`email`,`purpose`);