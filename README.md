# World Cup Telegram Bot

A Telegram bot for tracking a 2026 FIFA World Cup fantasy/prediction league. Pulls live standings, fixtures, and leaderboard data from a connected Google Sheet and serves it to users through Telegram inline menus.

## Features

- `/menu` — inline keyboard with Standings, Fixtures, and Leaderboard
- **Standings** — group-by-group tables (or all 12 groups at once), sorted by points
- **Fixtures** — upcoming matches in the next 24 hours, pulled live from the sheet
- **Leaderboard** — overall player rankings by points

## Tech stack

- Node.js + [Express](https://expressjs.com/) (keep-alive web server for hosting platforms that expect an open port)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Google Sheets API](https://developers.google.com/sheets/api) via `googleapis`

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Create a Google Cloud service account with **read-only** access to the Sheets API, download its key, and save it as `credentials.json` in the project root. **This file is gitignored — never commit it.**

4. Share your Google Sheet with the service account's email address (found in `credentials.json`) so it can read the data.

5. Run the bot:
   ```bash
   node index.js
   ```

## Sheet structure

The bot expects three tabs in the connected spreadsheet:

| Tab | Purpose | Range used |
|---|---|---|
| `GRP Stage` | Group standings | 12 fixed ranges, one per group (A–L) |
| `forcalc` | Fixture list | `B2:J90` |
| `Leaderboard` | Overall rankings | `A17:C21` |

## Notes

- Fixture timestamps are parsed assuming `Asia/Singapore` local time.
- The bot uses long polling (`polling: true`), so only one instance should run against a given bot token at a time.
