# 📌 Ponto de retomada — Personaia

> Para o agente do próximo chat: leia este arquivo primeiro.

## Onde o código está

Pasta `personaia/` na branch `arena/01a0af01-uber-clone-web` do repo
`Eric-Jose/uber-clone-web`. Tudo commitado e com push feito (commit `6479e5f`).

Projeto **standalone**: tem `package.json`, `.gitignore` e `.github/` próprios,
zero dependência do app de corridas que ocupa o resto do repositório.

## O que já está pronto ✅

| Item | Status |
|---|---|
| App Personaia (React + Vite + Capacitor) | completo |
| Chat com streaming SSE + botão parar | ok |
| Providers: Gemini, OpenAI, OpenRouter | ok |
| Voz: ditado pt-BR + leitura em voz alta | ok |
| Múltiplas conversas, histórico local | ok |
| Personalidade customizável | ok |
| UI dark mobile-first (safe areas) | ok |
| Ícones 192/512 em `public/` | ok |
| Workflow `.github/workflows/apk.yml` | ok |
| `npm run build` | passa |

Identidade: nome **Personaia**, package Android `com.ericjose.personaia`,
chave de storage `personaia:v1`.

## ⛔ O que ficou pendente — a ÚNICA tarefa em aberto

**Publicar o código no repositório `Eric-Jose/Personaia`** (já existe, está vazio, é público).

Na sessão anterior o push falhou:

```
remote: Permission to Eric-Jose/Personaia.git denied to arena-ai-coding-agent[bot].
fatal: unable to access 'https://github.com/Eric-Jose/Personaia.git/': 403
```

Diagnóstico: o token do sandbox é emitido **por repositório** no início da sessão.
O usuário liberou acesso a todos os repos no GitHub, mas o token antigo não foi
reemitido. Push em `uber-clone-web` funcionava; em `Personaia` não.

**A esperança para o novo chat:** sessão nova = token novo, provavelmente já com
acesso ao `Personaia`.

### Primeira coisa a fazer no novo chat

```bash
git ls-remote https://github.com/Eric-Jose/Personaia.git   # testa leitura
```

Se responder sem erro, monte e publique:

```bash
rm -rf /tmp/pub && mkdir -p /tmp/pub
cd /home/user/uber-clone-web/personaia
tar --exclude=node_modules --exclude=dist --exclude=android \
    --exclude=CONTINUAR_AQUI.md -cf - . | (cd /tmp/pub && tar xf -)

cd /tmp/pub
git init -b main
git add -A
git commit -m "feat: Personaia - assistente de IA pessoal (React + Vite + Capacitor)"
git remote add origin https://github.com/Eric-Jose/Personaia.git
git push -u origin main
```

> Não versione `CONTINUAR_AQUI.md` no repo Personaia — é nota interna de sessão.

Se der 403 de novo: o usuário precisa **desconectar e reconectar o GitHub nas
configurações do Arena** (reemite o token). Alternativa: passar o comando de
`git clone` + `cp -r personaia/. ~/Personaia/` + push para ele rodar na máquina dele.

## Depois que o push funcionar

O workflow dispara sozinho no push para `main`. O usuário baixa o APK em:
**Actions → Build APK → artefato `Personaia-apk`** → instala `app-debug.apk` no celular.

## Como testar localmente

```bash
cd /home/user/uber-clone-web/personaia && npm install && npm run dev
```

Nos Ajustes (⚙): escolher **Google Gemini** + `gemini-2.0-flash` e colar chave
grátis de https://aistudio.google.com/app/apikey

## Ideias que o usuário ainda não decidiu

Anexar imagem (visão), lembretes/notificações, memória de longo prazo.
