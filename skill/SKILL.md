---
name: remote-session
description: Continua a conversa atual em uma sessão remota pelo celular (Telegram). Use quando o usuário disser "vamos continuar essa conversa em uma sessão remota", "vamos continuar no Telegram", "continuar pelo celular", "modo remoto" ou similar.
---

# Sessão remota

Ferramentas do MCP `codex-remote`: `remote_start`, `remote_send`, `remote_wait`, `remote_end`.

1. Chame `remote_start` com um título curto da tarefa atual.
2. Envie com `remote_send` um resumo do estado atual e a próxima pergunta/passo.
3. Chame `remote_wait`. A resposta do usuário é a nova instrução: execute-a normalmente.
4. Ao terminar cada passo, `remote_send` com um resumo curto (o que mudou, o que falta, perguntas).
5. Volte ao passo 3. Se `remote_wait` retornar `TIMEOUT`, chame-o de novo imediatamente, sem comentar nem encerrar o turno.
6. Pare o loop só quando `remote_wait` retornar `SESSION_ENDED` ou o usuário pedir para encerrar (use `remote_end`).

Regras:
- NUNCA termine o turno enquanto a sessão remota estiver ativa; o loop de `remote_wait` é o que mantém a conversa viva.
- Mensagens curtas, legíveis no celular; sem blocos enormes de código ou diffs.
- Se precisar de uma decisão ou aprovação, pergunte via `remote_send` e aguarde com `remote_wait`.
