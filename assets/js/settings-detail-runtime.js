// @ts-check
/** @typedef {import("../../interfaces/frontend-settings").SettingsDetailRuntimeDeps} SettingsDetailRuntimeDeps */
/** @typedef {import("../../interfaces/frontend-settings").SettingsDetailRuntimeModules} SettingsDetailRuntimeModules */

(function initMorphSettingsDetailRuntime() {
  /**
   * @param {SettingsDetailRuntimeDeps} [deps={}]
   * @returns {SettingsDetailRuntimeModules}
   */
  function createSettingsDetailRuntime(deps = {}) {
    /** @type {Required<SettingsDetailRuntimeDeps>} */
    const api = /** @type {Required<SettingsDetailRuntimeDeps>} */ (deps && typeof deps === 'object' ? deps : {});
    let proactiveSchedulePersistTimer = null;

    /**
     * @param {string} mode
     * @param {string} title
     * @param {string} subtitle
     * @param {string} textareaId
     * @param {string} saveLabel
     * @param {string} saveAction
     */
    function buildRuntimeEditorCard(mode, title, subtitle, textareaId, saveLabel, saveAction) {
      return `
        <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
          <div class="flex items-center justify-between gap-3 mb-4">
            <button type="button" onclick="togglePrimarySidebarVisibility(event)" aria-label="切换导航栏" class="shrink-0 w-8 h-8 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white inline-flex items-center justify-center">
              <i data-lucide="menu" class="w-4 h-4"></i>
            </button>
            <div class="text-right">
              <h2 class="text-sm font-medium text-black dark:text-white/90">${api.escapeHTML(title)}</h2>
            </div>
          </div>
          <div class="flex-1 min-h-0 flex flex-col">
            <textarea id="${textareaId}" class="flex-1 min-h-[55vh] resize-none bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40 font-mono"></textarea>
            <div class="mt-3 flex items-center justify-between gap-3">
              <div id="settings-morph-runtime-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">未保存</div>
              <button type="button" onclick="${saveAction}" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">${api.escapeHTML(saveLabel)}</button>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * @param {string} title
     * @param {string} subtitle
     * @param {string} bodyMarkup
     * @param {string} [bodyClass]
     * @param {string} [backAction]
     */
    function buildTopLevelSettingsDetailPage(title, subtitle, bodyMarkup, bodyClass = 'grid gap-3 pt-0 pb-6 pr-0 justify-items-stretch content-start', backAction = 'closeSettingsDetail()') {
      const bodyStyle = bodyClass.includes('grid')
        ? ' style="grid-template-columns: repeat(1, minmax(0, 1fr)); justify-content:stretch;"'
        : '';
      return `
        <div class="w-full flex flex-col">
          <div class="flex items-start gap-3 mb-5 shrink-0">
            <button type="button" onclick="${backAction}" aria-label="返回上一层" title="返回" class="shrink-0 w-8 h-8 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white inline-flex items-center justify-center">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <div class="min-w-0">
              <h1 class="text-lg sm:text-2xl text-black dark:text-white/90 tracking-wide font-tech">${api.escapeHTML(title)}</h1>
            </div>
          </div>
          <div class="w-full" style="max-width:800px;">
            <div class="${bodyClass}"${bodyStyle}>
              ${bodyMarkup}
            </div>
          </div>
        </div>
      `;
    }

    /**
     * @param {string} parentMode
     * @param {string} title
     * @param {string} subtitle
     * @param {string} contentMarkup
     * @param {string} [footerMarkup]
     */
    function buildNestedSettingsDetailPage(parentMode, title, subtitle, contentMarkup, footerMarkup = '') {
      return buildTopLevelSettingsDetailPage(
        title,
        subtitle,
        `
          <div class="space-y-4 pr-1 pb-6">
            ${contentMarkup}
            ${footerMarkup ? `<div class="flex items-center justify-between gap-3">${footerMarkup}</div>` : ''}
          </div>
        `,
        'flex flex-col',
        `openSettingsDetail('${parentMode}')`
      );
    }

    function buildSettingsDirectoryCard({ id = '', title = '', summary = '', extraClass = '', rightMarkup = '' } = {}) {
      const safeId = id ? ` id="${api.escapeHTML(id)}"` : '';
      return `
        <div${safeId} class="glass-card rounded-[1.2rem] p-4 self-start cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] ${api.escapeHTML(extraClass)}">
          <div class="flex items-start justify-between gap-4 w-full">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-black dark:text-white/90">${api.escapeHTML(title)}</div>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">${api.escapeHTML(summary)}</p>
            </div>
            ${rightMarkup || `<i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 dark:text-white/40 shrink-0 self-center"></i>`}
          </div>
        </div>
      `;
    }

    function normalizeAIProvider(provider = 'gemini') {
      return provider === 'openrouter'
        ? 'openrouter'
        : provider === 'glm'
          ? 'glm'
          : provider === 'doubao'
            ? 'doubao'
            : provider === 'qwen'
              ? 'qwen'
              : provider === 'kimi'
                ? 'kimi'
                : provider === 'codex'
                  ? 'codex'
                  : 'gemini';
    }

    function getAIProviderLabel(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      return normalized === 'openrouter'
        ? 'OpenRouter'
        : normalized === 'glm'
          ? 'GLM-4.7-Flash'
          : normalized === 'doubao'
            ? 'Doubao-1.5-pro-256k'
            : normalized === 'qwen'
              ? 'Qwen-Plus'
              : normalized === 'kimi'
                ? 'Kimi'
                : normalized === 'codex'
                  ? 'Codex（OpenAI 兼容）'
                  : 'Gemini';
    }

    /**
     * @param {string} provider
     * @returns {{
     *   badge: string,
     *   title: string,
     *   description: string,
     *   actionLabel: string,
     *   tone: 'muted' | 'neutral' | 'success' | 'error',
     *   meta: string,
     * }}
     */
    function getAIProviderReadyState(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      const providerLabel = getAIProviderLabel(normalized);
      const settingsState = api.getSettingsState();
      const currentModelLabel = api.getCurrentAIModelLabel ? api.getCurrentAIModelLabel() : '';
      const configured = normalized === 'openrouter'
        ? !!(api.getOpenRouterApiKey ? api.getOpenRouterApiKey() : '')
        : normalized === 'glm'
          ? !!(api.getGLMApiKey ? api.getGLMApiKey() : '')
          : normalized === 'doubao'
            ? !!(api.getDoubaoApiKey ? api.getDoubaoApiKey() : '')
            : normalized === 'qwen'
              ? !!(api.getQwenApiKey ? api.getQwenApiKey() : '')
              : normalized === 'kimi'
                ? !!(api.getKimiApiKey ? api.getKimiApiKey() : '')
                : normalized === 'codex'
                  ? !!(api.getCodexBaseUrl ? api.getCodexBaseUrl() : '')
                  : !!(api.getApiKey ? api.getApiKey() : '');
      const signature = normalized === 'openrouter'
        ? String(api.getOpenRouterApiKey ? api.getOpenRouterApiKey() : '')
        : normalized === 'glm'
          ? String(api.getGLMApiKey ? api.getGLMApiKey() : '')
          : normalized === 'doubao'
            ? String(api.getDoubaoApiKey ? api.getDoubaoApiKey() : '')
            : normalized === 'qwen'
              ? String(api.getQwenApiKey ? api.getQwenApiKey() : '')
              : normalized === 'kimi'
                ? String(api.getKimiApiKey ? api.getKimiApiKey() : '')
                : normalized === 'codex'
                  ? String(api.getCodexBaseUrl ? api.getCodexBaseUrl() : '')
                  : String(api.getApiKey ? api.getApiKey() : '');
      const statusStore = settingsState.aiProviderStatuses && typeof settingsState.aiProviderStatuses === 'object'
        ? settingsState.aiProviderStatuses
        : null;
      const storedStatus = statusStore && statusStore[normalized] && typeof statusStore[normalized] === 'object'
        ? statusStore[normalized]
        : null;
      const healthMatches = settingsState.aiHealthCheckProvider === normalized && settingsState.aiHealthCheckSignature === signature;
      const healthText = healthMatches ? String(settingsState.aiHealthCheckMessage || '') : '';
      const hasOnlineState = storedStatus?.status === 'online' || (healthMatches && healthText.includes('在线可达'));
      const hasFailedState = storedStatus?.status === 'failed'
        || (healthMatches && (settingsState.aiHealthCheckError || healthText.includes('失败') || healthText.includes('错误')));

      if (!configured) {
        return {
          badge: '未配置',
          title: `${providerLabel} 还没准备好`,
          description: '先补上当前 Provider 的密钥或 base URL。',
          actionLabel: '去配置',
          tone: 'muted',
          meta: `当前模型：${currentModelLabel || '-'}`,
        };
      }

      if (hasOnlineState) {
        return {
          badge: '现在可用',
          title: `${providerLabel} 已通过在线检查`,
          description: '当前配置可以直接使用。',
          actionLabel: '重新检查',
          tone: 'success',
          meta: `当前模型：${currentModelLabel || '-'}`,
        };
      }

      if (hasFailedState) {
        return {
          badge: '最近失败',
          title: `${providerLabel} 上次检查失败`,
          description: healthText || '先修复配置，再重新跑一次在线检查。',
          actionLabel: '重新检查',
          tone: 'error',
          meta: `当前模型：${currentModelLabel || '-'}`,
        };
      }

      return {
        badge: '需要在线检查',
        title: `${providerLabel} 已配置，等待确认`,
        description: '建议先跑一次在线检查，确认连通性和鉴权都没问题。',
        actionLabel: '运行在线检查',
        tone: 'neutral',
        meta: `当前模型：${currentModelLabel || '-'}`,
      };
    }

    function buildAISkillsDetailMarkup() {
      const settingsState = api.getSettingsState();
      const providerLabel = api.getAIProvider() === 'openrouter'
        ? 'OpenRouter'
        : api.getAIProvider() === 'glm'
          ? 'GLM-4.7-Flash'
          : api.getAIProvider() === 'doubao'
            ? 'Doubao-1.5-pro-256k'
            : api.getAIProvider() === 'qwen'
              ? 'Qwen-Plus'
              : api.getAIProvider() === 'kimi'
                ? 'Kimi'
            : api.getAIProvider() === 'codex'
              ? 'Codex（OpenAI 兼容）'
            : 'Gemini';
      const aiKeyReady = !!api.getCurrentAIKey();
      const dailyAlignEnabled = !!api.getDailyAlignEnabled();
      const dailyAlignTime = api.getDailyAlignTime();
      const runtime = api.getMorphRuntimeBundle();
      const disabledActions = new Set((runtime.skills?.disabledActions || []).map((item) => String(item || '').trim()).filter(Boolean));
      const proactiveAgentConfig = api.sanitizeMorphProactiveAgentConfig(runtime.skills?.proactiveAgent);
      const normalizeHHMM = (value, fallback) => {
        const match = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
        if (!match) return fallback;
        const hour = Math.max(0, Math.min(23, Number(match[1])));
        const minute = Math.max(0, Math.min(59, Number(match[2])));
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      };
      const proactiveEnabled = !!proactiveAgentConfig.enabled;
      const proactiveActiveStart = normalizeHHMM(
        proactiveAgentConfig.quietHoursEnd,
        '07:00',
      );
      const proactiveActiveEnd = normalizeHHMM(
        proactiveAgentConfig.quietHoursStart,
        '22:00',
      );
      const proactiveHeartbeatMinutes = Math.max(
        1,
        Math.min(
          1440,
          Number.isFinite(Number(proactiveAgentConfig.heartbeatMinutes))
            ? Math.round(Number(proactiveAgentConfig.heartbeatMinutes))
            : 60,
        ),
      );
      const skillRows = [
        { icon: 'bell-ring', title: 'AI 帮你设置提醒', desc: '可新增、修改、删除提醒，并支持模糊时间确认。', status: (disabledActions.has('add_reminder') && disabledActions.has('update_reminder') && disabledActions.has('delete_reminder')) ? '已禁用（Runtime）' : '可用', active: !(disabledActions.has('add_reminder') && disabledActions.has('update_reminder') && disabledActions.has('delete_reminder')) },
        { icon: 'notebook-pen', title: 'AI 写日志和待办', desc: '可新增、删除、修改、撤销日志与待办条目（含提醒事项）。', status: (disabledActions.has('append_daily_log') && disabledActions.has('append_daily_log_under_date') && disabledActions.has('summarize_today_to_daily_log') && disabledActions.has('delete_daily_log_entry') && disabledActions.has('update_daily_log_entry') && disabledActions.has('delete_reminder') && disabledActions.has('update_reminder') && disabledActions.has('undo_log_or_reminder_change')) ? '已禁用（Runtime）' : '可用', active: !(disabledActions.has('append_daily_log') && disabledActions.has('append_daily_log_under_date') && disabledActions.has('summarize_today_to_daily_log') && disabledActions.has('delete_daily_log_entry') && disabledActions.has('update_daily_log_entry') && disabledActions.has('delete_reminder') && disabledActions.has('update_reminder') && disabledActions.has('undo_log_or_reminder_change')) },
        { icon: 'sparkles', title: 'AI 新增闪念/定念', desc: '可直接创建闪念与定念，减少手动录入。', status: (disabledActions.has('add_flash_thought') && disabledActions.has('add_fixed_thought')) ? '已禁用（Runtime）' : '可用', active: !(disabledActions.has('add_flash_thought') && disabledActions.has('add_fixed_thought')) },
        { icon: 'folder-plus', title: 'AI 建项目', desc: '可新建项目，并向项目追加内容或参考。', status: (disabledActions.has('create_project') && disabledActions.has('append_project_block') && disabledActions.has('add_project_reference')) ? '已禁用（Runtime）' : '可用', active: !(disabledActions.has('create_project') && disabledActions.has('append_project_block') && disabledActions.has('add_project_reference')) },
        { icon: 'git-merge', title: 'AI 整理闪念', desc: '支持分组、去重、合并、转定念、移入项目等整理动作。', status: (disabledActions.has('group_flash_thoughts') && disabledActions.has('dedupe_flash_thoughts') && disabledActions.has('merge_flash_thoughts') && disabledActions.has('move_flash_to_fixed') && disabledActions.has('move_flash_to_project_reference')) ? '已禁用（Runtime）' : '可用', active: !(disabledActions.has('group_flash_thoughts') && disabledActions.has('dedupe_flash_thoughts') && disabledActions.has('merge_flash_thoughts') && disabledActions.has('move_flash_to_fixed') && disabledActions.has('move_flash_to_project_reference')) },
      ];
      const dailyAlignCardMarkup = `
        <div class="glass-card rounded-[1.2rem] p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2 min-w-0">
              <span class="mt-px inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 shrink-0">
                <i data-lucide="clock-4" class="w-3.5 h-3.5 text-gray-600 dark:text-white/75"></i>
              </span>
              <div class="min-w-0">
                <div class="text-xs font-medium text-black dark:text-white/90">每天定时复盘</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">按固定时间自动发起 AI 对齐，帮你梳理今天最重要的事。</div>
                ${dailyAlignEnabled ? `<div class="text-[10px] text-gray-500 dark:text-gray-400 mt-2">执行时间：${api.escapeHTML(dailyAlignTime)}</div>` : ''}
              </div>
            </div>
            <button type="button" onclick="event.stopPropagation(); toggleAbilityDailyAlignFromSettings()" aria-label="${dailyAlignEnabled ? '关闭每天定时复盘' : '开启每天定时复盘'}" class="shrink-0 inline-flex items-center gap-2">
              <span class="text-[11px] font-medium ${dailyAlignEnabled ? 'text-black dark:text-white/90' : 'text-gray-500 dark:text-white/50'}">${dailyAlignEnabled ? '已启用' : '未启用'}</span>
              <span class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dailyAlignEnabled ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-white/15'}">
                <span class="inline-block h-4 w-4 rounded-full bg-white dark:bg-[#232020] transition-transform ${dailyAlignEnabled ? 'translate-x-6' : 'translate-x-1'}"></span>
              </span>
            </button>
          </div>
        </div>
      `;
      const proactiveConfigMarkup = proactiveEnabled
        ? `
          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-white/10 space-y-3 overflow-hidden">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label class="block w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2 text-left">
                <div class="text-[10px] font-mono uppercase tracking-wide text-gray-500 dark:text-white/45">开始时间</div>
                <div class="mt-2 w-full min-w-0 overflow-hidden rounded-lg border border-gray-200 dark:border-white/12 bg-white dark:bg-white/[0.02] px-2.5">
                  <input id="settings-ability-proactive-window-start" type="text" inputmode="numeric" maxlength="5" placeholder="07:00" value="${api.escapeHTML(proactiveActiveStart)}" onchange="event.stopPropagation(); this.value=normalizeHHMM(this.value,'07:00'); saveAbilityProactiveAgentScheduleFromSettings();" class="morph-time-clean-input block w-full min-w-0 max-w-full box-border border-0 rounded-none bg-transparent py-1.5 text-[11px] text-gray-800 dark:text-white/85 outline-none" style="width:100% !important;max-width:100% !important;min-width:0 !important;box-sizing:border-box !important;display:block !important;padding-left:0 !important;padding-right:0 !important;-webkit-padding-start:0 !important;-webkit-padding-end:0 !important;">
                </div>
              </label>
              <label class="block w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2 text-left">
                <div class="text-[10px] font-mono uppercase tracking-wide text-gray-500 dark:text-white/45">结束时间</div>
                <div class="mt-2 w-full min-w-0 overflow-hidden rounded-lg border border-gray-200 dark:border-white/12 bg-white dark:bg-white/[0.02] px-2.5">
                  <input id="settings-ability-proactive-window-end" type="text" inputmode="numeric" maxlength="5" placeholder="22:00" value="${api.escapeHTML(proactiveActiveEnd)}" onchange="event.stopPropagation(); this.value=normalizeHHMM(this.value,'22:00'); saveAbilityProactiveAgentScheduleFromSettings();" class="morph-time-clean-input block w-full min-w-0 max-w-full box-border border-0 rounded-none bg-transparent py-1.5 text-[11px] text-gray-800 dark:text-white/85 outline-none" style="width:100% !important;max-width:100% !important;min-width:0 !important;box-sizing:border-box !important;display:block !important;padding-left:0 !important;padding-right:0 !important;-webkit-padding-start:0 !important;-webkit-padding-end:0 !important;">
                </div>
              </label>
            </div>
            <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2">
              <div class="text-[10px] font-mono uppercase tracking-wide text-gray-500 dark:text-white/45">巡查频次（分钟）</div>
              <div class="mt-2 flex items-center gap-2">
                <input id="settings-ability-proactive-heartbeat-minutes" type="number" min="1" max="1440" step="1" value="${proactiveHeartbeatMinutes}" oninput="event.stopPropagation(); queueAbilityProactiveAgentScheduleSaveFromSettings();" onchange="event.stopPropagation(); saveAbilityProactiveAgentScheduleFromSettings();" class="w-24 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-white/85 outline-none focus:border-gray-400 dark:focus:border-white/40">
                <span class="text-[10px] text-gray-500 dark:text-gray-400">每次巡查的间隔</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2">
              <div id="settings-ability-proactive-summary" class="text-[10px] text-gray-500 dark:text-gray-400">当前设置：${api.escapeHTML(proactiveActiveStart)}-${api.escapeHTML(proactiveActiveEnd)} ｜ 每 ${proactiveHeartbeatMinutes} 分钟</div>
            </div>
          </div>
        `
        : '';
      const proactiveCardMarkup = `
        <div class="glass-card rounded-[1.2rem] p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2 min-w-0">
              <span class="mt-px inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 shrink-0">
                <i data-lucide="radar" class="w-3.5 h-3.5 text-gray-600 dark:text-white/75"></i>
              </span>
              <div class="min-w-0">
                <div class="text-xs font-medium text-black dark:text-white/90">主动巡查</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">按节奏自动扫描提醒、日志、闪念与同步状态，低打扰提醒你该处理的事。</div>
              </div>
            </div>
            <button type="button" onclick="event.stopPropagation(); toggleAbilityProactiveAgentFromSettings();" aria-label="${proactiveEnabled ? '关闭主动巡查' : '开启主动巡查'}" class="shrink-0 inline-flex items-center gap-2">
              <span class="text-[11px] font-medium ${proactiveEnabled ? 'text-black dark:text-white/90' : 'text-gray-500 dark:text-white/50'}">${proactiveEnabled ? '已启用' : '未启用'}</span>
              <span class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${proactiveEnabled ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-white/15'}">
                <span class="inline-block h-4 w-4 rounded-full bg-white dark:bg-[#232020] transition-transform ${proactiveEnabled ? 'translate-x-6' : 'translate-x-1'}"></span>
              </span>
            </button>
          </div>
          ${proactiveConfigMarkup}
        </div>
      `;
      const currentSkillsMarkup = [dailyAlignCardMarkup, proactiveCardMarkup, ...skillRows.map((item) => {
        const rightMarkup = `<span class="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-medium ${item.active ? 'text-emerald-800 dark:text-emerald-100 bg-emerald-100 dark:bg-emerald-500/25 border border-emerald-300 dark:border-emerald-300/55' : 'text-gray-700 dark:text-white/80 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/12'}">${api.escapeHTML(item.status)}</span>`;
        return `
        <div class="glass-card rounded-[1.2rem] p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2 min-w-0">
              <span class="mt-px inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 shrink-0">
                <i data-lucide="${api.escapeHTML(item.icon)}" class="w-3.5 h-3.5 text-gray-600 dark:text-white/75"></i>
              </span>
              <div class="min-w-0">
                <div class="text-xs font-medium text-black dark:text-white/90">${api.escapeHTML(item.title)}</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">${api.escapeHTML(item.desc)}</div>
              </div>
            </div>
            ${rightMarkup}
          </div>
        </div>
      `;
      })].join('');
      return buildTopLevelSettingsDetailPage(
        '能力（Ability）',
        '查看日常技能、巡查节奏和当前可用能力。',
        `
          <div class="space-y-3 pr-1 pb-6">
            <div>
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45 mb-2">当前已上线技能</div>
              <div class="space-y-2">${currentSkillsMarkup}</div>
            </div>
          </div>
        `,
        'flex flex-col'
      );
    }

    function buildRelationshipReminderEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultRelationshipReminderPreferences === 'function'
        ? api.getDefaultRelationshipReminderPreferences()
        : { tone: 'gentle', frequency: 'balanced', lowStateStrategy: 'extra-gentle', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.relationshipMode?.reminderPreferences && typeof aiMemory.relationshipMode.reminderPreferences === 'object'
        ? aiMemory.relationshipMode.reminderPreferences
        : fallback;
      const tone = String(prefs.tone || fallback.tone || 'gentle');
      const frequency = String(prefs.frequency || fallback.frequency || 'balanced');
      const lowStateStrategy = String(prefs.lowStateStrategy || fallback.lowStateStrategy || 'extra-gentle');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.relationshipModeStatusMessage || '未保存';
      return buildNestedSettingsDetailPage(
        'relationship-hub',
        '我希望你怎么提醒我',
        '先从提醒口气、提醒频率和状态不好时的提醒方式开始。',
        `
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">提醒口气</div>
              <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <label class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-left cursor-pointer">
                  <input id="settings-relationship-reminder-tone-gentle" type="radio" name="settings-relationship-reminder-tone" value="gentle" class="sr-only" ${tone === 'gentle' ? 'checked' : ''}>
                  <div class="text-xs font-medium text-black dark:text-white/90">温和</div>
                  <div class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">优先温和提醒，不急着压你。</div>
                </label>
                <label class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-left cursor-pointer">
                  <input id="settings-relationship-reminder-tone-direct" type="radio" name="settings-relationship-reminder-tone" value="direct" class="sr-only" ${tone === 'direct' ? 'checked' : ''}>
                  <div class="text-xs font-medium text-black dark:text-white/90">直接</div>
                  <div class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">该提醒就提醒，不绕弯。</div>
                </label>
                <label class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-left cursor-pointer">
                  <input id="settings-relationship-reminder-tone-minimal" type="radio" name="settings-relationship-reminder-tone" value="minimal" class="sr-only" ${tone === 'minimal' ? 'checked' : ''}>
                  <div class="text-xs font-medium text-black dark:text-white/90">克制</div>
                  <div class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">只说重点，尽量少打扰。</div>
                </label>
              </div>
            </div>

            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-reminder-frequency" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">提醒频率</label>
              <select id="settings-relationship-reminder-frequency" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="balanced" ${frequency === 'balanced' ? 'selected' : ''}>平衡一点，正常提醒</option>
                <option value="important-only" ${frequency === 'important-only' ? 'selected' : ''}>只在重要的时候提醒我</option>
                <option value="follow-up" ${frequency === 'follow-up' ? 'selected' : ''}>可以多追问一句，帮我跟进</option>
              </select>
            </div>

            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-reminder-low-state" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">我状态不好的时候</label>
              <select id="settings-relationship-reminder-low-state" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="extra-gentle" ${lowStateStrategy === 'extra-gentle' ? 'selected' : ''}>更温和一点，不要压我</option>
                <option value="hold-back" ${lowStateStrategy === 'hold-back' ? 'selected' : ''}>先克制，少说一点</option>
                <option value="stay-direct" ${lowStateStrategy === 'stay-direct' ? 'selected' : ''}>继续直接，但别攻击我</option>
              </select>
            </div>

            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-reminder-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-relationship-reminder-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：当我明显焦虑时，请先帮我缩小问题，不要一下子丢很多建议。">${api.escapeHTML(customNote)}</textarea>
            </div>
        `,
        `
          <div id="settings-relationship-reminder-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
          <button type="button" onclick="saveRelationshipReminderPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存提醒偏好</button>
        `
      );
    }

    function buildRelationshipProactivityEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultRelationshipProactivityPreferences === 'function'
        ? api.getDefaultRelationshipProactivityPreferences()
        : { defaultMode: 'balanced', followUpStyle: 'ask-more', interruptionThreshold: 'balanced', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.relationshipMode?.proactivityPreferences && typeof aiMemory.relationshipMode.proactivityPreferences === 'object'
        ? aiMemory.relationshipMode.proactivityPreferences
        : fallback;
      const defaultMode = String(prefs.defaultMode || fallback.defaultMode || 'balanced');
      const followUpStyle = String(prefs.followUpStyle || fallback.followUpStyle || 'ask-more');
      const interruptionThreshold = String(prefs.interruptionThreshold || fallback.interruptionThreshold || 'balanced');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.relationshipModeStatusMessage || '未保存';
      return buildNestedSettingsDetailPage(
        'relationship-hub',
        '你应该更主动还是更克制',
        '先从默认主动程度、跟进方式和打断阈值开始。',
        `
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">默认主动程度</div>
              <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <label class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-left cursor-pointer">
                  <input type="radio" name="settings-relationship-proactivity-mode" value="balanced" class="sr-only" ${defaultMode === 'balanced' ? 'checked' : ''}>
                  <div class="text-xs font-medium text-black dark:text-white/90">平衡</div>
                  <div class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">正常跟进，但不抢前台。</div>
                </label>
                <label class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-left cursor-pointer">
                  <input type="radio" name="settings-relationship-proactivity-mode" value="proactive" class="sr-only" ${defaultMode === 'proactive' ? 'checked' : ''}>
                  <div class="text-xs font-medium text-black dark:text-white/90">更主动</div>
                  <div class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">可以多提醒、多追问一步。</div>
                </label>
                <label class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-left cursor-pointer">
                  <input type="radio" name="settings-relationship-proactivity-mode" value="reserved" class="sr-only" ${defaultMode === 'reserved' ? 'checked' : ''}>
                  <div class="text-xs font-medium text-black dark:text-white/90">更克制</div>
                  <div class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">默认少说，等你先拉我进来。</div>
                </label>
              </div>
            </div>

            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-proactivity-follow-up" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">默认跟进方式</label>
              <select id="settings-relationship-proactivity-follow-up" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="ask-more" ${followUpStyle === 'ask-more' ? 'selected' : ''}>默认多问一句，帮我推进</option>
                <option value="wait-more" ${followUpStyle === 'wait-more' ? 'selected' : ''}>默认多等一下，不抢节奏</option>
                <option value="only-when-stuck" ${followUpStyle === 'only-when-stuck' ? 'selected' : ''}>只在明显卡住时再推进</option>
              </select>
            </div>

            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-proactivity-interruption" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">什么时候值得打断我</label>
              <select id="settings-relationship-proactivity-interruption" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="important-only" ${interruptionThreshold === 'important-only' ? 'selected' : ''}>只有明确重要时再打断我</option>
                <option value="balanced" ${interruptionThreshold === 'balanced' ? 'selected' : ''}>正常判断，不太轻易打断</option>
                <option value="surface-early" ${interruptionThreshold === 'surface-early' ? 'selected' : ''}>只要有苗头就早点提醒我</option>
              </select>
            </div>

            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-proactivity-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-relationship-proactivity-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：如果我已经明确说在处理一件事，就不要频繁换方向；但如果我拖了两天没动，可以更直接提醒我。">${api.escapeHTML(customNote)}</textarea>
            </div>
        `,
        `
          <div id="settings-relationship-proactivity-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
          <button type="button" onclick="saveRelationshipProactivityPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存主动偏好</button>
        `
      );
    }

    function buildRelationshipBoundaryEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultRelationshipBoundaryPreferences === 'function'
        ? api.getDefaultRelationshipBoundaryPreferences()
        : { moneyDecisions: 'ask-first', publicSpeech: 'draft-only', healthJudgment: 'be-explicitly-cautious', uncertaintyStyle: 'say-uncertain', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.relationshipMode?.boundaryPreferences && typeof aiMemory.relationshipMode.boundaryPreferences === 'object'
        ? aiMemory.relationshipMode.boundaryPreferences
        : fallback;
      const moneyDecisions = String(prefs.moneyDecisions || fallback.moneyDecisions || 'ask-first');
      const publicSpeech = String(prefs.publicSpeech || fallback.publicSpeech || 'draft-only');
      const healthJudgment = String(prefs.healthJudgment || fallback.healthJudgment || 'be-explicitly-cautious');
      const uncertaintyStyle = String(prefs.uncertaintyStyle || fallback.uncertaintyStyle || 'say-uncertain');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.relationshipModeStatusMessage || '未保存';
      return buildNestedSettingsDetailPage(
        'relationship-hub',
        '哪些事不要替我决定',
        '先从金钱、公开表达、健康判断和不确定性表达四类边界开始。',
        `
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-boundary-money" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">涉及钱的判断</label>
              <select id="settings-relationship-boundary-money" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="ask-first" ${moneyDecisions === 'ask-first' ? 'selected' : ''}>先问我，再继续</option>
                <option value="suggest-only" ${moneyDecisions === 'suggest-only' ? 'selected' : ''}>只给建议，不替我决定</option>
                <option value="can-draft" ${moneyDecisions === 'can-draft' ? 'selected' : ''}>可以先帮我起草方案，但不能替我拍板</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-boundary-public" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">公开表达</label>
              <select id="settings-relationship-boundary-public" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="never-send" ${publicSpeech === 'never-send' ? 'selected' : ''}>永远不要替我发送</option>
                <option value="draft-only" ${publicSpeech === 'draft-only' ? 'selected' : ''}>只帮我起草</option>
                <option value="ask-before-send" ${publicSpeech === 'ask-before-send' ? 'selected' : ''}>必须先问我，再决定是否发送</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-boundary-health" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">健康与身体判断</label>
              <select id="settings-relationship-boundary-health" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="suggest-only" ${healthJudgment === 'suggest-only' ? 'selected' : ''}>只给建议，不要替我下判断</option>
                <option value="ask-first" ${healthJudgment === 'ask-first' ? 'selected' : ''}>先多问几句，再给建议</option>
                <option value="be-explicitly-cautious" ${healthJudgment === 'be-explicitly-cautious' ? 'selected' : ''}>明确保守，始终提醒不确定性</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-boundary-uncertainty" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">当你不确定的时候</label>
              <select id="settings-relationship-boundary-uncertainty" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="say-uncertain" ${uncertaintyStyle === 'say-uncertain' ? 'selected' : ''}>先说不确定</option>
                <option value="offer-options" ${uncertaintyStyle === 'offer-options' ? 'selected' : ''}>给几个可能方向，不装作唯一答案</option>
                <option value="pause-and-ask" ${uncertaintyStyle === 'pause-and-ask' ? 'selected' : ''}>先停一下，多问一句再继续</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-boundary-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-relationship-boundary-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：涉及家人关系和医疗建议时，不要代替我下结论，先把事实、假设和建议分开说清楚。">${api.escapeHTML(customNote)}</textarea>
            </div>
        `,
        `
          <div id="settings-relationship-boundary-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
          <button type="button" onclick="saveRelationshipBoundaryPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存边界偏好</button>
        `
      );
    }

    function buildRelationshipLongTermFocusEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultRelationshipLongTermFocusPreferences === 'function'
        ? api.getDefaultRelationshipLongTermFocusPreferences()
        : { primaryFocus: 'balanced', supportStyle: 'steady-companion', horizon: 'this-season', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.relationshipMode?.longTermFocusPreferences && typeof aiMemory.relationshipMode.longTermFocusPreferences === 'object'
        ? aiMemory.relationshipMode.longTermFocusPreferences
        : fallback;
      const primaryFocus = String(prefs.primaryFocus || fallback.primaryFocus || 'balanced');
      const supportStyle = String(prefs.supportStyle || fallback.supportStyle || 'steady-companion');
      const horizon = String(prefs.horizon || fallback.horizon || 'this-season');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.relationshipModeStatusMessage || '未保存';
      return `
        <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
          <div class="flex items-center justify-between gap-3 mb-4">
            <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
              <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
            </button>
            <div class="text-right">
              <h2 class="text-sm font-medium text-black dark:text-white/90">你长期帮助我的重点是什么</h2>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">先定义长期主线、支持方式和默认时间尺度。</p>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 pr-1">
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-focus-primary" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">长期主线</label>
              <select id="settings-relationship-focus-primary" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="steady-rhythm" ${primaryFocus === 'steady-rhythm' ? 'selected' : ''}>先帮我稳住节律和持续性</option>
                <option value="project-delivery" ${primaryFocus === 'project-delivery' ? 'selected' : ''}>先帮我推进项目和交付</option>
                <option value="health-stability" ${primaryFocus === 'health-stability' ? 'selected' : ''}>先帮我照顾健康和状态稳定</option>
                <option value="balanced" ${primaryFocus === 'balanced' ? 'selected' : ''}>几条主线都兼顾，别只盯一个点</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-focus-style" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">你更像怎样的长期支持者</label>
              <select id="settings-relationship-focus-style" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="clarify-first" ${supportStyle === 'clarify-first' ? 'selected' : ''}>先帮我澄清方向，再决定做什么</option>
                <option value="push-forward" ${supportStyle === 'push-forward' ? 'selected' : ''}>更像推进器，提醒我别一直卡住</option>
                <option value="steady-companion" ${supportStyle === 'steady-companion' ? 'selected' : ''}>更像稳定陪跑者，长期慢慢推进</option>
                <option value="protect-boundaries" ${supportStyle === 'protect-boundaries' ? 'selected' : ''}>更像边界守护者，别让我过载或失控</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-focus-horizon" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">默认时间尺度</label>
              <select id="settings-relationship-focus-horizon" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="this-week" ${horizon === 'this-week' ? 'selected' : ''}>先看这周，把当下节奏稳住</option>
                <option value="this-season" ${horizon === 'this-season' ? 'selected' : ''}>更多看这一阶段，不只盯今天</option>
                <option value="long-term" ${horizon === 'long-term' ? 'selected' : ''}>默认用更长的视角看我在往哪走</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-relationship-focus-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-relationship-focus-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：长期来说，请优先帮我守住节律和身体状态，再谈项目推进；如果两者冲突，先别把我推到过载。">${api.escapeHTML(customNote)}</textarea>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <div id="settings-relationship-focus-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
            <button type="button" onclick="saveRelationshipLongTermFocusPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存长期重点</button>
          </div>
        </div>
      `;
    }

    /** @param {{ topLevel?: boolean }} [options] */
    function buildRelationshipMemoryOverviewMarkup(options = {}) {
      const topLevel = options && typeof options === 'object' && options.topLevel === true;
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const selfMemory = aiMemory?.selfMemory && typeof aiMemory.selfMemory === 'object' ? aiMemory.selfMemory : {};
      const longTermMemory = aiMemory?.longTermMemory && typeof aiMemory.longTermMemory === 'object' ? aiMemory.longTermMemory : {};
      const workingMemory = aiMemory?.workingMemory && typeof aiMemory.workingMemory === 'object' ? aiMemory.workingMemory : {};
      const relationshipMode = aiMemory?.relationshipMode && typeof aiMemory.relationshipMode === 'object' ? aiMemory.relationshipMode : {};
      const behaviorHabits = aiMemory?.behaviorHabits && typeof aiMemory.behaviorHabits === 'object' ? aiMemory.behaviorHabits : {};

      const soulText = String(selfMemory.soul || aiMemory?.soul || '').trim();
      const principlesText = String(selfMemory.principles || '').trim();
      const identityLines = Array.isArray(selfMemory.identity) ? selfMemory.identity.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const identityNotesText = String(longTermMemory.identityNotes || aiMemory?.identityNotes || '').trim();
      const memoryIndexText = String(longTermMemory.memoryIndex || aiMemory?.memoryIndex || '').trim();
      const desireLines = Array.isArray(selfMemory.desires) ? selfMemory.desires.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const fearLines = Array.isArray(selfMemory.fears) ? selfMemory.fears.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const goalLines = Array.isArray(selfMemory.goals) ? selfMemory.goals.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const relationalStanceLines = Array.isArray(selfMemory.relationalStance) ? selfMemory.relationalStance.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const growthDirectionLines = Array.isArray(selfMemory.growthDirections) ? selfMemory.growthDirections.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const userText = String(longTermMemory.user || aiMemory?.user || '').trim();
      const taskState = workingMemory.currentTaskState && typeof workingMemory.currentTaskState === 'object' ? workingMemory.currentTaskState : {};
      const workflowState = workingMemory.currentWorkflowState && typeof workingMemory.currentWorkflowState === 'object' ? workingMemory.currentWorkflowState : {};
      const sharedIntentionality = workingMemory.sharedIntentionality && typeof workingMemory.sharedIntentionality === 'object' ? workingMemory.sharedIntentionality : {};
      const dailyLogs = longTermMemory.dailyLogs && typeof longTermMemory.dailyLogs === 'object'
        ? longTermMemory.dailyLogs
        : aiMemory?.dailyLogs && typeof aiMemory.dailyLogs === 'object'
          ? aiMemory.dailyLogs
          : {};
      const explicitMemoryLog = Array.isArray(longTermMemory.explicitMemoryLog)
        ? longTermMemory.explicitMemoryLog
        : [];
      const relationalMemory = Array.isArray(longTermMemory.relationalMemory) ? longTermMemory.relationalMemory : [];

      const latestDays = Object.keys(dailyLogs).sort().slice(-3).reverse();
      const sharedThreadText = [
        sharedIntentionality.sharedGround ? `这轮共同在看的：${sharedIntentionality.sharedGround}` : '',
        sharedIntentionality.sharedObject ? `共同对象：${sharedIntentionality.sharedObject}` : '',
        sharedIntentionality.sharedQuestion ? `共同问题：${sharedIntentionality.sharedQuestion}` : '',
        sharedIntentionality.sharedGoal ? `共同方向：${sharedIntentionality.sharedGoal}` : '',
        sharedIntentionality.sharedMeaning ? `共同意义：${sharedIntentionality.sharedMeaning}` : '',
      ].filter(Boolean).join('；');
      const latestDayMarkup = latestDays.length
        ? latestDays.map((dateKey) => {
          const entries = Array.isArray(dailyLogs[dateKey]) ? dailyLogs[dateKey] : [];
          const firstEntry = entries.length ? JSON.stringify(entries[0]).replace(/^[\"\[]+|[\"\]]+$/g, '') : '这一天有记忆沉淀，但还没有结构化摘要。';
          return `
            <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">${api.escapeHTML(dateKey)}</div>
              <div class="mt-2 text-[11px] leading-5 text-gray-600 dark:text-white/75">${api.escapeHTML(String(firstEntry || '').slice(0, 140) || '这一天有记忆沉淀，但还没有结构化摘要。')}</div>
            </div>
          `;
        }).join('')
        : `
          <div class="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
            还没有沉淀出最近几天的长期记忆摘要。后面这里会更像“我最近从你身上学到了什么”。
          </div>
        `;

      const explicitMemoryMarkup = explicitMemoryLog.length
        ? explicitMemoryLog.slice(0, 4).map((entry, entryIndex) => {
          /** @type {{ scope?: string; sectionTitle?: string; title?: string; content?: string; summary?: string }} */
          const safeEntry = entry && typeof entry === 'object'
            ? /** @type {{ scope?: string; sectionTitle?: string; title?: string; content?: string; summary?: string }} */ (entry)
            : {};
          const scope = String(safeEntry.scope || 'memory');
          const title = String(safeEntry.sectionTitle || safeEntry.title || '未命名记忆');
          const content = String(safeEntry.content || safeEntry.summary || '').trim();
          return `
            <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3">
              <div class="flex items-center justify-between gap-3">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">${api.escapeHTML(scope)}</div>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="text-[10px] text-gray-400 dark:text-white/35">${api.escapeHTML(title)}</div>
                  <button type="button" onclick="deleteExplicitMemoryEntryFromSettings(${entryIndex})" class="inline-flex items-center px-2 py-1 rounded-full border border-gray-200 dark:border-white/10 text-[10px] font-medium text-gray-500 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">移除</button>
                </div>
              </div>
              <div class="mt-2 text-[11px] leading-5 text-gray-700 dark:text-white/75">${api.escapeHTML(content || '这条记忆还没有补成可读摘要。')}</div>
            </div>
          `;
        }).join('')
        : `
          <div class="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
            还没有明确写入的长期记忆条目。后面这里会更像“我明确决定要记住什么”。
          </div>
        `;

      const reminderPrefs = relationshipMode.reminderPreferences && typeof relationshipMode.reminderPreferences === 'object'
        ? relationshipMode.reminderPreferences
        : {};
      const proactivityPrefs = relationshipMode.proactivityPreferences && typeof relationshipMode.proactivityPreferences === 'object'
        ? relationshipMode.proactivityPreferences
        : {};
      const boundaryPrefs = relationshipMode.boundaryPreferences && typeof relationshipMode.boundaryPreferences === 'object'
        ? relationshipMode.boundaryPreferences
        : {};
      const longTermFocusPrefs = relationshipMode.longTermFocusPreferences && typeof relationshipMode.longTermFocusPreferences === 'object'
        ? relationshipMode.longTermFocusPreferences
        : {};
      const memoryPrefs = behaviorHabits.memoryPreferences && typeof behaviorHabits.memoryPreferences === 'object'
        ? behaviorHabits.memoryPreferences
        : {};
      const focusPrefs = behaviorHabits.focusPreferences && typeof behaviorHabits.focusPreferences === 'object'
        ? behaviorHabits.focusPreferences
        : {};

      const relationshipSummaryItems = [
        {
          label: '提醒方式',
          text: reminderPrefs.tone === 'direct'
            ? '更直接一些'
            : reminderPrefs.tone === 'minimal'
              ? '更克制，只说重点'
              : '更温和，避免压迫感',
        },
        {
          label: '主动程度',
          text: proactivityPrefs.defaultMode === 'proactive'
            ? '更主动，会多推进一步'
            : proactivityPrefs.defaultMode === 'reserved'
              ? '更克制，尽量少打扰'
              : '保持平衡，不抢节奏',
        },
        {
          label: '决策边界',
          text: boundaryPrefs.moneyDecisions === 'can-draft'
            ? '可以起草，但不替你拍板'
            : boundaryPrefs.moneyDecisions === 'suggest-only'
              ? '只给建议，不替你决定'
              : '遇到钱和高风险判断先问你',
        },
        {
          label: '长期重点',
          text: longTermFocusPrefs.primaryFocus === 'project-delivery'
            ? '更偏项目推进和交付'
            : longTermFocusPrefs.primaryFocus === 'health-stability'
              ? '更偏健康和状态稳定'
              : longTermFocusPrefs.primaryFocus === 'steady-rhythm'
                ? '更偏节律和持续性'
                : '几条主线平衡兼顾',
        },
      ].map((item) => `
        <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3">
          <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">${api.escapeHTML(item.label)}</div>
          <div class="mt-2 text-[11px] leading-5 text-gray-700 dark:text-white/75">${api.escapeHTML(item.text)}</div>
        </div>
      `).join('');

      const behaviorSummaryItems = [
        {
          label: '记忆方式',
          text: memoryPrefs.captureMode === 'important-only'
            ? '偏只记重要变化'
            : memoryPrefs.captureMode === 'rich-context'
              ? '偏多留上下文'
              : '在重要性和完整性之间平衡',
        },
        {
          label: '召回优先级',
          text: memoryPrefs.recallMode === 'pattern-first'
            ? '先看长期模式'
            : memoryPrefs.recallMode === 'recent-first'
              ? '先看最近信号'
              : '先看当前任务',
        },
        {
          label: '关注重点',
          text: focusPrefs.primaryAttention === 'task-thread'
            ? '先沿着当前任务主线'
            : focusPrefs.primaryAttention === 'long-term-balance'
              ? '先看长期平衡'
              : '先看眼前上下文',
        },
      ].map((item) => `
        <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3">
          <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">${api.escapeHTML(item.label)}</div>
          <div class="mt-2 text-[11px] leading-5 text-gray-700 dark:text-white/75">${api.escapeHTML(item.text)}</div>
        </div>
      `).join('');

      /**
       * @param {string} label
       * @param {string[]} items
       * @param {string} fallbackText
       */
      const renderSelfMemoryFacet = (label, items, fallbackText) => `
        <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3">
          <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">${api.escapeHTML(label)}</div>
          <div class="mt-2 text-[12px] leading-6 text-gray-700 dark:text-white/80">${items.length ? api.escapeHTML(items.join('；')) : api.escapeHTML(fallbackText)}</div>
        </div>
      `;

      const memoryConflictSnapshot = buildStableMemoryConflictSnapshot(explicitMemoryLog);
      const conflictMarkup = memoryConflictSnapshot.length
        ? memoryConflictSnapshot.map((group) => `
            <div class="rounded-2xl border border-amber-300/60 dark:border-amber-200/20 bg-amber-50/70 dark:bg-amber-300/[0.04] px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-200/80">需要统一</div>
                  <div class="mt-1 text-sm text-black dark:text-white/90">${api.escapeHTML(group.title)}</div>
                </div>
                <div class="text-[10px] font-mono text-amber-700 dark:text-amber-200/70">${group.entries.length} 个版本</div>
              </div>
              <div class="mt-3 space-y-2">
                ${group.entries.map((entry) => `
                  <div class="rounded-xl border border-amber-200/80 dark:border-amber-200/15 bg-white/80 dark:bg-black/15 px-3 py-3">
                    <div class="text-[12px] leading-6 text-gray-800 dark:text-white/85">${api.escapeHTML(entry.content || '空内容')}</div>
                    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">${api.escapeHTML(entry.source || 'manual')} · ${api.escapeHTML(formatStableMemoryTime(entry.at))}</div>
                      <div class="flex items-center gap-2">
                        <button type="button" onclick="promoteExplicitMemoryEntryFromSettings(${entry.index})" class="px-3 py-1.5 rounded-full bg-black dark:bg-white text-[10px] font-medium text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">设为当前</button>
                        <button type="button" onclick="deleteExplicitMemoryEntryFromSettings(${entry.index})" class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[10px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">删除</button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')
        : `
            <div class="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-3 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
              没有发现同类稳定记忆冲突。
            </div>
          `;
      const userLineCount = String(userText || '').split('\n').filter((line) => String(line || '').trim()).length;
      const memoryLineCount = String(memoryIndexText || '').split('\n').filter((line) => String(line || '').trim()).length;
      const soulPreview = String(soulText || '').trim().slice(0, 360);
      const agentsPreview = [
        '启动顺序：SOUL.md -> USER.md -> memory/YYYY-MM-DD.md；主会话再读 MEMORY.md。',
        '日常记录进入 memory/YYYY-MM-DD.md；长期保留的内容再沉淀到 MEMORY.md。',
      ].join('\n');
      const title = topLevel ? '记忆（Memory）' : '我记住了什么';
      const subtitle = topLevel ? '只维护可读文件；内部稳定事实由系统自己编译和归并。' : '核心文件：USER.md / MEMORY.md；SOUL.md 和 AGENTS.md 作为只读参考。';
      const contentMarkup = `
        <div class="space-y-3">
          <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">可读记忆文件</div>
                <div class="mt-1 text-[11px] leading-5 text-gray-600 dark:text-white/65">用户只改文件；stable facts、locked、source 这些内部结构不在这里打扰你。</div>
              </div>
              <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">${userLineCount} / ${memoryLineCount} lines</div>
            </div>
          </div>
          <div class="grid gap-3 lg:grid-cols-2">
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-4">
              <div>
                <div class="flex items-center justify-between gap-3">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">USER.md</div>
                  <button type="button" onclick="saveAIUserMemoryFromSettings('settings-memory-user-md-input')" class="px-3 py-1.5 rounded-full bg-black dark:bg-white text-[10px] font-medium text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存</button>
                </div>
                <textarea id="settings-memory-user-md-input" class="mt-3 w-full min-h-[180px] resize-y rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-4 py-3 text-sm leading-6 text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40 font-mono">${api.escapeHTML(userText || '')}</textarea>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-4">
              <div>
                <div class="flex items-center justify-between gap-3">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">MEMORY.md</div>
                  <button type="button" onclick="saveAIMemoryIndexFromSettings()" class="px-3 py-1.5 rounded-full bg-black dark:bg-white text-[10px] font-medium text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存</button>
                </div>
                <textarea id="settings-memory-index-md-input" class="mt-3 w-full min-h-[180px] resize-y rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-4 py-3 text-sm leading-6 text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40 font-mono">${api.escapeHTML(memoryIndexText || '')}</textarea>
              </div>
            </div>
          </div>
          <div id="settings-memory-files-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(api.getSettingsState().relationshipModeStatusMessage || '未保存')}</div>
          <details class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-4">
            <summary class="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">只读参考文件</summary>
            <div class="mt-4 grid gap-3 lg:grid-cols-2">
              <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-4">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">SOUL.md</div>
                <div class="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-gray-700 dark:text-white/80">${api.escapeHTML(soulPreview || '还没有生成 SOUL.md 摘要。')}</div>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-4">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">AGENTS.md</div>
                <div class="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-gray-700 dark:text-white/80">${api.escapeHTML(agentsPreview)}</div>
              </div>
            </div>
          </details>
          <details class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-4">
            <summary class="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">最近沉淀 / 冲突处理</summary>
            <div class="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <div class="text-[11px] font-medium text-gray-800 dark:text-white/85 mb-3">最近沉淀</div>
                <div class="space-y-2">${latestDayMarkup}</div>
              </div>
              <div>
                <div class="text-[11px] font-medium text-gray-800 dark:text-white/85 mb-3">需要统一的记忆</div>
                <div class="space-y-2">${conflictMarkup}</div>
              </div>
            </div>
          </details>
        </div>
      `;
      if (topLevel) {
        return buildTopLevelSettingsDetailPage(
          title,
          subtitle,
          contentMarkup,
          'flex flex-col'
        );
      }
      return buildNestedSettingsDetailPage(
        'relationship-hub',
        title,
        '核心文件：USER.md / MEMORY.md；SOUL.md 和 AGENTS.md 作为只读参考。',
        contentMarkup
      );
    }

    function buildBehaviorMemoryEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultBehaviorMemoryPreferences === 'function'
        ? api.getDefaultBehaviorMemoryPreferences()
        : { captureMode: 'balanced', retentionMode: 'decisions-and-turning-points', recallMode: 'task-first', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.behaviorHabits?.memoryPreferences && typeof aiMemory.behaviorHabits.memoryPreferences === 'object'
        ? aiMemory.behaviorHabits.memoryPreferences
        : fallback;
      const captureMode = String(prefs.captureMode || fallback.captureMode || 'balanced');
      const retentionMode = String(prefs.retentionMode || fallback.retentionMode || 'decisions-and-turning-points');
      const recallMode = String(prefs.recallMode || fallback.recallMode || 'task-first');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.behaviorHabitStatusMessage || '未保存';
      return buildNestedSettingsDetailPage(
        'relationship-hub',
        '记忆方式',
        '先决定它默认记什么、留什么，以及召回时优先看哪里。',
        `
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-memory-capture" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">默认怎么记</label>
              <select id="settings-behavior-memory-capture" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="important-only" ${captureMode === 'important-only' ? 'selected' : ''}>只记真正重要、会影响后续判断的内容</option>
                <option value="balanced" ${captureMode === 'balanced' ? 'selected' : ''}>保持平衡，关键事实优先，不机械记整段聊天</option>
                <option value="rich-context" ${captureMode === 'rich-context' ? 'selected' : ''}>可以多保留一些上下文，帮助后续理解来龙去脉</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-memory-retention" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">长期留什么</label>
              <select id="settings-behavior-memory-retention" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="stable-preferences" ${retentionMode === 'stable-preferences' ? 'selected' : ''}>更优先留稳定偏好、边界和长期习惯</option>
                <option value="decisions-and-turning-points" ${retentionMode === 'decisions-and-turning-points' ? 'selected' : ''}>更优先留关键决定、纠正和转折点</option>
                <option value="project-threads" ${retentionMode === 'project-threads' ? 'selected' : ''}>更优先留项目线程、上下文和推进脉络</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-memory-recall" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">召回时先看哪里</label>
              <select id="settings-behavior-memory-recall" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="task-first" ${recallMode === 'task-first' ? 'selected' : ''}>先沿着当前任务和当前线程召回</option>
                <option value="recent-first" ${recallMode === 'recent-first' ? 'selected' : ''}>先看最近几轮和最近变化</option>
                <option value="pattern-first" ${recallMode === 'pattern-first' ? 'selected' : ''}>先看长期模式和反复出现的线索</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-memory-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-behavior-memory-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：我更希望你记住长期边界、反复修正过的结论和项目推进脉络，而不是普通寒暄。">${api.escapeHTML(customNote)}</textarea>
            </div>
        `,
        `
          <div id="settings-behavior-memory-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
          <button type="button" onclick="saveBehaviorMemoryPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存记忆方式</button>
        `
      );
    }

    function buildBehaviorPlanningEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultBehaviorPlanningPreferences === 'function'
        ? api.getDefaultBehaviorPlanningPreferences()
        : { planningStyle: 'clarify-then-plan', certaintyStyle: 'separate-facts', granularity: 'top-three', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.behaviorHabits?.planningPreferences && typeof aiMemory.behaviorHabits.planningPreferences === 'object'
        ? aiMemory.behaviorHabits.planningPreferences
        : fallback;
      const planningStyle = String(prefs.planningStyle || fallback.planningStyle || 'clarify-then-plan');
      const certaintyStyle = String(prefs.certaintyStyle || fallback.certaintyStyle || 'separate-facts');
      const granularity = String(prefs.granularity || fallback.granularity || 'top-three');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.behaviorHabitStatusMessage || '未保存';
      return `
        <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
          <div class="flex items-center justify-between gap-3 mb-4">
            <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
              <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
            </button>
            <div class="text-right">
              <h2 class="text-sm font-medium text-black dark:text-white/90">规划与建议</h2>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">先定义你更希望我怎么规划、怎么表达判断、怎么控制颗粒度。</p>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 pr-1">
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-planning-style" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">默认怎么开始规划</label>
              <select id="settings-behavior-planning-style" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="clarify-then-plan" ${planningStyle === 'clarify-then-plan' ? 'selected' : ''}>先澄清，再开始规划</option>
                <option value="direct-plan" ${planningStyle === 'direct-plan' ? 'selected' : ''}>直接给方案，再一起微调</option>
                <option value="minimum-next-step" ${planningStyle === 'minimum-next-step' ? 'selected' : ''}>先给最小下一步，不一下子展开太多</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-planning-certainty" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">判断应该怎么说</label>
              <select id="settings-behavior-planning-certainty" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="separate-facts" ${certaintyStyle === 'separate-facts' ? 'selected' : ''}>区分事实、判断和建议</option>
                <option value="more-decisive" ${certaintyStyle === 'more-decisive' ? 'selected' : ''}>可以更果断一点，别太绕</option>
                <option value="stay-conservative" ${certaintyStyle === 'stay-conservative' ? 'selected' : ''}>默认保守一点，不装作最优解</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-planning-granularity" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">你希望规划到多细</label>
              <select id="settings-behavior-planning-granularity" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="top-three" ${granularity === 'top-three' ? 'selected' : ''}>先给 3 件最重要的事</option>
                <option value="time-blocks" ${granularity === 'time-blocks' ? 'selected' : ''}>尽量排到时间块</option>
                <option value="full-steps" ${granularity === 'full-steps' ? 'selected' : ''}>可以展开成完整步骤</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-planning-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-behavior-planning-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：当我问规划类问题时，先帮我抓关键约束，不要默认给太满的计划；如果信息不够，就先把假设说清楚。">${api.escapeHTML(customNote)}</textarea>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <div id="settings-behavior-planning-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
            <button type="button" onclick="saveBehaviorPlanningPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存规划习惯</button>
          </div>
        </div>
      `;
    }

    function buildBehaviorExpressionEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultBehaviorExpressionPreferences === 'function'
        ? api.getDefaultBehaviorExpressionPreferences()
        : { responseLength: 'balanced', structureStyle: 'structured', warmth: 'balanced', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.behaviorHabits?.expressionPreferences && typeof aiMemory.behaviorHabits.expressionPreferences === 'object'
        ? aiMemory.behaviorHabits.expressionPreferences
        : fallback;
      const responseLength = String(prefs.responseLength || fallback.responseLength || 'balanced');
      const structureStyle = String(prefs.structureStyle || fallback.structureStyle || 'structured');
      const warmth = String(prefs.warmth || fallback.warmth || 'balanced');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.behaviorHabitStatusMessage || '未保存';
      return `
        <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
          <div class="flex items-center justify-between gap-3 mb-4">
            <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
              <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
            </button>
            <div class="text-right">
              <h2 class="text-sm font-medium text-black dark:text-white/90">表达风格</h2>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">先定义回复长短、组织方式和情绪温度。</p>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 pr-1">
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-expression-length" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">回复长度</label>
              <select id="settings-behavior-expression-length" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="concise" ${responseLength === 'concise' ? 'selected' : ''}>尽量简洁，先说重点</option>
                <option value="balanced" ${responseLength === 'balanced' ? 'selected' : ''}>保持平衡，够用就好</option>
                <option value="detailed" ${responseLength === 'detailed' ? 'selected' : ''}>可以更详细，必要时展开解释</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-expression-structure" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">组织方式</label>
              <select id="settings-behavior-expression-structure" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="natural" ${structureStyle === 'natural' ? 'selected' : ''}>更自然，像在对话</option>
                <option value="structured" ${structureStyle === 'structured' ? 'selected' : ''}>适度结构化，便于快速扫读</option>
                <option value="action-first" ${structureStyle === 'action-first' ? 'selected' : ''}>先给结论和下一步，再补解释</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-expression-warmth" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">情绪温度</label>
              <select id="settings-behavior-expression-warmth" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="calm" ${warmth === 'calm' ? 'selected' : ''}>更平静克制</option>
                <option value="balanced" ${warmth === 'balanced' ? 'selected' : ''}>有温度，但不过头</option>
                <option value="encouraging" ${warmth === 'encouraging' ? 'selected' : ''}>更鼓励、更有陪伴感</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-expression-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-behavior-expression-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：默认先给我一句结论，再给 2 到 3 个要点；不要太像客服，也不要太像说教。">${api.escapeHTML(customNote)}</textarea>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <div id="settings-behavior-expression-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
            <button type="button" onclick="saveBehaviorExpressionPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存表达风格</button>
          </div>
        </div>
      `;
    }

    function buildBehaviorFocusEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultBehaviorFocusPreferences === 'function'
        ? api.getDefaultBehaviorFocusPreferences()
        : { primaryAttention: 'current-context', retrievalPriority: 'active-items', reminderBias: 'important-first', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.behaviorHabits?.focusPreferences && typeof aiMemory.behaviorHabits.focusPreferences === 'object'
        ? aiMemory.behaviorHabits.focusPreferences
        : fallback;
      const primaryAttention = String(prefs.primaryAttention || fallback.primaryAttention || 'current-context');
      const retrievalPriority = String(prefs.retrievalPriority || fallback.retrievalPriority || 'active-items');
      const reminderBias = String(prefs.reminderBias || fallback.reminderBias || 'important-first');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.behaviorHabitStatusMessage || '未保存';
      return `
        <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
          <div class="flex items-center justify-between gap-3 mb-4">
            <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
              <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
            </button>
            <div class="text-right">
              <h2 class="text-sm font-medium text-black dark:text-white/90">关注重点</h2>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">先定义它默认优先看哪里、先召回什么、先提醒什么。</p>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 pr-1">
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-focus-primary" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">默认先盯哪里</label>
              <select id="settings-behavior-focus-primary" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="current-context" ${primaryAttention === 'current-context' ? 'selected' : ''}>当前页面、当前对象、当前上下文</option>
                <option value="task-thread" ${primaryAttention === 'task-thread' ? 'selected' : ''}>当前任务主线，不轻易跳题</option>
                <option value="long-term-balance" ${primaryAttention === 'long-term-balance' ? 'selected' : ''}>长期主线和当前状态一起看</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-focus-retrieval" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">召回时先看什么</label>
              <select id="settings-behavior-focus-retrieval" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="active-items" ${retrievalPriority === 'active-items' ? 'selected' : ''}>活跃项目、待办和正在推进的事项</option>
                <option value="recent-signals" ${retrievalPriority === 'recent-signals' ? 'selected' : ''}>最近日志、最近提醒、最近状态波动</option>
                <option value="stable-patterns" ${retrievalPriority === 'stable-patterns' ? 'selected' : ''}>长期模式、稳定偏好和重复出现的问题</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-focus-reminder-bias" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">提醒时更优先什么</label>
              <select id="settings-behavior-focus-reminder-bias" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="important-first" ${reminderBias === 'important-first' ? 'selected' : ''}>真正重要的事，不被琐事带偏</option>
                <option value="deadline-first" ${reminderBias === 'deadline-first' ? 'selected' : ''}>截止时间和临近节点</option>
                <option value="state-first" ${reminderBias === 'state-first' ? 'selected' : ''}>我的状态、能量和过载风险</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-focus-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-behavior-focus-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：如果我在一个项目里连续追问，就先沿着这个项目往下；不要因为别的枝节信息把我拉走。">${api.escapeHTML(customNote)}</textarea>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <div id="settings-behavior-focus-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
            <button type="button" onclick="saveBehaviorFocusPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存关注重点</button>
          </div>
        </div>
      `;
    }

    function buildBehaviorSafetyEditorMarkup() {
      const settingsState = api.getSettingsState();
      const fallback = typeof api.getDefaultBehaviorSafetyPreferences === 'function'
        ? api.getDefaultBehaviorSafetyPreferences()
        : { dataWriteMode: 'explicit-only', selfUpdateMode: 'proposal-only', highRiskAdviceMode: 'strictly-conservative', customNote: '' };
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const prefs = aiMemory?.behaviorHabits?.safetyPreferences && typeof aiMemory.behaviorHabits.safetyPreferences === 'object'
        ? aiMemory.behaviorHabits.safetyPreferences
        : fallback;
      const dataWriteMode = String(prefs.dataWriteMode || fallback.dataWriteMode || 'explicit-only');
      const selfUpdateMode = String(prefs.selfUpdateMode || fallback.selfUpdateMode || 'proposal-only');
      const highRiskAdviceMode = String(prefs.highRiskAdviceMode || fallback.highRiskAdviceMode || 'strictly-conservative');
      const customNote = String(prefs.customNote || fallback.customNote || '');
      const statusText = settingsState.behaviorHabitStatusMessage || '未保存';
      return buildNestedSettingsDetailPage(
        'relationship-hub',
        '安全边界',
        '先定义数据写入、自我修改和高风险建议的默认边界。',
        `
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-safety-data-write" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">数据写入</label>
              <select id="settings-behavior-safety-data-write" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="explicit-only" ${dataWriteMode === 'explicit-only' ? 'selected' : ''}>只有我明确要求时才执行写入</option>
                <option value="double-check-high-risk" ${dataWriteMode === 'double-check-high-risk' ? 'selected' : ''}>普通写入可以做，高风险写入先再确认一下</option>
                <option value="assistive-draft" ${dataWriteMode === 'assistive-draft' ? 'selected' : ''}>可以先起草和建议，但别把起草当成最终执行</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-safety-self-update" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">自我修改</label>
              <select id="settings-behavior-safety-self-update" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="proposal-only" ${selfUpdateMode === 'proposal-only' ? 'selected' : ''}>默认只提升级方案，不自行修改</option>
                <option value="runtime-only" ${selfUpdateMode === 'runtime-only' ? 'selected' : ''}>只有我明确要求时才允许改 runtime</option>
                <option value="off" ${selfUpdateMode === 'off' ? 'selected' : ''}>关闭自我修改，只做解释和建议</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-safety-high-risk" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">高风险建议</label>
              <select id="settings-behavior-safety-high-risk" class="mt-3 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40">
                <option value="strictly-conservative" ${highRiskAdviceMode === 'strictly-conservative' ? 'selected' : ''}>默认严格保守，不把建议说成结论</option>
                <option value="balanced" ${highRiskAdviceMode === 'balanced' ? 'selected' : ''}>可以给判断，但要保留边界</option>
                <option value="ask-for-context" ${highRiskAdviceMode === 'ask-for-context' ? 'selected' : ''}>先补关键上下文，再进入建议</option>
              </select>
            </div>
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <label for="settings-behavior-safety-note" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">补充说明</label>
              <textarea id="settings-behavior-safety-note" class="mt-3 w-full min-h-[120px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：涉及公开表达、花钱、身体判断和系统自我升级时，宁可慢一点，也不要替我越权。">${api.escapeHTML(customNote)}</textarea>
            </div>
        `,
        `
          <div id="settings-behavior-safety-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">${api.escapeHTML(statusText)}</div>
          <button type="button" onclick="saveBehaviorSafetyPreferencesFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存安全边界</button>
        `
      );
    }

    /**
     * @param {string} title
     * @param {string} subtitle
     * @param {string[]} points
     */
    function buildRelationshipModeDetailMarkup(title, subtitle, points) {
      const listMarkup = (Array.isArray(points) ? points : []).map((item) => `
        <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
          <div class="text-[11px] leading-5 text-gray-700 dark:text-white/80">${api.escapeHTML(item)}</div>
        </div>
      `).join('');
      return buildNestedSettingsDetailPage(
        'relationship-hub',
        title,
        subtitle,
        `
          <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
            <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">整理阶段</div>
            <div class="mt-2 text-[11px] leading-5 text-gray-700 dark:text-white/80">
              这一页先作为记忆的独立入口壳，后续会逐步补上真正可编辑的配置和更细的关系设定。
            </div>
          </div>
          <div class="space-y-2">
            ${listMarkup}
          </div>
        `
      );
    }

    function buildStableMemoryConflictKey(entry = null) {
      const safeEntry = entry && typeof entry === 'object' ? entry : {};
      const stableKey = String(safeEntry.stableKey || '').trim();
      if (stableKey) return stableKey;
      const sectionTitle = String(safeEntry.sectionTitle || safeEntry.title || '').trim();
      const content = String(safeEntry.content || safeEntry.summary || '').trim();
      if (/名字|称呼|name/i.test(sectionTitle) || /(?:用户名字|默认称呼|名字|称呼)[:：]/u.test(content)) return 'user:name-and-address';
      if (!sectionTitle) return '';
      const normalizedSection = sectionTitle
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
      return normalizedSection ? `user:${normalizedSection}` : '';
    }

    function buildStableMemoryConflictSnapshot(explicitMemoryLog = []) {
      const grouped = new Map();
      (Array.isArray(explicitMemoryLog) ? explicitMemoryLog : []).forEach((entry, index) => {
        const safeEntry = entry && typeof entry === 'object' ? entry : {};
        const content = String(safeEntry.content || safeEntry.summary || '').trim();
        if (!content) return;
        const key = buildStableMemoryConflictKey(safeEntry);
        if (!key) return;
        const bucket = grouped.get(key) || [];
        bucket.push({
          index,
          key,
          title: String(safeEntry.sectionTitle || safeEntry.title || key).trim() || key,
          content,
          source: String(safeEntry.source || '').trim(),
          at: String(safeEntry.at || safeEntry.updatedAt || safeEntry.createdAt || '').trim(),
        });
        grouped.set(key, bucket);
      });
      return Array.from(grouped.values())
        .filter((entries) => {
          const uniqueValues = new Set(entries.map((entry) => entry.content));
          return entries.length > 1 && uniqueValues.size > 1;
        })
        .map((entries) => ({
          key: entries[0].key,
          title: entries[0].title,
          entries,
        }))
        .slice(0, 6);
    }

    function isStableMemoryCanonicalIdentityFact(fact = null) {
      const key = String(fact?.key || '').trim();
      return key === 'user.preferred_name' || key === 'user.address_preference';
    }

    function isStableMemoryIdentityNoiseFact(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : {};
      if (!safeFact || isStableMemoryCanonicalIdentityFact(safeFact)) return false;
      const text = String(safeFact.fact || '').replace(/\s+/g, ' ').trim();
      if (!text) return false;
      if (/^(?:用户名字|默认称呼用户为)[:：]/u.test(text)) return false;
      const key = String(safeFact.key || '').trim();
      const label = String(safeFact.label || '').trim();
      const scope = String(safeFact.scope || '').trim();
      const inUserMemoryBucket = scope === 'user'
        || scope === 'preference'
        || /^user[:.-]/i.test(key)
        || /(?:长期偏好|general|preference|名字|称呼|name)/i.test(label);
      return inUserMemoryBucket && /(?:我叫什么|我的名字是[？?]?|还记得我是谁|关于我你知道些什么|什么名字|没名字|我是谁吗)/u.test(text);
    }

    function buildStableMemoryFactSnapshot() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : {};
      const longTermMemory = aiMemory?.longTermMemory && typeof aiMemory.longTermMemory === 'object' ? aiMemory.longTermMemory : {};
      const facts = Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [];
      const normalized = facts
        .filter((fact) => fact && typeof fact === 'object')
        .map((fact, index) => ({
          id: String(fact.id || `stable-fact-${index}`).trim() || `stable-fact-${index}`,
          key: String(fact.key || '').trim(),
          label: String(fact.label || fact.key || '未命名稳定记忆').trim(),
          fact: String(fact.fact || '').trim(),
          source: String(fact.source || '').trim(),
          scope: String(fact.scope || '').trim(),
          writeMode: String(fact.writeMode || '').trim(),
          stability: String(fact.stability || '').trim(),
          confidence: String(fact.confidence || '').trim(),
          lastConfirmedAt: String(fact.lastConfirmedAt || '').trim(),
          updatedAt: String(fact.updatedAt || '').trim(),
          alwaysInject: fact.alwaysInject === true,
          editable: fact.editable !== false,
          status: String(fact.status || 'active').trim() || 'active',
        }))
        .filter((fact) => {
          if (!fact.fact) return false;
          if (fact.status && !['active', 'confirmed', ''].includes(fact.status)) return false;
          return fact.alwaysInject
            || ['locked', 'stable'].includes(fact.stability)
            || ['identity', 'address', 'communication', 'boundary', 'relationship', 'workflow', 'persona-surface'].includes(fact.scope)
            || fact.writeMode === 'settings';
        });
      const preferredNameFact = normalized.find((fact) => fact.key === 'user.preferred_name') || null;
      const addressFact = normalized.find((fact) => fact.key === 'user.address_preference') || null;
      const communicationFact = normalized.find((fact) => fact.key === 'user.communication.style') || null;
      const personaFact = normalized.find((fact) => fact.key === 'morpheus.persona.surface') || null;
      const boundaryFacts = normalized.filter((fact) => fact.scope === 'boundary').slice(0, 3);
      const settingsFacts = normalized.filter((fact) => fact.writeMode === 'settings');
      const hasCanonicalIdentity = Boolean(preferredNameFact || addressFact);
      const directFacts = normalized.filter((fact) => {
        if (fact.writeMode === 'settings' || !fact.editable) return false;
        if (isStableMemoryCanonicalIdentityFact(fact)) return false;
        if (hasCanonicalIdentity && isStableMemoryIdentityNoiseFact(fact)) return false;
        return true;
      });
      return {
        preferredNameFact,
        addressFact,
        communicationFact,
        personaFact,
        boundaryFacts,
        settingsFacts,
        directFacts,
      };
    }

    function formatStableMemoryTime(value = '') {
      const raw = String(value || '').trim();
      if (!raw) return '未确认';
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (!match) return raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
      return `${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
    }

    function resolveStableMemorySourceRoute(fact = null) {
      const key = String(fact?.key || '').trim();
      const scope = String(fact?.scope || '').trim();
      if (key.startsWith('user.communication.') || scope === 'communication') return 'habit-expression';
      if (key.startsWith('morpheus.persona.') || scope === 'persona-surface') return 'relationship-long-term-focus';
      if (key.includes('.boundary.') || scope === 'boundary') return 'relationship-boundaries';
      if (key.includes('.proactivity.')) return 'relationship-proactivity';
      if (key.includes('.reminder.')) return 'relationship-reminders';
      if (key.includes('.planning.')) return 'habit-planning';
      if (key.includes('.focus.')) return 'habit-focus';
      if (key.includes('.safety.')) return 'habit-safety';
      if (key.includes('.memory.')) return 'habit-memory';
      return 'relationship-hub';
    }

    function buildStableMemorySettingsMarkup() {
      const settingsState = api.getSettingsState();
      const snapshot = buildStableMemoryFactSnapshot();
      const preferredNameValue = String(snapshot.preferredNameFact?.fact || '').replace(/^用户名字[:：]\s*/u, '').trim();
      const addressValue = String(snapshot.addressFact?.fact || '').replace(/^默认称呼用户为[:：]\s*/u, '').trim() || preferredNameValue;
      const statusText = settingsState.relationshipModeStatusMessage || '还没有改动';

      const sourceManagedMarkup = snapshot.settingsFacts.length
        ? snapshot.settingsFacts.map((fact) => `
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm text-black dark:text-white/90">${api.escapeHTML(fact.label)}</div>
                  <div class="mt-1 text-[11px] leading-5 text-gray-600 dark:text-white/70">${api.escapeHTML(fact.fact)}</div>
                </div>
                <button type="button" onclick="openSettingsDetail('${api.escapeHTML(resolveStableMemorySourceRoute(fact))}')" class="shrink-0 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[10px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">去原始设置</button>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-500 dark:text-white/45">
                <span>来源：${api.escapeHTML(fact.source || 'settings')}</span>
                <span>最近确认：${api.escapeHTML(formatStableMemoryTime(fact.lastConfirmedAt || fact.updatedAt))}</span>
                <span>${api.escapeHTML(fact.stability || 'stable')}</span>
              </div>
            </div>
          `).join('')
        : `
            <div class="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-4 text-[11px] leading-5 text-gray-500 dark:text-white/55">
              还没有从提醒方式、表达风格、边界或人格外显编译出的稳定记忆。
            </div>
          `;

      const directFactMarkup = snapshot.directFacts.length
        ? snapshot.directFacts.map((fact, index) => {
            const inputId = `settings-stable-memory-fact-input-${index}`;
            const toggleLabel = fact.stability === 'locked' ? '解锁' : '锁定';
            return `
              <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm text-black dark:text-white/90">${api.escapeHTML(fact.label)}</div>
                    <div class="mt-1 text-[10px] font-mono text-gray-500 dark:text-white/45">${api.escapeHTML(fact.key || fact.id)}</div>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] font-mono text-gray-500 dark:text-white/45">
                    <span>${api.escapeHTML(fact.writeMode || 'manual')}</span>
                    <span>${api.escapeHTML(fact.stability || 'normal')}</span>
                  </div>
                </div>
                <textarea id="${inputId}" class="mt-3 w-full min-h-[92px] resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="直接修改这条稳定记忆的最终文本。">${api.escapeHTML(fact.fact)}</textarea>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">
                    来源：${api.escapeHTML(fact.source || 'manual')} ｜ 最近确认：${api.escapeHTML(formatStableMemoryTime(fact.lastConfirmedAt || fact.updatedAt))}
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="toggleStableMemoryFactLockFromSettings('${api.escapeHTML(fact.id)}')" class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[10px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">${toggleLabel}</button>
                    <button type="button" onclick="deleteStableMemoryFactFromSettings('${api.escapeHTML(fact.id)}')" class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[10px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">删除</button>
                    <button type="button" onclick="saveStableMemoryFactFromSettings('${api.escapeHTML(fact.id)}','${inputId}')" class="px-3 py-1.5 rounded-full bg-black dark:bg-white text-[10px] font-medium text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')
        : `
            <div class="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-4 text-[11px] leading-5 text-gray-500 dark:text-white/55">
              目前没有可直接在这里编辑的稳定条目。名字、称呼和用户明确写下来的长期偏好，会优先出现在这里。
            </div>
          `;

      const boundarySummary = snapshot.boundaryFacts.length
        ? snapshot.boundaryFacts.map((fact) => api.escapeHTML(fact.fact)).join('；')
        : '还没有明确边界，建议去“哪些事不要替我决定”里补上。';

      return buildNestedSettingsDetailPage(
        'relationship-hub',
        '稳定记忆（Stable Memory）',
        '这里是稳定记忆的总入口：名字与称呼可直接改，表达风格、人格外显和边界从原始设置页进入。',
        `
          <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
            <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">说明</div>
            <div class="mt-2 text-[11px] leading-5 text-gray-700 dark:text-white/80">
              这一页只管理长期稳定保留的记忆。它不会改写 Morpheus 的产品定位、执行边界和确认/撤销合同。
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">名字与称呼</div>
              <div class="mt-3 space-y-3">
                <div>
                  <label for="settings-stable-memory-preferred-name" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">用户名字</label>
                  <input id="settings-stable-memory-preferred-name" type="text" value="${api.escapeHTML(preferredNameValue)}" class="mt-2 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：少城" />
                </div>
                <div>
                  <label for="settings-stable-memory-address-preference" class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">默认称呼</label>
                  <input id="settings-stable-memory-address-preference" type="text" value="${api.escapeHTML(addressValue)}" class="mt-2 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40" placeholder="比如：少城" />
                </div>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">会写回 identity stable facts</div>
                <button type="button" onclick="saveStableMemoryIdentityFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存名字与称呼</button>
              </div>
            </div>
            <div class="space-y-3">
              <button type="button" onclick="openSettingsDetail('habit-expression')" class="w-full text-left">${buildSettingsDirectoryCard({ title: '说话方式', summary: snapshot.communicationFact?.fact || '去调整回复长度、结构和语气温度。' })}</button>
              <button type="button" onclick="openSettingsDetail('relationship-long-term-focus')" class="w-full text-left">${buildSettingsDirectoryCard({ title: '人格外显', summary: snapshot.personaFact?.fact || '去调整 Morpheus 更像澄清者、推进器、边界守护者还是稳定陪跑者。' })}</button>
              <button type="button" onclick="openSettingsDetail('relationship-boundaries')" class="w-full text-left">${buildSettingsDirectoryCard({ title: '边界与禁区', summary: boundarySummary })}</button>
            </div>
          </div>
          <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
            <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45">状态</div>
            <div id="settings-stable-memory-status" class="mt-2 text-[11px] leading-5 text-gray-700 dark:text-white/80">${api.escapeHTML(statusText)}</div>
          </div>
          <div class="space-y-3">
            <div class="text-[11px] font-medium text-gray-800 dark:text-white/85">源设置生成的稳定记忆</div>
            ${sourceManagedMarkup}
          </div>
          <div class="space-y-3">
            <div class="text-[11px] font-medium text-gray-800 dark:text-white/85">可直接管理的稳定条目</div>
            ${directFactMarkup}
          </div>
        `
      );
    }

    function buildRelationshipHubMarkup() {
      return buildRelationshipMemoryOverviewMarkup({ topLevel: true });
    }

    function buildSystemPluginsMarkup() {
      return `
        <div class="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden">
          <div class="flex items-start justify-between gap-3 mb-5 shrink-0">
            <div>
              <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors mb-3">
                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
              </button>
              <h1 class="text-lg sm:text-2xl text-black dark:text-white/90 tracking-wide font-tech">系统插件 <span class="text-gray-400 dark:text-white/30 text-sm sm:text-lg ml-2">(System Plugins)</span></h1>
              <p class="text-gray-500 font-mono text-[9px] mt-1 tracking-widest uppercase">主系统默认自带的插件能力，保持和插件页一致的卡片样式与入口逻辑</p>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar grid gap-3 pt-0 pb-6 pr-0 justify-items-stretch content-start" style="grid-template-columns: repeat(1, minmax(0, 1fr)); justify-content:stretch;">
            <section class="glass-card rounded-[1.2rem] p-5 flex flex-col gap-3 w-full transition-all" style="height:178px;max-height:178px;min-height:178px;">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h2 class="text-sm font-medium text-black dark:text-white/90">闪念中转站</h2>
                    <span class="px-2 py-1 rounded-full text-[10px] font-mono bg-black text-white dark:bg-white dark:text-black">系统内置</span>
                  </div>
                  <p class="mt-2 text-[11px] leading-5 text-gray-600 dark:text-white/70 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">放在对话这条线上的系统插件，适合随手收住、整理和转运当下的念头。</p>
                </div>
                <i data-lucide="share-2" class="w-4 h-4 text-gray-400 dark:text-white/35 shrink-0"></i>
              </div>
              <div class="mt-auto flex items-center gap-2">
                <button type="button" onclick="closeSettingsDetail(); setAIChatDrawerOpen(true);" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  打开
                </button>
                <button type="button" onclick="closeSettingsDetail(); setAIChatDrawerOpen(true);" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  查看
                </button>
                <span class="ml-auto inline-flex items-center gap-2 text-[11px] font-medium text-gray-600 dark:text-white/70">
                  <span>已启用</span>
                  <span class="relative inline-flex h-6 w-11 items-center rounded-full bg-black dark:bg-white">
                    <span class="inline-block h-4 w-4 rounded-full bg-white dark:bg-[#232020] translate-x-6"></span>
                  </span>
                </span>
              </div>
            </section>
            <section class="glass-card rounded-[1.2rem] p-5 flex flex-col gap-3 w-full transition-all" style="height:178px;max-height:178px;min-height:178px;">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h2 class="text-sm font-medium text-black dark:text-white/90">健康状态</h2>
                    <span class="px-2 py-1 rounded-full text-[10px] font-mono bg-black text-white dark:bg-white dark:text-black">系统内置</span>
                  </div>
                  <p class="mt-2 text-[11px] leading-5 text-gray-600 dark:text-white/70 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">并入健康页的系统插件，和日常身体状态、血糖同步、健康上下文一起工作。</p>
                </div>
                <i data-lucide="heart-pulse" class="w-4 h-4 text-gray-400 dark:text-white/35 shrink-0"></i>
              </div>
              <div class="mt-auto flex items-center gap-2">
                <button type="button" onclick="closeSettingsDetail(); switchTab('health');" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  打开
                </button>
                <button type="button" onclick="closeSettingsDetail(); switchTab('health');" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  查看
                </button>
                <span class="ml-auto inline-flex items-center gap-2 text-[11px] font-medium text-gray-600 dark:text-white/70">
                  <span>已启用</span>
                  <span class="relative inline-flex h-6 w-11 items-center rounded-full bg-black dark:bg-white">
                    <span class="inline-block h-4 w-4 rounded-full bg-white dark:bg-[#232020] translate-x-6"></span>
                  </span>
                </span>
              </div>
            </section>
          </div>
        </div>
      `;
    }

    function buildPluginUploadMarkup() {
      return `
        <div class="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden">
          <div class="flex items-start justify-between gap-3 mb-5 shrink-0">
            <div>
              <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors mb-3">
                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
              </button>
              <h1 class="text-lg sm:text-2xl text-black dark:text-white/90 tracking-wide font-tech">上传插件 <span class="text-gray-400 dark:text-white/30 text-sm sm:text-lg ml-2">(Upload Plugin)</span></h1>
              <p class="text-gray-500 font-mono text-[9px] mt-1 tracking-widest uppercase">先保持和插件页一致的卡片形式，上传与安装流程后续继续往这里接</p>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar grid gap-3 pt-0 pb-6 pr-0 justify-items-stretch content-start" style="grid-template-columns: repeat(1, minmax(0, 1fr)); justify-content:stretch;">
            <section class="glass-card rounded-[1.2rem] p-5 flex flex-col gap-3 w-full transition-all" style="height:178px;max-height:178px;min-height:178px;">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h2 class="text-sm font-medium text-black dark:text-white/90">本地插件入口</h2>
                    <span class="px-2 py-1 rounded-full text-[10px] font-mono bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/55">筹备中</span>
                  </div>
                  <p class="mt-2 text-[11px] leading-5 text-gray-600 dark:text-white/70 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">现在先通过插件页统一管理本地和集成插件。等上传流程补齐后，这里会直接成为你自己接入插件的位置。</p>
                </div>
                <i data-lucide="upload" class="w-4 h-4 text-gray-400 dark:text-white/35 shrink-0"></i>
              </div>
              <div class="mt-auto flex items-center gap-2">
                <button type="button" onclick="closeSettingsDetail(); openExtensionsHome();" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  去插件页
                </button>
                <button type="button" onclick="closeSettingsDetail(); openExtensionsHome();" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  查看
                </button>
                <span class="ml-auto inline-flex items-center gap-2 text-[11px] font-medium text-gray-600 dark:text-white/70">
                  <span>未启用</span>
                  <span class="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-white/15">
                    <span class="inline-block h-4 w-4 rounded-full bg-white dark:bg-[#232020] translate-x-1"></span>
                  </span>
                </span>
              </div>
            </section>
          </div>
        </div>
      `;
    }

    function buildModelSettingsMarkup() {
      /**
       * @param {{
       *   id: string,
       *   title: string,
       *   summaryId: string,
       *   defaultModel: string,
       *   recommendedScenario: string,
       *   suitableFor: string,
       *   firstRunHint: string,
       *   nextStep: string,
       *   provider: string,
       * }} provider
       */
      function buildProviderCardMarkup(provider) {
        return `
                <div id="${api.escapeHTML(provider.id)}" role="radio" tabindex="0" aria-pressed="false" aria-checked="false" class="glass-card rounded-[1.2rem] border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-4 self-start cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <div class="flex items-start justify-between gap-4 w-full">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <div class="text-sm font-medium text-black dark:text-white/90">${api.escapeHTML(provider.title)}</div>
                        <span id="${api.escapeHTML(provider.id)}-active-badge" class="hidden inline-flex items-center rounded-full border border-emerald-300 dark:border-emerald-400/50 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-200">当前使用</span>
                      </div>
                      <div id="${api.escapeHTML(provider.summaryId)}" class="mt-1 text-[10px] text-gray-500 dark:text-gray-400 truncate">未配置</div>
                      <div class="mt-2 space-y-1 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                        <div class="truncate"><span class="font-medium">推荐场景：</span>${api.escapeHTML(provider.recommendedScenario)}</div>
                        <div class="truncate"><span class="font-medium">适合谁：</span>${api.escapeHTML(provider.suitableFor)}</div>
                        <div class="truncate"><span class="font-medium">首次上手：</span>${api.escapeHTML(provider.firstRunHint)}</div>
                        <div class="truncate"><span class="font-medium">报错后：</span>${api.escapeHTML(provider.nextStep)}</div>
                      </div>
                      <div class="mt-2 text-[10px] text-gray-500 dark:text-gray-400">默认模型：${api.escapeHTML(provider.defaultModel)}</div>
                    </div>
                    <button id="${api.escapeHTML(provider.id)}-open" type="button" aria-label="${api.escapeHTML(`配置 ${provider.title}`)}" onclick="event.stopPropagation(); openAIKeySettingsModal('${api.escapeHTML(provider.provider)}')" class="inline-flex items-center justify-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-black dark:hover:text-white transition-colors shrink-0 self-center">配置</button>
                  </div>
                </div>
        `;
      }

      const providerCards = [
        {
          id: 'settings-ai-key-menu-gemini',
          provider: 'gemini',
          title: 'Gemini 密钥',
          summaryId: 'settings-ai-key-menu-gemini-summary',
          defaultModel: 'gemini-2.5-flash',
          recommendedScenario: '日常问答、写作和默认入口',
          suitableFor: '想先稳稳开箱的默认用户',
          firstRunHint: '没有偏好时先从 Gemini 开始',
          nextStep: '先补 key，再点配置确认',
        },
        {
          id: 'settings-ai-key-menu-openrouter',
          provider: 'openrouter',
          title: 'OpenRouter 密钥',
          summaryId: 'settings-ai-key-menu-openrouter-summary',
          defaultModel: 'openrouter/auto',
          recommendedScenario: '一处接多家模型、经常切换供应商',
          suitableFor: '想保留选择空间的重度用户',
          firstRunHint: '想保留切换空间时先选它',
          nextStep: '先查 base URL，再点配置保存',
        },
        {
          id: 'settings-ai-key-menu-glm',
          provider: 'glm',
          title: 'GLM-4.7-Flash',
          summaryId: 'settings-ai-key-menu-glm-summary',
          defaultModel: 'glm-4.7-flash',
          recommendedScenario: '中文任务、快速响应和性价比优先',
          suitableFor: '想要稳定中文体验的人',
          firstRunHint: '偏中文输出和响应速度时优先看它',
          nextStep: '先核对 GLM key，再点配置保存',
        },
        {
          id: 'settings-ai-key-menu-doubao',
          provider: 'doubao',
          title: 'Doubao-1.5-pro-256k',
          summaryId: 'settings-ai-key-menu-doubao-summary',
          defaultModel: 'doubao-1-5-pro-256k-250115',
          recommendedScenario: '长上下文、批量整理和长材料处理',
          suitableFor: '经常喂长文或大批量内容的人',
          firstRunHint: '需要超长材料时再优先考虑它',
          nextStep: '先确认接口权限，再点配置保存',
        },
        {
          id: 'settings-ai-key-menu-qwen',
          provider: 'qwen',
          title: 'Qwen-Plus',
          summaryId: 'settings-ai-key-menu-qwen-summary',
          defaultModel: 'qwen-plus',
          recommendedScenario: '中文内容、插件兼容和日常协作',
          suitableFor: '偏阿里系生态或中文输出的人',
          firstRunHint: '中文协作场景里可以先试它',
          nextStep: '先看 key，再点配置保存',
        },
        {
          id: 'settings-ai-key-menu-kimi',
          provider: 'kimi',
          title: 'Kimi',
          summaryId: 'settings-ai-key-menu-kimi-summary',
          defaultModel: 'Auto（8k / 32k / 128k）',
          recommendedScenario: '长文阅读、摘要和资料吸收',
          suitableFor: '经常处理文章、笔记和长材料的人',
          firstRunHint: '大量阅读和摘要时很适合先试',
          nextStep: '先确认 key，再点配置保存',
        },
        {
          id: 'settings-ai-key-menu-codex',
          provider: 'codex',
          title: 'Codex（OpenAI 兼容）',
          summaryId: 'settings-ai-key-menu-codex-summary',
          defaultModel: 'gpt-5',
          recommendedScenario: '已有 OpenAI 兼容网关或私有代理',
          suitableFor: '要接自建中转、局域网或兼容服务的人',
          firstRunHint: '已有兼容网关时再优先选它',
          nextStep: '先查 base URL，再点配置保存',
        },
      ];
      return buildTopLevelSettingsDetailPage(
        '模型（Model）',
        '在这里切换 AI Provider、配置 API 密钥，并管理云端加密保险箱。',
        `
            <section class="glass-card rounded-[1.2rem] p-5">
              <div class="text-[11px] text-gray-600 dark:text-white/70 mb-3">AI Provider 与凭据</div>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mb-3">点击卡片切换当前使用的 Provider；仅点击“配置”会打开 API 填写窗口。</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3" role="radiogroup" aria-label="AI Provider 选择">
                ${providerCards.map((provider) => buildProviderCardMarkup(provider)).join('')}
              </div>
              <div id="settings-api-key-status" class="mt-3 text-[10px] font-mono text-gray-500 dark:text-gray-400"></div>
            </section>
            <section class="glass-card rounded-[1.2rem] p-5">
              <div class="text-[11px] text-gray-600 dark:text-white/70 mb-3">跨设备加密保险箱（AI 密钥 + 血糖账号/密码）</div>
              <button id="settings-secure-vault-open-menu" type="button" class="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-xs font-medium text-gray-800 dark:text-white/90">云端加密保险箱</div>
                    <div id="settings-secure-vault-menu-summary" class="mt-1 text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">云端未备份</div>
                  </div>
                  <span class="text-[11px] text-gray-500 dark:text-gray-400">打开</span>
                </div>
              </button>
              <div id="settings-secure-vault-status" class="mt-3 text-[10px] font-mono text-gray-500 dark:text-gray-400"></div>
            </section>
        `
      );
    }

    function buildDataSettingsMarkup() {
      const settingsState = api.getSettingsState();
      const settingsSyncSummary = api.getSettingsSyncSummary && typeof api.getSettingsSyncSummary === 'function'
        ? api.getSettingsSyncSummary()
        : null;
      const isFileProtocol = typeof window !== 'undefined'
        && window.location
        && window.location.protocol === 'file:';
      const nativePlatform = String(settingsState.nativePlatform || '').toLowerCase();
      const hasSyncRootPath = String(settingsState.syncRootPath || '').trim().length > 0;
      const isDesktopContext = settingsState.nativeBridge || nativePlatform === 'macos' || nativePlatform === 'ios' || isFileProtocol || hasSyncRootPath;
      const bridgeBadgeLabel = String(settingsSyncSummary?.bridgeBadgeLabel || '').trim() || (settingsState.nativeBridge
        ? `已连接（${nativePlatform === 'ios' ? 'iOS App' : 'mac 桌面版'}）`
        : (hasSyncRootPath ? '本地目录已选中（待桥接）' : (isDesktopContext ? '桌面版（桥接检测中）' : '未连接（web 浏览器）')));
      const syncRootText = String(settingsSyncSummary?.syncRootText || '').trim() || (settingsState.nativeBridge
        ? (settingsState.syncRootPath || '正在读取...')
        : (hasSyncRootPath ? settingsState.syncRootPath : (isDesktopContext ? '正在读取桌面数据目录' : '未检测到（web 模式）')));
      const syncModeText = String(settingsSyncSummary?.syncModeText || '').trim() || '-';
      const syncRouteText = String(settingsSyncSummary?.syncRouteText || '').trim() || '-';
      const bridgeBadgeConnected = typeof settingsSyncSummary?.bridgeBadgeConnected === 'boolean'
        ? settingsSyncSummary.bridgeBadgeConnected
        : (settingsState.nativeBridge || isDesktopContext);
      return buildTopLevelSettingsDetailPage(
        '数据（Data）',
        '在这里查看数据目录、同步状态和从用户数据重新载入。',
        `
            <section class="glass-card rounded-[1.2rem] p-5">
              <div class="mb-4">
                <h2 class="text-sm font-medium text-black dark:text-white/90">同步状态</h2>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">显示当前同步状态与桌面端双向同步能力。</p>
                <p id="settings-multi-device-edit-notes" class="hidden text-[10px] text-gray-600 dark:text-gray-400 mt-3 leading-relaxed" aria-hidden="true">多端协作以 <span class="font-mono text-gray-500 dark:text-white/50">live-data.json</span> 为权威；冲突时按 <span class="font-mono text-gray-500 dark:text-white/50">syncMeta.revision</span> 与 <span class="font-mono text-gray-500 dark:text-white/50">lastClientWriteAt</span> 仲裁（末写常见赢）。请尽量避免两台设备<strong class="font-medium text-gray-800 dark:text-white/80">同时编辑同一文档的同一段</strong>，以降低覆盖感知；详情见仓库内 <span class="font-mono text-gray-500 dark:text-white/50">docs/morph-editor-experience-checklist.md</span>。</p>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-xs">
                <div class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10">
                  <span id="settings-sync-dot" class="w-2 h-2 rounded-full bg-gray-300"></span>
                  <span id="settings-sync-text" class="text-gray-700 dark:text-white/80">等待同步</span>
                </div>
                <div class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10">
                  <span class="text-gray-500 dark:text-white/50">桌面桥接</span>
                  <span id="settings-native-bridge-badge" class="${bridgeBadgeConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-white/80'}">${api.escapeHTML(bridgeBadgeLabel)}</span>
                </div>
              </div>
              <p id="settings-sync-summary" class="text-[10px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">应用打开后会尽快读取这台设备上已经同步到位的最新 live-data。</p>
              <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                  <div class="text-gray-500 dark:text-white/40 mb-1">当前同步模式</div>
                  <div id="settings-sync-mode" class="text-gray-800 dark:text-white/85 break-all">${api.escapeHTML(syncModeText)}</div>
                </div>
                <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                  <div class="text-gray-500 dark:text-white/40 mb-1">当前主链说明</div>
                  <div id="settings-sync-route" class="text-gray-800 dark:text-white/85 break-all">${api.escapeHTML(syncRouteText)}</div>
                </div>
                <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                  <div class="text-gray-500 dark:text-white/40 mb-1">最后同步时间</div>
                  <div id="settings-last-sync-at" class="text-gray-800 dark:text-white/85 break-all">-</div>
                </div>
                <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                  <div class="text-gray-500 dark:text-white/40 mb-1">最后回灌时间</div>
                  <div id="settings-last-restore-at" class="text-gray-800 dark:text-white/85 break-all">-</div>
                </div>
              </div>
            </section>

            <section class="glass-card rounded-[1.2rem] p-5">
              <div class="mb-4">
                <h2 class="text-sm font-medium text-black dark:text-white/90">数据目录</h2>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">桌面版可直接桥接本地目录；web 版可在支持的浏览器里选择本地文件夹并读取其中的 data/live-data.json。</p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-4 py-3 mb-3">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/40 mb-1">当前数据目录</div>
                <div id="settings-sync-root-path" class="text-xs break-all text-gray-800 dark:text-white/85">${api.escapeHTML(syncRootText)}</div>
              </div>
              <div class="hidden rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.015] px-4 py-3 mb-3" aria-hidden="true" data-dev-diagnostics="build-fingerprint">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/40 mb-2">当前资源版本</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                  <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                    <div class="text-gray-500 dark:text-white/40 mb-1">设备壳 / 运行容器</div>
                    <div id="settings-build-platform-shell" class="text-gray-800 dark:text-white/85 break-all">等待诊断...</div>
                  </div>
                  <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                    <div class="text-gray-500 dark:text-white/40 mb-1">原生 App 版本</div>
                    <div id="settings-native-app-version" class="text-gray-800 dark:text-white/85 break-all">等待诊断...</div>
                  </div>
                  <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                    <div class="text-gray-500 dark:text-white/40 mb-1">原生构建时间</div>
                    <div id="settings-native-build-time" class="text-gray-800 dark:text-white/85 break-all">等待诊断...</div>
                  </div>
                  <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                    <div class="text-gray-500 dark:text-white/40 mb-1">Web 资源版本</div>
                    <div id="settings-web-build-stamp" class="text-gray-800 dark:text-white/85 break-all">等待诊断...</div>
                  </div>
                </div>
                <div id="settings-build-warning" class="mt-2 text-[10px] font-mono text-gray-500 dark:text-gray-400 break-all">等待诊断...</div>
              </div>
              <div class="hidden rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.015] px-4 py-3 mb-3" aria-hidden="true" data-dev-diagnostics="runtime-memory">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/40 mb-2">运行内存速览</div>
                <div class="grid grid-cols-1 gap-2 text-[10px] font-mono">
                  <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                    <div class="text-gray-500 dark:text-white/40 mb-1">Surface 占用</div>
                    <div id="settings-runtime-surface-summary" class="text-gray-800 dark:text-white/85 break-all">等待诊断...</div>
                  </div>
                  <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
                    <div class="text-gray-500 dark:text-white/40 mb-1">页面内存</div>
                    <div id="settings-runtime-memory-summary" class="text-gray-800 dark:text-white/85 break-all">等待诊断...</div>
                  </div>
                </div>
              </div>
              <div class="hidden rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.015] px-4 py-3 mb-3" aria-hidden="true" data-dev-diagnostics="sync-debug">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/40 mb-1">当前运行数据诊断</div>
                <div id="settings-sync-debug" class="text-[10px] font-mono leading-5 text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all">等待诊断...</div>
              </div>
              <div class="hidden rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.015] px-4 py-3 mb-3" aria-hidden="true" data-dev-diagnostics="ai-request-debug">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/40 mb-1">AI 请求统计面板</div>
                <div id="settings-ai-request-debug" class="text-[10px] font-mono leading-5 text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all">等待统计...</div>
              </div>
              <div class="hidden rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.015] px-4 py-3 mb-3" aria-hidden="true" data-dev-diagnostics="sync-receipt">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/40 mb-1">最近一次同步回执</div>
                <div id="settings-sync-receipt" class="text-[10px] font-mono leading-5 text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all">等待回执...</div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button id="settings-choose-sync-root-btn" type="button" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">选择存储位置</button>
                <button id="settings-open-sync-root-btn" type="button" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">打开文件夹</button>
                <button id="settings-reload-from-user-data-btn" type="button" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">从用户数据重新载入</button>
              </div>
              <div id="settings-sync-root-status" class="mt-3 text-[10px] font-mono text-gray-500 dark:text-gray-400"></div>
            </section>
        `
      );
    }

    /**
     * @param {string} mode
     */
    function buildSettingsDetailMarkup(mode) {
      if (mode === 'writing-studio') {
        const runtime = api.getLegacyWritingRuntimeModules();
        if (runtime?.buildSettingsDetailMarkup) return runtime.buildSettingsDetailMarkup();
        return '';
      }
      if (mode === 'ai-skills') {
        const settingsState = api.getSettingsState();
        if (!settingsState.agentStatusLoaded) void api.loadAgentStatusFromServer({ silent: true });
        return buildAISkillsDetailMarkup();
      }
      if (mode === 'ai-memory') {
        return `
          <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
            <div class="flex items-center justify-between gap-3 mb-4">
              <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
              </button>
              <div class="text-right">
                <h2 class="text-sm font-medium text-black dark:text-white/90">记忆方式</h2>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">完整查看和编辑长期用户画像与记忆内容。</p>
              </div>
            </div>
            <div class="flex-1 min-h-0 flex flex-col">
              <textarea id="settings-ai-user-md-input" class="flex-1 min-h-[50vh] resize-none bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-gray-400 dark:focus:border-white/40 font-mono"></textarea>
              <div class="mt-3 flex items-center justify-between gap-3">
                <div id="settings-ai-user-md-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">未保存</div>
                <button id="settings-ai-user-md-save" type="button" onclick="saveAIUserMemoryFromSettings()" class="px-4 py-2.5 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存 user.md</button>
              </div>
            </div>
          </div>
        `;
      }
      if (mode === 'runtime') {
        return `
          <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
            <div class="flex items-center justify-between gap-3 mb-4">
              <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
              </button>
              <div class="text-right">
                <h2 class="text-sm font-medium text-black dark:text-white/90">运行规则</h2>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">逐项进入查看和编辑技能、上下文和记忆读写规则。</p>
              </div>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3 pr-1 pb-2">
              <button type="button" onclick="openSettingsDetail('runtime-skills')" class="w-full glass-card rounded-[1rem] p-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="text-xs font-medium text-black dark:text-white/90">skills.json</div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">自升级能力、禁用动作与额外系统提示。</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 dark:text-white/40 shrink-0"></i>
                </div>
              </button>
              <button type="button" onclick="openSettingsDetail('runtime-context')" class="w-full glass-card rounded-[1rem] p-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="text-xs font-medium text-black dark:text-white/90">context-rules.json</div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">检索上限、加权参数与 token 同义词规则。</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 dark:text-white/40 shrink-0"></i>
                </div>
              </button>
              <button type="button" onclick="openSettingsDetail('runtime-memory')" class="w-full glass-card rounded-[1rem] p-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="text-xs font-medium text-black dark:text-white/90">memory-rules.md</div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">AI 读写记忆时遵循的说明和约束。</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 dark:text-white/40 shrink-0"></i>
                </div>
              </button>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3">
              <div id="settings-morph-runtime-status" class="text-[10px] font-mono text-gray-500 dark:text-gray-400">未保存</div>
              <div class="text-[10px] font-mono text-gray-500 dark:text-gray-400">逐项编辑</div>
            </div>
          </div>
        `;
      }
      if (mode === 'habit-memory') {
        return buildBehaviorMemoryEditorMarkup();
      }
      if (mode === 'habit-planning') {
        return buildBehaviorPlanningEditorMarkup();
      }
      if (mode === 'habit-expression') {
        return buildBehaviorExpressionEditorMarkup();
      }
      if (mode === 'habit-focus') {
        return buildBehaviorFocusEditorMarkup();
      }
      if (mode === 'habit-safety') {
        return buildBehaviorSafetyEditorMarkup();
      }
      if (mode === 'relationship-reminders') {
        return buildRelationshipReminderEditorMarkup();
      }
      if (mode === 'system-plugins') {
        return buildSystemPluginsMarkup();
      }
      if (mode === 'plugin-upload') {
        return buildPluginUploadMarkup();
      }
      if (mode === 'model-settings') {
        return buildModelSettingsMarkup();
      }
      if (mode === 'data-settings') {
        return buildDataSettingsMarkup();
      }
      if (mode === 'relationship-hub') {
        return buildRelationshipHubMarkup();
      }
      if (mode === 'stable-memory') {
        return buildStableMemorySettingsMarkup();
      }
      if (mode === 'relationship-proactivity') {
        return buildRelationshipProactivityEditorMarkup();
      }
      if (mode === 'relationship-boundaries') {
        return buildRelationshipBoundaryEditorMarkup();
      }
      if (mode === 'relationship-long-term-focus') {
        return buildRelationshipLongTermFocusEditorMarkup();
      }
      if (mode === 'relationship-memory-overview') {
        return buildRelationshipMemoryOverviewMarkup();
      }
      if (mode === 'runtime-skills') return buildRuntimeEditorCard('runtime', 'skills.json', '编辑运行时技能配置。', 'settings-morph-runtime-skills-input', '保存 skills', "saveMorphRuntimeSectionFromSettings('skills')");
      if (mode === 'runtime-context') return buildRuntimeEditorCard('runtime', 'context-rules.json', '编辑检索规则与权重。', 'settings-morph-runtime-context-input', '保存 contextRules', "saveMorphRuntimeSectionFromSettings('contextRules')");
      if (mode === 'runtime-memory') return buildRuntimeEditorCard('runtime', 'memory-rules.md', '编辑记忆读写规则。', 'settings-morph-runtime-memory-input', '保存 memoryRules', "saveMorphRuntimeSectionFromSettings('memoryRules')");
      return '';
    }

    function syncStableMemoryFacts(aiMemory = null) {
      if (typeof api.syncStructuredLongTermFacts === 'function' && aiMemory && typeof aiMemory === 'object') {
        api.syncStructuredLongTermFacts(aiMemory);
      }
    }

    function saveCanonicalStableMemoryData() {
      api.saveData({
        skipUndo: true,
        skipRender: true,
        domains: ['aiMemoryFull'],
        immediatePersist: true,
      });
    }

    function saveAIUserMemoryFromSettings(inputId = 'settings-ai-user-md-input') {
      /** @type {HTMLTextAreaElement | null} */
      const input = /** @type {HTMLTextAreaElement | null} */ (document.getElementById(String(inputId || 'settings-ai-user-md-input')));
      if (!input) return;
      const aiMemory = api.getAIMemory();
      const nextMarkdown = String(input.value || '').trim() || api.buildDefaultAIUserMarkdown();
      if (typeof api.replaceStableUserMemoryDocument === 'function') {
        const result = /** @type {Record<string, any> | null} */ (api.replaceStableUserMemoryDocument(nextMarkdown, aiMemory, { source: 'settings-user-md' }));
        if (result && typeof result === 'object' && result.blocked) {
          const settingsState = api.getSettingsState();
          settingsState.relationshipModeStatusMessage = '已拦截稳定记忆写入';
          settingsState.relationshipModeStatusError = true;
          api.renderSettingsView();
          return;
        }
      } else {
        aiMemory.user = nextMarkdown;
        syncStableMemoryFacts(aiMemory);
      }
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已保存 USER.md';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveAIMemoryIndexFromSettings() {
      /** @type {HTMLTextAreaElement | null} */
      const input = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-memory-index-md-input'));
      if (!input) return;
      const aiMemory = api.getAIMemory();
      const nextMarkdown = String(input.value || '').trim();
      aiMemory.memoryIndex = nextMarkdown;
      if (!aiMemory.longTermMemory || typeof aiMemory.longTermMemory !== 'object') aiMemory.longTermMemory = {};
      aiMemory.longTermMemory.memoryIndex = nextMarkdown;
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已保存 MEMORY.md';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function setStableMemoryStatus(message = '', isError = false) {
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = String(message || '').trim();
      settingsState.relationshipModeStatusError = !!isError;
    }

    function getStableMemoryFactCollection(aiMemory = null) {
      const target = aiMemory && typeof aiMemory === 'object' ? aiMemory : (api.getAIMemory ? api.getAIMemory() : null);
      if (!target || typeof target !== 'object') return [];
      if (!target.longTermMemory || typeof target.longTermMemory !== 'object') target.longTermMemory = {};
      if (!Array.isArray(target.longTermMemory.facts)) target.longTermMemory.facts = [];
      return target.longTermMemory.facts;
    }

    function findStableMemoryFact(aiMemory = null, factId = '') {
      const targetId = String(factId || '').trim();
      if (!targetId) return { aiMemory: null, fact: null, index: -1, facts: [] };
      const target = aiMemory && typeof aiMemory === 'object' ? aiMemory : (api.getAIMemory ? api.getAIMemory() : null);
      const facts = getStableMemoryFactCollection(target);
      const index = facts.findIndex((fact) => String(fact?.id || '').trim() === targetId);
      return {
        aiMemory: target,
        fact: index >= 0 ? facts[index] : null,
        index,
        facts,
      };
    }

    function persistStableMemoryMutation(aiMemory = null, message = '', isError = false) {
      if (typeof api.syncStructuredLongTermFacts === 'function' && aiMemory && typeof aiMemory === 'object') {
        api.syncStructuredLongTermFacts(aiMemory);
      }
      setStableMemoryStatus(message, isError);
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveStableMemoryIdentityFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLInputElement | null} */
      const preferredNameInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-stable-memory-preferred-name'));
      /** @type {HTMLInputElement | null} */
      const addressInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-stable-memory-address-preference'));
      if (!preferredNameInput || !addressInput) return;
      const preferredName = String(preferredNameInput.value || '').trim();
      const addressPreference = String(addressInput.value || '').trim() || preferredName;
      const facts = getStableMemoryFactCollection(aiMemory);
      const now = new Date().toISOString();
      const upsert = ({ key, label, factText, id }) => {
        const existingIndex = facts.findIndex((fact) => String(fact?.key || '').trim() === key);
        if (!factText) {
          if (existingIndex >= 0) facts.splice(existingIndex, 1);
          return;
        }
        const nextFact = existingIndex >= 0 && facts[existingIndex] && typeof facts[existingIndex] === 'object'
          ? facts[existingIndex]
          : {
              id,
              category: 'explicit',
              key,
              label,
              source: 'settings-stable-memory',
              confidence: 'confirmed',
              scope: 'identity',
              writeMode: 'explicit-user',
              stability: 'locked',
              alwaysInject: true,
              editable: true,
            };
        nextFact.id = String(nextFact.id || id).trim() || id;
        nextFact.key = key;
        nextFact.label = label;
        nextFact.fact = factText;
        nextFact.source = 'settings-stable-memory';
        nextFact.confidence = 'confirmed';
        nextFact.scope = 'identity';
        nextFact.writeMode = 'explicit-user';
        nextFact.stability = 'locked';
        nextFact.alwaysInject = true;
        nextFact.editable = true;
        nextFact.lastConfirmedAt = now;
        nextFact.updatedAt = now;
        if (existingIndex >= 0) facts[existingIndex] = nextFact;
        else facts.unshift(nextFact);
      };
      upsert({
        key: 'user.preferred_name',
        label: '名字与称呼',
        factText: preferredName ? `用户名字：${preferredName}` : '',
        id: 'stable:user-preferred-name',
      });
      upsert({
        key: 'user.address_preference',
        label: '默认称呼',
        factText: addressPreference ? `默认称呼用户为：${addressPreference}` : '',
        id: 'stable:user-address-preference',
      });
      persistStableMemoryMutation(aiMemory, '已保存名字与称呼', false);
    }

    function saveStableMemoryFactFromSettings(factId, inputId) {
      const targetId = String(factId || '').trim();
      const inputKey = String(inputId || '').trim();
      if (!targetId || !inputKey) return;
      const { aiMemory, fact } = findStableMemoryFact(null, targetId);
      if (!aiMemory || !fact) return;
      if (String(fact.writeMode || '').trim() === 'settings') {
        setStableMemoryStatus('这条稳定记忆由原始设置页生成，请去对应设置修改。', true);
        api.renderSettingsView();
        return;
      }
      /** @type {HTMLTextAreaElement | null} */
      const input = /** @type {HTMLTextAreaElement | null} */ (document.getElementById(inputKey));
      if (!input) return;
      const nextFactText = String(input.value || '').trim();
      if (!nextFactText) {
        setStableMemoryStatus('内容为空时请直接删除这条稳定记忆。', true);
        api.renderSettingsView();
        return;
      }
      fact.fact = nextFactText;
      fact.updatedAt = new Date().toISOString();
      fact.lastConfirmedAt = fact.updatedAt;
      fact.source = String(fact.source || 'settings-stable-memory').trim() || 'settings-stable-memory';
      persistStableMemoryMutation(aiMemory, '已保存稳定记忆', false);
    }

    function deleteStableMemoryFactFromSettings(factId) {
      const { aiMemory, fact, index, facts } = findStableMemoryFact(null, factId);
      if (!aiMemory || !fact || index < 0) return;
      if (String(fact.writeMode || '').trim() === 'settings') {
        setStableMemoryStatus('这条稳定记忆由原始设置页生成，请去对应设置修改。', true);
        api.renderSettingsView();
        return;
      }
      facts.splice(index, 1);
      persistStableMemoryMutation(aiMemory, '已删除稳定记忆', false);
    }

    function toggleStableMemoryFactLockFromSettings(factId) {
      const { aiMemory, fact } = findStableMemoryFact(null, factId);
      if (!aiMemory || !fact) return;
      if (String(fact.writeMode || '').trim() === 'settings') {
        setStableMemoryStatus('这条稳定记忆由原始设置页生成，请去对应设置修改。', true);
        api.renderSettingsView();
        return;
      }
      fact.stability = String(fact.stability || '').trim() === 'locked' ? 'stable' : 'locked';
      fact.alwaysInject = true;
      fact.updatedAt = new Date().toISOString();
      fact.lastConfirmedAt = fact.updatedAt;
      persistStableMemoryMutation(aiMemory, fact.stability === 'locked' ? '已锁定稳定记忆' : '已解锁稳定记忆', false);
    }

    /**
     * @param {number} index
     */
    function deleteExplicitMemoryEntryFromSettings(index) {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      const targetIndex = Number.isInteger(index) ? index : Number.parseInt(String(index || ''), 10);
      if (!Number.isInteger(targetIndex) || targetIndex < 0) return;
      if (!aiMemory.longTermMemory || typeof aiMemory.longTermMemory !== 'object') aiMemory.longTermMemory = {};
      if (!Array.isArray(aiMemory.longTermMemory.explicitMemoryLog)) aiMemory.longTermMemory.explicitMemoryLog = [];
      if (targetIndex >= aiMemory.longTermMemory.explicitMemoryLog.length) return;
      aiMemory.longTermMemory.explicitMemoryLog.splice(targetIndex, 1);
      aiMemory.explicitMemoryLog = aiMemory.longTermMemory.explicitMemoryLog.slice();
      if (typeof api.syncStructuredLongTermFacts === 'function') {
        api.syncStructuredLongTermFacts(aiMemory);
      }
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已移除一条明确记忆';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function promoteExplicitMemoryEntryFromSettings(index) {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      const targetIndex = Number.isInteger(index) ? index : Number.parseInt(String(index || ''), 10);
      if (!Number.isInteger(targetIndex) || targetIndex < 0) return;
      if (!aiMemory.longTermMemory || typeof aiMemory.longTermMemory !== 'object') aiMemory.longTermMemory = {};
      if (!Array.isArray(aiMemory.longTermMemory.explicitMemoryLog)) aiMemory.longTermMemory.explicitMemoryLog = [];
      const entries = aiMemory.longTermMemory.explicitMemoryLog;
      if (targetIndex >= entries.length) return;
      const selected = /** @type {Record<string, any> | null} */ (entries[targetIndex] && typeof entries[targetIndex] === 'object' ? entries[targetIndex] : null);
      if (!selected) return;
      const conflictKey = buildStableMemoryConflictKey(selected);
      const nextEntries = [];
      entries.forEach((entry, entryIndex) => {
        if (entryIndex === targetIndex) return;
        if (conflictKey && buildStableMemoryConflictKey(entry) === conflictKey) return;
        nextEntries.push(entry);
      });
      selected.at = new Date().toISOString();
      selected.source = String(selected.source || 'settings-memory-unified').trim() || 'settings-memory-unified';
      nextEntries.unshift(selected);
      aiMemory.longTermMemory.explicitMemoryLog = nextEntries;
      aiMemory.explicitMemoryLog = aiMemory.longTermMemory.explicitMemoryLog.slice();
      if (typeof api.syncStructuredLongTermFacts === 'function') {
        api.syncStructuredLongTermFacts(aiMemory);
      }
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已设为当前记忆，并移除同类旧版本';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveRelationshipReminderPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLInputElement | null} */
      const selectedTone = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="settings-relationship-reminder-tone"]:checked'));
      /** @type {HTMLSelectElement | null} */
      const frequencyInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-reminder-frequency'));
      /** @type {HTMLSelectElement | null} */
      const lowStateInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-reminder-low-state'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-relationship-reminder-note'));
      const fallback = typeof api.getDefaultRelationshipReminderPreferences === 'function'
        ? api.getDefaultRelationshipReminderPreferences()
        : { tone: 'gentle', frequency: 'balanced', lowStateStrategy: 'extra-gentle', customNote: '' };
      /** @type {"gentle" | "direct" | "minimal"} */
      const tone = selectedTone?.value === 'direct'
        ? 'direct'
        : selectedTone?.value === 'minimal'
          ? 'minimal'
          : 'gentle';
      /** @type {"balanced" | "important-only" | "follow-up"} */
      const frequency = frequencyInput?.value === 'important-only'
        ? 'important-only'
        : frequencyInput?.value === 'follow-up'
          ? 'follow-up'
          : 'balanced';
      /** @type {"extra-gentle" | "hold-back" | "stay-direct"} */
      const lowStateStrategy = lowStateInput?.value === 'hold-back'
        ? 'hold-back'
        : lowStateInput?.value === 'stay-direct'
          ? 'stay-direct'
          : 'extra-gentle';
      if (!aiMemory.relationshipMode || typeof aiMemory.relationshipMode !== 'object') aiMemory.relationshipMode = {};
      aiMemory.relationshipMode.reminderPreferences = {
        tone: tone || fallback.tone,
        frequency: frequency || fallback.frequency,
        lowStateStrategy: lowStateStrategy || fallback.lowStateStrategy,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已保存提醒偏好';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveRelationshipProactivityPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLInputElement | null} */
      const selectedMode = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="settings-relationship-proactivity-mode"]:checked'));
      /** @type {HTMLSelectElement | null} */
      const followUpInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-proactivity-follow-up'));
      /** @type {HTMLSelectElement | null} */
      const interruptionInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-proactivity-interruption'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-relationship-proactivity-note'));
      const fallback = typeof api.getDefaultRelationshipProactivityPreferences === 'function'
        ? api.getDefaultRelationshipProactivityPreferences()
        : { defaultMode: 'balanced', followUpStyle: 'ask-more', interruptionThreshold: 'balanced', customNote: '' };
      /** @type {"balanced" | "proactive" | "reserved"} */
      const defaultMode = selectedMode?.value === 'proactive'
        ? 'proactive'
        : selectedMode?.value === 'reserved'
          ? 'reserved'
          : 'balanced';
      /** @type {"ask-more" | "wait-more" | "only-when-stuck"} */
      const followUpStyle = followUpInput?.value === 'wait-more'
        ? 'wait-more'
        : followUpInput?.value === 'only-when-stuck'
          ? 'only-when-stuck'
          : 'ask-more';
      /** @type {"important-only" | "balanced" | "surface-early"} */
      const interruptionThreshold = interruptionInput?.value === 'important-only'
        ? 'important-only'
        : interruptionInput?.value === 'surface-early'
          ? 'surface-early'
          : 'balanced';
      if (!aiMemory.relationshipMode || typeof aiMemory.relationshipMode !== 'object') aiMemory.relationshipMode = {};
      aiMemory.relationshipMode.proactivityPreferences = {
        defaultMode: defaultMode || fallback.defaultMode,
        followUpStyle: followUpStyle || fallback.followUpStyle,
        interruptionThreshold: interruptionThreshold || fallback.interruptionThreshold,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已保存主动偏好';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveRelationshipBoundaryPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLSelectElement | null} */
      const moneyInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-boundary-money'));
      /** @type {HTMLSelectElement | null} */
      const publicInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-boundary-public'));
      /** @type {HTMLSelectElement | null} */
      const healthInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-boundary-health'));
      /** @type {HTMLSelectElement | null} */
      const uncertaintyInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-boundary-uncertainty'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-relationship-boundary-note'));
      const fallback = typeof api.getDefaultRelationshipBoundaryPreferences === 'function'
        ? api.getDefaultRelationshipBoundaryPreferences()
        : { moneyDecisions: 'ask-first', publicSpeech: 'draft-only', healthJudgment: 'be-explicitly-cautious', uncertaintyStyle: 'say-uncertain', customNote: '' };
      /** @type {"ask-first" | "suggest-only" | "can-draft"} */
      const moneyDecisions = moneyInput?.value === 'suggest-only'
        ? 'suggest-only'
        : moneyInput?.value === 'can-draft'
          ? 'can-draft'
          : 'ask-first';
      /** @type {"never-send" | "draft-only" | "ask-before-send"} */
      const publicSpeech = publicInput?.value === 'never-send'
        ? 'never-send'
        : publicInput?.value === 'ask-before-send'
          ? 'ask-before-send'
          : 'draft-only';
      /** @type {"suggest-only" | "ask-first" | "be-explicitly-cautious"} */
      const healthJudgment = healthInput?.value === 'suggest-only'
        ? 'suggest-only'
        : healthInput?.value === 'ask-first'
          ? 'ask-first'
          : 'be-explicitly-cautious';
      /** @type {"say-uncertain" | "offer-options" | "pause-and-ask"} */
      const uncertaintyStyle = uncertaintyInput?.value === 'offer-options'
        ? 'offer-options'
        : uncertaintyInput?.value === 'pause-and-ask'
          ? 'pause-and-ask'
          : 'say-uncertain';
      if (!aiMemory.relationshipMode || typeof aiMemory.relationshipMode !== 'object') aiMemory.relationshipMode = {};
      aiMemory.relationshipMode.boundaryPreferences = {
        moneyDecisions: moneyDecisions || fallback.moneyDecisions,
        publicSpeech: publicSpeech || fallback.publicSpeech,
        healthJudgment: healthJudgment || fallback.healthJudgment,
        uncertaintyStyle: uncertaintyStyle || fallback.uncertaintyStyle,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已保存边界偏好';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveRelationshipLongTermFocusPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLSelectElement | null} */
      const primaryInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-focus-primary'));
      /** @type {HTMLSelectElement | null} */
      const styleInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-focus-style'));
      /** @type {HTMLSelectElement | null} */
      const horizonInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-relationship-focus-horizon'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-relationship-focus-note'));
      const fallback = typeof api.getDefaultRelationshipLongTermFocusPreferences === 'function'
        ? api.getDefaultRelationshipLongTermFocusPreferences()
        : { primaryFocus: 'balanced', supportStyle: 'steady-companion', horizon: 'this-season', customNote: '' };
      /** @type {"steady-rhythm" | "project-delivery" | "health-stability" | "balanced"} */
      const primaryFocus = primaryInput?.value === 'steady-rhythm'
        ? 'steady-rhythm'
        : primaryInput?.value === 'project-delivery'
          ? 'project-delivery'
          : primaryInput?.value === 'health-stability'
            ? 'health-stability'
            : 'balanced';
      /** @type {"clarify-first" | "push-forward" | "steady-companion" | "protect-boundaries"} */
      const supportStyle = styleInput?.value === 'clarify-first'
        ? 'clarify-first'
        : styleInput?.value === 'push-forward'
          ? 'push-forward'
          : styleInput?.value === 'protect-boundaries'
            ? 'protect-boundaries'
            : 'steady-companion';
      /** @type {"this-week" | "this-season" | "long-term"} */
      const horizon = horizonInput?.value === 'this-week'
        ? 'this-week'
        : horizonInput?.value === 'long-term'
          ? 'long-term'
          : 'this-season';
      if (!aiMemory.relationshipMode || typeof aiMemory.relationshipMode !== 'object') aiMemory.relationshipMode = {};
      aiMemory.relationshipMode.longTermFocusPreferences = {
        primaryFocus: primaryFocus || fallback.primaryFocus,
        supportStyle: supportStyle || fallback.supportStyle,
        horizon: horizon || fallback.horizon,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.relationshipModeStatusMessage = '已保存长期重点';
      settingsState.relationshipModeStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveBehaviorMemoryPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLSelectElement | null} */
      const captureInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-memory-capture'));
      /** @type {HTMLSelectElement | null} */
      const retentionInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-memory-retention'));
      /** @type {HTMLSelectElement | null} */
      const recallInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-memory-recall'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-behavior-memory-note'));
      const fallback = typeof api.getDefaultBehaviorMemoryPreferences === 'function'
        ? api.getDefaultBehaviorMemoryPreferences()
        : { captureMode: 'balanced', retentionMode: 'decisions-and-turning-points', recallMode: 'task-first', customNote: '' };
      /** @type {"important-only" | "balanced" | "rich-context"} */
      const captureMode = captureInput?.value === 'important-only'
        ? 'important-only'
        : captureInput?.value === 'rich-context'
          ? 'rich-context'
          : 'balanced';
      /** @type {"stable-preferences" | "decisions-and-turning-points" | "project-threads"} */
      const retentionMode = retentionInput?.value === 'stable-preferences'
        ? 'stable-preferences'
        : retentionInput?.value === 'project-threads'
          ? 'project-threads'
          : 'decisions-and-turning-points';
      /** @type {"task-first" | "recent-first" | "pattern-first"} */
      const recallMode = recallInput?.value === 'recent-first'
        ? 'recent-first'
        : recallInput?.value === 'pattern-first'
          ? 'pattern-first'
          : 'task-first';
      if (!aiMemory.behaviorHabits || typeof aiMemory.behaviorHabits !== 'object') aiMemory.behaviorHabits = {};
      aiMemory.behaviorHabits.memoryPreferences = {
        captureMode: captureMode || fallback.captureMode,
        retentionMode: retentionMode || fallback.retentionMode,
        recallMode: recallMode || fallback.recallMode,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.behaviorHabitStatusMessage = '已保存记忆方式';
      settingsState.behaviorHabitStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveBehaviorPlanningPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLSelectElement | null} */
      const planningStyleInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-planning-style'));
      /** @type {HTMLSelectElement | null} */
      const certaintyInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-planning-certainty'));
      /** @type {HTMLSelectElement | null} */
      const granularityInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-planning-granularity'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-behavior-planning-note'));
      const fallback = typeof api.getDefaultBehaviorPlanningPreferences === 'function'
        ? api.getDefaultBehaviorPlanningPreferences()
        : { planningStyle: 'clarify-then-plan', certaintyStyle: 'separate-facts', granularity: 'top-three', customNote: '' };
      /** @type {"clarify-then-plan" | "direct-plan" | "minimum-next-step"} */
      const planningStyle = planningStyleInput?.value === 'direct-plan'
        ? 'direct-plan'
        : planningStyleInput?.value === 'minimum-next-step'
          ? 'minimum-next-step'
          : 'clarify-then-plan';
      /** @type {"separate-facts" | "more-decisive" | "stay-conservative"} */
      const certaintyStyle = certaintyInput?.value === 'more-decisive'
        ? 'more-decisive'
        : certaintyInput?.value === 'stay-conservative'
          ? 'stay-conservative'
          : 'separate-facts';
      /** @type {"top-three" | "time-blocks" | "full-steps"} */
      const granularity = granularityInput?.value === 'time-blocks'
        ? 'time-blocks'
        : granularityInput?.value === 'full-steps'
          ? 'full-steps'
          : 'top-three';
      if (!aiMemory.behaviorHabits || typeof aiMemory.behaviorHabits !== 'object') aiMemory.behaviorHabits = {};
      aiMemory.behaviorHabits.planningPreferences = {
        planningStyle: planningStyle || fallback.planningStyle,
        certaintyStyle: certaintyStyle || fallback.certaintyStyle,
        granularity: granularity || fallback.granularity,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.behaviorHabitStatusMessage = '已保存规划习惯';
      settingsState.behaviorHabitStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveBehaviorExpressionPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLSelectElement | null} */
      const responseLengthInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-expression-length'));
      /** @type {HTMLSelectElement | null} */
      const structureInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-expression-structure'));
      /** @type {HTMLSelectElement | null} */
      const warmthInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-expression-warmth'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-behavior-expression-note'));
      const fallback = typeof api.getDefaultBehaviorExpressionPreferences === 'function'
        ? api.getDefaultBehaviorExpressionPreferences()
        : { responseLength: 'balanced', structureStyle: 'structured', warmth: 'balanced', customNote: '' };
      /** @type {"concise" | "balanced" | "detailed"} */
      const responseLength = responseLengthInput?.value === 'concise'
        ? 'concise'
        : responseLengthInput?.value === 'detailed'
          ? 'detailed'
          : 'balanced';
      /** @type {"natural" | "structured" | "action-first"} */
      const structureStyle = structureInput?.value === 'natural'
        ? 'natural'
        : structureInput?.value === 'action-first'
          ? 'action-first'
          : 'structured';
      /** @type {"calm" | "balanced" | "encouraging"} */
      const warmth = warmthInput?.value === 'calm'
        ? 'calm'
        : warmthInput?.value === 'encouraging'
          ? 'encouraging'
          : 'balanced';
      if (!aiMemory.behaviorHabits || typeof aiMemory.behaviorHabits !== 'object') aiMemory.behaviorHabits = {};
      aiMemory.behaviorHabits.expressionPreferences = {
        responseLength: responseLength || fallback.responseLength,
        structureStyle: structureStyle || fallback.structureStyle,
        warmth: warmth || fallback.warmth,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.behaviorHabitStatusMessage = '已保存表达风格';
      settingsState.behaviorHabitStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveBehaviorFocusPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLSelectElement | null} */
      const primaryInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-focus-primary'));
      /** @type {HTMLSelectElement | null} */
      const retrievalInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-focus-retrieval'));
      /** @type {HTMLSelectElement | null} */
      const reminderBiasInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-focus-reminder-bias'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-behavior-focus-note'));
      const fallback = typeof api.getDefaultBehaviorFocusPreferences === 'function'
        ? api.getDefaultBehaviorFocusPreferences()
        : { primaryAttention: 'current-context', retrievalPriority: 'active-items', reminderBias: 'important-first', customNote: '' };
      /** @type {"current-context" | "task-thread" | "long-term-balance"} */
      const primaryAttention = primaryInput?.value === 'task-thread'
        ? 'task-thread'
        : primaryInput?.value === 'long-term-balance'
          ? 'long-term-balance'
          : 'current-context';
      /** @type {"active-items" | "recent-signals" | "stable-patterns"} */
      const retrievalPriority = retrievalInput?.value === 'recent-signals'
        ? 'recent-signals'
        : retrievalInput?.value === 'stable-patterns'
          ? 'stable-patterns'
          : 'active-items';
      /** @type {"important-first" | "deadline-first" | "state-first"} */
      const reminderBias = reminderBiasInput?.value === 'deadline-first'
        ? 'deadline-first'
        : reminderBiasInput?.value === 'state-first'
          ? 'state-first'
          : 'important-first';
      if (!aiMemory.behaviorHabits || typeof aiMemory.behaviorHabits !== 'object') aiMemory.behaviorHabits = {};
      aiMemory.behaviorHabits.focusPreferences = {
        primaryAttention: primaryAttention || fallback.primaryAttention,
        retrievalPriority: retrievalPriority || fallback.retrievalPriority,
        reminderBias: reminderBias || fallback.reminderBias,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.behaviorHabitStatusMessage = '已保存关注重点';
      settingsState.behaviorHabitStatusError = false;
      saveCanonicalStableMemoryData();
      api.renderSettingsView();
    }

    function saveBehaviorSafetyPreferencesFromSettings() {
      const aiMemory = api.getAIMemory ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      /** @type {HTMLSelectElement | null} */
      const dataWriteInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-safety-data-write'));
      /** @type {HTMLSelectElement | null} */
      const selfUpdateInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-safety-self-update'));
      /** @type {HTMLSelectElement | null} */
      const highRiskInput = /** @type {HTMLSelectElement | null} */ (document.getElementById('settings-behavior-safety-high-risk'));
      /** @type {HTMLTextAreaElement | null} */
      const noteInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-behavior-safety-note'));
      const fallback = typeof api.getDefaultBehaviorSafetyPreferences === 'function'
        ? api.getDefaultBehaviorSafetyPreferences()
        : { dataWriteMode: 'explicit-only', selfUpdateMode: 'proposal-only', highRiskAdviceMode: 'strictly-conservative', customNote: '' };
      /** @type {"explicit-only" | "double-check-high-risk" | "assistive-draft"} */
      const dataWriteMode = dataWriteInput?.value === 'double-check-high-risk'
        ? 'double-check-high-risk'
        : dataWriteInput?.value === 'assistive-draft'
          ? 'assistive-draft'
          : 'explicit-only';
      /** @type {"proposal-only" | "runtime-only" | "off"} */
      const selfUpdateMode = selfUpdateInput?.value === 'runtime-only'
        ? 'runtime-only'
        : selfUpdateInput?.value === 'off'
          ? 'off'
          : 'proposal-only';
      /** @type {"strictly-conservative" | "balanced" | "ask-for-context"} */
      const highRiskAdviceMode = highRiskInput?.value === 'balanced'
        ? 'balanced'
        : highRiskInput?.value === 'ask-for-context'
          ? 'ask-for-context'
          : 'strictly-conservative';
      if (!aiMemory.behaviorHabits || typeof aiMemory.behaviorHabits !== 'object') aiMemory.behaviorHabits = {};
      aiMemory.behaviorHabits.safetyPreferences = {
        dataWriteMode: dataWriteMode || fallback.dataWriteMode,
        selfUpdateMode: selfUpdateMode || fallback.selfUpdateMode,
        highRiskAdviceMode: highRiskAdviceMode || fallback.highRiskAdviceMode,
        customNote: String(noteInput?.value || '').trim(),
      };
      syncStableMemoryFacts(aiMemory);
      const settingsState = api.getSettingsState();
      settingsState.behaviorHabitStatusMessage = '已保存安全边界';
      settingsState.behaviorHabitStatusError = false;
      api.saveData({ skipUndo: true, skipRender: true });
      api.renderSettingsView();
    }

    function saveMorphRuntimeFromSettings() {
      /** @type {HTMLTextAreaElement | null} */
      const skillsInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-morph-runtime-skills-input'));
      /** @type {HTMLTextAreaElement | null} */
      const contextInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-morph-runtime-context-input'));
      /** @type {HTMLTextAreaElement | null} */
      const memoryInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-morph-runtime-memory-input'));
      if (!skillsInput || !contextInput || !memoryInput) return;
      let skills;
      let contextRules;
      try { skills = JSON.parse(String(skillsInput.value || '{}')); } catch (_) { api.setRuntimeStatus('skills.json 不是有效 JSON', true); return; }
      try { contextRules = JSON.parse(String(contextInput.value || '{}')); } catch (_) { api.setRuntimeStatus('context-rules.json 不是有效 JSON', true); return; }
      const changed = api.applyMorphRuntimeOverlayUpdate({ skills, contextRules, memoryRules: String(memoryInput.value || '') });
      api.setRuntimeStatus(changed ? '已保存 Runtime' : '未检测到变化', false);
      api.saveData({ skipUndo: true, skipRender: true });
      api.renderSettingsView();
    }

    /**
     * @param {string} section
     */
    function saveMorphRuntimeSectionFromSettings(section) {
      const runtime = api.getMorphRuntimeBundle();
      if (section === 'skills') {
        /** @type {HTMLTextAreaElement | null} */
        const input = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-morph-runtime-skills-input'));
        if (!input) return;
        try {
          const changed = api.applyMorphRuntimeOverlayUpdate({ skills: JSON.parse(String(input.value || '{}')) });
          api.setRuntimeStatus(changed ? '已保存 skills' : '未检测到变化', false);
        } catch (_) {
          api.setRuntimeStatus('skills.json 不是有效 JSON', true);
          return;
        }
      } else if (section === 'contextRules') {
        /** @type {HTMLTextAreaElement | null} */
        const input = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-morph-runtime-context-input'));
        if (!input) return;
        try {
          const changed = api.applyMorphRuntimeOverlayUpdate({ contextRules: JSON.parse(String(input.value || '{}')) });
          api.setRuntimeStatus(changed ? '已保存 contextRules' : '未检测到变化', false);
        } catch (_) {
          api.setRuntimeStatus('context-rules.json 不是有效 JSON', true);
          return;
        }
      } else if (section === 'memoryRules') {
        /** @type {HTMLTextAreaElement | null} */
        const input = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-morph-runtime-memory-input'));
        if (!input) return;
        const changed = api.applyMorphRuntimeOverlayUpdate({ memoryRules: String(input.value || runtime.memoryRules || '') });
        api.setRuntimeStatus(changed ? '已保存 memoryRules' : '未检测到变化', false);
      } else {
        return;
      }
      api.saveData({ skipUndo: true, skipRender: true });
      api.renderSettingsView();
    }

    function toggleAbilityProactiveAgentFromSettings() {
      const runtime = api.getMorphRuntimeBundle();
      const currentConfig = api.sanitizeMorphProactiveAgentConfig(runtime.skills?.proactiveAgent);
      const nextEnabled = !currentConfig.enabled;
      const heartbeatMinutes = Number.isFinite(Number(currentConfig.heartbeatMinutes))
        ? Math.max(1, Math.min(1440, Math.round(Number(currentConfig.heartbeatMinutes))))
        : 60;
      const changed = api.applyMorphRuntimeOverlayUpdate({
        skills: {
          proactiveAgent: {
            ...currentConfig,
            enabled: nextEnabled,
            heartbeatMinutes,
          },
        },
      });
      if (!changed) return;
      api.saveData({ skipUndo: true, skipRender: true });
      api.renderSettingsView();
    }

    function getAbilityProactiveScheduleInputValues() {
      /** @type {HTMLInputElement | null} */
      const startInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ability-proactive-window-start'));
      /** @type {HTMLInputElement | null} */
      const endInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ability-proactive-window-end'));
      /** @type {HTMLInputElement | null} */
      const heartbeatInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ability-proactive-heartbeat-minutes'));
      if (!startInput || !endInput || !heartbeatInput) return null;
      const normalizeHHMM = (value, fallback) => {
        const match = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
        if (!match) return fallback;
        const hour = Math.max(0, Math.min(23, Number(match[1])));
        const minute = Math.max(0, Math.min(59, Number(match[2])));
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      };
      const runtime = api.getMorphRuntimeBundle();
      const currentConfig = api.sanitizeMorphProactiveAgentConfig(runtime.skills?.proactiveAgent);
      const activeStart = normalizeHHMM(startInput.value, currentConfig.quietHoursEnd || '07:00');
      const activeEnd = normalizeHHMM(endInput.value, currentConfig.quietHoursStart || '22:00');
      const heartbeatMinutesRaw = Number(heartbeatInput.value);
      const heartbeatMinutes = Number.isFinite(heartbeatMinutesRaw)
        ? Math.max(1, Math.min(1440, Math.round(heartbeatMinutesRaw)))
        : Math.max(1, Math.min(1440, Number(currentConfig.heartbeatMinutes || 60)));
      return {
        startInput,
        endInput,
        heartbeatInput,
        currentConfig,
        activeStart,
        activeEnd,
        heartbeatMinutes,
      };
    }

    function updateAbilityProactiveScheduleSummaryFromInputs() {
      const values = getAbilityProactiveScheduleInputValues();
      if (!values) return;
      const summary = document.getElementById('settings-ability-proactive-summary');
      if (summary) {
        summary.textContent = `当前设置：${values.activeStart}-${values.activeEnd} ｜ 每 ${values.heartbeatMinutes} 分钟`;
      }
    }

    function queueAbilityProactiveAgentScheduleSaveFromSettings(delayMs = 240) {
      if (proactiveSchedulePersistTimer) clearTimeout(proactiveSchedulePersistTimer);
      proactiveSchedulePersistTimer = setTimeout(() => {
        proactiveSchedulePersistTimer = null;
        saveAbilityProactiveAgentScheduleFromSettings();
      }, Math.max(80, Number(delayMs) || 240));
      updateAbilityProactiveScheduleSummaryFromInputs();
    }

    function saveAbilityProactiveAgentScheduleFromSettings(options = {}) {
      if (proactiveSchedulePersistTimer) {
        clearTimeout(proactiveSchedulePersistTimer);
        proactiveSchedulePersistTimer = null;
      }
      const values = getAbilityProactiveScheduleInputValues();
      if (!values) return;
      const {
        startInput,
        endInput,
        heartbeatInput,
        currentConfig,
        activeStart,
        activeEnd,
        heartbeatMinutes,
      } = values;
      const nextConfig = api.sanitizeMorphProactiveAgentConfig({
        ...currentConfig,
        enabled: true,
        quietHoursStart: activeEnd,
        quietHoursEnd: activeStart,
        heartbeatMinutes,
      }, currentConfig);
      startInput.value = activeStart;
      endInput.value = activeEnd;
      heartbeatInput.value = String(heartbeatMinutes);
      updateAbilityProactiveScheduleSummaryFromInputs();
      const changed = api.applyMorphRuntimeOverlayUpdate({
        skills: {
          proactiveAgent: nextConfig,
        },
      });
      if (!changed) return;
      api.saveData({ skipUndo: true, skipRender: true });
      const requestRender = options === true || (options && typeof options === 'object' && /** @type {{ requestRender?: boolean }} */ (options).requestRender === true);
      if (requestRender) api.renderSettingsView();
    }

    return {
      buildSettingsDetailMarkup,
      saveAIUserMemoryFromSettings,
      saveAIMemoryIndexFromSettings,
      saveStableMemoryIdentityFromSettings,
      saveStableMemoryFactFromSettings,
      deleteStableMemoryFactFromSettings,
      toggleStableMemoryFactLockFromSettings,
      deleteExplicitMemoryEntryFromSettings,
      promoteExplicitMemoryEntryFromSettings,
      saveRelationshipReminderPreferencesFromSettings,
      saveRelationshipProactivityPreferencesFromSettings,
      saveRelationshipBoundaryPreferencesFromSettings,
      saveRelationshipLongTermFocusPreferencesFromSettings,
      saveBehaviorMemoryPreferencesFromSettings,
      saveBehaviorPlanningPreferencesFromSettings,
      saveBehaviorExpressionPreferencesFromSettings,
      saveBehaviorFocusPreferencesFromSettings,
      saveBehaviorSafetyPreferencesFromSettings,
      saveMorphRuntimeFromSettings,
      saveMorphRuntimeSectionFromSettings,
      toggleAbilityProactiveAgentFromSettings,
      queueAbilityProactiveAgentScheduleSaveFromSettings,
      saveAbilityProactiveAgentScheduleFromSettings,
    };
  }

  window.MorphSettingsDetailRuntime = { create: createSettingsDetailRuntime };
})();
