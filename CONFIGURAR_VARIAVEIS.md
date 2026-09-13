# 🔐 Guia: Configurar variáveis de ambiente antes do deploy

Depois da correção de segurança, o código **não tem mais credenciais escondidas**.
Elas agora precisam ser configuradas no painel do Vercel. Siga os passos abaixo.

> ⚠️ **IMPORTANTE:** Só faça o merge / deploy DEPOIS de configurar tudo isto.
> Caso contrário o backend cai em modo de dados temporário (in-memory) e perde
> os dados reais.

---

## Passo 1 — Revogar a chave antiga do Firebase (foi exposta)

A chave privada antiga ficou visível no histórico do Git, então precisa ser trocada.

1. Acesse: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Selecione o projeto **uber-clone-eric-f4327**
3. Clique na conta de serviço `firebase-adminsdk-...@...gserviceaccount.com`
4. Aba **KEYS (Chaves)** → apague a chave antiga
5. Clique em **ADD KEY → Create new key → JSON** → baixa um arquivo `.json`

O arquivo JSON baixado tem 3 campos que você vai usar:
- `project_id`   → vira `FIREBASE_PROJECT_ID`
- `client_email` → vira `FIREBASE_CLIENT_EMAIL`
- `private_key`  → vira `FIREBASE_PRIVATE_KEY`

---

## Passo 2 — Configurar as variáveis no Vercel

1. Acesse: https://vercel.com → seu projeto **uber-clone-web**
2. **Settings → Environment Variables**
3. Adicione cada variável abaixo (marque os 3 ambientes: Production, Preview, Development):

| Variável | Valor |
|---|---|
| `FIREBASE_PROJECT_ID` | `uber-clone-eric-f4327` (campo `project_id` do JSON) |
| `FIREBASE_CLIENT_EMAIL` | o campo `client_email` do JSON |
| `FIREBASE_PRIVATE_KEY` | o campo `private_key` do JSON — **cole inteiro, com as aspas e os `\n`** |
| `JWT_SECRET` | (valor forte gerado — veja abaixo) |
| `ADMIN_EMAIL` | o e-mail que VOCÊ quer usar para logar como admin |
| `ADMIN_PASSWORD` | uma senha forte de sua escolha |
| `NODE_ENV` | `production` |

### Valores gerados para você (pode usar estes)

```
JWT_SECRET=eae0815f91cd3894e62b0d5bc40871746ca71c54580d4cdf416a6c6206b1b76c
```

Sugestão de senha de admin (troque se quiser):
```
ADMIN_PASSWORD=woPcMjIZ48ZzwD@PF17
```

> 💡 Sobre o `FIREBASE_PRIVATE_KEY`: no JSON ele aparece assim:
> `"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"`
> Copie **exatamente esse valor** (o que está entre aspas). O código já
> converte os `\n` automaticamente.

---

## Passo 3 — Avisar que está pronto

Depois de salvar todas as variáveis no Vercel, é só me avisar:
**"as variáveis estão configuradas"** — que eu faço o merge na `main` e o
Vercel implanta a versão segura automaticamente. ✅

---

## O que acontece depois do deploy

- O site continua funcionando igual, mas **sem credenciais expostas** no código.
- Para entrar no painel admin, use o `ADMIN_EMAIL` e `ADMIN_PASSWORD` que você
  configurou (as senhas antigas `admin@uberclone.com` etc. não funcionam mais).
