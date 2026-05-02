<template>
  <section class="distribution-shell">
    <div class="distribution-toolbar">
      <div class="distribution-toolbar__top">
        <div class="distribution-switch">
          <template v-for="(option, index) in rangeTypeOptions" :key="option.value">
            <button
              type="button"
              class="distribution-switch__button"
              :class="{ 'distribution-switch__button--active': rangeType === option.value }"
              @click="rangeType = option.value"
            >
              {{ option.label }}
            </button>
            <span
              v-if="index < rangeTypeOptions.length - 1"
              class="distribution-switch__divider"
            >
              |
            </span>
          </template>
        </div>

        <button
          type="button"
          class="distribution-select-trigger"
          @click="openRangePicker"
        >
          <span class="distribution-select-trigger__label">{{ currentRange?.label || "选择范围" }}</span>
          <span class="distribution-select-trigger__icon">⌄</span>
        </button>
      </div>

    </div>

    <van-empty v-if="!currentRange" description="还没有分布数据" />

    <template v-else>
      <section class="section-card donut-card">
        <div class="donut-card__head">
          <div class="donut-card__head-top">
            <span v-if="detailMode === 'distribution'" class="donut-card__total">{{ formatHours(currentRange.totalMinutes) }}</span>
            <div
              v-else-if="detailMode === 'breakdown' || detailMode === 'trend' || detailMode === 'event'"
              ref="categoryPickerRef"
              class="detail-picker-anchor"
            >
              <button
                type="button"
                class="detail-select-trigger"
                :class="{ 'detail-select-trigger--active': categoryPickerOpen }"
                @click.stop="toggleCategoryPicker"
              >
                <span class="detail-select-trigger__value">
                  <span
                    v-if="selectedCategoryId"
                    class="category-dot"
                    :style="{ background: resolveCategoryColor(selectedCategory) }"
                  ></span>
                  <span>{{ detailFilterLabel }}</span>
                </span>
                <span class="detail-select-trigger__icon">⌄</span>
              </button>

              <section
                v-if="categoryPickerOpen"
                class="detail-popover section-card"
                :class="{ 'detail-popover--split': detailMode === 'trend' || detailMode === 'event' }"
                @click.stop
              >
                <template v-if="detailMode === 'trend' || detailMode === 'event'">
                  <div class="detail-picker-split">
                    <div class="detail-picker-section detail-picker-section--stack">
                      <div class="detail-picker-section__title">大类</div>
                      <div class="detail-picker-grid detail-picker-grid--stack">
                        <button
                          v-for="category in currentRange.categories"
                          :key="`${detailMode}-picker-${category.categoryId}`"
                          type="button"
                          class="detail-picker-item"
                          :class="{ 'detail-picker-item--active': category.categoryId === selectedCategoryId }"
                          @click="toggleCategorySelection(category.categoryId)"
                        >
                          <span class="category-row__left">
                            <span class="category-dot" :style="{ background: resolveCategoryColor(category) }"></span>
                            <span>{{ formatCategoryLabel(category) }}</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    <div v-if="selectedCategoryId" class="detail-picker-section detail-picker-section--fill">
                      <div class="detail-picker-section__title">细分</div>
                      <div class="detail-picker-grid detail-picker-grid--stack">
                        <button
                          v-for="subcategory in selectedDetailSubcategories"
                          :key="`${detailMode}-subpicker-${subcategory.subcategoryId}`"
                          type="button"
                          class="detail-picker-item"
                          :class="{ 'detail-picker-item--active': subcategory.subcategoryId === selectedSubcategoryId }"
                          @click="handleDetailSubcategoryPick(subcategory.subcategoryId)"
                        >
                          <span class="category-row__left">
                            <span class="category-dot" :style="{ background: resolveSubcategoryColor(subcategory) }"></span>
                            <span>{{ formatSubcategoryLabel(subcategory) }}</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </template>

                <div v-else class="detail-picker-grid">
                  <button
                    v-for="category in currentRange.categories"
                    :key="`${detailMode}-picker-${category.categoryId}`"
                    type="button"
                    class="detail-picker-item"
                    :class="{ 'detail-picker-item--active': category.categoryId === selectedCategoryId }"
                    @click="handleCategoryPick(category.categoryId)"
                  >
                    <span class="category-row__left">
                      <span class="category-dot" :style="{ background: resolveCategoryColor(category) }"></span>
                      <span>{{ formatCategoryLabel(category) }}</span>
                    </span>
                  </button>
                </div>
              </section>
            </div>

            <div class="detail-switch">
              <template v-for="(option, index) in detailModeOptions" :key="option.value">
                <button
                  type="button"
                  class="detail-switch__button"
                  :class="{ 'detail-switch__button--active': detailMode === option.value }"
                  @click="detailMode = option.value"
                >
                  {{ option.label }}
                </button>
                <span
                  v-if="index < detailModeOptions.length - 1"
                  class="detail-switch__divider"
                >
                  |
                </span>
              </template>
            </div>
          </div>
        </div>

        <template v-if="detailMode === 'distribution'">
          <div class="donut-wrap">
            <div
              class="donut"
              :class="{
                'donut--interactive': !distributionUsesStaticDonut,
                'donut--static': distributionUsesStaticDonut,
              }"
              :style="distributionUsesStaticDonut ? distributionStaticDonutStyle : undefined"
              @click="distributionUsesStaticDonut ? toggleCategorySelection(singleDistributionCategory?.categoryId) : undefined"
            >
              <svg
                v-if="!distributionUsesStaticDonut"
                class="donut-svg"
                viewBox="0 0 220 220"
                aria-label="分类分布图"
              >
                <g
                  v-for="segment in donutSegments"
                  :key="segment.id"
                  class="donut-segment-wrap"
                  :class="{ 'donut-segment-wrap--active': segment.id === selectedCategoryId }"
                  :transform="segment.transform"
                >
                  <path
                    class="donut-segment"
                    :d="segment.path"
                    :fill="segment.color"
                    @click="toggleCategorySelection(segment.id)"
                  />
                </g>
              </svg>
              <div class="donut__center">
                <strong>{{ formatCategoryLabel(selectedCategory) || "全部" }}</strong>
                <span>{{ formatHours(selectedCategory?.minutes || currentRange.totalMinutes || 0) }}</span>
              </div>
            </div>
          </div>

          <div class="category-list">
            <button
              v-for="category in currentRange.categories"
              :key="category.categoryId"
              type="button"
              class="category-row"
              :class="{ 'category-row--active': category.categoryId === selectedCategoryId }"
              @click="toggleCategorySelection(category.categoryId)"
            >
              <span class="category-row__left">
                <span class="category-dot" :style="{ background: resolveCategoryColor(category) }"></span>
                <span>{{ formatCategoryLabel(category) }}</span>
              </span>
              <span class="category-row__right">
                <strong>{{ formatHours(category.minutes) }}</strong>
                <small>{{ formatPercent(category.percent) }}</small>
              </span>
            </button>
          </div>
        </template>

        <template v-else>
          <template v-if="detailMode === 'breakdown'">
            <van-empty
              v-if="!selectedCategoryId || !selectedDetail?.subcategories?.length"
              :description="selectedCategoryId ? '这个分类没有更细的细分' : '先选择一个分类'"
            />
            <template v-else>
              <div class="donut-wrap">
                <div
                  class="donut"
                  :class="{
                    'donut--interactive': !breakdownUsesStaticDonut,
                    'donut--static': breakdownUsesStaticDonut,
                  }"
                  :style="breakdownUsesStaticDonut ? breakdownStaticDonutStyle : undefined"
                  @click="breakdownUsesStaticDonut ? toggleSubcategorySelection(singleBreakdownSubcategory?.subcategoryId) : undefined"
                >
                  <svg
                    v-if="!breakdownUsesStaticDonut"
                    class="donut-svg"
                    viewBox="0 0 220 220"
                    aria-label="细分类分布图"
                  >
                    <g
                      v-for="segment in breakdownSegments"
                      :key="segment.id"
                      class="donut-segment-wrap"
                      :class="{ 'donut-segment-wrap--active': segment.id === selectedSubcategoryId }"
                      :transform="segment.transform"
                    >
                      <path
                        class="donut-segment"
                        :d="segment.path"
                        :fill="segment.color"
                        @click="toggleSubcategorySelection(segment.id)"
                      />
                    </g>
                  </svg>
                  <div class="donut__center">
                    <strong>{{ formatSubcategoryLabel(selectedSubcategory) || formatDetailLabel(selectedDetail) || formatCategoryLabel(selectedCategory) || "细分" }}</strong>
                    <span>{{ formatHours(selectedSubcategory?.minutes || totalSubcategoryMinutes) }}</span>
                  </div>
                </div>
              </div>

              <div class="breakdown-list">
                <button
                  v-for="subcategory in selectedDetail.subcategories"
                  :key="subcategory.subcategoryId"
                  type="button"
                  class="breakdown-row section-card"
                  :class="{ 'breakdown-row--active': subcategory.subcategoryId === selectedSubcategoryId }"
                  @click="toggleSubcategorySelection(subcategory.subcategoryId)"
                >
                  <div class="breakdown-row__meta">
                    <span class="category-row__left">
                      <span class="category-dot" :style="{ background: resolveSubcategoryColor(subcategory) }"></span>
                      <span>{{ formatSubcategoryLabel(subcategory) }}</span>
                    </span>
                    <span class="breakdown-row__stats">
                      <strong>{{ formatHours(subcategory.minutes) }}</strong>
                      <small>{{ formatPercent(subcategory.percent) }}</small>
                    </span>
                  </div>
                </button>
              </div>
            </template>
          </template>

          <template v-else-if="detailMode === 'trend'">
            <van-empty
              v-if="!selectedCategoryId || !trendPoints.length"
              :description="selectedCategoryId ? '这个筛选下没有趋势数据' : '先选择一个分类'"
            />
            <template v-else>
              <div class="trend-chart section-card">
                <div class="trend-chart__plot">
                  <div class="trend-y-axis">
                    <span
                      v-for="tick in trendTicks"
                      :key="`tick-${tick.value}`"
                      class="trend-y-axis__label"
                      :style="{ bottom: `${tick.position}%` }"
                    >
                      {{ formatTrendTick(tick.value) }}
                    </span>
                  </div>
                  <div class="trend-plot-area">
                    <div
                      v-for="tick in trendTicks"
                      :key="`line-${tick.value}`"
                      class="trend-grid-line"
                      :style="{ bottom: `${tick.position}%` }"
                    ></div>
                    <div class="trend-chart__bars" :style="trendBarsStyle">
                      <button
                        v-for="point in trendPoints"
                        :key="point.key"
                        type="button"
                        class="trend-bar-wrap"
                        :class="{
                          'trend-bar-wrap--with-label': shouldShowTrendLabel(point, trendPoints.length),
                          'trend-bar-wrap--active': point.key === selectedTrendKey,
                        }"
                        @click="selectedTrendKey = point.key"
                      >
                        <div
                          class="trend-bar"
                          :class="{ 'trend-bar--empty': (Number(point.minutes) || 0) <= 0 }"
                          :style="{
                            height: `${resolveTrendHeight(point.minutes)}px`,
                            background: resolveCategoryColor(selectedCategory),
                          }"
                        ></div>
                        <span class="trend-bar__label">
                          {{ shouldShowTrendLabel(point, trendPoints.length) ? formatTrendLabel(point) : "" }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <section v-if="selectedTrendPoint" class="trend-events">
                <van-empty
                  v-if="!selectedTrendEvents.length"
                  description="这个时间段没有可展示的事件"
                />
                <div v-else class="event-detail-list">
                  <article
                    v-for="event in selectedTrendEvents"
                    :key="`${selectedTrendPoint.key}-${event.eventNodeId}-${event.fullLabel}`"
                    class="event-detail-card section-card"
                  >
                    <div class="event-detail-card__top">
                      <div class="event-detail-card__top-left">
                        <div class="event-detail-card__time">
                          {{ [event.dateLabel, event.timeLabel].filter(Boolean).join(" · ") || "—" }}
                        </div>
                        <div class="event-detail-card__category event-detail-card__category--inline">
                          {{ formatEventSubcategoryLabel(event) || formatCategoryLabel(selectedCategory) || "分类" }}
                        </div>
                      </div>
                      <div class="event-detail-card__duration event-detail-card__duration--top">
                        {{ event.compactDuration || formatHours(event.minutes) }}
                      </div>
                    </div>
                    <div class="event-detail-card__title">{{ event.label || event.fullLabel || "事件" }}</div>
                    <div v-if="event.note" class="event-detail-card__note">备注：{{ event.note }}</div>
                  </article>
                </div>
              </section>
            </template>
          </template>

          <template v-else-if="detailMode === 'event'">
            <van-empty
              v-if="!selectedCategoryId || !filteredDetailEvents.length"
              :description="selectedCategoryId ? '这个筛选下没有事件' : '先选择一个分类'"
            />
            <div v-else class="event-detail-list">
              <article
                v-for="event in filteredDetailEvents"
                :key="`${event.eventNodeId}-${event.fullLabel}`"
                class="event-detail-card section-card"
              >
                <div class="event-detail-card__top">
                  <div class="event-detail-card__top-left">
                    <div class="event-detail-card__time">
                      {{ [event.dateLabel, event.timeLabel].filter(Boolean).join(" · ") || "—" }}
                    </div>
                    <div class="event-detail-card__category event-detail-card__category--inline">
                      {{ formatEventSubcategoryLabel(event) || formatCategoryLabel(selectedCategory) || "分类" }}
                    </div>
                  </div>
                  <div class="event-detail-card__duration event-detail-card__duration--top">
                    {{ event.compactDuration || formatHours(event.minutes) }}
                  </div>
                </div>
                <div class="event-detail-card__title">{{ event.label || event.fullLabel || "事件" }}</div>
                <div v-if="event.note" class="event-detail-card__note">备注：{{ event.note }}</div>
              </article>
            </div>
          </template>
        </template>
      </section>
    </template>

    <teleport to="body">
      <div v-if="rangePickerOpen" class="range-picker-overlay" @click.self="closeRangePicker">
        <div class="range-picker-sheet">
          <div class="range-picker-sheet__header">
            <div>
              <div class="range-picker-sheet__kicker">{{ rangePickerTitle }}</div>
              <h3>{{ currentRange?.label || "选择范围" }}</h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="closeRangePicker">×</button>
          </div>

          <div class="range-picker-sheet__body">
            <template v-if="rangeType === 'day' && activeDayCalendarMonth">
              <section class="range-calendar section-card">
                <div class="range-calendar__topbar">
                  <button type="button" class="range-calendar__switch" @click="switchDayCalendarMonth(-1)">‹</button>
                  <div class="range-calendar__title">{{ activeDayCalendarMonth.monthLabel }}</div>
                  <button type="button" class="range-calendar__switch" @click="switchDayCalendarMonth(1)">›</button>
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

                <div class="range-calendar__grid">
                  <button
                    v-for="cell in activeDayCalendarMonth.cells"
                    :key="cell.key"
                    type="button"
                    class="range-calendar__day"
                    :class="{
                      'range-calendar__day--placeholder': cell.kind === 'placeholder',
                      'range-calendar__day--muted': cell.kind === 'day' && !cell.available,
                      'range-calendar__day--active': cell.date === currentRangeKey,
                      'range-calendar__day--today': cell.date === selectedDate,
                    }"
                    :disabled="cell.kind !== 'day' || !cell.available"
                    @click="handleRangePick(cell.date)"
                  >
                    <template v-if="cell.kind === 'day'">{{ cell.dayNumber }}</template>
                  </button>
                </div>
              </section>
            </template>

            <template v-else-if="rangeType === 'week'">
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
                      'week-calendar__row--active': row.weekKey === currentRangeKey,
                      'week-calendar__row--muted': !row.available,
                    }"
                    :disabled="!row.available"
                    @click="handleRangePick(row.weekKey)"
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
            </template>

            <template v-else-if="rangeType === 'month'">
              <section class="range-calendar section-card">
                <div class="range-calendar__topbar">
                  <button type="button" class="range-calendar__switch" @click="monthPickerYear -= 1">‹</button>
                  <div class="range-calendar__title">{{ monthPickerYear }} 年</div>
                  <button type="button" class="range-calendar__switch" @click="monthPickerYear += 1">›</button>
                </div>

                <div class="month-grid">
                  <button
                    v-for="monthCell in monthPickerCells"
                    :key="monthCell.key"
                    type="button"
                    class="month-grid__item"
                    :class="{
                      'month-grid__item--active': monthCell.key === currentRangeKey,
                      'month-grid__item--muted': !monthCell.available,
                    }"
                    :disabled="!monthCell.available"
                    @click="handleRangePick(monthCell.key)"
                  >
                    {{ monthCell.label }}
                  </button>
                </div>
              </section>
            </template>
          </div>
        </div>
      </div>

    </teleport>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const CATEGORY_COLORS = {
  state: "var(--cat-state)",
  life: "var(--cat-life)",
  work: "var(--cat-work)",
  study: "var(--cat-study)",
  exercise: "var(--cat-exercise)",
  entertainment: "var(--cat-entertainment)",
  health: "var(--cat-health)",
  social: "var(--cat-social)",
  care: "var(--cat-care)",
  travel: "var(--cat-travel)",
  rest: "var(--cat-rest)",
};

const CATEGORY_COLOR_VALUES = {
  "--cat-state": "#4e79a7",
  "--cat-life": "#ff8f7a",
  "--cat-work": "#ffb84d",
  "--cat-study": "#7bc96f",
  "--cat-exercise": "#4fcfff",
  "--cat-entertainment": "#ff74c8",
  "--cat-health": "#52d6c3",
  "--cat-social": "#a67cff",
  "--cat-care": "#ff9eb5",
  "--cat-travel": "#6fa8ff",
  "--cat-rest": "#8a84ff",
};

const TREND_PLOT_HEIGHT = 200;

const CATEGORY_LABELS = {
  state: "状态",
  life: "生活",
  work: "工作",
  study: "学习",
  exercise: "运动",
  entertainment: "娱乐",
  health: "健康",
  social: "社交",
  care: "照料",
  travel: "出行",
  rest: "休息",
};

const SUBCATEGORY_LABELS = {
  "state.mood": "情绪",
  "life.meal": "吃饭",
  "life.hygiene": "洗漱",
  "life.chores": "家务",
  "life.shopping": "购物",
  "life.errand": "跑腿",
  "life.other": "其他生活",
  "life.sleep": "睡眠",
  "life.rest": "休息",
  "life.morning": "晨间",
  "life.communication": "交流",
  "work.coding": "编程",
  "work.meeting": "会议",
  "work.writing": "写作",
  "work.communication": "沟通",
  "work.other": "其他工作",
  "work.research": "研究",
  "study.reading": "阅读",
  "study.course": "课程",
  "study.practice": "练习",
  "study.review": "复盘",
  "study.other": "其他学习",
  "exercise.walk": "散步",
  "exercise.workout": "锻炼",
  "exercise.stretch": "拉伸",
  "exercise.other": "其他运动",
  "entertainment.video": "视频",
  "entertainment.game": "游戏",
  "entertainment.social_media": "社媒",
  "entertainment.music": "音乐",
  "entertainment.other": "其他娱乐",
  "health.rest": "恢复",
  "health.medication": "用药",
  "health.pain": "症状护理",
  "health.hospital": "就医",
  "health.other": "其他健康",
  "social.chat": "聊天",
  "social.call": "通话",
  "social.family": "家人相处",
  "social.other": "其他社交",
  "care.pet": "宠物照料",
  "care.household": "居家照料",
  "care.self": "自我照料",
  "care.other": "其他照料",
  "travel.commute": "通勤",
  "travel.transit": "路途",
  "travel.other": "其他出行",
  "rest.sleep": "睡眠",
  "rest.wakeup": "起床",
  "rest.nap": "小睡",
  "rest.idle": "放空",
  "rest.other": "其他休息",
};

const TOKEN_LABELS = {
  mood: "情绪",
  meal: "吃饭",
  hygiene: "洗漱",
  chores: "家务",
  shopping: "购物",
  errand: "跑腿",
  other: "其他",
  sleep: "睡眠",
  wakeup: "起床",
  rest: "休息",
  morning: "晨间",
  communication: "交流",
  coding: "编程",
  meeting: "会议",
  writing: "写作",
  research: "研究",
  reading: "阅读",
  course: "课程",
  practice: "练习",
  review: "复盘",
  walk: "散步",
  workout: "锻炼",
  stretch: "拉伸",
  video: "视频",
  game: "游戏",
  social_media: "社媒",
  music: "音乐",
  medication: "用药",
  pain: "症状护理",
  hospital: "就医",
  chat: "聊天",
  call: "通话",
  family: "家人相处",
  pet: "宠物照料",
  household: "居家照料",
  self: "自我照料",
  commute: "通勤",
  transit: "路途",
  idle: "放空",
};

const props = defineProps({
  analytics: {
    type: Object,
    default: () => ({}),
  },
  selectedDate: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["load-range"]);

const rangeType = ref("day");
const selectedRangeKeys = ref({
  day: "",
  week: "",
  month: "",
});
const selectedCategoryId = ref("");
const selectedSubcategoryId = ref("");
const detailMode = ref("distribution");
const selectedTrendKey = ref("");
const rangePickerOpen = ref(false);
const categoryPickerOpen = ref(false);
const categoryPickerRef = ref(null);
const dayPickerMonth = ref("");
const weekPickerMonth = ref("");
const monthPickerYear = ref(new Date().getFullYear());

const rangeTypeOptions = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" },
];

const detailModeOptions = [
  { value: "distribution", label: "分布" },
  { value: "breakdown", label: "细分" },
  { value: "trend", label: "趋势" },
  { value: "event", label: "事件" },
];

const calendarWeekdays = ["一", "二", "三", "四", "五", "六", "日"];

const analyticsByType = computed(() => ({
  day: normalizeRanges(props.analytics?.day),
  week: normalizeRanges(props.analytics?.week),
  month: normalizeRanges(props.analytics?.month),
}));

const currentRangeOptions = computed(() => analyticsByType.value[rangeType.value].map((entry) => ({
  text: entry.label || entry.key,
  value: entry.key,
})));

const currentRangeTypeLabel = computed(() => {
  const current = rangeTypeOptions.find((option) => option.value === rangeType.value);
  return current?.label || "范围";
});

const currentRangeKey = computed({
  get() {
    return selectedRangeKeys.value[rangeType.value] || "";
  },
  set(value) {
    selectedRangeKeys.value = {
      ...selectedRangeKeys.value,
      [rangeType.value]: value,
    };
  },
});

const currentRange = computed(() => (
  analyticsByType.value[rangeType.value].find((entry) => entry.key === currentRangeKey.value) || null
));

const rangePickerTitle = computed(() => {
  const labelMap = {
    day: "日期",
    week: "周次",
    month: "月份",
  };
  return labelMap[rangeType.value] || "范围";
});

const availableDaySet = computed(() => new Set(
  analyticsByType.value.day.map((entry) => String(entry.key || "").trim()).filter(Boolean),
));

const activeDayCalendarMonth = computed(() => buildCalendarMonth(
  dayPickerMonth.value || resolveDayPickerMonth(),
  availableDaySet.value,
));

const availableWeekSet = computed(() => new Set(
  analyticsByType.value.week.map((entry) => String(entry.key || "").trim()).filter(Boolean),
));

const activeWeekCalendarMonth = computed(() => buildWeekCalendarMonth(
  weekPickerMonth.value || resolveWeekPickerMonth(),
  availableWeekSet.value,
));

const monthPickerCells = computed(() => {
  const availableMonths = new Set(
    analyticsByType.value.month.map((entry) => String(entry.key || "").trim()).filter(Boolean),
  );
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const key = `${monthPickerYear.value}-${month}`;
    return {
      key,
      label: `${index + 1}月`,
      available: availableMonths.has(key),
    };
  });
});

const selectedCategory = computed(() => (
  currentRange.value?.categories?.find((category) => category.categoryId === selectedCategoryId.value) || null
));

const selectedDetail = computed(() => {
  const detailMap = currentRange.value?.categoryDetails || {};
  return detailMap[selectedCategoryId.value] || null;
});

const selectedDetailSubcategories = computed(() => (
  Array.isArray(selectedDetail.value?.subcategories) ? selectedDetail.value.subcategories : []
));

const donutSegments = computed(() => buildDonutSegments(
  Array.isArray(currentRange.value?.categories) ? currentRange.value.categories : [],
  resolveCategoryColor,
  selectedCategoryId.value,
));

const distributionUsesStaticDonut = computed(() => donutSegments.value.length <= 1);

const singleDistributionCategory = computed(() => (
  Array.isArray(currentRange.value?.categories) ? currentRange.value.categories[0] || null : null
));

const distributionStaticDonutStyle = computed(() => ({
  "--donut-static-background": distributionDonutStyle.value.background || "transparent",
}));

const breakdownSegments = computed(() => buildDonutSegments(
  Array.isArray(selectedDetail.value?.subcategories) ? selectedDetail.value.subcategories : [],
  resolveSubcategoryColor,
  selectedSubcategoryId.value,
  (item) => item.subcategoryId,
));

const breakdownUsesStaticDonut = computed(() => breakdownSegments.value.length <= 1);

const singleBreakdownSubcategory = computed(() => (
  Array.isArray(selectedDetail.value?.subcategories) ? selectedDetail.value.subcategories[0] || null : null
));

const breakdownStaticDonutStyle = computed(() => ({
  "--donut-static-background": breakdownDonutStyle.value.background || "transparent",
}));

const selectedSubcategory = computed(() => (
  selectedDetail.value?.subcategories?.find((subcategory) => subcategory.subcategoryId === selectedSubcategoryId.value) || null
));

const effectiveSubcategoryId = computed(() => {
  if (selectedSubcategoryId.value) {
    return selectedSubcategoryId.value;
  }
  if (detailMode.value !== "trend" && detailMode.value !== "event") {
    return "";
  }
  return selectedDetailSubcategories.value.length === 1
    ? selectedDetailSubcategories.value[0]?.subcategoryId || ""
    : "";
});

const detailEvents = computed(() => (
  Array.isArray(selectedDetail.value?.events) ? selectedDetail.value.events : []
));

const filteredDetailEvents = computed(() => (
  effectiveSubcategoryId.value
    ? detailEvents.value.filter((event) => event.subcategoryId === effectiveSubcategoryId.value)
    : detailEvents.value
));

const trendPoints = computed(() => {
  const rawBasePoints = Array.isArray(selectedDetail.value?.trend) ? selectedDetail.value.trend : [];
  const basePoints = rawBasePoints.length
    ? rawBasePoints
    : buildTrendTemplateFromEvents(detailEvents.value, rangeType.value);
  if (!effectiveSubcategoryId.value) {
    return rawBasePoints.length
      ? rawBasePoints
      : buildTrendPointsFromEvents(basePoints, detailEvents.value, rangeType.value);
  }
  return buildTrendPointsFromEvents(basePoints, filteredDetailEvents.value, rangeType.value);
});

const trendBarsStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(trendPoints.value.length, 1)}, minmax(0, 1fr))`,
}));

const selectedTrendPoint = computed(() => (
  trendPoints.value.find((point) => point.key === selectedTrendKey.value) || null
));

const selectedTrendEvents = computed(() => {
  const point = selectedTrendPoint.value;
  const events = filteredDetailEvents.value;
  if (!point) {
    return [];
  }
  return events.filter((event) => eventMatchesTrendPoint(event, point));
});

const trendMaxMinutes = computed(() => {
  const points = trendPoints.value;
  return points.reduce((max, point) => Math.max(max, Number(point.minutes) || 0), 0) || 1;
});

const detailModeLabel = computed(() => {
  const labelMap = {
    distribution: "分布",
    breakdown: "细分",
    trend: "趋势",
    event: "事件",
  };
  return labelMap[detailMode.value] || "详情";
});

const detailFilterLabel = computed(() => {
  if (detailMode.value === "breakdown") {
    return formatCategoryLabel(selectedCategory.value) || "选择分类";
  }
  if (selectedSubcategoryId.value) {
    return formatSubcategoryLabel(selectedSubcategory.value) || "筛选分类";
  }
  if (selectedCategoryId.value) {
    return formatCategoryLabel(selectedCategory.value) || "筛选分类";
  }
  return "筛选分类";
});

const breakdownDonutStyle = computed(() => buildDonutStyle(
  Array.isArray(selectedDetail.value?.subcategories) ? selectedDetail.value.subcategories : [],
  resolveSubcategoryColor,
));

const distributionDonutStyle = computed(() => buildDonutStyle(
  Array.isArray(currentRange.value?.categories) ? currentRange.value.categories : [],
  resolveCategoryColor,
));

const totalSubcategoryMinutes = computed(() => {
  const items = Array.isArray(selectedDetail.value?.subcategories) ? selectedDetail.value.subcategories : [];
  return items.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
});

const trendTicks = computed(() => {
  const max = trendMaxMinutes.value;
  return [
    { value: max, position: 100 },
    { value: Math.round(max * 0.66), position: 66 },
    { value: Math.round(max * 0.33), position: 33 },
    { value: 0, position: 0 },
  ].filter((tick, index, list) => (
    list.findIndex((item) => item.value === tick.value) === index
  ));
});

watch(
  () => [props.selectedDate, props.analytics],
  () => {
    syncRangeKeys();
    syncSelectedCategory();
  },
  { immediate: true, deep: true },
);

watch(rangeType, () => {
  syncRangeKeys();
  syncSelectedCategory();
  closeCategoryPicker();
  requestCurrentRange();
});

watch(currentRangeKey, () => {
  syncSelectedCategory();
  closeCategoryPicker();
  requestCurrentRange();
});

watch(
  () => [detailMode.value, rangeType.value, currentRangeKey.value, selectedCategoryId.value, selectedSubcategoryId.value],
  () => {
    syncSelectedTrendPoint();
    syncSelectedSubcategory();
    if (detailMode.value === "distribution") {
      closeCategoryPicker();
    }
  },
  { immediate: true },
);

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});

function syncRangeKeys() {
  selectedRangeKeys.value = {
    day: resolveRangeKey("day", analyticsByType.value.day, props.selectedDate, selectedRangeKeys.value.day),
    week: resolveRangeKey("week", analyticsByType.value.week, props.selectedDate, selectedRangeKeys.value.week),
    month: resolveRangeKey("month", analyticsByType.value.month, props.selectedDate, selectedRangeKeys.value.month),
  };
}

function requestCurrentRange() {
  if (!currentRangeKey.value) {
    return;
  }
  emit("load-range", {
    type: rangeType.value,
    key: currentRangeKey.value,
  });
}

function syncSelectedCategory() {
  const categories = Array.isArray(currentRange.value?.categories) ? currentRange.value.categories : [];
  if (!categories.some((category) => category.categoryId === selectedCategoryId.value)) {
    selectedCategoryId.value = "";
  }
}

function syncSelectedSubcategory() {
  const subcategories = Array.isArray(selectedDetail.value?.subcategories) ? selectedDetail.value.subcategories : [];
  if (!subcategories.some((subcategory) => subcategory.subcategoryId === selectedSubcategoryId.value)) {
    selectedSubcategoryId.value = "";
  }
}

function syncSelectedTrendPoint() {
  if (detailMode.value !== "trend") {
    selectedTrendKey.value = "";
    return;
  }
  const points = trendPoints.value;
  if (!points.length) {
    selectedTrendKey.value = "";
    return;
  }
  const activePoint = points.find((point) => point.key === selectedTrendKey.value) || null;
  if (activePoint && (Number(activePoint.minutes) || 0) > 0) {
    return;
  }
  selectedTrendKey.value = points.find((point) => (Number(point.minutes) || 0) > 0)?.key || points[0]?.key || "";
}

function openRangePicker() {
  rangePickerOpen.value = true;
  if (rangeType.value === "day") {
    dayPickerMonth.value = resolveDayPickerMonth();
  }
  if (rangeType.value === "week") {
    weekPickerMonth.value = resolveWeekPickerMonth();
  }
  if (rangeType.value === "month") {
    monthPickerYear.value = resolveMonthPickerYear();
  }
}

function closeRangePicker() {
  rangePickerOpen.value = false;
}

function closeCategoryPicker() {
  categoryPickerOpen.value = false;
}

function toggleCategoryPicker() {
  categoryPickerOpen.value = !categoryPickerOpen.value;
}

function handleRangePick(key) {
  if (!key) {
    return;
  }
  currentRangeKey.value = key;
  closeRangePicker();
}

function handleCategoryPick(categoryId) {
  if (!categoryId) {
    return;
  }
  toggleCategorySelection(categoryId);
  closeCategoryPicker();
}

function toggleCategorySelection(categoryId) {
  if (!categoryId) {
    return;
  }
  selectedCategoryId.value = selectedCategoryId.value === categoryId ? "" : categoryId;
}

function toggleSubcategorySelection(subcategoryId) {
  if (!subcategoryId) {
    return;
  }
  selectedSubcategoryId.value = selectedSubcategoryId.value === subcategoryId ? "" : subcategoryId;
}

function handleDetailSubcategoryPick(subcategoryId) {
  toggleSubcategorySelection(subcategoryId);
  closeCategoryPicker();
}

function handleDocumentPointerDown(event) {
  if (!categoryPickerOpen.value) {
    return;
  }
  const categoryRoot = categoryPickerRef.value;
  if (categoryRoot && categoryRoot.contains(event.target)) {
    return;
  }
  closeCategoryPicker();
}

function resolveDayPickerMonth() {
  const key = String(currentRangeKey.value || props.selectedDate || "").trim();
  return key ? key.slice(0, 7) : "";
}

function resolveWeekPickerMonth() {
  const key = String(currentRangeKey.value || props.selectedDate || "").trim();
  return key ? key.slice(0, 7) : "";
}

function resolveMonthPickerYear() {
  const key = String(currentRangeKey.value || "").trim();
  if (/^\d{4}-\d{2}$/u.test(key)) {
    return Number(key.slice(0, 4));
  }
  return new Date().getFullYear();
}

function switchDayCalendarMonth(delta) {
  dayPickerMonth.value = shiftMonthKey(
    activeDayCalendarMonth.value?.monthKey || resolveDayPickerMonth(),
    delta,
  );
}

function switchWeekCalendarMonth(delta) {
  weekPickerMonth.value = shiftMonthKey(
    activeWeekCalendarMonth.value?.monthKey || resolveWeekPickerMonth(),
    delta,
  );
}

function formatCategoryLabel(entry) {
  if (!entry) {
    return "";
  }
  return resolveCategoryLabel(entry.categoryId, entry.label);
}

function formatDetailLabel(entry) {
  if (!entry) {
    return "";
  }
  return resolveCategoryLabel(entry.categoryId, entry.label);
}

function formatSubcategoryLabel(entry) {
  if (!entry) {
    return "";
  }
  return resolveSubcategoryLabel(entry.subcategoryId, entry.label);
}

function formatEventSubcategoryLabel(event) {
  if (!event) {
    return "";
  }
  return resolveSubcategoryLabel(event.subcategoryId, event.subcategoryLabel);
}

function normalizeRanges(list) {
  return Array.isArray(list) ? list : [];
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

function resolveRangeKey(type, ranges, selectedDate, currentValue) {
  const list = Array.isArray(ranges) ? ranges : [];
  if (!list.length) {
    return "";
  }
  if (currentValue && list.some((entry) => entry.key === currentValue)) {
    return currentValue;
  }
  const normalizedDate = String(selectedDate || "").trim();
  if (type === "day" && normalizedDate) {
    const match = list.find((entry) => entry.key === normalizedDate);
    if (match) {
      return match.key;
    }
  }
  if (type === "week" && normalizedDate) {
    const match = list.find((entry) => isDateInWeek(normalizedDate, entry.key));
    if (match) {
      return match.key;
    }
  }
  if (type === "month" && normalizedDate) {
    const monthKey = normalizedDate.slice(0, 7);
    const match = list.find((entry) => entry.key === monthKey);
    if (match) {
      return match.key;
    }
  }
  return list[0]?.key || "";
}

function isDateInWeek(dateText, weekKey) {
  const target = Date.parse(`${dateText}T00:00:00+08:00`);
  const start = Date.parse(`${weekKey}T00:00:00+08:00`);
  if (!Number.isFinite(target) || !Number.isFinite(start)) {
    return false;
  }
  const end = start + 6 * 24 * 60 * 60 * 1000;
  return target >= start && target <= end;
}

function getMondayBasedWeekdayIndex(date) {
  const parsed = Date.parse(`${String(date || "").trim()}T12:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const weekday = new Date(parsed).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
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

function resolveCategoryColor(entry) {
  const id = String(entry?.categoryId || "").trim();
  const color = String(entry?.color || "").trim();
  if (color) {
    return color;
  }
  return CATEGORY_COLORS[id] || "#c6bca8";
}

function resolveSubcategoryColor(entry) {
  const baseColor = resolveColorValue(resolveCategoryColor({
    categoryId: entry?.categoryId,
    color: entry?.color,
  }));
  const variantKey = String(entry?.subcategoryId || entry?.label || "").trim();
  return createColorVariant(baseColor, variantKey);
}

function resolveCategoryLabel(categoryId, fallbackLabel) {
  const normalizedId = String(categoryId || "").trim().toLowerCase();
  const normalizedFallback = String(fallbackLabel || "").trim();
  return CATEGORY_LABELS[normalizedId]
    || CATEGORY_LABELS[normalizedFallback.toLowerCase()]
    || normalizedFallback
    || normalizedId;
}

function resolveSubcategoryLabel(subcategoryId, fallbackLabel) {
  const normalizedId = String(subcategoryId || "").trim();
  const normalizedFallback = String(fallbackLabel || "").trim();
  if (SUBCATEGORY_LABELS[normalizedId]) {
    return SUBCATEGORY_LABELS[normalizedId];
  }
  if (SUBCATEGORY_LABELS[normalizedFallback]) {
    return SUBCATEGORY_LABELS[normalizedFallback];
  }
  const candidate = normalizedId || normalizedFallback;
  if (!candidate) {
    return "";
  }
  const parts = candidate.split(".");
  const lastPart = parts[parts.length - 1];
  if (TOKEN_LABELS[lastPart]) {
    return TOKEN_LABELS[lastPart];
  }
  return normalizedFallback || normalizedId;
}

function buildDonutStyle(items, colorResolver) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return {
      background: "conic-gradient(#ece5d8 0deg 360deg)",
    };
  }
  let cursor = 0;
  const segments = list.map((item) => {
    const ratio = Number(item.percent) || 0;
    const start = cursor;
    const sweep = Math.max(0, ratio * 360);
    cursor += sweep;
    return `${colorResolver(item)} ${start}deg ${cursor}deg`;
  });
  if (cursor < 360) {
    segments.push(`#ece5d8 ${cursor}deg 360deg`);
  }
  return {
    background: `conic-gradient(${segments.join(", ")})`,
  };
}

function buildDonutSegments(items, colorResolver, activeId, idResolver = (item) => item.categoryId) {
  const list = Array.isArray(items) ? items.filter((item) => (Number(item?.percent) || 0) > 0) : [];
  if (!list.length) {
    return [];
  }

  const outerRadius = 105;
  const innerRadius = 80;
  let cursor = -90;
  const segments = list.map((item, index) => {
    const ratio = Number(item.percent) || 0;
    const isLast = index === list.length - 1;
    const sweep = isLast ? Math.max(0, 270 - cursor) : Math.max(0, ratio * 360);
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;

    const mid = start + sweep / 2;
    const id = idResolver(item);
    const selected = id === activeId;
    const offset = selected ? 3 : 0;
    const radians = (mid * Math.PI) / 180;
    const dx = Math.cos(radians) * offset;
    const dy = Math.sin(radians) * offset;

    return {
      id,
      color: colorResolver(item),
      path: describeDonutRingSegment(110, 110, outerRadius, innerRadius, start, end),
      selected,
      transform: `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`,
    };
  });

  return segments.sort((left, right) => Number(left.selected) - Number(right.selected));
}

function buildTrendPointsFromEvents(basePoints, events, currentRangeType) {
  const template = Array.isArray(basePoints) ? basePoints.map((point) => ({ ...point, minutes: 0 })) : [];
  if (!template.length) {
    return [];
  }

  if (currentRangeType === "day") {
    for (const event of events) {
      const timeRange = parseTimeRange(event?.timeLabel);
      if (!timeRange) {
        continue;
      }
      for (const point of template) {
        const pointHour = Number(point.key);
        if (!Number.isFinite(pointHour)) {
          continue;
        }
        const bucketStart = pointHour * 60;
        const bucketEnd = bucketStart + 60;
        point.minutes += calculateOverlapMinutes(timeRange.start, timeRange.end, bucketStart, bucketEnd);
      }
    }
    return template;
  }

  const minutesByDate = new Map();
  for (const event of events) {
    const dateKey = String(event?.dateLabel || "").trim();
    if (!dateKey) {
      continue;
    }
    minutesByDate.set(dateKey, (minutesByDate.get(dateKey) || 0) + (Number(event.minutes) || 0));
  }

  return template.map((point) => ({
    ...point,
    minutes: minutesByDate.get(String(point.label || point.key || "").trim()) || 0,
  }));
}

function buildTrendTemplateFromEvents(events, currentRangeType) {
  const list = Array.isArray(events) ? events : [];
  if (currentRangeType === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      minutes: 0,
    }));
  }

  const dates = [...new Set(list
    .map((event) => String(event?.dateLabel || "").trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

  return dates.map((date) => ({
    key: date,
    label: date,
    minutes: 0,
  }));
}

function describeDonutRingSegment(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.999) {
    return [
      `M ${cx} ${cy - outerRadius}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${cx - 0.01} ${cy - outerRadius}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${cx} ${cy - outerRadius}`,
      `L ${cx} ${cy - innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${cx - 0.01} ${cy - innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius}`,
      "Z",
    ].join(" ");
  }

  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = sweep > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function createColorVariant(baseColor, variantKey) {
  const normalizedBase = normalizeHexColor(baseColor);
  if (!normalizedBase) {
    return baseColor;
  }
  const variantIndex = Math.abs(hashText(variantKey || normalizedBase)) % 5;
  const mixTargets = [0.08, 0.18, 0.28, -0.08, -0.16];
  return mixHexColor(normalizedBase, mixTargets[variantIndex] || 0);
}

function normalizeHexColor(color) {
  const normalized = String(color || "").trim();
  if (!/^#([0-9a-f]{6})$/iu.test(normalized)) {
    return "";
  }
  return normalized.toLowerCase();
}

function resolveColorValue(color) {
  const normalized = String(color || "").trim();
  const cssVarMatch = normalized.match(/^var\((--[^)]+)\)$/u);
  if (!cssVarMatch) {
    return normalized;
  }
  return CATEGORY_COLOR_VALUES[cssVarMatch[1]] || normalized;
}

function hashText(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return hash;
}

function mixHexColor(hex, amount) {
  const value = normalizeHexColor(hex);
  if (!value) {
    return hex;
  }
  const [red, green, blue] = [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16));
  const next = [red, green, blue].map((channel) => {
    if (amount >= 0) {
      return Math.round(channel + (255 - channel) * amount);
    }
    return Math.round(channel * (1 + amount));
  });
  return `#${next.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function formatHours(minutes) {
  const total = Number(minutes) || 0;
  if (total < 60) {
    return `${total}m`;
  }
  const hours = total / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatPercent(value) {
  const percent = (Number(value) || 0) * 100;
  return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
}

function resolveTrendHeight(minutes) {
  const normalizedMinutes = Number(minutes) || 0;
  if (normalizedMinutes <= 0) {
    return 0;
  }
  const ratio = normalizedMinutes / trendMaxMinutes.value;
  return Math.max(10, Math.round(ratio * TREND_PLOT_HEIGHT));
}

function shouldShowTrendLabel(point, total) {
  const size = Number(total) || 0;
  if (size <= 8) {
    return true;
  }
  if (rangeType.value === "day") {
    const hour = Number(point?.key);
    return Number.isFinite(hour) ? hour % 3 === 0 : false;
  }
  if (rangeType.value === "month") {
    const day = Number(String(point?.label || "").slice(-2));
    return Number.isFinite(day) ? (day === 1 || day % 3 === 0) : false;
  }
  return true;
}

function formatTrendLabel(point) {
  const rawLabel = String(point?.label || "").trim();
  if (!rawLabel) {
    return "";
  }
  if (rangeType.value === "day") {
    return rawLabel.replace(/:00$/u, "");
  }
  if (rangeType.value === "week" || rangeType.value === "month") {
    const parts = rawLabel.split("-");
    return parts[parts.length - 1] || rawLabel;
  }
  return rawLabel;
}

function formatTrendPointTitle(point) {
  if (!point) {
    return "时间段";
  }
  if (rangeType.value === "day") {
    const label = formatTrendLabel(point);
    return `${label}:00-${label}:59`;
  }
  return point.label || point.key || "时间段";
}

function formatTrendTick(value) {
  const minutes = Number(value) || 0;
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function eventMatchesTrendPoint(event, point) {
  if (!event || !point) {
    return false;
  }
  if (rangeType.value === "day") {
    const pointHour = Number(point.key);
    const timeRange = parseTimeRange(event.timeLabel);
    if (!Number.isFinite(pointHour) || !timeRange) {
      return false;
    }
    const bucketStart = pointHour * 60;
    const bucketEnd = bucketStart + 60;
    return timeRange.start < bucketEnd && timeRange.end > bucketStart;
  }
  const eventDate = String(event.dateLabel || "").trim();
  const pointDate = String(point.label || "").trim();
  return Boolean(eventDate) && eventDate === pointDate;
}

function parseTimeRange(value) {
  const match = String(value || "").match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/u);
  if (!match) {
    return null;
  }
  const start = Number(match[1]) * 60 + Number(match[2]);
  let end = Number(match[3]) * 60 + Number(match[4]);
  if (end <= start) {
    end += 24 * 60;
  }
  return { start, end };
}

function calculateOverlapMinutes(startA, endA, startB, endB) {
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  return Math.max(0, overlapEnd - overlapStart);
}
</script>

<style scoped>
.distribution-shell {
  display: grid;
  gap: 14px;
}

.distribution-toolbar {
  display: grid;
  gap: 10px;
}

.distribution-toolbar__top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.distribution-switch {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
  min-height: 34px;
  padding: 1px 2px;
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.86);
  box-shadow: inset 0 0 0 1px rgba(24, 35, 15, 0.04);
}

.distribution-switch__button,
.detail-switch__button {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 12px;
  background: rgba(255, 253, 249, 0.9);
  color: var(--ink);
  min-height: 34px;
  padding: 0 10px;
  font: inherit;
}

.distribution-switch__button {
  border: none;
  background: transparent;
  min-width: 0;
  min-height: 28px;
  padding: 0 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.distribution-switch__divider {
  color: rgba(24, 35, 15, 0.24);
  font-size: 11px;
  line-height: 1;
  pointer-events: none;
}

.distribution-switch__button--active {
  border-radius: 999px;
  background: rgba(238, 244, 229, 0.98);
  color: var(--accent);
}

.distribution-switch__button--active,
.detail-switch__button:active {
  background: #eef4e5;
  border-color: rgba(49, 81, 30, 0.18);
}

.distribution-select {
  display: grid;
  gap: 6px;
}

.distribution-select-trigger {
  appearance: none;
  width: 100%;
  min-height: 34px;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 12px;
  background: rgba(255, 253, 249, 0.96);
  color: var(--ink);
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font: inherit;
}

.distribution-select-trigger__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.distribution-select-trigger__icon {
  color: var(--muted);
  flex: 0 0 auto;
}

.distribution-select--inline {
  display: block;
}

.distribution-select span {
  color: var(--muted);
  font-size: 12px;
}

.distribution-select__input {
  width: 100%;
  min-height: 34px;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 12px;
  background: rgba(255, 253, 249, 0.96);
  color: var(--ink);
  padding: 0 10px;
  font: inherit;
}

.donut-card {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.donut-card__head {
  display: grid;
  gap: 10px;
}

.donut-card__head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.donut-card__total {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.detail-picker-anchor {
  position: relative;
  flex: 0 1 auto;
  min-width: 0;
}

.detail-switch {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
  min-height: 34px;
  padding: 1px 2px;
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.86);
  box-shadow: inset 0 0 0 1px rgba(24, 35, 15, 0.04);
  margin-left: auto;
}

.detail-switch__button {
  border: none;
  background: transparent;
  min-width: 0;
  min-height: 28px;
  padding: 0 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.detail-switch__button--active {
  border-radius: 999px;
  background: rgba(238, 244, 229, 0.98);
  color: var(--accent);
}

.detail-switch__divider {
  color: rgba(24, 35, 15, 0.24);
  font-size: 11px;
  line-height: 1;
  pointer-events: none;
}

.donut-wrap {
  display: flex;
  justify-content: center;
}

.donut {
  width: 220px;
  aspect-ratio: 1 / 1;
  border-radius: 999px;
  position: relative;
  overflow: visible;
  box-shadow: none;
}

.donut::after {
  content: "";
  position: absolute;
  inset: var(--donut-inner-inset, 30px);
  border-radius: 999px;
  background: #fffdf9;
  pointer-events: none;
  transition: inset 180ms ease;
}

.donut__center {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-content: center;
  gap: 4px;
  text-align: center;
  padding: 24px;
}

.donut__center strong {
  font-size: 16px;
  line-height: 1.3;
}

.donut__center span {
  color: var(--muted);
  font-size: 13px;
}

.donut--interactive {
  background: transparent;
  box-shadow: none;
}

.donut--interactive .donut__center {
  pointer-events: none;
}

.donut--static {
  background: transparent;
  cursor: pointer;
}

.donut--static::before {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: var(--donut-static-background, transparent);
}

.donut-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.donut-segment-wrap {
  transition: transform 180ms ease;
}

.donut-segment {
  cursor: pointer;
  transition: opacity 180ms ease;
}

.donut-segment-wrap:not(.donut-segment-wrap--active) .donut-segment {
  opacity: 0.96;
}

.category-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.category-row {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.06);
  border-radius: 14px;
  background: #faf8f3;
  padding: 11px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.category-row__left {
  min-width: 0;
}

.category-row__left span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-row--active {
  border-color: rgba(49, 81, 30, 0.24);
  background: #fffdf9;
  box-shadow: 0 8px 18px rgba(24, 35, 15, 0.05);
}

.category-row__left,
.category-row__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-row__left {
  font-size: 12px;
}

.category-row__right {
  flex-direction: row;
  align-items: flex-end;
  gap: 6px;
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 12px;
  line-height: 1;
}

.category-row__right strong,
.category-row__right small {
  font-size: 12px;
  font-weight: 600;
}

.category-row__right small {
  color: inherit;
}

.category-dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.range-picker-overlay {
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

.range-picker-sheet {
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

.range-picker-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.range-picker-sheet__kicker {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.range-picker-sheet__header h3 {
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

.range-picker-sheet__body {
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

.range-calendar__day {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 14px;
  min-height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  text-align: center;
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
}

.range-calendar__day--placeholder {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.range-calendar__day--muted {
  opacity: 0.35;
}

.range-calendar__day--active {
  background: #eef4e5;
  border-color: rgba(49, 81, 30, 0.2);
  color: var(--accent);
}

.range-calendar__day--today:not(.range-calendar__day--active) {
  border-color: rgba(49, 81, 30, 0.16);
  background: rgba(238, 244, 229, 0.42);
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

.month-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.month-grid__item {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 14px;
  min-height: 48px;
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.month-grid__item--active {
  background: #eef4e5;
  border-color: rgba(49, 81, 30, 0.2);
  color: var(--accent);
}

.month-grid__item--muted {
  opacity: 0.35;
}

.detail-select-trigger {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.84);
  color: var(--ink);
  min-height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
  max-width: min(42vw, 168px);
}

.detail-select-trigger--active {
  color: var(--accent);
  border-color: rgba(49, 81, 30, 0.22);
  background: rgba(238, 244, 229, 0.9);
}

.detail-select-trigger__value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.detail-select-trigger__value span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-select-trigger__icon {
  color: var(--muted);
  flex: 0 0 auto;
}

.detail-picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.detail-picker-grid--stack {
  grid-template-columns: minmax(0, 1fr);
  max-height: 252px;
  overflow-y: auto;
  padding-right: 2px;
  align-content: start;
}

.detail-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: min(260px, calc(100vw - 56px));
  padding: 10px;
  z-index: 6;
  background: rgba(251, 247, 239, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 16px 36px rgba(24, 35, 15, 0.12);
}

.detail-popover--split {
  width: fit-content;
  max-width: calc(100vw - 40px);
}

.detail-picker-split {
  display: grid;
  grid-template-columns: repeat(2, 108px);
  gap: 10px;
  align-items: start;
}

.detail-picker-section--stack {
  min-width: 0;
}

.detail-picker-section--fill {
  min-width: 0;
}

.detail-picker-item {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 14px;
  background: rgba(255, 253, 249, 0.86);
  min-height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  text-align: left;
  font: inherit;
  color: var(--ink);
}

.detail-picker-item--active {
  border-color: rgba(49, 81, 30, 0.22);
  background: #eef4e5;
  color: var(--accent);
}

.breakdown-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-content: start;
  grid-auto-rows: max-content;
}

.event-detail-list {
  display: grid;
  gap: 10px;
  align-content: start;
  grid-auto-rows: max-content;
}

.breakdown-row,
.event-detail-card {
  padding: 12px;
}

.breakdown-row {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.06);
  background: #faf8f3;
  text-align: left;
}

.breakdown-row--active {
  border-color: rgba(49, 81, 30, 0.24);
  background: #fffdf9;
  box-shadow: 0 8px 18px rgba(24, 35, 15, 0.05);
}

.breakdown-row__meta,
.event-detail-card__meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.breakdown-row__meta .category-row__left {
  font-size: 12px;
}

.breakdown-row__stats {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 12px;
  line-height: 1;
}

.breakdown-row__stats strong,
.breakdown-row__stats small {
  font-size: 12px;
  font-weight: 600;
}

.trend-chart {
  padding: 16px 10px 12px;
  position: sticky;
  top: 0;
  z-index: 3;
  background: linear-gradient(180deg, rgba(251, 247, 239, 0.98) 0%, rgba(244, 239, 230, 0.96) 100%);
  box-shadow: 0 8px 18px rgba(24, 35, 15, 0.06);
}

.trend-chart__plot {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 4px;
}

.trend-y-axis {
  position: relative;
  height: 200px;
}

.trend-y-axis__label {
  position: absolute;
  right: -1px;
  transform: translateY(50%);
  color: var(--muted);
  font-size: 9px;
  line-height: 1;
}

.trend-plot-area {
  position: relative;
  height: 200px;
  border-left: 1px solid rgba(24, 35, 15, 0.12);
  border-bottom: 1px solid rgba(24, 35, 15, 0.12);
  overflow: visible;
}

.trend-grid-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid rgba(24, 35, 15, 0.07);
}

.trend-chart__bars {
  position: relative;
  z-index: 1;
  height: 200px;
  display: grid;
  align-items: flex-end;
  justify-items: stretch;
  gap: 4px;
  padding: 0 2px 0 4px;
  overflow: visible;
}

.trend-bar-wrap {
  appearance: none;
  border: 0;
  background: transparent;
  position: relative;
  display: flex;
  align-items: flex-end;
  min-width: 0;
  width: 100%;
  justify-self: stretch;
  padding: 0;
  cursor: pointer;
  box-sizing: border-box;
}

.trend-bar {
  width: 100%;
  min-width: 0;
  border-radius: 999px 999px 4px 4px;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
  box-sizing: border-box;
  align-self: flex-end;
}

.trend-bar--empty {
  opacity: 0;
  box-shadow: none;
}

.trend-bar-wrap--active .trend-bar {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(24, 35, 15, 0.14);
}

.trend-bar-wrap:not(.trend-bar-wrap--active) .trend-bar {
  opacity: 0.82;
}

.trend-bar__label {
  position: absolute;
  left: 50%;
  bottom: -16px;
  transform: translateX(-50%);
  width: max-content;
  max-width: 100%;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}

.trend-bar-wrap:not(.trend-bar-wrap--with-label) .trend-bar__label {
  visibility: hidden;
}

.trend-events {
  display: grid;
  gap: 10px;
  padding: 0;
  align-content: start;
}

.event-detail-card__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}

.event-detail-card__top-left {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.event-detail-card__time {
  color: var(--accent);
  font-size: 13px;
  line-height: 1.4;
}

.event-detail-card__category {
  flex: 0 0 auto;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.2;
}

.event-detail-card__title {
  margin-top: 8px;
  font-size: 15px;
  line-height: 1.45;
  font-weight: 600;
}

.event-detail-card__duration {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.event-detail-card__duration--top {
  margin-top: 0;
  flex: 0 0 auto;
}

.event-detail-card__note {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
