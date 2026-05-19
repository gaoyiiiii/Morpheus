// @ts-check

(function initMorphAIActionMemoryRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionMemoryRuntime && typeof window.MorphAIActionMemoryRuntime.create === 'function') return;

  function createAIActionMemoryRuntime() {
    function runMemorySideEffectSafely(label = '', effect = null, warnings = []) {
      if (typeof effect !== 'function') return;
      try {
        effect();
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn(`[Morpheus][memory-action] ${String(label || 'side-effect').trim() || 'side-effect'} failed, preserving primary write.`, error);
        }
        if (Array.isArray(warnings)) {
          warnings.push({
            label: String(label || 'side-effect').trim() || 'side-effect',
            message: String(error?.message || error || '').trim() || 'unknown_error',
          });
        }
      }
    }

    function normalizeMemoryTargetFile(value = '') {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return '';
      if (/(^|\/)user\.?md$/.test(raw)) return 'user.md';
      if (/(^|\/)identity\.?md$/.test(raw)) return 'identity.md';
      if (/(^|\/)memory-system\.?md$/.test(raw)) return 'memory-system.md';
      if (/(^|\/)memory\.?md$/.test(raw)) return 'memory.md';
      if (/(^|\/)soul\.?md$/.test(raw)) return 'soul.md';
      return '';
    }

    function looksLikeAIPersonaMemory(sectionTitle = '', content = '') {
      const title = String(sectionTitle || '').trim();
      const text = String(content || '').trim();
      if (!title && !text) return false;
      if (/(AI\s*角色设定|自我定位|identity|persona|角色|人设|设定)/i.test(title)) return true;
      return /^(?:你|Morpheus|morph|这个AI|这个助手)/.test(text)
        || /(你是谁|你的名字|你的背景|你的故事|你的经历|你从哪里来)/.test(text);
    }

    function looksLikeUserScopedMemory(sectionTitle = '', content = '') {
      const title = String(sectionTitle || '').trim();
      const text = String(content || '').trim();
      if (!title && !text) return false;
      if (looksLikeAIPersonaMemory(title, text)) return false;
      if (/(用户|名字与称呼|用户偏好|长期偏好|饮食偏好|生活偏好|作息与休息偏好|工作方式偏好|回答表达偏好|日志记录偏好|协作纠正偏好)/.test(title)) return true;
      if (/^(?:我|我的|对我来说|我一般|我通常|我总是|我会|我容易|我希望|我想要|我不想|我喜欢|我不喜欢|我讨厌|我更喜欢|我更偏向|我习惯|我需要|我最好|默认|以后)/.test(text)) return true;
      return /(?:父亲|母亲|爸爸|妈妈|家里|童年|小时候|长大|海边|出生|职业|工作|经历|背景|家庭)/.test(text)
        && !/(?:你|Morpheus|morph|AI|助手)/i.test(text);
    }

    function applyMemoryAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const ensureAIMemoryShape = typeof ctx.ensureAIMemoryShape === 'function' ? ctx.ensureAIMemoryShape : null;
      const appendToMarkdownSection = typeof ctx.appendToMarkdownSection === 'function' ? ctx.appendToMarkdownSection : null;
      const recordExplicitMemoryLogEntry = typeof ctx.recordExplicitMemoryLogEntry === 'function' ? ctx.recordExplicitMemoryLogEntry : null;
      const rewriteMarkdownSection = typeof ctx.rewriteMarkdownSection === 'function' ? ctx.rewriteMarkdownSection : null;
      const buildDefaultAISoulUserMaterialMarkdown = typeof ctx.buildDefaultAISoulUserMaterialMarkdown === 'function' ? ctx.buildDefaultAISoulUserMaterialMarkdown : null;
      const buildDefaultAIIdentityMarkdown = typeof ctx.buildDefaultAIIdentityMarkdown === 'function' ? ctx.buildDefaultAIIdentityMarkdown : null;
      const buildDefaultAIUserMarkdown = typeof ctx.buildDefaultAIUserMarkdown === 'function' ? ctx.buildDefaultAIUserMarkdown : null;
      const writeStableUserMemoryEntry = typeof ctx.writeStableUserMemoryEntry === 'function' ? ctx.writeStableUserMemoryEntry : null;
      const buildDefaultAIMemoryIndexMarkdown = typeof ctx.buildDefaultAIMemoryIndexMarkdown === 'function' ? ctx.buildDefaultAIMemoryIndexMarkdown : null;
      const buildDefaultAIMemorySystemMarkdown = typeof ctx.buildDefaultAIMemorySystemMarkdown === 'function' ? ctx.buildDefaultAIMemorySystemMarkdown : null;
      const setMorphSoulMaterialActivation = typeof ctx.setMorphSoulMaterialActivation === 'function' ? ctx.setMorphSoulMaterialActivation : null;
      const refreshDurableVisibleMemoryFiles = typeof ctx.refreshDurableVisibleMemoryFiles === 'function' ? ctx.refreshDurableVisibleMemoryFiles : null;
      const getMorphRuntimeBundle = typeof ctx.getMorphRuntimeBundle === 'function' ? ctx.getMorphRuntimeBundle : () => ({ skills: {} });
      const applyMorphRuntimeOverlayUpdate = typeof ctx.applyMorphRuntimeOverlayUpdate === 'function' ? ctx.applyMorphRuntimeOverlayUpdate : null;
      const runProactiveAgentScan = typeof ctx.runProactiveAgentScan === 'function' ? ctx.runProactiveAgentScan : null;
      const dataRef = ctx.dataRef && typeof ctx.dataRef === 'object' ? ctx.dataRef : null;

      function resolveMemoryTarget(aiMemory, fallbackFile = 'soul.md') {
        const explicitTargetFile = normalizeMemoryTargetFile(
          action.targetFile || action.file || action.memoryFile || action.targetPath || ''
        );
        const targetFile = explicitTargetFile || fallbackFile;
        if (targetFile === 'user.md') {
          return {
            targetFile,
            scope: 'user',
            getValue: () => String(aiMemory.user || ''),
            setValue: (value) => {
              aiMemory.user = value;
            },
            buildDefaultMarkdown: buildDefaultAIUserMarkdown,
            allowsSoulActivation: false,
          };
        }
        if (targetFile === 'identity.md') {
          return {
            targetFile,
            scope: 'soul',
            getValue: () => String(aiMemory.identityNotes || ''),
            setValue: (value) => {
              aiMemory.identityNotes = value;
            },
            buildDefaultMarkdown: buildDefaultAIIdentityMarkdown,
            allowsSoulActivation: false,
          };
        }
        if (targetFile === 'memory.md') {
          return {
            targetFile,
            scope: 'system',
            getValue: () => String(aiMemory.memoryIndex || ''),
            setValue: (value) => {
              aiMemory.memoryIndex = value;
            },
            buildDefaultMarkdown: buildDefaultAIMemoryIndexMarkdown,
            allowsSoulActivation: false,
          };
        }
        if (targetFile === 'memory-system.md') {
          return {
            targetFile,
            scope: 'system',
            getValue: () => String(aiMemory.systemNotes || ''),
            setValue: (value) => {
              aiMemory.systemNotes = value;
            },
            buildDefaultMarkdown: buildDefaultAIMemorySystemMarkdown,
            allowsSoulActivation: false,
          };
        }
        return {
          targetFile: 'soul.md',
          scope: 'soul',
          getValue: () => String(aiMemory.soulUserNotes || ''),
          setValue: (value) => {
            aiMemory.soulUserNotes = value;
          },
          buildDefaultMarkdown: buildDefaultAISoulUserMaterialMarkdown,
          allowsSoulActivation: true,
        };
      }

      if (!actionType || !dataRef) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };

      if (actionType === 'memory_write_user') {
        if (!ensureAIMemoryShape || (!appendToMarkdownSection && !writeStableUserMemoryEntry)) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const content = String(action.content || action.text || '').trim();
        if (!content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const sectionTitle = String(action.sectionTitle || '用户偏好').trim() || '用户偏好';
        const aiMemory = ensureAIMemoryShape(dataRef).aiMemory;
        const target = resolveMemoryTarget(aiMemory, 'user.md');
        if (writeStableUserMemoryEntry) {
          const result = writeStableUserMemoryEntry({
            scope: target.scope,
            sectionTitle,
            content,
            stableKey: String(action.stableKey || '').trim(),
          }, aiMemory, {
            source: 'memory_write_user',
          }) || {};
          if (result.blocked) {
            return {
              handled: true,
              changed: false,
              appliedLabels: ['已拦截稳定记忆写入'],
              createdItems: [],
              actionRuntimeMeta: {
                blocked: true,
                blockedReason: '这条内容会改写 Morpheus 的核心底盘，当前不允许作为稳定用户记忆写入。',
                constitution: Array.isArray(result.constitution) ? result.constitution.slice(0, 6) : [],
              },
            };
          }
          return {
            handled: true,
            changed: result.changed !== false,
            appliedLabels: [`已记住，并写入 ${String(result.targetFile || 'user.md').trim() || 'user.md'}：${sectionTitle}`],
            createdItems: [],
            actionRuntimeMeta: null,
          };
        }
        const sidecarWarnings = [];
        target.setValue(
          appendToMarkdownSection(target.getValue(), sectionTitle, content, {
            buildDefaultMarkdown: target.buildDefaultMarkdown,
          })
        );
        runMemorySideEffectSafely('refreshDurableVisibleMemoryFiles', () => {
          if (refreshDurableVisibleMemoryFiles) refreshDurableVisibleMemoryFiles(aiMemory);
        }, sidecarWarnings);
        runMemorySideEffectSafely('recordExplicitMemoryLogEntry', () => {
          if (!recordExplicitMemoryLogEntry) return;
          recordExplicitMemoryLogEntry({
            aiMemory,
            scope: target.scope,
            sectionTitle,
            content,
            source: 'memory_write_user',
            candidateType: 'stable-preference',
            writeTier: 'long-term-active',
            label: sectionTitle,
            summary: `写入了 ${target.targetFile}：${sectionTitle}`,
          });
        }, sidecarWarnings);
        return {
          handled: true,
          changed: true,
          appliedLabels: [`已记住，并写入 ${target.targetFile}：${sectionTitle}`],
          createdItems: [],
          actionRuntimeMeta: sidecarWarnings.length ? { sidecarWarnings } : null,
        };
      }

      if (actionType === 'memory_rewrite_section') {
        if (!ensureAIMemoryShape || !rewriteMarkdownSection) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const content = String(action.content || action.text || '').trim();
        const sectionTitle = String(action.sectionTitle || '长期记忆').trim() || '长期记忆';
        if (!content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const aiMemory = ensureAIMemoryShape(dataRef).aiMemory;
        const target = resolveMemoryTarget(aiMemory, 'soul.md');
        const sidecarWarnings = [];
        target.setValue(rewriteMarkdownSection(target.getValue(), sectionTitle, content, {
          buildDefaultMarkdown: target.buildDefaultMarkdown,
        }));
        runMemorySideEffectSafely('setMorphSoulMaterialActivation', () => {
          if (!target.allowsSoulActivation || !setMorphSoulMaterialActivation) return;
          setMorphSoulMaterialActivation({
            aiMemory,
            sectionTitle,
            content,
            source: 'memory_rewrite_section',
            turns: 3,
          });
        }, sidecarWarnings);
        runMemorySideEffectSafely('refreshDurableVisibleMemoryFiles', () => {
          if (refreshDurableVisibleMemoryFiles) refreshDurableVisibleMemoryFiles(aiMemory);
        }, sidecarWarnings);
        runMemorySideEffectSafely('recordExplicitMemoryLogEntry', () => {
          if (!recordExplicitMemoryLogEntry) return;
          recordExplicitMemoryLogEntry({
            aiMemory,
            scope: target.scope,
            sectionTitle,
            content,
            source: 'memory_rewrite_section',
            candidateType: 'explicit-memory',
            writeTier: 'long-term-candidate',
            label: sectionTitle,
            summary: `重写了 ${target.targetFile}：${sectionTitle}`,
          });
        }, sidecarWarnings);
        return {
          handled: true,
          changed: true,
          appliedLabels: [`已更新 ${target.targetFile}：${sectionTitle}`],
          createdItems: [],
          actionRuntimeMeta: sidecarWarnings.length ? { sidecarWarnings } : null,
        };
      }

      if (actionType === 'write_soul_memory') {
        if (!ensureAIMemoryShape || !appendToMarkdownSection) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const content = String(action.content || action.text || '').trim();
        if (!content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const sectionTitle = String(action.sectionTitle || '长期记忆').trim() || '长期记忆';
        const aiMemory = ensureAIMemoryShape(dataRef).aiMemory;
        const requestedTarget = normalizeMemoryTargetFile(action.targetFile || action.file || action.memoryFile || action.targetPath || '') || 'soul.md';
        const fallbackTarget = requestedTarget !== 'identity.md'
          && requestedTarget !== 'memory-system.md'
          && looksLikeUserScopedMemory(sectionTitle, content)
          ? 'user.md'
          : requestedTarget;
        const target = resolveMemoryTarget(aiMemory, fallbackTarget);
        const sidecarWarnings = [];
        target.setValue(appendToMarkdownSection(target.getValue(), sectionTitle, content, {
          buildDefaultMarkdown: target.buildDefaultMarkdown,
        }));
        runMemorySideEffectSafely('setMorphSoulMaterialActivation', () => {
          if (!target.allowsSoulActivation || !setMorphSoulMaterialActivation) return;
          setMorphSoulMaterialActivation({
            aiMemory,
            sectionTitle,
            content,
            source: 'write_soul_memory',
            turns: 3,
          });
        }, sidecarWarnings);
        runMemorySideEffectSafely('refreshDurableVisibleMemoryFiles', () => {
          if (refreshDurableVisibleMemoryFiles) refreshDurableVisibleMemoryFiles(aiMemory);
        }, sidecarWarnings);
        runMemorySideEffectSafely('recordExplicitMemoryLogEntry', () => {
          if (!recordExplicitMemoryLogEntry) return;
          recordExplicitMemoryLogEntry({
            aiMemory,
            scope: target.scope,
            sectionTitle,
            content,
            source: 'write_soul_memory',
            candidateType: 'explicit-memory',
            writeTier: 'long-term-candidate',
            label: sectionTitle,
            summary: `写入了 ${target.targetFile}：${sectionTitle}`,
          });
        }, sidecarWarnings);
        return {
          handled: true,
          changed: true,
          appliedLabels: [`已记住，并写入 ${target.targetFile}：${sectionTitle}`],
          createdItems: [],
          actionRuntimeMeta: sidecarWarnings.length ? { sidecarWarnings } : null,
        };
      }

      if (actionType === 'self_update_runtime_rules') {
        if (!applyMorphRuntimeOverlayUpdate) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (!getMorphRuntimeBundle()?.skills?.selfUpgradeEnabled) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const updates = action.updates && typeof action.updates === 'object' ? action.updates : {};
        if (!applyMorphRuntimeOverlayUpdate(updates)) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (recordExplicitMemoryLogEntry) {
          recordExplicitMemoryLogEntry({
            scope: 'runtime',
            sectionTitle: '运行时规则',
            content: JSON.stringify(updates),
            source: 'self_update_runtime_rules',
            candidateType: 'explicit-memory',
            writeTier: 'runtime-rule-hint',
            label: '运行时规则',
            summary: '记录了一次运行时规则更新',
          });
        }
        const touched = [];
        if (updates.skills) touched.push('skills');
        if (updates.contextRules) touched.push('contextRules');
        if (typeof updates.memoryRules === 'string') touched.push('memoryRules');
        return { handled: true, changed: true, appliedLabels: [`自升级：${touched.join(' / ') || 'runtime'}`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'trigger_proactive_scan') {
        setTimeout(() => {
          if (runProactiveAgentScan) runProactiveAgentScan({ force: true, source: 'ai-action' });
        }, 0);
        return { handled: true, changed: false, appliedLabels: ['已触发主动巡查'], createdItems: [], actionRuntimeMeta: null };
      }

      return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
    }

    return {
      applyMemoryAction,
    };
  }

  window.MorphAIActionMemoryRuntime = {
    create: createAIActionMemoryRuntime,
  };
})();
