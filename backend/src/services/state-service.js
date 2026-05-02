const fs = require("fs");
const path = require("path");

function getStateSnapshot(config) {
  const locations = readJson(config.locationsFile, {});
  const weatherState = readJson(config.weatherStateFile, {});
  const reminders = readJson(config.reminderQueueFile, {});
  return {
    sessions: readJson(config.sessionsFile, {}),
    runtimeContext: readJson(config.runtimeContextFile, {}),
    reminders,
    systemQueue: readJson(config.systemMessageQueueFile, {}),
    timelineScreenshotQueue: readJson(config.timelineScreenshotQueueFile, {}),
    sleepState: readJson(config.sleepStateFile, {}),
    presenceState: readJson(config.presenceStateFile, {}),
    periodState: readJson(config.periodStateFile, {}),
    proactiveMessages: readJson(config.proactiveMessageHistoryFile, {}),
    deferredSystemReplies: readJson(config.deferredSystemRepliesFile, {}),
    locations,
    accounts: readAccounts(config.accountDir),
    deviceSummary: summarizeDeviceSnapshot({
      locations,
      weatherState,
      conversationDir: config.conversationDir,
    }),
    reminderSummary: summarizeReminderQueue(reminders),
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

function summarizeDeviceSnapshot({ locations, weatherState, conversationDir }) {
  const currentStay = locations && typeof locations === "object" ? locations.currentStay || null : null;
  const batteryObservations = Array.isArray(locations?.batteryObservations) ? locations.batteryObservations : [];
  const latestBattery = batteryObservations[0] || null;
  const latestSeenAt = normalizeText(currentStay?.lastSeenAt) || normalizeText(latestBattery?.timestamp);

  return {
    location: currentStay ? {
      placeTag: normalizeText(currentStay.placeTag) || normalizeText(currentStay.trigger) || "",
      deviceName: normalizeText(currentStay.deviceName),
      latitude: normalizeNumber(currentStay.centerLat),
      longitude: normalizeNumber(currentStay.centerLng),
      enteredAt: normalizeText(currentStay.enteredAt),
      lastSeenAt: normalizeText(currentStay.lastSeenAt),
      source: normalizeText(currentStay.source),
    } : null,
    battery: {
      level: normalizeBatteryLevel(currentStay?.batteryLevel ?? latestBattery?.batteryLevel),
      observedAt: normalizeText(latestBattery?.timestamp) || normalizeText(currentStay?.lastSeenAt),
    },
    lastUploadAt: latestSeenAt,
    weather: summarizeWeather(weatherState) || readLatestWeatherSummary(conversationDir),
  };
}

function summarizeWeather(weatherState) {
  if (!weatherState || typeof weatherState !== "object") {
    return null;
  }
  const weather = weatherState.weather;
  if (!weather || typeof weather !== "object") {
    return null;
  }
  return {
    temperatureC: normalizeNumber(weather.tempC),
    description: normalizeText(weather.description),
    place: normalizeText(weather.city),
    observedAt: normalizeText(weatherState.updatedAt),
  };
}

function readLatestWeatherSummary(conversationDir) {
  if (!conversationDir || !fs.existsSync(conversationDir)) {
    return null;
  }

  const files = fs.readdirSync(conversationDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[0-9]{4}-[0-9]{2}-[0-9]{2}\.jsonl$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left))
    .slice(0, 7);

  for (const fileName of files) {
    const summary = extractWeatherFromConversationFile(path.join(conversationDir, fileName));
    if (summary) {
      return summary;
    }
  }
  return null;
}

function extractWeatherFromConversationFile(filePath) {
  try {
    const lines = fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/u)
      .filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      let record = null;
      try {
        record = JSON.parse(lines[index]);
      } catch {
        continue;
      }
      const parsed = parseWeatherText(normalizeText(record?.text));
      if (parsed) {
        return {
          ...parsed,
          observedAt: normalizeText(record?.timestamp),
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseWeatherText(text) {
  if (!text) {
    return null;
  }

  const patterns = [
    /weather (?:is|shows it's)\s+(-?\d+)\s*°?C\s+([^.。\n]+?)\s+(?:in|nearby in)\s+([A-Za-z\u4e00-\u9fa5\s]+)/i,
    /外面\s*(-?\d+)\s*度[，,\s]*([^。，“”"\n]+)/u,
    /天气(?:已经)?(?:升到)?\s*(-?\d+)\s*度[，,\s]*([^。，“”"\n]+)/u,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    if (pattern === patterns[0]) {
      return {
        temperatureC: Number(match[1]),
        description: normalizeText(match[2]),
        place: normalizeText(match[3]),
      };
    }
    return {
      temperatureC: Number(match[1]),
      description: normalizeText(match[2]),
      place: "",
    };
  }

  return null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeBatteryLevel(value) {
  const level = normalizeNumber(value);
  return level == null ? null : Math.max(0, Math.min(100, Math.round(level)));
}

function summarizeReminderQueue(remindersState) {
  const now = Date.now();
  const reminders = Array.isArray(remindersState?.reminders) ? remindersState.reminders : [];
  const upcoming = reminders
    .filter((item) => Number.isFinite(Number(item?.dueAtMs)) && Number(item.dueAtMs) >= now)
    .sort((left, right) => Number(left.dueAtMs) - Number(right.dueAtMs));
  const personalUpcoming = upcoming.filter((item) => resolveReminderGroup(normalizeText(item.text)) === "personal");
  const internalUpcoming = upcoming.filter((item) => resolveReminderGroup(normalizeText(item.text)) === "internal");

  return {
    totalUpcoming: upcoming.length,
    personal: buildReminderBucket(personalUpcoming, "user"),
    internal: buildReminderBucket(internalUpcoming, "internal"),
  };
}

function buildReminderBucket(reminders, kind) {
  const next = reminders[0] || null;
  return {
    total: reminders.length,
    next: next ? {
      id: normalizeText(next.id),
      dueAtMs: Number(next.dueAtMs),
      text: summarizeReminderText(normalizeText(next.text)),
      kind,
    } : null,
  };
}

function summarizeReminderText(text) {
  if (!text) {
    return "";
  }
  if (text.startsWith("__cyberboss_daily_diary__|")) {
    return "日记";
  }
  if (text.startsWith("__cyberboss_memory_review__|")) {
    return "记忆回顾";
  }
  if (text.startsWith("__cyberboss_timeline_confirm__|")) {
    return "时间轴确认";
  }
  if (text.startsWith("__cyberboss_sleep__")) {
    const parsed = parseInternalReminderPayload(text, "__cyberboss_sleep__");
    const stageLabelMap = {
      sleep_probe: "睡眠确认",
      assume_asleep: "默认入睡",
      wake_check: "起床确认",
      oversleep_check: "睡眠过长确认",
    };
    return stageLabelMap[parsed?.stage] || "睡眠提醒";
  }
  if (text.startsWith("__cyberboss_presence__")) {
    const parsed = parseInternalReminderPayload(text, "__cyberboss_presence__");
    const stageLabelMap = {
      gentle_checkin: "状态确认",
      lost_contact: "失联确认",
    };
    return stageLabelMap[parsed?.stage] || "状态提醒";
  }
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

function resolveReminderGroup(text) {
  if (text.startsWith("__cyberboss_sleep__") || text.startsWith("__cyberboss_presence__")) {
    return "personal";
  }
  if (text.startsWith("__cyberboss_")) {
    return "internal";
  }
  return "personal";
}

function parseInternalReminderPayload(text, prefix) {
  const payloadText = String(text || "").slice(prefix.length).trim();
  if (!payloadText) {
    return null;
  }
  try {
    const parsed = JSON.parse(payloadText);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = { getStateSnapshot };
