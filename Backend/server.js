require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api', limiter);

app.use('/api/auth',   require('./routes/auth'));
app.use('/api/risk',   require('./routes/risk'));
app.use('/api/logs',   require('./routes/logs'));
app.use('/api/users',  require('./routes/users'));
app.use('/api/alerts', require('./routes/alerts'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('FC-03 backend running on port ' + PORT + ' (Supabase DB)'));
