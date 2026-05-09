const fs = require("fs");

const TIMEZONE = "Asia/Shanghai";
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAY_LIMIT = 56;
const RECENT_WEEK_LIMIT = 8;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getTimelineOverview(config) {
  const context = readTimelineContext(config);
  return {
    ...buildTimelineBase(context),
    recentDays: summarizeTimelineDays(context.days),
    recentWeeks: summarizeTimelineWeeks(context.days),
    analytics: summarizeTimelineRanges(context.days, context.lookups),
  };
}

function getTimelineIndex(config) {
  const context = readTimelineContext(config);
  return {
    ...buildTimelineBase(context),
    recentDays: summarizeTimelineDayIndex(context.days),
    recentWeeks: summarizeTimelineWeekIndex(context.days),
    rangeIndex: summarizeTimelineRangeIndex(context.days, context.lookups),
  };
}

function getTimelineDay(config, date) {
  const context = readTimelineContext(config);
  const normalizedDate = normalizeDateKey(date);
  const day = context.days.find((entry) => entry.date === normalizedDate);
  return day ? summarizeTimelineDay(day) : null;
}

function getTimelineWeek(config, weekKey) {
  const context = readTimelineContext(config);
  const normalizedWeekKey = normalizeDateKey(weekKey);
  return buildTimelineWeeks(context.days, { includeItems: true })
    .find((week) => week.key === normalizedWeekKey) || null;
}

function getTimelineRange(config, type, key) {
  const context = readTimelineContext(config);
  const normalizedType = normalizeText(type).toLowerCase();
  const normalizedKey = normalizeText(key);
  const ranges = {
    day: () => buildDayRanges(context.days, context.lookups),
    week: () => buildWeekRanges(context.days, context.lookups),
    month: () => buildMonthRanges(context.days, context.lookups),
  }[normalizedType]?.() || [];
  return ranges.find((range) => range.key === normalizedKey) || null;
}

function readTimelineContext(config) {
  const timelineState = readJson(config.timelineStateFile, {});
  const taxonomySource = readJson(config.timelineTaxonomyFile, {});
  const factsSource = readJson(config.timelineFactsFile, {});
  const taxonomy = normalizeTaxonomy(taxonomySource, timelineState);
  const lookups = buildTaxonomyLookups(taxonomy);
  const days = normalizeFactsDays(factsSource, lookups);
  const availableDates = days.map((day) => day.date).sort();

  return {
    timelineState,
    taxonomySource,
    factsSource,
    taxonomy,
    lookups,
    days,
    availableDates,
  };
}

function buildTimelineBase(context) {
  return {
    siteAvailable: false,
    siteUrl: "",
    meta: {
      timezone: context.factsSource?.timezone || context.taxonomySource?.timezone || context.timelineState?.timezone || TIMEZONE,
      latestDate: context.availableDates[context.availableDates.length - 1] || "",
      availableDates: context.availableDates,
      source: "timeline-facts",
      generatedAt: new Date().toISOString(),
    },
    taxonomySummary: summarizeTaxonomy(context.taxonomy),
    factsSummary: summarizeFacts(context.days),
    stateSummary: summarizeTimelineState(context.timelineState),
  };
}

function normalizeTaxonomy(taxonomySource, timelineState) {
  const source = [
    taxonomySource?.taxonomy,
    taxonomySource,
    timelineState?.taxonomy,
  ].find((candidate) => Array.isArray(candidate?.categories)) || {};
  const categories = Array.isArray(source?.categories) ? source.categories : [];
  return categories
    .map((category) => {
      const id = normalizeText(category?.id || category?.categoryId || category?.name).toLowerCase();
      if (!id) {
        return null;
      }
      return {
        id,
        label: normalizeText(category?.label || category?.name || id),
        color: normalizeText(category?.color) || `var(--cat-${sanitizeClassToken(id)})`,
        children: normalizeChildren(category?.children, id),
      };
    })
    .filter(Boolean);
}

function normalizeChildren(children, categoryId) {
  return (Array.isArray(children) ? children : [])
    .map((child) => {
      const id = normalizeText(child?.id || child?.subcategoryId || child?.name).toLowerCase();
      if (!id) {
        return null;
      }
      return {
        id,
        categoryId,
        label: normalizeText(child?.label || child?.name || id),
        color: normalizeText(child?.color),
      };
    })
    .filter(Boolean);
}

function buildTaxonomyLookups(categories) {
  const categoryById = new Map();
  const subcategoryById = new Map();
  for (const category of categories) {
    categoryById.set(category.id, category);
    for (const child of category.children) {
      subcategoryById.set(child.id, {
        ...child,
        categoryId: child.categoryId || category.id,
        color: child.color || category.color,
      });
    }
  }
  return { categories, categoryById, subcategoryById };
}

function normalizeFactsDays(factsSource, lookups) {
  const rawFacts = factsSource?.facts;
  if (rawFacts && typeof rawFacts === "object" && !Array.isArray(rawFacts)) {
    return Object.entries(rawFacts)
      .map(([date, entry]) => normalizeFactDay(date, entry, lookups))
      .filter(Boolean)
      .sort(compareDaysAsc);
  }

  if (Array.isArray(rawFacts)) {
    const dayEntries = rawFacts.filter((entry) => Array.isArray(entry?.events));
    if (dayEntries.length) {
      return dayEntries
        .map((entry) => normalizeFactDay(entry?.date || entry?.day || entry?.key, entry, lookups))
        .filter(Boolean)
        .sort(compareDaysAsc);
    }
    return groupEventsByDate(rawFacts, lookups);
  }

  if (Array.isArray(factsSource?.events)) {
    return groupEventsByDate(factsSource.events, lookups);
  }

  return [];
}

function groupEventsByDate(events, lookups) {
  const grouped = new Map();
  for (const event of events) {
    const date = normalizeDateKey(event?.date || event?.day || formatDateKeyFromValue(event?.startAt || event?.start));
    if (!date) {
      continue;
    }
    if (!grouped.has(date)) {
      grouped.set(date, {
        date,
        status: "",
        updatedAt: "",
        source: null,
        events: [],
      });
    }
    const normalized = normalizeEvent(event, date, grouped.get(date).events.length, lookups);
    if (normalized) {
      grouped.get(date).events.push(normalized);
    }
  }

  return Array.from(grouped.values())
    .map((day) => ({
      ...day,
      events: day.events.sort(compareEventsAsc),
    }))
    .sort(compareDaysAsc);
}

function normalizeFactDay(date, entry, lookups) {
  const normalizedDate = normalizeDateKey(date || entry?.date || entry?.day || entry?.key);
  if (!normalizedDate) {
    return null;
  }
  const events = (Array.isArray(entry?.events) ? entry.events : [])
    .map((event, index) => normalizeEvent(event, normalizedDate, index, lookups))
    .filter(Boolean)
    .sort(compareEventsAsc);

  return {
    date: normalizedDate,
    status: normalizeText(entry?.status),
    updatedAt: normalizeDateTime(entry?.updatedAt),
    source: entry?.source ?? null,
    events,
  };
}

function normalizeEvent(event, date, index, lookups) {
  if (!event || typeof event !== "object") {
    return null;
  }
  const startAt = normalizeDateTime(event.startAt || event.start || event.startedAt);
  const endAt = normalizeDateTime(event.endAt || event.end || event.endedAt);
  const subcategoryId = normalizeText(event.subcategoryId || event.subcategory || "").toLowerCase();
  const inferredCategoryId = subcategoryId.includes(".") ? subcategoryId.split(".")[0] : "";
  const categoryId = normalizeText(event.categoryId || event.category || inferredCategoryId || "state").toLowerCase();
  const category = resolveCategory(lookups, categoryId);
  const subcategory = resolveSubcategory(lookups, subcategoryId, category.id);
  const title = normalizeText(event.title || event.content || event.label || event.name) || "事件";
  const eventId = normalizeText(event.id || event.eventNodeId || `${date}-${index}`);

  return {
    id: eventId,
    eventNodeId: normalizeText(event.eventNodeId || eventId),
    date,
    startAt,
    endAt,
    title,
    note: normalizeText(event.note || event.description || ""),
    categoryId: category.id,
    categoryLabel: category.label,
    categoryColor: category.color,
    subcategoryId: subcategory.id,
    subcategoryLabel: subcategory.label,
    status: normalizeText(event.status),
    tags: Array.isArray(event.tags) ? event.tags.map(normalizeText).filter(Boolean) : [],
    minutes: calculateDurationMinutes(startAt, endAt),
  };
}

function resolveCategory(lookups, categoryId) {
  const normalized = normalizeText(categoryId).toLowerCase() || "state";
  const category = lookups.categoryById.get(normalized);
  if (category) {
    return category;
  }
  if (normalized.includes(".")) {
    const fallbackId = normalized.split(".")[0];
    const fallbackCategory = lookups.categoryById.get(fallbackId);
    if (fallbackCategory) {
      return fallbackCategory;
    }
    return {
      id: fallbackId,
      label: fallbackId,
      color: `var(--cat-${sanitizeClassToken(fallbackId)})`,
      children: [],
    };
  }
  return {
    id: normalized,
    label: normalized,
    color: `var(--cat-${sanitizeClassToken(normalized)})`,
    children: [],
  };
}

function resolveSubcategory(lookups, subcategoryId, categoryId) {
  const normalized = normalizeText(subcategoryId).toLowerCase();
  if (normalized && lookups.subcategoryById.has(normalized)) {
    return lookups.subcategoryById.get(normalized);
  }
  const fallbackId = normalized || `${categoryId}.other`;
  return {
    id: fallbackId,
    categoryId,
    label: fallbackId,
    color: "",
  };
}

function summarizeTaxonomy(categories) {
  return {
    categoryCount: categories.length,
    categories: categories.map((category) => ({
      id: category.id,
      label: category.label,
      childCount: category.children.length,
    })),
  };
}

function summarizeFacts(days) {
  const events = days.flatMap((day) => day.events.map((event) => ({ ...event, date: day.date })));
  return {
    factCount: events.length,
    dayCount: days.length,
    recentFacts: events
      .slice()
      .sort((left, right) => compareTextDesc(left.startAt, right.startAt))
      .slice(0, 8)
      .map((event) => ({
        id: event.id,
        date: event.date,
        title: event.title,
        note: event.note,
        categoryId: event.categoryId,
        subcategoryId: event.subcategoryId,
        startAt: event.startAt,
        endAt: event.endAt,
      })),
  };
}

function summarizeTimelineState(state) {
  const events = Array.isArray(state?.events) ? state.events : [];
  const dates = new Set(events.map((event) => String(event?.date || "").trim()).filter(Boolean));
  return {
    eventCount: events.length,
    dayCount: dates.size,
    recentEvents: events.slice(-10).reverse(),
  };
}

function summarizeTimelineDays(days) {
  return days
    .slice()
    .sort(compareDaysDesc)
    .slice(0, RECENT_DAY_LIMIT)
    .map((day) => summarizeTimelineDay(day));
}

function summarizeTimelineDayIndex(days) {
  return days
    .slice()
    .sort(compareDaysDesc)
    .slice(0, RECENT_DAY_LIMIT)
    .map((day) => ({
      date: day.date,
      itemCount: day.events.length,
      status: day.status,
      updatedAt: day.updatedAt,
      categoryIds: [...new Set(day.events.map((event) => event.categoryId).filter(Boolean))],
      totalMinutes: roundMinutes(day.events.reduce((sum, event) => sum + (Number(event.minutes) || 0), 0)),
      items: [],
    }));
}

function summarizeTimelineDay(day) {
  return {
    date: day.date,
    itemCount: day.events.length,
    status: day.status,
    updatedAt: day.updatedAt,
    items: day.events.map((event, index) => toTimelineItem(event, day.date, index)),
  };
}

function summarizeTimelineWeeks(days) {
  return buildTimelineWeeks(days, { includeItems: true }).slice(0, RECENT_WEEK_LIMIT);
}

function summarizeTimelineWeekIndex(days) {
  return buildTimelineWeeks(days, { includeItems: false }).slice(0, RECENT_WEEK_LIMIT);
}

function buildTimelineWeeks(days, { includeItems }) {
  const weeks = new Map();
  for (const day of days) {
    const weekKey = getWeekStartDateKey(day.date);
    if (!weekKey) {
      continue;
    }
    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, {
        key: weekKey,
        label: formatRangeDateLabel(weekKey, addDaysToDateKey(weekKey, 6)),
        days: Array.from({ length: 7 }, (_, index) => {
          const date = addDaysToDateKey(weekKey, index);
          return {
            id: date,
            label: date,
          };
        }),
        items: [],
        itemCount: 0,
      });
    }
    const week = weeks.get(weekKey);
    week.itemCount += day.events.length;
    if (includeItems) {
      week.items.push(...day.events.map((event, index) => ({
        ...toTimelineItem(event, day.date, index),
        group: day.date,
        dateText: day.date,
      })));
    }
  }

  return Array.from(weeks.values())
    .map((week) => ({
      ...week,
      itemCount: includeItems ? week.items.length : week.itemCount,
      items: week.items.sort(compareTimelineItemsAsc),
    }))
    .sort((left, right) => compareTextDesc(left.key, right.key));
}

function summarizeTimelineRangeIndex(days, lookups) {
  return {
    day: buildDayRangeIndex(days, lookups),
    week: buildWeekRangeIndex(days, lookups),
    month: buildMonthRangeIndex(days, lookups),
  };
}

function buildDayRangeIndex(days, lookups) {
  return days
    .slice()
    .sort(compareDaysDesc)
    .map((day) => buildRangeIndexEntry({
      key: day.date,
      label: day.date,
      unit: "day",
      events: day.events.map((event) => ({ ...event, date: day.date, dayStatus: day.status })),
    }, lookups));
}

function buildWeekRangeIndex(days, lookups) {
  const grouped = new Map();
  for (const day of days) {
    const weekKey = getWeekStartDateKey(day.date);
    if (!weekKey) {
      continue;
    }
    if (!grouped.has(weekKey)) {
      grouped.set(weekKey, {
        key: weekKey,
        label: formatRangeDateLabel(weekKey, addDaysToDateKey(weekKey, 6)),
        unit: "week",
        events: [],
      });
    }
    grouped.get(weekKey).events.push(
      ...day.events.map((event) => ({ ...event, date: day.date, dayStatus: day.status })),
    );
  }

  return Array.from(grouped.values())
    .sort((left, right) => compareTextDesc(left.key, right.key))
    .map((range) => buildRangeIndexEntry(range, lookups));
}

function buildMonthRangeIndex(days, lookups) {
  const grouped = new Map();
  for (const day of days) {
    const monthKey = day.date.slice(0, 7);
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, {
        key: monthKey,
        label: formatMonthLabel(monthKey),
        unit: "month",
        events: [],
      });
    }
    grouped.get(monthKey).events.push(
      ...day.events.map((event) => ({ ...event, date: day.date, dayStatus: day.status })),
    );
  }

  return Array.from(grouped.values())
    .sort((left, right) => compareTextDesc(left.key, right.key))
    .map((range) => buildRangeIndexEntry(range, lookups));
}

function buildRangeIndexEntry(range, lookups) {
  const buckets = new Map();
  for (const event of range.events) {
    const minutes = Number(event.minutes) || 0;
    if (minutes <= 0) {
      continue;
    }
    const category = resolveCategory(lookups, event.categoryId);
    if (!buckets.has(category.id)) {
      buckets.set(category.id, {
        categoryId: category.id,
        label: category.label,
        color: category.color,
        minutes: 0,
      });
    }
    buckets.get(category.id).minutes += minutes;
  }
  const totalMinutes = roundMinutes(Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.minutes, 0));
  return {
    key: range.key,
    label: range.label,
    unit: range.unit,
    totalMinutes,
    categories: Array.from(buckets.values())
      .sort(compareBucketsDesc)
      .map((bucket) => ({
        categoryId: bucket.categoryId,
        label: bucket.label,
        color: bucket.color,
        minutes: roundMinutes(bucket.minutes),
        percent: totalMinutes > 0 ? bucket.minutes / totalMinutes : 0,
      })),
  };
}

function summarizeTimelineRanges(days, lookups) {
  return {
    day: buildDayRanges(days, lookups),
    week: buildWeekRanges(days, lookups),
    month: buildMonthRanges(days, lookups),
  };
}

function buildDayRanges(days, lookups) {
  return days
    .slice()
    .sort(compareDaysDesc)
    .map((day) => buildRangeEntry({
      key: day.date,
      label: day.date,
      unit: "day",
      type: "day",
      dates: [day.date],
      events: day.events.map((event) => ({ ...event, date: day.date, dayStatus: day.status })),
    }, lookups));
}

function buildWeekRanges(days, lookups) {
  const grouped = new Map();
  for (const day of days) {
    const weekKey = getWeekStartDateKey(day.date);
    if (!weekKey) {
      continue;
    }
    if (!grouped.has(weekKey)) {
      const dates = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(weekKey, index));
      grouped.set(weekKey, {
        key: weekKey,
        label: formatRangeDateLabel(weekKey, dates[dates.length - 1]),
        unit: "week",
        type: "week",
        dates,
        events: [],
      });
    }
    grouped.get(weekKey).events.push(
      ...day.events.map((event) => ({ ...event, date: day.date, dayStatus: day.status })),
    );
  }

  return Array.from(grouped.values())
    .sort((left, right) => compareTextDesc(left.key, right.key))
    .map((range) => buildRangeEntry(range, lookups));
}

function buildMonthRanges(days, lookups) {
  const grouped = new Map();
  for (const day of days) {
    const monthKey = day.date.slice(0, 7);
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, {
        key: monthKey,
        label: formatMonthLabel(monthKey),
        unit: "month",
        type: "month",
        dates: getMonthDateKeys(monthKey),
        events: [],
      });
    }
    grouped.get(monthKey).events.push(
      ...day.events.map((event) => ({ ...event, date: day.date, dayStatus: day.status })),
    );
  }

  return Array.from(grouped.values())
    .sort((left, right) => compareTextDesc(left.key, right.key))
    .map((range) => buildRangeEntry(range, lookups));
}

function buildRangeEntry(range, lookups) {
  const buckets = new Map();

  for (const event of range.events) {
    const minutes = Number(event.minutes) || 0;
    if (minutes <= 0) {
      continue;
    }
    const category = resolveCategory(lookups, event.categoryId);
    const subcategory = resolveSubcategory(lookups, event.subcategoryId, category.id);
    const bucket = ensureCategoryBucket(buckets, category);
    const subcategoryBucket = ensureSubcategoryBucket(bucket.subcategories, subcategory, category);
    const detailEvent = toDetailEvent(event, category, subcategory, minutes);

    bucket.minutes += minutes;
    bucket.events.push(detailEvent);
    subcategoryBucket.minutes += minutes;
  }

  const totalMinutes = roundMinutes(Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.minutes, 0));
  const categories = Array.from(buckets.values())
    .sort(compareBucketsDesc)
    .map((bucket) => ({
      categoryId: bucket.categoryId,
      label: bucket.label,
      color: bucket.color,
      minutes: roundMinutes(bucket.minutes),
      percent: totalMinutes > 0 ? bucket.minutes / totalMinutes : 0,
    }));

  const categoryDetails = Object.fromEntries(
    Array.from(buckets.values()).map((bucket) => [
      bucket.categoryId,
      {
        categoryId: bucket.categoryId,
        label: bucket.label,
        color: bucket.color,
        trend: buildTrendPoints(range, bucket.events),
        subcategories: Array.from(bucket.subcategories.values())
          .sort(compareBucketsDesc)
          .map((subcategory) => ({
            subcategoryId: subcategory.subcategoryId,
            categoryId: bucket.categoryId,
            label: subcategory.label,
            color: subcategory.color || bucket.color,
            minutes: roundMinutes(subcategory.minutes),
            percent: bucket.minutes > 0 ? subcategory.minutes / bucket.minutes : 0,
          })),
        events: bucket.events.slice().sort(compareDetailEventsAsc),
      },
    ]),
  );

  return {
    key: range.key,
    label: range.label,
    unit: range.unit,
    totalMinutes,
    categories,
    categoryDetails,
  };
}

function ensureCategoryBucket(buckets, category) {
  if (!buckets.has(category.id)) {
    buckets.set(category.id, {
      categoryId: category.id,
      label: category.label,
      color: category.color,
      minutes: 0,
      subcategories: new Map(),
      events: [],
    });
  }
  return buckets.get(category.id);
}

function ensureSubcategoryBucket(buckets, subcategory, category) {
  if (!buckets.has(subcategory.id)) {
    buckets.set(subcategory.id, {
      subcategoryId: subcategory.id,
      categoryId: category.id,
      label: subcategory.label,
      color: subcategory.color || category.color,
      minutes: 0,
    });
  }
  return buckets.get(subcategory.id);
}

function buildTrendPoints(range, events) {
  if (range.type === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      minutes: roundMinutes(events.reduce((sum, event) => sum + calculateHourOverlap(event, hour), 0)),
    }));
  }

  return range.dates.map((date) => ({
    key: date,
    label: date,
    minutes: roundMinutes(events
      .filter((event) => event.dateLabel === date)
      .reduce((sum, event) => sum + (Number(event.minutes) || 0), 0)),
  }));
}

function calculateHourOverlap(event, hour) {
  const range = getEventMinuteRange(event);
  if (!range) {
    return 0;
  }
  const bucketStart = hour * 60;
  const bucketEnd = bucketStart + 60;
  const overlapStart = Math.max(range.start, bucketStart);
  const overlapEnd = Math.min(range.end, bucketEnd);
  return Math.max(0, overlapEnd - overlapStart);
}

function getEventMinuteRange(event) {
  const start = minuteOfDay(event.startAt);
  const endRaw = minuteOfDay(event.endAt);
  if (start == null || endRaw == null) {
    return null;
  }
  const end = endRaw <= start ? endRaw + 24 * 60 : endRaw;
  return { start, end };
}

function toTimelineItem(event, date, index) {
  const normalizedCategoryId = normalizeCategoryColorKey(event.categoryId) || "state";
  return {
    id: `${date}:${event.id || event.eventNodeId || index}`,
    content: event.title,
    className: `cat-${sanitizeClassToken(normalizedCategoryId)}`,
    start: event.startAt,
    end: event.endAt,
    title: event.title,
    note: event.note,
    durationText: formatDuration(event.minutes),
    timeText: formatTimeRange(event.startAt, event.endAt),
    categoryId: event.categoryId,
    subcategoryId: event.subcategoryId,
  };
}

function toDetailEvent(event, category, subcategory, minutes) {
  const timeLabel = formatTimeRange(event.startAt, event.endAt);
  return {
    eventNodeId: event.eventNodeId || event.id,
    label: event.title,
    dateLabel: event.date,
    timeLabel,
    compactDuration: formatDuration(minutes),
    fullLabel: [event.date, timeLabel, event.title].filter(Boolean).join(" · "),
    note: event.note,
    status: event.status || event.dayStatus || "",
    categoryId: category.id,
    subcategoryId: subcategory.id,
    subcategoryLabel: subcategory.label,
    minutes: roundMinutes(minutes),
    startAt: event.startAt,
    endAt: event.endAt,
  };
}

function calculateDurationMinutes(startAt, endAt) {
  const start = Date.parse(startAt || "");
  const end = Date.parse(endAt || "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return roundMinutes((end - start) / 60000);
}

function minuteOfDay(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const parts = getParts(timeFormatter, new Date(parsed));
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  return hour * 60 + minute;
}

function normalizeDateTime(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function normalizeDateKey(value) {
  const normalized = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    return normalized;
  }
  return formatDateKeyFromValue(normalized);
}

function formatDateKeyFromValue(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return formatDateKey(new Date(parsed));
}

function formatDateKey(date) {
  const parts = getParts(dateFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatTime(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const parts = getParts(timeFormatter, new Date(parsed));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${hour}:${parts.minute}`;
}

function formatTimeRange(startAt, endAt) {
  const start = formatTime(startAt);
  const end = formatTime(endAt);
  if (!start && !end) {
    return "";
  }
  return `${start || "?"} - ${end || "?"}`;
}

function formatDuration(minutes) {
  const total = roundMinutes(minutes);
  if (total <= 0) {
    return "0m";
  }
  if (total < 60) {
    return `${total}m`;
  }
  const hours = total / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatRangeDateLabel(start, end) {
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function formatShortDate(value) {
  const normalized = normalizeDateKey(value);
  return normalized ? normalized.slice(5) : "";
}

function formatMonthLabel(monthKey) {
  const normalized = normalizeText(monthKey);
  if (!/^\d{4}-\d{2}$/u.test(normalized)) {
    return normalized;
  }
  return `${normalized.slice(0, 4)} 年 ${Number(normalized.slice(5, 7))} 月`;
}

function getMonthDateKeys(monthKey) {
  const normalized = normalizeText(monthKey);
  if (!/^\d{4}-\d{2}$/u.test(normalized)) {
    return [];
  }
  const [yearText, monthText] = normalized.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return [];
  }
  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => `${normalized}-${String(index + 1).padStart(2, "0")}`);
}

function getWeekStartDateKey(dateKey) {
  const parsed = Date.parse(`${normalizeDateKey(dateKey)}T12:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const weekday = new Date(parsed).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return formatDateKey(new Date(parsed + mondayOffset * DAY_MS));
}

function addDaysToDateKey(dateKey, days) {
  const parsed = Date.parse(`${normalizeDateKey(dateKey)}T12:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return formatDateKey(new Date(parsed + days * DAY_MS));
}

function getParts(formatter, date) {
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

function sanitizeClassToken(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]+/gu, "-") || "state";
}

function normalizeCategoryColorKey(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized.includes(".") ? normalized.split(".")[0] : normalized;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function roundMinutes(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function compareDaysAsc(left, right) {
  return compareTextAsc(left.date, right.date);
}

function compareDaysDesc(left, right) {
  return compareTextDesc(left.date, right.date);
}

function compareEventsAsc(left, right) {
  return compareTextAsc(left.startAt, right.startAt) || compareTextAsc(left.endAt, right.endAt);
}

function compareTimelineItemsAsc(left, right) {
  return compareTextAsc(left.start, right.start) || compareTextAsc(left.end, right.end);
}

function compareDetailEventsAsc(left, right) {
  return compareTextAsc(left.startAt, right.startAt) || compareTextAsc(left.label, right.label);
}

function compareBucketsDesc(left, right) {
  return (right.minutes - left.minutes) || compareTextAsc(left.label, right.label);
}

function compareTextAsc(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function compareTextDesc(left, right) {
  return String(right || "").localeCompare(String(left || ""));
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

module.exports = {
  getTimelineDay,
  getTimelineIndex,
  getTimelineOverview,
  getTimelineRange,
  getTimelineWeek,
};
