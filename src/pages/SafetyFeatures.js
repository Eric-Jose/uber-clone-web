import React from 'react';
import '../styles/SafetyFeatures.css';

function SafetyFeatures() {
  const features = [
    {
      icon: '📱',
      title: 'Compartilhamento de Localização',
      description: 'Compartilhe sua localização em tempo real com amigos ou familiares'
    },
    {
      icon: '🆘',
      title: 'Botão de Emergência',
      description: 'Pressione rapidamente para alertar a polícia e nosso suporte'
    },
    {
      icon: '⭐',
      title: 'Avaliações Verificadas',
      description: 'Todos os motoristas têm avaliações de usuários reais e verificados'
    },
    {
      icon: '🛡️',
      title: 'Seguro de Passageiro',
      description: 'Cobertura de até R$ 100.000 em caso de acidentes'
    },
    {
      icon: '🎥',
      title: 'Câmeras no Veículo',
      description: 'Todos os veículos possuem câmeras de segurança ativadas'
    },
    {
      icon: '🔐',
      title: 'Dados Criptografados',
      description: 'Suas informações pessoais são protegidas com criptografia de ponta'
    }
  ];

  return (
    <div className="safety-container">
      <div className="safety-header">
        <h1>🛡️ Sua Segurança é Nossa Prioridade</h1>
        <p>Conheça as medidas que tomamos para protegê-lo</p>
      </div>

      <div className="features-grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="safety-contact">
        <h2>Precisa de Ajuda?</h2>
        <div className="contact-buttons">
          <button className="btn-contact emergency">
            🆘 Emergência: (11) 99999-9999
          </button>
          <button className="btn-contact support">
            💬 Suporte: support@uberclone.com
          </button>
        </div>
      </div>
    </div>
  );
}

export default SafetyFeatures;
