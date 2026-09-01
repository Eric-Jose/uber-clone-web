# 🚗 UberClone - Documentação Completa

## 📋 Sumário
1. [Visão Geral](#visão-geral)
2. [Instalação](#instalação)
3. [Configuração](#configuração)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [APIs do Backend](#apis-do-backend)
6. [Guia do Usuário](#guia-do-usuário)
7. [Guia do Administrador](#guia-do-administrador)
8. [Deployment](#deployment)

---

## 🎯 Visão Geral

**UberClone** é uma plataforma completa de compartilhamento de caronas com:

✅ **Sistema de Autenticação** - Login seguro com 2FA  
✅ **Painel de Usuário** - Perfil, histórico, avaliações  
✅ **Cadastro de Motoristas** - Validação de documentos  
✅ **Painel Admin** - Gerenciamento completo  
✅ **Sistema de Pagamento** - Cartão, PIX, Carteira  
✅ **Notificações em Tempo Real** - WebSocket  
✅ **Chat** - Comunicação entre usuários  
✅ **Avaliações** - Sistema de ratings  

---

## 💻 Instalação

### Pré-requisitos
- Node.js v16+
- MongoDB v4.0+
- Git

### Frontend (React)

```bash
# Clonar repositório
git clone https://github.com/Eric-Jose/uber-clone-web.git
cd uber-clone-web

# Instalar dependências
npm install

# Variáveis de ambiente
cp .env.example .env.local

# Editar .env.local
REACT_APP_BACKEND_URL=http://localhost:5000

# Iniciar desenvolvimento
npm start
```

### Backend (Node.js)

```bash
# Clonar repositório
git clone https://github.com/Eric-Jose/uber-clone-backend.git
cd uber-clone-backend

# Instalar dependências
npm install

# Variáveis de ambiente
cp .env.example .env

# Editar .env
MONGODB_URI=mongodb://localhost:27017/uber-clone
JWT_SECRET=sua_chave_secreta_aqui
STRIPE_SECRET_KEY=sua_chave_stripe

# Iniciar servidor
npm start
```

---

## ⚙️ Configuração

### MongoDB

#### Local (Desenvolvimento)

```bash
# Instalar MongoDB
# Windows: https://www.mongodb.com/try/download/community
# Mac: brew install mongodb-community
# Linux: sudo apt-get install -y mongodb

# Iniciar serviço
mongod

# Conectar via Compass (GUI)
# Baixar em: https://www.mongodb.com/products/compass
```

#### Atlas (Produção)

```bash
# 1. Criar conta em https://www.mongodb.com/cloud/atlas
# 2. Criar cluster gratuito
# 3. Obter connection string
# 4. Adicionar em .env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/uber-clone
```

### Variáveis de Ambiente

**.env (Backend)**
```
# Banco de Dados
MONGODB_URI=mongodb://localhost:27017/uber-clone

# JWT
JWT_SECRET=sua_chave_super_secreta_12345
JWT_EXPIRE=7d

# Stripe (Pagamento)
STRIPE_SECRET_KEY=sk_test_sua_chave
STRIPE_PUBLIC_KEY=pk_test_sua_chave

# Email
EMAIL_USER=seu_email@gmail.com
EMAIL_PASSWORD=sua_senha_app

# Admin
ADMIN_EMAIL=admin@uberclone.com
ADMIN_PASSWORD=SenhaForte123!
```

**.env.local (Frontend)**
```
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_STRIPE_KEY=pk_test_sua_chave
```

---

## 📁 Estrutura do Projeto

```
uber-clone-web/
├── src/
│   ├── pages/
│   │   ├── Login.js
│   │   ├── Register.js
│   │   ├── UserProfile.js
│   │   ├── DriverRegistration.js
│   │   ├── AdminPanel.js
│   │   ├── AdminLogin.js
│   │   ├── AdminDashboard.js
│   │   ├── Payment.js
│   │   ├── NotificationCenter.js
│   │   ├── Chat.js (NOVO)
│   │   └── Ratings.js (NOVO)
│   │
│   ├── services/
│   │   ├── WebSocketService.js
│   │   ├── PaymentService.js
│   │   ├── ChatService.js (NOVO)
│   │   ├── ApiService.js (NOVO)
│   │   └── AuthService.js (NOVO)
│   │
│   ├── styles/
│   │   ├── Payment.css
│   │   ├── Notifications.css
│   │   ├── Chat.css (NOVO)
│   │   ├── Ratings.css (NOVO)
│   │   └── App.css
│   │
│   ├── App.js
│   └── index.js
│
├── .env.example
├── package.json
└── README.md

uber-clone-backend/
├── src/
│   ├── models/
│   │   ├── User.js
│   │   ├── Driver.js
│   │   ├── Ride.js
│   │   ├── Payment.js
│   │   ├── Message.js (NOVO)
│   │   ├── Rating.js (NOVO)
│   │   └── Banner.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── drivers.js
│   │   ├── rides.js
│   │   ├── payments.js
│   │   ├── messages.js (NOVO)
│   │   ├── ratings.js (NOVO)
│   │   ├── admin.js
│   │   └── banners.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── driverController.js
│   │   ├── rideController.js
│   │   ├── paymentController.js
│   │   ├── messageController.js (NOVO)
│   │   ├── ratingController.js (NOVO)
│   │   └── adminController.js
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── upload.js
│   │
│   ├── config/
│   │   ├── database.js
│   │   ├── stripe.js
│   │   └── email.js
│   │
│   ├── socket/
│   │   ├── events.js
│   │   └── handlers.js
│   │
│   ├── server.js
│   └── index.js
│
├── .env.example
├── package.json
└── README.md
```

---

## 🔌 APIs do Backend

### Autenticação

#### Login Usuário
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@email.com",
  "password": "senha123"
}

Resposta:
{
  "token": "jwt_token_aqui",
  "user": {
    "id": "user_id",
    "name": "João Silva",
    "email": "usuario@email.com",
    "userType": "passenger"
  }
}
```

#### Registrar Usuário
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "João Silva",
  "email": "usuario@email.com",
  "phone": "(11) 99999-9999",
  "password": "senha123",
  "userType": "passenger"
}

Resposta: (200 OK)
{
  "token": "jwt_token_aqui",
  "user": { ... }
}
```

#### Login Admin
```http
POST /api/admin/login
Content-Type: application/json

{
  "email": "admin@uberclone.com",
  "password": "SenhaForte123!"
}

Resposta:
{
  "token": "jwt_token_admin",
  "requiresTwoFA": true
}
```

#### Verificar 2FA Admin
```http
POST /api/admin/verify-2fa
Content-Type: application/json

{
  "email": "admin@uberclone.com",
  "twoFACode": "123456"
}

Resposta:
{
  "token": "jwt_token_admin_verificado",
  "admin": { ... }
}
```

### Motoristas

#### Cadastrar Motorista
```http
POST /api/drivers/register
Content-Type: application/json
Authorization: Bearer {token}

{
  "fullName": "João Silva",
  "cpf": "123.456.789-00",
  "driverLicense": "1234567890",
  "vehicleModel": "Honda Civic",
  "vehicleColor": "Preto",
  "vehicleYear": 2020,
  "licensePlate": "ABC-1234",
  "bankName": "Banco do Brasil",
  "bankAccount": "123456-7",
  "bankRoutingNumber": "0001"
}

Resposta: (201 Created)
{
  "id": "driver_id",
  "status": "pending",
  "createdAt": "2026-09-01T00:00:00Z"
}
```

#### Listar Motoristas Pendentes (Admin)
```http
GET /api/drivers/pending
Authorization: Bearer {adminToken}

Resposta: (200 OK)
[
  {
    "id": "driver_id",
    "fullName": "João Silva",
    "status": "pending",
    "createdAt": "2026-09-01T00:00:00Z"
  }
]
```

#### Aprovar Motorista (Admin)
```http
PUT /api/drivers/{id}/approve
Content-Type: application/json
Authorization: Bearer {adminToken}

{
  "approvalReason": "Documentos validados com sucesso"
}

Resposta: (200 OK)
{
  "id": "driver_id",
  "status": "approved"
}
```

### Pagamentos

#### Processar Pagamento
```http
POST /api/payments/process
Content-Type: application/json
Authorization: Bearer {token}

{
  "rideId": "ride_id",
  "amount": 32.50,
  "paymentMethod": "card",
  "cardData": {
    "cardNumber": "4111111111111111",
    "cardName": "João Silva",
    "expiryDate": "12/25",
    "cvv": "123"
  }
}

Resposta: (200 OK)
{
  "id": "payment_id",
  "status": "completed",
  "amount": 32.50
}
```

#### Obter Histórico de Pagamentos
```http
GET /api/payments/history/{userId}
Authorization: Bearer {token}

Resposta: (200 OK)
[
  {
    "id": "payment_id",
    "rideId": "ride_id",
    "amount": 32.50,
    "date": "2026-09-01T00:00:00Z",
    "status": "completed"
  }
]
```

### Banners (Admin)

#### Criar Banner
```http
POST /api/banners
Content-Type: application/json
Authorization: Bearer {adminToken}

{
  "title": "Promoção de Verão",
  "description": "Ganhe 20% de desconto",
  "imageUrl": "https://exemplo.com/imagem.jpg",
  "active": true
}

Resposta: (201 Created)
{
  "id": "banner_id",
  "title": "Promoção de Verão",
  "active": true
}
```

#### Listar Banners
```http
GET /api/banners

Resposta: (200 OK)
[
  {
    "id": "banner_id",
    "title": "Promoção de Verão",
    "description": "Ganhe 20% de desconto",
    "active": true,
    "createdAt": "2026-09-01T00:00:00Z"
  }
]
```

#### Atualizar Banner
```http
PUT /api/banners/{id}
Content-Type: application/json
Authorization: Bearer {adminToken}

{
  "title": "Nova Promoção",
  "active": false
}

Resposta: (200 OK)
{ ... }
```

#### Deletar Banner
```http
DELETE /api/banners/{id}
Authorization: Bearer {adminToken}

Resposta: (204 No Content)
```

---

## 👥 Guia do Usuário

### 1️⃣ Criar Conta

1. Acesse http://localhost:3000
2. Clique em "Cadastre-se aqui"
3. Escolha o tipo (Passageiro/Motorista)
4. Preencha os dados:
   - Nome completo
   - Email
   - Telefone
   - Senha
5. Clique em "Criar Conta"

### 2️⃣ Fazer Login

1. Clique em "Entrar"
2. Digite email e senha
3. Pronto! Você está logado

### 3️⃣ Editar Perfil

1. No painel de usuário, clique em "Editar"
2. Modifique os dados
3. Clique em "Salvar"

### 4️⃣ Solicitar Corrida (Passageiro)

1. Clique em "Nova Corrida"
2. Defina origem e destino
3. Escolha um motorista disponível
4. Aguarde a confirmação
5. Ao chegar, clique em "Corrida Concluída"

### 5️⃣ Fazer Pagamento

1. Clique em "Pagar"
2. Escolha o método:
   - 💳 Cartão de Crédito
   - 👛 Carteira Digital
   - 🔢 PIX
3. Preencha os dados
4. Clique em "Pagar"

### 6️⃣ Ver Notificações

1. Clique no ícone 🔔 Notificações
2. Veja as notificações recentes
3. Clique em "Não Lidas" para filtrar

---

## 🔐 Guia do Administrador

### 1️⃣ Fazer Login Admin

1. Na home, clique em "🔐 Administrador"
2. Digite email e senha admin
3. Confirme o código 2FA do autenticador
4. Acesso garantido!

**Credenciais Padrão:**
```
Email: admin@uberclone.com
Senha: SenhaForte123!
```

### 2️⃣ Dashboard - Visão Geral

Veja em tempo real:
- Total de corridas
- Total de usuários
- Total de motoristas
- Faturamento total
- Motoristas pendentes

### 3️⃣ Gerenciar Banners

#### Criar Banner
1. Clique em "🎨 Banners & Anúncios"
2. Preencha:
   - Título
   - Descrição
   - URL da imagem
3. Ative a caixa de seleção
4. Clique em "🚀 Criar Banner"

#### Ativar/Desativar Banner
1. Encontre o banner na lista
2. Clique em "✅ Ativo" ou "❌ Inativo"
3. Muda automaticamente

#### Deletar Banner
1. Clique em "🗑️ Deletar"
2. Confirme a ação
3. Banner removido

### 4️⃣ Gerenciar Motoristas

1. Clique em "🚗 Motoristas"
2. Veja lista de pendentes
3. Clique em "👁️ Ver" para detalhes
4. Aprove ou rejeite com motivo

### 5️⃣ Análise Financeira

1. Clique em "💰 Financeiro"
2. Veja:
   - Faturamento mensal
   - Crescimento (%)
   - Comissão retida
   - Pagamentos aos motoristas

### 6️⃣ Configurações

1. Clique em "⚙️ Configurações"
2. Opções disponíveis:
   - Alterar Senha
   - Ativar 2FA
   - Email Notifications
   - Push Notifications
   - Logs de Auditoria
   - Backup do Sistema

---

## 🚀 Deployment

### Vercel (Frontend)

```bash
# 1. Push do código
git push origin main

# 2. Conectar Vercel
# Acesse https://vercel.com
# Clique em "New Project"
# Selecione seu repositório
# Configure variáveis de ambiente
# Deploy automático!

# URL: https://seu-projeto.vercel.app
```

### Railway (Backend)

```bash
# 1. Criar conta em https://railway.app
# 2. Conectar GitHub
# 3. Selecionar repositório backend
# 4. Configurar variáveis de ambiente
# 5. Deploy automático!

# URL: https://seu-projeto-backend.railway.app
```

### MongoDB Atlas (Database)

```bash
# 1. Criar cluster em https://www.mongodb.com/cloud/atlas
# 2. Obter connection string
# 3. Adicionar em Railway/Backend .env
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
```

---

## 🆘 Solução de Problemas

### Erro: "Cannot find module"
```bash
Solução: npm install
```

### Erro: "MongoDB Connection Refused"
```bash
Solução: Verificar se MongoDB está rodando
mongod
```

### Erro: "Port 5000 in use"
```bash
# Mac/Linux
lsof -i :5000
kill -9 <PID>

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Erro: "JWT token expired"
```
Solução: Fazer login novamente
```

---

## 📞 Suporte

**Email:** support@uberclone.com  
**Discord:** https://discord.gg/uberclone  
**GitHub Issues:** https://github.com/Eric-Jose/uber-clone-web/issues  

---

## 📄 Licença

MIT License - Veja LICENSE.md para detalhes

---

**Última atualização:** 01/09/2026  
**Versão:** 1.0.0
