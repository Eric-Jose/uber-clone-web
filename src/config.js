// URL central da API.
// Em produção no Vercel, o frontend chama o backend pela mesma origem (/api).
// Em desenvolvimento, mantém o Railway como fallback para não quebrar o fluxo local.
const configuredBackend = process.env.REACT_APP_BACKEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

export const BACKEND_URL = (
  configuredBackend ||
  (isProduction ? '' : 'https://uber-clone-backend-production.up.railway.app')
).replace(/\/+$/, '');

export default BACKEND_URL;
