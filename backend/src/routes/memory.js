const {
  listMemoryTree,
  readMemoryFile,
} = require("../services/memory-service");

async function memoryRoutes(app) {
  app.get("/api/memory", async () => ({
    tree: listMemoryTree(app.config),
  }));

  app.get("/api/memory/*", async (req, reply) => {
    try {
      const fileName = (req.params["*"] || "").trim();
      if (!fileName) {
        reply.code(400);
        return { message: "file name is required" };
      }
      return readMemoryFile(app.config, fileName);
    } catch (error) {
      reply.code(404);
      return { message: error.message };
    }
  });
}

module.exports = memoryRoutes;
