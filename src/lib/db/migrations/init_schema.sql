CREATE TABLE IF NOT EXISTS "projects" (
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
	"readme_hash" varchar(64),
	"readme_summary" varchar(300),
	"match_reason" text NOT NULL,
	"maturity" text NOT NULL,
	"collection_job_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_repository_id_unique" ON "projects" USING btree ("repository_id");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_full_name_unique" ON "projects" USING btree ("full_name");
CREATE INDEX IF NOT EXISTS "projects_name_index" ON "projects" USING btree ("name");
CREATE INDEX IF NOT EXISTS "projects_source_github_username_index" ON "projects" USING btree ("source_github_username");

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "readme_hash" varchar(64);
ALTER TABLE "projects" ALTER COLUMN "readme_summary" TYPE varchar(300);

CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"github_token" text,
	"deepseek_api_key" text,
	"siliconflow_api_key" text,
	"preference" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
