// @ts-check

(function initMorphAIActionVisualRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionVisualRuntime && typeof window.MorphAIActionVisualRuntime.create === 'function') return;

  function createAIActionVisualRuntime() {
    function applyVisualAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const upsertVisualOrganizerDraft = typeof ctx.upsertVisualOrganizerDraft === 'function' ? ctx.upsertVisualOrganizerDraft : null;
      const setExtensionEnabled = typeof ctx.setExtensionEnabled === 'function' ? ctx.setExtensionEnabled : null;
      const visualOrganizerPluginId = String(ctx.visualOrganizerPluginId || '').trim();
      const promptQuestion = String(ctx.promptQuestion || '').trim();

      if (actionType !== 'create_visual_organizer') {
        return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
      }
      if (!upsertVisualOrganizerDraft) {
        return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
      }

      const organizer = upsertVisualOrganizerDraft({
        ...action,
        source: String(action.source || 'ai-chat').trim() || 'ai-chat',
      }, {
        prompt: String(action.prompt || action.question || promptQuestion || '').trim(),
        templateKey: String(action.templateKey || action.organizerType || action.typeKey || '').trim(),
        save: false,
        skipRender: true,
      });

      if (!organizer) {
        return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
      }

      if (setExtensionEnabled && visualOrganizerPluginId) {
        setExtensionEnabled(visualOrganizerPluginId, true, { silent: true });
      }

      return {
        handled: true,
        changed: true,
        appliedLabels: [`新增视觉组织图：${String(organizer.title || '').trim()}`],
        createdItems: [{ tab: 'visualOrganizer', id: organizer.id, text: organizer.title }],
        actionRuntimeMeta: null,
      };
    }

    return {
      applyVisualAction,
    };
  }

  window.MorphAIActionVisualRuntime = {
    create: createAIActionVisualRuntime,
  };
})();
