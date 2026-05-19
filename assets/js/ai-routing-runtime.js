// @ts-check

(function initMorphAIRoutingRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIRoutingRuntime && typeof window.MorphAIRoutingRuntime.create === 'function') return;

  function createAIRoutingRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getRuntimeModules() {
      return typeof api.getRuntimeModules === 'function' ? api.getRuntimeModules() : null;
    }

    function isExternalAssistantConflictQuery(question) {
      const runtimeModules = getRuntimeModules();
      if (runtimeModules && typeof runtimeModules.isExternalAssistantConflictQuery === 'function') {
        return runtimeModules.isExternalAssistantConflictQuery(question);
      }
      const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!q) return false;

      const metaIntentPatterns = [
        /(为什么|为何|怎么|如何|帮我|请你|分析|解释|厘清|区分|修复|排查|处理).*(冲突|混乱|矛盾|误判|路由|提示词|system prompt|系统提示|身份)/i,
        /(冲突|混乱|矛盾|误判|路由|提示词|system prompt|系统提示|身份).*(为什么|为何|怎么|如何|帮我|请你|分析|解释|厘清|区分|修复|排查|处理)/i,
        /(这段|这份|这个).*(提示词|system prompt|系统提示|路由|身份).*(怎么|如何|为什么|有问题|冲突|混乱)/i,
      ];
      if (!metaIntentPatterns.some((pattern) => pattern.test(q))) return false;

      const roleConflictPatterns = [
        /我是\s*(perplexity|claude|chatgpt|gemini)/i,
        /我不是\s*morph/i,
        /不是\s*morph/i,
        /不是morph/i,
        /搜索助手/,
        /不是\s*morph.*(为什么|冲突|矛盾|误判|路由)/i,
        /(为什么|冲突|矛盾|误判|路由).*(perplexity|搜索助手|不是\s*morph)/i,
      ];
      return roleConflictPatterns.some((pattern) => pattern.test(q));
    }

    function shouldTreatAsMorphDataOperation(question) {
      const runtimeModules = getRuntimeModules();
      if (runtimeModules && typeof runtimeModules.shouldTreatAsMorphDataOperation === 'function') {
        return runtimeModules.shouldTreatAsMorphDataOperation(question);
      }

      const q = String(question || '').toLowerCase().trim();
      if (!q || isExternalAssistantConflictQuery(q)) return false;

      if (typeof api.hasPendingDailyLogCaptureIntent === 'function' && api.hasPendingDailyLogCaptureIntent()) return true;

      if (/(?:在|到|往).{0,4}(?:morph|应用内|app里).{0,12}(?:写|记|记录|新增|添加|删除|修改|更新|同步|放进|加入)/i.test(q)) return true;

      if (/提醒我/.test(q)) return true;
      if (/(?:新建|创建|新增|添加).{0,4}(?:一个|个)?(?:提醒|闹钟)/i.test(q)) return true;
      if (/帮我设置.{0,12}提醒/.test(q) || /设置(?:一个|个)提醒/.test(q) || /设(?:一个|个)提醒/.test(q)) return true;
      if (/\d{1,2}[点:：时]\d{0,2}分?\s*(?:的时候|时)?提醒/.test(q)) return true;
      if (/(?:明天|后天|下周|周[一二三四五六日天]).{0,10}提醒/.test(q)) return true;
      if (/(?:所有|全部).{0,6}(?:提醒|闹钟).{0,8}(?:删除|删掉|移除|去掉|清掉|清空|取消)/i.test(q)) return true;
      if (/(?:提醒|闹钟).{0,16}(?:删除|删掉|移除|去掉|清掉|取消|改到|改成|修改|更新|推迟|提前|重命名|改名|完成|标记)/i.test(q)) return true;
      if (/(?:删除|删掉|移除|去掉|清掉|取消|改到|改成|修改|更新|推迟|提前|重命名|改名|完成|标记).{0,16}(?:提醒|闹钟)/i.test(q)) return true;

      if (/(?:新建|创建|新增|添加|加一个|建一个).{0,12}(?:项目|project|节律|routine|闪念|定念|时间块|周计划|周时间块)/i.test(q)) return true;
      if (/(?:项目|project|节律|routine|闪念|定念|时间块|周计划|周时间块).{0,16}(?:归档|恢复|删除|删掉|移除|去掉|修改|更新|重命名|改名|改到|改成|完成|标记)/i.test(q)) return true;
      if (/(?:归档|恢复|删除|删掉|移除|去掉|修改|更新|重命名|改名|改到|改成|完成|标记).{0,16}(?:项目|project|节律|routine|闪念|定念|时间块|周计划|周时间块)/i.test(q)) return true;

      if (/(?:撤销|回退|恢复).{0,12}(?:刚刚|刚才|上一次|上次|那次|最近|这次)?(?:.{0,8}(?:操作|修改|写入|动作))?/i.test(q)) return true;
      if (/(?:从今天开始|以后|之后).{0,6}叫我|我的名字是|我叫/i.test(q)) return true;
      if (/^(?:请(?:你|我)?帮?我?)?(?:请记住|记住|记下)(?!不住\b)/.test(q)) return true;
      if (/(?:写入|写进|放进|放入|存进|存入|记进|记入|追加到|更新|修改|改写|重写).{0,18}(?:soul|user|identity|memory(?:-system)?)\.?md/i.test(q)) return true;
      if (/(?:soul|user|identity|memory(?:-system)?)\.?md.{0,18}(?:写入|写进|放进|放入|存进|存入|记进|记入|追加|更新|修改|改写|重写)/i.test(q)) return true;
      if (/(?:记录到|记到|记进|录到|录进|写入|写进|放进|加入).{0,20}(?:日志|日记)/.test(q)) return true;
      if (/(?:日志|日记).{0,16}(?:新增|添加|记录|写入|写进|修改|更新|删除|清空)/.test(q)) return true;
      if (/写到\s*\d{4}-\d{2}-\d{2}.{0,6}(?:日志|日记)/i.test(q)) return true;

      if (/(?:项目参考区|项目参考|参考区).*(?:添加|记录|保存|写入|放进|移动|挪到|去重|清重|合并)/i.test(q)) return true;
      if (/(?:添加|记录|保存|写入|放进|移动|挪到|去重|清重|合并).*(?:项目参考区|项目参考|参考区)/i.test(q)) return true;
      if (/(?:闪念|定念).*(?:参考区|项目参考|项目参考区|去重|清重|搬到项目|搬到参考|移到参考|挪到参考)/i.test(q)) return true;

      if (/记.{0,2}账/.test(q)) return true;

      if (/(?:吃完饭|吃了|喝了|喝咖啡|喝奶茶|打车|加油|理发|洗车|修车|寄快递).{0,12}\d+/i.test(q)) return true;
      return /(?:花了|花费|用了|付了|付款|消费|支出|买了|点了|交了|缴了|充值了|充话费).*(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?/i.test(q)
        || /(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?.*(?:买了|点了|花了|付了|消费|支出|房租|房贷|车贷|物业|水电|快递|打车|充话费|记.{0,2}账)/i.test(q);
    }

    async function fetchWithBackoff(url, payload, maxRetries = 3, fetchOptions = {}) {
      const fetchImpl = typeof api.fetchImpl === 'function' ? api.fetchImpl : (typeof fetch === 'function' ? fetch : null);
      if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
      const setTimeoutRef = typeof api.setTimeoutRef === 'function' ? api.setTimeoutRef : ((callback, delayMs) => setTimeout(callback, delayMs));
      const consoleRef = typeof api.getConsole === 'function' ? api.getConsole() : (typeof console !== 'undefined' ? console : null);

      let retries = 0;
      let delay = 1000;
      while (retries < maxRetries) {
        try {
          const response = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            ...fetchOptions,
          });
          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`HTTP ${response.status}: ${errBody}`);
          }
          return await response.json();
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          retries += 1;
          if (consoleRef && typeof consoleRef.warn === 'function') {
            consoleRef.warn(`API 请求失败 (第 ${retries} 次重试):`, err?.message);
          }
          if (retries >= maxRetries) throw err;
          await new Promise((resolve) => setTimeoutRef(resolve, delay));
          delay *= 2;
        }
      }
      throw new Error('fetch_with_backoff_exhausted');
    }

    return {
      isExternalAssistantConflictQuery,
      shouldTreatAsMorphDataOperation,
      fetchWithBackoff,
    };
  }

  window.MorphAIRoutingRuntime = {
    create: createAIRoutingRuntime,
  };
})();
