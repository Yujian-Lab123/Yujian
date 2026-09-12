CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "retrieval_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"source_hash" text DEFAULT '' NOT NULL,
	"space_id" text NOT NULL,
	"model" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retrieval_embeddings_kind_check" CHECK (
		"kind" IN ('profile_long_term', 'profile_value', 'profile_conversation', 'profile_current', 'content')
	)
);
--> statement-breakpoint
ALTER TABLE "retrieval_embeddings" ADD CONSTRAINT "retrieval_embeddings_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "retrieval_embeddings_owner_kind_uidx"
ON "retrieval_embeddings" USING btree ("user_id", "kind", "source_id");
--> statement-breakpoint
CREATE INDEX "retrieval_embeddings_space_kind_idx"
ON "retrieval_embeddings" USING btree ("space_id", "kind", "user_id");
--> statement-breakpoint
CREATE INDEX "retrieval_embeddings_embedding_hnsw_idx"
ON "retrieval_embeddings" USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
