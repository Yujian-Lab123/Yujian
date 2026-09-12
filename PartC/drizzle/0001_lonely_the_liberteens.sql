CREATE TABLE "service_heartbeats" (
	"name" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
