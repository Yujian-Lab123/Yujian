CREATE TYPE "public"."profile_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "connection_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"rec_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"pair_key" text NOT NULL,
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"shared" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question" text,
	"bridge" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content_type" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"chars" integer DEFAULT 0 NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vec" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_anchor" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "current_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"mood" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "external_identities" (
	"provider" text NOT NULL,
	"external_user_id" text NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_access_token" text,
	"token_expires_at" timestamp with time zone,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_contents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"rec_id" text NOT NULL,
	"viewer_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"user_id" text,
	"subject_name" text NOT NULL,
	"artifact" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_artifacts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profile_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"requested_by" text,
	"status" "profile_job_status" DEFAULT 'queued' NOT NULL,
	"input_file" text NOT NULL,
	"subject_name" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"message" text DEFAULT '已进入队列' NOT NULL,
	"progress" jsonb,
	"artifact_slug" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"viewer_id" text NOT NULL,
	"target_id" text NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"anchor_id" text,
	"reason" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bridge" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'fresh' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_vectors" (
	"user_id" text PRIMARY KEY NOT NULL,
	"long_term" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"value" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conversation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"zhihu_user_id" text,
	"name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"quote" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zhihu_years" integer DEFAULT 0 NOT NULL,
	"upvotes" text DEFAULT '0' NOT NULL,
	"encounter_enabled" boolean DEFAULT true NOT NULL,
	"auto_reciprocate" boolean DEFAULT false NOT NULL,
	"is_mock" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_zhihu_user_id_unique" UNIQUE("zhihu_user_id")
);
--> statement-breakpoint
ALTER TABLE "connection_intents" ADD CONSTRAINT "connection_intents_from_id_users_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_intents" ADD CONSTRAINT "connection_intents_to_id_users_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_intents" ADD CONSTRAINT "connection_intents_rec_id_recommendations_id_fk" FOREIGN KEY ("rec_id") REFERENCES "public"."recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_a_users_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_b_users_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_question_contents_id_fk" FOREIGN KEY ("question") REFERENCES "public"."contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_states" ADD CONSTRAINT "current_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_rec_id_recommendations_id_fk" FOREIGN KEY ("rec_id") REFERENCES "public"."recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_artifacts" ADD CONSTRAINT "profile_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_jobs" ADD CONSTRAINT "profile_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_anchor_id_contents_id_fk" FOREIGN KEY ("anchor_id") REFERENCES "public"."contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vectors" ADD CONSTRAINT "user_vectors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connection_intents_direction_uidx" ON "connection_intents" USING btree ("from_id","to_id");--> statement-breakpoint
CREATE INDEX "connection_intents_from_status_idx" ON "connection_intents" USING btree ("from_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_pair_key_uidx" ON "connections" USING btree ("pair_key");--> statement-breakpoint
CREATE INDEX "connections_user_a_idx" ON "connections" USING btree ("user_a");--> statement-breakpoint
CREATE INDEX "connections_user_b_idx" ON "connections" USING btree ("user_b");--> statement-breakpoint
CREATE INDEX "contents_user_published_idx" ON "contents" USING btree ("user_id","published_at");--> statement-breakpoint
CREATE INDEX "current_states_user_created_idx" ON "current_states" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_provider_user_uidx" ON "external_identities" USING btree ("provider","external_user_id");--> statement-breakpoint
CREATE INDEX "external_identities_user_idx" ON "external_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_viewer_created_idx" ON "feedback" USING btree ("viewer_id","created_at");--> statement-breakpoint
CREATE INDEX "profile_jobs_status_created_idx" ON "profile_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "recommendations_viewer_created_idx" ON "recommendations" USING btree ("viewer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_fresh_pair_uidx" ON "recommendations" USING btree ("viewer_id","target_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");