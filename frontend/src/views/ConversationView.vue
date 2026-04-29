<template>
  <div class="page">
    <section class="page-head">
      <div class="page-title-row">
        <div class="title-meta">
          <h1 class="page-title">对话</h1>
          <button
            type="button"
            class="meta-trigger"
            title="同步数据"
            @click="load"
          >
            ↻
          </button>
          <router-link
            to="/state"
            class="meta-trigger meta-trigger--link"
            title="状态"
          >
            ⚙
          </router-link>
          <router-link
            to="/weixin-instructions"
            class="meta-trigger meta-trigger--link"
            title="微信说明"
          >
            微
          </router-link>
        </div>
      </div>
      <p class="page-subtitle">聊天正文单独看，Thinking 和工具调用缩成挂在回复附近的小折叠。</p>
      <div v-if="!loading && !error" class="conversation-meta">
        <button
          v-if="currentThread.fullId"
          type="button"
          class="thread-chip"
          :title="currentThread.fullId"
          @click="toggleThreadExpanded"
        >
          <span class="thread-chip__icon" aria-hidden="true"></span>
          <span class="thread-chip__label">{{ currentThreadLabel }}</span>
        </button>
        <button
          v-if="filteredTranscriptDays.length"
          type="button"
          class="date-select-trigger"
          @click="dateSheetOpen = true"
        >
          <span class="date-select-trigger__label">{{ selectedDateDisplay }}</span>
          <span class="date-select-trigger__icon">⌄</span>
        </button>
        <van-tag plain type="success">最近 {{ transcriptDays.length }} 天</van-tag>
      </div>
    </section>

    <van-empty v-if="!loading && !transcriptDays.length" description="暂时没读到会话日志" />
    <van-loading v-else-if="loading" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <div v-else class="day-list">
      <section v-for="day in filteredTranscriptDays" :key="day.date" class="day-block">
        <div class="day-divider">
          <span class="day-divider__date">{{ formatDayLabel(day.date) }}</span>
          <span class="day-divider__meta">{{ day.threadIds.length }} 个线程 · {{ day.items.length }} 条消息</span>
        </div>

        <div class="transcript">
          <template v-for="item in day.items" :key="item.id">
            <article
              v-if="item.kind === 'message'"
              :ref="(element) => setMessageRef(item.id, element)"
              class="chat-row"
              :class="`chat-row--${item.role}`"
            >
              <div
                v-if="item.role === 'assistant' && item.before.length"
                class="sidecar-stack sidecar-stack--before"
              >
                <details
                  v-for="meta in item.before"
                  :key="meta.id"
                  class="sidecar-fold"
                  :class="`sidecar-fold--${meta.type}`"
                >
                  <summary class="sidecar-fold__summary">
                    <span class="sidecar-fold__title">{{ metaLabel(meta) }}</span>
                    <span class="sidecar-fold__preview">{{ meta.preview }}</span>
                    <span class="sidecar-fold__time mono">{{ formatTime(meta.timestamp) }}</span>
                  </summary>
                  <pre class="sidecar-fold__body pre-wrap mono">{{ cleanEventText(meta.text) }}</pre>
                </details>
              </div>

              <div class="chat-bubble section-card" :class="`chat-bubble--${item.role}`">
                <div class="chat-bubble__meta">
                  <span>{{ item.role === "user" ? "你" : "他" }}</span>
                  <span class="mono">{{ formatTime(item.timestamp) }}</span>
                </div>
                <div v-if="messageBodyText(item)" class="chat-bubble__text pre-wrap">{{ messageBodyText(item) }}</div>
                <div v-if="item.imageAttachments.length" class="chat-bubble__images">
                  <button
                    v-for="attachment in item.imageAttachments"
                    :key="attachment.filePath || attachment.fileName || attachment.label"
                    type="button"
                    class="chat-image-card"
                    :title="attachment.label || attachment.fileName || '图片附件'"
                    @click="openImageAttachment(attachment)"
                  >
                    <img
                      v-if="attachmentObjectUrl(attachment)"
                      class="chat-image-card__image"
                      :src="attachmentObjectUrl(attachment)"
                      :alt="attachment.label || attachment.fileName || '图片附件'"
                      loading="lazy"
                    />
                    <div v-else class="chat-image-card__placeholder">加载中</div>
                    <div class="chat-image-card__label">{{ attachment.label || attachment.fileName || "图片" }}</div>
                  </button>
                </div>
              </div>

              <div
                v-if="item.role === 'assistant' && item.after.length"
                class="sidecar-stack sidecar-stack--after"
              >
                <details
                  v-for="meta in item.after"
                  :key="meta.id"
                  class="sidecar-fold"
                  :class="`sidecar-fold--${meta.type}`"
                >
                  <summary class="sidecar-fold__summary">
                    <span class="sidecar-fold__title">{{ metaLabel(meta) }}</span>
                    <span class="sidecar-fold__preview">{{ meta.preview }}</span>
                    <span class="sidecar-fold__time mono">{{ formatTime(meta.timestamp) }}</span>
                  </summary>
                  <pre class="sidecar-fold__body pre-wrap mono">{{ cleanEventText(meta.text) }}</pre>
                </details>
              </div>
            </article>

            <article
              v-else
              class="chat-row chat-row--assistant"
            >
              <div class="sidecar-stack sidecar-stack--orphan">
                <details
                  v-for="meta in item.meta"
                  :key="meta.id"
                  class="sidecar-fold"
                  :class="`sidecar-fold--${meta.type}`"
                >
                  <summary class="sidecar-fold__summary">
                    <span class="sidecar-fold__title">{{ metaLabel(meta) }}</span>
                    <span class="sidecar-fold__preview">{{ meta.preview }}</span>
                    <span class="sidecar-fold__time mono">{{ formatTime(meta.timestamp) }}</span>
                  </summary>
                  <pre class="sidecar-fold__body pre-wrap mono">{{ cleanEventText(meta.text) }}</pre>
                </details>
              </div>
            </article>
          </template>
        </div>
      </section>
    </div>

    <teleport to="body">
      <div v-if="dateSheetOpen" class="date-sheet-overlay" @click.self="dateSheetOpen = false">
        <div class="date-sheet">
          <div class="date-sheet__header">
            <div>
              <div class="date-sheet__kicker">日期选择</div>
              <h3>{{ selectedDateDisplay }}</h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="dateSheetOpen = false">×</button>
          </div>

          <div v-if="activeCalendarMonth" class="date-sheet__body">
            <section class="date-calendar section-card">
              <div class="date-calendar__topbar">
                <button
                  type="button"
                  class="date-calendar__switch"
                  @click="switchCalendarMonth('older')"
                >
                  ‹
                </button>
                <div class="date-calendar__title">{{ activeCalendarMonth.monthLabel }}</div>
                <button
                  type="button"
                  class="date-calendar__switch"
                  @click="switchCalendarMonth('newer')"
                >
                  ›
                </button>
              </div>

              <div class="date-weekdays">
                <span
                  v-for="weekday in calendarWeekdays"
                  :key="weekday"
                  class="date-weekdays__item"
                >
                  {{ weekday }}
                </span>
              </div>

              <div class="date-calendar__grid">
                <button
                  v-for="cell in activeCalendarMonth.cells"
                  :key="cell.key"
                  type="button"
                  class="date-chip"
                  :class="{
                    'date-chip--placeholder': cell.kind === 'placeholder',
                    'date-chip--muted': cell.kind === 'day' && !cell.available,
                    'date-chip--active': cell.date === selectedDate,
                    'date-chip--today': cell.date === todayDate(),
                  }"
                  :disabled="cell.kind !== 'day' || !cell.available"
                  @click="cell.date && handleDatePick(cell.date)"
                >
                  <template v-if="cell.kind === 'day'">
                    <span class="date-chip__day">{{ cell.dayNumber }}</span>
                  </template>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="hourSheetOpen" class="date-sheet-overlay" @click.self="hourSheetOpen = false">
        <div class="hour-sheet">
          <div class="hour-sheet__header">
            <div>
              <div class="date-sheet__kicker">时间定位</div>
              <h3>{{ selectedDateDisplay }}</h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="hourSheetOpen = false">×</button>
          </div>

          <div class="hour-sheet__body">
            <button
              v-for="anchor in hourAnchors"
              :key="anchor.id"
              type="button"
              class="hour-chip"
              @click="jumpToHour(anchor)"
            >
              <span class="hour-chip__hour mono">{{ anchor.hourLabel }}</span>
              <span class="hour-chip__count">{{ anchor.count }} 条</span>
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <div
      v-if="showFloatingLauncher && !dateSheetOpen && !hourSheetOpen"
      class="floating-actions"
      :class="{ 'floating-actions--open': floatingActionsOpen }"
    >
      <div v-if="floatingActionsOpen" class="floating-actions__menu">
        <button
          v-if="hourAnchors.length"
          type="button"
          class="floating-action-button"
          title="时间定位"
          @click="handleFloatingAction(openHourSheet)"
        >
          时
        </button>
        <button
          type="button"
          class="floating-action-button"
          title="同步"
          @click="handleFloatingAction(load)"
        >
          ↻
        </button>
        <button
          type="button"
          class="floating-action-button"
          title="回到顶部"
          @click="handleFloatingAction(scrollToTop)"
        >
          ↑
        </button>
        <button
          type="button"
          class="floating-action-button"
          title="前往底部"
          @click="handleFloatingAction(scrollToBottom)"
        >
          ↓
        </button>
      </div>
      <button
        type="button"
        class="floating-action-toggle"
        :title="floatingActionsOpen ? '收起快捷操作' : '打开快捷操作'"
        @click="floatingActionsOpen = !floatingActionsOpen"
      >
        {{ floatingActionsOpen ? "×" : "⋮" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const loading = ref(false);
const error = ref("");
const days = ref([]);
const state = ref({});
const threadExpanded = ref(false);
const dateSheetOpen = ref(false);
const currentCalendarMonth = ref("");
const showFloatingLauncher = ref(false);
const floatingActionsOpen = ref(false);
const attachmentObjectUrls = ref({});
const hourSheetOpen = ref(false);
const messageRefs = new Map();

const calendarWeekdays = ["一", "二", "三", "四", "五", "六", "日"];

const transcriptDays = computed(() => (
  Array.isArray(days.value)
    ? days.value.map(buildTranscriptDay).filter((day) => day.items.length)
    : []
));
const availableConversationDates = computed(() => transcriptDays.value.map((day) => day.date).filter(Boolean));
const availableDateSet = computed(() => new Set(availableConversationDates.value));
const selectedDate = ref("");
const filteredTranscriptDays = computed(() => {
  if (!selectedDate.value) {
    return transcriptDays.value.slice(0, 1);
  }
  return transcriptDays.value.filter((day) => day.date === selectedDate.value);
});
const selectedDateDisplay = computed(() => formatConversationDateDisplay(selectedDate.value));
const activeCalendarMonth = computed(() => buildCalendarMonth(
  currentCalendarMonth.value || resolveCalendarMonth(selectedDate.value),
  availableDateSet.value,
));
const visibleImageAttachments = computed(() => filteredTranscriptDays.value
  .flatMap((day) => Array.isArray(day?.items) ? day.items : [])
  .flatMap((item) => item?.kind === "message" && Array.isArray(item.imageAttachments) ? item.imageAttachments : [])
  .filter((attachment) => attachment?.filePath));
const hourAnchors = computed(() => {
  const groups = new Map();

  for (const day of filteredTranscriptDays.value) {
    for (const item of Array.isArray(day?.items) ? day.items : []) {
      if (item?.kind !== "message") {
        continue;
      }
      const hourLabel = formatHourLabel(item.timestamp);
      if (!hourLabel) {
        continue;
      }
      const current = groups.get(hourLabel) || {
        id: item.id,
        hourLabel,
        count: 0,
      };
      current.count += 1;
      groups.set(hourLabel, current);
    }
  }

  return Array.from(groups.values()).sort((left, right) => left.hourLabel.localeCompare(right.hourLabel));
});

const currentThread = computed(() => (
  resolveCurrentThreadFromDays(days.value) || resolveCurrentThreadFromSessions(state.value.sessions)
));
const currentThreadLabel = computed(() => {
  if (!currentThread.value.fullId) {
    return "";
  }
  if (threadExpanded.value) {
    return `线程：${currentThread.value.fullId}`;
  }
  return `线程：${currentThread.value.shortId}`;
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [conversationResult, stateResult] = await Promise.all([
      cyberbossApi.fetchConversations(10),
      cyberbossApi.fetchState(),
    ]);
    days.value = Array.isArray(conversationResult.days) ? conversationResult.days : [];
    state.value = stateResult || {};
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function updateFloatingLauncher() {
  if (loading.value || error.value || !filteredTranscriptDays.value.length) {
    showFloatingLauncher.value = false;
    floatingActionsOpen.value = false;
    return;
  }

  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  showFloatingLauncher.value = scrollableHeight > 180;

  if (!showFloatingLauncher.value) {
    floatingActionsOpen.value = false;
  }
}

function handleFloatingAction(action) {
  floatingActionsOpen.value = false;
  action();
}

function openHourSheet() {
  hourSheetOpen.value = true;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
}

function toggleThreadExpanded() {
  threadExpanded.value = !threadExpanded.value;
}

function handleDatePick(date) {
  if (!availableDateSet.value.has(date)) {
    return;
  }
  selectedDate.value = date;
  dateSheetOpen.value = false;
}

function setMessageRef(id, element) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return;
  }
  if (element) {
    messageRefs.set(normalizedId, element);
  } else {
    messageRefs.delete(normalizedId);
  }
}

function jumpToHour(anchor) {
  const element = messageRefs.get(String(anchor?.id || "").trim());
  if (element instanceof HTMLElement) {
    hourSheetOpen.value = false;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function switchCalendarMonth(direction) {
  const delta = direction === "older" ? -1 : 1;
  currentCalendarMonth.value = shiftMonthKey(
    activeCalendarMonth.value?.monthKey || resolveCalendarMonth(selectedDate.value),
    delta,
  );
}

function buildTranscriptDay(day) {
  const items = [];
  let pendingBefore = [];
  let lastAssistantItem = null;

  for (const event of Array.isArray(day?.events) ? day.events : []) {
    if (event?.type === "separator") {
      continue;
    }

    if (event?.type === "user") {
      if (pendingBefore.length) {
        items.push(createMetaOnlyItem(pendingBefore, day.date, items.length));
        pendingBefore = [];
      }
      items.push({
        id: event.id,
        kind: "message",
        role: "user",
        text: event.text,
        timestamp: event.timestamp,
        attachments: normalizeAttachmentsFromMeta(event.meta),
        imageAttachments: extractImageAttachments(event.meta),
        before: [],
        after: [],
      });
      lastAssistantItem = null;
      continue;
    }

    if (event?.type === "assistant") {
      const assistantItem = {
        id: event.id,
        kind: "message",
        role: "assistant",
        text: event.text,
        timestamp: event.timestamp,
        attachments: normalizeAttachmentsFromMeta(event.meta),
        imageAttachments: extractImageAttachments(event.meta),
        before: pendingBefore,
        after: [],
      };
      pendingBefore = [];
      items.push(assistantItem);
      lastAssistantItem = assistantItem;
      continue;
    }

    if (isMetaEvent(event)) {
      const normalized = {
        ...event,
        preview: buildMetaPreview(event),
      };
      if (lastAssistantItem) {
        lastAssistantItem.after.push(normalized);
      } else {
        pendingBefore.push(normalized);
      }
    }
  }

  if (pendingBefore.length) {
    items.push(createMetaOnlyItem(pendingBefore, day.date, items.length));
  }

  return {
    date: day.date,
    threadIds: Array.isArray(day.threadIds) ? day.threadIds : [],
    items,
  };
}

function createMetaOnlyItem(meta, day, index) {
  return {
    id: `${day}:meta:${index + 1}`,
    kind: "meta-only",
    meta,
  };
}

function isMetaEvent(event) {
  return ["thinking", "tool_use", "tool_result", "approval"].includes(event?.type);
}

function metaLabel(event) {
  const labelMap = {
    thinking: "Thinking",
    tool_use: "工具调用",
    tool_result: "工具结果",
    approval: "授权",
  };
  return labelMap[event?.type] || "附加事件";
}

function buildMetaPreview(event) {
  const text = cleanEventText(event?.text || "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) {
    return "";
  }
  return text.length > 54 ? `${text.slice(0, 51)}...` : text;
}

function cleanEventText(input) {
  return String(input || "")
    .replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?\]\s*/u, "")
    .trim();
}

function normalizeAttachmentsFromMeta(meta) {
  const attachments = Array.isArray(meta?.attachments) ? meta.attachments : [];
  return attachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== "object") {
        return null;
      }
      return {
        kind: String(attachment.kind || "").trim(),
        label: String(attachment.label || "").trim(),
        fileName: String(attachment.fileName || "").trim(),
        filePath: String(attachment.filePath || "").trim(),
      };
    })
    .filter(Boolean);
}

function extractImageAttachments(meta) {
  return normalizeAttachmentsFromMeta(meta).filter((attachment) => attachment.kind === "image" && attachment.filePath);
}

function messageBodyText(item) {
  const text = cleanEventText(item?.text || "");
  if (!Array.isArray(item?.imageAttachments) || !item.imageAttachments.length) {
    return text;
  }
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("[图片]"))
    .join("\n")
    .trim();
}

function attachmentObjectUrl(attachment) {
  const filePath = String(attachment?.filePath || "").trim();
  return filePath ? attachmentObjectUrls.value[filePath] || "" : "";
}

function openImageAttachment(attachment) {
  const url = attachmentObjectUrl(attachment);
  if (url && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function ensureVisibleAttachmentUrls() {
  const nextUrls = { ...attachmentObjectUrls.value };
  const pending = [];

  for (const attachment of visibleImageAttachments.value) {
    const filePath = String(attachment?.filePath || "").trim();
    if (!filePath || Object.prototype.hasOwnProperty.call(nextUrls, filePath)) {
      continue;
    }
    pending.push(
      cyberbossApi.fetchConversationAttachmentBlob(filePath)
        .then((blob) => {
          nextUrls[filePath] = URL.createObjectURL(blob);
        })
        .catch(() => {
          nextUrls[filePath] = "";
        }),
    );
  }

  if (!pending.length) {
    return;
  }

  await Promise.all(pending);
  attachmentObjectUrls.value = nextUrls;
}

function revokeAttachmentUrls() {
  for (const value of Object.values(attachmentObjectUrls.value)) {
    if (value) {
      URL.revokeObjectURL(value);
    }
  }
  attachmentObjectUrls.value = {};
}

function formatTime(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(parsed));
}

function formatHourLabel(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(parsed));
}

function formatDayLabel(value) {
  const parsed = Date.parse(`${value}T00:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return value || "未知日期";
  }
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const parts = formatter.formatToParts(new Date(parsed));
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  return `${month}月${day}日 ${weekday}`;
}

function formatConversationDateDisplay(date) {
  const normalized = String(date || "").trim();
  if (!normalized) {
    return "选择日期";
  }
  return `${normalized} · ${formatWeekdayLabel(normalized)}`;
}

function formatWeekdayLabel(date) {
  const parsed = Date.parse(`${String(date || "").trim()}T00:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(new Date(parsed));
}

function buildCalendarMonth(monthKey, availableDates) {
  const normalizedMonth = String(monthKey || "").trim();
  if (!normalizedMonth) {
    return null;
  }
  const [yearText, monthText] = normalizedMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  const totalDays = new Date(year, month, 0).getDate();
  const firstWeekday = getMondayBasedWeekdayIndex(`${normalizedMonth}-01`);
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({
      key: `${normalizedMonth}-placeholder-${index}`,
      kind: "placeholder",
    });
  }

  for (let dayNumber = 1; dayNumber <= totalDays; dayNumber += 1) {
    const date = `${normalizedMonth}-${String(dayNumber).padStart(2, "0")}`;
    cells.push({
      key: date,
      kind: "day",
      date,
      dayNumber,
      available: availableDates.has(date),
    });
  }

  return {
    monthKey: normalizedMonth,
    monthLabel: formatMonthLabel(normalizedMonth),
    cells,
  };
}

function resolveCalendarMonth(date) {
  const normalized = String(date || "").trim();
  if (normalized) {
    return normalized.slice(0, 7);
  }
  return todayDate().slice(0, 7);
}

function formatMonthLabel(monthKey) {
  const normalized = String(monthKey || "").trim();
  if (!normalized) {
    return "";
  }
  const [year, month] = normalized.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function shiftMonthKey(monthKey, delta) {
  const normalized = String(monthKey || "").trim();
  const [yearText, monthText] = normalized.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return resolveCalendarMonth(selectedDate.value);
  }
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function getMondayBasedWeekdayIndex(date) {
  const parsed = Date.parse(`${String(date || "").trim()}T12:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const weekday = new Date(parsed).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function resolveCurrentThreadFromDays(inputDays) {
  const events = Array.isArray(inputDays)
    ? inputDays
      .flatMap((day) => Array.isArray(day?.events) ? day.events : [])
      .filter((event) => event && typeof event === "object" && typeof event.threadId === "string" && event.threadId.trim())
      .sort((left, right) => {
        const leftTime = Date.parse(left.timestamp || "") || 0;
        const rightTime = Date.parse(right.timestamp || "") || 0;
        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }
        return String(right.id || "").localeCompare(String(left.id || ""));
      })
    : [];
  if (!events.length) {
    return null;
  }
  const latest = events[0];
  return {
    runtimeId: "",
    workspaceRoot: "",
    fullId: latest.threadId.trim(),
    shortId: shortenThreadId(latest.threadId),
    updatedAt: latest.timestamp || "",
  };
}

function resolveCurrentThreadFromSessions(sessions) {
  const bindings = sessions && typeof sessions === "object" && sessions.bindings && typeof sessions.bindings === "object"
    ? sessions.bindings
    : {};

  const candidates = Object.values(bindings)
    .filter((binding) => binding && typeof binding === "object")
    .map((binding) => {
      const runtimeMap = binding.threadIdByWorkspaceRootByRuntime && typeof binding.threadIdByWorkspaceRootByRuntime === "object"
        ? binding.threadIdByWorkspaceRootByRuntime
        : {};
      const activeWorkspaceRoot = typeof binding.activeWorkspaceRoot === "string"
        ? binding.activeWorkspaceRoot.trim()
        : "";
      const updatedAt = typeof binding.updatedAt === "string" ? binding.updatedAt.trim() : "";

      for (const [runtimeId, workspaceMap] of Object.entries(runtimeMap)) {
        if (!workspaceMap || typeof workspaceMap !== "object") {
          continue;
        }
        const preferredThreadId = activeWorkspaceRoot && typeof workspaceMap[activeWorkspaceRoot] === "string"
          ? workspaceMap[activeWorkspaceRoot].trim()
          : "";
        if (preferredThreadId) {
          return {
            runtimeId: String(runtimeId || "").trim(),
            workspaceRoot: activeWorkspaceRoot,
            fullId: preferredThreadId,
            shortId: shortenThreadId(preferredThreadId),
            updatedAt,
          };
        }
        for (const [workspaceRoot, threadId] of Object.entries(workspaceMap)) {
          const normalizedThreadId = typeof threadId === "string" ? threadId.trim() : "";
          if (normalizedThreadId) {
            return {
              runtimeId: String(runtimeId || "").trim(),
              workspaceRoot: String(workspaceRoot || "").trim(),
              fullId: normalizedThreadId,
              shortId: shortenThreadId(normalizedThreadId),
              updatedAt,
            };
          }
        }
      }
      return null;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || "") || 0;
      const rightTime = Date.parse(right.updatedAt || "") || 0;
      return rightTime - leftTime;
    });

  return candidates[0] || {
    runtimeId: "",
    workspaceRoot: "",
    fullId: "",
    shortId: "",
    updatedAt: "",
  };
}

function shortenThreadId(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= 12) {
    return text;
  }
  return `${text.slice(0, 8)}…`;
}

function resolveDefaultConversationDate(items) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }
  const today = todayDate();
  return items.find((item) => item.date === today)?.date || items[0]?.date || "";
}

watch(transcriptDays, (nextDays) => {
  if (!Array.isArray(nextDays) || !nextDays.length) {
    selectedDate.value = "";
    return;
  }
  const availableDates = new Set(nextDays.map((day) => day.date).filter(Boolean));
  if (!selectedDate.value || !availableDates.has(selectedDate.value)) {
    selectedDate.value = resolveDefaultConversationDate(nextDays);
  }
}, { immediate: true });

watch(dateSheetOpen, (open) => {
  if (open) {
    currentCalendarMonth.value = resolveCalendarMonth(selectedDate.value);
    floatingActionsOpen.value = false;
  }
});

watch(hourSheetOpen, (open) => {
  if (open) {
    floatingActionsOpen.value = false;
  }
});

watch(
  visibleImageAttachments,
  async () => {
    await ensureVisibleAttachmentUrls();
  },
  { immediate: true },
);

watch(
  () => [loading.value, error.value, filteredTranscriptDays.value.length, selectedDate.value],
  async () => {
    await nextTick();
    updateFloatingLauncher();
  },
  { immediate: true },
);

onMounted(() => {
  load();
  window.addEventListener("scroll", updateFloatingLauncher, { passive: true });
  window.addEventListener("resize", updateFloatingLauncher);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateFloatingLauncher);
  window.removeEventListener("resize", updateFloatingLauncher);
  revokeAttachmentUrls();
});
</script>

<style scoped>
.page-head {
  position: relative;
  margin-bottom: 18px;
}

.page-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.meta-trigger {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.12);
  border-radius: 999px;
  width: 24px;
  height: 24px;
  padding: 0;
  background: rgba(255, 253, 249, 0.9);
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.meta-trigger--link {
  text-decoration: none;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.thread-chip {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 999px;
  min-height: 28px;
  padding: 0 10px;
  background: rgba(255, 253, 249, 0.88);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.thread-chip__icon {
  position: relative;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.thread-chip__icon::before,
.thread-chip__icon::after {
  content: "";
  position: absolute;
}

.thread-chip__icon::before {
  left: 1px;
  top: 6px;
  width: 7px;
  height: 1.5px;
  border-radius: 999px;
  background: rgba(49, 81, 30, 0.72);
}

.thread-chip__icon::after {
  right: 0;
  top: 3px;
  width: 6px;
  height: 6px;
  border: 1.5px solid rgba(49, 81, 30, 0.72);
  border-radius: 999px;
}

.thread-chip__label {
  max-width: min(52vw, 220px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-select-trigger,
.date-chip {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  font: inherit;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.date-select-trigger {
  border-radius: 999px;
  min-height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.date-select-trigger__label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.date-select-trigger__icon {
  color: var(--muted);
  flex: 0 0 auto;
}

.date-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(24, 35, 15, 0.32);
  backdrop-filter: blur(4px);
}

.date-sheet {
  width: min(100%, 420px);
  max-height: min(78vh, 620px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px 14px;
  background: linear-gradient(180deg, #fbf7ef 0%, #f4efe6 100%);
  border-radius: 24px;
  box-shadow: 0 20px 48px rgba(24, 35, 15, 0.18);
}

.date-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.date-sheet__kicker {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.date-sheet__header h3 {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.3;
}

.modal-close {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.1);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  padding: 0;
  background: rgba(255, 253, 249, 0.92);
  color: var(--muted);
  font: inherit;
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.date-sheet__body {
  overflow-y: auto;
}

.date-calendar {
  padding: 12px;
}

.date-calendar__topbar {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.date-calendar__switch {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 12px;
  min-height: 36px;
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  font: inherit;
  font-size: 22px;
  line-height: 1;
}

.hour-sheet {
  width: min(100%, 360px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px 14px;
  background: linear-gradient(180deg, #fbf7ef 0%, #f4efe6 100%);
  border-radius: 24px;
  box-shadow: 0 20px 48px rgba(24, 35, 15, 0.18);
}

.hour-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.hour-sheet__header h3 {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.3;
}

.hour-sheet__body {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.hour-chip {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 16px;
  padding: 12px 8px;
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  text-align: center;
  display: grid;
  gap: 4px;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.hour-chip__hour {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.hour-chip__count {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.2;
}

.date-calendar__title {
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.date-weekdays,
.date-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.date-weekdays {
  gap: 6px;
  margin-bottom: 8px;
}

.date-weekdays__item {
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.date-calendar__grid {
  gap: 8px;
}

.date-chip {
  border-radius: 14px;
  min-height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  text-align: center;
}

.date-chip:disabled {
  cursor: default;
}

.date-chip--placeholder {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.date-chip--muted {
  opacity: 0.35;
}

.date-chip--active {
  background: #eef4e5;
  border-color: rgba(49, 81, 30, 0.2);
}

.date-chip--today:not(.date-chip--active) {
  border-color: rgba(49, 81, 30, 0.16);
  background: rgba(238, 244, 229, 0.42);
}

.date-chip__day {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.floating-actions {
  position: fixed;
  right: 16px;
  bottom: 88px;
  z-index: 2100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.floating-actions__menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.floating-action-toggle,
.floating-action-button {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.12);
  border-radius: 999px;
  width: 42px;
  height: 42px;
  padding: 0;
  background: rgba(255, 253, 249, 0.96);
  color: var(--ink);
  font: inherit;
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 22px rgba(24, 35, 15, 0.12);
  backdrop-filter: blur(10px);
}

.floating-action-toggle {
  width: 48px;
  height: 48px;
  font-size: 22px;
  color: var(--accent);
  background: rgba(238, 244, 229, 0.98);
  border-color: rgba(49, 81, 30, 0.16);
  line-height: 1;
  padding-top: 1px;
}

.floating-actions--open .floating-action-toggle {
  background: rgba(255, 253, 249, 0.98);
}

.day-list {
  display: grid;
  gap: 22px;
}

.day-block {
  display: grid;
  gap: 14px;
}

.day-divider {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px;
}

.day-divider__date {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

.day-divider__meta {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.transcript {
  display: grid;
  gap: 14px;
}

.chat-row {
  display: grid;
  gap: 8px;
}

.chat-row--user {
  justify-items: end;
}

.chat-row--assistant {
  justify-items: start;
}

.chat-bubble {
  width: min(100%, 82%);
  padding: 12px 14px;
}

.chat-bubble--user {
  background: var(--user);
}

.chat-bubble--assistant {
  background: var(--assistant);
}

.chat-bubble__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 12px;
}

.chat-bubble__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.chat-bubble__images {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.chat-image-card {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 16px;
  padding: 8px;
  background: rgba(255, 253, 249, 0.86);
  text-align: left;
}

.chat-image-card__image,
.chat-image-card__placeholder {
  display: block;
  width: 100%;
  border-radius: 12px;
}

.chat-image-card__image {
  max-height: 280px;
  object-fit: cover;
  background: rgba(24, 35, 15, 0.04);
}

.chat-image-card__placeholder {
  min-height: 120px;
  display: grid;
  place-items: center;
  color: var(--muted);
  background: rgba(24, 35, 15, 0.04);
}

.chat-image-card__label {
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
}

.sidecar-stack {
  width: min(100%, 82%);
  display: grid;
  gap: 6px;
}

.sidecar-fold {
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(24, 35, 15, 0.06);
  background: rgba(255, 253, 249, 0.76);
}

.sidecar-fold--thinking {
  background: rgba(244, 239, 229, 0.88);
}

.sidecar-fold--tool_use,
.sidecar-fold--tool_result,
.sidecar-fold--approval {
  background: rgba(237, 242, 250, 0.88);
}

.sidecar-fold__summary {
  list-style: none;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  line-height: 1.4;
}

.sidecar-fold__summary::-webkit-details-marker {
  display: none;
}

.sidecar-fold__title {
  color: var(--ink);
  font-weight: 600;
  white-space: nowrap;
}

.sidecar-fold__preview {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidecar-fold__time {
  white-space: nowrap;
}

.sidecar-fold__body {
  margin: 0;
  padding: 0 10px 10px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--muted);
}

@media (max-width: 640px) {
  .chat-bubble,
  .sidecar-stack {
    width: min(100%, 88%);
  }

  .day-divider {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
