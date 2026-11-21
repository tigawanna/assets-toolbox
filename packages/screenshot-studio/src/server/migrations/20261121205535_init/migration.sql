CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`ts` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`frame_id` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`store` text NOT NULL,
	`preset_id` text NOT NULL,
	`frame_label` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `frames` (
	`id` text PRIMARY KEY NOT NULL,
	`store` text NOT NULL,
	`preset_id` text NOT NULL,
	`label` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL
);
