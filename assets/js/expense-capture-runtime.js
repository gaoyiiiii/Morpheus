// @ts-check

(function initMorphExpenseCaptureRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphExpenseCaptureRuntime && typeof window.MorphExpenseCaptureRuntime.create === 'function') return;

  function createExpenseCaptureRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const formatDateTimeFull = typeof api.formatDateTimeFull === 'function'
      ? api.formatDateTimeFull
      : (date) => {
        const d = date instanceof Date ? date : new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
      };
    const getNowInAITimezoneText = typeof api.getNowInAITimezoneText === 'function'
      ? api.getNowInAITimezoneText
      : () => formatDateTimeFull(new Date()).slice(0, 16);

    function looksLikeExpenseCaptureQuestion(question = '') {
      const q = String(question || '').trim();
      if (!q) return false;
      const amountRe = /(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?|\d+\s*块\s*\d(?:\.\d+)?\s*(?:毛|角)?|[零一二两三四五六七八九十百]+\s*(?:元|块|块钱|人民币)|[零一二两三四五六七八九十百]+\s*块\s*[零一二两三四五六七八九]\s*(?:毛|角)?/i;
      if (!amountRe.test(q)) return false;
      return /(花了|花费|用了|付了|付款|消费|支出|记一笔|记账|记.{0,2}账|买了|买个|点了|交了|缴了|充值了|充话费|看病|挂号|打车|吃饭|吃完饭|吃了|喝了|喝咖啡|喝奶茶|加油|理发|洗车|修车|寄快递|房租|房贷|车贷|物业|水电|电费|燃气|宽带|话费|快递|停车费|过路费|路费|车费|油费|邮费|运费|挂号费|药费)/i.test(q)
        || /^(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)?\s*[\u4e00-\u9fa5a-zA-Z]{1,18}(?:费|打车|停车|咖啡|奶茶|外卖|早餐|午餐|晚餐|夜宵|吃饭|房租|房贷|车贷|物业|电费|水费|燃气费|话费|宽带|快递|运费)\s*(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?$/i.test(q);
    }

    function parseChineseExpenseNumber(raw = '') {
      const text = String(raw || '').trim();
      if (!text) return 0;
      const digitMap = {
        '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
        '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
      };
      if (/^[零一二两三四五六七八九]$/.test(text)) return digitMap[text] ?? 0;
      if (text === '十') return 10;
      if (/^十[零一二两三四五六七八九]$/.test(text)) return 10 + (digitMap[text.slice(1)] ?? 0);
      if (/^[一二两三四五六七八九]十$/.test(text)) return (digitMap[text[0]] ?? 0) * 10;
      if (/^[一二两三四五六七八九]十[零一二两三四五六七八九]$/.test(text)) return ((digitMap[text[0]] ?? 0) * 10) + (digitMap[text[2]] ?? 0);
      if (/^[一二两三四五六七八九]百$/.test(text)) return (digitMap[text[0]] ?? 0) * 100;
      return 0;
    }

    function parseExpenseAmountFromNaturalText(text = '') {
      const raw = String(text || '').trim();
      if (!raw) return 0;
      const normalized = raw.replace(/[,，]/g, '').trim();
      const colloquialMatch = normalized.match(/(\d+)\s*块\s*(\d{1,2})(?:\s*(?:毛|角))?/i);
      if (colloquialMatch) {
        const whole = Number(colloquialMatch[1] || 0);
        const fractionRaw = String(colloquialMatch[2] || '').trim();
        const fraction = Number(`0.${fractionRaw.slice(0, 2)}`);
        const value = whole + (Number.isFinite(fraction) ? fraction : 0);
        return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
      }
      const directMatch = normalized.match(/(?:¥|￥|rmb\s*)?(\d+(?:\.\d{1,2})?)/i);
      if (directMatch) {
        const value = Number(directMatch[1] || 0);
        return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
      }
      const chineseColloquialMatch = normalized.match(/([零一二两三四五六七八九十百]+)\s*块\s*([零一二两三四五六七八九])(?:\s*(?:毛|角))?/i);
      if (chineseColloquialMatch) {
        const whole = parseChineseExpenseNumber(chineseColloquialMatch[1]);
        const fractionDigit = parseChineseExpenseNumber(chineseColloquialMatch[2]);
        const value = whole + ((Number.isFinite(fractionDigit) ? fractionDigit : 0) / 10);
        return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
      }
      const chineseDirectMatch = normalized.match(/([零一二两三四五六七八九十百]+)\s*(?:元|块|块钱|人民币)/i);
      if (!chineseDirectMatch) return 0;
      const value = parseChineseExpenseNumber(chineseDirectMatch[1]);
      return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
    }

    function looksLikeStandaloneExpenseAmountText(text = '') {
      const normalized = String(text || '').replace(/[,，]/g, '').trim();
      if (!normalized) return false;
      return /^(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?$/i.test(normalized)
        || /^\d+\s*块\s*\d{1,2}(?:\s*(?:毛|角))?$/i.test(normalized)
        || /^[零一二两三四五六七八九十百]+\s*(?:元|块|块钱|人民币)$/i.test(normalized)
        || /^[零一二两三四五六七八九十百]+\s*块\s*[零一二两三四五六七八九]\s*(?:毛|角)?$/i.test(normalized);
    }

    function inferExpenseCategoryFromText(text = '') {
      const q = String(text || '').toLowerCase();
      if (!q) return '日用百货';
      const strongTransport = /(地铁|公交|打车|高铁|火车|机票|加油|停车|过路费|滴滴|出行|洗车|修车|保养)/i.test(q);
      const strongMedical = /(医院|看病|挂号|体检|药|药店|诊所|保健|营养品|保险|牙医|复诊)/i.test(q);
      if (strongTransport && !/(药费|挂号费|诊疗费|看病买药|看病拿药)/i.test(q)) return '交通出行';
      if (strongMedical && !strongTransport) return '医疗保健';
      const rules = [
        ['房贷', /(房贷|月供|按揭)/i],
        ['房租', /(房租|租金)/i],
        ['车贷', /(车贷)/i],
        ['物业', /(物业|物业费)/i],
        ['水电气', /(水费|电费|燃气|煤气|天然气|水电气|电卡|燃气费)/i],
        ['通讯网络', /(话费|宽带|流量|电话费|网费|网络费|通信|通讯)/i],
        ['快递物流', /(快递|运费|邮费|物流|配送费|跑腿)/i],
        ['交通出行', /(地铁|公交|打车|高铁|火车|机票|加油|停车|过路费|滴滴|出行|洗车|修车|保养)/i],
        ['医疗保健', /(医院|看病|挂号|体检|药|药店|诊所|保健|营养品|保险|牙医|复诊)/i],
        ['服饰美容', /(衣服|裤子|鞋|裙|外套|饰品|护肤|面霜|口红|香水|理发|美容|美甲|化妆)/i],
        ['文体教育', /(书|课程|买课|培训|资料|学费|教育|阅读|健身|羽毛球|瑜伽|乐器|画材)/i],
        ['人情往来', /(红包|礼物|请客|随礼|份子|孝敬|送给|送礼|人情)/i],
        ['旅游放松', /(旅游|旅行|酒店|民宿|景区|度假|机酒|周边游)/i],
        ['休闲娱乐', /(ktv|电影|酒吧|游戏|娱乐|桌游|演出|门票|按摩|足疗)/i],
        ['餐饮美食', /(咖啡|奶茶|饮料|吃饭|吃.{0,3}饭|餐|外卖|早餐|午餐|晚餐|夜宵|水果|零食|矿泉水|买菜|火锅|汉堡|茶|烧烤|小吃)/i],
        ['日用百货', /(纸巾|洗发水|洗面奶|牙刷|牙膏|清洁|家居|锅|被子|床单|收纳|日用|百货)/i],
      ];
      const matched = rules.find(([, re]) => re.test(q));
      return matched ? matched[0] : '日用百货';
    }

    function extractExplicitExpenseCategory(text = '') {
      const raw = String(text || '').trim();
      if (!raw) return '';
      const match = raw.match(/(?:归(?:到|类)?|分类(?:到|为)?|类目(?:是|为)?|记到|算到)\s*[“"'「『]?\s*([^\s，。,；;”"』』]+(?:[^\n，。,；;”"』』]{0,18}[^\s，。,；;”"』』])?)/i);
      return String(match?.[1] || '').trim();
    }

    function extractExplicitExpenseNote(text = '') {
      const raw = String(text || '').trim();
      if (!raw) return '';
      const match = raw.match(/(?:备注|注释|说明|memo|note)(?:是|为|改成|改为)?[：:\s]*[“"'「『]?([^”"'」』，。；;\n]+)[”"'」』]?/i);
      return String(match?.[1] || '').trim();
    }

    function buildRelativeExpenseDateTime(text = '', now = new Date()) {
      const raw = String(text || '').trim();
      if (!raw) return '';
      const base = new Date(now);
      if (/前天/i.test(raw)) base.setDate(base.getDate() - 2);
      else if (/昨天|昨晚/i.test(raw)) base.setDate(base.getDate() - 1);
      else if (/明天/i.test(raw)) base.setDate(base.getDate() + 1);
      let hour = base.getHours();
      let minute = base.getMinutes();
      if (/凌晨/i.test(raw)) {
        hour = 2;
        minute = 0;
      } else if (/早上|今早|上午/i.test(raw)) {
        hour = 9;
        minute = 0;
      } else if (/中午/i.test(raw)) {
        hour = 12;
        minute = 30;
      } else if (/下午/i.test(raw)) {
        hour = 15;
        minute = 0;
      } else if (/傍晚/i.test(raw)) {
        hour = 18;
        minute = 0;
      } else if (/晚上|今晚/i.test(raw)) {
        hour = 20;
        minute = 0;
      }
      const explicitTime = raw.match(/(\d{1,2})[:：](\d{2})/);
      if (explicitTime) {
        hour = Number(explicitTime[1] || hour);
        minute = Number(explicitTime[2] || minute);
      }
      base.setHours(hour, minute, 0, 0);
      return formatDateTimeFull(base).slice(0, 16);
    }

    function cleanExpenseItemText(text = '') {
      return String(text || '')
        .replace(/^(?:请|帮我|麻烦)?\s*(?:记一笔账|记账|记一下账|记账一下|记一下|记一笔)[：:\s]*/i, '')
        .replace(/^(今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上|我|自己)\s*/g, '')
        .replace(/^(买了|点了|交了|缴了|充值了|付了|花了|消费了|支出了)\s*/g, '')
        .replace(/^(一(?:个|台|笔|顿|单|份|张|部|箱|次|杯|件|台))\s*/g, '')
        .replace(/\s*(花费|花了|用了|付了|消费了|支出了)\s*$/g, '')
        .replace(/[，。,.!！；;]+$/g, '')
        .trim();
    }

    function extractExpenseRecordFromQuestion(question = '') {
      const q = String(question || '').trim();
      if (!looksLikeExpenseCaptureQuestion(q)) return null;
      const amountAtom = '(?:¥|￥|rmb\\s*)?\\d+(?:\\.\\d{1,2})?\\s*(?:元|块|块钱|人民币)?|\\d+\\s*块\\s*\\d(?:\\.\\d+)?\\s*(?:毛|角)?|[零一二两三四五六七八九十百]+\\s*(?:元|块|块钱|人民币)|[零一二两三四五六七八九十百]+\\s*块\\s*[零一二两三四五六七八九]\\s*(?:毛|角)?';
      const patterns = [
        /(买了|点了|交了|缴了|充值了|看病|挂号)?\s*([^，。,；;]+?)\s*(?:花了|用了|付了|消费了|支出了)\s*(?:¥|￥|rmb\s*)?(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱|人民币)?/i,
        /(?:花了|用了|付了|消费了|支出了)\s*(?:¥|￥|rmb\s*)?(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱|人民币)?\s*(?:买了|买|点了|交了|缴了|充值了|用于)?\s*([^，。,；;]+)/i,
        /(?:记账|记一笔|记一下|记.{0,2}账)[：:\s]*(?:花了|用了|付了)?\s*(?:¥|￥|rmb\s*)?(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱|人民币)?\s*([^，。,；;]+)/i,
        /(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)?\s*(?:我)?\s*(买了|点了|交了|缴了|充值了|充话费|看病|挂号)\s*([^，。,；;]+?)[，,\s]+((?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?|\d+\s*块\s*\d(?:\.\d+)?\s*(?:毛|角)?|[零一二两三四五六七八九十百]+\s*(?:元|块|块钱|人民币)|[零一二两三四五六七八九十百]+\s*块\s*[零一二两三四五六七八九]\s*(?:毛|角)?)/i,
        /(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)?()([^，。,；;？?\d]{1,24}?(?:费|打车|停车|咖啡|奶茶|外卖|早餐|午餐|晚餐|夜宵|房租|房贷|车贷|物业|电费|水费|燃气费|话费|宽带|快递|运费))[，,\s]*((?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?|\d+\s*块\s*\d(?:\.\d+)?\s*(?:毛|角)?|[零一二两三四五六七八九十百]+\s*(?:元|块|块钱|人民币)|[零一二两三四五六七八九十百]+\s*块\s*[零一二两三四五六七八九]\s*(?:毛|角)?)/i,
        new RegExp('()([^，。,；;？?\\d]{2,24})[，,\\s]+(' + amountAtom + ')[，,\\s]*(?:记.{0,2}账)', 'i'),
        new RegExp('^(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)?\\s*(?:我)?()\\s*([^，。,；;？?\\d]{2,20})\\s+(' + amountAtom + ')\\s*$', 'i'),
      ];
      for (const pattern of patterns) {
        const matched = q.match(pattern);
        if (!matched) continue;
        const amount = parseExpenseAmountFromNaturalText(matched[3] || matched[2] || matched[1] || '');
        let item = cleanExpenseItemText(matched[2] || matched[4] || matched[1] || '');
        if (item && looksLikeStandaloneExpenseAmountText(item)) item = cleanExpenseItemText(matched[1] || matched[4] || '');
        if (!Number.isFinite(amount) || amount <= 0 || !item) continue;
        const explicitCategory = extractExplicitExpenseCategory(q);
        const category = explicitCategory || inferExpenseCategoryFromText(`${item} ${q}`);
        const note = extractExplicitExpenseNote(q);
        const spentAt = buildRelativeExpenseDateTime(q) || formatDateTimeFull(new Date()).slice(0, 16);
        return {
          type: 'add_expense_record',
          item,
          amount: Math.round(amount * 100) / 100,
          category,
          note,
          spentAt,
          source: 'ai-chat',
        };
      }
      const trailingAmountMatch = q.match(new RegExp(`^(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)?\\s*(.+?)\\s*(${amountAtom})\\s*$`, 'i'));
      if (trailingAmountMatch) {
        const amount = parseExpenseAmountFromNaturalText(trailingAmountMatch[2] || '');
        const item = cleanExpenseItemText(trailingAmountMatch[1] || '');
        if (Number.isFinite(amount) && amount > 0 && item) {
          const explicitCategory = extractExplicitExpenseCategory(q);
          const category = explicitCategory || inferExpenseCategoryFromText(`${item} ${q}`);
          const note = extractExplicitExpenseNote(q);
          const spentAt = buildRelativeExpenseDateTime(q) || formatDateTimeFull(new Date()).slice(0, 16);
          return {
            type: 'add_expense_record',
            item,
            amount: Math.round(amount * 100) / 100,
            category,
            note,
            spentAt,
            source: 'ai-chat',
          };
        }
      }
      return null;
    }

    function buildExpenseCaptureConfirmationReply(record = null) {
      const safe = record && typeof record === 'object' ? record : null;
      const item = String(safe?.item || '这笔开销').trim() || '这笔开销';
      const amount = Number.isFinite(Number(safe?.amount)) ? Number(safe.amount).toFixed(2).replace(/\.00$/, '') : '';
      const category = String(safe?.category || '').trim();
      const spentAt = String(safe?.spentAt || '').trim();
      const whenText = spentAt ? `，时间记为 ${spentAt}` : '';
      const amountText = amount ? ` ${amount}` : '';
      const categoryText = category ? `，归到“${category}”` : '';
      return `已记账：${item}${amountText}${categoryText}${whenText}。`;
    }

    function shouldRouteExpenseCaptureThroughAI(question = '', options = {}) {
      const raw = String(question || '').trim();
      if (!raw) return false;
      if (Array.isArray(options.attachments) && options.attachments.length) return false;
      if (options.webSearchRequested) return false;
      if (/[?？]/.test(raw)) return false;
      if (/(导入|csv|表格|报表|统计|趋势|预算|分析|报销|汇总)/i.test(raw)) return false;
      const amountRe = /(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?|\d+\s*块\s*\d(?:\.\d+)?\s*(?:毛|角)?/i;
      if (!amountRe.test(raw)) return false;
      if (looksLikeExpenseCaptureQuestion(raw)) return true;
      return /^(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)?\s*(?:我)?\s*[^，。,；;？?\d]{1,24}?\s*(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?$/i.test(raw)
        || /^(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)?\s*(?:我)?\s*[^，。,；;？?\d]{1,24}?\s*\d+\s*块\s*\d(?:\.\d+)?\s*(?:毛|角)?$/i.test(raw);
    }

    function buildExpenseCaptureAIPrompt(question = '', nowText = '') {
      const now = String(nowText || getNowInAITimezoneText()).trim();
      const userText = String(question || '').trim();
      return [
        '你是 Morpheus 的财务动作提取器。',
        '任务：把用户这句自然语言记账输入，转换成严格 JSON。',
        '你只能返回 JSON，不能返回解释、不能返回 Markdown、不能返回代码块。',
        '唯一允许的 JSON 结构是：{"actions":[{"type":"add_expense_record","item":"...","amount":28,"category":"...","spentAt":"YYYY-MM-DD HH:mm","note":""}]}。',
        '如果这句话不是在记一笔真实支出，就返回 {"actions":[]}。',
        '分类优先从这些中选：餐饮美食、日用百货、医疗保健、交通出行、服饰美容、文体教育、人情往来、旅游放松、休闲娱乐、通讯网络、快递物流、水电气、物业、房租、房贷、车贷。',
        'item 不是类目名，而是用户实际买了什么或把钱花在什么事情上，要尽量具体。',
        '例如 item 应该写成“盒马水果坚果饼干”“卷纸”“锅盖”“送礼物”“滴滴打车”，不要只写成“餐饮美食”“超市采购”“交通”“日用”这类分类词。',
        '只有用户没有提供更具体对象时，才允许用“打车”“房租”这类事项词兜底。',
        '如果用户给了“归到某类/今天下午”这类信息，必须体现在 JSON 里。',
        `当前北京时间：${now}`,
        `用户输入：${userText}`,
      ].join('\n');
    }

    function isRecordInLedger(recordId) {
      try {
        const dataRef = typeof api.getData === 'function' ? api.getData() : null;
        if (!dataRef || typeof api.ensureExpenseLedgerShape !== 'function') return false;
        const ledger = api.ensureExpenseLedgerShape(dataRef);
        const records = Array.isArray(ledger.records) ? ledger.records : [];
        return records.some(r => String(r?.id || '') === String(recordId || ''));
      } catch (_) { return false; }
    }

    function directWriteExpenseRecord(actionPayload) {
      try {
        const dataRef = typeof api.getData === 'function' ? api.getData() : null;
        if (!dataRef || typeof api.ensureExpenseLedgerShape !== 'function') return false;
        const normalize = typeof api.normalizeExpenseLedgerRecord === 'function' ? api.normalizeExpenseLedgerRecord : null;
        const syncFiles = typeof api.syncExpenseLedgerExtensionFiles === 'function' ? api.syncExpenseLedgerExtensionFiles : null;
        const save = typeof api.saveData === 'function' ? api.saveData : null;
        const commit = typeof api.commitMorphCoreMutation === 'function' ? api.commitMorphCoreMutation : null;
        const categoryInfer = typeof api.inferExpenseCategoryFromText === 'function'
          ? api.inferExpenseCategoryFromText
          : inferExpenseCategoryFromText;

        const ledger = api.ensureExpenseLedgerShape(dataRef);
        const beforeLedger = (() => {
          try {
            return JSON.parse(JSON.stringify({
              categories: Array.isArray(ledger?.categories) ? ledger.categories : [],
              records: Array.isArray(ledger?.records) ? ledger.records : [],
            }));
          } catch (_) {
            return {
              categories: Array.isArray(ledger?.categories) ? ledger.categories.slice() : [],
              records: Array.isArray(ledger?.records) ? ledger.records.slice() : [],
            };
          }
        })();
        const rawRecord = {
          id: String(actionPayload.id || '').trim() || `expense_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          item: String(actionPayload.item || '').trim(),
          amount: Math.round(Number(actionPayload.amount) * 100) / 100,
          category: String(actionPayload.category || '').trim() || categoryInfer(String(actionPayload.item || '')),
          note: String(actionPayload.note || '').trim(),
          spentAt: String(actionPayload.spentAt || '').trim() || formatDateTimeFull(new Date()).slice(0, 16),
          createdAt: new Date().toISOString(),
          source: String(actionPayload.source || 'direct-expense-capture').trim(),
        };
        if (!rawRecord.item || !Number.isFinite(rawRecord.amount) || rawRecord.amount <= 0) return false;

        const record = normalize ? normalize(rawRecord) : rawRecord;
        if (!record || !record.item) return false;
        const postPersistTasks = syncFiles
          ? [() => { try { syncFiles(record); } catch (_) {} }]
          : [];

        if (!Array.isArray(ledger.categories)) ledger.categories = [];
        if (record.category && !ledger.categories.includes(record.category)) ledger.categories.push(record.category);
        if (!Array.isArray(ledger.records)) ledger.records = [];
        ledger.records.unshift(record);
        if (!commit) {
          ledger.categories = Array.isArray(beforeLedger?.categories) ? beforeLedger.categories.slice() : [];
          ledger.records = Array.isArray(beforeLedger?.records) ? beforeLedger.records.slice() : [];
          return false;
        }
        let commitResult = null;
        try {
          commitResult = commit({
            changed: true,
            source: 'manual',
            promptQuestion: `手动快捷记账：${String(record.item || '').trim()}`,
            actions: [{
              type: 'manual_create_expense_record',
              entityId: String(record.id || '').trim(),
              item: String(record.item || '').trim(),
              amount: Number(record.amount),
              category: String(record.category || '').trim(),
            }],
            actionTypes: ['manual_create_expense_record'],
            domains: ['expenseLedger'],
            beforeDomains: { expenseLedger: beforeLedger },
            appliedLabels: [`手动快捷记账：${String(record.item || '').trim()}`],
            detail: {
              entityId: String(record.id || '').trim(),
              item: String(record.item || '').trim(),
              amount: Number(record.amount),
              category: String(record.category || '').trim(),
            },
            entityRefs: [{
              domain: 'expenseLedger',
              entityType: 'expense_record',
              entityId: String(record.id || '').trim(),
              action: 'create',
              label: String(record.item || '').trim(),
            }],
            saveMode: 'data',
            immediatePersist: true,
            recordMorphActionTransaction: typeof api.recordMorphActionTransaction === 'function' ? api.recordMorphActionTransaction : null,
            protectRecentCommittedData: typeof api.protectRecentCommittedData === 'function' ? api.protectRecentCommittedData : null,
            saveData: save,
            currentTab: typeof api.getCurrentTab === 'function' ? api.getCurrentTab() : '',
            skipRender: true,
            postPersistTasks,
          });
        } catch (_) {
          commitResult = null;
        }
        const persisted = !!commitResult;
        if (!persisted) {
          ledger.categories = Array.isArray(beforeLedger?.categories) ? beforeLedger.categories.slice() : [];
          ledger.records = Array.isArray(beforeLedger?.records) ? beforeLedger.records.slice() : [];
        }
        if (!persisted) return null;
        return commitResult;
      } catch (err) {
        console.error('[Morpheus] directWriteExpenseRecord failed:', err?.message || err);
        return null;
      }
    }

    function ensureExpenseCommitted(actionPayload) {
      const id = String(actionPayload?.id || '').trim();
      if (id && isRecordInLedger(id)) return { ok: true, alreadyCommitted: true, commitResult: null };
      const commitResult = directWriteExpenseRecord(actionPayload);
      return commitResult
        ? { ok: true, alreadyCommitted: false, commitResult }
        : { ok: false, alreadyCommitted: false, commitResult: null };
    }

    function buildAppliedMeta(action, writeReceipt = null) {
      const label = `记账：${String(action.item || '')} ¥${action.amount}`;
      const transactionId = String(writeReceipt?.transactionId || '').trim();
      return {
        appliedLabels: [label],
        createdItems: [{ tab: 'expenseLedger', id: String(action.id || '').trim(), text: `${action.item} ¥${action.amount}` }],
        blockedLabels: [],
        blockedReason: '',
        actionExecutionTrace: [{
          type: 'add_expense_record',
          status: 'committed',
          transactionCommitted: true,
          mutationLayer: 'canonical',
          verifierStatus: 'verified',
          transactionId,
        }],
        transactionId,
        writeReceipt: writeReceipt && typeof writeReceipt === 'object' ? writeReceipt : null,
        commitReceipt: writeReceipt && typeof writeReceipt === 'object' ? writeReceipt : null,
      };
    }

    function isFormalCommittedTraceEntry(entry = null) {
      return !!(
        entry
        && String(entry.status || '').trim() === 'committed'
        && entry.transactionCommitted !== false
        && String(entry.type || '').trim()
      );
    }

    function hasExplicitNonCommittedMutationTrace(applied = null) {
      const trace = Array.isArray(applied?.actionExecutionTrace) ? applied.actionExecutionTrace : [];
      return trace.some((entry) => {
        if (!entry || !String(entry.type || '').trim()) return false;
        const status = String(entry.status || '').trim();
        return status === 'draft_applied'
          || status === 'applied_local'
          || (status === 'committed' && entry.transactionCommitted === false);
      });
    }

    function hasFormalCommittedExpenseWriteSurface(applied = null) {
      if (!applied || typeof applied !== 'object') return false;
      if ((applied.writeReceipt && typeof applied.writeReceipt === 'object')
        || (applied.commitReceipt && typeof applied.commitReceipt === 'object')) {
        return true;
      }
      const trace = Array.isArray(applied.actionExecutionTrace) ? applied.actionExecutionTrace : [];
      const committedActionTypes = Array.from(new Set(
        trace
          .filter((entry) => isFormalCommittedTraceEntry(entry))
          .map((entry) => String(entry.type || '').trim())
          .filter(Boolean)
      ));
      if (committedActionTypes.some((type) => !/^(?:list_|summarize_|plan_|chat$)/.test(String(type || '').trim()))) {
        return true;
      }
      return !hasExplicitNonCommittedMutationTrace(applied)
        && !!String(applied.transactionId || '').trim()
        && (
          (Array.isArray(applied.appliedLabels) && applied.appliedLabels.length > 0)
          || (Array.isArray(applied.createdItems) && applied.createdItems.length > 0)
        );
    }

    async function executeExpenseCaptureWithAI(question, context = {}) {
      const promptQuestion = String(question || '').trim();
      if (!shouldRouteExpenseCaptureThroughAI(promptQuestion, context)) return null;
      if (typeof api.applyAIActions !== 'function') return null;
      const makeId = typeof api.genId === 'function'
        ? api.genId
        : (() => `expense_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);

      const deterministicAction = extractExpenseRecordFromQuestion(promptQuestion);
      if (deterministicAction && deterministicAction.item && Number.isFinite(deterministicAction.amount) && deterministicAction.amount > 0) {
        const actionWithId = {
          ...deterministicAction,
          id: deterministicAction.id || makeId(),
          source: 'deterministic-expense-capture',
        };
        let applied = null;
        try {
          applied = await api.applyAIActions([actionWithId], { promptQuestion, allowMorphDataActions: true });
        } catch (_) {}
        const committed = ensureExpenseCommitted(actionWithId);
        if (!committed?.ok) return null;
        const reply = buildExpenseCaptureConfirmationReply(actionWithId);
        const safeApplied = hasFormalCommittedExpenseWriteSurface(applied)
          ? applied
          : buildAppliedMeta(actionWithId, committed.commitResult?.writeReceipt || committed.commitResult?.commitReceipt || null);
        return { ok: true, reply, applied: safeApplied, handledByStructuredExpenseAI: true };
      }

      if (typeof api.requestAIText !== 'function' || typeof api.extractAIChatStructuredResponse !== 'function') return null;
      const prompt = buildExpenseCaptureAIPrompt(promptQuestion, context.beijingNow);
      let rawText = '';
      try {
        rawText = await api.requestAIText(prompt, {
          stream: false,
          signal: typeof api.getAIAbortSignal === 'function' ? api.getAIAbortSignal() : null,
        });
      } catch (_) {
        return null;
      }
      const parsed = api.extractAIChatStructuredResponse(rawText);
      const effectiveActions = (Array.isArray(parsed?.actions) ? parsed.actions : [])
        .filter((action) => action && typeof action === 'object' && String(action.type || '').trim() === 'add_expense_record')
        .map((action) => ({
          ...action,
          id: action.id || makeId(),
          source: String(action.source || 'ai-chat-structured').trim() || 'ai-chat-structured',
        }));
      if (!effectiveActions.length) return null;
      const firstAction = effectiveActions[0];
      let applied = null;
      try {
        applied = await api.applyAIActions([firstAction], { promptQuestion, allowMorphDataActions: true });
      } catch (_) {}
      const committed = ensureExpenseCommitted(firstAction);
      if (!committed?.ok) return null;
      const reply = buildExpenseCaptureConfirmationReply(firstAction);
      const safeApplied = hasFormalCommittedExpenseWriteSurface(applied)
        ? applied
        : buildAppliedMeta(firstAction, committed.commitResult?.writeReceipt || committed.commitResult?.commitReceipt || null);
      return { ok: true, reply, applied: safeApplied, handledByStructuredExpenseAI: true };
    }

    return {
      looksLikeExpenseCaptureQuestion,
      parseChineseExpenseNumber,
      parseExpenseAmountFromNaturalText,
      inferExpenseCategoryFromText,
      extractExplicitExpenseCategory,
      buildRelativeExpenseDateTime,
      cleanExpenseItemText,
      extractExpenseRecordFromQuestion,
      buildExpenseCaptureConfirmationReply,
      shouldRouteExpenseCaptureThroughAI,
      buildExpenseCaptureAIPrompt,
      executeExpenseCaptureWithAI,
    };
  }

  window.MorphExpenseCaptureRuntime = { create: createExpenseCaptureRuntime };
})();
