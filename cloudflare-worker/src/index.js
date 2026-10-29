import { generateVapidKeys } from '@mmmike/web-push/vapid';
import { isPushServiceEndpoint, sendPushNotification } from '@mmmike/web-push/send';

const STORE_KEY = 'ayah-push-state-v1';
const memo = new WeakMap();
const bool = value => value !== false;
const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

async function loadState(env) {
  const raw = await env.AYAH_KV.get(STORE_KEY);
  if (!raw) return { vapid: null, subscriptions: {} };
  try { const parsed = JSON.parse(raw); return { vapid: parsed.vapid || null, subscriptions: parsed.subscriptions || {} }; }
  catch { return { vapid: null, subscriptions: {} }; }
}
async function saveState(env, state) {
  await env.AYAH_KV.put(STORE_KEY, JSON.stringify(state));
}
async function getVapid(env, state) {
  if (state.vapid?.publicKey && state.vapid?.privateKey) return state.vapid;
  if (memo.has(env)) return memo.get(env);
  const task = (async () => {
    const current = await loadState(env);
    if (current.vapid?.publicKey && current.vapid?.privateKey) return current.vapid;
    current.vapid = await generateVapidKeys();
    await saveState(env, current);
    return current.vapid;
  })();
  memo.set(env, task);
  return task;
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== env.APP_ORIGIN) return null;
  return {
    'Access-Control-Allow-Origin': env.APP_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
function validatePreferences(input = {}, env) {
  const timezone = typeof input.timezone === 'string' ? input.timezone : 'Europe/Paris';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date()); }
  catch { throw new Error('Fuseau horaire IANA invalide.'); }
  const dailyTime = input.dailyTime || '08:00';
  const morningTime = input.morningTime || '07:00';
  if (!validTime(dailyTime) || !validTime(morningTime)) throw new Error('Heure invalide; utiliser HH:MM.');
  const appUrl = input.appUrl || `${env.APP_ORIGIN}/ayah-application/`;
  let parsed;
  try { parsed = new URL(appUrl); } catch { throw new Error('URL de l’application invalide.'); }
  if (parsed.origin !== env.APP_ORIGIN || parsed.protocol !== 'https:') throw new Error('L’URL de l’application doit utiliser APP_ORIGIN en HTTPS.');
  return {
    appUrl: parsed.href,
    timezone,
    language: input.language === 'ar' ? 'ar' : 'fr',
    dailyEnabled: bool(input.dailyEnabled), dailyTime,
    morningEnabled: bool(input.morningEnabled), morningTime,
    nawmEnabled: bool(input.nawmEnabled), dhikrEnabled: bool(input.dhikrEnabled)
  };
}
function localTime(date, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}
const HOURLY_DHIKR = [
  { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', source: 'صحيح البخاري 6405' },
  { text: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', source: 'صحيح البخاري 6384' },
  { text: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ', source: 'صحيح مسلم 2137' },
  { text: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ عِبَادَتِكَ', source: 'سنن أبي داود 1522' },
  { text: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', source: 'صحيح البخاري 6307' },
  { text: 'سُبْحَانَ اللَّهِ الْعَظِيمِ، سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', source: 'صحيح البخاري 6406' },
  { text: 'رَبَّنَا وَلَكَ الْحَمْدُ، حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ', source: 'صحيح البخاري 799' },
  { text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', source: 'صحيح البخاري 3293' },
  { text: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', source: 'صحيح مسلم 408' },
  { text: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', source: 'القرآن 2:201' },
  { text: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ', source: 'القرآن 21:87' },
  { text: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', source: 'القرآن 3:173' }
];
function dayOfYear(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000);
}
function dueJobs(prefs, local) {
  const withinOneMinute = scheduled => { const [h, m] = scheduled.split(':').map(Number); const delta = local.hour * 60 + local.minute - (h * 60 + m); return delta >= 0 && delta <= 1; };
  const jobs = [];
  if (prefs.morningEnabled && withinOneMinute(prefs.morningTime)) jobs.push({ key: `morning:${local.date}`, title: 'أذكار الصباح', body: 'اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك المصير. (جامع الترمذي 3391)' });
  if (prefs.nawmEnabled && local.hour === 23 && local.minute <= 1) jobs.push({ key: `nawm:${local.date}`, title: 'أذكار النوم', body: 'باسمك اللهم أموت وأحيا. (صحيح البخاري 6324)' });
  if (prefs.dhikrEnabled && local.hour >= 8 && local.hour <= 19 && local.minute <= 1) {
    const index = (dayOfYear(local.date) + local.hour - 8) % HOURLY_DHIKR.length;
    const dhikr = HOURLY_DHIKR[index];
    jobs.push({ key: `dhikr:${local.date}:${local.hour}`, title: 'ذِكر الساعة', body: `${dhikr.text} — ${dhikr.source}` });
  }
  if (prefs.dailyEnabled && withinOneMinute(prefs.dailyTime)) jobs.push({ key: `wird:${local.date}`, title: prefs.language === 'ar' ? 'موعد الورد اليومي' : 'Ayah · Wird quotidien', body: prefs.language === 'ar' ? 'حان وقت وِردك اليومي من القرآن.' : 'C’est l’heure de ton wird quotidien. Ouvre Ayah pour reprendre ta lecture.' });
  return jobs;
}
async function sendScheduled(env, date = new Date()) {
  const state = await loadState(env);
  if (!Object.keys(state.subscriptions).length) return;
  const vapid = await getVapid(env, state);
  let changed = false;
  const vapidConfig = { publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: env.VAPID_SUBJECT };
  for (const [endpoint, record] of Object.entries(state.subscriptions)) {
    const prefs = record.preferences;
    const local = localTime(date, prefs.timezone);
    for (const job of dueJobs(prefs, local)) {
      if (record.lastSent?.[job.key]) continue;
      try {
        const delivered = await sendPushNotification(record.subscription, { title: job.title, body: job.body, url: prefs.appUrl, tag: job.key }, vapidConfig, { ttl: 3600, timeoutMs: 8000 });
        if (delivered) {
          record.lastSent ||= {};
          record.lastSent[job.key] = date.toISOString();
          changed = true;
        } else {
          delete state.subscriptions[endpoint];
          changed = true;
        }
      } catch (error) {
        // Keep the schedule marker unset so the next cron minute can retry only while still due.
        console.error('Push delivery failed:', error?.statusCode || error?.name || 'unknown error');
      }
    }
  }
  if (changed) await saveState(env, state);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return json({ error: 'Origin non autorisée.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'ayah-push-cloudflare' }, 200, cors);
    if (request.method === 'GET' && url.pathname === '/api/push/vapid-public-key') {
      const state = await loadState(env);
      const vapid = await getVapid(env, state);
      return json({ publicKey: vapid.publicKey }, 200, cors);
    }
    if (request.method !== 'POST') return json({ error: 'Route introuvable.' }, 404, cors);
    let body;
    try { const text = await request.text(); if (text.length > 16000) return json({ error: 'Requête trop grande.' }, 413, cors); body = JSON.parse(text); }
    catch { return json({ error: 'JSON invalide.' }, 400, cors); }
    const state = await loadState(env);
    if (url.pathname === '/api/push/subscribe') {
      const subscription = body?.subscription;
      if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.keys?.p256dh || !subscription.keys?.auth || !isPushServiceEndpoint(subscription.endpoint)) return json({ error: 'Abonnement Web Push invalide.' }, 400, cors);
      try {
        const preferences = validatePreferences(body.preferences, env);
        const prior = state.subscriptions[subscription.endpoint];
        state.subscriptions[subscription.endpoint] = { subscription, preferences, lastSent: prior?.lastSent || {} };
        await saveState(env, state);
        return json({ ok: true }, 200, cors);
      } catch (error) { return json({ error: error.message }, 400, cors); }
    }
    if (url.pathname === '/api/push/preferences') {
      const endpoint = body?.endpoint;
      if (typeof endpoint !== 'string' || !state.subscriptions[endpoint]) return json({ error: 'Abonnement introuvable; réactive les notifications.' }, 404, cors);
      try {
        state.subscriptions[endpoint].preferences = validatePreferences(body.preferences, env);
        await saveState(env, state);
        return json({ ok: true }, 200, cors);
      } catch (error) { return json({ error: error.message }, 400, cors); }
    }
    if (url.pathname === '/api/push/unsubscribe') {
      const endpoint = body?.endpoint;
      if (typeof endpoint !== 'string') return json({ error: 'Point de terminaison manquant.' }, 400, cors);
      delete state.subscriptions[endpoint];
      await saveState(env, state);
      return json({ ok: true }, 200, cors);
    }
    return json({ error: 'Route introuvable.' }, 404, cors);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendScheduled(env, new Date(controller.scheduledTime)));
  }
};
