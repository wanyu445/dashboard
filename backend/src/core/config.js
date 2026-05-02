const fs = require("fs");
const os = require("os");
const path = require("path");

function readConfig() {
  const projectRoot = path.resolve(__dirname, "..", "..", "..");
  loadEnvFile(path.join(projectRoot, "backend", ".env"));
  loadEnvFile(path.join(projectRoot, "backend", ".env.local"));
  const cyberbossProjectRoot = resolveExistingPath([
    process.env.CYBERBOSS_PROJECT_ROOT,
    path.resolve(projectRoot, "..", "cyberboss"),
    projectRoot,
  ]);
  const stateDir = resolvePath(process.env.CYBERBOSS_STATE_DIR) || path.join(os.homedir(), ".cyberboss");
  const logDir = resolvePath(process.env.CYBERBOSS_LOG_DIR) || path.join(os.homedir(), "logs", "cyberboss");
  const distDir = resolvePath(process.env.CYBERBOSS_DASHBOARD_DIST_DIR) || path.join(projectRoot, "frontend", "dist");

  return {
    projectRoot,
    cyberbossProjectRoot,
    stateDir,
    logDir,
    port: Number(process.env.CYBERBOSS_DASHBOARD_PORT) || 3000,
    host: normalizeText(process.env.CYBERBOSS_DASHBOARD_HOST) || "0.0.0.0",
    logLevel: normalizeLogLevel(process.env.CYBERBOSS_DASHBOARD_LOG_LEVEL),
    authPassword: normalizeText(process.env.CYBERBOSS_DASHBOARD_AUTH_PASSWORD),
    authSessionDays: Number(process.env.CYBERBOSS_DASHBOARD_AUTH_SESSION_DAYS) || 30,
    distDir,
    serveDist: fs.existsSync(path.join(distDir, "index.html")),
    timelineSiteDir: path.join(stateDir, "timeline", "site"),
    siteAvailable: fs.existsSync(path.join(stateDir, "timeline", "site", "index.html")),
    timelineDashboardFile: path.join(stateDir, "timeline", "site", "dashboard-data.json"),
    timelineStateFile: path.join(stateDir, "timeline", "timeline-state.json"),
    timelineTaxonomyFile: path.join(stateDir, "timeline", "timeline-taxonomy.json"),
    timelineFactsFile: path.join(stateDir, "timeline", "timeline-facts.json"),
    diaryDir: path.join(stateDir, "diary"),
    memoryDir: path.join(stateDir, "memory"),
    conversationDir: path.join(stateDir, "conversations"),
    sessionsFile: path.join(stateDir, "sessions.json"),
    runtimeContextFile: path.join(stateDir, "project-tool-runtime-context.json"),
    reminderQueueFile: path.join(stateDir, "reminder-queue.json"),
    systemMessageQueueFile: path.join(stateDir, "system-message-queue.json"),
    timelineScreenshotQueueFile: path.join(stateDir, "timeline-screenshot-queue.json"),
    sleepStateFile: path.join(stateDir, "sleep-state.json"),
    presenceStateFile: path.join(stateDir, "presence-state.json"),
    periodStateFile: path.join(stateDir, "period-state.json"),
    proactiveMessageHistoryFile: path.join(stateDir, "proactive-message-history.json"),
    deferredSystemRepliesFile: path.join(stateDir, "deferred-system-replies.json"),
    locationsFile: path.join(stateDir, "locations.json"),
    weatherStateFile: path.join(stateDir, "weather-state.json"),
    stickersDir: path.join(stateDir, "stickers"),
    stickerAssetsDir: path.join(stateDir, "stickers", "assets"),
    stickersIndexFile: path.join(stateDir, "stickers", "index.json"),
    stickerTagsFile: path.join(stateDir, "stickers", "tags.json"),
    stickersTemplateDir: path.join(cyberbossProjectRoot, "templates", "stickers"),
    stickerAssetsTemplateDir: path.join(cyberbossProjectRoot, "templates", "stickers", "assets"),
    stickersTemplateIndexFile: path.join(cyberbossProjectRoot, "templates", "stickers", "index.json"),
    stickerTagsTemplateFile: path.join(cyberbossProjectRoot, "templates", "stickers", "tags.json"),
    accountDir: path.join(stateDir, "accounts"),
    weixinInstructionsFile: resolveExistingPath([
      process.env.CYBERBOSS_WEIXIN_INSTRUCTIONS_FILE,
      path.join(stateDir, "weixin-instructions.md"),
      path.join(cyberbossProjectRoot, "templates", "weixin-instructions.md"),
      path.join(projectRoot, "templates", "weixin-instructions.md"),
    ]),
  };
}

function resolvePath(value) {
  const normalized = normalizeText(value);
  return normalized ? path.resolve(normalized) : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLogLevel(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(normalized)
    ? normalized
    : "error";
}

function resolveExistingPath(candidates) {
  for (const candidate of candidates) {
    const resolved = resolvePath(candidate);
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return "";
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] != null) {
      continue;
    }
    let value = line.slice(separatorIndex + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

module.exports = { readConfig };
