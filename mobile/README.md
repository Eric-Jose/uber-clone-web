# 📱 UberClone Mobile - React Native

## 🎯 Visão Geral

Aplicativo mobile nativo para iOS e Android com todas as funcionalidades do UberClone.

## 🚀 Funcionalidades Implementadas

✅ **Login/Registro**
- Autenticação JWT
- 2FA opcional
- Biometria (Touch ID / Face ID)

✅ **Mapa em Tempo Real**
- Google Maps integrado
- Marcadores de motoristas
- Rota em tempo real
- Geolocalização

✅ **Solicitar Corrida**
- Visualizar motoristas próximos
- Avaliar motoristas
- Rastreamento ao vivo
- Chat com motorista

✅ **Perfil do Usuário**
- Editar dados
- Histórico de corridas
- Métodos de pagamento
- Configurações

✅ **Notificações Push**
- Corrida confirmada
- Motorista chegando
- Corrida concluída
- Ofertas especiais

✅ **Pagamentos**
- Cartão de crédito
- PIX
- Carteira digital

✅ **Segurança**
- Compartilhamento de localização
- Botão de emergência
- Verificação de motorista

## 📋 Pré-requisitos

- Node.js v16+
- Expo CLI
- iOS 13+ ou Android 8+

## 🛠️ Instalação

```bash
# Instalar dependências
cd mobile
npm install

# Ou com yarn
yarn install

# Instalar Expo CLI globalmente
npm install -g expo-cli
```

## ▶️ Executar

### No Emulador Android
```bash
cd mobile
npm run android
```

### No Simulador iOS
```bash
cd mobile
npm run ios
```

### Com Expo Go (Teste rápido)
```bash
cd mobile
npm start

# Escanear QR code com câmera ou Expo Go app
```

## 📁 Estrutura de Pastas

```
mobile/
├── src/
│   ├── screens/
│   │   ├── LoginMobile.js
│   │   ├── MapRideMobile.js
│   │   ├── ProfileMobile.js
│   │   ├── HistoryMobile.js
│   │   └── PromotionsMobile.js
│   │
│   ├── components/
│   │   ├── DriverCard.js
│   │   ├── RideDetails.js
│   │   └── NotificationBanner.js
│   │
│   ├── services/
│   │   ├── ApiService.js
│   │   ├── LocationService.js
│   │   └── NotificationService.js
│   │
│   └── styles/
│       └── colors.js
│
├── App.js
├── package.json
└── app.json
```

## 🎨 Design do App

### Telas

**1. Login Screen**
- Email e Senha
- 2FA opcional
- Opção "Lembrar-me"
- Link para registro

**2. Home / Mapa**
- Mapa com motoristas próximos
- Painel deslizável com detalhes
- Botão para solicitar corrida
- Filtros (Avaliação, Preço, etc)

**3. Detalhes da Corrida**
- Motorista selecionado
- Trajeto no mapa
- Tempo estimado
- Preço estimado
- Chat ao vivo

**4. Perfil**
- Dados do usuário
- Histórico de corridas
- Métodos de pagamento
- Configurações
- Avaliações

**5. Histórico**
- Lista de corridas
- Filtrar por data/status
- Detalhes completos
- Recebos/Notas fiscais

## 🔐 Autenticação

```javascript
// Login com JWT
const login = async (email, password) => {
  const response = await fetch('https://api.uberclone.com/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const { token } = await response.json();
  await AsyncStorage.setItem('authToken', token);
};
```

## 🗺️ Google Maps

```javascript
// Obter localização do usuário
import * as Location from 'expo-location';

const getLocation = async () => {
  const { coords } = await Location.getCurrentPositionAsync();
  return coords;
};
```

## 🔔 Notificações Push

```javascript
// Registrar para notificações
import * as Notifications from 'expo-notifications';

const registerForNotifications = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
};
```

## 💾 AsyncStorage (Dados Locais)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Salvar token
await AsyncStorage.setItem('authToken', token);

// Recuperar token
const token = await AsyncStorage.getItem('authToken');
```

## 🚀 Build para Produção

### Android APK
```bash
cd mobile
eas build --platform android
```

### iOS IPA
```bash
cd mobile
eas build --platform ios
```

## 📊 Monitoramento

- **Sentry**: Rastreamento de erros
- **Firebase Analytics**: Eventos do app
- **Mixpanel**: Analytics customizadas

## 🔗 Backend APIs

```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/users/{id}
PUT    /api/users/{id}
POST   /api/rides/request
GET    /api/rides/active
GET    /api/rides/history
POST   /api/payments/process
```

## ❓ FAQ

**P: Como testar em um dispositivo real?**
R: Use Expo Go (app gratuito) - escanear QR code durante `npm start`

**P: Como adicionar ícone customizado?**
R: Editar `app.json` - seção `icon`

**P: Como publicar na App Store?**
R: Usar EAS (Expo Application Services) ou Xcode/Android Studio

## 📞 Suporte

Email: mobile@uberclone.com
Discord: https://discord.gg/uberclone

---

**Versão:** 1.0.0  
**Última atualização:** 01/09/2026
