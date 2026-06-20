const express = require('express');
const cors = require('cors');
const path = require('path');

require('./seed');

const { requireAuth } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/categories',   requireAuth, require('./routes/categories'));
app.use('/api/equipment',    requireAuth, require('./routes/equipment'));
app.use('/api/events',       requireAuth, require('./routes/events'));
app.use('/api/transactions', requireAuth, require('./routes/transactions'));
app.use('/api/reports',      requireAuth, require('./routes/reports'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve React frontend (production)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
