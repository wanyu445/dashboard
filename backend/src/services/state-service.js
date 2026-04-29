const fs = require("fs");

function getStateSnapshot(config) {
  return {
    sessions: readJson(config.sessionsFile, {}),
    runtimeContext: readJson(config.runtimeContextFile, {}),
    reminders: readJson(config.reminderQueueFile, {}),
    systemQueue: readJson(config.systemMessageQueueFile, {}),
    timelineScreenshotQueue: readJson(config.timelineScreenshotQueueFile, {}),
    sleepState: readJson(config.sleepStateFile, {}),
    presenceState: readJson(config.presenceStateFile, {}),
    periodState: readJson(config.periodStateFile, {}),
    proactiveMessages: readJson(config.proactiveMessageHistoryFile, {}),
    deferredSystemReplies: readJson(config.deferredSystemRepliesFile, {}),
    locations: readJson(config.locationsFile, {}),
    accounts: readAccounts(config.accountDir),
  };
}

function readAccounts(accountDir) {
  if (!fs.existsSync(accountDir)) {
    return [];
  }
  return fs.readdirSync(accountDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".context-tokens.json"))
    .map((entry) => readJson(`${accountDir}/${entry.name}`, {}))
    .filter((entry) => entry && typeof entry === "object");
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

module.exports = { getStateSnapshot };
