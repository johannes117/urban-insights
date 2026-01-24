CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"table_name" text NOT NULL,
	"columns" jsonb NOT NULL,
	"row_count" text DEFAULT '0' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "datasets_table_name_unique" UNIQUE("table_name")
);
