'use strict';
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

if (!process.env.APP_ORIGIN) { console.error('Missing required environment variable: APP_ORIGIN'); process.exit(1); }
const origin = process.env.APP_ORIGIN.replace(/\/$/, '');
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'subscriptions.json');
const vapidFile = path.join(dataDir, 'vapid.json');
const port = Number(process.env.PORT || 8080);
fs.mkdirSync(dataDir, { recursive: true });
function loadVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  if (process.env.VAPID_PUBLIC_KEY || process.env.VAPID_PRIVATE_KEY) throw Error('Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, or neither.');
  try { return JSON.parse(fs.readFileSync(vapidFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(vapidFile, JSON.stringify(keys), { mode: 0o600, flag: 'wx' });
    console.log('Generated a persistent VAPID keypair on the data volume.');
    return keys;
  }
}
const { publicKey, privateKey } = loadVapidKeys();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ayah-pwa@example.com', publicKey, privateKey);

let records = {};
try { records = JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') { console.error('Could not read subscription store:', error); process.exit(1); } }
let writeQueue = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(records, null, 2);
  writeQueue = writeQueue.then(async () => {
    const tmp = `${dataFile}.tmp`;
    await fs.promises.writeFile(tmp, snapshot, { mode: 0o600 });
    await fs.promises.rename(tmp, dataFile);
  });
  return writeQueue;
}
function validTime(value) { return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
function validatePrefs(input = {}) {
  const tz = typeof input.timezone === 'string' ? input.timezone : 'Europe/Paris';
  try { new Intl.DateTimeFormat('en', { timeZone: tz }).format(new Date()); } catch { throw new Error('Invalid IANA timezone'); }
  const morningTime = input.morningTime || '07:00';
  const dailyTime = input.dailyTime || '08:00';
  if (!validTime(morningTime) || !validTime(dailyTime)) throw new Error('Invalid time; use HH:MM');
  const appUrl = input.appUrl || process.env.APP_URL || `${origin}/`;
  let parsedAppUrl;
  try { parsedAppUrl = new URL(appUrl); } catch { throw new Error('Invalid app URL'); }
  if (parsedAppUrl.origin !== origin || !['https:', 'http:'].includes(parsedAppUrl.protocol)) throw new Error('App URL must use APP_ORIGIN');
  return {
    appUrl: parsedAppUrl.href,
    language: input.language === 'ar' ? 'ar' : 'fr',
    timezone: tz,
    dailyEnabled: input.dailyEnabled !== false,
    dailyTime,
    morningEnabled: input.morningEnabled !== false,
    morningTime,
    nawmEnabled: input.nawmEnabled !== false,
    dhikrEnabled: input.dhikrEnabled !== false
  };
}
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: (requestOrigin, callback) => {
  if (!requestOrigin || requestOrigin === origin) return callback(null, true);
  return callback(new Error('Origin not allowed'));
}, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '16kb' }));
app.use('/api/push', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'ayah-push' }));
app.get('/api/push/vapid-public-key', (_req, res) => res.json({ publicKey }));
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const subscription = req.body?.subscription;
    if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.keys?.p256dh || !subscription.keys?.auth) return res.status(400).json({ error: 'Invalid push subscription' });
    let endpointUrl;
    try { endpointUrl = new URL(subscription.endpoint); } catch { return res.status(400).json({ error: 'Invalid push endpoint URL' }); }
    const host = endpointUrl.hostname.toLowerCase();
    const trustedPushHost = host === 'fcm.googleapis.com' || host === 'web.push.apple.com' || host.endsWith('.push.apple.com') || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') || host.endsWith('.notify.windows.com');
    if (endpointUrl.protocol !== 'https:' || endpointUrl.port || endpointUrl.username || endpointUrl.password || !trustedPushHost) return res.status(400).json({ error: 'Untrusted push endpoint host' });
    const prefs = validatePrefs(req.body.preferences);
    records[subscription.endpoint] = { subscription, preferences: prefs, lastSent: records[subscription.endpoint]?.lastSent || {} };
    await persist();
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post('/api/push/preferences', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string' || !records[endpoint]) return res.status(404).json({ error: 'Subscription not found; subscribe again' });
    records[endpoint].preferences = validatePrefs(req.body.preferences);
    await persist();
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post('/api/push/unsubscribe', async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Missing endpoint' });
  delete records[endpoint];
  await persist();
  res.json({ ok: true });
});

function zonedParts(date, timezone) {
  const result = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return { date: `${result.year}-${result.month}-${result.day}`, hour: Number(result.hour), minute: Number(result.minute) };
}
function makeJobs(prefs, local) {
  const jobs = [];
  if (prefs.morningEnabled && `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}` === prefs.morningTime) jobs.push({ key: `morning:${local.date}`, title: 'أذكار الصباح', body: 'اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك المصير. (جامع الترمذي 3391)' });
  if (prefs.nawmEnabled && local.hour === 23 && local.minute === 0) jobs.push({ key: `nawm:${local.date}`, title: 'أذكار النوم', body: 'باسمك اللهم أموت وأحيا. (صحيح البخاري 6324)' });
  if (prefs.dhikrEnabled && local.hour >= 8 && local.hour <= 19 && local.minute === 0) jobs.push({ key: `dhikr:${local.date}:${local.hour}`, title: 'ذِكر الساعة', body: 'سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر' });
  if (prefs.dailyEnabled && `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}` === prefs.dailyTime) jobs.push({
    key: `wird:${local.date}`,
    title: prefs.language === 'ar' ? 'موعد الورد اليومي' : 'Ayah · Wird quotidien',
    body: prefs.language === 'ar' ? 'حان وقت وِردك اليومي من القرآن.' : 'C’est l’heure de ton wird quotidien. Ouvre Ayah pour reprendre ta lecture.'
  });
  return jobs;
}
let tickRunning = false;
async function sendDueNotifications() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const now = new Date();
    for (const [endpoint, record] of Object.entries(records)) {
      let local;
      try { local = zonedParts(now, record.preferences.timezone); }
      catch (error) { console.error('Invalid timezone for subscription:', error.message); continue; }
      for (const job of makeJobs(record.preferences, local)) {
        if (record.lastSent[job.key]) continue;
        try {
          await webpush.sendNotification(record.subscription, JSON.stringify({ title: job.title, body: job.body, url: record.preferences.appUrl, tag: job.key }), { TTL: 3600 });
          record.lastSent[job.key] = new Date().toISOString();
          await persist();
        } catch (error) {
          console.error(`Push failed (${error.statusCode || 'network'}):`, error.body || error.message);
          if (error.statusCode === 404 || error.statusCode === 410) { delete records[endpoint]; await persist(); }
        }
      }
    }
  } finally { tickRunning = false; }
}
setInterval(() => sendDueNotifications().catch(error => console.error('Scheduler error:', error)), 30_000);
setTimeout(() => sendDueNotifications().catch(error => console.error('Initial scheduler error:', error)), 1500);
app.listen(port, '0.0.0.0', () => console.log(`Ayah push service listening on ${port}; allowed origin ${origin}`));
