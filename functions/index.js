const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const ADMIN_EMAIL = 'vicweigler@gmail.com';

async function verifyAdminCaller(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new Error('Empty bearer token');

  const decoded = await admin.auth().verifyIdToken(token);
  const caller = await admin.auth().getUser(decoded.uid);
  const callerEmail = String(caller.email || '').trim().toLowerCase();
  if (callerEmail !== ADMIN_EMAIL) {
    throw new Error('Caller is not authorized');
  }
  return caller;
}

async function deleteUserFirestoreData(targetUid) {
  const db = admin.firestore();
  const userDoc = db.collection('users').doc(targetUid);

  // Delete user app docs under users/{uid}/apps/* first.
  const appsSnap = await userDoc.collection('apps').get();
  const appDeletes = [];
  appsSnap.forEach((d) => appDeletes.push(d.ref.delete()));
  await Promise.all(appDeletes);

  await Promise.all([
    userDoc.delete(),
    db.collection('publicProfiles').doc(targetUid).delete(),
  ]);

  const sharedFrom = await db.collection('sharedPortfolios').where('fromUid', '==', targetUid).get();
  const sharedFromDeletes = [];
  sharedFrom.forEach((d) => sharedFromDeletes.push(d.ref.delete()));

  const sharedTo = await db.collection('sharedPortfolios').where('toUid', '==', targetUid).get();
  const sharedToDeletes = [];
  sharedTo.forEach((d) => sharedToDeletes.push(d.ref.delete()));

  await Promise.all([...sharedFromDeletes, ...sharedToDeletes]);
}

exports.adminDeleteUser = onRequest({ cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    await verifyAdminCaller(req);

    const targetUid = String((req.body && req.body.uid) || '').trim();
    if (!targetUid) {
      res.status(400).json({ ok: false, error: 'Missing uid' });
      return;
    }

    if (targetUid === (await admin.auth().getUserByEmail(ADMIN_EMAIL)).uid) {
      res.status(400).json({ ok: false, error: 'Cannot delete admin account' });
      return;
    }

    await deleteUserFirestoreData(targetUid);

    try {
      await admin.auth().deleteUser(targetUid);
    } catch (err) {
      if (!err || err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(403).json({ ok: false, error: String((err && err.message) || err || 'Request failed') });
  }
});
