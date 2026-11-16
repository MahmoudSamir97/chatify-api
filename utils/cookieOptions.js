const isProduction = () => process.env.NODE_ENV === 'production';

// In production the client and API live on different sites, so the cookie
// must be `SameSite=None; Secure`. Locally both run on localhost (same site).
const authCookieOptions = () => ({
  httpOnly: true,
  sameSite: isProduction() ? 'none' : 'lax',
  secure: isProduction(),
});

module.exports = authCookieOptions;
