const {
  listDiaryFiles,
  readDiaryFile,
} = require("../services/diary-service");

async function diaryRoutes(app) {
  app.get("/api/diary", async () => ({
    files: listDiaryFiles(app.config),
  }));

  app.get("/api/diary/:fileName", async (req, reply) => {
    try {
      return readDiaryFile(app.config, req.params.fileName);
    } catch (error) {
      reply.code(404);
      return { message: error.message };
    }
  });
}

module.exports = diaryRoutes;
