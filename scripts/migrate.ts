import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log('Running migration...')

  // Create users table
  await sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "google_id" text NOT NULL UNIQUE,
      "email" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "avatar_url" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `
  console.log('Created users table')

  // Create sessions table
  await sql`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `
  console.log('Created sessions table')

  // Create chat_sessions table
  await sql`
    CREATE TABLE IF NOT EXISTS "chat_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "title" text NOT NULL,
      "selected_lga" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `
  console.log('Created chat_sessions table')

  // Create messages table
  await sql`
    CREATE TABLE IF NOT EXISTS "messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "chat_session_id" uuid NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
      "role" text NOT NULL,
      "content" text NOT NULL,
      "ui" jsonb,
      "tool_call" jsonb,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `
  console.log('Created messages table')

  console.log('Migration complete!')
}

migrate().catch(console.error)
