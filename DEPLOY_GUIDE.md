# 🚀 Guia de Deploy - UberClone

## Deploy Online Passo a Passo

### 1️⃣ Preparar Repositórios no GitHub

```bash
# Frontend
cd uber-clone-web
git add .
git commit -m "Preparar para deploy"
git push origin main

# Backend
cd uber-clone-backend
git add .
git commit -m "Preparar para deploy"
git push origin main
```

---

## 2️⃣ Deploy Frontend no Vercel

### Passo 1: Criar Conta Vercel
1. Acesse https://vercel.com
2. Clique em "Sign Up"
3. Conecte sua conta GitHub

### Passo 2: Importar Projeto
1. Clique em "New Project"
2. Selecione `uber-clone-web`
3. Clique em "Import"

### Passo 3: Configurar Variáveis de Ambiente
1. Em "Environment Variables", adicione:
   ```
   REACT_APP_BACKEND_URL=https://seu-backend.railway.app
   REACT_APP_STRIPE_KEY=pk_live_sua_chave
   ```
2. Clique em "Deploy"

### Resultado
```
✅ Frontend ao vivo: https://seu-projeto.vercel.app
```

---

## 3️⃣ Deploy Backend no Railway

### Passo 1: Criar Conta Railway
1. Acesse https://railway.app
2. Clique em "Login with GitHub"

### Passo 2: Novo Projeto
1. Clique em "New Project"
2. Clique em "Deploy from GitHub repo"
3. Selecione `uber-clone-backend`

### Passo 3: Adicionar MongoDB
1. Clique em "+ Add"
2. Selecione "MongoDB"
3. Clique em "Provision"

### Passo 4: Variáveis de Ambiente
1. Clique em "Variables"
2. Adicione:
   ```
   MONGODB_URI={fornecido pelo Railway}
   JWT_SECRET=sua_chave_secreta_super_forte
   STRIPE_SECRET_KEY=sk_live_sua_chave
   ADMIN_EMAIL=admin@uberclone.com
   ADMIN_PASSWORD=SenhaForte123!
   CORS_ORIGIN=https://seu-projeto.vercel.app
   ```
3. Clique em "Deploy"

### Resultado
```
✅ Backend ao vivo: https://seu-projeto-backend.railway.app
```

---

## 4️⃣ Configurar MongoDB Atlas (Alternativo)

### Se preferir usar MongoDB Atlas em vez do Railway:

1. Acesse https://www.mongodb.com/cloud/atlas
2. Crie uma conta
3. Crie um cluster gratuito
4. Copie a connection string
5. Substitua em Railway:
   ```
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/uber-clone
   ```

---

## 5️⃣ Configurar Domínio Personalizado

### Vercel (Frontend)
1. Vá para Project Settings
2. Clique em "Domains"
3. Adicione seu domínio
4. Configure DNS (instruções fornecidas)

### Railway (Backend)
1. Vá para "Settings"
2. Clique em "Domain"
3. Adicione seu domínio
4. Configure DNS

---

## 6️⃣ Configurar Stripe (Produção)

### Ativar Pagamentos Reais

1. Acesse https://dashboard.stripe.com
2. Ative modo produção
3. Copie chaves de produção
4. Adicione em Railway:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLIC_KEY=pk_live_...
   ```
5. Adicione em Vercel:
   ```
   REACT_APP_STRIPE_KEY=pk_live_...
   ```
6. Redeploy automático

---

## 7️⃣ Emails em Produção

### Configurar SendGrid (Opcional)

1. Crie conta em https://sendgrid.com
2. Copie a API Key
3. Adicione em Railway:
   ```
   SENDGRID_API_KEY=SG.sua_chave_aqui
   EMAIL_FROM=noreply@seu-dominio.com
   ```

---

## ✅ Checklist Final de Deploy

- [ ] Repositórios no GitHub
- [ ] Frontend deployado no Vercel
- [ ] Backend deployado no Railway
- [ ] MongoDB conectado
- [ ] Variáveis de ambiente configuradas
- [ ] Domínio personalizado (opcional)
- [ ] SSL/TLS ativado (automático)
- [ ] Stripe em produção (opcional)
- [ ] Email configurado (opcional)
- [ ] Logs monitorados

---

## 🆘 Troubleshooting

### Erro: "CORS blocked"
```
Solução: Verificar CORS_ORIGIN em Railway
Deve ser a URL exata do Vercel
```

### Erro: "Database connection failed"
```
Solução: Verificar MONGODB_URI em Railway
Testar conexão no MongoDB Compass
```

### Erro: "Stripe API key invalid"
```
Solução: Usar chaves de produção (sk_live_, pk_live_)
Não usar chaves de teste (sk_test_, pk_test_)
```

---

## 📊 Monitorar em Produção

### Vercel
- Analytics: https://vercel.com/analytics
- Logs: Real-time logs em dashboard
- Performance: Core Web Vitals

### Railway
- Logs: Railway Logs em dashboard
- Metrics: CPU, Memória, Rede
- Alerts: Email notifications

---

## 🎉 Seu App Está Online!

```
🌐 Frontend: https://seu-projeto.vercel.app
🔌 Backend: https://seu-projeto-backend.railway.app
💾 Database: MongoDB Atlas/Railway
💳 Pagamento: Stripe
```

**Parabéns! Seu UberClone está no ar!** 🚀
