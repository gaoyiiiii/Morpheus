// @ts-check

(function initMorphManagedBlockEnterRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphManagedBlockEnterRuntime && typeof window.MorphManagedBlockEnterRuntime.create === 'function') return;

  function createManagedBlockEnterRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getNextBlockTypeOnEnter = typeof api.getNextBlockTypeOnEnter === 'function'
      ? api.getNextBlockTypeOnEnter
      : () => 'p';
    const genId = typeof api.genId === 'function'
      ? api.genId
      : () => `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    function splitBlockAtCaretOnEnter(context, contextId, blockId, block, editorEl) {
      if (!block || !editorEl || !(block.type === 'p' || block.type === 'todo' || block.type === 'quote' || (typeof api.isListBlockType === 'function' && api.isListBlockType(block.type)))) return false;

      const splitEditableContentAtCaret = typeof api.splitEditableContentAtCaret === 'function' ? api.splitEditableContentAtCaret : null;
      const getBlocksContext = typeof api.getBlocksContext === 'function' ? api.getBlocksContext : null;
      const isIndentableBlockType = typeof api.isIndentableBlockType === 'function' ? api.isIndentableBlockType : null;
      const performManagedEditorStructuralMutation = typeof api.performManagedEditorStructuralMutation === 'function' ? api.performManagedEditorStructuralMutation : null;
      const getManagedEditorContextLabel = typeof api.getManagedEditorContextLabel === 'function' ? api.getManagedEditorContextLabel : null;
      const prepareVersionedEditorMutation = typeof api.prepareVersionedEditorMutation === 'function' ? api.prepareVersionedEditorMutation : null;
      const commitEditorHistorySnapshot = typeof api.commitEditorHistorySnapshot === 'function' ? api.commitEditorHistorySnapshot : null;
      const rerenderManagedBlockEditor = typeof api.rerenderManagedBlockEditor === 'function' ? api.rerenderManagedBlockEditor : null;
      const getListIndentLevel = typeof api.getListIndentLevel === 'function' ? api.getListIndentLevel : null;
      const normalizeBlockRichPayload = typeof api.normalizeBlockRichPayload === 'function' ? api.normalizeBlockRichPayload : null;

      if (!splitEditableContentAtCaret || !getBlocksContext || !isIndentableBlockType || !performManagedEditorStructuralMutation || !getManagedEditorContextLabel || !prepareVersionedEditorMutation || !commitEditorHistorySnapshot || !rerenderManagedBlockEditor || !getListIndentLevel || !normalizeBlockRichPayload) return false;

      const splitResult = splitEditableContentAtCaret(editorEl);
      if (!splitResult) return false;

      const blocks = getBlocksContext(context, contextId);
      const index = blocks.findIndex((item) => item.id === blockId);
      if (index === -1) return false;

      if (isIndentableBlockType(block.type) && (block.content || '').trim() === '') {
        return !!performManagedEditorStructuralMutation({
          context,
          contextId,
          blockId,
          actionType: 'manual_editor_clear_indent_block',
          label: `手动调整${getManagedEditorContextLabel(context)}块类型`,
          detail: { fromType: block.type, toType: 'p' },
          mutation: () => (
            prepareVersionedEditorMutation(context, contextId),
            block.type = 'p',
            delete block.html,
            delete block.indent,
            delete block.checked,
            commitEditorHistorySnapshot(context, contextId, 'edit', {
              persistFocusState: true,
              focusState: { kind: 'block', context, contextId, blockId, offset: 0 },
            }),
            rerenderManagedBlockEditor(context, contextId, { focusBlockId: blockId }),
            { changed: true, appliedLabel: `手动调整${getManagedEditorContextLabel(context)}块类型` }
          ),
        });
      }

      const nextType = getNextBlockTypeOnEnter(block);
      const nextBlock = { id: genId(), type: nextType, content: '', checked: false };
      if (isIndentableBlockType(nextType)) nextBlock.indent = getListIndentLevel(block);

      if (splitResult.atStart && !splitResult.atEnd) {
        return !!performManagedEditorStructuralMutation({
          context,
          contextId,
          blockId,
          actionType: 'manual_editor_insert_block_above',
          label: `手动插入${getManagedEditorContextLabel(context)}块`,
          detail: { newBlockId: nextBlock.id, insertMode: 'above' },
          mutation: () => (
            prepareVersionedEditorMutation(context, contextId),
            blocks.splice(index, 0, nextBlock),
            commitEditorHistorySnapshot(context, contextId, 'add', {
              persistFocusState: true,
              focusState: { kind: 'block', context, contextId, blockId: nextBlock.id, offset: 0 },
            }),
            rerenderManagedBlockEditor(context, contextId, { focusBlockId: nextBlock.id }),
            { changed: true, appliedLabel: `手动插入${getManagedEditorContextLabel(context)}块`, createdItems: [{ type: 'block', id: nextBlock.id }] }
          ),
        });
      }

      return !!performManagedEditorStructuralMutation({
        context,
        contextId,
        blockId,
        actionType: 'manual_editor_split_block',
        label: `手动拆分${getManagedEditorContextLabel(context)}块`,
        detail: { newBlockId: nextBlock.id, insertMode: 'below' },
        mutation: () => (
          prepareVersionedEditorMutation(context, contextId),
          normalizeBlockRichPayload(block, splitResult.before),
          nextType === block.type || nextType === 'p' || nextType === 'todo'
            ? normalizeBlockRichPayload(nextBlock, splitResult.after)
            : (nextBlock.content = splitResult.after.text || '', (splitResult.after.html || '').trim() && (nextBlock.html = splitResult.after.html.trim())),
          block.type === 'todo' && (block.checked = !!block.checked),
          nextBlock.type === 'todo' && (nextBlock.checked = false),
          blocks.splice(index + 1, 0, nextBlock),
          commitEditorHistorySnapshot(context, contextId, 'add', {
            persistFocusState: true,
            focusState: { kind: 'block', context, contextId, blockId: nextBlock.id, offset: 0 },
          }),
          rerenderManagedBlockEditor(context, contextId, { focusBlockId: nextBlock.id }),
          { changed: true, appliedLabel: `手动拆分${getManagedEditorContextLabel(context)}块`, createdItems: [{ type: 'block', id: nextBlock.id }] }
        ),
      });
    }

    function handleStandardBlockEnter(context, contextId, blockId, editorEl) {
      const getBlocksContext = typeof api.getBlocksContext === 'function' ? api.getBlocksContext : null;
      const performManagedEditorStructuralMutation = typeof api.performManagedEditorStructuralMutation === 'function' ? api.performManagedEditorStructuralMutation : null;
      const getManagedEditorContextLabel = typeof api.getManagedEditorContextLabel === 'function' ? api.getManagedEditorContextLabel : null;
      const prepareVersionedEditorMutation = typeof api.prepareVersionedEditorMutation === 'function' ? api.prepareVersionedEditorMutation : null;
      const commitEditorHistorySnapshot = typeof api.commitEditorHistorySnapshot === 'function' ? api.commitEditorHistorySnapshot : null;
      const rerenderManagedBlockEditor = typeof api.rerenderManagedBlockEditor === 'function' ? api.rerenderManagedBlockEditor : null;
      const isIndentableBlockType = typeof api.isIndentableBlockType === 'function' ? api.isIndentableBlockType : null;
      const getListIndentLevel = typeof api.getListIndentLevel === 'function' ? api.getListIndentLevel : null;
      const syncManagedBlockPayloadFromEditor = typeof api.syncManagedBlockPayloadFromEditor === 'function' ? api.syncManagedBlockPayloadFromEditor : null;

      if (!getBlocksContext || !performManagedEditorStructuralMutation || !getManagedEditorContextLabel || !prepareVersionedEditorMutation || !commitEditorHistorySnapshot || !rerenderManagedBlockEditor || !isIndentableBlockType || !getListIndentLevel) return false;

      const blocks = getBlocksContext(context, contextId);
      const index = blocks.findIndex((item) => item.id === blockId);
      if (index === -1) return false;
      const currentBlock = blocks[index];
      if (!currentBlock) return false;
      if (editorEl && syncManagedBlockPayloadFromEditor) syncManagedBlockPayloadFromEditor(currentBlock, editorEl);

      if ((currentBlock.content || '').trim() === '' && currentBlock.type !== 'p') {
        return !!performManagedEditorStructuralMutation({
          context,
          contextId,
          blockId,
          actionType: 'manual_editor_reset_block_type',
          label: `手动调整${getManagedEditorContextLabel(context)}块类型`,
          detail: { fromType: currentBlock.type, toType: 'p' },
          mutation: () => {
            prepareVersionedEditorMutation(context, contextId);
            currentBlock.type = 'p';
            delete currentBlock.html;
            delete currentBlock.indent;
            delete currentBlock.checked;
            commitEditorHistorySnapshot(context, contextId, 'edit', {
              persistFocusState: true,
              focusState: { kind: 'block', context, contextId, blockId, offset: 0 },
            });
            rerenderManagedBlockEditor(context, contextId, { focusBlockId: blockId });
            return { changed: true, appliedLabel: `手动调整${getManagedEditorContextLabel(context)}块类型` };
          },
        });
      }

      if (splitBlockAtCaretOnEnter(context, contextId, blockId, currentBlock, editorEl)) return true;

      const newType = getNextBlockTypeOnEnter(currentBlock);
      const newId = genId();
      const newBlock = { id: newId, type: newType, content: '', checked: false };
      if (isIndentableBlockType(newType)) newBlock.indent = getListIndentLevel(currentBlock);

      return !!performManagedEditorStructuralMutation({
        context,
        contextId,
        blockId,
        actionType: 'manual_editor_insert_block_below',
        label: `手动插入${getManagedEditorContextLabel(context)}块`,
        detail: { newBlockId: newId, insertMode: 'below' },
        mutation: () => {
          prepareVersionedEditorMutation(context, contextId);
          if (editorEl && syncManagedBlockPayloadFromEditor) syncManagedBlockPayloadFromEditor(currentBlock, editorEl);
          blocks.splice(index + 1, 0, newBlock);
          commitEditorHistorySnapshot(context, contextId, 'add', {
            persistFocusState: true,
            focusState: { kind: 'block', context, contextId, blockId: newId, offset: 0 },
          });
          rerenderManagedBlockEditor(context, contextId, { focusBlockId: newId });
          return { changed: true, appliedLabel: `手动插入${getManagedEditorContextLabel(context)}块`, createdItems: [{ type: 'block', id: newId }] };
        },
      });
    }

    return { splitBlockAtCaretOnEnter, handleStandardBlockEnter };
  }

  window.MorphManagedBlockEnterRuntime = {
    create: createManagedBlockEnterRuntime,
  };
})();
