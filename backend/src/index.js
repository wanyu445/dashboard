const fastify = require("fastify");
const cors = require("@fastify/cors");
const fastifyStatic = require("@fastify/static");

const { readConfig } = require("./core/config");
const { createAuthService } = require("./services/auth-service");
const authRoutes = require("./routes/auth");
const healthRoutes = require("./routes/health");
const conversationRoutes = require("./routes/conversations");
const timelineRoutes = require("./routes/timeline");
const diaryRoutes = require("./routes/diary");
const memoryRoutes = require("./routes/memory");
const stateRoutes = require("./routes/state");
const weixinInstructionsRoutes = require("./routes/weixin-instructions");

async function buildServer() {
  const config = readConfig();
  const app = fastify({ logger: true });
  const auth = createAuthService(config);

  app.decorate("config", config);
  app.decorate("auth", auth);
  await app.register(cors, { origin: true });

  app.addHook("onRequest", async (req, reply) => {
    if (!auth.enabled || isPublicRequest(req)) {
      return;
    }
    if (auth.verifyAuthorizationHeader(req.headers.authorization)) {
      return;
    }
    reply.code(401).send({ message: "需要登录" });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(conversationRoutes);
  await app.register(timelineRoutes);
  await app.register(diaryRoutes);
  await app.register(memoryRoutes);
  await app.register(stateRoutes);
  await app.register(weixinInstructionsRoutes);

  if (config.siteAvailable) {
    await app.register(fastifyStatic, {
      root: config.timelineSiteDir,
      prefix: "/timeline-site/",
      decorateReply: false,
      wildcard: false,
    });
  }

  if (config.serveDist) {
    await app.register(fastifyStatic, {
      root: config.distDir,
      prefix: "/",
      wildcard: true,
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api") && !req.url.startsWith("/timeline-site/")) {
        return reply.sendFile("index.html");
      }
      reply.code(404).send({ message: "Not Found" });
    });
  }

  return { app, config };
}

async function start() {
  let app = null;
  try {
    const built = await buildServer();
    app = built.app;
    const { config } = built;
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`cyberboss-dashboard ready · state dir: ${config.stateDir}`);
    app.log.info(`conversation logs: ${config.logDir}`);
    app.log.info(`auth: ${config.authPassword ? "enabled" : "disabled"}`);
    if (config.serveDist) {
      app.log.info(`serving frontend from ${config.distDir}`);
    }
  } catch (error) {
    if (app) {
      app.log.error(error);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

function isPublicRequest(req) {
  if (req.method === "OPTIONS") {
    return true;
  }
  const pathname = String(req.url || "").split("?")[0];
  return pathname === "/api/health"
    || pathname === "/api/auth/config"
    || pathname === "/api/auth/login"
    || (!pathname.startsWith("/api") && !pathname.startsWith("/timeline-site/"));
}

if (require.main === module) {
  start();
}

module.exports = { buildServer };
