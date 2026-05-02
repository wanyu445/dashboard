<template>
  <div class="page">
    <section class="page-head">
      <div class="title-meta">
        <h1 class="page-title">现场</h1>
        <button
          type="button"
          class="meta-trigger"
          title="同步数据"
          @click="load"
        >
          ↻
        </button>
      </div>
      <p class="page-subtitle">这里放 bot 当前能参考的现场信息，以及它现在能用的表情包。</p>
    </section>

    <van-loading v-if="loading" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <template v-else>
      <section class="section-card device-panel">
        <div class="device-bar">
          <div class="device-line device-line--top">最近上传 {{ uploadText }}</div>
          <div class="device-line device-line--bottom">
            {{ statusLine }}
            <span v-if="weatherQueriedText" class="weather-query">[{{ weatherQueriedText }}查询]</span>
          </div>
        </div>
      </section>

      <section class="section-card sticker-panel">
        <div class="section-title-row">
          <div>
            <h2>表情包</h2>
            <p>{{ stickerSummary }}</p>
          </div>
        </div>

        <div v-if="compactTagOptions.length" class="tag-row">
          <div class="tag-strip">
            <button
              v-for="tag in compactTagOptions"
              :key="tag"
              type="button"
              class="tag-chip"
              :class="{ 'tag-chip--active': isTagSelected(tag) }"
              @click="selectCompactTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
          <button
            type="button"
            class="tag-more"
            title="更多标签"
            @click="filterPopupVisible = true"
          >
            ⋯
          </button>
        </div>

        <div v-if="visibleStickers.length" class="sticker-grid">
          <article
            v-for="sticker in visibleStickers"
            :key="sticker.id"
            class="sticker-card"
            @click="previewSticker(sticker)"
          >
            <div class="sticker-thumb">
              <img
                v-if="stickerObjectUrl(sticker)"
                :src="stickerObjectUrl(sticker)"
                :alt="sticker.desc || sticker.id"
                loading="lazy"
              >
              <span v-else>{{ sticker.id }}</span>
            </div>
            <div class="sticker-info">
              <strong>{{ sticker.id }}</strong>
              <p>{{ sticker.desc || "暂无描述" }}</p>
            </div>
            <div v-if="sticker.tags.length" class="sticker-tags">
              <span v-for="tag in sticker.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          暂无可展示的表情包。
        </div>
      </section>
    </template>

    <van-image-preview
      v-model:show="previewVisible"
      :images="previewImages"
      :start-position="previewIndex"
      closeable
    />

    <van-popup
      v-model:show="filterPopupVisible"
      round
      position="bottom"
      class="filter-popup"
    >
      <div class="filter-panel">
        <div class="filter-head">
          <div>
            <h3>筛选表情包</h3>
            <p>{{ selectedTag || "全部" }}</p>
          </div>
          <button type="button" class="filter-clear" @click="clearRememberedTags">清空</button>
        </div>

        <div class="filter-tags">
          <button
            v-for="tag in allTags"
            :key="tag"
            type="button"
            class="filter-tag"
            :class="{ 'filter-tag--active': selectedTag === tag }"
            @click="selectTagFromPanel(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const RECENT_TAG_STORAGE_KEY = "cyberboss-dashboard:sticker-recent-tags";
const SELECTED_TAG_STORAGE_KEY = "cyberboss-dashboard:sticker-selected-tag";
const LEGACY_SELECTED_TAG_STORAGE_KEY = "cyberboss-dashboard:sticker-selected-tags";

const loading = ref(false);
const error = ref("");
const deviceSummary = ref({
  location: null,
  battery: null,
  lastUploadAt: "",
  weather: null,
});
const stickerSnapshot = ref({
  source: "",
  total: 0,
  tags: [],
  stickers: [],
});
const selectedTag = ref(readStoredTag(SELECTED_TAG_STORAGE_KEY) || readStoredTags(LEGACY_SELECTED_TAG_STORAGE_KEY)[0] || "");
const recentTags = ref(readStoredTags(RECENT_TAG_STORAGE_KEY));
const stickerObjectUrls = ref({});
const previewVisible = ref(false);
const previewImages = ref([]);
const previewIndex = ref(0);
const filterPopupVisible = ref(false);

const stickers = computed(() => Array.isArray(stickerSnapshot.value.stickers)
  ? stickerSnapshot.value.stickers
  : []);

const allTags = computed(() => {
  const tags = stickers.value.flatMap((item) => Array.isArray(item.tags) ? item.tags : []);
  return [...new Set(tags)];
});

const compactTagOptions = computed(() => {
  const remembered = normalizeTags(recentTags.value)
    .filter((tag) => allTags.value.includes(tag));
  const tags = ["全部", ...remembered];
  if (selectedTag.value && allTags.value.includes(selectedTag.value) && !remembered.includes(selectedTag.value)) {
    tags.push(selectedTag.value);
  }
  return [...new Set(tags)]
    .filter((tag) => tag === "全部" || allTags.value.includes(tag));
});

const visibleStickers = computed(() => {
  if (!selectedTag.value) {
    return stickers.value;
  }
  return stickers.value.filter((item) => item.tags.includes(selectedTag.value));
});

const stickerSummary = computed(() => {
  const source = stickerSnapshot.value.source === "template" ? "模板" : "当前";
  const filterText = selectedTag.value ? ` · ${selectedTag.value} ${visibleStickers.value.length} 张` : "";
  return `${source} · ${stickers.value.length} 张${filterText}`;
});

const locationText = computed(() => {
  const location = deviceSummary.value.location;
  const placeTag = String(location?.placeTag || "").trim().toLowerCase();
  if (placeTag) {
    return placeTag;
  }
  if (location) {
    return "外出";
  }
  return "暂无位置";
});

const batteryText = computed(() => {
  const battery = deviceSummary.value.battery;
  return battery?.level != null ? `${battery.level}%` : "暂无电量";
});

const weatherText = computed(() => {
  const weather = deviceSummary.value.weather;
  if (!weather) {
    return "天气未更新";
  }
  const parts = [];
  if (weather.temperatureC != null) {
    parts.push(`${weather.temperatureC}°C`);
  }
  if (weather.description) {
    parts.push(simplifyWeatherText(weather.description));
  }
  return parts.join(" ") || "天气未更新";
});

const uploadText = computed(() => formatDateTime(deviceSummary.value.lastUploadAt) || "暂无");
const statusLine = computed(() => [locationText.value, batteryText.value, weatherText.value]
  .filter(Boolean)
  .join(" · "));
const weatherQueriedText = computed(() => formatRelativeTime(deviceSummary.value.weather?.observedAt));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [state, stickerData] = await Promise.all([
      cyberbossApi.fetchState(),
      cyberbossApi.fetchStickers(),
    ]);
    deviceSummary.value = state.deviceSummary || {
      location: null,
      battery: null,
      lastUploadAt: "",
      weather: null,
    };
    stickerSnapshot.value = stickerData || {
      source: "",
      total: 0,
      tags: [],
      stickers: [],
    };
    if (selectedTag.value && !allTags.value.includes(selectedTag.value)) {
      selectedTag.value = "";
    }
    recentTags.value = recentTags.value.filter((tag) => allTags.value.includes(tag));
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function isTagSelected(tag) {
  if (tag === "全部") {
    return !selectedTag.value;
  }
  return selectedTag.value === tag;
}

function selectCompactTag(tag) {
  if (tag === "全部") {
    clearSelectedTag();
    return;
  }
  selectedTag.value = selectedTag.value === tag ? "" : tag;
}

function selectTagFromPanel(tag) {
  const normalized = String(tag || "").trim();
  if (!normalized || !allTags.value.includes(normalized)) {
    return;
  }
  selectedTag.value = normalized;
  filterPopupVisible.value = false;
}

function clearSelectedTag() {
  selectedTag.value = "";
  filterPopupVisible.value = false;
}

function clearRememberedTags() {
  recentTags.value = [];
}

function stickerObjectUrl(sticker) {
  const id = String(sticker?.id || "").trim();
  return id ? stickerObjectUrls.value[id] || "" : "";
}

async function ensureStickerUrls() {
  const nextUrls = { ...stickerObjectUrls.value };
  const pending = [];
  for (const sticker of visibleStickers.value.slice(0, 48)) {
    const id = String(sticker?.id || "").trim();
    if (!id || !sticker.hasImage || Object.prototype.hasOwnProperty.call(nextUrls, id)) {
      continue;
    }
    pending.push(
      cyberbossApi.fetchStickerBlob(id)
        .then((blob) => {
          nextUrls[id] = URL.createObjectURL(blob);
        })
        .catch(() => {
          nextUrls[id] = "";
        }),
    );
  }
  if (!pending.length) {
    return;
  }
  await Promise.all(pending);
  stickerObjectUrls.value = nextUrls;
}

function previewSticker(sticker) {
  const url = stickerObjectUrl(sticker);
  if (!url) {
    return;
  }
  previewImages.value = visibleStickers.value
    .map((item) => stickerObjectUrl(item))
    .filter(Boolean);
  previewIndex.value = Math.max(0, previewImages.value.indexOf(url));
  previewVisible.value = true;
}

function revokeStickerUrls() {
  for (const value of Object.values(stickerObjectUrls.value)) {
    if (value) {
      URL.revokeObjectURL(value);
    }
  }
  stickerObjectUrls.value = {};
}

function formatDateTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatRelativeTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return "刚刚";
  }
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) {
    return "刚刚";
  }
  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m前`;
  }
  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h前`;
  }
  return formatDateTime(text);
}

function simplifyWeatherText(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const lower = text.toLowerCase();
  if (lower.includes("sunny") || lower.includes("clear")) {
    return "晴";
  }
  if (lower.includes("partly cloudy") || lower.includes("mainly clear")) {
    return "多云";
  }
  if (lower.includes("cloud") || lower.includes("overcast")) {
    return "阴";
  }
  if (lower.includes("rain") || lower.includes("drizzle") || text.includes("雨")) {
    return "雨";
  }
  if (lower.includes("snow") || text.includes("雪")) {
    return "雪";
  }
  if (lower.includes("fog") || text.includes("雾")) {
    return "雾";
  }
  return text;
}

watch(visibleStickers, () => {
  ensureStickerUrls();
}, { immediate: false });

watch(selectedTag, (tag) => {
  const normalized = String(tag || "").trim();
  writeStoredTag(SELECTED_TAG_STORAGE_KEY, normalized);
  if (normalized && allTags.value.includes(normalized)) {
    const remembered = normalizeTags(recentTags.value);
    if (!remembered.includes(normalized)) {
      recentTags.value = normalizeTags([...remembered, normalized]).slice(-7);
    }
  }
});

watch(recentTags, (tags) => {
  writeStoredTags(RECENT_TAG_STORAGE_KEY, normalizeTags(tags).slice(0, 7));
}, { deep: true });

onMounted(async () => {
  await load();
  await ensureStickerUrls();
});

onBeforeUnmount(revokeStickerUrls);

function readStoredTags(key) {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    return normalizeTags(JSON.parse(window.localStorage.getItem(key) || "[]"));
  } catch {
    return [];
  }
}

function writeStoredTags(key, tags) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(normalizeTags(tags)));
}

function readStoredTag(key) {
  if (typeof window === "undefined") {
    return "";
  }
  return String(window.localStorage.getItem(key) || "").trim();
}

function writeStoredTag(key, tag) {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = String(tag || "").trim();
  if (normalized) {
    window.localStorage.setItem(key, normalized);
  } else {
    window.localStorage.removeItem(key);
  }
}

function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").trim())
    .filter(Boolean))];
}
</script>

<style scoped>
.page-head {
  position: relative;
  margin-bottom: 18px;
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

.device-panel,
.sticker-panel {
  padding: 14px;
  display: grid;
  gap: 14px;
}

.device-panel {
  margin-bottom: 14px;
}

.device-bar {
  display: grid;
  gap: 6px;
}

.device-line {
  line-height: 1.5;
  word-break: break-word;
}

.device-line--top {
  color: var(--muted);
  font-size: 13px;
}

.device-line--bottom {
  font-size: 15px;
  font-weight: 700;
}

.weather-query {
  margin-left: 4px;
  color: rgba(109, 115, 95, 0.68);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.section-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.section-title-row h2 {
  margin: 0;
  font-size: 19px;
}

.section-title-row p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-strip {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}

.tag-chip {
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 6px 11px;
  background: rgba(24, 35, 15, 0.06);
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
}

.tag-chip--active {
  background: var(--accent);
  color: #fffdf9;
  font-weight: 700;
}

.tag-more {
  appearance: none;
  flex: 0 0 auto;
  border: 1px solid rgba(24, 35, 15, 0.1);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  padding: 0;
  background: rgba(255, 253, 249, 0.82);
  color: var(--accent);
  font: inherit;
  font-size: 18px;
  font-weight: 800;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.filter-popup {
  background: transparent;
}

.filter-panel {
  margin: 0 auto;
  max-width: 920px;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
  background:
    linear-gradient(180deg, rgba(255, 253, 249, 0.94), rgba(247, 242, 233, 0.92));
  backdrop-filter: blur(18px);
  border-top: 1px solid rgba(24, 35, 15, 0.08);
}

.filter-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.filter-head h3 {
  margin: 0;
  font-size: 18px;
}

.filter-head p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
}

.filter-clear {
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(24, 35, 15, 0.06);
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
}

.filter-tags {
  max-height: min(45vh, 360px);
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-right: 2px;
}

.filter-tag {
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(24, 35, 15, 0.06);
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  line-height: 1;
}

.filter-tag--active {
  background: var(--accent);
  color: #fffdf9;
  font-weight: 700;
}

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sticker-card {
  min-width: 0;
  border-radius: 18px;
  padding: 10px;
  background:
    linear-gradient(145deg, rgba(255, 253, 249, 0.98), rgba(246, 241, 232, 0.9));
  border: 1px solid rgba(24, 35, 15, 0.07);
  display: grid;
  gap: 8px;
}

.sticker-thumb {
  aspect-ratio: 1 / 0.72;
  border-radius: 14px;
  background: rgba(238, 244, 229, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
}

.sticker-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.sticker-info {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.sticker-info strong {
  font-size: 13px;
}

.sticker-info p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.sticker-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  color: rgba(109, 115, 95, 0.72);
  font-size: 11px;
}

.empty-state {
  border-radius: 18px;
  padding: 20px 12px;
  background: rgba(255, 253, 249, 0.64);
  color: var(--muted);
  text-align: center;
  font-size: 14px;
}

</style>
