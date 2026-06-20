const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/categories',   require('./routes/categories'));
app.use('/api/equipment',    require('./routes/equipment'));
app.use('/api/events',       require('./routes/events'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/reports',      require('./routes/reports'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve React frontend (production)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
