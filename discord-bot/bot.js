// HavenCraft chatbot — Discord test bot.
// Brain: ../brain.js (একটাই brain — HTML test আর এই bot দুইজনেই ওটা ব্যবহার করে)।
// চালানো: npm install → .env বানাও (.env.example দেখো) → node bot.js
// Bot শুধু তখনই reply দেয় যখন কেউ তাকে mention করে — তাই test server-এ spam হবে না।

require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { BRAIN, buildSystemPrompt } = require("../brain.js");

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const COOLDOWN_MS = 15 * 1000; // একই user-এর দুই message-এর মাঝে কমপক্ষে 15 সেকেন্ড
const lastMsgAt = new Map();

// Model fallback chain (120b → 20b → qwen) এখনো যোগ করা হয়নি — approval pending, পরে যোগ হবে।

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag} | brain version: ${BRAIN.version}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return; // অন্য bot-এর message ignore
    if (!message.guild) return; // DM-এ reply না
    if (!message.mentions.has(client.user)) return; // শুধু mention-এ reply

    const now = Date.now();
    const last = lastMsgAt.get(message.author.id) || 0;
    if (now - last < COOLDOWN_MS) return; // cooldown-এর মধ্যে থাকলে চুপচাপ ignore
    lastMsgAt.set(message.author.id, now);

    const question = message.content.replace(/<@!?\d+>/g, "").trim();
    if (!question) {
      await message.reply(
        "আমাকে mention করে প্রশ্ন করো — server join, rank, shop, command নিয়ে। যেমন: `@Haven Java IP কী?`"
      );
      return;
    }

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
      await message.reply("এখন উত্তর দিতে পারছি না, একটু পরে আবার try করো।");
      return;
    }
    let answer = data.choices[0].message.content || "";
    if (answer.length > 1900) answer = answer.slice(0, 1900) + "…";
    await message.reply(answer);
  } catch (err) {
    console.error("Bot error:", err);
    try {
      await message.reply("একটা সমস্যা হয়েছে, একটু পরে আবার try করো।");
    } catch (_) {}
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN নেই — .env file-এ বসাও (.env.example দেখো)।");
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.error("GROQ_API_KEY নেই — .env file-এ বসাও (.env.example দেখো)।");
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
