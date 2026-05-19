// @ts-check
/** @typedef {import("../../interfaces/frontend-settings").SettingsSectionsRuntimeDeps} SettingsSectionsRuntimeDeps */
/** @typedef {import("../../interfaces/frontend-settings").SettingsSectionsRuntimeModules} SettingsSectionsRuntimeModules */

(function initMorphSettingsSectionsRuntime() {
  /**
   * @param {SettingsSectionsRuntimeDeps} [deps={}]
   * @returns {SettingsSectionsRuntimeModules}
   */
  function createSettingsSectionsRuntime(deps = {}) {
    /** @type {SettingsSectionsRuntimeDeps} */
    const api = deps && typeof deps === 'object' ? deps : {};

    function buildExtensionCenterSummary() {
      const items = typeof api.getExtensionsSummaryItems === 'function' ? api.getExtensionsSummaryItems() : [];
      if (!Array.isArray(items) || !items.length) return '当前没有已注册扩展';
      const enabledCount = items.filter((item) => item && item.enabled === true).length;
      return `已注册 ${items.length} 个插件，已启用 ${enabledCount} 个`;
    }

    function buildExtensionSettingsSectionItems() {
      const items = typeof api.getIntegratedExtensionDefinitions === 'function' ? api.getIntegratedExtensionDefinitions() : [];
      if (!Array.isArray(items) || !items.length) return [];
      return items
        .filter((item) => item && item.hostIntegration && item.hostIntegration.settingsSection)
        .map((item) => {
          const hostIntegration = item.hostIntegration || {};
          const section = hostIntegration.settingsSection || {};
          return {
            id: String(section.id || item.id || '').trim(),
            extensionId: String(item.id || '').trim(),
            label: String(section.label || item.name || '').trim() || '扩展设置',
            icon: String(section.icon || item.icon || 'settings-2').trim() || 'settings-2',
            commandId: String(section.commandId || '').trim(),
            summary: String(item.summary || item.description || '').trim(),
          };
        })
        .filter((item) => item.extensionId && item.label);
    }

    return {
      buildExtensionCenterSummary,
      buildExtensionSettingsSectionItems,
    };
  }

  window.MorphSettingsSectionsRuntime = {
    create: createSettingsSectionsRuntime,
  };
})();
