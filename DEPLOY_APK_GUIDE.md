# 📱 Guia Completo: Transformar em APK (Android)

## Opção 1: Capacitor (Recomendado - Mais Fácil)

### ✅ Vantagens
- Mantém o código React
- Funciona offline com PWA
- Suporta plugins nativos
- Deploy direto na Play Store

### 📋 Passo a Passo

#### 1. Instalar Capacitor
```bash
npm install @capacitor/core @capacitor/cli
npx cap init
```

#### 2. Adicionar plataforma Android
```bash
npm install @capacitor/android
npx cap add android
```

#### 3. Build do React
```bash
npm run build
```

#### 4. Copiar arquivos
```bash
npx cap sync
```

#### 5. Abrir no Android Studio
```bash
npx cap open android
```

#### 6. Gerar APK
- No Android Studio:
  1. Build > Build Bundles/APK > Build APK(s)
  2. Aguarde o processo
  3. APK gerado em: `android/app/release/app-release.apk`

---

## Opção 2: React Native (Mais Profissional)

### ✅ Vantagens
- Melhor performance
- Acesso completo a APIs nativas
- Código separado para cada plataforma

### 📋 Passo a Passo

#### 1. Criar novo projeto React Native
```bash
npx react-native init UberCloneApp
cd UberCloneApp
```

#### 2. Instalar dependências
```bash
npm install react-native-maps @react-native-async-storage/async-storage @react-native-geolocation-service
```

#### 3. Configurar build
```bash
cd android
./gradlew assembleRelease
```

#### 4. APK gerado
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## Opção 3: Expo (Mais Rápido)

### ✅ Vantagens
- Zero configuração
- Deploy direto
- Não precisa do Android Studio

### 📋 Passo a Passo

#### 1. Instalar Expo CLI
```bash
npm install -g eas-cli
```

#### 2. Fazer login
```bash
eas login
```

#### 3. Configurar projeto
```bash
eas build --platform android --local
```

#### 4. Gerar APK
```bash
eas build --platform android
```

---

## 🔧 Requisitos do Sistema

### Para Windows/Mac/Linux
- Node.js v16+
- JDK 11+ (Java Development Kit)
- Android SDK
- Android Studio (opcional mas recomendado)

### Instalação Rápida (Windows)

```bash
# 1. Instalar JDK
# Download: https://www.oracle.com/java/technologies/javase-jdk11-downloads.html

# 2. Instalar Android SDK
# Download Android Studio: https://developer.android.com/studio

# 3. Configurar variáveis de ambiente
# Adicionar ao PATH:
# C:\Program Files\Android\android-sdk\platform-tools
# C:\Program Files\Android\android-sdk\tools
```

---

## 📤 Publicar na Google Play Store

### Passo 1: Configurar App Signing
```bash
# Gerar keystore (chave de assinatura)
keytool -genkey -v -keystore uber-clone-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias uber-clone
```

### Passo 2: Assinar APK
```bash
# Usar a keystore para assinar
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore uber-clone-key.jks app-release.apk uber-clone
```

### Passo 3: Criar Conta Developer
- Acesse: https://play.google.com/console
- Crie uma conta (custa $25)
- Siga os passos para publicar seu app

### Passo 4: Upload
1. Go to Console > Create app
2. Preencha as informações
3. Upload do APK assinado
4. Aguarde revisão (24-48h)

---

## 🧪 Testar Localmente

### Conectar Celular via USB
```bash
# Ativar Modo Desenvolvedor no celular:
# Configurações > Sobre > Pressione 7x em "Número da compilação"

# Conectar via USB e permitir depuração
# Verificar conexão:
adb devices

# Instalar APK no celular:
adb install app-release.apk
```

### Emulador Android
```bash
# Abrir emulador
emulator -avd Pixel_4_API_30

# Instalar APK
adb install app-release.apk
```

---

## 🐛 Solução de Problemas

### Erro: "Could not find JDK"
```bash
# Windows
set JAVA_HOME=C:\Program Files\Java\jdk-11

# Linux/Mac
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-11.jdk/Contents/Home
```

### Erro: "Android SDK not found"
```bash
# Windows
set ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\sdk

# Linux/Mac
export ANDROID_HOME=~/Android/Sdk
```

### App não carrega
- Verifique se backend está rodando
- Altere IP do backend para o do seu PC (não localhost)
- Exemplo: `REACT_APP_BACKEND_URL=http://192.168.1.100:5000`

---

## 📊 Comparação das Opções

| Opção | Facilidade | Performance | Tempo | Custo |
|-------|-----------|------------|-------|-------|
| Capacitor | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 30min | Grátis |
| React Native | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 2h | Grátis |
| Expo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 15min | Grátis |

---

## ✨ Próximos Passos

1. ✅ Escolha uma opção acima
2. ✅ Siga os passos passo a passo
3. ✅ Teste no seu celular
4. ✅ Publique na Play Store
5. ✅ Compartilhe com seus amigos!

**Dúvidas? Abra uma issue no repositório!** 🚀
