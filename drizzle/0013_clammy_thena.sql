CREATE TABLE `__new_point_redemptions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `reward_name` text NOT NULL,
  `points` integer NOT NULL,
  `deleted_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_point_redemptions` (`id`, `user_id`, `reward_name`, `points`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `reward_name`, `points`, `created_at`, `created_at` FROM `point_redemptions`;
--> statement-breakpoint
DROP TABLE `point_redemptions`;
--> statement-breakpoint
ALTER TABLE `__new_point_redemptions` RENAME TO `point_redemptions`;
--> statement-breakpoint
CREATE INDEX `idx_point_redemptions_user_created` ON `point_redemptions` (`user_id`, `created_at`);
