const { getTimelineOverview } = require("../services/timeline-service");

async function timelineRoutes(app) {
  app.get("/api/timeline", async () => getTimelineOverview(app.config));
}

module.exports = timelineRoutes;
