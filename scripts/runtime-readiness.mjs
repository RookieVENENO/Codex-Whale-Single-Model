export function runtimeReady(status, { version, revision, nativeGuard }) {
  return status?.ok === true && status.version === version && status.buildVersion === version &&
    status.buildRevision === revision && status.rendererReady === true &&
    (!nativeGuard || status.surfaceGuard?.verified === true);
}

export function idleMcpRuntimeReady({ config, rootMatches, electronExists, launcherExists }) {
  return config?.enabled === true && config?.mode === 'follow-codex' &&
    config?.lifecycleOwner === 'mcp' && rootMatches === true &&
    electronExists === true && launcherExists === true;
}
