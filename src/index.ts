import dotenv from "dotenv";
import http from "http";
import { Bot } from "./bot/client";

(async () => {
    // [Environment]
    dotenv.config();
    console.log(
        `NODE_ENV: ${process.env.NODE_ENV || 'development (default)'}`,
    );

    if (process.env.BOT_TOKEN && process.env.BOT_CLIENT_ID) {
        console.log(`Environment variables loaded (using token/client ID from .env)\n`)
    } else if ((process.env.DISCORD_TOKEN_WIKISUBMISSION && process.env.DISCORD_CLIENTID_WIKISUBMISSION) || (process.env.DISCORD_TOKEN_WIKISUBMISSION && process.env.DISCORD_CLIENTID_WIKISUBMISSION)) {
        console.log(`Environment variables loaded (using WikiSubmission ${process.env.NODE_ENV === 'production' ? 'production' : 'development'} credentials)\n`)
    } else {
        console.error(
            `Missing environment variables (BOT_TOKEN, BOT_CLIENT_ID) or (DISCORD_TOKEN_WIKISUBMISSION, DISCORD_CLIENTID_WIKISUBMISSION)`,
        );
        process.exit(1);
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.warn(`No Supabase credentials found. Pagination will use local cache only.`);
    }

    // [Server]
    const server = http.createServer((req, res) => {
        if (req.url === "/" || req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        }
    });

    server.listen(Number(process.env.PORT) || 8080);

    // [Bot]
    await Bot.instance.start();
})();