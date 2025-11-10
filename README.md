# WikiSubmission Discord Bot

Public Discord bot for WikiSubmission.

## Add To Server

[Add the bot to your server](https://discord.com/oauth2/authorize?client_id=978658099474890793&permissions=274877962240&integration_type=0&scope=bot)

## Developer Setup

Clone the repository, then install dependencies using `npm run install`. Finally, start the bot with `npm run start`.

For general use, define the following variables inside a .env file at the root directory of the project:

- `BOT_TOKEN`
- `BOT_CLIENT_ID`

For WikiSubmission, use the following variables:

- `NODE_ENV` ("development" or "production")
- `DISCORD_TOKEN_WIKISUBMISSION_DEVELOPMENT` (dev bot token)
- `DISCORD_CLIENTID_WIKISUBMISSION_DEVELOPMENT` (dev bot client ID)
- `DISCORD_TOKEN_WIKISUBMISSION` (production bot token)
- `DISCORD_CLIENTID_WIKISUBMISSION` (production bot client ID)

Certain commands produce paginated data. We store in those interactions in Supabase to allow pagination. Provide the following:

- `SUPABASE_URL` *(supabase URL)
- `SUPABASE_ANON_KEY` *(supabase anon API key)

This is the expected configuration in Supabase. Run this query to prepare a new project:

```sql
-- 1. Create the internal schema if it does not exist
CREATE SCHEMA IF NOT EXISTS internal AUTHORIZATION postgres;

-- 2. Create the table inside the internal schema
CREATE TABLE IF NOT EXISTS internal.ws_discord_cache (
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp without time zone NULL DEFAULT now(),
  CONSTRAINT ws_discord_cache_pkey PRIMARY KEY (key)
) TABLESPACE pg_default;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE internal.ws_discord_cache ENABLE ROW LEVEL SECURITY;

-- 4. Allow read access for all users (anon, authenticated, service_role)
CREATE POLICY "Allow public read access"
  ON internal.ws_discord_cache
  FOR SELECT
  USING (true);

-- 5. Allow insert access for all users (you can later tighten this)
CREATE POLICY "Allow public insert access"
  ON internal.ws_discord_cache
  FOR INSERT
  WITH CHECK (true);

-- 6. Enforce RLS for all users, including service roles
ALTER TABLE internal.ws_discord_cache FORCE ROW LEVEL SECURITY;

-- 7. Grant usage and privileges to roles Supabase uses
GRANT USAGE ON SCHEMA internal TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE internal.ws_discord_cache TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE internal.ws_discord_cache TO anon, authenticated;
```

Without any Supabase credentials, paginated results will be temporarily stored in-memory for 1 hour on the server it is running in.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

## Contact

Email: [developer@wikisubmission.org](mailto:developer@wikisubmission.org)