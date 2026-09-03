import React, { useState } from 'react';
import axios from 'axios';
import '../styles/DriverRegistration.css';
import { BACKEND_URL } from '../config';

function DriverRegistration({ onRegistrationSubmit }) {
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', cpf: '', driverLicense: '', licensePlate: '',
    vehicleModel: '', vehicleColor: '', vehicleYear: new Date().getFullYear(),
    bankName: '', bankAccount: '', bankRoutingNumber: '', address: '', city: '', state: '', documents: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(file => file.size <= 10 * 1024 * 1024 && /^(application\/pdf|image\/(jpeg|png))$/i.test(file.type));
    setFormData(prev => ({ ...prev, documents: [...prev.documents, ...valid] }));
    if (valid.length !== files.length) setError('Alguns arquivos foram ignorados. Use PDF/JPG/PNG de até 10MB.');
  };
  const handleRemoveDocument = (index) => setFormData(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    if (!formData.fullName || !formData.cpf || !formData.driverLicense) { setError('Preencha todos os campos obrigatórios.'); setLoading(false); return; }
    if (formData.documents.length < 3) { setError('Envie pelo menos 3 documentos.'); setLoading(false); return; }

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Faça login antes de enviar o cadastro.');
      const payload = {
        ...formData,
        bankName: undefined, bankAccount: undefined, bankRoutingNumber: undefined,
        documents: formData.documents.map(doc => ({ name: doc.name, type: doc.type, size: doc.size }))
      };
      const response = await axios.post(`${BACKEND_URL}/api/drivers/register`, payload, { headers: { Authorization: `Bearer ${token}` } });
      const registration = response.data.application || { status: 'pending' };
      const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; } })();
      const updatedUser = { ...currentUser, userType: 'driver', driverApprovalStatus: registration.status || 'pending' };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSuccess('✅ Cadastro enviado com sucesso! Aguarde a aprovação.');
      if (onRegistrationSubmit) setTimeout(() => onRegistrationSubmit(registration), 900);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao enviar cadastro.');
    } finally { setLoading(false); }
  };

  return (
    <div className="driver-registration-container">
      <div className="registration-card">
        <div className="registration-header">
          <h1>🚗 Cadastro de Motorista</h1>
          <p>Preencha o formulário para se tornar um motorista parceiro</p>
          <div className="steps-indicator">
            {[['1','Pessoal'],['2','Veículo'],['3','Banco'],['4','Docs']].map(([number,label]) => <div key={number} className={`step ${step >= Number(number) ? 'active' : ''}`}><span>{number}</span><p>{label}</p></div>)}
          </div>
        </div>
        {error && <div className="error-message">❌ {error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="registration-form">
          {step === 1 && <div className="form-step">
            <h2>Informações Pessoais</h2>
            <div className="form-group"><label htmlFor="fullName">👤 Nome Completo *</label><input id="fullName" type="text" name="fullName" value={formData.fullName} onChange={handleChange} required /></div>
            <div className="form-row"><div className="form-group"><label htmlFor="email">📧 Email *</label><input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required /></div><div className="form-group"><label htmlFor="phone">📱 Telefone *</label><input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} required /></div></div>
            <div className="form-row"><div className="form-group"><label htmlFor="cpf">🆔 CPF *</label><input id="cpf" type="text" name="cpf" value={formData.cpf} onChange={handleChange} required /></div><div className="form-group"><label htmlFor="driverLicense">🎫 CNH *</label><input id="driverLicense" type="text" name="driverLicense" value={formData.driverLicense} onChange={handleChange} required /></div></div>
            <div className="form-group"><label htmlFor="address">📍 Endereço *</label><input id="address" type="text" name="address" value={formData.address} onChange={handleChange} required /></div>
            <div className="form-row"><div className="form-group"><label htmlFor="city">🏙️ Cidade *</label><input id="city" type="text" name="city" value={formData.city} onChange={handleChange} required /></div><div className="form-group"><label htmlFor="state">🗺️ Estado *</label><input id="state" type="text" name="state" value={formData.state} onChange={handleChange} maxLength="2" required /></div></div>
          </div>}

          {step === 2 && <div className="form-step">
            <h2>Informações do Veículo</h2>
            <div className="form-group"><label htmlFor="licensePlate">📋 Placa do Veículo *</label><input id="licensePlate" type="text" name="licensePlate" value={formData.licensePlate} onChange={handleChange} required /></div>
            <div className="form-row"><div className="form-group"><label htmlFor="vehicleModel">🚗 Modelo *</label><input id="vehicleModel" type="text" name="vehicleModel" value={formData.vehicleModel} onChange={handleChange} required /></div><div className="form-group"><label htmlFor="vehicleColor">🎨 Cor *</label><input id="vehicleColor" type="text" name="vehicleColor" value={formData.vehicleColor} onChange={handleChange} required /></div></div>
            <div className="form-group"><label htmlFor="vehicleYear">📅 Ano do Veículo *</label><input id="vehicleYear" type="number" name="vehicleYear" value={formData.vehicleYear} onChange={handleChange} min="2010" max={new Date().getFullYear()} required /></div>
          </div>}

          {step === 3 && <div className="form-step">
            <h2>Dados para recebimento</h2>
            <p className="info-text">💡 A integração de pagamentos será feita por um provedor seguro. Não envie número de cartão ou senha.</p>
            <div className="form-group"><label htmlFor="bankName">🏦 Banco</label><input id="bankName" type="text" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="Opcional nesta etapa" /></div>
            <div className="form-row"><div className="form-group"><label htmlFor="bankRoutingNumber">🔢 Agência</label><input id="bankRoutingNumber" type="text" name="bankRoutingNumber" value={formData.bankRoutingNumber} onChange={handleChange} /></div><div className="form-group"><label htmlFor="bankAccount">💳 Conta</label><input id="bankAccount" type="text" name="bankAccount" value={formData.bankAccount} onChange={handleChange} /></div></div>
          </div>}

          {step === 4 && <div className="form-step">
            <h2>Upload de Documentos</h2><p className="info-text">📎 Envie pelo menos 3 documentos para validação.</p>
            <div className="documents-list"><div className="document-item required"><span>🎫 CNH</span><span className="required-badge">Obrigatório</span></div><div className="document-item required"><span>🏠 Comprovante de Residência</span><span className="required-badge">Obrigatório</span></div><div className="document-item required"><span>📋 CRLV</span><span className="required-badge">Obrigatório</span></div></div>
            <div className="file-upload"><label htmlFor="documents">📤 Selecione os arquivos</label><input id="documents" type="file" name="documents" multiple onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" /><p className="file-info">PDF, JPG ou PNG — máximo 10MB por arquivo.</p></div>
            {formData.documents.length > 0 && <div className="uploaded-files"><h3>📁 Arquivos ({formData.documents.length})</h3>{formData.documents.map((doc, index) => <div key={`${doc.name}-${index}`} className="file-item"><span>✅ {doc.name}</span><button type="button" className="btn-remove" onClick={() => handleRemoveDocument(index)}>✕</button></div>)}</div>}
          </div>}

          <div className="form-navigation">
            {step > 1 && <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>⬅️ Anterior</button>}
            {step < 4 ? <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>Próximo ➡️</button> : <button type="submit" className="btn-primary" disabled={loading}>{loading ? '⏳ Enviando...' : '✨ Enviar Cadastro'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

export default DriverRegistration;
