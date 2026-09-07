// URL central da API do PreçoFixo17.
// Em produção, o frontend usa o backend público do Railway.
// Em desenvolvimento, também usa o mesmo backend para manter o fluxo consistente.
const configuredBackend = process.env.REACT_APP_BACKEND_URL;

export const BACKEND_URL = (
  configuredBackend ||
  'https://precofixo17-backend-production.up.railway.app'
).replace(/\/+$/, '');

export default BACKEND_URL;
