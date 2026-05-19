// @ts-check
(function initMorphAIComposerCommandsRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIComposerCommandsRuntime && typeof window.MorphAIComposerCommandsRuntime.create === 'function') return;

  /** @param {Record<string, string[]>} map @param {string} token */
  function resolveAlias(map, token) {
    const raw = String(token || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    const entries = Object.entries(map);
    for (let i = 0; i < entries.length; i += 1) {
      const [key, aliases] = entries[i];
      if (aliases.some((a) => a.toLowerCase() === lower || a === raw)) return key;
    }
    return lower || raw;
  }

  const SLASH_ALIASES = {
    memory: ['memory', 'remember', 'mem', '记忆'],
    remind: ['remind', 'reminder', '提醒'],
    data: ['data', 'op', '数据'],
    log: ['log', 'daily', '日志'],
    project: ['project', 'proj', '项目'],
    help: ['help', 'commands', '帮助', '指令', '?'],
  };

  /**
   * @param {string} cmdWithSlash e.g. `/帮助` or `/memory`
   * @returns {boolean}
   */
  function isRecognizedSlashCommand(cmdWithSlash) {
    const raw = String(cmdWithSlash || '').trim();
    if (!raw.startsWith('/')) return false;
    const token = raw.slice(1).split(/\s+/)[0];
    if (!token) return false;
    const key = resolveAlias(SLASH_ALIASES, token);
    return Object.prototype.hasOwnProperty.call(SLASH_ALIASES, key);
  }

  const PREFIX_BY_CMD = {
    memory: '【快捷·记忆】用户用首行选了「记忆」能力；请根据正文自然理解意图，少套话，需要时再输出写入动作。\n\n',
    remind: '【快捷·提醒】用户用首行选了「提醒」；请从正文读时间与事项。\n\n',
    data: '【快捷·数据】用户用首行选了「应用内数据」；请按正文完成相应写入或调整。\n\n',
    log: '【快捷·日志】用户用首行选了「日志」；请按正文写入合适日志。\n\n',
    project: '【快捷·项目】用户用首行强调「当前项目」；请结合项目上下文与正文作答。\n\n',
  };

  /**
   * @param {string} text
   * @returns {string[]}
   */
  function parseAtTokens(text) {
    const raw = String(text || '');
    const out = [];
    const re = /@([^\s@]+)/g;
    let m = re.exec(raw);
    while (m) {
      const t = String(m[1] || '').trim();
      if (t) out.push(t);
      m = re.exec(raw);
    }
    return out;
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  function stripAtTokens(text) {
    return String(text || '')
      .replace(/\s*@[^\s@]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * @param {object} deps
   * @param {() => string} deps.getTodayStr
   * @param {() => string} deps.getSelectedDailyMonth
   * @param {() => string} deps.getCurrentTab
   * @param {() => string} deps.getActiveContextId
   * @param {() => unknown} deps.getDataRoot
   * @param {() => unknown[]} deps.getReminderList
   */
  function createAIComposerCommandsRuntime(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};

    const getTodayStr = typeof api.getTodayStr === 'function' ? api.getTodayStr : () => '';
    const getSelectedDailyMonth = typeof api.getSelectedDailyMonth === 'function' ? api.getSelectedDailyMonth : () => '';
    const getCurrentTab = typeof api.getCurrentTab === 'function' ? api.getCurrentTab : () => '';
    const getActiveContextId = typeof api.getActiveContextId === 'function' ? api.getActiveContextId : () => '';
    const getDataRoot = typeof api.getDataRoot === 'function' ? api.getDataRoot : () => null;
    const getReminderList = typeof api.getReminderList === 'function' ? api.getReminderList : () => [];

    /**
     * @param {string[]} hints
     * @returns {string}
     */
    function buildAtContextBlock(hints) {
      if (!hints.length) return '';
      const lines = ['[Composer @ 作用域]'];
      const data = getDataRoot() && typeof getDataRoot() === 'object' ? getDataRoot() : {};
      const projects = Array.isArray(data.projects) ? data.projects : [];
      const tab = String(getCurrentTab() || '').trim();
      const month = String(getSelectedDailyMonth() || '').trim();
      const projectId = String(getActiveContextId() || '').trim();
      const today = String(getTodayStr() || '').trim();

      const seen = new Set();
      hints.forEach((h) => {
        const key = resolveAlias(
          {
            today: ['today', '今天', '今日'],
            memory: ['memory', 'soul', '记忆'],
            reminders: ['reminders', 'reminder', '提醒'],
            project: ['project', '项目'],
            daily: ['daily', 'log', '日志', '月日志'],
            tab: ['tab', '当前页'],
          },
          h,
        );
        if (seen.has(key)) return;
        seen.add(key);

        if (key === 'today' && today) lines.push(`- 今天（业务日）：${today}`);
        else if (key === 'memory') lines.push('- 用户显式指向：长期记忆 / soul 材料');
        else if (key === 'reminders') {
          const list = getReminderList().filter(Boolean);
          const pending = list.filter((r) => String(r?.status || 'pending') === 'pending').slice(0, 5);
          lines.push(`- 提醒：当前待处理 ${pending.length} 条（最多展示 5 条标题）`);
          pending.forEach((r, i) => {
            lines.push(`  ${i + 1}. ${String(r?.text || '（无标题）').slice(0, 80)}`);
          });
        } else if (key === 'project') {
          const p = projects.find((x) => String(x?.id || '').trim() === projectId);
          if (p) lines.push(`- 当前项目：${String(p.name || '未命名').slice(0, 64)}（id=${projectId}）`);
          else lines.push(`- 当前项目：未打开详情或 id=${projectId || '无'}`);
        } else if (key === 'daily') {
          lines.push(`- 月日志视图月份：${month || '（未选）'}`);
        } else if (key === 'tab') {
          lines.push(`- 当前标签页：${tab || '（未知）'}`);
        } else if (/^proj:/i.test(h)) {
          const rest = String(h).replace(/^proj:/i, '').trim();
          let p = projects.find((x) => String(x?.id || '').trim() === rest);
          if (!p) {
            const exact = projects.filter((x) => String(x?.name || '').trim() === rest);
            if (exact.length === 1) p = exact[0];
          }
          if (!p) {
            const c = rest.replace(/\s/g, '');
            const byCompact = projects.filter((x) => String(x?.name || '').replace(/\s/g, '') === c);
            if (byCompact.length === 1) p = byCompact[0];
          }
          if (p) {
            const pid = String(p.id || '').trim();
            lines.push(`- 指定项目：${String(p.name || '未命名').slice(0, 80)}（id=${pid}）`);
          } else if (rest) {
            lines.push(`- 指定项目「${rest}」未匹配到项目 id 或名称`);
          }
        } else {
          const pExact = projects.filter((x) => String(x?.name || '').trim() === h);
          if (pExact.length === 1) {
            const p = pExact[0];
            const pid = String(p.id || '').trim();
            lines.push(`- 指定项目：${String(p.name || '未命名').slice(0, 80)}（id=${pid}）`);
          } else if (pExact.length > 1) {
            lines.push(`- @${h} 对应多个同名项目，请使用 @proj:项目ID 区分`);
          } else {
            const compact = h.replace(/\s/g, '');
            const candidates = projects.filter((x) => String(x?.name || '').replace(/\s/g, '') === compact);
            if (candidates.length === 1) {
              const p = candidates[0];
              const pid = String(p.id || '').trim();
              lines.push(`- 指定项目：${String(p.name || '未命名').slice(0, 80)}（id=${pid}）`);
            } else if (candidates.length > 1) {
              lines.push(`- @${h} 与多个项目去空格后重名，请使用 @proj:项目ID`);
            } else {
              lines.push(`- 用户标记 @${h}（请结合全文语义理解）`);
            }
          }
        }
      });
      lines.push('');
      return `${lines.join('\n')}\n`;
    }

    /**
     * @param {string} rawQuestion
     * @returns {{ promptQuestion: string, userVisibleQuestion: string, extracted: boolean, slashCommand?: string | null }}
     */
    function parseComposerMessage(rawQuestion) {
      const full = String(rawQuestion || '').trim();
      if (!full) {
        return { promptQuestion: '', userVisibleQuestion: '', extracted: false, slashCommand: null };
      }

      const nl = full.indexOf('\n');
      const firstLine = nl === -1 ? full : full.slice(0, nl).trim();
      const afterFirst = nl === -1 ? '' : full.slice(nl + 1).trim();

      const slashMatch = firstLine.match(/^\/(\S+)(?:\s+(.*))?$/);
      if (!slashMatch) {
        const hints = parseAtTokens(full);
        if (!hints.length) {
          return { promptQuestion: full, userVisibleQuestion: full, extracted: false, slashCommand: null };
        }
        const atBlock = buildAtContextBlock(hints);
        return {
          promptQuestion: `${atBlock}用户消息：\n${full}`,
          userVisibleQuestion: full,
          extracted: true,
          slashCommand: null,
        };
      }

      const cmdToken = slashMatch[1];
      const firstRest = String(slashMatch[2] || '').trim();
      const cmd = resolveAlias(SLASH_ALIASES, cmdToken);
      const body = [firstRest, afterFirst].filter(Boolean).join('\n\n').trim();
      const hints = parseAtTokens(full);
      const atBlock = buildAtContextBlock(hints);
      const bodyForModel = stripAtTokens(body);
      const prefix = PREFIX_BY_CMD[cmd] || `【快捷】用户首行使用了「/${cmdToken}」。请结合正文用自然语言处理。\n\n`;
      const slashTag = String(cmd || cmdToken || '').trim() || 'unknown';

      const promptQuestion = `[MorphComposerSlash:${slashTag}]\n${prefix}${atBlock}用户正文（已去掉 @ 标记以免重复，作用域见上）：\n${bodyForModel || '（无额外正文，请根据指令与上下文推断下一步）'}`;

      return {
        promptQuestion,
        userVisibleQuestion: full,
        extracted: true,
        slashCommand: cmd || cmdToken,
      };
    }

    /**
     * @param {string} question
     * @returns {boolean}
     */
    function isLocalHelpCommand(question) {
      const full = String(question || '').trim();
      if (!full) return false;
      const firstLine = full.split('\n')[0].trim();
      const m = firstLine.match(/^\/(\S+)/);
      if (!m) return false;
      const cmd = resolveAlias(SLASH_ALIASES, m[1]);
      return cmd === 'help';
    }

    function buildHelpReply() {
      return [
        '**默认用自然语言就行**：像平常说话一样说清要记什么、提醒几点、写进哪天的日志、改哪个项目，我会尽量理解并处理。',
        '',
        '**只有想走快捷方式时**，才需要在**第一行**用 `/`（可选，补全里也能看到英文别名）：',
        '- `/记忆` — 长期记忆 / soul',
        '- `/提醒` — 提醒',
        '- `/数据` — 应用内写入类操作',
        '- `/日志` — 日志',
        '- `/项目` — 强调当前打开的项目',
        '- `/帮助` — 本说明',
        '',
        '`@今天` `@记忆` `@提醒` `@项目` 等用来**补充上下文**（可选，不必强记）。指定项目仍可用 `@proj:名称或 id`。',
        '',
        '示例（都可以不用符号）：「明早九点提醒我吃药」「把这句写进今天的日志」「记住我不喝冰美式」。',
      ].join('\n');
    }

    return {
      parseComposerMessage,
      isLocalHelpCommand,
      buildHelpReply,
    };
  }

  function escHtmlMenu(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function getSlashCommandMenuItems() {
    const row = (key, insert, cmdDisplay, desc, matchHints, icon) => ({
      key,
      insert,
      cmdDisplay,
      desc,
      matchHints,
      icon,
    });
    return [
      row('memory', '/记忆 ', '/记忆', '快捷：记忆（也可直接说）', ['记忆', 'memory', 'remember', 'mem', 'soul'], 'layout-grid'),
      row('remind', '/提醒 ', '/提醒', '快捷：提醒（也可直接说）', ['提醒', 'remind', 'reminder', '闹钟'], 'bell'),
      row('data', '/数据 ', '/数据', '快捷：应用内写入', ['数据', 'data', '写入', '修改'], 'database'),
      row('log', '/日志 ', '/日志', '快捷：日志（也可直接说）', ['日志', 'log', 'daily', '记录', '日记'], 'scroll-text'),
      row('project', '/项目 ', '/项目', '快捷：当前项目', ['项目', 'project', 'proj'], 'git-branch'),
      row('help', '/帮助 ', '/帮助', '说明（自然语言优先）', ['帮助', 'help', '指令', '说明', 'commands', '?'], 'help-circle'),
    ];
  }

  /** 与 buildHelpReply / buildAtContextBlock 中 @ 作用域一致，供输入补全展示 */
  function getAtScopeMenuItems() {
    const row = (key, insert, titleDisplay, desc, matchHints, icon) => ({
      key,
      insert,
      titleDisplay,
      desc,
      matchHints,
      icon,
    });
    return [
      row('today', '@今天 ', '@今天', '补充：今天日期', ['今天', 'today', '今日', '业务日'], 'calendar-days'),
      row('memory', '@记忆 ', '@记忆', '补充：记忆上下文', ['记忆', 'memory', 'soul'], 'sparkles'),
      row('reminders', '@提醒 ', '@提醒', '补充：提醒列表摘要', ['提醒', 'reminders', 'reminder'], 'bell'),
      row('project', '@项目 ', '@项目', '补充：当前项目', ['项目', 'project', 'proj', '当前项目'], 'folder-kanban'),
      row(
        'daily',
        '@日志 ',
        '@日志',
        '补充：当前月日志视图',
        ['日志', 'daily', '月日志', '月份'],
        'book-open',
      ),
      row('tab', '@tab ', '@tab', '补充：当前标签页', ['tab', '当前页', '标签页', '标签'], 'layout-dashboard'),
    ];
  }

  window.MorphAIComposerCommandsRuntime = {
    create: createAIComposerCommandsRuntime,
    getSlashCommandMenuItems,
    getAtScopeMenuItems,
    isRecognizedSlashCommand,
  };
}());
