CREATE TABLE `x_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`endpoint` text NOT NULL,
	`kind` text NOT NULL,
	`request_count` integer NOT NULL,
	`resource_count` integer NOT NULL,
	`write_count` integer NOT NULL,
	`status` integer NOT NULL,
	`rate_limit` integer,
	`rate_remaining` integer,
	`rate_reset_at` integer,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `x_usage_day_occurred_idx` ON `x_usage_events` (`day`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `api_usage` ADD `requests` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `api_usage` ADD `resources` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `api_usage` SET `resources` = `reads`;--> statement-breakpoint
ALTER TABLE `api_usage` ADD `reserved_resources` integer DEFAULT 0 NOT NULL;
