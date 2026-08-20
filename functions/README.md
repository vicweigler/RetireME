# Admin User Deletion Cloud Function

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
