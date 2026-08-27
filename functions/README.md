# Admin User Deletion Cloud Function

## Registration Request Email

`requestRegistration` writes the pending request to `registrationRequests` and sends an email to `vicweigler@gmail.com` using Gmail SMTP. Configure the sender credentials as a Firebase Secret Manager JSON secret; do not put them in source control.

From the repository root, run:

```bash
firebase functions:secrets:set FUNCTIONS_CONFIG_EXPORT --format json
```

When prompted, enter:

```json
{"gmail":{"user":"your-sending-gmail@gmail.com","app_password":"your-16-character-gmail-app-password"}}
```

Use a Gmail App Password, not the normal Gmail password. Then deploy:

```bash
firebase deploy --only functions:requestRegistration --project retireme-prod
```

The production frontend is configured to call:

```text
https://us-central1-retireme-prod.cloudfunctions.net/requestRegistration
```

## Registration Approval Email

`authorizeRegistration` marks a `registrationRequests` doc as `authorized` and emails the applicant, telling them to return to RetireMe, re-enter the same email/password, and tap "Create Account" to finish. It requires the same `FUNCTIONS_CONFIG_EXPORT` Gmail secret as `requestRegistration`, plus the caller's Firebase ID token (admin only).

```bash
firebase deploy --only functions:authorizeRegistration --project retireme-prod
```

The production frontend is configured to call:

```text
https://us-central1-retireme-prod.cloudfunctions.net/authorizeRegistration
```

This function allows the RetireMe admin account (`vicweigler@gmail.com`) to delete:

- Firebase Auth user account
- `users/{uid}/apps/*`
- `users/{uid}`
- `publicProfiles/{uid}`
- `sharedPortfolios` where `fromUid == uid` or `toUid == uid`

## Deploy

1. Install Firebase CLI and authenticate.
2. From this folder:

```bash
npm install
firebase deploy --only functions:adminDeleteUser
```

3. Copy deployed HTTPS URL and set it in `firebase-config.js`:

```js
window.RETIREME_ADMIN_DELETE_USER_URL = 'https://<region>-<project>.cloudfunctions.net/adminDeleteUser';
```

4. Refresh the app.

## Security

- Requires a valid Firebase ID token in `Authorization: Bearer <token>`.
- Server verifies caller email is exactly `vicweigler@gmail.com`.
- Client-side checks alone are not relied upon.
