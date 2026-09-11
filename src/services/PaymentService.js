import React from 'react';
import { BACKEND_URL } from '../config';

class PaymentService {
  // Processar pagamento com cartão
  async processCardPayment(rideId, amount, cardData) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId,
          amount,
          paymentMethod: 'card',
          cardData
        })
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      throw error;
    }
  }

  // Processar PIX
  async processPIXPayment(rideId, amount) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, amount })
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao processar PIX:', error);
      throw error;
    }
  }

  // Obter histórico de pagamentos
  async getPaymentHistory(userId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/payments/history/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao obter histórico:', error);
      throw error;
    }
  }

  // Reembolsar pagamento
  async refundPayment(paymentId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/payments/refund/${paymentId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer reembolso:', error);
      throw error;
    }
  }
}

export default new PaymentService();
