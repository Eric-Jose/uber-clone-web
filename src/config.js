// URL central da API do PreçoFixo17.
// Em produção, o backend está dentro deste mesmo projeto Vercel em /api.
// Portanto, o frontend NUNCA usa uma URL externa configurada por variável
// REACT_APP_BACKEND_URL em produção; isso evita CORS, endpoints antigos e
// o erro genérico "Failed to fetch" no login e nas demais chamadas.
import './styles/PassengerTouchFix.css';

let configuredBackend = (process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/+$/, '');
if (configuredBackend === '/api' || configuredBackend === 'api') {
  configuredBackend = '';
} else if (configuredBackend.endsWith('/api')) {
  configuredBackend = configuredBackend.slice(0, -4);
}

// Usamos a string vazia '' como fallback para que o frontend use rotas relativas (/api/...)
// na mesma origem do app, eliminando erros de CORS e conexão em localhost:5000.
export const BACKEND_URL = configuredBackend;

export default BACKEND_URL;
