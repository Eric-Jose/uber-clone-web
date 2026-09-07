// URL central da API do PreçoFixo17.
// Em produção, o backend está dentro deste mesmo projeto Vercel em /api.
// Portanto, o frontend NUNCA usa uma URL externa configurada por variável
// REACT_APP_BACKEND_URL em produção; isso evita CORS, endpoints antigos e
// o erro genérico "Failed to fetch" no login e nas demais chamadas.
const configuredBackend = process.env.REACT_APP_BACKEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

export const BACKEND_URL = (
  isProduction ? '' : (configuredBackend || 'http://localhost:5000')
).replace(/\/+$/, '');

export default BACKEND_URL;
