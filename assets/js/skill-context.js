(function () {
  const ACTION_HINTS_BY_SKILL_ID = {
    'morph-daily-log-operations': [
      '日志域：优先区分 today 与指定日期；新增保留原句，修改/删除只命中单条目标。',
      '如果用户明确说“不要写日志”，不要提取日志写入动作。',
    ],
    'morph-thought-operations': [
      '念头域：先区分闪念与定念；捕捉原话，归类/移动前优先确认目标容器。',
      '涉及“归到项目/转成定念/去重/合并”时，优先使用 thought 相关动作。',
    ],
    'morph-project-operations': [
      '项目域：先区分项目本体、正文 block、参考条目 reference。',
      '涉及新建/重命名/归档/删除项目时，优先使用 project 动作。',
    ],
    'morph-reminder-operations': [
      '提醒域：先抽取提醒内容和时间；若时间缺失，只补问时间。',
      '涉及提醒改时间、删提醒、设提醒时，优先使用 reminder 动作。',
    ],
    'morph-expense-ledger-operations': [
      '记账域：优先抽取金额、项目、类别、时间；金额缺失时不要硬写入。',
      '涉及“花了/记账/删刚刚那笔/改刚刚那笔”时，优先使用 expense ledger 动作。',
    ],
    'morph-planning-operations': [
      '规划域：先区分“只是给建议”还是“真的生成时间块/计划草案”。',
      '如果用户明确说“不要写日志”，不要顺手提取日志动作；优先使用 planning 动作。',
    ],
    'morph-data-operations': [
      '跨域数据操作：当一句话同时涉及多个域或包含撤销/混合编辑时，用它作为协调兜底。',
      '如果已命中明确单领域 skill，通用 data skill 只做辅助，不抢主域判断。',
    ],
  };
  function createSkillContextModules(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const bundledSkillBodyCache = new Map();
    let bundledSkillManifestCache = null;
    let bundledSkillManifestInflight = null;

    async function loadBundledSkillManifestCached() {
      if (bundledSkillManifestCache) return bundledSkillManifestCache;
      if (bundledSkillManifestInflight) return bundledSkillManifestInflight;
      bundledSkillManifestInflight = (async () => {
        try {
          const manifest = typeof api.loadBundledSkillManifest === 'function'
            ? await api.loadBundledSkillManifest()
            : null;
          bundledSkillManifestCache = manifest && typeof manifest === 'object' ? manifest : { skills: [] };
          return bundledSkillManifestCache;
        } finally {
          bundledSkillManifestInflight = null;
        }
      })();
      return bundledSkillManifestInflight;
    }

    async function loadBundledSkillBody(skillPath) {
      const key = String(skillPath || '').trim();
      if (!key) return '';
      if (bundledSkillBodyCache.has(key)) return bundledSkillBodyCache.get(key);
      if (typeof fetch !== 'function') return '';
      try {
        const res = await fetch(`${key}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return '';
        const text = String((await res.text()) || '').trim();
        const normalized = text.length > 2600 ? `${text.slice(0, 2600)}\n...[truncated]` : text;
        bundledSkillBodyCache.set(key, normalized);
        return normalized;
      } catch (_) {
        return '';
      }
    }

    async function buildBundledSkillPromptContext(question) {
      const manifest = await loadBundledSkillManifestCached();
      const allSkills = Array.isArray(manifest?.skills) ? manifest.skills : [];
      if (!allSkills.length) return '';
      if (api.isExternalAssistantConflictQuery(question)) return '';
      const summary = allSkills
        .slice(0, 8)
        .map((skill) => `- ${skill.name}: ${skill.description}`)
        .join('\n');
      const matched = api.selectBundledSkillsForQuery(question, manifest);
      if (!matched.length) {
        return `Morpheus Skills Catalog (level-1 metadata):\n${summary}`;
      }
      const bodies = [];
      for (const skill of matched) {
        const body = await loadBundledSkillBody(skill.path);
        if (!body) continue;
        bodies.push(`Skill ${skill.name} (level-2 instructions):\n${body}`);
      }
      return `Morpheus Skills Catalog (level-1 metadata):\n${summary}\n\nActivated skill guidance:\n${bodies.join('\n\n')}`;
    }

    async function buildBundledSkillActionHintContext(question) {
      const manifest = await loadBundledSkillManifestCached();
      const allSkills = Array.isArray(manifest?.skills) ? manifest.skills : [];
      if (!allSkills.length) return '';
      if (api.isExternalAssistantConflictQuery(question)) return '';
      const matched = api.selectBundledSkillsForQuery(question, manifest);
      if (!matched.length) return '';
      const hints = matched
        .slice(0, 2)
        .map((skill) => {
          const skillId = String(skill?.id || skill?.name || '').trim();
          const hintLines = Array.isArray(ACTION_HINTS_BY_SKILL_ID[skillId]) ? ACTION_HINTS_BY_SKILL_ID[skillId] : [];
          if (hintLines.length) return `- ${skillId}: ${hintLines.join(' ')}`;
          const desc = String(skill?.description || '').trim();
          return desc ? `- ${skillId}: ${desc}` : '';
        })
        .filter(Boolean);
      return hints.length ? `Activated action-skill hints:\n${hints.join('\n')}` : '';
    }

    async function buildBundledActiveSkillIds(question) {
      const manifest = await loadBundledSkillManifestCached();
      const allSkills = Array.isArray(manifest?.skills) ? manifest.skills : [];
      if (!allSkills.length) return [];
      if (api.isExternalAssistantConflictQuery(question)) return [];
      return api.selectBundledSkillsForQuery(question, manifest)
        .map((skill) => String(skill?.id || skill?.name || '').trim())
        .filter(Boolean);
    }

    return {
      loadBundledSkillManifestCached,
      loadBundledSkillBody,
      buildBundledSkillPromptContext,
      buildBundledSkillActionHintContext,
      buildBundledActiveSkillIds,
    };
  }

  window.MorphSkillContextModules = {
    create: createSkillContextModules,
  };
})();
