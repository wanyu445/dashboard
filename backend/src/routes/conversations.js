const {
  listConversationDays,
  listConversationDaySummaries,
  getConversationDay,
  listConversationLogFiles,
} = require("../services/conversation-service");
const fs = require("fs");
const path = require("path");

async function conversationRoutes(app) {
  app.get("/api/conversations", async (req) => {
    const limit = Number(req.query.limit) || 7;
    return listConversationDays(app.config, { limit });
  });

  app.get("/api/conversations/days", async (req) => {
    const limit = Number(req.query.limit) || 31;
    return {
      days: listConversationDaySummaries(app.config, { limit }),
    };
  });

  app.get("/api/conversations/day", async (req, reply) => {
    const day = getConversationDay(app.config, req.query?.date);
    if (!day) {
      reply.code(404);
      return { message: "未找到对应日期的会话记录" };
    }
    return { day };
  });

  app.get("/api/conversations/files", async () => ({
    files: listConversationLogFiles(app.config),
  }));

  app.get("/api/conversations/attachment", async (req, reply) => {
    const resolvedPath = resolveAttachmentPath(req.query?.path, app.config.stateDir);
    if (!resolvedPath || !fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      reply.code(404);
      return { message: "附件不存在" };
    }

    reply.header("Cache-Control", "private, max-age=300");
    reply.type(resolveMimeType(resolvedPath));
    return reply.send(fs.createReadStream(resolvedPath));
  });
}

function resolveAttachmentPath(filePath, rootDir) {
  const normalizedFilePath = typeof filePath === "string" ? filePath.trim() : "";
  const normalizedRootDir = typeof rootDir === "string" ? rootDir.trim() : "";
  if (!normalizedFilePath || !normalizedRootDir) {
    return "";
  }

  const resolvedFilePath = path.resolve(normalizedFilePath);
  const resolvedRootDir = path.resolve(normalizedRootDir);
  const relative = path.relative(resolvedRootDir, resolvedFilePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "";
  }
  return resolvedFilePath;
}

function resolveMimeType(filePath) {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  const mimeByExtension = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return mimeByExtension[extension] || "application/octet-stream";
}

module.exports = conversationRoutes;
