CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text NOT NULL,
	"source_url" text NOT NULL,
	"language" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"issues" integer DEFAULT 0 NOT NULL,
	"license" text,
	"is_fork" boolean DEFAULT false NOT NULL,
	"source_repository_full_name" text,
	"source_repository_url" text,
	"source_github_username" text NOT NULL,
	"star_at" timestamp with time zone NOT NULL,
	"pushed_at" timestamp with time zone,
	"github_updated_at" timestamp with time zone NOT NULL,
	"readme_content" text,
	"readme_summary" text,
	"match_reason" text NOT NULL,
	"maturity" text NOT NULL,
	"collection_job_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_repository_id_unique" ON "projects" USING btree ("repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_full_name_unique" ON "projects" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "projects_name_index" ON "projects" USING btree ("name");--> statement-breakpoint
CREATE INDEX "projects_source_github_username_index" ON "projects" USING btree ("source_github_username");