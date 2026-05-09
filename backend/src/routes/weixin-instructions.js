const { getWeixinInstructions, getWeixinOperations } = require("../services/weixin-instructions-service");

async function weixinInstructionsRoutes(app) {
  app.get("/api/weixin-instructions", async (req, reply) => {
    try {
      return {
        instructions: getWeixinInstructions(app.config),
        operations: getWeixinOperations(app.config),
      };
    } catch (error) {
      reply.code(404);
      return { message: error.message };
    }
  });
}

module.exports = weixinInstructionsRoutes;
