function createAtlasStore() {
  return {
    listTopics() { return []; },
    getTopic() { return null; },
    saveTopic() { return { ok: false, error: 'atlas_disabled_in_public_build' }; },
  };
}

module.exports = { createAtlasStore };
