# HavenCraft Chatbot — Test Setup

AI chatbot-এর test setup: একটাই brain, দুইটা test surface।

## Files

- `brain.js` — **bot-এর জ্ঞান। শুধু এই file-ই edit করবে।** Section: system prompt, server info, ranks, rank কেনার নিয়ম, player commands, shop, rules, support।
- `chat-test.html` — Browser test। `brain.js` + `config.js` load করে — chat UI-তে key/model-এর কোনো option নেই, visitor-রা Groq/test-এর কিছু দেখবে না।
- `config.example.js` — config-এর template (key খালি)। এটা repo-তে থাকে।
- `discord-bot/bot.js` — Discord test bot। `brain.js` load করে, mention-এ reply দেয়।
- `discord-bot/package.json`, `discord-bot/.env.example` — bot চালানোর জন্য।

## Config (config.js)

- `config.example.js` হলো template — এটা repo-তে থাকে, key খালি।
- `config.example.js`-এর copy বানিয়ে `config.js` নামে রাখো, তাতে key বসাও।
- `config.js` কখনো repo-তে push করো না — আমার push-এও `config.js` থাকে না, তাই তোমার বসানো key মুছবে না।
- `config.js` না থাকলে chat generic error দেখাবে, crash করবে না।

## HTML test কীভাবে

1. `config.example.js`-এর copy `config.js` নামে রাখো, তাতে key বসাও (তোমার নিজের copy-তে)।
2. `chat-test.html` double-click করে browser-এ খোলো (পাশে `brain.js` থাকতে হবে)।
3. নিজে প্রশ্ন লিখে test করো — "নিয়ম কী?" দিয়ে জানি না test-ও করো।

## Discord bot কীভাবে (laptop-এ, temp test)

1. [Discord Developer Portal](https://discord.com/developers/applications)-এ application + bot বানাও, token নাও।
2. OAuth2 → URL Generator → scope `bot` → permission: View Channel, Send Messages, Read Message History → URL দিয়ে bot-কে **test server**-এ invite করো (main server-এ না)।
3. এই repo-র `discord-bot/` folder-এ:
   - `npm install`
   - `.env.example`-এর copy বানিয়ে `.env` নামে রাখো, `DISCORD_TOKEN` আর `GROQ_API_KEY` বসাও।
   - `node bot.js`
4. Test server-এ bot-কে mention করে প্রশ্ন করো। Bot শুধু mention-এ reply দেয়, তাই spam হবে না।

## AI না পারলে + on/off

- **AI উত্তর না জানলে:** model `DON'T_KNOW` signal দেয় → bot graceful message পাঠায় + `.env`-এর `STAFF_ROLE_ID` role-কে mention করে (প্রশ্নসহ, যাতে staff বোঝে কী জানতে চাওয়া হয়েছিল)। একই channel-এ 5 মিনিটের মধ্যে আবার mention হবে না (spam ঠেকাতে)।
- **Staff role-এর ID:** Server Settings → Roles → role-এ right-click → Copy ID (Discord-এ Developer Mode on থাকতে হবে) → `.env`-এ `STAFF_ROLE_ID`-এ বসাও। Role-এর "Allow anyone to mention this role" on রাখো, নইলে mention ping যাবে না (অথবা bot-কে Mention Everyone permission দাও)।
- **On/off (শুধু staff):** `@Haven off` → bot চুপ হয়ে যাবে, staff নিজে reply দেবে। `@Haven on` → bot আবার on। Off/on state memory-তে থাকে — bot restart হলে আবার ON হয়ে যাবে।

## Model chain (invisible)

- ৩টা model এই order-এ try হয়: 120b → 20b → qwen।
- Switch হয় শুধু 429 (limit শেষ) হলে — অন্য error-এ না, আর উত্তর না জানলে (DON'T_KNOW) না, কারণ brain একই।
- Chat-এ switch-এর কিছু বোঝা যাবে না — model-এর নাম, limit-এর কথা কোথাও আসবে না।
- ৩টাই শেষ হলে user-এর ভাষায় busy message যাবে (Discord-এ staff mention হবে না, mention শুধু উত্তর না জানলে)।

## Brain edit করা

- শুধু `brain.js` edit করো — HTML test আর Discord bot দুইজনেই ওটা ব্যবহার করে।
- নতুন তথ্য যোগ করলে এক জায়গায়ই যোগ করো, দুই জায়গায় না।

## Key নিয়ম

- Key `config.js`-এ বসাও — তোমার নিজের copy-তে, কখনো repo-তে না। Repo-তে শুধু `config.example.js` (খালি template) থাকে।
- Discord bot-এর key শুধু নিজের `.env`-এ।
- Test key test-এর পরে বদলে দিলেই হলো।

## এখনো বাকি (Juel পূরণ করবে)

- প্রতিটি rank-এর perks-এর তালিকা (`brain.js` → `ranks[].perks`)
- সার্ভারের নিয়মের তালিকা (`brain.js` → `rules`)
- Cracked / TLauncher policy
