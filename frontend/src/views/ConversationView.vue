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
          <button
            type="button"
            class="meta-trigger reminder-trigger"
            :class="{ 'meta-trigger--active': reminderSheetOpen }"
            title="提醒列表"
            @click="reminderSheetOpen = true"
          >
            <span class="reminder-trigger__icon" aria-hidden="true"></span>
          </button>
          <button
            type="button"
            class="meta-trigger note-trigger"
            :class="{ 'meta-trigger--active': noteSheetOpen }"
            title="小纸条"
            @click="openNoteSheet"
          >
            <span class="note-trigger__icon" aria-hidden="true"></span>
          </button>
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
        <button
          v-if="filteredTranscriptDays.length"
          type="button"
          class="search-trigger"
          title="搜索全部消息"
          @click="openSearchSheet"
        >
          ⌕
        </button>
        <van-tag plain type="success">最近 {{ availableConversationDates.length }} 天</van-tag>
      </div>
    </section>

    <van-empty v-if="!loading && !transcriptDays.length" description="暂时没读到会话日志" />
    <van-loading v-else-if="loading" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />
    <van-loading v-else-if="dayLoading" size="20px" vertical>正在切换日期</van-loading>

    <div v-else class="day-list">
      <section v-for="day in filteredTranscriptDays" :key="day.date" class="day-block">
        <div class="day-divider">
          <span class="day-divider__date">{{ formatDayLabel(day.date) }}</span>
          <div class="day-divider__meta-wrap">
            <span class="day-divider__meta">{{ dayMetaText(day) }}</span>
            <button
              v-if="metaToggleVisible"
              type="button"
              class="meta-switch"
              title="切换显示"
              @click="toggleMetaMode"
            >
              ↺
            </button>
          </div>
        </div>

        <div class="transcript">
          <template v-for="item in day.items" :key="item.id">
            <article
              v-if="item.kind === 'message' || item.kind === 'note-notice'"
              :ref="(element) => setMessageRef(item.id, element)"
              class="chat-row"
              :class="[
                item.kind === 'note-notice' ? 'chat-row--note-notice' : `chat-row--${item.role}`,
                { 'chat-row--search-hit': activeSearchTargetId === item.id },
              ]"
            >
              <template v-if="item.kind === 'note-notice'">
                <div class="desk-note">
                  <div class="desk-note__kicker">小纸条</div>
                  <div class="desk-note__sheet">
                    <div class="desk-note__meta">
                      <span class="desk-note__from">{{ extractNoteCardLabel(item.text) }}</span>
                      <span class="desk-note__time mono">{{ formatTime(item.timestamp) }}</span>
                    </div>
                    <div class="desk-note__body">
                      {{ extractNoteCardBody(item.text) }}
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
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

              <div v-if="item.role === 'assistant' && item.stickers.length" class="sticker-message-row">
                <button
                  v-for="sticker in item.stickers"
                  :key="`${item.id}-${sticker.id}`"
                  type="button"
                  class="sticker-message"
                  :title="sticker.label || sticker.id"
                  @click="openSticker(sticker)"
                >
                  <img
                    v-if="stickerObjectUrl(sticker)"
                    class="sticker-message__image"
                    :src="stickerObjectUrl(sticker)"
                    :alt="sticker.label || sticker.id"
                    loading="lazy"
                  />
                  <span v-else class="sticker-message__placeholder">{{ sticker.id }}</span>
                </button>
              </div>

              <div v-if="item.role === 'assistant' && item.actionTags.length" class="action-tag-row">
                <span
                  v-for="tag in item.actionTags"
                  :key="tag.key"
                  class="action-tag"
                >
                  <span class="action-tag__marker">#</span>
                  <span class="action-tag__label">{{ tag.label }}</span>
                </span>
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
              </template>
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
      <div v-if="noteSheetOpen" class="date-sheet-overlay" @click.self="noteSheetOpen = false">
        <div class="reminder-sheet note-sheet">
          <div class="reminder-sheet__header">
            <div>
              <div class="date-sheet__kicker">小纸条</div>
              <h3>
                <button type="button" class="note-date-trigger" @click="noteDateSheetOpen = true">
                  <span>{{ noteListTitle }}</span>
                  <span class="note-date-trigger__icon">⌄</span>
                </button>
              </h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="noteSheetOpen = false">×</button>
          </div>

          <div class="reminder-sheet__body note-sheet__body">
            <div v-if="noteLoading" class="reminder-empty">正在加载小纸条</div>
            <div v-else-if="selectedNoteItems.length" class="note-list">
              <article
                v-for="item in selectedNoteItems"
                :key="item.id"
                class="section-card file-card note-card"
              >
                <div class="file-header note-card__meta">
                  <span class="note-card__time mono">{{ formatTime(item.createdAt) }}</span>
                  <span v-if="item.speaker" class="note-card__speaker">{{ item.speaker }}</span>
                </div>
                <div class="markdown-body note-card__content">
                  <p class="pre-wrap">{{ item.content }}</p>
                </div>
              </article>
            </div>
            <div v-else class="reminder-empty">这一天还没有小纸条</div>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="noteDateSheetOpen" class="date-sheet-overlay" @click.self="noteDateSheetOpen = false">
        <div class="date-sheet">
          <div class="date-sheet__header">
            <div>
              <div class="date-sheet__kicker">纸条日期</div>
              <h3>{{ selectedNoteDate ? formatConversationDateDisplay(selectedNoteDate) : "选择日期" }}</h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="noteDateSheetOpen = false">×</button>
          </div>

          <div class="date-sheet__body">
            <section v-if="activeNoteCalendarMonth" class="date-calendar section-card">
              <div class="date-calendar__topbar">
                <button
                  type="button"
                  class="date-calendar__switch"
                  @click="switchNoteCalendarMonth('older')"
                >
                  ‹
                </button>
                <div class="date-calendar__title">{{ activeNoteCalendarMonth.monthLabel }}</div>
                <button
                  type="button"
                  class="date-calendar__switch"
                  @click="switchNoteCalendarMonth('newer')"
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
                  v-for="cell in activeNoteCalendarMonth.cells"
                  :key="cell.key"
                  type="button"
                  class="date-chip"
                  :class="{
                    'date-chip--placeholder': cell.kind === 'placeholder',
                    'date-chip--muted': cell.kind === 'day' && !cell.available,
                    'date-chip--active': cell.date === selectedNoteDate,
                    'date-chip--today': cell.date === todayDate(),
                  }"
                  :disabled="cell.kind !== 'day' || !cell.available"
                  @click="cell.date && handleNoteDatePick(cell.date)"
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
      <div v-if="reminderSheetOpen" class="date-sheet-overlay" @click.self="reminderSheetOpen = false">
        <div class="reminder-sheet">
          <div class="reminder-sheet__header">
            <div>
              <div class="date-sheet__kicker">提醒列表</div>
              <h3>{{ reminderListTitle }}</h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="reminderSheetOpen = false">×</button>
          </div>

          <div class="reminder-sheet__body">
            <section class="reminder-group">
              <div class="reminder-group__title">
                <span>和我相关</span>
                <span>{{ personalReminderItems.length }} 条</span>
              </div>
              <div v-if="personalReminderItems.length" class="reminder-list">
                <article
                  v-for="item in personalReminderItems"
                  :key="item.id"
                  class="reminder-card"
                >
                  <div class="reminder-card__time mono">{{ item.timeLabel }}</div>
                  <div class="reminder-card__main">
                    <div class="reminder-card__label">{{ item.label }}</div>
                    <div v-if="item.detail" class="reminder-card__detail">{{ item.detail }}</div>
                  </div>
                </article>
              </div>
              <div v-else class="reminder-empty">没有待触发的个人提醒</div>
            </section>

            <section class="reminder-group">
              <div class="reminder-group__title">
                <span>系统维护</span>
                <span>{{ internalReminderItems.length }} 条</span>
              </div>
              <div v-if="internalReminderItems.length" class="reminder-list">
                <article
                  v-for="item in internalReminderItems"
                  :key="item.id"
                  class="reminder-card reminder-card--internal"
                >
                  <div class="reminder-card__time mono">{{ item.timeLabel }}</div>
                  <div class="reminder-card__main">
                    <div class="reminder-card__label">{{ item.label }}</div>
                    <div v-if="item.detail" class="reminder-card__detail">{{ item.detail }}</div>
                  </div>
                </article>
              </div>
              <div v-else class="reminder-empty">没有待触发的系统维护</div>
            </section>
          </div>
        </div>
      </div>
    </teleport>

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

    <teleport to="body">
      <div v-if="searchSheetOpen" class="date-sheet-overlay" @click.self="closeSearchSheet">
        <div class="search-sheet">
          <div class="search-sheet__header">
            <div>
              <div class="date-sheet__kicker">全局搜索</div>
              <h3>全部消息</h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="closeSearchSheet">×</button>
          </div>

          <div class="search-sheet__controls">
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              class="search-input"
              type="search"
              placeholder="搜索一句话或关键词"
              autocomplete="off"
            />
            <div class="search-sheet__nav">
              <span class="search-sheet__status">{{ searchStatusText }}</span>
            </div>
          </div>

          <div v-if="searchResults.length" class="search-result-list">
            <button
              v-for="(result, index) in searchResults"
              :key="result.id"
              type="button"
              class="search-result-card"
              :class="{ 'search-result-card--active': index === activeSearchIndex }"
              @click="jumpToSearchResult(index)"
            >
              <span class="search-result-card__meta">
                {{ formatConversationDateDisplay(result.date) }} · {{ searchResultRoleLabel(result.role) }} · {{ formatTime(result.timestamp) }}
              </span>
              <span class="search-result-card__text">
                <template v-for="(part, partIndex) in result.snippetParts" :key="`${result.id}:${partIndex}`">
                  <mark v-if="part.hit" class="search-highlight">{{ part.text }}</mark>
                  <span v-else>{{ part.text }}</span>
                </template>
              </span>
            </button>
          </div>
          <div v-else class="search-empty">
            {{ normalizedSearchQuery ? "没有找到匹配消息" : "输入关键词后，搜索全部消息" }}
          </div>
        </div>
      </div>
    </teleport>

    <div
      v-if="showFloatingLauncher && !dateSheetOpen && !hourSheetOpen && !searchSheetOpen && !reminderSheetOpen && !noteSheetOpen"
      class="floating-actions"
      :class="{ 'floating-actions--open': floatingActionsOpen }"
    >
      <div v-if="floatingActionsOpen" class="floating-actions__menu">
        <button
          v-if="filteredTranscriptDays.length"
          type="button"
          class="floating-action-button"
          title="搜索全部消息"
          @click="handleFloatingAction(openSearchSheet)"
        >
          ⌕
        </button>
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

    <div
      v-if="searchDockVisible && !searchSheetOpen && !dateSheetOpen && !hourSheetOpen && !reminderSheetOpen && !noteSheetOpen"
      class="search-dock"
    >
      <button
        type="button"
        class="search-dock__main"
        title="打开搜索结果"
        @click="openSearchSheet"
      >
        <span class="search-dock__label">搜索</span>
        <span class="search-dock__count">{{ searchDockCountText }}</span>
      </button>
      <button
        type="button"
        class="search-dock__button"
        title="上一条"
        @click="jumpSearchByOffset(-1)"
      >
        ↑
      </button>
      <button
        type="button"
        class="search-dock__button"
        title="下一条"
        @click="jumpSearchByOffset(1)"
      >
        ↓
      </button>
      <button
        type="button"
        class="search-dock__button search-dock__button--close"
        title="关闭搜索导航"
        @click="clearSearchSession"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const loading = ref(false);
const dayLoading = ref(false);
const error = ref("");
const daySummaries = ref([]);
const activeDay = ref(null);
const state = ref({});
const noteDates = ref([]);
const noteDayCache = ref({});
const noteLoading = ref(false);
const threadExpanded = ref(false);
const dateSheetOpen = ref(false);
const reminderSheetOpen = ref(false);
const noteSheetOpen = ref(false);
const noteDateSheetOpen = ref(false);
const currentCalendarMonth = ref("");
const currentNoteCalendarMonth = ref("");
const showFloatingLauncher = ref(false);
const floatingActionsOpen = ref(false);
const attachmentObjectUrls = ref({});
const stickerObjectUrls = ref({});
const hourSheetOpen = ref(false);
const searchSheetOpen = ref(false);
const searchQuery = ref("");
const searchLoading = ref(false);
const searchResults = ref([]);
const activeSearchIndex = ref(-1);
const activeSearchTargetId = ref("");
const searchDockPinned = ref(false);
const searchInputRef = ref(null);
const selectedNoteDate = ref(todayDate());
const messageRefs = new Map();
let searchDebounceTimer = 0;

const calendarWeekdays = ["一", "二", "三", "四", "五", "六", "日"];

const transcriptDays = computed(() => (
  activeDay.value ? [buildTranscriptDay(activeDay.value)].filter((day) => day.items.length) : []
));
const availableConversationDates = computed(() => (
  Array.isArray(daySummaries.value) ? daySummaries.value.map((day) => day.date).filter(Boolean) : []
));
const availableDateSet = computed(() => new Set(availableConversationDates.value));
const availableNoteDateSet = computed(() => new Set(noteDates.value));
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
const activeNoteCalendarMonth = computed(() => buildCalendarMonth(
  currentNoteCalendarMonth.value || resolveCalendarMonth(selectedNoteDate.value),
  availableNoteDateSet.value,
));
const visibleImageAttachments = computed(() => filteredTranscriptDays.value
  .flatMap((day) => Array.isArray(day?.items) ? day.items : [])
  .flatMap((item) => item?.kind === "message" && Array.isArray(item.imageAttachments) ? item.imageAttachments : [])
  .filter((attachment) => attachment?.filePath));
const visibleStickers = computed(() => filteredTranscriptDays.value
  .flatMap((day) => Array.isArray(day?.items) ? day.items : [])
  .flatMap((item) => item?.kind === "message" && Array.isArray(item.stickers) ? item.stickers : [])
  .filter((sticker) => sticker?.id));
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
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());
const searchStatusText = computed(() => {
  if (!normalizedSearchQuery.value) {
    return "输入关键词后搜索全部消息";
  }
  if (searchLoading.value) {
    return "搜索中";
  }
  if (!searchResults.value.length) {
    return "0 条结果";
  }
  const current = activeSearchIndex.value >= 0 ? activeSearchIndex.value + 1 : 1;
  return `${current}/${searchResults.value.length}`;
});
const searchDockVisible = computed(() => searchDockPinned.value && searchResults.value.length > 0);
const searchDockCountText = computed(() => {
  if (!searchResults.value.length) {
    return "0/0";
  }
  const current = activeSearchIndex.value >= 0 ? activeSearchIndex.value + 1 : 1;
  return `${current}/${searchResults.value.length}`;
});

const currentThread = computed(() => (
  resolveCurrentThreadFromDays(activeDay.value ? [activeDay.value] : []) || resolveCurrentThreadFromSessions(state.value.sessions)
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
const metaMode = ref("auto");
const reminderSummaryText = computed(() => formatReminderSummary(state.value.reminderSummary, "active"));
const reminderSummaryAnyText = computed(() => formatReminderSummary(state.value.reminderSummary, "any"));
const hasPersonalReminder = computed(() => (Number(state.value?.reminderSummary?.personal?.total) || 0) > 0);
const reminderItems = computed(() => buildReminderItems(state.value?.reminders));
const personalReminderItems = computed(() => reminderItems.value.filter((item) => item.group === "personal"));
const internalReminderItems = computed(() => reminderItems.value.filter((item) => item.group === "internal"));
const reminderListTitle = computed(() => `${reminderItems.value.length} 条待触发`);
const selectedNoteItems = computed(() => {
  const date = String(selectedNoteDate.value || "").trim();
  if (!date) {
    return [];
  }
  return Array.isArray(noteDayCache.value?.[date]) ? noteDayCache.value[date] : [];
});
const noteListTitle = computed(() => {
  if (!selectedNoteDate.value) {
    return "选择日期";
  }
  return `${formatConversationDateDisplay(selectedNoteDate.value)} · ${selectedNoteItems.value.length} 张`;
});
const metaToggleVisible = computed(() => Boolean(reminderSummaryAnyText.value));
const resolvedMetaMode = computed(() => {
  if (metaMode.value === "auto") {
    return hasPersonalReminder.value ? "reminder" : "thread";
  }
  return metaMode.value;
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [conversationSummaryResult, stateResult, noteDateResult] = await Promise.all([
      cyberbossApi.fetchConversationDays(0),
      cyberbossApi.fetchState(),
      cyberbossApi.fetchNoteDates().catch(() => ({ dates: [] })),
    ]);
    daySummaries.value = Array.isArray(conversationSummaryResult.days) ? conversationSummaryResult.days : [];
    state.value = stateResult || {};
    noteDates.value = Array.isArray(noteDateResult?.dates) ? noteDateResult.dates : [];
    metaMode.value = "auto";
    const nextDate = resolveDefaultConversationDate(daySummaries.value);
    selectedDate.value = nextDate;
    selectedNoteDate.value = resolveDefaultNoteDate(noteDates.value);
    if (selectedNoteDate.value) {
      await ensureNotesForDate(selectedNoteDate.value);
    }
    await loadConversationDay(nextDate);
  } catch (err) {
    error.value = err.message;
    activeDay.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadConversationDay(date) {
  const normalizedDate = String(date || "").trim();
  if (!normalizedDate) {
    activeDay.value = null;
    return;
  }
  const result = await cyberbossApi.fetchConversationDay(normalizedDate);
  activeDay.value = result?.day || null;
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

function openNoteSheet() {
  noteSheetOpen.value = true;
}

async function pickNoteDate(date) {
  selectedNoteDate.value = String(date || "").trim();
  noteDateSheetOpen.value = false;
  await ensureNotesForDate(selectedNoteDate.value);
}

async function ensureNotesForDate(date) {
  const normalizedDate = String(date || "").trim();
  if (!normalizedDate) {
    return;
  }
  if (Array.isArray(noteDayCache.value?.[normalizedDate])) {
    return;
  }
  noteLoading.value = true;
  try {
    const result = await cyberbossApi.fetchNotesByDate(normalizedDate).catch(() => ({ notes: [] }));
    noteDayCache.value = {
      ...noteDayCache.value,
      [normalizedDate]: Array.isArray(result?.notes) ? result.notes : [],
    };
  } finally {
    noteLoading.value = false;
  }
}

function handleNoteDatePick(date) {
  if (!availableNoteDateSet.value.has(date)) {
    return;
  }
  pickNoteDate(date);
}

function switchNoteCalendarMonth(direction) {
  const delta = direction === "older" ? -1 : 1;
  currentNoteCalendarMonth.value = shiftMonthKey(
    activeNoteCalendarMonth.value?.monthKey || resolveCalendarMonth(selectedNoteDate.value),
    delta,
  );
}

async function openSearchSheet() {
  searchSheetOpen.value = true;
  floatingActionsOpen.value = false;
  await nextTick();
  if (searchInputRef.value instanceof HTMLInputElement) {
    searchInputRef.value.focus();
  }
}

function closeSearchSheet() {
  searchSheetOpen.value = false;
}

function clearSearchSession() {
  searchQuery.value = "";
  searchResults.value = [];
  activeSearchIndex.value = -1;
  activeSearchTargetId.value = "";
  searchDockPinned.value = false;
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

function toggleMetaMode() {
  metaMode.value = resolvedMetaMode.value === "thread" ? "reminder" : "thread";
}

function handleDatePick(date) {
  if (!availableDateSet.value.has(date)) {
    return;
  }
  changeSelectedDate(date);
}

async function changeSelectedDate(date) {
  const normalizedDate = String(date || "").trim();
  if (!normalizedDate || normalizedDate === selectedDate.value) {
    dateSheetOpen.value = false;
    return;
  }
  dayLoading.value = true;
  error.value = "";
  try {
    selectedDate.value = normalizedDate;
    await loadConversationDay(normalizedDate);
    dateSheetOpen.value = false;
  } catch (err) {
    error.value = err.message;
  } finally {
    dayLoading.value = false;
  }
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

function jumpSearchByOffset(offset) {
  if (!searchResults.value.length) {
    return;
  }
  const current = activeSearchIndex.value >= 0 ? activeSearchIndex.value : (offset > 0 ? -1 : 0);
  const next = (current + offset + searchResults.value.length) % searchResults.value.length;
  jumpToSearchResult(next);
}

async function jumpToSearchResult(index) {
  const result = searchResults.value[index];
  if (!result) {
    return;
  }
  activeSearchIndex.value = index;
  searchSheetOpen.value = false;
  searchDockPinned.value = true;
  if (String(result.date || "").trim() && result.date !== selectedDate.value) {
    dayLoading.value = true;
    try {
      selectedDate.value = result.date;
      await loadConversationDay(result.date);
    } finally {
      dayLoading.value = false;
    }
  }
  await nextTick();
  const element = messageRefs.get(String(result.id || "").trim());
  if (element instanceof HTMLElement) {
    activeSearchTargetId.value = result.id;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      if (activeSearchTargetId.value === result.id) {
        activeSearchTargetId.value = "";
      }
    }, 1400);
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
        stickers: [],
        actionTags: [],
        before: [],
        after: [],
      });
      lastAssistantItem = null;
      continue;
    }

    if (event?.type === "assistant") {
      const rawText = cleanEventText(event.text || "");
      const isNoteNotice = looksLikeNoteMessage(rawText);
      const assistantItem = {
        id: event.id,
        kind: isNoteNotice ? "note-notice" : "message",
        role: "assistant",
        text: event.text,
        timestamp: event.timestamp,
        attachments: normalizeAttachmentsFromMeta(event.meta),
        imageAttachments: extractImageAttachments(event.meta),
        stickers: normalizeStickers(event.stickers),
        actionTags: Array.isArray(event.actionTags) ? event.actionTags : [],
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

function looksLikeNoteMessage(text) {
  return Boolean(parseLeaveNoteAction(text)) || looksLikeNoteNotice(text);
}

function looksLikeNoteNotice(text) {
  const normalized = String(text || "").trim();
  return /^📝\s*收到一张来自.+的小纸条(?:，当前共有\s*\d+\s*张未读)?$/u.test(normalized);
}

function extractNoteCardLabel(text) {
  const noteAction = parseLeaveNoteAction(text);
  if (noteAction) {
    return noteAction.speaker ? `来自 ${noteAction.speaker}` : "留给你的小纸条";
  }
  return extractNoteNoticeLabel(text);
}

function extractNoteNoticeLabel(text) {
  const normalized = String(text || "").trim();
  const match = normalized.match(/^📝\s*收到一张来自(.+?)的小纸条/u);
  return match?.[1]?.trim() ? `来自 ${match[1].trim()}` : "收到一张小纸条";
}

function extractNoteCardBody(text) {
  const noteAction = parseLeaveNoteAction(text);
  if (noteAction) {
    return noteAction.content;
  }
  return cleanNoteNoticeText(text);
}

function cleanNoteNoticeText(text) {
  const normalized = String(text || "").trim();
  const unreadMatch = normalized.match(/当前共有\s*(\d+)\s*张未读/u);
  if (unreadMatch?.[1]) {
    return `已经替你放在这里了。现在还有 ${unreadMatch[1]} 张未读。`;
  }
  return "已经替你放在这里了。";
}

function parseLeaveNoteAction(text) {
  const normalized = unwrapJsonFence(cleanEventText(text || ""));
  if (!normalized || !normalized.startsWith("{") || !normalized.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized);
    const action = String(parsed?.action || parsed?.cyberboss_action || "").trim().toLowerCase();
    if (action !== "leave_note") {
      return null;
    }
    const content = String(parsed?.content || parsed?.note || parsed?.message || parsed?.text || "").trim();
    if (!content) {
      return null;
    }
    return {
      content,
      addressee: String(parsed?.addressee || "").trim(),
      speaker: String(parsed?.speaker || "").trim(),
    };
  } catch {
    return null;
  }
}

function unwrapJsonFence(text) {
  const normalized = String(text || "").trim();
  const match = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match ? String(match[1] || "").trim() : normalized;
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

function normalizeStickers(stickers) {
  return (Array.isArray(stickers) ? stickers : [])
    .map((sticker) => {
      const id = String(sticker?.id || "").trim();
      if (!id) {
        return null;
      }
      return {
        id,
        label: String(sticker?.label || id).trim(),
      };
    })
    .filter(Boolean);
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

function buildSearchSnippet(text, query) {
  const raw = String(text || "").replace(/\s+/gu, " ").trim();
  const normalizedRaw = raw.toLowerCase();
  const index = normalizedRaw.indexOf(query);
  if (index < 0) {
    return raw.length > 48 ? `${raw.slice(0, 48)}…` : raw;
  }
  const start = Math.max(0, index - 18);
  const end = Math.min(raw.length, index + query.length + 30);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < raw.length ? "…" : "";
  return `${prefix}${raw.slice(start, end)}${suffix}`;
}

function buildSearchSnippetParts(text, query) {
  const snippet = buildSearchSnippet(text, query);
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return [{ text: snippet, hit: false }];
  }
  const output = [];
  const lowerSnippet = snippet.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  let cursor = 0;
  while (cursor < snippet.length) {
    const index = lowerSnippet.indexOf(lowerQuery, cursor);
    if (index < 0) {
      output.push({ text: snippet.slice(cursor), hit: false });
      break;
    }
    if (index > cursor) {
      output.push({ text: snippet.slice(cursor, index), hit: false });
    }
    output.push({ text: snippet.slice(index, index + normalizedQuery.length), hit: true });
    cursor = index + normalizedQuery.length;
  }
  return output.length ? output : [{ text: snippet, hit: false }];
}

function searchResultRoleLabel(role) {
  return role === "user" ? "你" : "他";
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

function stickerObjectUrl(sticker) {
  const id = String(sticker?.id || "").trim();
  return id ? stickerObjectUrls.value[id] || "" : "";
}

function openSticker(sticker) {
  const url = stickerObjectUrl(sticker);
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

async function ensureVisibleStickerUrls() {
  const nextUrls = { ...stickerObjectUrls.value };
  const pending = [];

  for (const sticker of visibleStickers.value) {
    const id = String(sticker?.id || "").trim();
    if (!id || Object.prototype.hasOwnProperty.call(nextUrls, id)) {
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

function revokeAttachmentUrls() {
  for (const value of Object.values(attachmentObjectUrls.value)) {
    if (value) {
      URL.revokeObjectURL(value);
    }
  }
  attachmentObjectUrls.value = {};
}

function revokeStickerUrls() {
  for (const value of Object.values(stickerObjectUrls.value)) {
    if (value) {
      URL.revokeObjectURL(value);
    }
  }
  stickerObjectUrls.value = {};
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

function dayMetaText(day) {
  if (resolvedMetaMode.value === "reminder") {
    return reminderSummaryAnyText.value || buildThreadMetaText(day);
  }
  return buildThreadMetaText(day);
}

function buildThreadMetaText(day) {
  const threadCount = Array.isArray(day?.threadIds) ? day.threadIds.length : 0;
  const itemCount = Array.isArray(day?.items) ? day.items.length : 0;
  return `${threadCount} 个线程 · ${itemCount} 条消息`;
}

function formatReminderSummary(summary, mode = "active") {
  if (!summary || typeof summary !== "object") {
    return "";
  }
  const bucket = mode === "active"
    ? ((Number(summary?.personal?.total) || 0) > 0 ? summary.personal : null)
    : ((Number(summary?.personal?.total) || 0) > 0 ? summary.personal : summary.internal);
  if (!bucket) {
    return "";
  }
  const total = Number(bucket.total) || 0;
  if (!total) {
    return "";
  }
  const dueAtMs = Number(bucket?.next?.dueAtMs);
  const timeText = Number.isFinite(dueAtMs)
    ? new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(dueAtMs))
    : "--:--";
  const label = buildReminderSummaryLabel(String(bucket?.next?.text || "").trim()) || "提醒";
  return `${total}条提醒 · ${timeText} ${label}`;
}

function buildReminderSummaryLabel(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("__cyberboss_daily_diary__|")) {
    return "日记";
  }
  if (normalized.startsWith("__cyberboss_memory_review__|")) {
    return "记忆回顾";
  }
  if (normalized.startsWith("__cyberboss_timeline_confirm__|")) {
    return "时间轴确认";
  }
  if (normalized.startsWith("__cyberboss_sleep__")) {
    return "睡眠提醒";
  }
  if (normalized.startsWith("__cyberboss_presence__")) {
    return "状态提醒";
  }
  if (normalized.startsWith("__cyberboss_")) {
    return "系统提醒";
  }

  let summary = normalized
    .split(/[:：；;，,\n]/u, 1)[0]
    .replace(/\s+/gu, " ")
    .trim();

  summary = summary.replace(/\s*(?:1[).、]|一[、.．）)])[\s\S]*$/u, "").trim();
  summary = summary.replace(/(买|处理|确认|看看|问问|一下)$/u, "").trim();

  if (!summary) {
    summary = normalized;
  }

  return truncateDisplayText(summary, 18);
}

function truncateDisplayText(text, maxLength) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }
  const limit = Number(maxLength);
  if (!Number.isFinite(limit) || limit <= 0 || normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function buildReminderItems(remindersState) {
  const now = Date.now();
  const reminders = Array.isArray(remindersState?.reminders) ? remindersState.reminders : [];
  return reminders
    .map(normalizeReminderItem)
    .filter((item) => item && item.dueAtMs >= now)
    .sort((left, right) => left.dueAtMs - right.dueAtMs);
}

function normalizeReminderItem(reminder) {
  const dueAtMs = Number(reminder?.dueAtMs);
  if (!Number.isFinite(dueAtMs)) {
    return null;
  }
  const text = String(reminder?.text || "").trim();
  const resolved = resolveReminderDisplay(text);
  return {
    id: String(reminder?.id || `${dueAtMs}:${text}`).trim(),
    dueAtMs,
    text,
    group: resolved.group,
    label: resolved.label,
    detail: resolved.detail,
    timeLabel: formatReminderTime(dueAtMs),
  };
}

function resolveReminderDisplay(text) {
  if (text.startsWith("__cyberboss_daily_diary__|")) {
    const [date, time] = text.replace("__cyberboss_daily_diary__|", "").split("|");
    return {
      group: "internal",
      label: "日记",
      detail: joinReminderDetail([date, time]),
    };
  }

  if (text.startsWith("__cyberboss_memory_review__|")) {
    const [date, time] = text.replace("__cyberboss_memory_review__|", "").split("|");
    return {
      group: "internal",
      label: "记忆回顾",
      detail: joinReminderDetail([date, time]),
    };
  }

  if (text.startsWith("__cyberboss_timeline_confirm__|")) {
    const [date, time] = text.replace("__cyberboss_timeline_confirm__|", "").split("|");
    return {
      group: "internal",
      label: "时间轴确认",
      detail: joinReminderDetail([date, time]),
    };
  }

  if (text.startsWith("__cyberboss_sleep__")) {
    const parsed = parseInternalReminderPayload(text, "__cyberboss_sleep__");
    const stageLabelMap = {
      sleep_probe: "睡眠确认",
      assume_asleep: "默认入睡",
      wake_check: "起床确认",
      oversleep_check: "睡眠过长确认",
    };
    return {
      group: "personal",
      label: stageLabelMap[parsed?.stage] || "睡眠提醒",
      detail: parsed?.stage ? `sleep · ${parsed.stage}` : "sleep",
    };
  }

  if (text.startsWith("__cyberboss_presence__")) {
    const parsed = parseInternalReminderPayload(text, "__cyberboss_presence__");
    const stageLabelMap = {
      gentle_checkin: "状态确认",
      lost_contact: "失联确认",
    };
    return {
      group: "personal",
      label: stageLabelMap[parsed?.stage] || "状态提醒",
      detail: parsed?.stage ? `presence · ${parsed.stage}` : "presence",
    };
  }

  if (text.startsWith("__cyberboss_")) {
    return {
      group: "internal",
      label: "系统提醒",
      detail: text.slice(0, 48),
    };
  }

  return {
    group: "personal",
    label: text || "提醒",
    detail: "",
  };
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

function joinReminderDetail(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" · ");
}

function formatReminderTime(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(parsed));
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

function resolveDefaultNoteDate(items) {
  if (!Array.isArray(items) || !items.length) {
    return todayDate();
  }
  const today = todayDate();
  return items.find((date) => date === today) || items[0] || "";
}

watch(daySummaries, (nextDays) => {
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

watch(reminderSheetOpen, (open) => {
  if (open) {
    floatingActionsOpen.value = false;
  }
});

watch(noteSheetOpen, (open) => {
  if (open) {
    floatingActionsOpen.value = false;
    if (selectedNoteDate.value) {
      ensureNotesForDate(selectedNoteDate.value);
    }
  } else {
    noteDateSheetOpen.value = false;
  }
});

watch(noteDateSheetOpen, (open) => {
  if (open) {
    currentNoteCalendarMonth.value = resolveCalendarMonth(selectedNoteDate.value);
    floatingActionsOpen.value = false;
  }
});

watch(hourSheetOpen, (open) => {
  if (open) {
    floatingActionsOpen.value = false;
  }
});

watch(searchSheetOpen, (open) => {
  if (open) {
    floatingActionsOpen.value = false;
  }
});

watch(searchResults, (results) => {
  if (!results.length) {
    activeSearchIndex.value = -1;
    return;
  }
  if (activeSearchIndex.value < 0 || activeSearchIndex.value >= results.length) {
    activeSearchIndex.value = 0;
  }
});

watch(selectedDate, () => {
  activeSearchTargetId.value = "";
});

watch(searchQuery, async (value) => {
  const normalized = String(value || "").trim();
  window.clearTimeout(searchDebounceTimer);
  if (!normalized) {
    searchResults.value = [];
    activeSearchIndex.value = -1;
    searchDockPinned.value = false;
    searchLoading.value = false;
    return;
  }
  searchLoading.value = true;
  searchDebounceTimer = window.setTimeout(async () => {
    try {
      const result = await cyberbossApi.fetchConversationSearch(normalized, 200);
      if (String(searchQuery.value || "").trim() !== normalized) {
        return;
      }
      const query = normalized.toLowerCase();
      searchResults.value = Array.isArray(result?.results)
        ? result.results.map((item) => ({
          ...item,
          snippet: buildSearchSnippet(item.text || "", query),
          snippetParts: buildSearchSnippetParts(item.text || "", query),
        }))
        : [];
    } finally {
      if (String(searchQuery.value || "").trim() === normalized) {
        searchLoading.value = false;
      }
    }
  }, 300);
});

watch(
  visibleImageAttachments,
  async () => {
    await ensureVisibleAttachmentUrls();
  },
  { immediate: true },
);

watch(
  visibleStickers,
  async () => {
    await ensureVisibleStickerUrls();
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
  window.clearTimeout(searchDebounceTimer);
  window.removeEventListener("scroll", updateFloatingLauncher);
  window.removeEventListener("resize", updateFloatingLauncher);
  revokeAttachmentUrls();
  revokeStickerUrls();
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

.meta-trigger--active {
  color: var(--accent);
  border-color: rgba(49, 81, 30, 0.22);
  background: #eef4e5;
}

.reminder-trigger__icon {
  position: relative;
  width: 13px;
  height: 13px;
  border: 1.7px solid currentColor;
  border-radius: 50%;
}

.reminder-trigger__icon::before,
.reminder-trigger__icon::after {
  content: "";
  position: absolute;
  background: currentColor;
}

.reminder-trigger__icon::before {
  left: 5px;
  top: 2px;
  width: 1.5px;
  height: 4.5px;
  border-radius: 999px;
}

.reminder-trigger__icon::after {
  left: 5px;
  top: 5.5px;
  width: 4px;
  height: 1.5px;
  border-radius: 999px;
  transform-origin: left center;
  transform: rotate(32deg);
}

.note-trigger__icon {
  position: relative;
  width: 14px;
  height: 11px;
  border: 1.6px solid currentColor;
  border-radius: 2px;
  overflow: hidden;
}

.note-trigger__icon::before,
.note-trigger__icon::after {
  content: "";
  position: absolute;
  top: 1px;
  width: 7px;
  height: 1.6px;
  background: currentColor;
}

.note-trigger__icon::before {
  left: 0.5px;
  transform-origin: left center;
  transform: rotate(35deg);
}

.note-trigger__icon::after {
  right: 0.5px;
  transform-origin: right center;
  transform: rotate(-35deg);
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
.search-trigger,
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

.search-trigger {
  border-radius: 999px;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--muted);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.date-sheet,
.reminder-sheet {
  width: min(420px, calc(100vw - 36px));
  max-width: calc(100vw - 36px);
  max-height: min(78vh, 620px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px 14px;
  background: linear-gradient(180deg, #fbf7ef 0%, #f4efe6 100%);
  border-radius: 24px;
  box-shadow: 0 20px 48px rgba(24, 35, 15, 0.18);
}

.note-sheet {
  background: linear-gradient(180deg, #fff9ef 0%, #f6eedf 100%);
  height: min(78vh, 620px);
}

.date-sheet__header,
.reminder-sheet__header {
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

.date-sheet__header h3,
.reminder-sheet__header h3 {
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

.reminder-sheet__body {
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  gap: 12px;
  padding-right: 2px;
}

.note-sheet__body {
  min-height: 0;
  gap: 14px;
}

.note-date-trigger {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.note-date-trigger__icon {
  color: var(--muted);
  font-size: 12px;
}

.reminder-group {
  display: grid;
  gap: 8px;
}

.reminder-group__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.reminder-list {
  display: grid;
  gap: 8px;
}

.reminder-card {
  border: 1px solid rgba(24, 35, 15, 0.07);
  border-radius: 18px;
  padding: 10px 12px;
  background: rgba(255, 253, 249, 0.84);
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.reminder-card--internal {
  background: rgba(255, 253, 249, 0.64);
}

.reminder-card__time {
  color: rgba(49, 81, 30, 0.78);
  font-size: 12px;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.reminder-card__main {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.reminder-card__label {
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.reminder-card__detail {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
  word-break: break-word;
}

.reminder-empty {
  border: 1px dashed rgba(24, 35, 15, 0.12);
  border-radius: 18px;
  padding: 18px 12px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  background: rgba(255, 253, 249, 0.48);
}

.note-date-list {
  display: grid;
  gap: 8px;
}

.note-date-row {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.06);
  border-radius: 16px;
  padding: 11px 12px;
  background: rgba(255, 253, 249, 0.84);
  color: var(--ink);
  font: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}

.note-date-row--active {
  border-color: rgba(49, 81, 30, 0.2);
  background: rgba(238, 244, 229, 0.72);
}

.note-group {
  display: grid;
  gap: 8px;
}

.note-list {
  display: grid;
  gap: 10px;
}

.note-card {
  padding: 14px;
}

.note-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.note-card__time {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.3;
}

.note-card__speaker {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.3;
}

.note-card__content {
  font-size: 14px;
}

.note-card__content p {
  margin: 0;
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

.search-sheet {
  width: min(100%, 430px);
  max-height: min(78vh, 640px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px;
  background: linear-gradient(180deg, #fbf7ef 0%, #f4efe6 100%);
  border-radius: 24px;
  box-shadow: 0 20px 48px rgba(24, 35, 15, 0.18);
}

.search-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.search-sheet__header h3 {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.3;
}

.search-sheet__controls {
  display: grid;
  gap: 10px;
}

.search-input {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 16px;
  padding: 0 12px;
  background: rgba(255, 253, 249, 0.94);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  outline: none;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.search-input:focus {
  border-color: rgba(49, 81, 30, 0.24);
  box-shadow: 0 0 0 3px rgba(49, 81, 30, 0.08);
}

.search-sheet__nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.search-sheet__status {
  color: var(--muted);
  font-size: 12px;
}

.search-result-list {
  overflow-y: auto;
  display: grid;
  gap: 8px;
  padding-right: 2px;
}

.search-result-card {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.06);
  border-radius: 16px;
  padding: 10px 12px;
  background: rgba(255, 253, 249, 0.82);
  color: var(--ink);
  text-align: left;
  display: grid;
  gap: 5px;
}

.search-result-card--active {
  border-color: rgba(49, 81, 30, 0.22);
  background: rgba(238, 244, 229, 0.72);
}

.search-result-card__meta {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.2;
}

.search-result-card__text {
  font-size: 13px;
  line-height: 1.5;
}

.search-highlight {
  border-radius: 5px;
  padding: 0 2px;
  background: rgba(217, 157, 80, 0.28);
  color: inherit;
}

.search-empty {
  min-height: 92px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
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

.search-dock {
  position: fixed;
  left: 50%;
  bottom: 86px;
  z-index: 2090;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(24, 35, 15, 0.1);
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.94);
  box-shadow: 0 12px 28px rgba(24, 35, 15, 0.14);
  backdrop-filter: blur(12px);
}

.search-dock__main,
.search-dock__button {
  appearance: none;
  border: 0;
  border-radius: 999px;
  min-height: 34px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.search-dock__main {
  gap: 6px;
  padding: 0 10px 0 12px;
}

.search-dock__label {
  color: var(--muted);
  font-size: 12px;
}

.search-dock__count {
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
}

.search-dock__button {
  width: 34px;
  font-size: 15px;
  background: rgba(238, 244, 229, 0.68);
}

.search-dock__button--close {
  color: var(--muted);
  background: rgba(244, 239, 229, 0.78);
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
  min-width: 0;
}

.day-divider__meta-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  justify-content: flex-end;
}

.day-divider__date {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  flex: 0 0 auto;
}

.day-divider__meta {
  color: var(--muted);
  font-size: 12px;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-align: right;
}

.meta-switch {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  line-height: 1;
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

.chat-row--note-notice {
  justify-items: center;
}

.chat-row--search-hit .chat-bubble {
  outline: 2px solid rgba(49, 81, 30, 0.24);
  box-shadow: 0 0 0 6px rgba(238, 244, 229, 0.7);
}

.chat-row--search-hit .desk-note__sheet {
  outline: 2px solid rgba(49, 81, 30, 0.2);
  box-shadow: 0 10px 30px rgba(88, 104, 68, 0.12), 0 0 0 6px rgba(238, 244, 229, 0.7);
}

.desk-note {
  width: min(100%, 420px);
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 18px 0 10px;
  position: relative;
  filter:
    drop-shadow(0 4px 16px rgba(88, 72, 47, 0.09))
    drop-shadow(0 1px 4px rgba(88, 72, 47, 0.04));
}

.desk-note__kicker {
  color: rgba(122, 103, 77, 0.72);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.desk-note__sheet {
  width: 100%;
  padding: 22px 22px 24px;
  background: #fffef9;
  border: 1px solid rgba(180, 160, 120, 0.12);
  border-radius: 2px;
  position: relative;
  box-shadow:
    0 2px 8px rgba(88, 72, 47, 0.04),
    0 6px 20px rgba(88, 72, 47, 0.05);
}

/* folded bottom-right corner */
.desk-note__sheet::before {
  content: "";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 0 26px 26px;
  border-color: transparent transparent #ece3d2 transparent;
  z-index: 2;
  pointer-events: none;
}

.desk-note__sheet > * {
  position: relative;
}

.desk-note__sheet > *::selection {
  background: rgba(210, 181, 126, 0.28);
}

.desk-note__meta {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 2px 14px;
  color: rgba(114, 90, 60, 0.78);
  font-size: 12px;
  z-index: 1;
}

.desk-note__from {
  font-weight: 600;
  letter-spacing: 0.03em;
}

.desk-note__body {
  position: relative;
  z-index: 1;
  color: #4d3c29;
  font-size: 15px;
  line-height: 2.05;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 640px) {
  .date-sheet-overlay {
    padding: 12px;
  }

  .reminder-sheet {
    width: min(100vw - 24px, 420px);
    max-width: min(100vw - 24px, 420px);
  }

  .reminder-sheet__body {
    padding-right: 0;
  }

  .reminder-card {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .reminder-card__time {
    font-size: 11px;
  }

  .desk-note {
    width: min(100%, 268px);
    padding: 10px 0 6px;
  }

  .desk-note__sheet {
    padding: 16px 14px 16px;
  }

  .desk-note__sheet::before {
    border-width: 0 0 20px 20px;
  }

  .desk-note__meta {
    margin: 8px 2px 10px;
    font-size: 10px;
  }

  .desk-note__body {
    font-size: 13px;
    line-height: 1.8;
  }
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

.sticker-message-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: min(100%, 82%);
  margin-top: -2px;
  padding-left: 14px;
}

.sticker-message {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 18px;
  padding: 7px;
  background: rgba(255, 253, 249, 0.76);
}

.sticker-message__image,
.sticker-message__placeholder {
  width: 96px;
  height: 96px;
  border-radius: 13px;
}

.sticker-message__image {
  display: block;
  object-fit: contain;
}

.sticker-message__placeholder {
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 11px;
  background: rgba(24, 35, 15, 0.04);
}

.action-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: min(100%, 82%);
  margin-top: -4px;
  padding-left: 14px;
}

.action-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: rgba(24, 35, 15, 0.54);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

.action-tag__marker {
  color: rgba(24, 35, 15, 0.5);
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
}

.action-tag__label {
  line-height: 1.15;
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
  .sticker-message-row,
  .sidecar-stack {
    width: min(100%, 88%);
  }

  .sticker-message__image,
  .sticker-message__placeholder {
    width: 84px;
    height: 84px;
  }

  .day-divider {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
