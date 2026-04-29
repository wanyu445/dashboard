const {
  listMemoryFiles,
  readMemoryFile,
} = require("../services/memory-service");

async function memoryRoutes(app) {
  app.get("/api/memory", async () => ({
    files: listMemoryFiles(app.config),
  }));

  app.get("/api/memory/:fileName", async (req, reply) => {
    try {
      return readMemoryFile(app.config, req.params.fileName);
    } catch (error) {
      reply.code(404);
      return { message: error.message };
    }
  });
}

module.exports = memoryRoutes;
