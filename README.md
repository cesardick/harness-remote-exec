# harness-remote-exec

Continue uma conversa do Codex local (CLI ou plugin do IntelliJ) pelo celular, via Telegram.

- `server/`: MCP stdio (Node) com as tools `remote_start`, `remote_send`, `remote_wait` e `remote_end`.
- `skill/`: instrução que faz o Codex entrar no loop de polling.

## Setup
1. No Telegram, fale com @BotFather, `/newbot`, guarde o token.
2. `cd server && npm install`
3. Mande uma mensagem ao seu bot e rode `TELEGRAM_BOT_TOKEN=... npm run chat-id` para descobrir o chat id.
4. Registre no `~/.codex/config.toml`:

```toml
[mcp_servers.codex-remote]
command = "node"
args = ["C:\\Users\\cesar\\IdeaProjects\\harness-remote-exec\\server\\server.js"]
tool_timeout_sec = 120

[mcp_servers.codex-remote.env]
TELEGRAM_BOT_TOKEN = "..."
TELEGRAM_CHAT_ID = "..."
```
5. Copie `skill/SKILL.md` para `~/.codex/skills/remote-session/SKILL.md` (ou cole o conteúdo no AGENTS.md).

## Uso
Diga ao Codex "vamos continuar essa conversa em uma sessão remota". Envie `/encerrar` no Telegram para voltar ao modo local.
