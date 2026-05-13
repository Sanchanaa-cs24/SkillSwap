const app = require('../backend/server');

module.exports = (req, res) => {
  const { route = '', ...rest } = req.query || {};
  const normalizedRoute = Array.isArray(route) ? route.join('/') : route;
  const searchParams = new URLSearchParams();

  Object.entries(rest).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, String(entry)));
      return;
    }
    if (typeof value !== 'undefined') {
      searchParams.set(key, String(value));
    }
  });

  req.url = `/api${normalizedRoute ? `/${normalizedRoute}` : ''}`;
  const query = searchParams.toString();
  if (query) {
    req.url += `?${query}`;
  }

  return app(req, res);
};
