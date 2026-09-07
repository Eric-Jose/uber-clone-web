// URL central da API do PreçoFixo17.
// O backend de produção está dentro deste mesmo projeto Vercel, em /api.
// Em desenvolvimento, usa REACT_APP_BACKEND_URL quando definida; caso contrário,
// mantém a API relativa para que o front continue compatível com o backend unificado.
const configuredBackend = process.env.REACT_APP_BACKEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

export const BACKEND_URL = (
  configuredBackend ||
  (isProduction ? '' : 'http://localhost:5000')
).replace(/\/+$/, '');

export default BACKEND_URL;
