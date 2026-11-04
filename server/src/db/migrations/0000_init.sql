CREATE TYPE "public"."stage" AS ENUM('applied', 'screening', 'interview', 'offer', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."summary_status" AS ENUM('ok', 'unsummarizable', 'error');--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" text NOT NULL,
	"resume_text" text NOT NULL,
	"source" text,
	"stage" "stage" DEFAULT 'applied' NOT NULL,
	"summary" jsonb,
	"summary_status" "summary_status",
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_candidate_id_idx" ON "notes" USING btree ("candidate_id");