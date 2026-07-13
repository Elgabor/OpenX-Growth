CREATE TABLE `publish_events` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`event_type` text NOT NULL,
	`part_index` integer,
	`provider_status` integer,
	`detail_code` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `publish_events_post_occurred_idx` ON `publish_events` (`post_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `posts` ADD `publish_receipts_json` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `claim_token` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `claim_expires_at` integer;--> statement-breakpoint
ALTER TABLE `posts` ADD `delivery_state` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
UPDATE `posts` SET `status` = 'needs_review', `delivery_state` = 'ambiguous', `last_error` = 'PUBLISH_NEEDS_REVIEW' WHERE `status` = 'publishing';
