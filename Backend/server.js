require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

const firewall = require('./middleware/firewall');
const geoBlock = require('./middleware/geoBlock');
const fileScan = require('./middleware/fileScan');
const firewallRoutes = require('./routes/firewall');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// We must trust proxy if we are behind a reverse proxy for rate limiting
app.set('trust proxy', 1);

const limiter = rateLimit({ 
  windowMs: 10 * 60 * 1000, 
  max: 100,
  message: { error: 'Too many requests' },
  handler: (req, res, next, options) => {
    // Treat excessive rate limiting as an attack
    firewall.logBlock({
      ip_address: req.ip || req.headers['x-forwarded-for'],
      method: req.method,
      path: req.originalUrl,
      reason: 'Rate Limit Exceeded (DDoS/Brute Force)',
      user_agent: req.headers['user-agent']
    });
    res.status(options.statusCode).send(options.message);
  }
});
app.use('/api', limiter);

// 1. WAF runs FIRST - protects everything below
app.use('/api', firewall);
app.use('/api', geoBlock);
app.use('/api', fileScan);

// 2. CSRF & Cookies
app.use(cookieParser());
// Uncomment to enable CSRF when frontend supports credentials & tokens
// const csrfProtection = csrf({ cookie: true });
// app.use('/api', csrfProtection);
// app.get('/api/csrf-token', csrfProtection, (req, res) => res.json({ csrfToken: req.csrfToken() }));

app.use('/api/auth',   require('./routes/auth'));
app.use('/api/risk',   require('./routes/risk'));
app.use('/api/logs',   require('./routes/logs'));
app.use('/api/users',  require('./routes/users'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/firewall', firewallRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serve Frontend Static Files
const path = require('path');
app.use(express.static(path.join(__dirname, '../Frontend')));

// Catch-all route to serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('FC-03 backend running on port ' + PORT + ' (Supabase DB)'));
