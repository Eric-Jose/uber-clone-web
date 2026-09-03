const admin = require('firebase-admin');

let firebaseAdminReady = false;

function getFirebaseAdmin() {
  if (firebaseAdminReady) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  }

  firebaseAdminReady = true;
  return admin;
}

module.exports = { getFirebaseAdmin };
