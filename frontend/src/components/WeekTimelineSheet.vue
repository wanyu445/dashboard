<template>
  <teleport to="body">
    <div v-if="show" class="week-overlay" @click.self="emit('update:show', false)">
      <div class="week-sheet">
        <div class="week-sheet__header">
          <div>
            <h3>周视图</h3>
          </div>
          <button type="button" class="modal-close" aria-label="关闭" @click="emit('update:show', false)">×</button>
        </div>

        <div v-if="weekOptions.length" class="week-sheet__controls">
          <div class="week-sheet__controls-top">
            <button
              type="button"
              class="week-picker-trigger"
              @click="openWeekPicker"
            >
              <span class="week-picker-trigger__label">{{ currentWeekLabel }}</span>
              <span class="week-picker-trigger__icon">⌄</span>
            </button>
            <button
              type="button"
              class="week-fold-trigger"
              @click="earlyHoursExpanded = !earlyHoursExpanded"
            >
              {{ earlyHoursExpanded ? "收起 0-6" : "展开 0-6" }}
            </button>
          </div>
          <div class="week-sheet__hint">点日期切回当天，点色块看详情</div>
        </div>

        <van-empty v-if="!activeWeek" description="还没有周视图数据" />

        <template v-else>
          <div class="week-grid-wrap section-card">
            <div class="week-grid-scroll">
              <div class="week-grid-shell">
              <div class="week-grid-header" :style="gridColumnsStyle">
                <div class="week-grid-corner">时间</div>
                <button
                  v-for="day in activeWeek.days"
                  :key="day.id"
                  type="button"
                  class="week-day-head"
                  :class="{ 'week-day-head--active': day.id === selectedDate }"
                  @click="handleDayClick(day.id)"
                >
                  <span class="week-day-head__weekday">{{ formatWeekdayLetter(day.id) }}</span>
                  <span class="week-day-head__date">{{ formatDayNumber(day.id) }}</span>
                </button>
              </div>

              <div class="week-grid-body" :style="gridColumnsStyle">
                <div class="week-times" :style="{ height: `${dayColumnHeight}px` }">
                  <div
                    v-for="row in hourRows"
                    :key="row.key"
                    class="week-time-label"
                    :class="{
                      'week-time-label--major': row.major,
                      'week-time-label--folded': row.kind === 'folded-early',
                    }"
                    :style="{ height: `${row.height}px` }"
                  >
                    <template v-if="row.kind === 'folded-early'">
                      <span class="week-time-label__split">
                        <span>00</span>
                        <span>06</span>
                      </span>
                    </template>
                    <template v-else>
                      {{ row.shortLabel }}
                    </template>
                  </div>
                </div>

                <div
                  v-for="day in activeWeek.days"
                  :key="`column-${day.id}`"
                  class="week-day-column"
                  :class="{ 'week-day-column--active': day.id === selectedDate }"
                  :style="{ height: `${dayColumnHeight}px` }"
                >
                  <div
                    v-for="row in hourRows"
                    :key="`slot-${day.id}-${row.key}`"
                    class="week-hour-slot"
                    :class="{
                      'week-hour-slot--major': row.major,
                      'week-hour-slot--folded': row.kind === 'folded-early',
                    }"
                    :style="{ height: `${row.height}px` }"
                  ></div>

                  <button
                    v-for="item in itemsByDay[day.id] || []"
                    :key="item.id"
                    type="button"
                    class="week-bar"
                    :class="[item.className, { 'week-bar--active': item.id === selectedItemId }]"
                    :style="{
                      top: `${item.top}px`,
                      left: `${item.leftPercent}%`,
                      width: `${item.widthPercent}%`,
                      height: `${item.height}px`,
                    }"
                    @click="selectedItemId = item.id"
                  ></button>
                </div>
              </div>
              </div>
            </div>
          </div>

          <section class="section-card week-detail-card">
            <template v-if="selectedItem">
              <div class="week-detail-card__time">
                {{ selectedItem.dateText || selectedItem.group }} · {{ selectedItem.timeText || "—" }}
              </div>
              <div class="week-detail-card__title">{{ selectedItem.title || selectedItem.content || "事件" }}</div>
              <div v-if="selectedItem.note" class="week-detail-card__note">备注：{{ selectedItem.note }}</div>
            </template>
            <template v-else>
              <div class="week-detail-card__empty">这一周没有可展示的时间块。</div>
            </template>
          </section>
        </template>
      </div>
    </div>

    <div v-if="weekPickerOpen" class="week-picker-overlay" @click.self="closeWeekPicker">
      <div class="week-picker-sheet">
        <div class="week-picker-sheet__header">
          <div>
            <div class="week-picker-sheet__kicker">周次</div>
            <h3>{{ currentWeekLabel }}</h3>
          </div>
          <button type="button" class="modal-close" aria-label="关闭" @click="closeWeekPicker">×</button>
        </div>

        <div class="week-picker-sheet__body">
          <section v-if="activeWeekCalendarMonth" class="range-calendar section-card">
            <div class="range-calendar__topbar">
              <button type="button" class="range-calendar__switch" @click="switchWeekCalendarMonth(-1)">‹</button>
              <div class="range-calendar__title">{{ activeWeekCalendarMonth.monthLabel }}</div>
              <button type="button" class="range-calendar__switch" @click="switchWeekCalendarMonth(1)">›</button>
            </div>

            <div class="range-calendar__weekdays">
              <span
                v-for="weekday in calendarWeekdays"
                :key="weekday"
                class="range-calendar__weekday"
              >
                {{ weekday }}
              </span>
            </div>

            <div class="week-calendar">
              <button
                v-for="row in activeWeekCalendarMonth.rows"
                :key="row.weekKey"
                type="button"
                class="week-calendar__row"
                :class="{
                  'week-calendar__row--active': row.weekKey === currentWeekKey,
                  'week-calendar__row--muted': !row.available,
                }"
                :disabled="!row.available"
                @click="handleWeekPick(row.weekKey)"
              >
                <span class="week-calendar__band"></span>
                <span
                  v-for="cell in row.cells"
                  :key="cell.date"
                  class="week-calendar__day"
                  :class="{
                    'week-calendar__day--outside': !cell.inMonth,
                    'week-calendar__day--selected': cell.date === selectedDate,
                  }"
                >
                  {{ cell.dayNumber }}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const HOUR_HEIGHT = 24;
const EARLY_HOURS_END = 7;
const EARLY_HOURS_COLLAPSED_HEIGHT = 28;
const TIME_COL_WIDTH = 28;
const LANE_GAP = 3;
const SOLO_BAR_WIDTH_PERCENT = 34;
const MULTI_BAR_WIDTH_PERCENT = 20;
const MIN_BAR_WIDTH_PERCENT = 8;

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  weeks: {
    type: Array,
    default: () => [],
  },
  selectedDate: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:show", "select-day"]);

const currentWeekKey = ref("");
const selectedItemId = ref("");
const weekPickerOpen = ref(false);
const weekPickerMonth = ref("");
const earlyHoursExpanded = ref(false);

const calendarWeekdays = ["一", "二", "三", "四", "五", "六", "日"];

const weekOptions = computed(() => (Array.isArray(props.weeks) ? props.weeks : []).map((week) => ({
  text: formatWeekOption(week),
  value: week.key,
})));

const activeWeek = computed(() => {
  const weeks = Array.isArray(props.weeks) ? props.weeks : [];
  return weeks.find((week) => week.key === currentWeekKey.value) || weeks[0] || null;
});

const currentWeekLabel = computed(() => (
  activeWeek.value?.label || formatWeekOption(activeWeek.value) || "选择周次"
));

const dayCount = computed(() => Math.max(1, activeWeek.value?.days?.length || 0));
const hourRows = computed(() => {
  if (earlyHoursExpanded.value) {
    return Array.from({ length: 24 }, (_, value) => ({
      key: `hour-${value}`,
      value,
      kind: "hour",
      shortLabel: String(value).padStart(2, "0"),
      height: HOUR_HEIGHT,
      major: value % 6 === 0,
    }));
  }

  return [
    {
      key: "hour-folded-early",
      value: 0,
      kind: "folded-early",
      shortLabel: "00/06",
      height: EARLY_HOURS_COLLAPSED_HEIGHT,
      major: true,
    },
    ...Array.from({ length: 24 - EARLY_HOURS_END }, (_, index) => {
      const value = index + EARLY_HOURS_END;
      return {
        key: `hour-${value}`,
        value,
        kind: "hour",
        shortLabel: String(value).padStart(2, "0"),
        height: HOUR_HEIGHT,
        major: value % 6 === 0,
      };
    }),
  ];
});

const dayColumnHeight = computed(() => (
  hourRows.value.reduce((sum, row) => sum + row.height, 0)
));
const gridColumnsStyle = computed(() => ({
  gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${dayCount.value}, minmax(0, 1fr))`,
}));

const itemsByDay = computed(() => {
  const week = activeWeek.value;
  const map = {};
  for (const day of week?.days || []) {
    const dayItems = Array.isArray(week?.items)
      ? week.items.filter((item) => item.group === day.id)
      : [];
    map[day.id] = normalizeDayItems(dayItems);
  }
  return map;
});

const selectedItem = computed(() => {
  const allItems = Object.values(itemsByDay.value).flat();
  return allItems.find((item) => item.id === selectedItemId.value) || null;
});

const availableWeekSet = computed(() => new Set(
  (Array.isArray(props.weeks) ? props.weeks : []).map((week) => String(week?.key || "").trim()).filter(Boolean),
));

const activeWeekCalendarMonth = computed(() => buildWeekCalendarMonth(
  weekPickerMonth.value || resolveWeekPickerMonth(),
  availableWeekSet.value,
));

watch(
  () => [props.show, props.selectedDate, Array.isArray(props.weeks) ? props.weeks.length : 0],
  () => {
    if (!props.show) {
      return;
    }
    currentWeekKey.value = resolveWeekKey(props.weeks, props.selectedDate);
    selectedItemId.value = resolveDefaultItemId(activeWeek.value, props.selectedDate);
    weekPickerMonth.value = resolveWeekPickerMonth();
  },
  { immediate: true },
);

watch(currentWeekKey, () => {
  selectedItemId.value = resolveDefaultItemId(activeWeek.value, props.selectedDate);
  weekPickerMonth.value = resolveWeekPickerMonth();
});

function handleDayClick(date) {
  emit("select-day", date);
  emit("update:show", false);
}

function openWeekPicker() {
  weekPickerMonth.value = resolveWeekPickerMonth();
  weekPickerOpen.value = true;
}

function closeWeekPicker() {
  weekPickerOpen.value = false;
}

function handleWeekPick(weekKey) {
  if (!weekKey) {
    return;
  }
  currentWeekKey.value = weekKey;
  closeWeekPicker();
}

function resolveWeekPickerMonth() {
  const key = String(currentWeekKey.value || props.selectedDate || "").trim();
  return key ? key.slice(0, 7) : "";
}

function switchWeekCalendarMonth(delta) {
  weekPickerMonth.value = shiftMonthKey(
    activeWeekCalendarMonth.value?.monthKey || resolveWeekPickerMonth(),
    delta,
  );
}

function resolveWeekKey(weeks, selectedDate) {
  const list = Array.isArray(weeks) ? weeks : [];
  const normalizedDate = String(selectedDate || "").trim();
  if (normalizedDate) {
    const match = list.find((week) => Array.isArray(week.days) && week.days.some((day) => day.id === normalizedDate));
    if (match) {
      return match.key;
    }
  }
  return list[0]?.key || "";
}

function resolveDefaultItemId(week, selectedDate) {
  const weekItems = Array.isArray(week?.items) ? week.items : [];
  const normalizedDate = String(selectedDate || "").trim();
  const targetItems = normalizedDate && weekItems.some((item) => item.group === normalizedDate)
    ? weekItems.filter((item) => item.group === normalizedDate)
    : weekItems;
  return targetItems[0]?.id || "";
}

function normalizeDayItems(items) {
  const base = (Array.isArray(items) ? items : [])
    .map((item) => normalizeItem(item))
    .filter(Boolean)
    .sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);

  const laneEndMinutes = [];
  for (const item of base) {
    let laneIndex = laneEndMinutes.findIndex((endMinute) => item.startMinute >= endMinute);
    if (laneIndex < 0) {
      laneIndex = laneEndMinutes.length;
      laneEndMinutes.push(item.endMinute);
    } else {
      laneEndMinutes[laneIndex] = item.endMinute;
    }
    item.lane = laneIndex;
  }

  const laneCount = Math.max(1, laneEndMinutes.length);
  const laneWidthPercent = resolveLaneWidthPercent(laneCount);
  const totalWidthPercent = laneWidthPercent * laneCount + LANE_GAP * (laneCount - 1);
  const startOffsetPercent = Math.max(0, (100 - totalWidthPercent) / 2);

  return base.map((item) => ({
    ...item,
    widthPercent: laneWidthPercent,
    leftPercent: startOffsetPercent + item.lane * (laneWidthPercent + LANE_GAP),
    top: resolveVisualOffset(item.startMinute),
    height: Math.max(6, resolveVisualOffset(item.endMinute) - resolveVisualOffset(item.startMinute)),
  }));
}

function resolveLaneWidthPercent(laneCount) {
  if (laneCount <= 1) {
    return SOLO_BAR_WIDTH_PERCENT;
  }
  return Math.max(MIN_BAR_WIDTH_PERCENT, Math.min(MULTI_BAR_WIDTH_PERCENT, (100 - LANE_GAP * (laneCount - 1)) / laneCount));
}

function normalizeItem(item) {
  const startMinute = toMinuteOfDay(item?.start);
  const endMinuteRaw = toMinuteOfDay(item?.end);
  if (startMinute == null) {
    return null;
  }
  let endMinute = endMinuteRaw == null ? startMinute + 30 : endMinuteRaw;
  if (endMinute <= startMinute) {
    endMinute = startMinute + 10;
  }
  const clampedStart = clampMinute(startMinute);
  const clampedEnd = Math.max(clampedStart + 6, Math.min(24 * 60, endMinute));
  return {
    ...item,
    startMinute: clampedStart,
    endMinute: clampedEnd,
    lane: 0,
    note: item?.note || "",
  };
}

function resolveVisualOffset(minute) {
  const clampedMinute = clampMinute(minute);
  if (earlyHoursExpanded.value) {
    return (clampedMinute / 60) * HOUR_HEIGHT;
  }

  const earlyMinutes = EARLY_HOURS_END * 60;
  if (clampedMinute <= earlyMinutes) {
    return (clampedMinute / earlyMinutes) * EARLY_HOURS_COLLAPSED_HEIGHT;
  }

  return EARLY_HOURS_COLLAPSED_HEIGHT + ((clampedMinute - earlyMinutes) / 60) * HOUR_HEIGHT;
}

function toMinuteOfDay(value) {
  const parsed = Date.parse(String(value || "").trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(parsed));
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "");
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  return hour * 60 + minute;
}

function clampMinute(value) {
  return Math.max(0, Math.min(24 * 60, Number(value) || 0));
}

function formatWeekOption(week) {
  const days = Array.isArray(week?.days) ? week.days : [];
  const start = days[0]?.id ? formatShortDate(days[0].id) : week?.key || "";
  const end = days[days.length - 1]?.id ? formatShortDate(days[days.length - 1].id) : "";
  return end ? `${start} - ${end}` : start;
}

function formatShortDate(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "—";
  }
  return normalized.slice(5);
}

function formatDayNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(8, 10);
}

function formatWeekdayLetter(value) {
  const parsed = Date.parse(`${String(value || "").trim()}T00:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(new Date(parsed));
  return weekday.slice(0, 1);
}

function buildWeekCalendarMonth(monthKey, availableWeekKeys) {
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

  const firstDate = `${normalizedMonth}-01`;
  const totalDays = new Date(year, month, 0).getDate();
  const lastDate = `${normalizedMonth}-${String(totalDays).padStart(2, "0")}`;
  const firstWeekStart = getWeekStartDateKey(firstDate);
  const lastWeekStart = getWeekStartDateKey(lastDate);

  const rows = [];
  let cursor = firstWeekStart;
  while (cursor <= lastWeekStart) {
    const cells = Array.from({ length: 7 }, (_, index) => {
      const cellDate = addDaysToDateKey(cursor, index);
      return {
        date: cellDate,
        dayNumber: Number(cellDate.slice(8, 10)),
        inMonth: cellDate.slice(0, 7) === normalizedMonth,
      };
    });
    rows.push({
      weekKey: cursor,
      available: availableWeekKeys.has(cursor),
      cells,
    });
    cursor = addDaysToDateKey(cursor, 7);
  }

  return {
    monthKey: normalizedMonth,
    monthLabel: formatMonthLabel(normalizedMonth),
    rows,
  };
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
    return normalized;
  }
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getWeekStartDateKey(dateKey) {
  const parsed = Date.parse(`${String(dateKey || "").trim()}T12:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const weekday = new Date(parsed).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return formatDateKey(new Date(parsed + mondayOffset * 24 * 60 * 60 * 1000));
}

function addDaysToDateKey(dateKey, days) {
  const parsed = Date.parse(`${String(dateKey || "").trim()}T12:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return formatDateKey(new Date(parsed + days * 24 * 60 * 60 * 1000));
}
</script>

<style scoped>
.week-overlay {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: 24px;
  background: rgba(24, 35, 15, 0.32);
  backdrop-filter: blur(4px);
}

.week-sheet {
  width: min(100%, 920px);
  height: min(92vh, 860px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px calc(14px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #fbf7ef 0%, #f4efe6 100%);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -16px 40px rgba(24, 35, 15, 0.18);
  overflow: hidden;
}

.week-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.week-sheet__header h3 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
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

.week-sheet__controls {
  display: grid;
  gap: 8px;
}

.week-sheet__controls-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.week-picker-trigger {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  min-height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.week-fold-trigger {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.72);
  color: var(--muted);
  min-height: 32px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
}

.week-picker-trigger__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-picker-trigger__icon {
  color: var(--muted);
  flex: 0 0 auto;
}

.week-sheet__hint {
  color: var(--muted);
  font-size: 12px;
}

.week-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 2300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(24, 35, 15, 0.2);
  backdrop-filter: blur(4px);
}

.week-picker-sheet {
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

.week-picker-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.week-picker-sheet__kicker {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.week-picker-sheet__header h3 {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.3;
}

.week-picker-sheet__body {
  overflow-y: auto;
}

.range-calendar {
  padding: 12px;
}

.range-calendar__topbar {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.range-calendar__switch {
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

.range-calendar__title {
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.range-calendar__weekdays,
.range-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.range-calendar__weekdays {
  gap: 6px;
  margin-bottom: 8px;
}

.range-calendar__weekday {
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.range-calendar__grid {
  gap: 8px;
}

.week-calendar {
  display: grid;
  gap: 8px;
}

.week-calendar__row {
  position: relative;
  appearance: none;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  padding: 4px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  text-align: center;
}

.week-calendar__row--muted {
  opacity: 0.35;
}

.week-calendar__row--active {
  border-color: rgba(49, 81, 30, 0.2);
}

.week-calendar__band {
  position: absolute;
  inset: 4px;
  border-radius: 12px;
  background: transparent;
  z-index: 0;
}

.week-calendar__row--active .week-calendar__band {
  background: #eef4e5;
}

.week-calendar__day {
  position: relative;
  z-index: 1;
  min-height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

.week-calendar__day--outside {
  color: rgba(24, 35, 15, 0.42);
}

.week-calendar__day--selected {
  color: var(--accent);
}

.week-grid-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px;
}

.week-grid-scroll {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.week-grid-shell {
  display: block;
  position: relative;
  width: 100%;
  border: 1px solid rgba(24, 35, 15, 0.1);
  border-radius: 16px;
  overflow: visible;
  background: rgba(255, 253, 249, 0.88);
}

.week-grid-header,
.week-grid-body {
  display: grid;
}

.week-grid-header {
  position: sticky;
  top: 0;
  z-index: 5;
}

.week-grid-corner,
.week-day-head {
  min-height: 52px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 253, 249, 0.98);
}

.week-grid-corner {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 12px;
}

.week-day-head {
  appearance: none;
  border: none;
  border-left: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  display: grid;
  place-items: center;
  gap: 1px;
  padding: 6px 2px;
  color: var(--ink);
}

.week-day-head--active {
  background: #eef4e5;
}

.week-day-head__weekday {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.week-day-head__date {
  font-size: 12px;
  font-weight: 600;
}

.week-times {
  border-right: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(255, 253, 249, 0.96), rgba(255, 253, 249, 0.9));
}

.week-time-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 0;
  font-size: 11px;
  color: #939985;
  border-bottom: 1px solid rgba(24, 35, 15, 0.05);
}

.week-time-label--major {
  color: var(--muted);
}

.week-time-label--folded {
  font-size: 10px;
  letter-spacing: 0.02em;
  background: rgba(238, 244, 229, 0.24);
}

.week-time-label__split {
  display: grid;
  justify-items: center;
  line-height: 1;
  gap: 2px;
}

.week-day-column {
  position: relative;
  min-width: 0;
  border-right: 1px solid rgba(24, 35, 15, 0.06);
  background:
    linear-gradient(180deg, rgba(255, 253, 249, 0.86), rgba(247, 242, 232, 0.82));
}

.week-day-column--active {
  background:
    linear-gradient(180deg, rgba(238, 244, 229, 0.88), rgba(247, 242, 232, 0.9));
}

.week-hour-slot {
  border-bottom: 1px solid rgba(24, 35, 15, 0.05);
}

.week-hour-slot--major {
  border-bottom-color: rgba(49, 81, 30, 0.12);
}

.week-hour-slot--folded {
  background: rgba(238, 244, 229, 0.14);
}

.week-bar {
  position: absolute;
  appearance: none;
  border: none;
  border-radius: 8px;
  opacity: 0.95;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.08);
}

.week-bar--active {
  outline: 2px solid rgba(24, 35, 15, 0.45);
  opacity: 1;
}

.week-bar.cat-life {
  background: var(--cat-life);
}

.week-bar.cat-rest {
  background: var(--cat-rest);
}

.week-bar.cat-health {
  background: var(--cat-health);
}

.week-bar.cat-social {
  background: var(--cat-social);
}

.week-bar.cat-study {
  background: var(--cat-study);
}

.week-bar.cat-exercise {
  background: var(--cat-exercise);
}

.week-bar.cat-work {
  background: var(--cat-work);
}

.week-bar.cat-travel {
  background: var(--cat-travel);
}

.week-bar.cat-entertainment {
  background: var(--cat-entertainment);
}

.week-bar.cat-care {
  background: var(--cat-care);
}

.week-bar.cat-state {
  background: var(--cat-state);
}

.week-detail-card {
  padding: 14px;
}

.week-detail-card__time {
  color: var(--accent);
  font-size: 13px;
  line-height: 1.4;
}

.week-detail-card__title {
  margin-top: 8px;
  font-size: 15px;
  line-height: 1.45;
  font-weight: 600;
}

.week-detail-card__note,
.week-detail-card__empty {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
