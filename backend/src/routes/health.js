async function healthRoutes(app) {
  app.get("/api/health", async () => ({
    ok: true,
    service: "cyberboss-dashboard-backend",
    stateDir: app.config.stateDir,
    logDir: app.config.logDir,
  }));
}

module.exports = healthRoutes;
