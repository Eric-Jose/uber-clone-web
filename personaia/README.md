# Personaia

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
keytool -genkey -v -keystore personaia.keystore \
  -alias personaia -keyalg RSA -keysize 2048 -validity 10000
```

Crie `android/key.properties`:

```properties
storeFile=../../personaia.keystore
storePassword=SUA_SENHA
keyAlias=personaia
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

### Sem Android Studio? Build na nuvem (recomendado)

Este repo já vem com o workflow `.github/workflows/apk.yml`. Ele roda sozinho a cada
push na `main`, ou manualmente:

1. Vá na aba **Actions** do repositório
2. Escolha **Build APK** → **Run workflow**
3. Quando terminar, baixe o artefato **Personaia-apk**

Descompacte e instale o `app-debug.apk` no celular.

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
