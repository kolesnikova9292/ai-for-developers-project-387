const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT || 10000);
const API_HOST = '127.0.0.1';
const API_PORT = 4010;
const distRoot = path.join(__dirname, 'frontend-dist');
const browserRoot = path.join(distRoot, 'browser');
const staticRoot = fs.existsSync(path.join(browserRoot, 'index.html')) ? browserRoot : distRoot;
const SLOT_WINDOW_DAYS = 14;
const WORK_DAY_START_HOUR = 9;
const WORK_DAY_END_HOUR = 19;

// Duration per event type — must match openapi.yaml examples
const EVENT_TYPE_DURATIONS = {
  'et-001': 30,
  'et-002': 60,
  'et-003': 15,
};
const DEFAULT_SLOT_DURATION = 60;

const slotPoolByEventType = new Map();
const bookedRanges = []; // [{start: ms, end: ms}]

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function toDatePart(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function generateSlotsForNextTwoWeeks(eventTypeId, now) {
  const duration = EVENT_TYPE_DURATIONS[eventTypeId] ?? DEFAULT_SLOT_DURATION;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const generated = [];
  for (let dayOffset = 0; dayOffset < SLOT_WINDOW_DAYS; dayOffset += 1) {
    const currentDay = new Date(today);
    currentDay.setDate(today.getDate() + dayOffset);

    const dayEnd = new Date(currentDay);
    dayEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

    let slotStart = new Date(currentDay);
    slotStart.setHours(WORK_DAY_START_HOUR, 0, 0, 0);

    while (slotStart.getTime() + duration * 60000 <= dayEnd.getTime()) {
      if (slotStart > now) {
        const h = String(slotStart.getHours()).padStart(2, '0');
        const m = String(slotStart.getMinutes()).padStart(2, '0');
        generated.push({
          id: `${eventTypeId}-${toDatePart(slotStart)}-${h}${m}`,
          eventTypeId,
          startTime: slotStart.toISOString(),
          durationMinutes: duration,
          isBooked: false,
        });
      }
      slotStart = new Date(slotStart.getTime() + duration * 60000);
    }
  }

  return generated;
}

function isOverlapping(startMs, durationMin) {
  const end = startMs + durationMin * 60000;
  return bookedRanges.some((r) => startMs < r.end && end > r.start);
}

function getFreshSlots(eventTypeId) {
  const now = new Date();
  let pool = slotPoolByEventType.get(eventTypeId);

  if (!pool) {
    pool = generateSlotsForNextTwoWeeks(eventTypeId, now);
    slotPoolByEventType.set(eventTypeId, pool);
  }

  const nowMs = now.getTime();
  return pool.filter((slot) => {
    const startMs = new Date(slot.startTime).getTime();
    return startMs > nowMs && !isOverlapping(startMs, slot.durationMinutes);
  });
}

function findSlot(slotId) {
  for (const slots of slotPoolByEventType.values()) {
    const slot = slots.find((s) => s.id === slotId);
    if (slot) return slot;
  }
  return null;
}

function handleCreateBooking(req, res) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let slotId, guestName, guestEmail;
    try {
      const parsed = JSON.parse(body);
      slotId = parsed.slotId;
      guestName = parsed.guestName ?? '';
      guestEmail = parsed.guestEmail ?? '';
    } catch (_) {
      sendJson(res, 400, { message: 'Invalid request body' });
      return;
    }

    const slot = findSlot(slotId);
    if (!slot) {
      sendJson(res, 422, { message: 'Slot not found' });
      return;
    }

    const startMs = new Date(slot.startTime).getTime();
    if (isOverlapping(startMs, slot.durationMinutes)) {
      sendJson(res, 409, { message: 'Slot already booked' });
      return;
    }

    // Register the booked time range — blocks all overlapping slots for all event types.
    bookedRanges.push({ start: startMs, end: startMs + slot.durationMinutes * 60000 });

    const booking = {
      id: `booking-${Date.now()}`,
      eventTypeId: slot.eventTypeId,
      eventTypeTitle: '',
      slotId,
      startTime: slot.startTime,
      durationMinutes: slot.durationMinutes,
      guestName,
      guestEmail,
    };
    sendJson(res, 200, booking);
  });
}

for (const eventTypeId of ['et-001', 'et-002', 'et-003']) {
  slotPoolByEventType.set(eventTypeId, generateSlotsForNextTwoWeeks(eventTypeId, new Date()));
}

function sendFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  });
}

function proxyApi(req, res) {
  const apiPath = req.url.replace(/^\/api/, '') || '/';
  const proxyReq = http.request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: apiPath,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Mock API unavailable' }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const requestUrl = req.url || '/';
  const parsedUrl = new URL(requestUrl, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/healthz') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  const slotsMatch = pathname.match(/^\/api\/event-types\/([^/]+)\/slots$/);
  if (req.method === 'GET' && slotsMatch) {
    const eventTypeId = decodeURIComponent(slotsMatch[1]);
    sendJson(res, 200, getFreshSlots(eventTypeId));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/bookings') {
    handleCreateBooking(req, res);
    return;
  }

  if (pathname.startsWith('/api')) {
    proxyApi(req, res);
    return;
  }

  const normalized = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidatePath = path.join(staticRoot, normalized);
  const safePath = path.normalize(candidatePath);
  if (!safePath.startsWith(path.normalize(staticRoot))) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (normalized && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    sendFile(safePath, res);
    return;
  }

  sendFile(path.join(staticRoot, 'index.html'), res);
});

server.listen(PORT, '0.0.0.0');
