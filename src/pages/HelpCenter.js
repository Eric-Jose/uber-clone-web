import React, { useState } from 'react';

const FAQ_ITEMS = [
  {
    q: 'Como funciona o Preço Fixo de R$ 17,00?',
    a: 'Todas as corridas urbanas dentro do perímetro atendido têm o valor fixo garantido de R$ 17,00, sem tarifas dinâmicas ou cobranças extras por trânsito.'
  },
  {
    q: 'Como pagar em dinheiro ou Pix?',
    a: 'Você pode selecionar a forma de pagamento ao solicitar a corrida. Para dinheiro, informe o valor para cálculo de troco com o motorista. Para Pix, a chave oficial é informada ao finalizar a corrida.'
  },
  {
    q: 'O que fazer se esquecer um objeto no carro?',
    a: 'Entre em contato com nossa central de suporte imediatamente pelo WhatsApp de atendimento com a data e horário aproximado da corrida para localizarmos o motorista parceiro.'
  },
  {
    q: 'Como me cadastrar como motorista parceiro?',
    a: 'Basta acessar a opção de cadastro no menu ou na página inicial e enviar sua CNH com EAR e foto do veículo para aprovação da equipe.'
  }
];

export default function HelpCenter({ onBack }) {
  const [openIndex, setOpenIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopyWhatsapp = () => {
    navigator.clipboard?.writeText?.('(11) 98765-4321');
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="pf-help-screen" style={{
      minHeight: '100vh',
      background: '#050505',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px 16px 40px',
      maxWidth: 480,
      margin: '0 auto'
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: '#121417',
            border: '1px solid #282f3a',
            color: '#ffffff',
            width: 38,
            height: 38,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16
          }}
          aria-label="Voltar"
        >
          ←
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Central de Ajuda</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#8b949e' }}>Suporte 24h PreçoFixo17</p>
        </div>
      </div>

      {/* Quick Channels Card */}
      <div style={{
        background: '#0e1116',
        border: '1px solid #21262d',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#22c55e22',
            color: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22
          }}>
            💬
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Atendimento WhatsApp</div>
            <div style={{ fontSize: 12, color: '#8b949e' }}>Disponível todos os dias das 06h às 23h</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyWhatsapp}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            background: '#ff5a00',
            border: 'none',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <span>📱</span>
          {copied ? 'Número copiado: (11) 98765-4321' : 'Falar pelo WhatsApp: (11) 98765-4321'}
        </button>
      </div>

      {/* Emergency Assistance */}
      <div style={{
        background: '#181010',
        border: '1px solid #ff444444',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <span style={{ fontSize: 24 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b' }}>Segurança & Emergência</div>
          <div style={{ fontSize: 12, color: '#c9d1d9' }}>Polícia Militar: 190 | SAMU: 192</div>
        </div>
      </div>

      {/* FAQ Section */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#ff5a00' }}>
        Dúvidas Frequentes
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FAQ_ITEMS.map((item, idx) => (
          <div
            key={idx}
            style={{
              background: '#0e1116',
              border: openIndex === idx ? '1px solid #ff5a00' : '1px solid #1c2128',
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'border-color 0.2s ease'
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{item.q}</span>
              <span style={{ color: '#ff5a00', fontSize: 18 }}>{openIndex === idx ? '−' : '+'}</span>
            </button>
            {openIndex === idx && (
              <div style={{
                padding: '0 16px 14px',
                color: '#8b949e',
                fontSize: 13,
                lineHeight: 1.6
              }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Back Button */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            color: '#c9d1d9',
            padding: '10px 24px',
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          Voltar para as corridas
        </button>
      </div>
    </div>
  );
}
