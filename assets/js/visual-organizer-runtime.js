(function () {
  function createVisualOrganizerRuntime(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function ensurePluginDataShape(source = api.getData ? api.getData() : null) {
      const root = source && typeof source === 'object' ? source : {};
      if (!root.pluginData || typeof root.pluginData !== 'object') root.pluginData = {};
      return root.pluginData;
    }

    function ensurePluginState(pluginId = '', source = data) {
      const key = String(pluginId || '').trim();
      if (!key) return null;
      const pluginData = ensurePluginDataShape(source);
      if (!pluginData[key] || typeof pluginData[key] !== 'object') {
        pluginData[key] = {
          version: 1,
          state: {},
          meta: { updatedAt: '' },
        };
      }
      return pluginData[key];
    }

    function getExtensionPrivateState(extensionId = '', source = data) {
      const entry = ensurePluginState(extensionId, source);
      return entry?.state && typeof entry.state === 'object' ? entry.state : {};
    }

    function touchExtensionPrivateState(extensionId = '', source = data) {
      const entry = ensurePluginState(extensionId, source);
      if (!entry) return null;
      entry.meta.updatedAt = new Date().toISOString();
      return entry;
    }

    function setExtensionPrivateState(extensionId = '', updater = null, options = {}) {
      const root = api.getData ? api.getData() : null;
      const entry = ensurePluginState(extensionId, root);
      if (!entry) return null;
      const prevState = entry.state && typeof entry.state === 'object' ? entry.state : {};
      let nextState = prevState;
      if (typeof updater === 'function') {
        const seed = typeof structuredClone === 'function'
          ? structuredClone(prevState)
          : JSON.parse(JSON.stringify(prevState || {}));
        const computed = updater(seed);
        if (computed && typeof computed === 'object') nextState = computed;
      } else if (updater && typeof updater === 'object') {
        nextState = updater;
      }
      entry.state = nextState && typeof nextState === 'object' ? nextState : {};
      touchExtensionPrivateState(extensionId, root);
      if (options?.save !== false && typeof api.saveData === 'function') {
        api.saveData({
          skipRender: options?.skipRender === true,
          skipUndo: options?.skipUndo === true,
        });
      }
      return entry.state;
    }

    const VISUAL_ORGANIZER_PLUGIN_ID = 'visual-organizer-plugin';
    const VISUAL_ORGANIZER_TEMPLATE_OPTIONS = [
      'auto',
      'big-question-map',
      'compare-map',
      'concept-definition-map',
      'hierarchy-diagram',
      'kwhl-chart',
      'main-concepts-map',
      'circle-organizer',
      'problem-solving-organizer',
    ];

    function normalizeVisualOrganizerTemplateKey(value = '') {
      const raw = String(value || '').trim().toLowerCase();
      const aliasMap = {
        'auto': 'auto',
        'visual-organizer': 'auto',
        'graphic-organizer': 'auto',
        'big-question': 'big-question-map',
        'big-question-map': 'big-question-map',
        'question-map': 'big-question-map',
        'compare': 'compare-map',
        'compare-map': 'compare-map',
        'comparison-map': 'compare-map',
        'concept-definition': 'concept-definition-map',
        'concept-definition-map': 'concept-definition-map',
        'definition-map': 'concept-definition-map',
        'hierarchy': 'hierarchy-diagram',
        'hierarchy-diagram': 'hierarchy-diagram',
        'kwhl': 'kwhl-chart',
        'k-w-h-l': 'kwhl-chart',
        'k-w-h-l-chart': 'kwhl-chart',
        'main-concepts': 'main-concepts-map',
        'main-concepts-map': 'main-concepts-map',
        'concept-map': 'main-concepts-map',
        'circle': 'circle-organizer',
        'circle-organizer': 'circle-organizer',
        'cycle': 'circle-organizer',
        'problem-solving': 'problem-solving-organizer',
        'problem-solving-organizer': 'problem-solving-organizer',
        'problem-solution': 'problem-solving-organizer',
      };
      return aliasMap[raw] || (VISUAL_ORGANIZER_TEMPLATE_OPTIONS.includes(raw) ? raw : 'auto');
    }

    function sanitizeVisualOrganizerText(value = '', maxLength = 240) {
      return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    }

    function sanitizeVisualOrganizerList(raw = [], maxItems = 10, maxLength = 120) {
      return (Array.isArray(raw) ? raw : [])
        .map((item) => sanitizeVisualOrganizerText(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems);
    }

    function sanitizeVisualOrganizerNodes(raw = []) {
      return (Array.isArray(raw) ? raw : [])
        .map((item, index) => {
          const src = item && typeof item === 'object' ? item : {};
          const label = sanitizeVisualOrganizerText(src.label || src.title || src.name || src.text || '', 80);
          if (!label) return null;
          return {
            id: sanitizeVisualOrganizerText(src.id || '', 48) || `node-${index + 1}`,
            label,
            detail: sanitizeVisualOrganizerText(src.detail || src.description || src.note || '', 180),
            group: sanitizeVisualOrganizerText(src.group || src.side || src.bucket || '', 32),
            tier: Number.isFinite(Number(src.tier)) ? Math.max(0, Math.min(6, Number(src.tier))) : 1,
            order: Number.isFinite(Number(src.order)) ? Number(src.order) : index,
            emphasis: src.emphasis === true,
            x: Number.isFinite(Number(src.x)) ? Math.max(0, Math.min(1, Number(src.x))) : null,
            y: Number.isFinite(Number(src.y)) ? Math.max(0, Math.min(1, Number(src.y))) : null,
            pinned: src.pinned === true,
          };
        })
        .filter(Boolean)
        .slice(0, 18);
    }

    function sanitizeVisualOrganizerEdges(raw = [], nodes = []) {
      const nodeIds = new Set((Array.isArray(nodes) ? nodes : []).map((item) => String(item?.id || '').trim()).filter(Boolean));
      return (Array.isArray(raw) ? raw : [])
        .map((item) => {
          const src = item && typeof item === 'object' ? item : {};
          const from = sanitizeVisualOrganizerText(src.from || src.source || '', 48);
          const to = sanitizeVisualOrganizerText(src.to || src.target || '', 48);
          if (!from || !to) return null;
          if (nodeIds.size && (!nodeIds.has(from) || !nodeIds.has(to))) return null;
          return {
            from,
            to,
            label: sanitizeVisualOrganizerText(src.label || src.text || '', 60),
          };
        })
        .filter(Boolean)
        .slice(0, 24);
    }

    function sanitizeVisualOrganizerSections(raw = []) {
      return (Array.isArray(raw) ? raw : [])
        .map((item) => {
          const src = item && typeof item === 'object' ? item : {};
          const title = sanitizeVisualOrganizerText(src.title || src.label || src.name || '', 72);
          const items = (Array.isArray(src.items || src.points || src.bullets || []) ? (src.items || src.points || src.bullets || []) : [])
            .map((entry) => {
              if (entry == null) return null;
              const normalized = sanitizeVisualOrganizerText(entry, 100);
              if (normalized) return normalized;
              return typeof entry === 'string' ? '' : null;
            })
            .filter((entry) => entry !== null)
            .slice(0, 8);
          if (!title && !items.length) return null;
          return {
            title: title || '要点',
            items,
          };
        })
        .filter(Boolean)
        .slice(0, 8);
    }

    function sanitizeVisualOrganizerViewportState(raw = null) {
      const src = raw && typeof raw === 'object' ? raw : {};
      const scale = Number(src.scale);
      const panX = Number(src.panX);
      const panY = Number(src.panY);
      return {
        scale: Number.isFinite(scale) ? Math.max(0.01, Math.min(2.2, scale)) : 1,
        panX: Number.isFinite(panX) ? panX : 0,
        panY: Number.isFinite(panY) ? panY : 0,
        userAdjusted: src.userAdjusted === true,
      };
    }

    function sanitizeVisualOrganizerViewportStates(raw = null) {
      const src = raw && typeof raw === 'object' ? raw : {};
      const next = {};
      Object.keys(src).forEach((key) => {
        const normalizedKey = normalizeVisualOrganizerTemplateKey(key);
        if (!normalizedKey || normalizedKey === 'auto') return;
        next[normalizedKey] = sanitizeVisualOrganizerViewportState(src[key]);
      });
      return next;
    }

    function sanitizeVisualOrganizerLearningSteps(raw = []) {
      return (Array.isArray(raw) ? raw : [])
        .map((item) => {
          const src = item && typeof item === 'object' ? item : {};
          const title = sanitizeVisualOrganizerText(src.title || src.step || src.name || '', 72);
          const instruction = sanitizeVisualOrganizerText(src.instruction || src.goal || src.prompt || src.content || '', 180);
          if (!title && !instruction) return null;
          return {
            title: title || '学习步骤',
            instruction,
            question: sanitizeVisualOrganizerText(src.question || src.check || '', 120),
          };
        })
        .filter(Boolean)
        .slice(0, 8);
    }

    function sanitizeVisualOrganizerPresentation(raw = []) {
      return (Array.isArray(raw) ? raw : [])
        .map((item) => {
          const src = item && typeof item === 'object' ? item : {};
          const title = sanitizeVisualOrganizerText(src.title || src.stage || src.label || '', 72);
          const content = sanitizeVisualOrganizerText(src.content || src.summary || src.script || src.text || '', 220);
          if (!title && !content) return null;
          return {
            title: title || '呈现',
            content,
          };
        })
        .filter(Boolean)
        .slice(0, 8);
    }

    function inferVisualOrganizerTemplateFromText(text = '') {
      const content = String(text || '').toLowerCase();
      if (!content) return 'auto';
      if (/(k[\s-]*w[\s-]*h[\s-]*l|知道什么|想知道什么|如何学习|学到了什么)/i.test(content)) return 'kwhl-chart';
      if (/(对比|比较|异同|区别|共同点|不同点|versus|vs\b)/i.test(content)) return 'compare-map';
      if (/(定义|概念|是什么|特征|例子|非例子)/i.test(content)) return 'concept-definition-map';
      if (/(层级|架构|组织结构|分类树|hierarchy)/i.test(content)) return 'hierarchy-diagram';
      if (/(流程|步骤|循环|周期|先后|sequence|timeline)/i.test(content)) return 'circle-organizer';
      if (/(问题|难点|解决|方案|改进|problem)/i.test(content)) return 'problem-solving-organizer';
      if (/(核心概念|主题|分支|知识图|脑图|主概念)/i.test(content)) return 'main-concepts-map';
      if (/(大问题|关键问题|为什么|怎么判断|big question)/i.test(content)) return 'big-question-map';
      return 'auto';
    }

    function sanitizeMermaidLabelText(value = '', maxLength = 80) {
      return sanitizeVisualOrganizerText(value, maxLength)
        .replace(/"/g, "'")
        .replace(/[()[\]{}<>]/g, ' ')
        .replace(/\|/g, '/')
        .replace(/#/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function sanitizeVisualOrganizerMermaidSource(value = '', maxLength = 12000) {
      return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/^\s+|\s+$/g, '')
        .slice(0, maxLength);
    }

    function cloneVisualOrganizerJsonValue(value = null, fallback = null) {
      if (value == null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_) {
        return fallback;
      }
    }

    function sanitizeVisualOrganizerExcalidrawScene(raw = null) {
      const src = raw && typeof raw === 'object' ? raw : null;
      if (!src) return null;
      const elements = cloneVisualOrganizerJsonValue(Array.isArray(src.elements) ? src.elements : [], [])
        .filter((item) => item && typeof item === 'object')
        .slice(0, 4000);
      if (!elements.length) return null;
      return {
        type: 'excalidraw',
        version: Number(src.version || 2) || 2,
        source: sanitizeVisualOrganizerText(src.source || 'morph-visual-organizer', 48) || 'morph-visual-organizer',
        elements,
        appState: cloneVisualOrganizerJsonValue(src.appState && typeof src.appState === 'object' ? src.appState : {}, {}) || {},
        files: cloneVisualOrganizerJsonValue(src.files && typeof src.files === 'object' ? src.files : {}, {}) || {},
      };
    }

    function buildVisualOrganizerMermaidMindmap(title = '', sections = []) {
      const lines = ['mindmap', `  root((${sanitizeMermaidLabelText(title || '视觉组织图', 60)}))`];
      (Array.isArray(sections) ? sections : []).slice(0, 6).forEach((section) => {
        const sectionTitle = sanitizeMermaidLabelText(section?.title || '要点', 40) || '要点';
        lines.push(`    ${sectionTitle}`);
        (Array.isArray(section?.items) ? section.items : []).slice(0, 6).forEach((item) => {
          const safeItem = sanitizeMermaidLabelText(item, 40);
          if (!safeItem) return;
          lines.push(`      ${safeItem}`);
        });
      });
      return lines.join('\n');
    }

    function buildVisualOrganizerMermaidFlowchart(title = '', sections = [], options = {}) {
      const cfg = options && typeof options === 'object' ? options : {};
      const direction = String(cfg.direction || 'TD').trim() || 'TD';
      const lines = [`flowchart ${direction}`];
      const rootId = 'root';
      lines.push(`  ${rootId}["${sanitizeMermaidLabelText(title || '视觉组织图', 60)}"]`);
      (Array.isArray(sections) ? sections : []).slice(0, 6).forEach((section, sectionIndex) => {
        const sectionId = `s${sectionIndex + 1}`;
        const sectionTitle = sanitizeMermaidLabelText(section?.title || `板块 ${sectionIndex + 1}`, 36) || `板块 ${sectionIndex + 1}`;
        lines.push(`  ${rootId} --> ${sectionId}["${sectionTitle}"]`);
        (Array.isArray(section?.items) ? section.items : []).slice(0, 6).forEach((item, itemIndex) => {
          const itemId = `${sectionId}_${itemIndex + 1}`;
          const safeItem = sanitizeMermaidLabelText(item, 48);
          if (!safeItem) return;
          lines.push(`  ${sectionId} --> ${itemId}["${safeItem}"]`);
        });
      });
      return lines.join('\n');
    }

    function buildVisualOrganizerMermaidSource(raw = null, options = {}) {
      const src = raw && typeof raw === 'object' ? raw : {};
      const templateKey = normalizeVisualOrganizerTemplateKey(src.templateKey || src.organizerType || options.templateKey || inferVisualOrganizerTemplateFromText(src.title || src.prompt || ''));
      const title = sanitizeMermaidLabelText(src.centralTopic || src.title || options.title || '视觉组织图', 60) || '视觉组织图';
      const sections = sanitizeVisualOrganizerSections(src.sections || src.contentSections || [])
        .slice(0, 6);
      const fallbackSections = sections.length
        ? sections
        : sanitizeVisualOrganizerNodes(src.nodes || src.points || [])
          .slice(0, 10)
          .reduce((acc, item) => {
            const group = sanitizeVisualOrganizerText(item?.group || '', 32) || '要点';
            let target = acc.find((entry) => entry.title === group);
            if (!target) {
              target = { title: group, items: [] };
              acc.push(target);
            }
            if (item?.label) target.items.push(item.label);
            return acc;
          }, []);
      if (templateKey === 'main-concepts-map') {
        return buildVisualOrganizerMermaidMindmap(title, fallbackSections);
      }
      if (templateKey === 'compare-map') {
        const compareSections = fallbackSections.length
          ? fallbackSections
          : [
              { title: '左侧', items: [] },
              { title: '右侧', items: [] },
              { title: '共同点', items: [] },
            ];
        return buildVisualOrganizerMermaidFlowchart(title, compareSections, { direction: 'LR' });
      }
      if (templateKey === 'kwhl-chart') {
        const named = fallbackSections.length
          ? fallbackSections
          : [
              { title: 'K 已知道', items: [] },
              { title: 'W 想知道', items: [] },
              { title: 'H 学到了', items: [] },
              { title: 'L 继续想学', items: [] },
            ];
        return buildVisualOrganizerMermaidFlowchart(title, named, { direction: 'LR' });
      }
      if (templateKey === 'hierarchy-diagram' || templateKey === 'circle-organizer' || templateKey === 'problem-solving-organizer' || templateKey === 'big-question-map' || templateKey === 'concept-definition-map') {
        return buildVisualOrganizerMermaidFlowchart(title, fallbackSections, { direction: 'LR' });
      }
      return buildVisualOrganizerMermaidFlowchart(title, fallbackSections, { direction: 'TD' });
    }

    function normalizeVisualOrganizerDraft(raw = null, options = {}) {
      const src = raw && typeof raw === 'object' ? raw : {};
      const now = new Date().toISOString();
      const prompt = sanitizeVisualOrganizerText(src.prompt || options.prompt || '', 500);
      const templateKey = normalizeVisualOrganizerTemplateKey(
        src.templateKey
        || src.organizerType
        || options.templateKey
        || inferVisualOrganizerTemplateFromText(`${prompt} ${src.title || ''} ${src.summary || ''}`)
      );
      const sections = sanitizeVisualOrganizerSections(src.sections || src.contentSections || src.panels || []);
      const nodes = sanitizeVisualOrganizerNodes(src.nodes || src.points || []);
      const finalNodes = nodes.length
        ? nodes
        : sections.flatMap((section, sectionIndex) => {
          const sectionId = `section-${sectionIndex + 1}`;
          const head = {
            id: sectionId,
            label: section.title,
            detail: '',
            group: '',
            tier: 1,
            order: sectionIndex * 10,
            emphasis: sectionIndex === 0,
          };
          const children = section.items.map((item, itemIndex) => ({
            id: `${sectionId}-item-${itemIndex + 1}`,
            label: item,
            detail: '',
            group: section.title,
            tier: 2,
            order: sectionIndex * 10 + itemIndex + 1,
            emphasis: false,
          }));
          return [head].concat(children);
        }).slice(0, 18);
      const edges = sanitizeVisualOrganizerEdges(src.edges || src.links || [], finalNodes);
      const title = sanitizeVisualOrganizerText(src.title || src.topic || src.subject || src.centralTopic || options.title || '', 80)
        || sanitizeVisualOrganizerText(prompt, 80)
        || '未命名视觉组织图';
      const resolvedTemplateKey = templateKey === 'auto' ? inferVisualOrganizerTemplateFromText(`${title} ${prompt}`) : templateKey;
      const mermaidSource = sanitizeVisualOrganizerMermaidSource(src.mermaidSource || src.mermaid || '');
      return {
        id: sanitizeVisualOrganizerText(src.id || options.id || '', 48) || (typeof api.genId === 'function' ? api.genId() : `vo_${Date.now()}`),
        projectId: sanitizeVisualOrganizerText(src.projectId || options.projectId || '', 64),
        title,
        templateKey: resolvedTemplateKey,
        summary: sanitizeVisualOrganizerText(src.summary || src.description || '', 180),
        prompt,
        centralTopic: sanitizeVisualOrganizerText(src.centralTopic || src.topic || title, 80) || title,
        focusQuestion: sanitizeVisualOrganizerText(src.focusQuestion || src.bigQuestion || '', 120),
        nodes: finalNodes,
        edges,
        sections,
        viewportStates: sanitizeVisualOrganizerViewportStates(src.viewportStates || src.viewStates || src.viewports || {}),
        learningSteps: sanitizeVisualOrganizerLearningSteps(src.learningSteps || src.steps || src.guidedSteps || []),
        presentation: sanitizeVisualOrganizerPresentation(src.presentation || src.presentationSteps || src.presentScript || []),
        mermaidSource: mermaidSource || buildVisualOrganizerMermaidSource({
          title,
          centralTopic: src.centralTopic || title,
          templateKey: resolvedTemplateKey,
          sections,
          nodes: finalNodes,
          prompt,
        }),
        excalidrawScene: sanitizeVisualOrganizerExcalidrawScene(src.excalidrawScene || src.canvasScene || src.scene || null),
        tags: sanitizeVisualOrganizerList(src.tags || [], 6, 24),
        source: sanitizeVisualOrganizerText(src.source || options.source || 'visual-organizer', 32) || 'visual-organizer',
        createdAt: sanitizeVisualOrganizerText(src.createdAt || options.createdAt || now, 48) || now,
        updatedAt: sanitizeVisualOrganizerText(src.updatedAt || options.updatedAt || now, 48) || now,
      };
    }

    function sanitizeVisualOrganizerPluginStateRaw(raw = null) {
      const src = raw && typeof raw === 'object' ? raw : {};
      const organizers = (Array.isArray(src.organizers) ? src.organizers : [])
        .map((item) => normalizeVisualOrganizerDraft(item))
        .filter(Boolean)
        .slice(0, 24)
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      const fallbackActiveId = organizers[0]?.id || '';
      const activeOrganizerId = sanitizeVisualOrganizerText(src.activeOrganizerId || fallbackActiveId, 48) || fallbackActiveId;
      return {
        version: 1,
        selectedTemplate: normalizeVisualOrganizerTemplateKey(src.selectedTemplate || inferVisualOrganizerTemplateFromText(src.draftPrompt || '')),
        draftPrompt: String(src.draftPrompt || ''),
        activeOrganizerId: organizers.some((item) => item.id === activeOrganizerId) ? activeOrganizerId : fallbackActiveId,
        organizers,
      };
    }

    function getVisualOrganizerPluginState(source = api.getData ? api.getData() : null) {
      const raw = getExtensionPrivateState(VISUAL_ORGANIZER_PLUGIN_ID, source);
      return sanitizeVisualOrganizerPluginStateRaw(raw);
    }

    function setVisualOrganizerPluginState(updater = null, options = {}) {
      return setExtensionPrivateState(VISUAL_ORGANIZER_PLUGIN_ID, (prevState) => {
        const base = sanitizeVisualOrganizerPluginStateRaw(prevState);
        const next = typeof updater === 'function' ? updater(base) : updater;
        return sanitizeVisualOrganizerPluginStateRaw(next && typeof next === 'object' ? next : base);
      }, options);
    }

    function upsertVisualOrganizerDraft(rawDraft = null, options = {}) {
      let organizer = null;
      setVisualOrganizerPluginState((prev) => {
        organizer = normalizeVisualOrganizerDraft(rawDraft, options);
        const remaining = prev.organizers.filter((item) => item.id !== organizer.id);
        return {
          ...prev,
          selectedTemplate: normalizeVisualOrganizerTemplateKey(options.templateKey || organizer.templateKey || prev.selectedTemplate),
          draftPrompt: String(options.prompt || organizer.prompt || prev.draftPrompt || ''),
          activeOrganizerId: organizer.id,
          organizers: [organizer].concat(remaining).slice(0, 24),
        };
      }, options);
      return organizer;
    }

    async function generateVisualOrganizerDraftWithAI(command = '', options = {}) {
      const promptQuestion = String(command || '').trim();
      if (!promptQuestion) {
        return { ok: false, message: '请先输入你想做的视觉组织图口令。' };
      }
      if (!(typeof api.getCurrentAIKey === 'function' && api.getCurrentAIKey())) {
        return { ok: false, message: '请先在设置里配置 AI Key，再生成视觉组织图。' };
      }
      const preferredTemplate = normalizeVisualOrganizerTemplateKey(options.templateKey || inferVisualOrganizerTemplateFromText(promptQuestion));
      const prompt = [
        '你是一个视觉组织图学习设计助手。',
        '你的任务是把用户的一句口令改写成适合学习和讲解的视觉组织图结构。',
        '只返回 JSON 对象，不要解释，不要 markdown。',
        'organizerType 只能是：big-question-map, compare-map, concept-definition-map, hierarchy-diagram, kwhl-chart, main-concepts-map, circle-organizer, problem-solving-organizer。',
        'JSON 结构必须包含：title, organizerType, summary, centralTopic, focusQuestion, nodes, edges, sections, learningSteps, presentation。',
        'nodes 里的每一项包含：id, label, detail, group, tier, order。',
        'edges 里的每一项包含：from, to, label。',
        'sections 里的每一项包含：title, items。',
        'learningSteps 里的每一项包含：title, instruction, question。',
        'presentation 里的每一项包含：title, content。',
        '要求：',
        '1. 内容适合直接做成学习型视觉图，不要空泛。',
        '2. 结构尽量清晰，节点不超过 12 个，section 不超过 6 组。',
        '3. 如果用户没指定模板，请自动选择最适合的组织图类型。',
        '4. 如果用户在学一个主题，要把“看图顺序”和“学习顺序”拆开。',
        '',
        `优先模板：${preferredTemplate}`,
        `用户口令：${promptQuestion}`,
      ].join('\n');
      const requestAIText = typeof api.requestAIText === 'function'
        ? api.requestAIText
        : async () => '';
      const raw = await requestAIText(prompt, { stream: false });
      let parsed = typeof api.extractJsonBlockFromAIText === 'function'
        ? api.extractJsonBlockFromAIText(raw)
        : null;
      if (!parsed) {
        const repairPrompt = [
          '把下面这段模型输出修复为一个合法 JSON 对象。',
          '不要解释，不要 markdown，不要 ```，只返回 JSON 对象本身。',
          '如果原文里已经有视觉组织图字段，就保留原意并补成合法 JSON。',
          '必须包含：title, organizerType, summary, centralTopic, focusQuestion, nodes, edges, sections, learningSteps, presentation。',
          '',
          raw,
        ].join('\n');
        const repairedRaw = await requestAIText(repairPrompt, { stream: false });
        parsed = typeof api.extractJsonBlockFromAIText === 'function'
          ? api.extractJsonBlockFromAIText(repairedRaw)
          : null;
      }
      const parsedRoot = Array.isArray(parsed) ? parsed[0] : parsed;
      const payload = Array.isArray(parsedRoot?.actions)
        ? parsedRoot.actions.find((item) => String(item?.type || '').trim() === 'create_visual_organizer') || parsedRoot.actions[0]
        : parsedRoot;
      if (!payload || typeof payload !== 'object') {
        return { ok: false, message: 'AI 没有返回可解析的视觉组织图结构。' };
      }
      const organizer = upsertVisualOrganizerDraft({
        ...payload,
        prompt: promptQuestion,
        source: 'visual-organizer-workspace',
      }, {
        templateKey: preferredTemplate,
        prompt: promptQuestion,
        save: options.save !== false,
        skipRender: options.skipRender === true,
      });
      if (typeof api.setExtensionEnabled === 'function') {
        api.setExtensionEnabled(VISUAL_ORGANIZER_PLUGIN_ID, true, { silent: true });
      }
      return { ok: true, organizer };
    }

    return {
      ensurePluginState,
      getExtensionPrivateState,
      touchExtensionPrivateState,
      setExtensionPrivateState,
      normalizeVisualOrganizerTemplateKey,
      sanitizeVisualOrganizerText,
      sanitizeVisualOrganizerList,
      sanitizeVisualOrganizerNodes,
      sanitizeVisualOrganizerEdges,
      sanitizeVisualOrganizerSections,
      sanitizeVisualOrganizerLearningSteps,
      sanitizeVisualOrganizerPresentation,
      inferVisualOrganizerTemplateFromText,
      sanitizeMermaidLabelText,
      sanitizeVisualOrganizerMermaidSource,
      cloneVisualOrganizerJsonValue,
      sanitizeVisualOrganizerExcalidrawScene,
      buildVisualOrganizerMermaidMindmap,
      buildVisualOrganizerMermaidFlowchart,
      buildVisualOrganizerMermaidSource,
      normalizeVisualOrganizerDraft,
      sanitizeVisualOrganizerPluginStateRaw,
      getVisualOrganizerPluginState,
      setVisualOrganizerPluginState,
      upsertVisualOrganizerDraft,
      generateVisualOrganizerDraftWithAI,
    };
  }

  window.MorphVisualOrganizerRuntime = {
    create: createVisualOrganizerRuntime,
  };
})();
