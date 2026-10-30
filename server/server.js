#!/usr/bin/env node
// MCP stdio server: ponte entre o Codex local e um chat do Telegram.
// Nunca escreva em stdout aqui (é o canal do protocolo MCP); use console.error.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!TOKEN || !CHAT_ID) {
  console.error("Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const MAX_LEN = 4000;
const END_COMMANDS = new Set(["/encerrar", "/end", "/stop"]);

let offset = 0;
let active = false;

async function tg(method, body, signal) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result;
}

async function sendText(text) {
  for (let i = 0; i < text.length || i === 0; i += MAX_LEN) {
    await tg("sendMessage", { chat_id: CHAT_ID, text: text.slice(i, i + MAX_LEN) });
  }
}

// Descarta mensagens antigas pendentes para não tratá-las como respostas novas.
async function drain() {
  const updates = await tg("getUpdates", { offset: -1, timeout: 0 });
  if (updates.length) offset = updates[updates.length - 1].update_id + 1;
}

async function waitForReply(timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (true) {
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    if (remaining <= 0) return null;
    const updates = await tg("getUpdates", {
      offset,
      timeout: Math.min(remaining, 50),
      allowed_updates: ["message"],
    });
    const texts = [];
    for (const u of updates) {
      offset = u.update_id + 1;
      const m = u.message;
      if (!m || String(m.chat.id) !== String(CHAT_ID)) continue; // ignora outros chats
      if (m.text) texts.push(m.text);
      else texts.push("[mensagem não-texto ignorada: o usuário enviou mídia]");
    }
    if (texts.length) return texts;
  }
}

const server = new McpServer({ name: "codex-remote", version: "0.1.0" });
const reply = (text) => ({ content: [{ type: "text", text }] });

server.registerTool(
  "remote_start",
  {
    description:
      "Inicia a sessão remota: manda uma mensagem de abertura ao celular do usuário. Chame uma vez, antes de remote_send/remote_wait.",
    inputSchema: { title: z.string().describe("Título curto da sessão/tarefa") },
  },
  async ({ title }) => {
    await drain();
    active = true;
    await sendText(`🟢 Sessão remota iniciada: ${title}\nResponda aqui para continuar. Envie /encerrar para terminar.`);
    return reply("Sessão remota iniciada. Envie o status com remote_send e aguarde a resposta com remote_wait.");
  },
);

server.registerTool(
  "remote_send",
  {
    description: "Envia uma mensagem de texto (resumo do que foi feito, pergunta, resultado) ao celular do usuário.",
    inputSchema: { text: z.string() },
  },
  async ({ text }) => {
    await sendText(text);
    return reply("Enviado.");
  },
);

server.registerTool(
  "remote_wait",
  {
    description:
      "Aguarda a resposta do usuário no celular (long-poll). Retorna o texto recebido, ou TIMEOUT se nada chegou: nesse caso chame remote_wait de novo. Retorna SESSION_ENDED se o usuário mandou /encerrar.",
    inputSchema: {
      timeout_seconds: z.number().int().min(1).max(55).default(25).describe("Tempo máximo de espera nesta chamada"),
    },
  },
  async ({ timeout_seconds }) => {
    if (!active) return reply("ERRO: sessão remota não iniciada. Chame remote_start primeiro.");
    const texts = await waitForReply(timeout_seconds);
    if (!texts) return reply("TIMEOUT: nenhuma mensagem nova. Chame remote_wait novamente.");
    if (texts.some((t) => END_COMMANDS.has(t.trim().toLowerCase()))) {
      active = false;
      await sendText("🔴 Sessão remota encerrada. O Codex voltou ao controle local.");
      return reply("SESSION_ENDED: o usuário encerrou a sessão remota. Pare o loop e retorne ao modo local.");
    }
    return reply(texts.join("\n\n"));
  },
);

server.registerTool(
  "remote_end",
  {
    description: "Encerra a sessão remota por iniciativa do Codex, com uma mensagem final.",
    inputSchema: { summary: z.string().describe("Resumo final") },
  },
  async ({ summary }) => {
    active = false;
    await sendText(`🔴 Sessão remota encerrada.\n${summary}`);
    return reply("Sessão remota encerrada.");
  },
);

await server.connect(new StdioServerTransport());
