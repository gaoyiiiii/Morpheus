const fs = require('fs');
const path = require('path');

function createAgentStore(rootDir) {
  const configFile = path.join(rootDir, 'data', 'proactive-agent.config.json');
  const eventsFile = path.join(rootDir, 'data', 'proactive-agent-events.ndjson');

  function appendEvent(eventPayload) {
    const payload = eventPayload && typeof eventPayload === 'object' ? eventPayload : {};
    const findings = Array.isArray(payload.findings) ? payload.findings : [];
    const entry = {
      at: typeof payload.at === 'string' && payload.at ? payload.at : new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      timezone: String(payload.timezone || '').trim(),
      summary: String(payload.summary || '').trim().slice(0, 2000),
      findings: findings
        .filter((item) => item && typeof item === 'object')
        .slice(0, 12)
        .map((item) => ({
          key: String(item.key || '').trim().slice(0, 120),
          severity: String(item.severity || '').trim().slice(0, 20),
          summary: String(item.summary || '').trim().slice(0, 400),
        })),
    };
    fs.mkdirSync(path.dirname(eventsFile), { recursive: true });
    fs.appendFileSync(eventsFile, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  }

  function readEvents(limit = 20) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    try {
      const raw = fs.readFileSync(eventsFile, 'utf8');
      const rows = raw.split('\n').map((line) => line.trim()).filter(Boolean);
      return rows
        .slice(-safeLimit)
        .map((line) => {
          try { return JSON.parse(line); } catch (_) { return null; }
        })
        .filter(Boolean)
        .reverse();
    } catch (_) {
      return [];
    }
  }

  function readConfig() {
    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function readStatusSummary(webhookSecret) {
    const cfg = readConfig();
    const webhook = cfg.webhook && typeof cfg.webhook === 'object' ? cfg.webhook : {};
    const stateFile = String(cfg.stateFile || '').trim();
    const statePath = stateFile
      ? (path.isAbsolute(stateFile) ? stateFile : path.resolve(rootDir, stateFile))
      : '';
    let state = null;
    if (statePath) {
      try {
        state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      } catch (_) {
        state = null;
      }
    }
    return {
      ok: true,
      enabled: cfg.enabled !== false,
      intervalSeconds: Number(cfg.intervalSeconds) || 0,
      quietHoursStart: String(cfg.quietHoursStart || ''),
      quietHoursEnd: String(cfg.quietHoursEnd || ''),
      webhookEnabled: webhook.enabled === true,
      webhookUrl: String(webhook.url || '').trim(),
      webhookSecretConfigured: !!String(webhookSecret || '').trim(),
      lastRunAt: state && typeof state.lastRunAt === 'string' ? state.lastRunAt : '',
      lastNotifiedAt: state && typeof state.lastNotifiedAt === 'string' ? state.lastNotifiedAt : '',
      recentEventCount: readEvents(20).length,
      now: new Date().toISOString(),
    };
  }

  return {
    configFile,
    eventsFile,
    appendEvent,
    readEvents,
    readConfig,
    readStatusSummary,
  };
}

module.exports = {
  createAgentStore,
};
