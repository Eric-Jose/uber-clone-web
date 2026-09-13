# PreçoFixo17 Mobile

Aplicativo móvel Android/iOS do PreçoFixo17. O APK usa a mesma aplicação web e o mesmo backend oficial do projeto, mantendo login, mapa, solicitação de corrida, despacho, aceite, localização, histórico e perfil sincronizados entre dispositivos.

> Pagamentos continuam fora desta etapa, conforme definido no projeto.

## O que está funcionando

- Login e cadastro pelo aplicativo web embutido.
- Localização em primeiro plano para passageiro e motorista.
- Solicitação de corrida com origem e destino reais.
- Despacho para motoristas aprovados e online.
- Aceite da corrida, rota até o passageiro e rota até o destino.
- Atualização de localização do passageiro e do motorista.
- Histórico, notificações, perfil e avaliações disponíveis no mesmo app.
- Sincronização nativa em segundo plano durante uma sessão autenticada:
  - motorista atualiza presença e localização no backend;
  - passageiro envia a localização da corrida ativa.
- Tela de erro com opção de tentar novamente quando a conexão cair.

## Instalação

```bash
cd mobile
npm install
```

O endereço padrão é `https://uber-clone-web.vercel.app/`. Para testar uma Preview ou outro ambiente:

```bash
EXPO_PUBLIC_WEB_APP_URL=https://seu-preview.vercel.app/ npx expo start
```

## Testar

```bash
npm start
npm run android
npm run ios
```

A localização em segundo plano precisa de um desenvolvimento nativo ou build EAS. O Expo Go pode executar a interface, mas não representa todas as permissões de background do APK final.

## Build Android

```bash
npx eas build --platform android --profile preview   # APK para testes
npx eas build --platform android --profile production # AAB para Play Store
```

No Android, o aplicativo solicita localização em primeiro plano e em segundo plano. A atualização em background só deve ser usada durante uma sessão autenticada e uma corrida/escala operacional ativa.

## Variáveis

- `EXPO_PUBLIC_WEB_APP_URL`: URL da aplicação web que o WebView deve abrir.
- O backend é usado pela mesma origem (`/api`), evitando chamadas para `localhost` ou para o antigo Railway.

## Identidade do aplicativo

- Nome: PreçoFixo17
- Slug: `precofixo17`
- Android package: `com.precofixo17.app`
- iOS bundle identifier: `com.precofixo17.app`
