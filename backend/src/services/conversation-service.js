const fs = require("fs");
const path = require("path");

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;
const HEADER_MAP = new Map([
  ["[WeChat → ClaudeCode]", "user"],
  ["[ClaudeCode → WeChat]", "assistant"],
  ["[Thinking]", "thinking"],
  ["[Approval]", "approval"],
]);

function listConversationDays(config, { limit = 7 } = {}) {
  const daySummaries = listConversationDaySummaries(config, { limit });
  const days = daySummaries
    .map((entry) => getConversationDay(config, entry.date))
    .filter(Boolean);
  return {
    files: listConversationLogFiles(config),
    days,
  };
}

function listConversationLogFiles(config) {
  const structuredFiles = listConversationRecordFiles(config);
  if (structuredFiles.length) {
    return structuredFiles;
  }
  return listLegacyConversationLogFiles(config);
}

function listConversationDaySummaries(config, { limit = 31 } = {}) {
  const structuredFiles = listConversationRecordFiles(config);
  if (structuredFiles.length) {
    return structuredFiles
      .slice(0, Math.max(1, Number(limit) || 31))
      .map((entry) => ({
        date: entry.fileName.slice(0, 10),
        label: entry.fileName.slice(0, 10),
        source: "structured",
      }));
  }

  const legacyFiles = listLegacyConversationLogFiles(config);
  const grouped = new Map();
  for (const entry of legacyFiles) {
    const date = entry.startedAt.slice(0, 10);
    if (!date || grouped.has(date)) {
      continue;
    }
    grouped.set(date, {
      date,
      label: date,
      source: "legacy",
    });
  }
  return Array.from(grouped.values())
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, Math.max(1, Number(limit) || 31));
}

function getConversationDay(config, date) {
  const normalizedDate = normalizeDateKey(date);
  if (!normalizedDate) {
    return null;
  }

  const structuredPath = path.join(config.conversationDir, `${normalizedDate}.jsonl`);
  if (fs.existsSync(structuredPath) && fs.statSync(structuredPath).isFile()) {
    const events = parseConversationRecordFile(structuredPath).sort(compareEvents);
    return buildConversationDay({
      date: normalizedDate,
      label: normalizedDate,
      files: [path.basename(structuredPath)],
      events,
    });
  }

  const legacyFiles = listLegacyConversationLogFiles(config)
    .filter((entry) => entry.startedAt.slice(0, 10) === normalizedDate);
  if (!legacyFiles.length) {
    return null;
  }

  const events = legacyFiles
    .flatMap((entry) => parseConversationLog(entry.filePath))
    .sort(compareEvents);
  return buildConversationDay({
    date: normalizedDate,
    label: normalizedDate,
    files: legacyFiles.map((entry) => entry.fileName),
    events,
  });
}

function buildConversationDay({ date, label, files = [], events = [] }) {
  const threadIds = new Set();
  for (const event of events) {
    if (event?.threadId) {
      threadIds.add(event.threadId);
    }
  }
  return {
    date,
    label,
    threadIds: Array.from(threadIds),
    files,
    events: annotateConversationActions(events),
  };
}

function listConversationRecordFiles(config) {
  if (!fs.existsSync(config.conversationDir)) {
    return [];
  }
  return fs.readdirSync(config.conversationDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.jsonl$/u.test(entry.name))
    .map((entry) => ({
      fileName: entry.name,
      filePath: path.join(config.conversationDir, entry.name),
      startedAt: `${entry.name.slice(0, 10)}T00:00:00+08:00`,
    }))
    .sort((left, right) => right.fileName.localeCompare(left.fileName));
}

function parseConversationRecordFile(filePath) {
  const fileName = path.basename(filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/u)
    .map((line, index) => parseConversationRecordLine(line, { fileName, index }))
    .filter(Boolean);
}

function parseConversationRecordLine(line, context) {
  const raw = String(line || "").trim();
  if (!raw) {
    return null;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const timestamp = normalizeTimestamp(parsed.timestamp);
  const text = normalizeText(parsed.text);
  return {
    id: normalizeText(parsed.id) || `${context.fileName}:record:${context.index + 1}`,
    type: normalizeText(parsed.type) || "unknown",
    threadId: normalizeText(parsed.threadId),
    turnId: normalizeText(parsed.turnId),
    fileName: context.fileName,
    timestamp,
    dateKey: deriveDateKey(timestamp, context.fileName.slice(0, 10) || "unknown"),
    text,
    preview: buildPreview(parsed.type, text),
    meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
  };
}

function listLegacyConversationLogFiles(config) {
  if (!fs.existsSync(config.logDir)) {
    return [];
  }
  return fs.readdirSync(config.logDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^shared-open-\d{8}-\d{6}\.log$/u.test(entry.name))
    .map((entry) => ({
      fileName: entry.name,
      filePath: path.join(config.logDir, entry.name),
      startedAt: parseTimestampFromFileName(entry.name),
    }))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function parseConversationLog(filePath) {
  const fileName = path.basename(filePath);
  const fileStartedAt = parseTimestampFromFileName(fileName);
  const fileDateKey = fileStartedAt.slice(0, 10) || "unknown";
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = stripAnsi(raw).split(/\r?\n/);
  const events = [];
  let threadId = "";
  let current = null;
  let lastTimestamp = fileStartedAt;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const threadMatch = trimmed.match(/^Bound thread:\s+(.+)$/u);
    if (threadMatch) {
      threadId = threadMatch[1].trim();
      continue;
    }

    const headerType = HEADER_MAP.get(trimmed);
    if (headerType) {
      pushCurrent();
      current = createLegacyEvent({
        type: headerType,
        threadId,
        fileName,
        fileStartedAt,
      });
      continue;
    }

    if (/^●\s+/u.test(trimmed)) {
      pushCurrent();
      current = createLegacyEvent({
        type: /^●\s+(OK|ERROR)$/u.test(trimmed) ? "tool_result" : "tool_use",
        threadId,
        fileName,
        fileStartedAt,
      });
      current.lines.push(trimmed);
      continue;
    }

    if (/^────────────────/u.test(trimmed)) {
      pushCurrent();
      events.push({
        id: `${fileName}:separator:${events.length + 1}`,
        type: "separator",
        text: "",
        threadId,
        fileName,
        timestamp: lastTimestamp,
        dateKey: deriveDateKey(lastTimestamp, fileDateKey),
      });
      continue;
    }

    if (!current) {
      continue;
    }
    current.lines.push(trimmed);
  }

  pushCurrent();
  return events;

  function pushCurrent() {
    if (!current) {
      return;
    }
    current.text = current.lines.join("\n").trim();
    const inlineTimestamp = extractInlineTimestamp(current.text);
    current.timestamp = inlineTimestamp || lastTimestamp || fileStartedAt;
    current.dateKey = deriveDateKey(current.timestamp, fileDateKey);
    current.preview = buildPreview(current.type, current.text);
    lastTimestamp = current.timestamp || lastTimestamp;
    if (current.text || current.type === "separator") {
      events.push({
        id: `${fileName}:${current.type}:${events.length + 1}`,
        ...current,
      });
    }
    current = null;
  }
}

function createLegacyEvent({ type, threadId, fileName, fileStartedAt }) {
  return {
    type,
    threadId,
    fileName,
    fileStartedAt,
    lines: [],
    text: "",
    preview: "",
    timestamp: fileStartedAt,
    dateKey: deriveDateKey(fileStartedAt, "unknown"),
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return raw;
  }
  return new Date(parsed).toISOString();
}

function extractInlineTimestamp(text) {
  const match = String(text || "").match(/^\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2}))?\]/u);
  if (!match) {
    return "";
  }
  const seconds = match[3] || "00";
  return `${match[1]}T${match[2]}:${seconds}+08:00`;
}

function buildPreview(type, text) {
  const normalized = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  if (!normalized) {
    return type;
  }
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function stripAnsi(text) {
  return String(text || "").replace(ANSI_REGEX, "");
}

function parseTimestampFromFileName(fileName) {
  const match = String(fileName || "").match(/shared-open-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.log/u);
  if (!match) {
    return "";
  }
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
}

function deriveDateKey(timestamp, fallback) {
  const parsed = Date.parse(String(timestamp || "").trim());
  if (!Number.isFinite(parsed)) {
    return fallback || "unknown";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(parsed));
}

function normalizeDateKey(value) {
  const normalized = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : "";
}

function compareEvents(left, right) {
  const leftTime = Date.parse(left?.timestamp || "") || 0;
  const rightTime = Date.parse(right?.timestamp || "") || 0;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function annotateConversationActions(events) {
  const output = [];
  let pendingActionKeys = new Set();
  let pendingStickers = [];
  let pendingStickerAnchor = null;

  function buildPendingActionTags() {
    return Array.from(pendingActionKeys).map((key) => ({
      key,
      label: ACTION_LABEL_MAP[key] || key,
    }));
  }

  function resetPendingActions() {
    pendingActionKeys = new Set();
    pendingStickers = [];
    pendingStickerAnchor = null;
  }

  function flushPendingStickerAssistant(fallbackEvent = null) {
    if (!pendingStickers.length) {
      return;
    }
    const anchor = pendingStickerAnchor || fallbackEvent || {};
    output.push({
      id: `${normalizeText(anchor.id) || "sticker"}:assistant-sticker:${output.length + 1}`,
      type: "assistant",
      threadId: normalizeText(anchor.threadId) || normalizeText(fallbackEvent?.threadId),
      turnId: normalizeText(anchor.turnId) || normalizeText(fallbackEvent?.turnId),
      bindingKey: normalizeText(anchor.bindingKey) || normalizeText(fallbackEvent?.bindingKey),
      workspaceRoot: normalizeText(anchor.workspaceRoot) || normalizeText(fallbackEvent?.workspaceRoot),
      workspaceId: normalizeText(anchor.workspaceId) || normalizeText(fallbackEvent?.workspaceId),
      accountId: normalizeText(anchor.accountId) || normalizeText(fallbackEvent?.accountId),
      senderId: normalizeText(anchor.senderId) || normalizeText(fallbackEvent?.senderId),
      provider: normalizeText(anchor.provider) || normalizeText(fallbackEvent?.provider),
      fileName: normalizeText(anchor.fileName) || normalizeText(fallbackEvent?.fileName),
      timestamp: normalizeText(anchor.timestamp) || normalizeText(fallbackEvent?.timestamp),
      dateKey: normalizeText(anchor.dateKey) || normalizeText(fallbackEvent?.dateKey),
      text: "",
      preview: "表情",
      meta: {
        synthetic: true,
        source: "sticker",
      },
      actionTags: buildPendingActionTags(),
      stickers: pendingStickers,
    });
    resetPendingActions();
  }

  for (const event of Array.isArray(events) ? events : []) {
    const current = event && typeof event === "object" ? { ...event } : event;
    if (!current || typeof current !== "object") {
      continue;
    }

    if (isMetaEventType(current.type)) {
      collectActionKey(pendingActionKeys, current);
      const sticker = resolveStickerReference(current);
      if (sticker) {
        if (!pendingStickers.some((item) => item.id === sticker.id)) {
          pendingStickers.push(sticker);
        }
        pendingStickerAnchor = pendingStickerAnchor || current;
      }
      output.push(current);
      continue;
    }

    if (current.type === "assistant") {
      current.actionTags = buildPendingActionTags();
      current.stickers = pendingStickers;
      resetPendingActions();
      output.push(current);
      continue;
    }

    if (current.type === "user") {
      flushPendingStickerAssistant(current);
      resetPendingActions();
      output.push(current);
      continue;
    }

    output.push(current);
  }

  flushPendingStickerAssistant();
  return output;
}

function isMetaEventType(type) {
  return ["thinking", "tool_use", "tool_result", "approval"].includes(String(type || "").trim());
}

const ACTION_LABEL_MAP = {
  reminder: "提醒",
  diary: "日记",
  memory: "记忆",
  weather: "天气",
  location: "定位",
  timeline: "时间轴",
  sticker: "表情",
};

function collectActionKey(target, event) {
  const key = resolveActionKey(event);
  if (key) {
    target.add(key);
  }
}

function resolveActionKey(event) {
  const toolName = normalizeText(event?.meta?.toolName).toLowerCase();
  const text = normalizeText(event?.text).toLowerCase();

  if (toolName.includes("cyberboss_weather") || text.includes("cyberboss_weather")) {
    return "weather";
  }
  if (
    toolName.includes("whereabouts") ||
    text.includes("whereabouts") ||
    toolName.includes("location") ||
    text.includes("location")
  ) {
    return "location";
  }
  if (toolName.includes("cyberboss_diary") || text.includes("cyberboss_diary")) {
    return "diary";
  }
  if (toolName.includes("cyberboss_memory") || text.includes("cyberboss_memory")) {
    return "memory";
  }
  if (toolName.includes("cyberboss_reminder") || text.includes("cyberboss_reminder")) {
    return "reminder";
  }
  if (toolName.includes("cyberboss_timeline") || text.includes("cyberboss_timeline")) {
    return "timeline";
  }
  if (toolName.includes("cyberboss_sticker") || text.includes("cyberboss_sticker")) {
    return "sticker";
  }
  return "";
}

function resolveStickerReference(event) {
  const toolName = normalizeText(event?.meta?.toolName).toLowerCase();
  const text = normalizeText(event?.text);
  const lowerText = text.toLowerCase();
  const looksLikeStickerSend = toolName.includes("cyberboss_sticker_send")
    || lowerText.includes("cyberboss_sticker_send")
    || /sticker sent:/iu.test(text);
  if (!looksLikeStickerSend) {
    return null;
  }
  const stickerId = normalizeStickerId(event?.meta?.input?.stickerId)
    || normalizeStickerId(extractStickerIdFromText(text));
  if (!stickerId) {
    return null;
  }
  return {
    id: stickerId,
    label: stickerId,
  };
}

function extractStickerIdFromText(text) {
  const match = String(text || "").match(/"stickerId"\s*:\s*"([^"]+)"/u)
    || String(text || "").match(/stickerId['"\s:]+([a-zA-Z0-9_-]+)/u)
    || String(text || "").match(/Sticker sent:\s*([a-zA-Z0-9_-]+)/u);
  return match?.[1] || "";
}

function normalizeStickerId(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/gu, "");
}

module.exports = {
  listConversationDays,
  listConversationDaySummaries,
  getConversationDay,
  listConversationLogFiles,
};
