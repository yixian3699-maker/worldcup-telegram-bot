// const { google } = require("googleapis");
// const auth = new google.auth.GoogleAuth({
//   keyFile: "credentials.json",
//   scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
// });
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Bot is alive");
});

require("dotenv").config();

const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

const sheets = google.sheets({ version: "v4", auth });

const spreadsheetId = "14V7BO9Hrox4Gwk3CmJQuhcCwdh6OA9zMT6wKsoCa-Go";

const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log('Bot is running!');

const menu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "📊 Standings", callback_data: "standings" }],
            [{ text: "📅 Fixtures", callback_data: "fixtures" }],
            [{ text: "🏆 Leaderboard", callback_data: "leaderboard" }]
        ]
    }
};

bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id, "2026 FIFA WORLD CUP BOT\nChoose an option:", menu);
});

bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    await bot.answerCallbackQuery(query.id);

    if (data === "standings") {
        return bot.sendMessage(chatId, "Choose a group:", groupKeyboard);
    }

    switch (data) {
        case "fixtures":
            return sendFixtures(chatId);

        case "leaderboard":
            return sendLeaderboard(chatId);
    }
});

bot.onText(/\/start/, (msg) => {
    bot.onText(/\/help/, (msg) => {
        bot.sendMessage(
            msg.chat.id,
            `Commands you can use:

/start - start bot
/help - list commands
/menu - show options (standings, fixtures, leaderboard)`
        );
    });
});

const groupKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "A", callback_data: "GROUP_A" },
                { text: "B", callback_data: "GROUP_B" },
                { text: "C", callback_data: "GROUP_C" }
            ],
            [
                { text: "D", callback_data: "GROUP_D" },
                { text: "E", callback_data: "GROUP_E" },
                { text: "F", callback_data: "GROUP_F" }
            ],
            [
                { text: "G", callback_data: "GROUP_G" },
                { text: "H", callback_data: "GROUP_H" },
                { text: "I", callback_data: "GROUP_I" }
            ],
            [
                { text: "J", callback_data: "GROUP_J" },
                { text: "K", callback_data: "GROUP_K" },
                { text: "L", callback_data: "GROUP_L" }
            ],
            [
                { text: "📊 ALL GROUPS", callback_data: "ALL_GROUPS" }
            ]
        ]
    }
};

bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    const data = query.data;

    if (!chatId || !data) return;

    try {
        if (data === "ALL_GROUPS") {
            for (const group of Object.keys(GROUP_RANGES)) {
                await sendStandings(chatId, group);
            }
        }

        else if (data.startsWith("GROUP_")) {
            const group = data.replace("GROUP_", "").trim();

            if (!GROUP_RANGES[group]) {
                throw new Error(`Invalid group: ${group}`);
            }

            await sendStandings(chatId, group);
        }

        await bot.answerCallbackQuery(query.id);
    } catch (err) {
        console.error(err);
        await bot.sendMessage(chatId, "Something went wrong with standings.");
    }
});

GROUP_RANGES = {
    A: "A1:E6",
    B: "G1:K6",
    C: "M1:Q6",
    D: "A9:E14",
    E: "G9:K14",
    F: "M9:Q14",
    G: "A17:E22",
    H: "G17:K22",
    I: "M17:Q22",
    J: "A25:E30",
    K: "G25:K30",
    L: "M25:Q30"
};

const GROUPS = Object.keys(GROUP_RANGES);

async function getStandings(group) {
    if (!group) {
        throw new Error("getStandings called without group");
    }

    const range = GROUP_RANGES[group];

    if (!range) {
        throw new Error(`Invalid group: ${group}`);
    }

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: "14V7BO9Hrox4Gwk3CmJQuhcCwdh6OA9zMT6wKsoCa-Go",
        range: `GRP Stage!${range}`
    });

    return res.data.values || [];
}

async function sendStandings(chatId, group) {
    const rows = await getStandings(group);

    let msg = `📊 GROUP ${group} STANDINGS\n\n`;

    for (let i = 1; i < rows.length; i++) {
        const [team, owner, pts, gd, rank] = rows[i];

        msg += `${rank} | ${team} | ${owner} | ${pts} | (${gd})\n`;
    }

    bot.sendMessage(chatId, msg);
}

//Fixtures logic

const FIXTURES_RANGE = "forcalc!B2:J90";

async function getFixturesRaw() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: "14V7BO9Hrox4Gwk3CmJQuhcCwdh6OA9zMT6wKsoCa-Go",
        range: FIXTURES_RANGE
    });

    return res.data.values || [];
}

function parseFixtures(rows) {
    const fixtures = [];

    for (const row of rows) {
        const [
            kickoff,
            group,
            homeTeam,
            homeOwner,
            score,
            _spacer,
            awayTeam,
            awayOwner
        ] = row;

        // skip empty rows
        if (!kickoff || !homeTeam || !awayTeam) continue;

        fixtures.push({
            datetime: kickoff,
            group,
            teamA: homeTeam,
            ownerA: homeOwner,
            teamB: awayTeam,
            ownerB: awayOwner
        });
    }
    console.log(rows[0]);
    return fixtures;
}

function parseDate(str) {
    const clean = String(str)
        .replace(/\u00A0/g, " ")   // fix non-breaking spaces
        .replace(/\s+/g, " ")      // collapse all spaces
        .trim();

    const parts = clean.split(" ");

    if (parts.length < 2) {
        console.log("BAD FORMAT:", str);
        return new Date(NaN);
    }

    const [datePart, timePart] = parts;

    const [yy, mm, dd] = datePart.split("-").map(Number);
    const [hh, min] = timePart.split(":").map(Number);

    const date = new Date(2000 + yy, mm - 1, dd, hh, min);

    return date;
}

function getUpcomingFixtures(fixtures) {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    console.log("DEBUG NOW:", now);

    return fixtures.filter(f => {
        const d = parseDate(f.datetime);

        console.log("RAW:", f.datetime, "PARSED:", d);

        return !isNaN(d) && d >= now && d <= next24h;
    });
}

function formatFixtures(fixtures) {
    let output = "📅 Upcoming Fixtures\n\n";

    for (const f of fixtures) {
        output += `${f.datetime} | Group ${f.group}\n`;
        output += `${f.teamA} vs ${f.teamB}\n`;
        output += `Owners: ${f.ownerA} vs ${f.ownerB}\n\n`;
    }

    return output;
}

function chunkText(text, size = 3500) {
    const chunks = [];

    for (let i = 0; i < text.length; i += size) {
        chunks.push(text.slice(i, i + size));
    }

    return chunks;
}

async function sendFixtures(chatId) {
    const raw = await getFixturesRaw();
    const fixtures = parseFixtures(raw);
    const upcoming = getUpcomingFixtures(fixtures);

    // ✅ ADD THIS CHECK
    if (!upcoming || upcoming.length === 0) {
        await bot.sendMessage(chatId, "📅 No fixtures in the next 24 hours.");
        return;
    }

    const msg = formatFixtures(upcoming);

    const chunks = chunkText(msg, 3500);

    for (const c of chunks) {
        await bot.sendMessage(chatId, c);
    }
}

//leaderboard logic

async function getLeaderboard() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: "14V7BO9Hrox4Gwk3CmJQuhcCwdh6OA9zMT6wKsoCa-Go",
        range: "Leaderboard!A17:C21"
    });

    const rows = res.data.values || [];

    const leaderboard = rows
        .filter(r => r[0] && r[2])
        .map(r => ({
            name: r[0].trim(),
            points: parseFloat(r[2]) || 0
        }))
        .sort((a, b) => b.points - a.points);

    return leaderboard;
}

async function sendLeaderboard(chatId) {
    const cols = await getLeaderboard();

    let msg = "🏆 Leaderboard\n\n";

    cols.forEach((p, i) => {
        msg += `${i + 1}. ${p.name} | ${p.points} pts\n\n`;
    });

    await bot.sendMessage(chatId, msg);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});