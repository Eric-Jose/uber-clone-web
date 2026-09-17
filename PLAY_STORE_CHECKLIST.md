# PreçoFixo17 — publicação na Google Play

Preparação concluída para gerar o primeiro AAB de produção. O único item operacional pendente é o teste fechado com **12 pessoas**.

## Configuração entregue

- Nome público: PreçoFixo17
- Pacote Android: `com.precofixo17.app`
- Versão inicial: `1.0.0` (`versionCode: 1`)
- Perfil EAS `production` configurado para gerar Android App Bundle (`.aab`)
- Ícone de launcher e ícone adaptativo em `mobile/assets/`
- URL padrão apontando para o app publicado, sem localhost ou backend de demonstração
- Permissões e textos de localização revisados para passageiro e motorista
- Política de privacidade pública: `https://uber-clone-web.vercel.app/privacy.html`
- Guia de build e variáveis de produção documentados em `DEPLOY_APK_GUIDE.md` e `mobile/README.md`

## Ação pendente antes do envio à produção

1. Gerar o AAB assinado: `cd mobile && npx eas build --platform android --profile production`.
2. Criar um teste fechado no Play Console e adicionar **12 testadores**.
3. Distribuir o AAB no canal fechado e registrar o resultado do roteiro: cadastro/login, permissão de localização, passageiro solicitando, motorista aceitando, início/conclusão, histórico, reconexão e localização com tela bloqueada.
4. Depois da aprovação do teste, enviar a versão para produção no Play Console.

> Não há credenciais, keystore ou segredo versionado no repositório. A assinatura deve permanecer na conta EAS/Play Console proprietária do app.

## Declarações no Play Console

Ao preencher a ficha, declarar localização precisa e coleta de dados de conta necessários à operação. A localização em segundo plano deve ser justificada como acompanhamento de corrida ativa; não é usada para publicidade. Informar a URL de privacidade acima e classificar o app como serviço de transporte.
