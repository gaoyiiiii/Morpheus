import React from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

const LIGHT_CANVAS_BACKGROUND = '#f6f1e8';
const DARK_CANVAS_BACKGROUND = '#121212';
const DEFAULT_LANG = 'zh-CN';
const DEFAULT_THEME = 'light';
const mountRegistry = new WeakMap();

function jsonClone(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return fallback;
  }
}

function sanitizeText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function createSectionList(organizer) {
  const sections = Array.isArray(organizer?.sections) ? organizer.sections : [];
  const fromSections = sections
    .map((section) => {
      const title = sanitizeText(section?.title || '', 72);
      const items = (Array.isArray(section?.items) ? section.items : [])
        .map((item) => sanitizeText(item, 100))
        .filter(Boolean)
        .slice(0, 8);
      if (!title && !items.length) return null;
      return {
        title: title || '板块',
        items,
      };
    })
    .filter(Boolean);
  if (fromSections.length) return fromSections;
  const nodes = Array.isArray(organizer?.nodes) ? organizer.nodes : [];
  const groups = new Map();
  nodes.forEach((node) => {
    const title = sanitizeText(node?.group || '', 48) || '要点';
    if (!groups.has(title)) groups.set(title, []);
    const label = sanitizeText(node?.label || '', 100);
    if (label) groups.get(title).push(label);
  });
  return Array.from(groups.entries()).map(([title, items]) => ({ title, items: items.slice(0, 8) }));
}

function createPalette(index = 0) {
  const list = [
    { sectionFill: '#fff9ed', sectionStroke: '#d8b98b', cardFill: '#ffffff', cardStroke: '#d9c7aa' },
    { sectionFill: '#eef7ff', sectionStroke: '#8db8df', cardFill: '#ffffff', cardStroke: '#bfd7ef' },
    { sectionFill: '#eef8f3', sectionStroke: '#8cb89d', cardFill: '#ffffff', cardStroke: '#bfd9c7' },
    { sectionFill: '#f8f0ff', sectionStroke: '#b199d9', cardFill: '#ffffff', cardStroke: '#d7c9eb' },
    { sectionFill: '#fff1f0', sectionStroke: '#d8a4a0', cardFill: '#ffffff', cardStroke: '#e6c3c0' },
    { sectionFill: '#f2f5ff', sectionStroke: '#9bacd8', cardFill: '#ffffff', cardStroke: '#cad4ed' },
  ];
  return list[index % list.length];
}

function buildSceneFromOrganizer(organizer = null, theme = DEFAULT_THEME) {
  const title = sanitizeText(organizer?.title || organizer?.centralTopic || '视觉组织图', 80) || '视觉组织图';
  const summary = sanitizeText(organizer?.summary || '', 180);
  const anchor = sanitizeText(
    organizer?.templateKey === 'big-question-map'
      ? (organizer?.focusQuestion || organizer?.centralTopic || title)
      : (organizer?.centralTopic || organizer?.title || title),
    96,
  ) || title;
  const sections = createSectionList(organizer);
  const sectionCount = Math.max(1, sections.length);
  const columns = sectionCount >= 5 ? 3 : Math.min(2, sectionCount);
  const columnWidth = 340;
  const rowHeight = 300;
  const canvasWidth = columns * columnWidth;
  const originX = -(canvasWidth / 2) + 20;
  const skeletons = [
    {
      id: 'title-text',
      type: 'text',
      x: -260,
      y: -360,
      text: title,
      fontSize: 30,
      width: 520,
      textAlign: 'center',
      strokeColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
    },
    {
      id: 'anchor-node',
      type: organizer?.templateKey === 'big-question-map' ? 'diamond' : 'ellipse',
      x: -140,
      y: -230,
      width: 280,
      height: 132,
      strokeColor: '#111827',
      backgroundColor: '#f8d89f',
      fillStyle: 'solid',
      strokeWidth: 2,
      label: {
        text: anchor,
        fontSize: 24,
        textAlign: 'center',
        verticalAlign: 'middle',
      },
    },
  ];
  if (summary) {
    skeletons.push({
      id: 'summary-text',
      type: 'text',
      x: -300,
      y: -60,
      text: summary,
      fontSize: 18,
      width: 600,
      textAlign: 'center',
      strokeColor: theme === 'dark' ? '#d1d5db' : '#475569',
    });
  }
  sections.forEach((section, sectionIndex) => {
    const palette = createPalette(sectionIndex);
    const row = Math.floor(sectionIndex / columns);
    const column = sectionIndex % columns;
    const x = originX + column * columnWidth;
    const y = 80 + row * rowHeight;
    const cardHeight = 74;
    const sectionHeight = Math.max(170, 90 + section.items.length * 88);
    skeletons.push({
      id: `section-${sectionIndex + 1}`,
      type: 'rectangle',
      x,
      y,
      width: 300,
      height: sectionHeight,
      backgroundColor: palette.sectionFill,
      strokeColor: palette.sectionStroke,
      fillStyle: 'solid',
      roundness: { type: 3 },
      strokeWidth: 2,
      label: {
        text: section.title,
        fontSize: 22,
        textAlign: 'center',
        verticalAlign: 'top',
      },
    });
    section.items.forEach((item, itemIndex) => {
      skeletons.push({
        id: `section-${sectionIndex + 1}-item-${itemIndex + 1}`,
        type: 'rectangle',
        x: x + 20,
        y: y + 56 + itemIndex * 84,
        width: 260,
        height: cardHeight,
        backgroundColor: palette.cardFill,
        strokeColor: palette.cardStroke,
        fillStyle: 'solid',
        roundness: { type: 3 },
        strokeWidth: 1.5,
        label: {
          text: item,
          fontSize: 18,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
      });
    });
  });
  return {
    type: 'excalidraw',
    version: 2,
    source: 'morph-visual-organizer',
    elements: convertToExcalidrawElements(skeletons, { regenerateIds: false }),
    appState: {
      viewBackgroundColor: theme === 'dark' ? DARK_CANVAS_BACKGROUND : LIGHT_CANVAS_BACKGROUND,
      theme,
      zenModeEnabled: false,
      gridSize: null,
      currentItemFontFamily: 5,
      currentItemStrokeColor: theme === 'dark' ? '#f8fafc' : '#111827',
      currentItemBackgroundColor: '#ffffff',
      currentItemRoughness: 0,
      currentItemRoundness: 'round',
      currentItemFillStyle: 'solid',
      scrollToContent: true,
    },
    files: {},
  };
}

function normalizeScene(scene, organizer, theme = DEFAULT_THEME) {
  const source = scene && typeof scene === 'object' ? scene : null;
  const safeElements = Array.isArray(source?.elements) ? jsonClone(source.elements, []) : [];
  if (!safeElements.length) {
    return buildSceneFromOrganizer(organizer, theme);
  }
  const safeAppState = jsonClone(source?.appState, {}) || {};
  safeAppState.viewBackgroundColor = theme === 'dark' ? DARK_CANVAS_BACKGROUND : LIGHT_CANVAS_BACKGROUND;
  safeAppState.theme = theme;
  return {
    type: 'excalidraw',
    version: 2,
    source: 'morph-visual-organizer',
    elements: safeElements,
    appState: safeAppState,
    files: jsonClone(source?.files, {}) || {},
  };
}

function pickAppState(appState) {
  const next = {};
  const keys = [
    'theme',
    'viewBackgroundColor',
    'zoom',
    'scrollX',
    'scrollY',
    'currentItemFontFamily',
    'currentItemStrokeColor',
    'currentItemBackgroundColor',
    'currentItemFillStyle',
    'currentItemRoughness',
    'currentItemRoundness',
    'gridSize',
    'frameRendering',
  ];
  keys.forEach((key) => {
    if (appState && Object.prototype.hasOwnProperty.call(appState, key)) {
      next[key] = jsonClone(appState[key], appState[key]);
    }
  });
  return next;
}

function serializeScene(elements, appState, files) {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'morph-visual-organizer',
    elements: jsonClone(Array.isArray(elements) ? elements : [], []),
    appState: pickAppState(appState),
    files: jsonClone(files && typeof files === 'object' ? files : {}, {}) || {},
  };
}

function unmount(container) {
  const mount = mountRegistry.get(container);
  if (!mount) return;
  mountRegistry.delete(container);
  if (typeof mount.dispose === 'function') mount.dispose();
}

function mount(container, options = {}) {
  if (!(container instanceof HTMLElement)) return null;
  unmount(container);
  const theme = String(options.theme || DEFAULT_THEME).trim() === 'dark' ? 'dark' : 'light';
  const scene = normalizeScene(options.scene, options.organizer, theme);
  const langCode = sanitizeText(options.langCode || DEFAULT_LANG, 16) || DEFAULT_LANG;
  const root = createRoot(container);
  let disposed = false;
  let debounceId = 0;
  const handleChange = (elements, appState, files) => {
    if (disposed || typeof options.onChange !== 'function') return;
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => {
      if (disposed) return;
      options.onChange(serializeScene(elements, appState, files));
    }, 600);
  };
  root.render(
    <div style={{ height: '100%', width: '100%' }}>
      <Excalidraw
        initialData={scene}
        onChange={handleChange}
        langCode={langCode}
        theme={theme}
        gridModeEnabled={false}
        zenModeEnabled={false}
        viewModeEnabled={false}
        UIOptions={{
          tools: { image: true },
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            export: { saveFileToDisk: true },
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>,
  );
  const mountState = {
    dispose() {
      disposed = true;
      window.clearTimeout(debounceId);
      try {
        root.unmount();
      } catch (_) {}
    },
  };
  mountRegistry.set(container, mountState);
  return mountState;
}

window.MorphExcalidrawHost = {
  buildSceneFromOrganizer,
  mount,
  unmount,
};
