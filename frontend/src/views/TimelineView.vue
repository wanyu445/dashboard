<template>
  <div class="page">
    <section class="page-head">
      <div class="page-head__top">
        <div class="page-title-row">
          <div class="title-meta">
            <h1 class="page-title">时间轴</h1>
            <button
              type="button"
              class="meta-trigger"
              :class="{ 'meta-trigger--active': metaTipOpen }"
              title="页面信息"
              @click="metaTipOpen = !metaTipOpen"
            >
              !
            </button>
            <button
              type="button"
              class="meta-trigger"
              title="同步数据"
              @click="load"
            >
              ↻
            </button>
          </div>
          <div class="title-actions">
            <button
              type="button"
              class="meta-pill"
              title="切换时间轴与分布"
              @click="toggleActiveView"
            >
              {{ activeView === "timeline" ? "分布" : "时间轴" }}
            </button>
            <button
              type="button"
              class="meta-pill"
              :disabled="!recentWeeks.length"
              title="周视图"
              @click="weekSheetOpen = true"
            >
              周
            </button>
            <a
              v-if="overview.siteAvailable"
              class="meta-trigger meta-trigger--link"
              :href="overview.siteUrl"
              target="_blank"
              title="打开完整时间轴"
            >
              ↗
            </a>
          </div>
        </div>

        <section v-if="metaTipOpen" class="meta-popover section-card">
          <div class="meta-row">
            <span>已收录日期</span>
            <strong>{{ overview.meta?.availableDates?.length || 0 }}</strong>
          </div>
          <div class="meta-row">
            <span>当前最新</span>
            <strong>{{ overview.meta?.latestDate || "—" }}</strong>
          </div>
          <div class="meta-row">
            <span>记录条目</span>
            <strong>{{ overview.factsSummary?.factCount || 0 }}</strong>
          </div>
          <div class="meta-row">
            <span>页面用途</span>
            <strong>查看某天做了什么，并切到分布页看时间分配</strong>
          </div>
        </section>
      </div>

      <p class="page-subtitle">用来回看今天或某一天的行动记录，也能顺手切到分布页看时间都落在了哪里。</p>

      <section
        v-if="recentDays.length && activeView === 'timeline' && !loading && !error"
        ref="dateNavRef"
        class="date-nav"
      >
        <button
          type="button"
          class="date-nav__arrow"
          :disabled="!olderDate"
          @click="selectNeighborDate('older')"
        >
          ‹
        </button>
        <button
          type="button"
          class="date-nav__current"
          @click="dateSheetOpen = true"
        >
          <span class="date-nav__current-date">{{ selectedDateDisplay }}</span>
        </button>
        <button
          type="button"
          class="date-nav__arrow"
          :disabled="!newerDate"
          @click="selectNeighborDate('newer')"
        >
          ›
        </button>
      </section>
    </section>
    <van-loading v-if="loading" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <div v-else class="timeline-grid">
      <template v-if="activeView === 'timeline'">
        <section class="days-section">
          <van-empty v-if="!selectedDay" description="还没读到 timeline 日数据" />

          <template v-else>
            <div class="day-items">
              <article
                v-for="item in selectedDay.items"
                :key="item.id"
                class="day-item"
                :class="[item.className, { 'day-item--active': item.id === selectedItemId }]"
                @click="selectedItemId = item.id"
              >
                <div class="item-time">{{ item.timeText || formatRange(item.start, item.end) }}</div>
                <div class="item-title">{{ item.title || item.content }}</div>
                <div v-if="item.note" class="item-note">备注：{{ item.note }}</div>
              </article>
            </div>
          </template>
        </section>

      </template>

      <TimelineDistributionPanel
        v-else
        :analytics="analytics"
        :selected-date="selectedDate"
      />
    </div>

    <WeekTimelineSheet
      v-model:show="weekSheetOpen"
      :weeks="recentWeeks"
      :selected-date="selectedDate"
      @select-day="selectedDate = $event"
    />

    <button
      v-if="showScrollTopFab && activeView === 'timeline' && !dateSheetOpen && !weekSheetOpen"
      type="button"
      class="scroll-top-fab"
      title="回到顶部"
      @click="scrollToDateNav"
    >
      ↑
    </button>

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
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { cyberbossApi } from "../api/cyberboss";
import TimelineDistributionPanel from "../components/TimelineDistributionPanel.vue";
import WeekTimelineSheet from "../components/WeekTimelineSheet.vue";

const loading = ref(false);
const error = ref("");
const overview = ref({});
const metaTipOpen = ref(false);
const dateSheetOpen = ref(false);
const currentCalendarMonth = ref("");
const selectedDate = ref("");
const selectedItemId = ref("");
const weekSheetOpen = ref(false);
const activeView = ref("timeline");
const dateNavRef = ref(null);
const showScrollTopFab = ref(false);

const recentDays = computed(() => Array.isArray(overview.value?.recentDays) ? overview.value.recentDays : []);
const recentWeeks = computed(() => Array.isArray(overview.value?.recentWeeks) ? overview.value.recentWeeks : []);
const analytics = computed(() => overview.value?.analytics || {});
const selectedDay = computed(() => recentDays.value.find((day) => day.date === selectedDate.value) || null);
const selectedDateIndex = computed(() => recentDays.value.findIndex((day) => day.date === selectedDate.value));
const calendarWeekdays = ["一", "二", "三", "四", "五", "六", "日"];
const availableDateSet = computed(() => new Set(
  recentDays.value.map((day) => String(day?.date || "").trim()).filter(Boolean),
));
const olderDate = computed(() => {
  const index = selectedDateIndex.value;
  return index >= 0 ? recentDays.value[index + 1]?.date || "" : "";
});
const newerDate = computed(() => {
  const index = selectedDateIndex.value;
  return index > 0 ? recentDays.value[index - 1]?.date || "" : "";
});
const selectedDateDisplay = computed(() => formatSelectedDateDisplay(selectedDate.value, selectedDay.value?.itemCount || 0));
const activeCalendarMonth = computed(() => buildCalendarMonth(
  currentCalendarMonth.value || resolveCalendarMonth(selectedDate.value),
  availableDateSet.value,
));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    overview.value = await cyberbossApi.fetchTimeline();
    selectedDate.value = resolveDefaultDate(recentDays.value);
    selectedItemId.value = firstItemIdForDate(selectedDate.value);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function updateScrollTopFab() {
  if (
    activeView.value !== "timeline"
    || loading.value
    || Boolean(error.value)
    || !dateNavRef.value
  ) {
    showScrollTopFab.value = false;
    return;
  }
  const rect = dateNavRef.value.getBoundingClientRect();
  showScrollTopFab.value = rect.bottom < 0;
}

function scrollToDateNav() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatRange(start, end) {
  const left = formatTime(start);
  const right = formatTime(end);
  if (!left && !right) {
    return "—";
  }
  return `${left} - ${right}`;
}

function formatTime(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(parsed));
}

function resolveDefaultDate(days) {
  const list = Array.isArray(days) ? days : [];
  if (!list.length) {
    return "";
  }
  const today = todayDate();
  return list.some((day) => day.date === today) ? today : list[0].date;
}

function firstItemIdForDate(date) {
  const day = recentDays.value.find((entry) => entry.date === date);
  return day?.items?.[0]?.id || "";
}

function selectNeighborDate(direction) {
  const nextDate = direction === "older" ? olderDate.value : newerDate.value;
  if (nextDate) {
    selectedDate.value = nextDate;
  }
}

function handleDatePick(date) {
  selectedDate.value = date;
  dateSheetOpen.value = false;
}

function toggleActiveView() {
  activeView.value = activeView.value === "timeline" ? "distribution" : "timeline";
}

function switchCalendarMonth(direction) {
  const delta = direction === "older" ? -1 : 1;
  currentCalendarMonth.value = shiftMonthKey(
    activeCalendarMonth.value?.monthKey || resolveCalendarMonth(selectedDate.value),
    delta,
  );
}

function formatSelectedDateDisplay(date, itemCount) {
  const normalized = String(date || "").trim();
  if (!normalized) {
    return "选择日期";
  }
  const countText = `${Number(itemCount) || 0}条`;
  return `${normalized} · ${formatWeekdayLabel(normalized)} · ${countText}`;
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

function formatMonthLabel(monthKey) {
  const normalized = String(monthKey || "").trim();
  if (!normalized) {
    return "";
  }
  const [year, month] = normalized.split("-");
  return `${year} 年 ${Number(month)} 月`;
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

watch(selectedDate, (value) => {
  selectedItemId.value = firstItemIdForDate(value);
});

watch(dateSheetOpen, (open) => {
  if (open) {
    currentCalendarMonth.value = resolveCalendarMonth(selectedDate.value);
  }
});

watch(
  () => [activeView.value, loading.value, error.value, recentDays.value.length],
  async () => {
    await nextTick();
    updateScrollTopFab();
  },
  { immediate: true },
);

onMounted(() => {
  load();
  window.addEventListener("scroll", updateScrollTopFab, { passive: true });
  window.addEventListener("resize", updateScrollTopFab);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateScrollTopFab);
  window.removeEventListener("resize", updateScrollTopFab);
});
</script>

<style scoped>
.page-head {
  position: relative;
  margin-bottom: 18px;
}

.page-head__top {
  position: relative;
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

.title-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
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

.meta-trigger--active {
  color: var(--accent);
  border-color: rgba(49, 81, 30, 0.22);
  background: #eef4e5;
}

.meta-pill {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.12);
  border-radius: 999px;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  background: rgba(255, 253, 249, 0.9);
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.meta-pill:disabled,
.meta-trigger:disabled {
  opacity: 0.38;
}

.meta-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: min(280px, calc(100vw - 28px));
  padding: 12px 14px;
  z-index: 4;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
}

.meta-row:last-child {
  border-bottom: none;
}

.meta-row span {
  color: var(--muted);
  font-size: 12px;
}

.meta-row strong {
  font-size: 13px;
}

.timeline-grid {
  display: grid;
  gap: 14px;
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

.date-calendar__switch:disabled {
  opacity: 0.38;
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

.days-section {
  display: grid;
  gap: 10px;
}

.day-items {
  display: grid;
  gap: 10px;
}

.day-item {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(24, 35, 15, 0.06);
  background: #faf8f3;
  cursor: pointer;
}

.day-item.cat-life { box-shadow: inset 4px 0 0 var(--cat-life); }
.day-item.cat-rest { box-shadow: inset 4px 0 0 var(--cat-rest); }
.day-item.cat-health { box-shadow: inset 4px 0 0 var(--cat-health); }
.day-item.cat-social { box-shadow: inset 4px 0 0 var(--cat-social); }
.day-item.cat-study { box-shadow: inset 4px 0 0 var(--cat-study); }
.day-item.cat-exercise { box-shadow: inset 4px 0 0 var(--cat-exercise); }
.day-item.cat-work { box-shadow: inset 4px 0 0 var(--cat-work); }
.day-item.cat-care { box-shadow: inset 4px 0 0 var(--cat-care); }
.day-item.cat-travel { box-shadow: inset 4px 0 0 var(--cat-travel); }
.day-item.cat-entertainment { box-shadow: inset 4px 0 0 var(--cat-entertainment); }
.day-item.cat-state { box-shadow: inset 4px 0 0 var(--cat-state); }

.day-item--active {
  border-color: rgba(49, 81, 30, 0.28);
  filter: saturate(1.04);
}

.item-time {
  color: var(--accent);
  font-size: 13px;
  line-height: 1.4;
}

.item-title {
  margin-top: 8px;
  font-size: 15px;
  line-height: 1.45;
  font-weight: 600;
}

.item-note {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.scroll-top-fab {
  position: fixed;
  right: 16px;
  bottom: 86px;
  z-index: 20;
  appearance: none;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(24, 35, 15, 0.1);
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.92);
  color: var(--accent);
  font: inherit;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(24, 35, 15, 0.12);
  backdrop-filter: blur(10px);
}

</style>
