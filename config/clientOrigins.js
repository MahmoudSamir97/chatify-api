// Origins allowed to call the API / open a socket.
// CLIENT_URL accepts a comma-separated list, BASE_URL (used in email links) is the fallback.
const getClientOrigins = () =>
  (process.env.CLIENT_URL || process.env.BASE_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

module.exports = getClientOrigins;
