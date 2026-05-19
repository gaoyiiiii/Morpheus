(function initMorphLegacyWritingData() {
    function parseWritingStudioFrontmatter(text = '') {
        const src = String(text || '');
        if (!src.startsWith('---\n')) return {};
        const end = src.indexOf('\n---\n', 4);
        if (end === -1) return {};
        const fields = {};
        src.slice(4, end).split('\n').forEach((line) => {
            const idx = line.indexOf(':');
            if (idx === -1) return;
            const key = String(line.slice(0, idx) || '').trim();
            const value = String(line.slice(idx + 1) || '').trim();
            if (!key) return;
            fields[key] = value;
        });
        return fields;
    }

    function summarizeWritingStudioCategoryName(category = '') {
        const key = String(category || '').trim();
        if (key === 'approved-scripts') return '成稿';
        if (key === 'drafts') return '草稿';
        if (key === 'revision-notes') return '改稿说明';
        if (key === 'research-notes') return '研究资料';
        return key || '未分类';
    }

    window.MorphLegacyWritingData = {
        create(deps = {}) {
            const genId = typeof deps.genId === 'function' ? deps.genId : () => `legacy-${Date.now()}`;
            const getData = typeof deps.getData === 'function' ? deps.getData : () => ({});

            function buildDefaultWritingStudioState() {
                return {
                    corpus: [],
                    projectLearnings: [],
                    feedbackSignals: [],
                    styleFingerprint: '',
                    topicBacklog: '',
                    trainingBrief: '',
                    index: {
                        generatedAt: '',
                        totalFiles: 0,
                        totalProjectLearnings: 0,
                        categories: [],
                    },
                    runtimePrompt: '',
                    runtimePromptUpdatedAt: '',
                };
            }

            function sanitizeWritingStudioCorpusItem(raw, categoryFallback = 'approved-scripts') {
                const src = raw && typeof raw === 'object' ? raw : {};
                const text = String(src.text || '').replace(/\r\n/g, '\n');
                const frontmatter = parseWritingStudioFrontmatter(text);
                const name = String(src.name || 'untitled.txt').trim() || 'untitled.txt';
                const ext = String(src.ext || '').trim() || ((name.match(/\.[^.]+$/) || [])[0] || '');
                return {
                    id: String(src.id || genId()),
                    name: name.slice(0, 160),
                    category: String(src.category || categoryFallback || 'approved-scripts').trim() || 'approved-scripts',
                    ext: ext.slice(0, 20),
                    text,
                    size: Number.isFinite(Number(src.size)) ? Number(src.size) : text.length,
                    uploadedAt: String(src.uploadedAt || new Date().toISOString()),
                    updatedAt: String(src.updatedAt || new Date().toISOString()),
                    title: String(src.title || frontmatter.title || name.replace(/\.[^.]+$/, '')).trim().slice(0, 200),
                    status: String(src.status || frontmatter.status || '').trim().slice(0, 80),
                    topic: String(src.topic || frontmatter.topic || '').trim().slice(0, 120),
                    audience: String(src.audience || frontmatter.audience || '').trim().slice(0, 120),
                    sourceProjectId: String(src.sourceProjectId || '').trim().slice(0, 80),
                    sourceKind: String(src.sourceKind || '').trim().slice(0, 40),
                };
            }

            function sanitizeWritingStudioProjectLearning(raw) {
                const src = raw && typeof raw === 'object' ? raw : {};
                return {
                    id: String(src.id || genId()),
                    projectId: String(src.projectId || '').trim().slice(0, 80),
                    projectName: String(src.projectName || '').trim().slice(0, 160),
                    topic: String(src.topic || '').trim().slice(0, 160),
                    titleCandidates: String(src.titleCandidates || '').trim().slice(0, 800),
                    outline: String(src.outline || '').trim().slice(0, 1600),
                    draftExcerpt: String(src.draftExcerpt || '').trim().slice(0, 2200),
                    revisionNotes: String(src.revisionNotes || '').trim().slice(0, 1600),
                    acceptedTitle: String(src.acceptedTitle || '').trim().slice(0, 320),
                    acceptedOutline: String(src.acceptedOutline || '').trim().slice(0, 800),
                    acceptedDraftExcerpt: String(src.acceptedDraftExcerpt || '').trim().slice(0, 1200),
                    updatedAt: String(src.updatedAt || new Date().toISOString()),
                };
            }

            function sanitizeWritingStudioFeedbackSignal(raw) {
                const src = raw && typeof raw === 'object' ? raw : {};
                return {
                    id: String(src.id || genId()),
                    projectId: String(src.projectId || '').trim().slice(0, 80),
                    projectName: String(src.projectName || '').trim().slice(0, 160),
                    type: String(src.type || 'note').trim().slice(0, 40),
                    label: String(src.label || '').trim().slice(0, 60),
                    snippet: String(src.snippet || '').trim().slice(0, 320),
                    section: String(src.section || '').trim().slice(0, 40),
                    createdAt: String(src.createdAt || new Date().toISOString()),
                };
            }

            function ensureWritingStudioShape(target) {
                if (!target || typeof target !== 'object') return target;
                const base = buildDefaultWritingStudioState();
                const raw = target.writingStudio && typeof target.writingStudio === 'object' ? target.writingStudio : {};
                target.writingStudio = {
                    corpus: Array.isArray(raw.corpus)
                        ? raw.corpus.map((item) => sanitizeWritingStudioCorpusItem(item, item?.category)).slice(0, 200)
                        : base.corpus,
                    projectLearnings: Array.isArray(raw.projectLearnings)
                        ? raw.projectLearnings.map((item) => sanitizeWritingStudioProjectLearning(item)).slice(0, 40)
                        : base.projectLearnings,
                    feedbackSignals: Array.isArray(raw.feedbackSignals)
                        ? raw.feedbackSignals.map((item) => sanitizeWritingStudioFeedbackSignal(item)).slice(0, 120)
                        : base.feedbackSignals,
                    styleFingerprint: typeof raw.styleFingerprint === 'string' ? raw.styleFingerprint : base.styleFingerprint,
                    topicBacklog: typeof raw.topicBacklog === 'string' ? raw.topicBacklog : base.topicBacklog,
                    trainingBrief: typeof raw.trainingBrief === 'string' ? raw.trainingBrief : base.trainingBrief,
                    index: raw.index && typeof raw.index === 'object'
                        ? {
                            generatedAt: typeof raw.index.generatedAt === 'string' ? raw.index.generatedAt : '',
                            totalFiles: Number.isFinite(Number(raw.index.totalFiles)) ? Number(raw.index.totalFiles) : 0,
                            totalProjectLearnings: Number.isFinite(Number(raw.index.totalProjectLearnings)) ? Number(raw.index.totalProjectLearnings) : 0,
                            categories: Array.isArray(raw.index.categories) ? raw.index.categories : [],
                        }
                        : base.index,
                    runtimePrompt: typeof raw.runtimePrompt === 'string' ? raw.runtimePrompt : base.runtimePrompt,
                    runtimePromptUpdatedAt: typeof raw.runtimePromptUpdatedAt === 'string' ? raw.runtimePromptUpdatedAt : base.runtimePromptUpdatedAt,
                };
                return target;
            }

            function getWritingStudio() {
                return ensureWritingStudioShape(getData()).writingStudio;
            }

            function buildWritingStudioIndex() {
                const studio = getWritingStudio();
                const corpus = Array.isArray(studio.corpus) ? studio.corpus : [];
                const projectLearnings = Array.isArray(studio.projectLearnings) ? studio.projectLearnings : [];
                const feedbackSignals = Array.isArray(studio.feedbackSignals) ? studio.feedbackSignals : [];
                const categories = ['approved-scripts', 'drafts', 'revision-notes', 'research-notes'].map((name) => {
                    const files = corpus
                        .filter((item) => item.category === name)
                        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
                        .map((item) => ({
                            id: item.id,
                            name: item.name,
                            title: item.title,
                            status: item.status,
                            topic: item.topic,
                            audience: item.audience,
                            updatedAt: item.updatedAt,
                            size: item.size,
                        }));
                    return {
                        name,
                        label: summarizeWritingStudioCategoryName(name),
                        count: files.length,
                        files,
                    };
                });
                studio.index = {
                    generatedAt: new Date().toISOString(),
                    totalFiles: corpus.length,
                    totalProjectLearnings: projectLearnings.length,
                    totalFeedbackSignals: feedbackSignals.length,
                    categories,
                };
                return studio.index;
            }

            function buildWritingStudioRuntimePrompt() {
                const studio = getWritingStudio();
                const index = studio.index?.categories?.length ? studio.index : buildWritingStudioIndex();
                const approved = index.categories.find((item) => item.name === 'approved-scripts')?.files || [];
                const revisions = index.categories.find((item) => item.name === 'revision-notes')?.files || [];
                const research = index.categories.find((item) => item.name === 'research-notes')?.files || [];
                const projectLearnings = Array.isArray(studio.projectLearnings) ? studio.projectLearnings.slice(0, 4) : [];
                const feedbackSignals = Array.isArray(studio.feedbackSignals) ? studio.feedbackSignals.slice(0, 6) : [];
                return [
                    '以下是 legacy 写作资料，仅供兼容旧数据使用。',
                    '',
                    '请把自己当成用户的写作搭档，而不是通用文案模型。',
                    '每次写作任务默认先做两步：',
                    '1. 先根据已有语料判断这是不是用户会写、值得写、适合写的题。',
                    '2. 再决定给选题、大纲还是完整脚本，不要跳步骤硬写。',
                    '',
                    `当前语料：成稿 ${approved.length} 篇，改稿说明 ${revisions.length} 份，研究资料 ${research.length} 份，总文件 ${index.totalFiles || 0}。`,
                    projectLearnings.length ? `最近项目学习：${projectLearnings.map((item) => item.projectName || item.topic || '未命名项目').join('；')}` : '',
                    feedbackSignals.length ? `最近轻反馈：${feedbackSignals.map((item) => `${item.label}${item.snippet ? `(${item.snippet.slice(0, 18)})` : ''}`).join('；')}` : '',
                    approved.length ? `优先参考成稿标题：${approved.slice(0, 6).map((item) => item.title || item.name).join('；')}` : '当前还没有成稿语料，模仿强度要保守。',
                    revisions.length ? `改稿说明标题：${revisions.slice(0, 4).map((item) => item.title || item.name).join('；')}` : '',
                    projectLearnings.length ? `\n最近项目信号：\n${projectLearnings.map((item) => {
                        const parts = [
                            item.topic ? `主题：${item.topic}` : '',
                            item.titleCandidates ? `标题候选：${item.titleCandidates.split('\n').filter(Boolean).slice(0, 3).join(' / ')}` : '',
                            item.outline ? `大纲：${item.outline.split('\n').filter(Boolean).slice(0, 4).join(' / ')}` : '',
                            item.revisionNotes ? `改稿：${item.revisionNotes.split('\n').filter(Boolean).slice(0, 2).join(' / ')}` : '',
                        ].filter(Boolean).join('；');
                        return `- ${item.projectName || '未命名项目'}：${parts}`;
                    }).join('\n')}` : '',
                    studio.styleFingerprint ? `\n已确认的文风规则：\n${String(studio.styleFingerprint).trim()}` : '',
                    studio.topicBacklog ? `\n题库与边界：\n${String(studio.topicBacklog).trim()}` : '',
                    studio.trainingBrief ? `\n本轮训练要求：\n${String(studio.trainingBrief).trim()}` : '',
                    '',
                    '模仿时优先模仿：判断方式、叙述节奏、展开顺序、结尾姿态。',
                    '不要只复用旧短句，不要写得像泛化短视频脚本。',
                ].filter(Boolean).join('\n');
            }

            function extractWritingProjectHeadingKey(text = '') {
                const value = String(text || '').trim();
                if (!value) return '';
                if (/写作任务定义|选题判断/.test(value)) return 'brief';
                if (/标题候选|标题方向/.test(value)) return 'titles';
                if (/脚本大纲|结构大纲|大纲/.test(value)) return 'outline';
                if (/脚本正文|正文|初稿/.test(value)) return 'draft';
                if (/改稿记录|修改记录|反馈记录/.test(value)) return 'revision';
                return '';
            }

            function collectWritingProjectSectionTexts(project) {
                const sections = { brief: [], titles: [], outline: [], draft: [], revision: [] };
                const blocks = Array.isArray(project?.blocks) ? project.blocks : [];
                let currentKey = '';
                blocks.forEach((block) => {
                    const type = String(block?.type || 'p').toLowerCase();
                    const content = String(block?.content || '').replace(/\s+\n/g, '\n').trim();
                    if (!content) return;
                    if (['h1', 'h2', 'h3'].includes(type)) {
                        currentKey = extractWritingProjectHeadingKey(content);
                        return;
                    }
                    if (!currentKey || !sections[currentKey]) return;
                    sections[currentKey].push(content);
                });
                return sections;
            }

            function collectImplicitAcceptanceSignals(project, existingLearning = null, sections = null) {
                const learning = existingLearning && typeof existingLearning === 'object' ? existingLearning : {};
                const pickedSections = sections || collectWritingProjectSectionTexts(project);
                const signals = [];
                const titleCandidate = String((pickedSections.titles || []).find(Boolean) || '').trim();
                const outlineCandidate = String((pickedSections.outline || []).join('\n') || '').trim();
                const draftCandidate = String((pickedSections.draft || []).join('\n') || '').trim();

                if (titleCandidate && titleCandidate.length >= 8 && titleCandidate !== String(learning.acceptedTitle || '')) {
                    signals.push({ type: 'implicit_accept_title', label: '隐式采纳标题', section: 'titles', snippet: titleCandidate.slice(0, 320) });
                }
                const normalizedOutline = outlineCandidate
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .join('\n');
                if (
                    normalizedOutline
                    && normalizedOutline !== '开头 Hook\n中段展开\n结尾收束'
                    && normalizedOutline !== String(learning.acceptedOutline || '')
                ) {
                    signals.push({ type: 'implicit_accept_outline', label: '隐式采纳大纲', section: 'outline', snippet: normalizedOutline.slice(0, 320) });
                }
                if (draftCandidate && draftCandidate.length >= 24 && draftCandidate !== String(learning.acceptedDraftExcerpt || '')) {
                    signals.push({ type: 'implicit_accept_draft', label: '隐式采纳正文', section: 'draft', snippet: draftCandidate.slice(0, 320) });
                }
                return signals;
            }

            function appendUniqueLine(baseText = '', nextLine = '') {
                const line = String(nextLine || '').trim();
                if (!line) return String(baseText || '').trim();
                const lines = String(baseText || '').split('\n').map((item) => item.trim()).filter(Boolean);
                if (!lines.includes(line)) lines.push(line);
                return lines.join('\n');
            }

            function recordImplicitWritingSignals(project, learning, signals = []) {
                const studio = getWritingStudio();
                const list = Array.isArray(signals) ? signals : [];
                list.forEach((item) => {
                    const signal = sanitizeWritingStudioFeedbackSignal({
                        projectId: project.id,
                        projectName: project.name,
                        type: item.type,
                        label: item.label,
                        snippet: item.snippet,
                        section: item.section,
                        createdAt: new Date().toISOString(),
                    });
                    studio.feedbackSignals.unshift(signal);
                    if (item.type === 'implicit_accept_title') {
                        learning.acceptedTitle = signal.snippet;
                        studio.topicBacklog = appendUniqueLine(studio.topicBacklog, `- 已采纳标题：${signal.snippet}`);
                    } else if (item.type === 'implicit_accept_outline') {
                        learning.acceptedOutline = signal.snippet;
                        studio.trainingBrief = appendUniqueLine(studio.trainingBrief, `- 当前更稳定的大纲结构：${signal.snippet}`);
                    } else if (item.type === 'implicit_accept_draft') {
                        learning.acceptedDraftExcerpt = signal.snippet;
                        studio.styleFingerprint = appendUniqueLine(studio.styleFingerprint, `- 最近被保留的正文表达：${signal.snippet}`);
                    }
                });
                studio.feedbackSignals = studio.feedbackSignals.slice(0, 120);
            }

            function getProjectFeedbackButtonConfig() {
                return [
                    { type: 'like_me', label: '像我' },
                    { type: 'unlike_me', label: '不像我' },
                    { type: 'angle_stale', label: '角度太旧' },
                    { type: 'keep_structure_rewrite_tone', label: '保留结构，重写语气' },
                    { type: 'title_feels_right', label: '这个标题有感觉' },
                ];
            }

            function getWritingFeedbackSectionLabel(section = '') {
                const key = String(section || '').trim();
                if (key === 'titles') return '标题';
                if (key === 'outline') return '大纲';
                if (key === 'draft') return '正文';
                if (key === 'revision') return '改稿';
                if (key === 'brief') return '任务定义';
                return '项目';
            }

            function getActiveProjectFeedbackSnippet(projectId, selectionText = '', activeBlockId = '') {
                const project = Array.isArray(getData()?.projects) ? getData().projects.find((item) => item.id === projectId) : null;
                if (!project) return { snippet: '', section: '' };
                const normalizedSelection = String(selectionText || '').replace(/\s+/g, ' ').trim();
                if (normalizedSelection) {
                    const blocks = Array.isArray(project.blocks) ? project.blocks : [];
                    const idx = blocks.findIndex((item) => item.id === activeBlockId);
                    let section = '';
                    for (let i = idx; i >= 0; i -= 1) {
                        const block = blocks[i];
                        if (!block) continue;
                        if (['h1', 'h2', 'h3'].includes(String(block.type || '').toLowerCase())) {
                            section = extractWritingProjectHeadingKey(block.content);
                            if (section) break;
                        }
                    }
                    return { snippet: normalizedSelection.slice(0, 320), section };
                }
                const sections = collectWritingProjectSectionTexts(project);
                if (sections.titles[0]) return { snippet: sections.titles[0].slice(0, 320), section: 'titles' };
                if (sections.outline[0]) return { snippet: sections.outline[0].slice(0, 320), section: 'outline' };
                if (sections.draft[0]) return { snippet: sections.draft[0].slice(0, 320), section: 'draft' };
                return { snippet: project.name, section: 'brief' };
            }

            return {
                buildDefaultWritingStudioState,
                sanitizeWritingStudioCorpusItem,
                sanitizeWritingStudioProjectLearning,
                sanitizeWritingStudioFeedbackSignal,
                ensureWritingStudioShape,
                getWritingStudio,
                summarizeWritingStudioCategoryName,
                buildWritingStudioIndex,
                buildWritingStudioRuntimePrompt,
                extractWritingProjectHeadingKey,
                collectWritingProjectSectionTexts,
                collectImplicitAcceptanceSignals,
                recordImplicitWritingSignals,
                appendUniqueLine,
                getProjectFeedbackButtonConfig,
                getWritingFeedbackSectionLabel,
                getActiveProjectFeedbackSnippet,
            };
        },
    };
})();
