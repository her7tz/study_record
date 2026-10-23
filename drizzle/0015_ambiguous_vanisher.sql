CREATE TABLE `agent_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`client_name` text NOT NULL,
	`user_id` text,
	`request_ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`request_expires_at` integer NOT NULL,
	`authorized_at` integer,
	`expires_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_agent_authorizations_token` ON `agent_authorizations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_agent_authorizations_user` ON `agent_authorizations` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_authorizations_rate` ON `agent_authorizations` (`request_ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_authorizations_created` ON `agent_authorizations` (`created_at`);