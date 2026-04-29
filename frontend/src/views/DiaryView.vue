<template>
  <div class="page">
    <section class="page-head">
      <h1 class="page-title">日记</h1>
      <p class="page-subtitle">这里直接查看每天的日记内容，按日期翻看，保持和你平时写日记时接近的阅读感。</p>

      <section v-if="datedFiles.length && !loadingFiles && !error" class="date-nav">
        <button
          type="button"
          class="date-nav__arrow"
          :disabled="!olderFile"
          @click="selectNeighborFile('older')"
        >
          ‹
        </button>
        <button
          type="button"
          class="date-nav__current"
          @click="dateSheetOpen = true"
        >
          <span class="date-nav__current-date">{{ selectedFileDisplay }}</span>
        </button>
        <button
          type="button"
          class="date-nav__arrow"
          :disabled="!newerFile"
          @click="selectNeighborFile('newer')"
        >
          ›
        </button>
      </section>
    </section>

    <van-loading v-if="loadingFiles" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <template v-else>
      <section class="section-card file-card">
        <div class="file-header">
          <strong>{{ current.fileName || selectedFile || "未选择" }}</strong>
        </div>
        <div
          v-if="current.text"
          class="markdown-body"
          v-html="renderMarkdown(current.text)"
        ></div>
        <div v-else class="empty-copy">还没有内容</div>
      </section>
    </template>

    <teleport to="body">
      <div v-if="dateSheetOpen" class="date-sheet-overlay" @click.self="dateSheetOpen = false">
        <div class="date-sheet">
          <div class="date-sheet__header">
            <div>
              <div class="date-sheet__kicker">日期选择</div>
              <h3>{{ selectedFileDisplay }}</h3>
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const loadingFiles = ref(false);
const error = ref("");
const files = ref([]);
const selectedFile = ref("");
const current = ref({});
const dateSheetOpen = ref(false);
const currentCalendarMonth = ref("");

const calendarWeekdays = ["一", "二", "三", "四", "五", "六", "日"];

const datedFiles = computed(() => (Array.isArray(files.value) ? files.value : [])
  .map((file) => {
    const date = extractDiaryDate(file);
    return date ? { file, date } : null;
  })
  .filter(Boolean)
  .sort((left, right) => right.date.localeCompare(left.date)));

const selectedEntry = computed(() => (
  datedFiles.value.find((entry) => entry.file === selectedFile.value) || null
));

const selectedDate = computed(() => selectedEntry.value?.date || "");
const selectedFileIndex = computed(() => datedFiles.value.findIndex((entry) => entry.file === selectedFile.value));
const olderFile = computed(() => {
  const index = selectedFileIndex.value;
  return index >= 0 ? datedFiles.value[index + 1]?.file || "" : "";
});
const newerFile = computed(() => {
  const index = selectedFileIndex.value;
  return index > 0 ? datedFiles.value[index - 1]?.file || "" : "";
});
const selectedFileDisplay = computed(() => formatDiaryDateDisplay(selectedDate.value, selectedFile.value));
const availableDateSet = computed(() => new Set(
  datedFiles.value.map((entry) => String(entry.date || "").trim()).filter(Boolean),
));
const activeCalendarMonth = computed(() => buildCalendarMonth(
  currentCalendarMonth.value || resolveCalendarMonth(selectedDate.value),
  availableDateSet.value,
));

async function loadFiles() {
  loadingFiles.value = true;
  error.value = "";
  try {
    const result = await cyberbossApi.fetchDiaryFiles();
    files.value = Array.isArray(result.files) ? result.files : [];
    selectedFile.value = resolveDefaultFile();
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingFiles.value = false;
  }
}

function resolveDefaultFile() {
  if (datedFiles.value.length) {
    const today = todayDate();
    return datedFiles.value.find((entry) => entry.date === today)?.file || datedFiles.value[0]?.file || "";
  }
  return files.value[0] || "";
}

async function loadCurrent() {
  if (!selectedFile.value) {
    current.value = {};
    return;
  }
  current.value = await cyberbossApi.fetchDiaryFile(selectedFile.value);
}

function renderMarkdown(source) {
  const text = String(source || "").replace(/\r\n?/gu, "\n");
  if (!text.trim()) {
    return "";
  }

  const lines = text.split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let orderedList = false;
  let blockquoteLines = [];
  let codeFence = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }
    blocks.push(`<p>${renderInline(paragraphLines.join("<br />"))}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) {
      return;
    }
    const tag = orderedList ? "ol" : "ul";
    blocks.push(`<${tag}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`);
    listItems = [];
  };

  const flushBlockquote = () => {
    if (!blockquoteLines.length) {
      return;
    }
    blocks.push(`<blockquote>${renderInline(blockquoteLines.join("<br />"))}</blockquote>`);
    blockquoteLines = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
  };

  for (const line of lines) {
    if (codeFence) {
      if (/^```/u.test(line)) {
        blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
        codeFence = null;
      } else {
        codeFence.push(line);
      }
      continue;
    }

    if (/^```/u.test(line)) {
      flushAll();
      codeFence = [];
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/u);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^---+$|^\*\*\*+$|^___+$/u.test(line.trim())) {
      flushAll();
      blocks.push("<hr />");
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/u);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blockquoteLines.push(quoteMatch[1]);
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/u);
    if (unorderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listItems.length && orderedList) {
        flushList();
      }
      orderedList = false;
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/u);
    if (orderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listItems.length && !orderedList) {
        flushList();
      }
      orderedList = true;
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    flushBlockquote();
    paragraphLines.push(line);
  }

  if (codeFence) {
    blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
  }

  flushAll();
  return blocks.join("");
}

function renderInline(input) {
  return escapeHtml(input)
    .replace(/`([^`]+)`/gu, (_, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gu, (_, label, href) => (
      `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
    ))
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/gu, "<em>$1</em>");
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function escapeAttribute(input) {
  return escapeHtml(input);
}

function selectNeighborFile(direction) {
  const nextFile = direction === "older" ? olderFile.value : newerFile.value;
  if (nextFile) {
    selectedFile.value = nextFile;
  }
}

function handleDatePick(date) {
  const match = datedFiles.value.find((entry) => entry.date === date);
  if (!match) {
    return;
  }
  selectedFile.value = match.file;
  dateSheetOpen.value = false;
}

function switchCalendarMonth(direction) {
  const delta = direction === "older" ? -1 : 1;
  currentCalendarMonth.value = shiftMonthKey(
    activeCalendarMonth.value?.monthKey || resolveCalendarMonth(selectedDate.value),
    delta,
  );
}

function extractDiaryDate(fileName) {
  const match = String(fileName || "").trim().match(/(\d{4}-\d{2}-\d{2})/u);
  return match?.[1] || "";
}

function formatDiaryDateDisplay(date, fileName) {
  const normalized = String(date || "").trim();
  if (normalized) {
    return `${normalized} · ${formatWeekdayLabel(normalized)}`;
  }
  return fileName || "选择日记";
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

watch(selectedFile, () => {
  loadCurrent().catch((err) => {
    error.value = err.message;
  });
});

watch(dateSheetOpen, (open) => {
  if (open) {
    currentCalendarMonth.value = resolveCalendarMonth(selectedDate.value);
  }
});

onMounted(async () => {
  await loadFiles();
  await loadCurrent();
});
</script>

<style scoped>
.page-head {
  position: relative;
  margin-bottom: 18px;
}

.date-nav {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 8px;
}

.date-nav__arrow,
.date-nav__current,
.date-chip {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  font: inherit;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.date-nav__arrow {
  border-radius: 14px;
  min-height: 44px;
  font-size: 22px;
  line-height: 1;
}

.date-nav__arrow:disabled {
  opacity: 0.38;
}

.date-nav__current {
  border-radius: 16px;
  min-height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.date-nav__current-date {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
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

.file-card {
  padding: 14px;
}

.file-header {
  margin-bottom: 12px;
  color: var(--muted);
}

.empty-copy {
  color: var(--muted);
  font-size: 14px;
}

.markdown-body {
  color: var(--ink);
  font-size: 14px;
  line-height: 1.7;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1.1em 0 0.45em;
  line-height: 1.3;
}

.markdown-body :deep(h1) {
  font-size: 22px;
}

.markdown-body :deep(h2) {
  font-size: 19px;
}

.markdown-body :deep(h3) {
  font-size: 17px;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre) {
  margin: 0 0 12px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
}

.markdown-body :deep(li + li) {
  margin-top: 4px;
}

.markdown-body :deep(blockquote) {
  padding: 8px 12px;
  border-left: 3px solid rgba(49, 81, 30, 0.24);
  background: rgba(238, 244, 229, 0.32);
  color: var(--muted);
}

.markdown-body :deep(pre) {
  overflow-x: auto;
  padding: 12px;
  border-radius: 12px;
  background: rgba(24, 35, 15, 0.06);
}

.markdown-body :deep(code) {
  font-family: "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
}

.markdown-body :deep(p code),
.markdown-body :deep(li code),
.markdown-body :deep(blockquote code) {
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(24, 35, 15, 0.06);
}

.markdown-body :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(24, 35, 15, 0.08);
  margin: 16px 0;
}
</style>
