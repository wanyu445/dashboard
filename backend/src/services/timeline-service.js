const fs = require("fs");

function getTimelineOverview(config) {
  const dashboardData = readJson(config.timelineDashboardFile, {});
  const timelineState = readJson(config.timelineStateFile, {});
  const taxonomy = readJson(config.timelineTaxonomyFile, {});
  const facts = readJson(config.timelineFactsFile, {});

  return {
    siteAvailable: fs.existsSync(config.timelineDashboardFile),
    siteUrl: fs.existsSync(config.timelineSiteDir) ? "/timeline-site/index.html" : "",
    meta: dashboardData.meta || {},
    taxonomySummary: summarizeTaxonomy(taxonomy),
    factsSummary: summarizeFacts(facts),
    stateSummary: summarizeTimelineState(timelineState),
    recentDays: summarizeTimelineDays(dashboardData),
    recentWeeks: summarizeTimelineWeeks(dashboardData),
    analytics: summarizeTimelineRanges(dashboardData),
  };
}

function summarizeTaxonomy(taxonomy) {
  const categories = Array.isArray(taxonomy?.categories) ? taxonomy.categories : [];
  return {
    categoryCount: categories.length,
    categories: categories.map((category) => ({
      id: category.id || "",
      label: category.label || category.name || category.id || "",
      childCount: Array.isArray(category.children) ? category.children.length : 0,
    })),
  };
}

function summarizeFacts(facts) {
  const list = Array.isArray(facts?.facts) ? facts.facts : [];
  return {
    factCount: list.length,
    recentFacts: list.slice(-8).reverse(),
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

function summarizeTimelineDays(dashboardData) {
  const dayTimeline = dashboardData?.timelines?.day && typeof dashboardData.timelines.day === "object"
    ? dashboardData.timelines.day
    : {};
  const dates = Object.keys(dayTimeline).sort((left, right) => right.localeCompare(left));
  return dates.slice(0, 56).map((date) => {
    const entry = dayTimeline[date] || {};
    const items = Array.isArray(entry.items) ? entry.items : [];
    return {
      date,
      itemCount: items.length,
      items: items.map((item) => ({
        id: item.id || "",
        content: item.content || "",
        className: item.className || "",
        start: item.start || "",
        end: item.end || "",
        title: item.tooltip?.title || item.content || "",
        note: item.tooltip?.note || "",
        durationText: item.tooltip?.durationText || "",
        timeText: item.tooltip?.timeText || "",
      })),
    };
  });
}

function summarizeTimelineWeeks(dashboardData) {
  const weekTimeline = dashboardData?.timelines?.week && typeof dashboardData.timelines.week === "object"
    ? dashboardData.timelines.week
    : {};
  const keys = Object.keys(weekTimeline).sort((left, right) => right.localeCompare(left));
  return keys.slice(0, 8).map((key) => {
    const entry = weekTimeline[key] || {};
    const groups = Array.isArray(entry.groups) ? entry.groups : [];
    const items = Array.isArray(entry.items) ? entry.items : [];
    return {
      key,
      label: entry.label || key,
      days: groups.map((group) => ({
        id: group.id || "",
        label: group.content || "",
      })),
      itemCount: items.length,
      items: items.map((item) => ({
        id: item.id || "",
        group: item.group || "",
        className: item.className || "",
        start: item.start || "",
        end: item.end || "",
        content: item.content || "",
        title: item.tooltip?.title || item.content || "",
        note: item.tooltip?.note || "",
        timeText: item.tooltip?.timeText || "",
        dateText: item.tooltip?.dateText || item.group || "",
      })),
    };
  });
}

function summarizeTimelineRanges(dashboardData) {
  return {
    day: summarizeRangeEntries(dashboardData?.ranges?.day),
    week: summarizeRangeEntries(dashboardData?.ranges?.week),
    month: summarizeRangeEntries(dashboardData?.ranges?.month),
  };
}

function summarizeRangeEntries(rangeMap) {
  const ranges = rangeMap && typeof rangeMap === "object" ? rangeMap : {};
  return Object.keys(ranges)
    .sort((left, right) => right.localeCompare(left))
    .map((key) => {
      const entry = ranges[key] || {};
      const categoryDetails = entry.categoryDetails && typeof entry.categoryDetails === "object"
        ? entry.categoryDetails
        : {};
      return {
        key,
        label: entry.label || key,
        unit: entry.unit || "",
        totalMinutes: Number(entry.totalMinutes) || 0,
        categories: Array.isArray(entry.categories)
          ? entry.categories.map((category) => ({
            categoryId: category.categoryId || "",
            label: category.label || category.categoryId || "",
            color: category.color || "",
            minutes: Number(category.minutes) || 0,
            percent: Number(category.percent) || 0,
          }))
          : [],
        categoryDetails: Object.fromEntries(
          Object.entries(categoryDetails).map(([categoryId, detail]) => [
            categoryId,
            {
              categoryId: detail?.categoryId || categoryId,
              label: detail?.label || categoryId,
              color: detail?.color || "",
              trend: Array.isArray(detail?.trend)
                ? detail.trend.map((point) => ({
                  key: point.key || "",
                  label: point.label || point.key || "",
                  minutes: Number(point.minutes) || 0,
                }))
                : [],
              subcategories: Array.isArray(detail?.subcategories)
                ? detail.subcategories.map((subcategory) => ({
                  subcategoryId: subcategory.subcategoryId || "",
                  categoryId: subcategory.categoryId || categoryId,
                  label: subcategory.label || subcategory.subcategoryId || "",
                  color: subcategory.color || "",
                  minutes: Number(subcategory.minutes) || 0,
                  percent: Number(subcategory.percent) || 0,
                }))
                : [],
              events: Array.isArray(detail?.events)
                ? detail.events.map((event) => ({
                  eventNodeId: event.eventNodeId || "",
                  label: event.label || "",
                  dateLabel: event.dateLabel || "",
                  timeLabel: event.timeLabel || "",
                  compactDuration: event.compactDuration || "",
                  fullLabel: event.fullLabel || "",
                  note: event.note || "",
                  status: event.status || "",
                  categoryId: event.categoryId || categoryId,
                  subcategoryId: event.subcategoryId || "",
                  subcategoryLabel: event.subcategoryLabel || "",
                  minutes: Number(event.minutes) || 0,
                }))
                : [],
            },
          ]),
        ),
      };
    });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

module.exports = { getTimelineOverview };
