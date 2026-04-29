const {
  listConversationDays,
  listConversationLogFiles,
} = require("../services/conversation-service");

async function conversationRoutes(app) {
  app.get("/api/conversations", async (req) => {
    const limit = Number(req.query.limit) || 7;
    return listConversationDays(app.config, { limit });
  });

  app.get("/api/conversations/files", async () => ({
    files: listConversationLogFiles(app.config),
  }));
}

module.exports = conversationRoutes;
