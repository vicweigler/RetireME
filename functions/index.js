const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const ADMIN_EMAIL = 'vicweigler@gmail.com';
const FUNCTIONS_CONFIG_EXPORT = defineSecret('FUNCTIONS_CONFIG_EXPORT');

function registrationEmailKey(email) {
  return encodeURIComponent(String(email || '').trim().toLowerCase());
}

exports.requestRegistration = onRequest(
  { cors: true, secrets: [FUNCTIONS_CONFIG_EXPORT] },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: 'A valid email address is required.' });
      return;
    }
    if (email === ADMIN_EMAIL) {
      res.status(400).json({ ok: false, error: 'The admin account does not require approval.' });
      return;
    }

    try {
      const db = admin.firestore();
      const key = registrationEmailKey(email);
      const ref = db.collection('registrationRequests').doc(key);
      const existingSnap = await ref.get();
      const existing = existingSnap.exists ? existingSnap.data() : null;
      if (existing && String(existing.status || '').toLowerCase() === 'authorized') {
        res.status(200).json({ ok: true, status: 'authorized' });
        return;
      }

      await ref.set({
        email,
        emailKey: key,
        status: 'pending',
        requestedAt: existing && existing.requestedAt ? existing.requestedAt : Date.now(),
        updatedAt: Date.now(),
        reviewedAt: null,
        reviewedBy: null,
      }, { merge: true });

      let config = {};
      try {
        config = JSON.parse(FUNCTIONS_CONFIG_EXPORT.value() || '{}');
      } catch (parseError) {
        throw new Error('Gmail SMTP configuration is not valid JSON.');
      }
      const gmailUser = config.gmail && config.gmail.user;
      const gmailAppPassword = config.gmail && config.gmail.app_password;
      if (!gmailUser || !gmailAppPassword) {
        throw new Error('Gmail SMTP configuration is missing.');
      }

      const nodemailer = require('nodemailer');
      const mailer = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailAppPassword },
      });
      await mailer.sendMail({
        from: `RetireMe <${gmailUser}>`,
        to: ADMIN_EMAIL,
        subject: `RetireMe registration request: ${email}`,
        text: `A new RetireMe user is requesting authorization.\n\nEmail: ${email}\n\nOpen RetireMe, use the Admin button, and authorize or reject this request.`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a"><h2>RetireMe registration request</h2><p>A new user is requesting authorization:</p><p><strong>${email}</strong></p><p>Open RetireMe, use the Admin button, and authorize or reject this request.</p></div>`,
      });

      res.status(200).json({ ok: true, status: 'pending', emailSent: true });
    } catch (err) {
      console.error('[requestRegistration] Error:', err);
      res.status(500).json({ ok: false, error: 'Request saved, but the admin email could not be sent.' });
    }
  }
);

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

exports.authorizeRegistration = onRequest(
  { cors: true, secrets: [FUNCTIONS_CONFIG_EXPORT] },
  async (req, res) => {
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

      const email = String((req.body && req.body.email) || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ ok: false, error: 'A valid email address is required.' });
        return;
      }
      if (email === ADMIN_EMAIL) {
        res.status(400).json({ ok: false, error: 'The admin account does not require approval.' });
        return;
      }

      const db = admin.firestore();
      const key = registrationEmailKey(email);
      await db.collection('registrationRequests').doc(key).set({
        email,
        emailKey: key,
        status: 'authorized',
        updatedAt: Date.now(),
        reviewedAt: Date.now(),
        reviewedBy: ADMIN_EMAIL,
      }, { merge: true });

      let emailSent = false;
      try {
        const config = JSON.parse(FUNCTIONS_CONFIG_EXPORT.value() || '{}');
        const gmailUser = config.gmail && config.gmail.user;
        const gmailAppPassword = config.gmail && config.gmail.app_password;
        if (!gmailUser || !gmailAppPassword) {
          throw new Error('Gmail SMTP configuration is missing.');
        }
        const nodemailer = require('nodemailer');
        const mailer = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailAppPassword },
        });
        await mailer.sendMail({
          from: `RetireMe <${gmailUser}>`,
          to: email,
          subject: 'RetireMe registration approved',
          text: `Good news - your RetireMe registration has been approved.\n\nGo back to RetireMe, re-enter the same email address and password you used to request access, and tap "Create Account" to finish setting up your account.`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a"><h2>RetireMe registration approved</h2><p>Good news — your RetireMe registration has been approved.</p><p>Go back to RetireMe, re-enter the same email address and password you used to request access, and tap <strong>"Create Account"</strong> to finish setting up your account.</p></div>`,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('[authorizeRegistration] Email error:', mailErr);
      }

      res.status(200).json({ ok: true, emailSent });
    } catch (err) {
      res.status(403).json({ ok: false, error: String((err && err.message) || err || 'Request failed') });
    }
  }
);

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
