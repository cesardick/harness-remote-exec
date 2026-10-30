// Uso: TELEGRAM_BOT_TOKEN=... node get-chat-id.js  (depois mande uma mensagem ao seu bot)
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Defina TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}
console.log("Aguardando você mandar uma mensagem ao bot...");
let offset = 0;
while (true) {
  const r = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=30&offset=${offset}`)).json();
  if (!r.ok) throw new Error(r.description);
  for (const u of r.result) {
    offset = u.update_id + 1;
    if (u.message) {
      console.log(`chat_id: ${u.message.chat.id}  (de: ${u.message.from?.first_name})`);
      process.exit(0);
    }
  }
}
