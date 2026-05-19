function handleCodexRemoteApiRequest(_req, res) {
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'codex_remote_disabled_in_public_build' }));
  return true;
}

module.exports = { handleCodexRemoteApiRequest };
