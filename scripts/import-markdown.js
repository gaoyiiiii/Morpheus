#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
const mirrorRoot = path.join(root, 'morph_md_mirror');

function firstExistingPath(candidates = []) {
  return candidates.find((file) => exists(file)) || candidates[0] || '';
}

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch (_) {
    return false;
  }
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

let idSeq = 0;
function genId(prefix) {
  idSeq += 1;
  return `${prefix || 'imp'}_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

function parseThoughtList(file, prefix) {
  if (!exists(file)) return [];
  const lines = read(file).split('\n');
  const out = [];
  let current = null;

  function flush() {
    if (!current) return;
    const text = current.body.join('\n').trim() || current.title || '';
    const item = {
      id: current.id,
      text,
      time: current.time || '',
    };
    if (current.clusterId) item.clusterId = current.clusterId;
    out.push(item);
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const header = line.match(/^##\s+\d+\.\s+(?:\[(.*?)\]\s+)?(.*)$/);
    if (header) {
      flush();
      current = {
        id: genId(prefix),
        time: (header[1] || '').trim(),
        title: (header[2] || '').trim(),
        body: [],
        clusterId: '',
      };
      continue;
    }
    if (!current) continue;
    if (line.trim() === '---') {
      flush();
      continue;
    }
    const cluster = line.match(/^关联簇:\s+`(.+)`$/);
    if (cluster) {
      current.clusterId = cluster[1].trim();
      continue;
    }
    if (!line.trim() && current.body.length === 0) continue;
    current.body.push(line);
  }
  flush();
  return out;
}

function parseBlocks(file, prefix) {
  if (!exists(file)) return [];
  const lines = read(file).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd();
    if (!line.trim()) continue;
    if (i === 0 && line.startsWith('# ')) continue;
    if (/^##\s+/.test(line)) {
      out.push({ id: genId(prefix), type: 'h3', content: line.replace(/^##\s+/, ''), checked: false });
      continue;
    }
    const todo = line.match(/^- \[( |x)\] (.*)$/);
    if (todo) {
      out.push({ id: genId(prefix), type: 'todo', content: todo[2], checked: todo[1] === 'x' });
      continue;
    }
    out.push({ id: genId(prefix), type: 'p', content: line, checked: false });
  }
  return out;
}

function parseFragments(file, prefix) {
  if (!exists(file)) return [];
  const lines = read(file).split('\n');
  const out = [];
  let current = null;

  function flush() {
    if (!current) return;
    out.push({
      id: current.id,
      text: current.body.join('\n').trim() || current.title || '',
      time: current.time || '',
    });
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const header = line.match(/^##\s+\d+\.\s+(?:\[(.*?)\]\s+)?(.*)$/);
    if (header) {
      flush();
      current = {
        id: genId(prefix),
        time: (header[1] || '').trim(),
        title: (header[2] || '').trim(),
        body: [],
      };
      continue;
    }
    if (!current) continue;
    if (line.trim() === '---') {
      flush();
      continue;
    }
    if (!line.trim() && current.body.length === 0) continue;
    current.body.push(line);
  }
  flush();
  return out;
}

function parseContextCollection(dirName, prefix) {
  const base = path.join(mirrorRoot, dirName);
  if (!exists(base)) return [];
  const entries = fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return entries.map((entryName) => {
    const folder = path.join(base, entryName);
    const indexFile = path.join(folder, 'index.md');
    const blocksFile = path.join(folder, 'blocks.md');
    const fragmentsFile = path.join(folder, 'fragments.md');
    let name = entryName;
    let id = genId(prefix);

    if (exists(indexFile)) {
      const indexText = read(indexFile);
      const nameMatch = indexText.match(/^#\s+(.+)$/m);
      const idMatch = indexText.match(/^- id: `(.+)`$/m);
      if (nameMatch) name = nameMatch[1].trim();
      if (idMatch) id = idMatch[1].trim();
    }

    return {
      id,
      name,
      items: parseFragments(fragmentsFile, `${prefix}f`),
      blocks: parseBlocks(blocksFile, `${prefix}b`),
    };
  });
}

function parseDailyMonths() {
  const base = exists(path.join(mirrorRoot, '日志'))
    ? path.join(mirrorRoot, '日志')
    : path.join(mirrorRoot, 'daily');
  const out = {};
  if (!exists(base)) return out;
  const years = fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const year of years) {
    const yearDir = path.join(base, year.name);
    const files = fs.readdirSync(yearDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort();
    for (const file of files) {
      const monthKey = path.basename(file, '.md');
      out[monthKey] = parseBlocks(path.join(yearDir, file), `d_${monthKey}`);
    }
  }
  return out;
}

function parseMarkdownBulletSections(file) {
  if (!exists(file)) return {};
  const sections = {};
  let current = '';
  read(file).split('\n').forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections[current]) sections[current] = [];
      return;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (!current || !bullet) return;
    const value = bullet[1].trim();
    if (!value) return;
    sections[current].push(value);
  });
  return sections;
}

function parseAIMemory() {
  const base = exists(path.join(mirrorRoot, 'AI记忆'))
    ? path.join(mirrorRoot, 'AI记忆')
    : path.join(mirrorRoot, 'ai-memory');
  const result = {
    soul: '',
    identityNotes: '',
    user: '',
    memoryIndex: '',
    systemNotes: '',
    dailyLogs: {},
    selfMemory: {
      soul: '',
      principles: '',
      identity: [],
      motivations: [],
      desires: [],
      fears: [],
      sensitivities: [],
      goals: [],
      tensions: [],
      relationalStance: [],
      growthDirections: [],
      attachmentPoints: [],
      attachmentAwareness: [],
      attachmentRecovery: [],
    },
    longTermMemory: {
      identityNotes: '',
      user: '',
      memoryIndex: '',
      systemNotes: '',
      dailyLogs: {},
      explicitMemoryLog: [],
      facts: [],
      factArchive: [],
    },
    workingMemory: {
      currentTaskState: {},
      currentWorkflowState: {},
    },
  };
  if (!exists(base)) return result;
  const pickFile = (...names) => names.map((name) => path.join(base, name)).find((file) => exists(file)) || path.join(base, names[0]);
  const soulFile = pickFile('SOUL.md', 'soul.md');
  const identityFile = pickFile('IDENTITY.md', 'identity.md');
  const userFile = pickFile('USER.md', 'user.md');
  const memoryIndexFile = pickFile('MEMORY.md', 'memory.md');
  const systemFile = pickFile('MEMORY-SYSTEM.md', 'memory-system.md');
  if (exists(soulFile)) result.soul = read(soulFile).trim();
  if (exists(identityFile)) result.identityNotes = read(identityFile).trim();
  if (exists(userFile)) result.user = read(userFile).trim();
  if (exists(memoryIndexFile)) result.memoryIndex = read(memoryIndexFile).trim();
  if (exists(systemFile)) result.systemNotes = read(systemFile).trim();
  result.selfMemory.soul = result.soul;
  result.longTermMemory.identityNotes = result.identityNotes || '';
  result.longTermMemory.user = result.user;
  result.longTermMemory.memoryIndex = result.memoryIndex || '';
  result.longTermMemory.systemNotes = result.systemNotes;

  const identitySections = parseMarkdownBulletSections(identityFile);
  const pick = (key) => Array.isArray(identitySections[key]) ? identitySections[key] : [];
  result.selfMemory.identity = pick('identity');
  result.selfMemory.motivations = pick('motivations');
  result.selfMemory.desires = pick('desires');
  result.selfMemory.fears = pick('fears');
  result.selfMemory.sensitivities = pick('sensitivities');
  result.selfMemory.goals = pick('goals');
  result.selfMemory.tensions = pick('tensions');
  result.selfMemory.relationalStance = pick('relational stance');
  result.selfMemory.growthDirections = pick('growth directions');
  result.selfMemory.attachmentPoints = pick('attachment points');
  result.selfMemory.attachmentAwareness = pick('attachment awareness');
  result.selfMemory.attachmentRecovery = pick('attachment recovery');

  const dailyDir = exists(path.join(base, '每日'))
    ? path.join(base, '每日')
    : path.join(base, 'daily');
  if (exists(dailyDir)) {
    const files = fs.readdirSync(dailyDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md' && entry.name !== '说明.md')
      .map((entry) => entry.name)
      .sort();
    files.forEach((file) => {
      const dayKey = path.basename(file, '.md');
      const text = read(path.join(dailyDir, file));
      const lines = text.split('\n');
      const entries = [];
      let current = null;
      const flush = () => {
        if (!current) return;
        entries.push(current);
        current = null;
      };
      lines.forEach((rawLine) => {
        const line = rawLine.trimEnd();
        const header = line.match(/^##\s+\d+\.\s+\[(.*?)\]\s+(.*)$/);
        if (header) {
          flush();
          current = {
            id: genId('aim'),
            time: (header[1] || '').trim(),
            summary: (header[2] || '').trim(),
            user: '',
            assistant: '',
            actions: [],
          };
          return;
        }
        if (!current) return;
        if (line.trim() === '---') {
          flush();
          return;
        }
        const userLine = line.match(/^- 用户：(.+)$/);
        if (userLine) {
          current.user = userLine[1].trim();
          return;
        }
        const assistantLine = line.match(/^- AI：(.+)$/);
        if (assistantLine) {
          current.assistant = assistantLine[1].trim();
          return;
        }
        const actionLine = line.match(/^- 动作：(.+)$/);
        if (actionLine) {
          current.actions = actionLine[1].split('/').map((item) => item.trim()).filter(Boolean);
        }
      });
      flush();
      if (entries.length) result.dailyLogs[dayKey] = entries;
    });
  }

  const memoryDir = path.join(base, 'memory');
  if (exists(memoryDir)) {
    const files = fs.readdirSync(memoryDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    files.forEach((file) => {
      const dayKey = path.basename(file, '.md');
      const entries = result.dailyLogs[dayKey] || [];
      read(path.join(memoryDir, file)).split('\n').forEach((rawLine) => {
        const line = rawLine.trimEnd();
        const chatLine = line.match(/^-\s+(?:\[(.*?)\]\s+)?(用户|AI|系统)（(.+?)）：(.+)$/);
        if (!chatLine) return;
        const role = chatLine[2];
        const content = chatLine[4].trim();
        if (!content) return;
        entries.push({
          id: genId('aim'),
          time: (chatLine[1] || '').trim(),
          summary: `${role} 对话：${chatLine[3].trim()}`,
          user: role === '用户' ? content : '',
          assistant: role === 'AI' ? content : '',
          actions: [],
        });
      });
      if (entries.length) result.dailyLogs[dayKey] = entries;
    });
  }
  result.longTermMemory.dailyLogs = result.dailyLogs;
  return result;
}

function buildData() {
  const flashThoughtsFile = firstExistingPath([
    path.join(mirrorRoot, '闪念', '总览.md'),
    path.join(mirrorRoot, 'flash-thoughts', 'FLASH_THOUGHTS.md'),
    path.join(mirrorRoot, 'fleeting', 'FLEETING.md'),
  ]);
  const fixedFile = firstExistingPath([
    path.join(mirrorRoot, '定念', '总览.md'),
    path.join(mirrorRoot, 'fixed', 'FIXED.md'),
  ]);

  return {
    flashThoughts: parseThoughtList(flashThoughtsFile, 'ft'),
    fixed: parseThoughtList(fixedFile, 'fx'),
    dailyMonths: parseDailyMonths(),
    projects: parseContextCollection(exists(path.join(mirrorRoot, '项目')) ? '项目' : 'projects', 'prj'),
    routines: parseContextCollection(exists(path.join(mirrorRoot, '节律')) ? '节律' : 'routines', 'rtn'),
    sops: parseContextCollection(exists(path.join(mirrorRoot, '流程')) ? '流程' : 'sops', 'sop'),
    aiMemory: parseAIMemory(),
  };
}

if (!exists(mirrorRoot)) {
  console.error('未找到 morph_md_mirror 目录');
  process.exit(1);
}

process.stdout.write(JSON.stringify(buildData()));
