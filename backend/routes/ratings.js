const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');
const db = admin.database();

router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const { rideId, rating, comment } = req.body;
    const uid = req.user.uid;
    const score = Number(rating);

    if (!rideId) return res.status(400).json({ error: 'ID da corrida é obrigatório.' });
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'A avaliação deve ser um número inteiro de 1 a 5.' });
    }

    const ride = (await db.ref(`rides/${rideId}`).get()).val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (ride.status !== 'COMPLETED') {
      return res.status(409).json({ error: 'Somente corridas concluídas podem ser avaliadas.' });
    }
    if (ride.userId !== uid && ride.driverId !== uid) {
      return res.status(403).json({ error: 'Você não pertence a esta corrida.' });
    }
    if (!ride.driverId) {
      return res.status(409).json({ error: 'Esta corrida não possui motorista para avaliação.' });
    }

    const targetId = ride.userId === uid ? ride.driverId : ride.userId;
    const markerRef = db.ref(`ratingClaims/${rideId}/${uid}`);
    let claim;
    try {
      claim = await markerRef.transaction((c) => c || { rating: score, claimedAt: admin.database.ServerValue.TIMESTAMP });
    } catch (_) {
      claim = { committed: true, snapshot: { val: () => ({ rating: score }) } };
    }

    if (claim && claim.snapshot && claim.snapshot.val()?.rating !== score) {
      return res.status(409).json({ error: 'Você já avaliou esta corrida.' });
    }

    let existing = null;
    try {
      const rs = await db.ref('ratings').orderByChild('rideId').equalTo(rideId).get();
      rs.forEach((c) => {
        if (c.val()?.raterId === uid) existing = c.val();
      });
    } catch (_) {
      const snap = await db.ref('ratings').get();
      snap.forEach((c) => {
        const val = c.val();
        if (val?.rideId === rideId && val?.raterId === uid) existing = val;
      });
    }

    if (existing) return res.status(409).json({ error: 'Você já avaliou esta corrida.' });

    const ref = db.ref('ratings').push();
    const data = {
      id: ref.key,
      rideId,
      raterId: uid,
      targetId,
      rating: score,
      comment: typeof comment === 'string' ? comment.trim().slice(0, 500) : '',
      createdAt: admin.database.ServerValue.TIMESTAMP,
    };
    await ref.set(data);

    const target = db.ref(`users/${targetId}`);
    await target.child('ratingCount').transaction((c) => (Number(c) || 0) + 1);
    await target.child('ratingSum').transaction((c) => (Number(c) || 0) + score);
    const p = (await target.get()).val() || {};
    const count = Number(p.ratingCount) || 0;
    const sum = Number(p.ratingSum) || 0;
    const avg = count ? Number((sum / count).toFixed(2)) : score;
    await target.child('ratingAverage').set(avg);

    return res.status(201).json({
      success: true,
      rating: data,
      aggregate: { ratingCount: count, ratingAverage: avg },
    });
  } catch (e) {
    console.error('Erro ao registrar avaliação:', e);
    return res.status(500).json({ error: 'Erro interno ao registrar avaliação.' });
  }
});

router.get('/ride/:rideId', async (req, res) => {
  try {
    const ride = (await db.ref(`rides/${req.params.rideId}`).get()).val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (ride.userId !== req.user.uid && ride.driverId !== req.user.uid) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const ratings = [];
    try {
      const s = await db.ref('ratings').orderByChild('rideId').equalTo(req.params.rideId).get();
      s.forEach((c) => ratings.push(c.val()));
    } catch (_) {
      const snap = await db.ref('ratings').get();
      snap.forEach((c) => {
        const val = c.val();
        if (val?.rideId === req.params.rideId) ratings.push(val);
      });
    }

    return res.json({ success: true, ratings });
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno ao buscar avaliações.' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const u = (await db.ref(`users/${req.user.uid}`).get()).val() || {};
    const count = Number(u.ratingCount) || 0;
    const sum = Number(u.ratingSum) || 0;
    return res.json({
      success: true,
      ratingCount: count,
      ratingAverage: count ? Number((sum / count).toFixed(2)) : 0,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno ao buscar resumo de avaliações.' });
  }
});

module.exports = router;
