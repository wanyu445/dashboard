const {
  getTimelineDay,
  getTimelineIndex,
  getTimelineOverview,
  getTimelineRange,
  getTimelineWeek,
} = require("../services/timeline-service");

async function timelineRoutes(app) {
  app.get("/api/timeline", async () => getTimelineOverview(app.config));

  app.get("/api/timeline/index", async () => getTimelineIndex(app.config));

  app.get("/api/timeline/day/:date", async (req, reply) => {
    const day = getTimelineDay(app.config, req.params.date);
    if (!day) {
      reply.code(404).send({ message: "Timeline day not found" });
      return;
    }
    return day;
  });

  app.get("/api/timeline/week/:weekKey", async (req, reply) => {
    const week = getTimelineWeek(app.config, req.params.weekKey);
    if (!week) {
      reply.code(404).send({ message: "Timeline week not found" });
      return;
    }
    return week;
  });

  app.get("/api/timeline/range/:type/:key", async (req, reply) => {
    const range = getTimelineRange(app.config, req.params.type, req.params.key);
    if (!range) {
      reply.code(404).send({ message: "Timeline range not found" });
      return;
    }
    return range;
  });
}

module.exports = timelineRoutes;
