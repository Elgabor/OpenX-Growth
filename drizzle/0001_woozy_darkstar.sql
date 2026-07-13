CREATE TABLE `follower_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`followers` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `followers_account_recorded_idx` ON `follower_snapshots` (`account_id`,`recorded_at`);