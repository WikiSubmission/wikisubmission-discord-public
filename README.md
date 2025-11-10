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
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

## Contact

Email: [developer@wikisubmission.org](mailto:developer@wikisubmission.org)
