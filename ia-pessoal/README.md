# IA Pessoal

Assistente de IA pessoal para Android (APK via Capacitor) e também instalável como PWA.

## O que tem

- 💬 Chat com resposta em streaming (aparece palavra por palavra)
- 🔌 3 provedores plugáveis: **OpenAI**, **Google Gemini**, **OpenRouter** — troca pelos Ajustes
- 🎤 Ditado por voz + leitura das respostas em voz alta (pt-BR)
- 🗂️ Várias conversas com histórico salvo **no próprio celular**
- 🧠 Personalidade customizável (prompt de sistema)
- 🎨 Interface dark, pensada pra tela de celular (safe areas, teclado, toque)
- 🔐 A chave de API nunca sai do aparelho — vai direto do app pro provedor

## Rodar no navegador (dev)

```bash
npm install
npm run dev
```

Abra, toque em **⚙ Ajustes**, escolha o provedor e cole sua chave de API:

| Provedor | Onde pegar a chave | Grátis? |
|---|---|---|
| Google Gemini | https://aistudio.google.com/app/apikey | sim, tier gratuito |
| OpenAI | https://platform.openai.com/api-keys | pago |
| OpenRouter | https://openrouter.ai/keys | tem modelos grátis |

> Sugestão pra começar sem gastar: **Gemini** + modelo `gemini-2.0-flash`.

## Gerar o APK

Precisa de **JDK 17** e **Android SDK** instalados (o jeito mais fácil é instalar o [Android Studio](https://developer.android.com/studio)).

```bash
# 1. cria a pasta nativa android/ (só na primeira vez)
npx cap add android

# 2. build + sync + gera o APK de debug
npm run apk
```

O APK sai em:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Copie pro celular, abra o arquivo e autorize "instalar de fontes desconhecidas".

### APK de release (assinado)

```bash
# gera sua chave de assinatura (uma vez, guarde bem esse arquivo!)
keytool -genkey -v -keystore ia-pessoal.keystore \
  -alias iapessoal -keyalg RSA -keysize 2048 -validity 10000
```

Crie `android/key.properties`:

```properties
storeFile=../../ia-pessoal.keystore
storePassword=SUA_SENHA
keyAlias=iapessoal
keyPassword=SUA_SENHA
```

E adicione em `android/app/build.gradle`, dentro de `android { }`:

```gradle
def keyProps = new Properties()
file('../key.properties').withInputStream { keyProps.load(it) }

signingConfigs {
    release {
        storeFile file(keyProps['storeFile'])
        storePassword keyProps['storePassword']
        keyAlias keyProps['keyAlias']
        keyPassword keyProps['keyPassword']
    }
}
buildTypes {
    release { signingConfig signingConfigs.release }
}
```

Depois:

```bash
npm run apk:release
# -> android/app/build/outputs/apk/release/app-release.apk
```

### Sem Android Studio? Build na nuvem

Dá pra gerar o APK pelo GitHub Actions. Crie `.github/workflows/apk.yml`:

```yaml
name: Build APK
on: [push, workflow_dispatch]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - uses: android-actions/setup-android@v3
      - run: npm ci && npm run build && npx cap add android && npx cap sync android
      - run: cd android && chmod +x gradlew && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: app-debug
          path: android/app/build/outputs/apk/debug/app-debug.apk
```

Aí é só baixar o APK na aba **Actions** do GitHub.

## Instalar como PWA (sem APK)

Publique a pasta `dist/` (Vercel, Netlify, GitHub Pages) e, no Chrome do celular, use
**menu ⋮ → Adicionar à tela inicial**. Funciona igual a um app.

## Estrutura

```
src/
  App.jsx               estado geral, envio de mensagens, voz
  lib/ai.js             providers de IA + streaming SSE  ← adicione novos aqui
  lib/storage.js        persistência local
  lib/voice.js          reconhecimento e síntese de fala
  components/
    Composer.jsx        caixa de texto, microfone, enviar/parar
    Message.jsx         balão, markdown leve, copiar/ouvir
    Sidebar.jsx         lista de conversas
    Settings.jsx        provedor, modelo, chave, personalidade
```

### Adicionar um provedor novo

Em `src/lib/ai.js`: adicione uma entrada em `PROVIDERS` e uma função de request.
Se a API for compatível com OpenAI, reaproveite `openaiLike` — só muda a URL.

## Observações

- Reconhecimento de voz usa a Web Speech API (Chrome/WebView Android: ok).
- O histórico fica em `localStorage`; limpar dados do app apaga as conversas.
