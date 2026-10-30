# harness-remote-exec

Continue uma conversa do **Codex** (CLI ou plugin de IA do IntelliJ) pelo **celular**, usando um bot do Telegram, sem precisar do Remote Control e sem ficar na frente do computador.

## Por que isso existe

Você começa uma tarefa no Codex, no seu IDE. A tarefa é longa, ou você precisa sair de perto do computador, mas quer continuar acompanhando e dando instruções. Alguns clientes têm recursos de acesso remoto, mas eles não existem em todo lugar (por exemplo, no plugin do IntelliJ) ou exigem habilitar infraestrutura extra.

Este projeto resolve isso de um jeito simples: o próprio Codex passa a conversar com você pelo Telegram. Ele manda os resultados para o seu celular e **espera a sua resposta** antes de seguir. Tudo roda na sua máquina, sem servidor para hospedar.

## Como funciona

O Codex só age dentro de um turno e não pode ser "acordado" por uma mensagem externa. Então o remoto funciona por **polling**: o Codex fica num loop que envia e espera.

```
 Celular (Telegram)                 Seu computador
 ┌──────────────┐   Bot API   ┌──────────────────────────────┐
 │  você        │ ◄─────────► │ MCP "codex-remote" (Node)    │
 │  conversa    │  (HTTPS)    │   ▲                          │
 └──────────────┘             │   │ tools MCP via stdio      │
                              │   ▼                          │
                              │ Codex (CLI / plugin IntelliJ)│
                              └──────────────────────────────┘
```

1. Você diz ao Codex: *"vamos continuar essa conversa em uma sessão remota"*.
2. A **skill** instrui o Codex a chamar `remote_start`, mandar um resumo com `remote_send` e entrar em loop com `remote_wait`.
3. `remote_wait` fica até ~55 s esperando você responder no Telegram. Se nada chegar, devolve `TIMEOUT` e o Codex chama de novo.
4. Quando você responde, o texto vira a próxima instrução do Codex. Ele executa, reporta pelo Telegram e volta a esperar.
5. Você manda `/encerrar` e o Codex sai do loop e volta ao controle local.

O servidor MCP é um processo **stdio**: o próprio Codex o inicia e o encerra. Não há nada para publicar nem porta para abrir. O backend é a API do Telegram, que fica na internet.

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `server/` | O servidor MCP em Node.js (`server.js`) e o utilitário `get-chat-id.js`. |
| `skill/` | `SKILL.md`, a instrução que faz o Codex entrar no loop de polling. |

## Requisitos

- **Node.js 18 ou superior** (usa `fetch` nativo). Testado com Node 24.
- Uma conta no **Telegram** (no celular).
- **Codex** com suporte a servidores MCP via `config.toml`. Testado com o plugin de IA do IntelliJ no Windows 11.
- Acesso à internet para `api.telegram.org`.

## Instalação

### 1. Criar o bot no Telegram

1. No Telegram, abra uma conversa com **@BotFather**.
2. Envie `/newbot` e siga as instruções (nome e username terminado em `bot`).
3. Guarde o **token** que ele devolver. Ele dá controle total do bot, então trate como senha.
4. Abra o seu novo bot, toque em **Iniciar** e mande qualquer mensagem (por exemplo, "oi"). Isso é necessário para o próximo passo.

### 2. Instalar as dependências

```bash
cd server
npm install
```

### 3. Descobrir o seu chat id

O servidor só aceita mensagens de **um** chat, o seu. Para descobrir o id:

```bash
# Windows (PowerShell)
$env:TELEGRAM_BOT_TOKEN = "SEU_TOKEN"; npm run chat-id

# macOS / Linux
TELEGRAM_BOT_TOKEN=SEU_TOKEN npm run chat-id
```

Ele fica escutando; mande uma mensagem ao bot (se ainda não mandou) e ele imprime `chat_id: 123456789`. Guarde esse número.

### 4. Registrar o MCP no Codex

Edite o `config.toml` do Codex (no Windows: `C:\Users\<você>\.codex\config.toml`; em macOS/Linux: `~/.codex/config.toml`) e adicione:

```toml
[mcp_servers.codex-remote]
command = "node"
args = ["C:\\caminho\\para\\harness-remote-exec\\server\\server.js"]
tool_timeout_sec = 120

[mcp_servers.codex-remote.env]
TELEGRAM_BOT_TOKEN = "SEU_TOKEN"
TELEGRAM_CHAT_ID = "SEU_CHAT_ID"
```

Ajuste o caminho do `args` para onde o repositório está na sua máquina (em TOML, no Windows, use `\\` ou aspas simples com barras normais). O `tool_timeout_sec` precisa ser maior que o tempo de espera do `remote_wait` (padrão 25 s, máximo 55 s).

O `config.toml` fica fora do repositório. É lá que o token deve ficar, e nunca no git.

### 5. Instalar a skill

Copie `skill/SKILL.md` para a pasta de skills do Codex:

```
~/.codex/skills/remote-session/SKILL.md
```

Se o seu cliente não carregar skills, cole o conteúdo do `SKILL.md` no `AGENTS.md` do projeto ou nas instruções personalizadas do plugin.

### 6. Reiniciar o Codex

Reinicie o Codex (ou o IntelliJ), ou abra uma sessão nova, para ele carregar o MCP e a skill.

## Uso

1. Numa conversa com o Codex, diga: **"vamos continuar essa conversa em uma sessão remota"**.
2. Você recebe `🟢 Sessão remota iniciada` no Telegram.
3. Responda no Telegram com a próxima instrução. O Codex executa e devolve um resumo.
4. Envie **`/encerrar`** (ou `/end`, `/stop`) para sair da sessão remota e voltar ao controle local no IDE.

## Referência das tools

| Tool | O que faz |
|---|---|
| `remote_start(title)` | Abre a sessão: descarta mensagens antigas pendentes e envia a mensagem de abertura. |
| `remote_send(text)` | Envia texto ao celular. Mensagens longas são divididas em blocos de 4000 caracteres. |
| `remote_wait(timeout_seconds=25)` | Long-poll por uma resposta (1–55 s). Retorna o texto, `TIMEOUT` (chamar de novo) ou `SESSION_ENDED` (usuário mandou `/encerrar`). |
| `remote_end(summary)` | Encerra a sessão por iniciativa do Codex, com uma mensagem final. |

## Limitações conhecidas

- **Aprovações de comandos.** Se o Codex pedir permissão para executar algo, ele trava esperando no IDE; o celular não consegue aprovar. Use um modo de aprovação mais permissivo na sessão remota, ou pergunte pelo chat antes de ações sensíveis. Leve em conta o risco de deixar o Codex executar comandos sem supervisão.
- **O loop depende do modelo.** A skill instrui o Codex a nunca encerrar o turno enquanto a sessão estiver ativa, mas o modelo pode, às vezes, sair do loop. Se isso acontecer, volte ao IDE e peça para ele retomar.
- **Consumo de contexto.** Cada ciclo de espera e resposta adiciona mensagens ao contexto da conversa.
- **A sessão fica ocupada.** Enquanto o loop está ativo, o IDE mostra o Codex "rodando". Para voltar ao controle local, use `/encerrar` ou interrompa no IDE.
- **Só texto, um chat, uma sessão por vez.** Mídia enviada é ignorada (o Codex é avisado), mensagens de outros chats são descartadas e o estado da sessão vive na memória do processo.
- **Testado apenas no Windows** com o plugin do IntelliJ. Em macOS/Linux e na CLI deve funcionar, mas não foi verificado.

## Segurança

- O servidor responde **somente** ao `TELEGRAM_CHAT_ID` configurado. Qualquer outra pessoa que mande mensagem ao bot é ignorada.
- Quem tiver o token controla o bot. Se ele vazar, gere outro com `/revoke` no @BotFather e atualize o `config.toml`.
- As mensagens passam pelos servidores do Telegram. Não envie segredos ou dados sensíveis pelo chat.
- Quem controla o seu chat do Telegram controla o Codex durante a sessão remota; proteja a conta com verificação em duas etapas.

## Solução de problemas

| Sintoma | O que verificar |
|---|---|
| O Codex não encontra as tools `remote_*` | O `config.toml` foi salvo e o Codex foi reiniciado? O caminho em `args` existe e o `npm install` foi rodado em `server/`? |
| O MCP falha ao iniciar | `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` são obrigatórios; sem eles o processo sai com erro. |
| Nada chega no Telegram | Você já mandou uma mensagem ao bot (passo 1.4)? O chat id está correto? O token é válido? |
| `Telegram getUpdates: Conflict` | Há outro processo consumindo as atualizações do mesmo bot (outra instância do servidor, ou outra aplicação com webhook). |
| O Codex ignora a skill | Confirme o caminho da skill ou use o `AGENTS.md`. Diga explicitamente "use a skill remote-session". |
| O Codex sai do loop sozinho | Veja "Limitações conhecidas". Peça para ele retomar a sessão remota. |
| `tool call timed out` | Aumente `tool_timeout_sec` ou diminua o `timeout_seconds` do `remote_wait`. |

## Desenvolvimento

O servidor usa `@modelcontextprotocol/sdk` e fala MCP por stdio, então **nunca escreva em stdout**: use `console.error` para logs. Para um teste rápido de que ele sobe e lista as tools:

```bash
cd server
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=1 node server.js
```
