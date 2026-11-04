// HavenCraft chatbot — Discord test bot.
// Brain: ../brain.js (one brain — the HTML test and this bot both use it).
// Run: npm install → create .env (see .env.example) → node bot.js
//
// Behavior:
// - The bot only replies when someone mentions it — so no spam on the test server.
// - When the model doesn't know an answer, it sends a DON'T_KNOW signal → the bot sends
//   a graceful message + mentions the staff role (with the question quoted, so staff
//   understand what was asked).
// - Staff can turn the bot off/on with `@Haven off` / `@Haven on` (staff role / Admin only).
//   While off, the bot stays silent and only listens for the `on` command. The off/on state
//   lives in memory — a bot restart turns it back ON (fine for testing).

require("dotenv").config();
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const { BRAIN, buildSystemPrompt, FALLBACK, detectLanguage } = require("../brain.js");

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || ""; // staff role ID of the test server (set in .env)
const COOLDOWN_MS = 15 * 1000; // at least 15 seconds between two messages from the same user
const MENTION_COOLDOWN_MS = 5 * 60 * 1000; // at least 5 minutes between staff mentions in the same channel (anti-spam)

const lastMsgAt = new Map();
const lastMentionAt = new Map();
let botEnabled = true;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Staff check: the STAFF_ROLE_ID role if set, otherwise Administrator permission.
function isStaff(member) {
  if (!member) return false;
  if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) return true;
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag} | brain version: ${BRAIN.version}`);
  if (!STAFF_ROLE_ID) console.log("WARNING: STAFF_ROLE_ID is not set — no staff mention on fallback.");
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return; // ignore other bots' messages
    if (!message.guild) return; // no replies in DMs
    if (!message.mentions.has(client.user)) return; // only reply on mention

    const question = message.content.replace(/<@!?\d+>/g, "").trim();
    const lower = question.toLowerCase();

    // --- On/off toggle (staff only) ---
    if (lower === "off" || lower === "on") {
      if (!isStaff(message.member)) {
        await message.reply("Only staff can turn the bot off/on.");
        return;
      }
      if (lower === "off") {
        botEnabled = false;
        await message.reply("Bot turned off — staff will reply from now on. To turn it back on, type `@Haven on`.");
      } else {
        botEnabled = true;
        await message.reply("Bot is back on.");
      }
      return;
    }

    if (!botEnabled) return; // while off, silently ignore (only `on` is listened to, handled above)
    if (!question) {
      await message.reply(
        "Mention me and ask your question — about server join, ranks, shop, or commands. For example: `@Haven What is the Java IP?`"
      );
      return;
    }

    const now = Date.now();
    const last = lastMsgAt.get(message.author.id) || 0;
    if (now - last < COOLDOWN_MS) return; // silently ignore within cooldown
    lastMsgAt.set(message.author.id, now);

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: question },
        ],
        temperature: 0.3,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Groq error:", res.status, data.error && data.error.message);
      await message.reply("Can't answer right now, please try again later.");
      return;
    }
    const raw = (data.choices[0].message.content || "").trim();

    // --- AI doesn't know → graceful message + staff mention ---
    if (raw === "DON'T_KNOW") {
      let reply = FALLBACK[detectLanguage(question)];
      const lastMention = lastMentionAt.get(message.channel.id) || 0;
      if (STAFF_ROLE_ID && now - lastMention >= MENTION_COOLDOWN_MS) {
        lastMentionAt.set(message.channel.id, now);
        reply += `\n\n<@&${STAFF_ROLE_ID}> I don't have an answer for a visitor's question: "${question}" — please take a look.`;
      } else if (STAFF_ROLE_ID) {
        reply += `\n\n(Staff have already been notified — no mention again within 5 minutes.)`;
      } else {
        console.log("DON'T_KNOW (mention skipped, STAFF_ROLE_ID not set):", question);
      }
      await message.reply(reply);
      return;
    }

    let answer = raw;
    if (answer.length > 1900) answer = answer.slice(0, 1900) + "…";
    await message.reply(answer);
  } catch (err) {
    console.error("Bot error:", err);
    try {
      await message.reply("Something went wrong, please try again later.");
    } catch (_) {}
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is missing — set it in the .env file (see .env.example).");
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.error("GROQ_API_KEY is missing — set it in the .env file (see .env.example).");
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
