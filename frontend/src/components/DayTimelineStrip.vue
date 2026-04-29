<template>
  <section class="section-card strip-card">
    <div class="strip-head">
      <div>
        <div class="strip-kicker">移动时间轴</div>
        <h3>{{ day?.date || "—" }}</h3>
      </div>
      <div class="strip-meta">{{ normalizedItems.length }} 条</div>
    </div>

    <div class="strip-scroll">
      <div class="strip-canvas" :style="{ height: `${canvasHeight}px` }">
        <div
          v-for="tick in ticks"
          :key="tick.hour"
          class="tick"
          :style="{ left: `${tick.left}px` }"
        >
          <div class="tick-line"></div>
          <div class="tick-label">{{ tick.label }}</div>
        </div>

        <div
          v-for="lane in lanes"
          :key="`lane-${lane.index}`"
          class="lane"
          :style="{ top: `${headerHeight + lane.index * laneHeight}px`, height: `${laneHeight}px` }"
        ></div>

        <button
          v-for="item in normalizedItems"
          :key="item.id"
          type="button"
          class="event-bar"
          :class="[item.className, { 'event-bar--active': item.id === selectedItemId }]"
          :style="{
            left: `${item.left}px`,
            top: `${headerHeight + item.lane * laneHeight + 8}px`,
            width: `${item.width}px`,
          }"
          @click="$emit('select', item.id)"
        >
          <span class="event-bar__label">{{ item.shortLabel }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  day: {
    type: Object,
    default: null,
  },
  selectedItemId: {
    type: String,
    default: "",
  },
});

defineEmits(["select"]);

const minuteWidth = 1;
const canvasWidth = 24 * 60 * minuteWidth;
const headerHeight = 34;
const laneHeight = 44;

const normalizedItems = computed(() => {
  const items = Array.isArray(props.day?.items) ? props.day.items : [];
  const base = items
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
  return base;
});

const laneCount = computed(() => {
  if (!normalizedItems.value.length) {
    return 1;
  }
  return Math.max(...normalizedItems.value.map((item) => item.lane)) + 1;
});

const lanes = computed(() => Array.from({ length: laneCount.value }, (_, index) => ({ index })));

const canvasHeight = computed(() => headerHeight + laneCount.value * laneHeight + 8);

const ticks = computed(() => Array.from({ length: 25 }, (_, hour) => ({
  hour,
  left: hour * 60 * minuteWidth,
  label: hour === 24 ? "24:00" : `${String(hour).padStart(2, "0")}:00`,
})));

function normalizeItem(item) {
  const startMinute = toLocalMinuteOfDay(item?.start);
  const endMinuteRaw = toLocalMinuteOfDay(item?.end);
  if (startMinute == null) {
    return null;
  }
  let endMinute = endMinuteRaw == null ? startMinute + 30 : endMinuteRaw;
  if (endMinute <= startMinute) {
    endMinute = startMinute + 10;
  }
  const clampedStart = clampMinute(startMinute);
  const clampedEnd = Math.max(clampedStart + 8, Math.min(24 * 60, endMinute));
  const title = String(item?.title || item?.content || "").trim();
  return {
    ...item,
    title,
    shortLabel: shortenLabel(title || "事件"),
    startMinute: clampedStart,
    endMinute: clampedEnd,
    left: clampedStart * minuteWidth,
    width: Math.max((clampedEnd - clampedStart) * minuteWidth, 18),
    lane: 0,
  };
}

function toLocalMinuteOfDay(value) {
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

function shortenLabel(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "事件";
  }
  return normalized.length > 16 ? `${normalized.slice(0, 15)}…` : normalized;
}
</script>

<style scoped>
.strip-card {
  padding: 14px;
}

.strip-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
}

.strip-kicker {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.strip-head h3 {
  margin: 4px 0 0;
  font-size: 18px;
}

.strip-meta {
  color: var(--muted);
  font-size: 12px;
}

.strip-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
}

.strip-canvas {
  position: relative;
  width: 1440px;
  min-width: 1440px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.55)),
    repeating-linear-gradient(
      to right,
      rgba(24, 35, 15, 0.04) 0,
      rgba(24, 35, 15, 0.04) 1px,
      transparent 1px,
      transparent 60px
    );
  border: 1px solid rgba(24, 35, 15, 0.06);
}

.tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
}

.tick-line {
  position: absolute;
  top: 24px;
  bottom: 0;
  width: 1px;
  background: rgba(24, 35, 15, 0.08);
}

.tick-label {
  position: absolute;
  top: 4px;
  left: 4px;
  color: var(--muted);
  font-size: 11px;
}

.lane {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed rgba(24, 35, 15, 0.05);
}

.event-bar {
  position: absolute;
  height: 28px;
  border: none;
  border-radius: 999px;
  padding: 0 10px;
  color: #18230f;
  text-align: left;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.08);
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  background: #fff7e8;
}

.event-bar__label {
  font-size: 12px;
  line-height: 28px;
  font-weight: 600;
}

.event-bar--active {
  outline: 2px solid rgba(49, 81, 30, 0.45);
  outline-offset: 2px;
}

.event-bar.cat-life { background: var(--cat-life); }
.event-bar.cat-work { background: var(--cat-work); }
.event-bar.cat-study { background: var(--cat-study); }
.event-bar.cat-exercise { background: var(--cat-exercise); }
.event-bar.cat-health { background: var(--cat-health); }
.event-bar.cat-social { background: var(--cat-social); }
.event-bar.cat-care { background: var(--cat-care); }
.event-bar.cat-travel { background: var(--cat-travel); }
.event-bar.cat-rest { background: var(--cat-rest); }
.event-bar.cat-entertainment { background: var(--cat-entertainment); }
.event-bar.cat-state { background: var(--cat-state); }
</style>
