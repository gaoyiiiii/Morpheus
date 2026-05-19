(function initMorphLegacyWritingRuntime() {
    const DEFAULT_MIGRATION_MESSAGE = '写作能力已迁移到 Atlas / 自定义插件，核心设置页不再维护。';

    function showMigrationNotice(openCustomModal, {
        title = '写作能力已迁移',
        desc = '写作训练台和脚本打磨能力已从核心前台移除，后续建议通过 Atlas 或自定义插件方式接入。',
    } = {}) {
        if (typeof openCustomModal === 'function') {
            openCustomModal({
                title,
                desc,
                showCancel: false,
            });
        }
    }

    function buildWritingStudioMigrationMarkup() {
        return `
            <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5 overflow-hidden">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
                        <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
                    </button>
                    <div class="text-right">
                        <h2 class="text-sm font-medium text-black dark:text-white/90">写作能力已迁移</h2>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">核心设置页不再维护这套前台，建议改由 Atlas 或自定义插件承接。</p>
                    </div>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3 pr-1 pb-2">
                    <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-4">
                        <div class="text-xs font-medium text-black dark:text-white/90">当前状态</div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-6">
                            写作训练台、脚本打磨、上传学习这套核心前台流程已经下线。
                            现阶段建议把相关能力通过 Atlas 插件或后续自定义插件来承接。
                        </div>
                    </div>
                    <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-4">
                        <div class="text-xs font-medium text-black dark:text-white/90">建议迁移方式</div>
                        <div class="mt-2 space-y-2 text-[11px] text-gray-500 dark:text-gray-400 leading-6">
                            <div>1. 视频脚本、频道运营、素材吸收放到 Atlas 插件里。</div>
                            <div>2. 需要长期保留的数据，后面再从 writingStudio 结构迁到 Atlas 专属存储。</div>
                            <div>3. 如果以后重新开放，优先走“插件设置 + 插件入口”，不再回到核心设置页。</div>
                        </div>
                    </div>
                    <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-4">
                        <div class="text-xs font-medium text-black dark:text-white/90">说明</div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-6">
                            这次下线不会主动删除你已有的数据结构，只是不再从核心前台继续暴露和维护这套能力。
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    window.MorphLegacyWritingRuntime = {
        create(deps = {}) {
            const setMigrationStatus = (message = DEFAULT_MIGRATION_MESSAGE) => {
                const state = typeof deps.getSettingsState === 'function' ? deps.getSettingsState() : null;
                if (!state) return;
                state.writingStudioStatusMessage = message;
                state.writingStudioStatusError = false;
            };

            return {
                getMigrationMessage() {
                    return DEFAULT_MIGRATION_MESSAGE;
                },
                buildSettingsDetailMarkup() {
                    return buildWritingStudioMigrationMarkup();
                },
                openWritingStudioSettings() {
                    setMigrationStatus('写作训练台已从核心应用前台下线，后续建议作为 Atlas 或自定义插件能力接入。');
                    if (typeof deps.setSettingsDetailMode === 'function') deps.setSettingsDetailMode('writing-studio');
                    if (typeof deps.renderSettingsView === 'function') deps.renderSettingsView();
                },
                createAIWritingProject() {
                    showMigrationNotice(deps.openCustomModal, {
                        title: 'AI 写作项目已下线',
                    });
                    return null;
                },
                promptCreateAIWritingProject() {
                    showMigrationNotice(deps.openCustomModal, {
                        title: 'AI 写作项目已下线',
                    });
                },
                syncWritingProjectLearning() {
                    return;
                },
                saveWritingStudioFromSettings() {
                    setMigrationStatus();
                    if (typeof deps.renderSettingsView === 'function') deps.renderSettingsView();
                },
                rebuildWritingStudioIndexFromSettings() {
                    setMigrationStatus();
                    if (typeof deps.renderSettingsView === 'function') deps.renderSettingsView();
                },
                triggerWritingStudioUpload() {
                    showMigrationNotice(deps.openCustomModal, {
                        title: '写作能力已迁移',
                        desc: '上传学习与写作训练台已从核心前台下线，后续建议通过 Atlas 或自定义插件方式接入。',
                    });
                },
                deleteWritingStudioCorpusItem() {
                    setMigrationStatus();
                    if (typeof deps.renderSettingsView === 'function') deps.renderSettingsView();
                },
                async handleWritingStudioFileUpload() {
                    setMigrationStatus('上传学习已迁移到 Atlas / 自定义插件，核心设置页不再维护。');
                    if (typeof deps.renderSettingsView === 'function') deps.renderSettingsView();
                },
            };
        },
    };
})();
