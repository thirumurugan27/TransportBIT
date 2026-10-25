const crypto = require('crypto');
const axios = require('axios');
const db = require('../../config/db');
const { generateToken } = require('../../utils/token');

const GOOGLE_OAUTH_STATE_COOKIE = 'GOOGLE_OAUTH_STATE';

function frontendURL() {
  const url = (process.env.FRONTEND_URL || '').trim();
  return url || 'http://localhost:5173';
}

function oauthErrorPage(res, errorMsg) {
  const feURL = frontendURL();
  const escapedError = JSON.stringify(errorMsg);
  const escapedFeURL = JSON.stringify(feURL);
  const html = `<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title></head>
<body>
  <script>
    (function () {
      var payload = { source: "google-oauth", success: false, error: ${escapedError} };
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, ${escapedFeURL});
        window.close();
        return;
      }
      window.location.replace(${escapedFeURL} + "/login?error=" + encodeURIComponent(payload.error));
    })();
  </script>
</body>
</html>`;
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.status(200).send(html);
}

function oauthSuccessPage(res) {
  const feURL = frontendURL();
  const escapedFeURL = JSON.stringify(feURL);
  const html = `<!DOCTYPE html>
<html>
<head><title>Logged In</title></head>
<body>
  <script>
    (function () {
      var payload = { source: "google-oauth", success: true };
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, ${escapedFeURL});
        window.close();
        return;
      }
      window.location.replace(${escapedFeURL});
    })();
  </script>
</body>
</html>`;
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.status(200).send(html);
}

function googleLogin(req, res) {
  const state = crypto.randomBytes(32).toString('base64url');
  const isProduction = process.env.ENV === 'production';
  res.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, {
    maxAge: 600 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URL || 'http://localhost:8080/auth/google/callback';
  const scope = encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;

  res.redirect(authUrl);
}

async function googleCallback(req, res) {
  try {
    const { state, code } = req.query;
    const storedState = req.cookies ? req.cookies[GOOGLE_OAUTH_STATE_COOKIE] : null;

    if (!state || !storedState || state !== storedState) {
      return oauthErrorPage(res, 'Google sign-in verification failed');
    }

    const isProduction = process.env.ENV === 'production';
    res.cookie(GOOGLE_OAUTH_STATE_COOKIE, '', {
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/'
    });

    if (!code) {
      return oauthErrorPage(res, 'Google authorization code not found');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URL || 'http://localhost:8080/auth/google/callback';

    // Token exchange
    let tokenRes;
    try {
      tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });
    } catch (err) {
      console.error('Google token exchange failed:', err.response?.data || err.message);
      return oauthErrorPage(res, 'Failed to verify Google account');
    }

    const accessToken = tokenRes.data.access_token;
    let userInfoRes;
    try {
      userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (err) {
      console.error('Google userinfo lookup failed:', err.response?.data || err.message);
      return oauthErrorPage(res, 'Failed to fetch Google profile');
    }

    const googleUser = userInfoRes.data;
    if (!googleUser || !googleUser.email || !googleUser.email.trim()) {
      return oauthErrorPage(res, 'Google account email is required');
    }

    const email = googleUser.email.trim();
    const [users] = await db.query(
      'SELECT id, COALESCE(username, "") AS username, COALESCE(role, "") AS role, full_name, COALESCE(email, "") AS email FROM users WHERE email=? OR username=?',
      [email, email]
    );

    if (!users || users.length === 0) {
      return oauthErrorPage(res, 'No account is linked to this Google email');
    }

    const user = users[0];
    if (!user.role || !user.role.trim()) {
      return oauthErrorPage(res, 'Your account is not configured for sign-in');
    }

    const username = user.username && user.username.trim() ? user.username.trim() : email;
    const jwtToken = generateToken(user.id, username, user.role);

    res.cookie('TRANSPORT_AUTH', jwtToken, {
      maxAge: 3600 * 24 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/'
    });

    return oauthSuccessPage(res);
  } catch (err) {
    console.error('Google auth error:', err);
    return oauthErrorPage(res, 'Server error during sign-in');
  }
}

module.exports = {
  googleLogin,
  googleCallback
};
