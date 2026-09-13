# Build nativo do PreçoFixo17

O aplicativo móvel está em `mobile/` e usa Expo SDK 50 com um WebView da aplicação oficial. O APK não usa backend local, Railway, nomes de demonstração ou uma API paralela: a URL padrão é a aplicação publicada na Vercel.

## Pré-requisitos

- Node.js compatível com Expo SDK 50.
- Conta Expo/EAS para gerar um APK assinado.
- Android Studio/ADB somente se quiser instalar e depurar localmente.
- Firebase real configurado no projeto Vercel para preservar usuários e corridas.

## Instalar e validar

```bash
cd mobile
npm install
npx expo config --type public
```

A URL padrão é:

```text
https://uber-clone-web.vercel.app/
```

Para uma Preview específica, passe a URL no momento do build:

```bash
EXPO_PUBLIC_WEB_APP_URL=https://sua-preview.vercel.app/ npx expo start
```

Não configure `localhost` no APK: o celular não consegue acessar o localhost do computador como se fosse o próprio aparelho.

## APK de testes via EAS

```bash
cd mobile
npm install -g eas-cli
eas login
npx eas build --platform android --profile preview
```

O perfil `preview` gera um APK de distribuição interna. Baixe o artefato indicado pelo EAS e instale-o em pelo menos um aparelho de passageiro e um aparelho de motorista.

## Versão de loja

```bash
cd mobile
npx eas build --platform android --profile production
```

O perfil `production` gera um AAB para a Google Play. A assinatura deve ser mantida na conta EAS da organização; não versione keystores no repositório.

## Localização e permissões

O aplicativo solicita localização em primeiro plano e, quando a sessão é autenticada, localização em segundo plano. O Android usa um serviço em primeiro plano para manter a corrida atualizada; o iOS declara o modo de background de localização.

O WebView sincroniza a sessão real (`localStorage.token` e `localStorage.user`) com o módulo nativo. Durante uma corrida:

- motorista: envia GPS e heartbeat para `/api/drivers/:uid/status`;
- passageiro: envia GPS para `/api/rides/:id/passenger-location` somente quando existe corrida ativa.

Se o usuário negar GPS, a origem da corrida não é inventada: o passageiro deve permitir a localização real do aparelho antes de solicitar.

## Checklist antes de publicar

1. Confirmar `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` e `JWT_SECRET` nos ambientes Vercel.
2. Abrir o site publicado e confirmar login, cadastro e persistência após recarregar.
3. Instalar o APK em dois aparelhos físicos com localização habilitada.
4. Testar motorista aprovado online, passageiro solicitando, aceite, chegada, início e conclusão.
5. Bloquear a tela do aparelho e confirmar que o heartbeat continua durante uma corrida ativa.
6. Testar GPS negado, perda de internet e retomada após reconexão.
7. Confirmar que um motorista sem heartbeat recente não recebe novas corridas.

Pagamentos continuam fora do escopo desta versão e não são processados pelo aplicativo.
