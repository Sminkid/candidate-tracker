ALTER TABLE "candidates" ADD CONSTRAINT "candidates_name_not_blank" CHECK ("candidates"."name" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_email_not_blank" CHECK ("candidates"."email" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_role_not_blank" CHECK ("candidates"."role" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_resume_text_not_blank" CHECK ("candidates"."resume_text" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_body_not_blank" CHECK ("notes"."body" ~ '[^[:space:]]');