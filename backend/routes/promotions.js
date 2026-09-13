const express = require('express');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const db = admin.database();
router.use(authenticate);

function asList(value) {
  if (Array.isArray(value)) return value.map((item, index) => [String(item?.id || index), item]);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value);
}

function isExpired(promotion) {
  const raw = promotion.expiresAt || promotion.expirationDate || promotion.expiresOn;
  if (!raw) return false;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function publicPromotion(id, promotion = {}) {
  return {
    id,
    code: String(promotion.code || '').trim().toUpperCase(),
    description: String(promotion.description || '').trim(),
    discount: Number(promotion.discount || 0),
    type: promotion.type || 'percentage',
    expiresIn: promotion.expiresIn || '',
    expiresAt: promotion.expiresAt || promotion.expirationDate || null,
    icon: promotion.icon || '🏷️',
    used: promotion.used === true,
  };
}

router.get('/', async (_req, res) => {
  try {
    const snapshot = await db.ref('promotions').get();
    const promotions = asList(snapshot.val())
      .map(([id, value]) => publicPromotion(id, value))
      .filter((promotion) => promotion.code && promotion.used !== true)
      .filter((promotion) => !isExpired(promotion));
    return res.json({ total: promotions.length, promotions });
  } catch (error) {
    console.error('Erro ao listar promoções:', error.message);
    return res.status(500).json({ error: 'Erro ao listar promoções.' });
  }
});

module.exports = router;
