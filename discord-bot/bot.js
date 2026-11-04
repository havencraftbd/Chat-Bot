// HavenCraft chatbot — Discord test bot.
// Brain: ../brain.js (একটাই brain — HTML test আর এই bot দুইজনেই ওটা ব্যবহার করে)।
// চালানো: npm install → .env বানাও (.env.example দেখো) → node bot.js
//
// আচরণ:
// - Bot শুধু তখনই reply দেয় যখন কেউ তাকে mention করে — তাই test server-এ spam হবে না।
// - Model উত্তর না জানলে DON'T_KNOW signal দেয় → bot graceful message পাঠায় +
//   staff role-কে mention করে (প্রশ্নসহ, যাতে staff বোঝে কী জানতে চাওয়া হয়েছিল)।
// - Staff `@Haven off` / `@Haven on` দিয়ে bot off/on করতে পারে (শুধু staff role / Admin)।
//   Off থাকলে bot চুপ থাকে, শুধু `on` command শোনে। Off/on state memory-তে থাকে —
//   bot restart হলে আবার ON হয়ে যাবে (test-এর জন্য এটাই ঠিক)।

require("dotenv").config();
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const { BRAIN, buildSystemPrompt, FALLBACK, detectLanguage } = require("../brain.js");

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || ""; // test server-এর staff role-এর ID (.env-এ বসাও)
const COOLDOWN_MS = 15 * 1000; // একই user-এর দুই message-এর মাঝে কমপক্ষে 15 সেকেন্ড
const MENTION_COOLDOWN_MS = 5 * 60 * 1000; // একই channel-এ staff mention-এর মাঝে কমপক্ষে 5 মিনিট (spam ঠেকাতে)

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

// Staff কিনা: STAFF_ROLE_ID থাকলে ওই role, নইলে Administrator permission।
function isStaff(member) {
  if (!member) return false;
  if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) return true;
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag} | brain version: ${BRAIN.version}`);
  if (!STAFF_ROLE_ID) console.log("WARNING: STAFF_ROLE_ID বসানো নেই — fallback-এ staff mention হবে না।");
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return; // অন্য bot-এর message ignore
    if (!message.guild) return; // DM-এ reply না
    if (!message.mentions.has(client.user)) return; // শুধু mention-এ reply

    const question = message.content.replace(/<@!?\d+>/g, "").trim();
    const lower = question.toLowerCase();

    // --- On/off toggle (শুধু staff) ---
    if (lower === "off" || lower === "on") {
      if (!isStaff(message.member)) {
        await message.reply("শুধু staff-রা bot off/on করতে পারে।");
        return;
      }
      if (lower === "off") {
        botEnabled = false;
        await message.reply("Bot off করা হয়েছে — এখন থেকে staff reply দেবে। আবার on করতে `@Haven on` লিখো।");
      } else {
        botEnabled = true;
        await message.reply("Bot আবার on।");
      }
      return;
    }

    if (!botEnabled) return; // off থাকলে চুপচাপ ignore (শুধু `on` শোনে, ওটা উপরে handle হয়েছে)
    if (!question) {
      await message.reply(
        "আমাকে mention করে প্রশ্ন করো — server join, rank, shop, command নিয়ে। যেমন: `@Haven Java IP কী?`"
      );
      return;
    }

    const now = Date.now();
    const last = lastMsgAt.get(message.author.id) || 0;
    if (now - last < COOLDOWN_MS) return; // cooldown-এর মধ্যে থাকলে চুপচাপ ignore
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
      await message.reply("এখন উত্তর দিতে পারছি না, একটু পরে আবার try করো।");
      return;
    }
    const raw = (data.choices[0].message.content || "").trim();

    // --- AI পারে না → graceful message + staff mention ---
    if (raw === "DON'T_KNOW") {
      let reply = FALLBACK[detectLanguage(question)];
      const lastMention = lastMentionAt.get(message.channel.id) || 0;
      if (STAFF_ROLE_ID && now - lastMention >= MENTION_COOLDOWN_MS) {
        lastMentionAt.set(message.channel.id, now);
        reply += `\n\n<@&${STAFF_ROLE_ID}> একজন visitor-এর প্রশ্নের উত্তর আমার কাছে নেই: "${question}" — দয়া করে দেখুন।`;
      } else if (STAFF_ROLE_ID) {
        reply += `\n\n(Staff-দের আগেই জানানো হয়েছে — 5 মিনিটের মধ্যে আবার mention হবে না।)`;
      } else {
        console.log("DON'T_KNOW (mention skipped, STAFF_ROLE_ID নেই):", question);
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
