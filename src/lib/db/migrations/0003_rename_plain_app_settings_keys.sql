ALTER TABLE "app_settings" RENAME COLUMN "github_token_encrypted" TO "github_token";
--> statement-breakpoint
ALTER TABLE "app_settings" RENAME COLUMN "deepseek_api_key_encrypted" TO "deepseek_api_key";
--> statement-breakpoint
ALTER TABLE "app_settings" RENAME COLUMN "siliconflow_api_key_encrypted" TO "siliconflow_api_key";
