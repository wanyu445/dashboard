const { getStateSnapshot } = require("../services/state-service");

async function stateRoutes(app) {
  app.get("/api/state", async () => getStateSnapshot(app.config));
}

module.exports = stateRoutes;
