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
  const structuredFiles = listConversationRecordFiles(config);
  const structuredEvents = structuredFiles.flatMap((entry) => parseConversationRecordFile(entry.filePath));
  if (structuredEvents.length) {
    return buildGroupedConversationResult({
      files: structuredFiles,
      events: structuredEvents,
      limit,
    });
  }
  const legacyFiles = listLegacyConversationLogFiles(config);
  const legacyEvents = legacyFiles.flatMap((entry) => parseConversationLog(entry.filePath));
  return buildGroupedConversationResult({
    files: legacyFiles,
    events: legacyEvents,
    limit,
  });
}

function listConversationLogFiles(config) {
  const structuredFiles = listConversationRecordFiles(config);
  if (structuredFiles.length) {
    return structuredFiles;
  }
  return listLegacyConversationLogFiles(config);
}

function buildGroupedConversationResult({ files = [], events = [], limit = 7 } = {}) {
  const grouped = new Map();

  for (const event of events) {
    const dateKey = event.dateKey || "unknown";
    const current = grouped.get(dateKey) || {
      date: dateKey,
      label: dateKey,
      events: [],
      threadIds: new Set(),
      files: new Set(),
    };
    current.events.push(event);
    if (event.threadId) {
      current.threadIds.add(event.threadId);
    }
    if (event.fileName) {
      current.files.add(event.fileName);
    }
    grouped.set(dateKey, current);
  }

  return {
    files,
    days: Array.from(grouped.values())
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, Math.max(1, Number(limit) || 7))
      .map((day) => ({
        date: day.date,
        label: day.label,
        threadIds: Array.from(day.threadIds),
        files: Array.from(day.files),
        events: day.events.sort(compareEvents),
      })),
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

function compareEvents(left, right) {
  const leftTime = Date.parse(left?.timestamp || "") || 0;
  const rightTime = Date.parse(right?.timestamp || "") || 0;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

module.exports = {
  listConversationDays,
  listConversationLogFiles,
};
