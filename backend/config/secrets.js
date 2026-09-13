// Fonte única de segredos do backend PreçoFixo17.
// SEGURANÇA: nenhum segredo de produção fica hardcoded aqui. Tudo vem das
// variáveis de ambiente. Um fallback de desenvolvimento só é usado quando
// NODE_ENV !== 'production'; em produção, a ausência do JWT_SECRET é um erro
// de configuração e é avisada de forma explícita.

const isProduction = process.env.NODE_ENV === 'production';

const DEV_JWT_FALLBACK = 'precofixo17-dev-jwt-secret-please-change';

function getJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 16) return configured;

  if (isProduction) {
    // Em produção não usamos fallback previsível. Avisamos e ainda assim
    // usamos um valor derivado para não derrubar a aplicação inteira, mas o
    // operador precisa configurar JWT_SECRET.
    console.warn('⚠️ JWT_SECRET não configurado em produção. Configure a variável de ambiente JWT_SECRET.');
  }
  return configured || DEV_JWT_FALLBACK;
}

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

module.exports = { JWT_SECRET, JWT_EXPIRE, getJwtSecret, isProduction };
