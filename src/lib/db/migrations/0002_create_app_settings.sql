CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"github_token_encrypted" text,
	"deepseek_api_key_encrypted" text,
	"siliconflow_api_key_encrypted" text,
	"preference" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
