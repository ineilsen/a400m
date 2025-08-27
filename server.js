const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const config = require('./server/config');
const aiRouteFactory = require('./server/routes/ai');

const app = express();
const PORT = config.port || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// simple GET/PUT to persist gesture tuner settings
const TUNER_FILE = path.join(__dirname, 'data', 'tuner.json');
app.get('/api/tuner', (req, res) => {
  fs.readFile(TUNER_FILE, 'utf8', (err, data) => {
    if (err) return res.json({});
    try { return res.json(JSON.parse(data)); } catch(e) { return res.json({}); }
  });
});

app.put('/api/tuner', (req, res) => {
  const payload = req.body || {};
  fs.writeFile(TUNER_FILE, JSON.stringify(payload, null, 2), (err) => {
    if (err) return res.status(500).json({ error: 'failed to save' });
    return res.json({ saved: true });
  });
});

// flights API - list available flights
app.get('/api/flights', (req, res) => {
  fs.readFile(config.flightsFile, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'failed to read flights' });
    try { const payload = JSON.parse(data); return res.json(payload); } catch(e) { return res.status(500).json({ error: 'invalid flights file' }); }
  });
});

// squadron summary: totals and deployable/in-service counts
app.get('/api/squadron-summary', (req, res) => {
  fs.readFile(config.flightsFile, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'failed to read flights' });
    try {
      const payload = JSON.parse(data);
      const all = (payload.flights || []);
      const statusRank = { 'Good': 0, 'Warning': 1, 'Critical': 2 };
      let total = all.length;
      let countGoodFlights = 0, countWarningFlights = 0, countCriticalFlights = 0;
      let deployableCount = 0;
      const perFlight = all.map(f => {
        const comps = f.components || [];
        let worst = 0;
        comps.forEach(c => {
          const r = statusRank[c.status] !== undefined ? statusRank[c.status] : 1;
          if (r > worst) worst = r;
        });
        if (worst === 2) countCriticalFlights++; else if (worst === 1) countWarningFlights++; else countGoodFlights++;
        if (worst < 2) deployableCount++;
        return { id: f.id, displayName: f.displayName, worstStatus: worst === 2 ? 'Critical' : (worst === 1 ? 'Warning' : 'Good') };
      });
      const inServiceCount = total - deployableCount;
      const deployablePct = total > 0 ? Math.round((deployableCount/total)*100) : 0;
      return res.json({ totalFlights: total, flightsAllGood: countGoodFlights, flightsWithWarnings: countWarningFlights, flightsWithCritical: countCriticalFlights, deployableCount, deployablePct, inServiceCount, perFlight });
    } catch(e) { return res.status(500).json({ error: 'invalid flights file' }); }
  });
});

// get specific flight data (if a per-flight file exists in data/flights/<id>.json will prefer that)
app.get('/api/flights/:id', (req, res) => {
  const id = req.params.id;
  const perFile = path.join(__dirname, 'data', 'flights', `${id}.json`);
  fs.readFile(perFile, 'utf8', (err, data) => {
    if (!err) {
      try { return res.json(JSON.parse(data)); } catch(e) { /* fallthrough to default list */ }
    }
    fs.readFile(config.flightsFile, 'utf8', (err2, d2) => {
      if (err2) return res.status(404).json({ error: 'flight not found' });
      try {
        const all = JSON.parse(d2);
        const f = (all.flights || []).find(x => x.id === id);
        if (!f) return res.status(404).json({ error: 'flight not found' });
        return res.json(f);
      } catch(e) { return res.status(500).json({ error: 'invalid flights file' }); }
    });
  });
});

// save per-flight data
app.put('/api/flights/:id', (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const dir = path.join(__dirname, 'data', 'flights');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const perFile = path.join(dir, `${id}.json`);
  fs.writeFile(perFile, JSON.stringify(payload, null, 2), (err) => {
    if (err) return res.status(500).json({ error: 'failed to save flight' });
    return res.json({ saved: true });
  });
});

// append gesture sampling logs (one-line JSON per entry) for long-run traces
app.post('/api/gesture-log', (req, res) => {
  const payload = req.body || {};
  const dir = path.join(__dirname, 'data', 'logs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'gesture.log');
  const entry = JSON.stringify({ ts: new Date().toISOString(), payload }) + '\n';
  fs.appendFile(file, entry, (err) => {
    if (err) return res.status(500).json({ error: 'failed to append log' });
    return res.json({ saved: true });
  });
});

// mount AI route
app.use('/api/ai-chat', aiRouteFactory(config));

// AI chat is mounted from `server/routes/ai.js` above. The modular route provides local classification,
// deterministic squadron/flight summary short-circuit, and Azure proxying. Keep that single source of truth.

// fallback: serve index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`A400 webapp running on http://localhost:${PORT} (env=${config.nodeEnv})`));
