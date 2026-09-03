import React, { useState, useEffect, useCallback } from 'react';
import '../styles/AdminPanel.css';

function AdminPanel() {
  const [registrations, setRegistrations] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const loadRegistrations = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('driverRegistrations') || '[]');
      setRegistrations(Array.isArray(stored) ? stored : []);
    } catch (_) {
      setRegistrations([]);
    }
  }, []);

  useEffect(() => {
    loadRegistrations();

    const interval = window.setInterval(loadRegistrations, 3000);
    const handleStorage = (event) => {
      if (!event.key || event.key === 'driverRegistrations') loadRegistrations();
    };
    const handleFocus = () => loadRegistrations();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadRegistrations();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadRegistrations]);

  const handleApprove = (id) => {
    const updated = registrations.map(reg => {
      if (reg.submittedAt === id) {
        return {
          ...reg,
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvalReason: approvalReason
        };
      }
      return reg;
    });
    setRegistrations(updated);
    localStorage.setItem('driverRegistrations', JSON.stringify(updated));
    setSelectedRegistration(null);
    setApprovalReason('');
    alert('✅ Motorista aprovado com sucesso!');
  };

  const handleReject = (id) => {
    const updated = registrations.map(reg => {
      if (reg.submittedAt === id) {
        return {
          ...reg,
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectionReason: rejectionReason
        };
      }
      return reg;
    });
    setRegistrations(updated);
    localStorage.setItem('driverRegistrations', JSON.stringify(updated));
    setSelectedRegistration(null);
    setRejectionReason('');
    alert('❌ Cadastro rejeitado');
  };

  const filteredRegistrations = registrations.filter(reg => reg.status === filter);

  const stats = {
    pending: registrations.filter(r => r.status === 'pending').length,
    approved: registrations.filter(r => r.status === 'approved').length,
    rejected: registrations.filter(r => r.status === 'rejected').length
  };

  return (
    <div className="admin-panel-container">
      <div className="admin-header">
        <h1>🔐 Painel Administrativo</h1>
        <p>Gerenciar cadastros de motoristas</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card pending"><span className="stat-number">{stats.pending}</span><span className="stat-label">Pendentes</span></div>
        <div className="stat-card approved"><span className="stat-number">{stats.approved}</span><span className="stat-label">Aprovados</span></div>
        <div className="stat-card rejected"><span className="stat-number">{stats.rejected}</span><span className="stat-label">Rejeitados</span></div>
      </div>

      <div className="filter-section">
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>⏳ Pendentes</button>
        <button className={`filter-btn ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>✅ Aprovados</button>
        <button className={`filter-btn ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>❌ Rejeitados</button>
      </div>

      <div className="registrations-table">
        <table>
          <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Veículo</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {filteredRegistrations.length > 0 ? filteredRegistrations.map((reg) => (
              <tr key={reg.submittedAt}>
                <td><strong>{reg.fullName}</strong></td><td>{reg.cpf}</td><td>{reg.phone}</td><td>{reg.vehicleModel} - {reg.vehicleColor}</td>
                <td>{new Date(reg.submittedAt).toLocaleDateString('pt-BR')}</td>
                <td><span className={`status-badge ${reg.status}`}>{reg.status === 'pending' ? '⏳ Pendente' : reg.status === 'approved' ? '✅ Aprovado' : '❌ Rejeitado'}</span></td>
                <td><button className="btn-view" onClick={() => setSelectedRegistration(reg)}>👁️ Ver</button></td>
              </tr>
            )) : <tr><td colSpan="7" className="empty-message">📭 Nenhum registro {filter === 'pending' ? 'pendente' : filter === 'approved' ? 'aprovado' : 'rejeitado'}</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedRegistration && (
        <div className="modal-overlay" onClick={() => setSelectedRegistration(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>📋 Detalhes do Cadastro</h2><button className="btn-close" onClick={() => setSelectedRegistration(null)}>✕</button></div>
            <div className="modal-body">
              <section className="info-section"><h3>👤 Informações Pessoais</h3><div className="info-grid">
                <div className="info-item"><label>Nome:</label><span>{selectedRegistration.fullName}</span></div><div className="info-item"><label>Email:</label><span>{selectedRegistration.email}</span></div><div className="info-item"><label>Telefone:</label><span>{selectedRegistration.phone}</span></div><div className="info-item"><label>CPF:</label><span>{selectedRegistration.cpf}</span></div><div className="info-item"><label>CNH:</label><span>{selectedRegistration.driverLicense}</span></div><div className="info-item"><label>Endereço:</label><span>{selectedRegistration.address}</span></div><div className="info-item"><label>Cidade:</label><span>{selectedRegistration.city} - {selectedRegistration.state}</span></div>
              </div></section>
              <section className="info-section"><h3>🚗 Informações do Veículo</h3><div className="info-grid">
                <div className="info-item"><label>Modelo:</label><span>{selectedRegistration.vehicleModel}</span></div><div className="info-item"><label>Cor:</label><span>{selectedRegistration.vehicleColor}</span></div><div className="info-item"><label>Ano:</label><span>{selectedRegistration.vehicleYear}</span></div><div className="info-item"><label>Placa:</label><span>{selectedRegistration.licensePlate}</span></div>
              </div></section>
              <section className="info-section"><h3>🏦 Informações Bancárias</h3><div className="info-grid">
                <div className="info-item"><label>Banco:</label><span>{selectedRegistration.bankName}</span></div><div className="info-item"><label>Agência:</label><span>{selectedRegistration.bankRoutingNumber}</span></div><div className="info-item"><label>Conta:</label><span>{selectedRegistration.bankAccount}</span></div>
              </div></section>
              <section className="info-section"><h3>📁 Documentos ({selectedRegistration.documentCount})</h3><p className="info-text">✅ {selectedRegistration.documentCount} documento(s) enviado(s)</p></section>
              {selectedRegistration.status === 'pending' && <section className="actions-section"><h3>✅ Ação Necessária</h3>
                <div className="action-group"><label htmlFor="approvalReason">💬 Motivo da Aprovação:</label><textarea id="approvalReason" placeholder="Ex: Documentos validados com sucesso" value={approvalReason} onChange={(e) => setApprovalReason(e.target.value)} /><button className="btn-approve" onClick={() => handleApprove(selectedRegistration.submittedAt)}>✅ Aprovar Motorista</button></div>
                <div className="divider">ou</div>
                <div className="action-group"><label htmlFor="rejectionReason">❌ Motivo da Rejeição:</label><textarea id="rejectionReason" placeholder="Ex: CNH vencida, comprovante inválido..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} /><button className="btn-reject" onClick={() => handleReject(selectedRegistration.submittedAt)}>❌ Rejeitar Cadastro</button></div>
              </section>}
              {selectedRegistration.status === 'approved' && <section className="status-section approved"><h3>✅ Cadastro Aprovado</h3><p>Aprovado em: {new Date(selectedRegistration.approvedAt).toLocaleDateString('pt-BR')}</p><p>Motivo: {selectedRegistration.approvalReason}</p></section>}
              {selectedRegistration.status === 'rejected' && <section className="status-section rejected"><h3>❌ Cadastro Rejeitado</h3><p>Rejeitado em: {new Date(selectedRegistration.rejectedAt).toLocaleDateString('pt-BR')}</p><p>Motivo: {selectedRegistration.rejectionReason}</p></section>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
