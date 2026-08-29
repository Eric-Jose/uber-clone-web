import React, { useState } from 'react';
import '../styles/DriverRegistration.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function DriverRegistration({ onRegistrationSubmit }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cpf: '',
    driverLicense: '',
    licensePlate: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: new Date().getFullYear(),
    bankName: '',
    bankAccount: '',
    bankRoutingNumber: '',
    address: '',
    city: '',
    state: '',
    documents: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, ...files]
    }));
  };

  const handleRemoveDocument = (index) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validação básica
    if (!formData.fullName || !formData.cpf || !formData.driverLicense) {
      setError('Preencha todos os campos obrigatórios');
      setLoading(false);
      return;
    }

    if (formData.documents.length < 3) {
      setError('Envie pelo menos 3 documentos (CNH, Comprovante de Residência, Registro do Veículo)');
      setLoading(false);
      return;
    }

    try {
      // Simulação de envio - em produção, você enviaria para o backend
      const registration = {
        ...formData,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        documentCount: formData.documents.length
      };

      // Salvar no localStorage para simular backend
      const existingRegistrations = JSON.parse(localStorage.getItem('driverRegistrations') || '[]');
      existingRegistrations.push(registration);
      localStorage.setItem('driverRegistrations', JSON.stringify(existingRegistrations));

      setSuccess('✅ Cadastro enviado com sucesso! Aguarde a aprovação.');
      setTimeout(() => {
        onRegistrationSubmit(registration);
      }, 2000);
    } catch (err) {
      setError('Erro ao enviar cadastro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="driver-registration-container">
      <div className="registration-card">
        <div className="registration-header">
          <h1>🚗 Cadastro de Motorista</h1>
          <p>Preencha o formulário para se tornar um motorista parceiro</p>
          <div className="steps-indicator">
            <div className={`step ${step >= 1 ? 'active' : ''}`}>
              <span>1</span>
              <p>Pessoal</p>
            </div>
            <div className={`step ${step >= 2 ? 'active' : ''}`}>
              <span>2</span>
              <p>Veículo</p>
            </div>
            <div className={`step ${step >= 3 ? 'active' : ''}`}>
              <span>3</span>
              <p>Banco</p>
            </div>
            <div className={`step ${step >= 4 ? 'active' : ''}`}>
              <span>4</span>
              <p>Docs</p>
            </div>
          </div>
        </div>

        {error && <div className="error-message">❌ {error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="registration-form">
          {/* ETAPA 1: Informações Pessoais */}
          {step === 1 && (
            <div className="form-step">
              <h2>Informações Pessoais</h2>
              <div className="form-group">
                <label htmlFor="fullName">👤 Nome Completo *</label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  placeholder="Seu nome completo"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">📧 Email *</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">📱 Telefone *</label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cpf">🆔 CPF *</label>
                  <input
                    id="cpf"
                    type="text"
                    name="cpf"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="driverLicense">🎫 CNH *</label>
                  <input
                    id="driverLicense"
                    type="text"
                    name="driverLicense"
                    placeholder="1234567890"
                    value={formData.driverLicense}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="address">📍 Endereço *</label>
                <input
                  id="address"
                  type="text"
                  name="address"
                  placeholder="Rua, número, complemento"
                  value={formData.address}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="city">🏙️ Cidade *</label>
                  <input
                    id="city"
                    type="text"
                    name="city"
                    placeholder="São Paulo"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="state">🗺️ Estado *</label>
                  <input
                    id="state"
                    type="text"
                    name="state"
                    placeholder="SP"
                    value={formData.state}
                    onChange={handleChange}
                    maxLength="2"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 2: Informações do Veículo */}
          {step === 2 && (
            <div className="form-step">
              <h2>Informações do Veículo</h2>
              <div className="form-group">
                <label htmlFor="licensePlate">📋 Placa do Veículo *</label>
                <input
                  id="licensePlate"
                  type="text"
                  name="licensePlate"
                  placeholder="ABC-1234"
                  value={formData.licensePlate}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="vehicleModel">🚗 Modelo *</label>
                  <input
                    id="vehicleModel"
                    type="text"
                    name="vehicleModel"
                    placeholder="Honda Civic"
                    value={formData.vehicleModel}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="vehicleColor">🎨 Cor *</label>
                  <input
                    id="vehicleColor"
                    type="text"
                    name="vehicleColor"
                    placeholder="Preto"
                    value={formData.vehicleColor}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="vehicleYear">📅 Ano do Veículo *</label>
                <input
                  id="vehicleYear"
                  type="number"
                  name="vehicleYear"
                  placeholder="2020"
                  value={formData.vehicleYear}
                  onChange={handleChange}
                  min="2010"
                  max={new Date().getFullYear()}
                  required
                />
              </div>
            </div>
          )}

          {/* ETAPA 3: Informações Bancárias */}
          {step === 3 && (
            <div className="form-step">
              <h2>Informações Bancárias</h2>
              <p className="info-text">💡 Estas informações são usadas para suas receitas</p>

              <div className="form-group">
                <label htmlFor="bankName">🏦 Banco *</label>
                <input
                  id="bankName"
                  type="text"
                  name="bankName"
                  placeholder="Banco do Brasil"
                  value={formData.bankName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bankRoutingNumber">🔢 Agência *</label>
                  <input
                    id="bankRoutingNumber"
                    type="text"
                    name="bankRoutingNumber"
                    placeholder="0001"
                    value={formData.bankRoutingNumber}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="bankAccount">💳 Conta *</label>
                  <input
                    id="bankAccount"
                    type="text"
                    name="bankAccount"
                    placeholder="123456-7"
                    value={formData.bankAccount}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 4: Documentos */}
          {step === 4 && (
            <div className="form-step">
              <h2>Upload de Documentos</h2>
              <p className="info-text">📎 Envie os documentos para validação (mínimo 3)</p>

              <div className="documents-list">
                <div className="document-item required">
                  <span>🎫 CNH (Carteira de Motorista)</span>
                  <span className="required-badge">Obrigatório</span>
                </div>
                <div className="document-item required">
                  <span>🏠 Comprovante de Residência</span>
                  <span className="required-badge">Obrigatório</span>
                </div>
                <div className="document-item required">
                  <span>📋 Registro do Veículo (CRLV)</span>
                  <span className="required-badge">Obrigatório</span>
                </div>
                <div className="document-item">
                  <span>💳 Documento de Identidade (RG/Passaporte)</span>
                  <span className="optional-badge">Opcional</span>
                </div>
              </div>

              <div className="file-upload">
                <label htmlFor="documents">📤 Clique ou arraste arquivos aqui</label>
                <input
                  id="documents"
                  type="file"
                  name="documents"
                  multiple
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <p className="file-info">Formatos aceitos: PDF, JPG, PNG (máx 10MB cada)</p>
              </div>

              {formData.documents.length > 0 && (
                <div className="uploaded-files">
                  <h3>📁 Arquivos Enviados ({formData.documents.length})</h3>
                  {formData.documents.map((doc, index) => (
                    <div key={index} className="file-item">
                      <span>✅ {doc.name}</span>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => handleRemoveDocument(index)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botões de Navegação */}
          <div className="form-navigation">
            {step > 1 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(step - 1)}
              >
                ⬅️ Anterior
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep(step + 1)}
              >
                Próximo ➡️
              </button>
            ) : (
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? '⏳ Enviando...' : '✨ Enviar Cadastro'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default DriverRegistration;
