async function authRoutes(app) {
  app.get("/api/auth/config", async () => ({
    enabled: app.auth.enabled,
    sessionDays: app.config.authSessionDays,
  }));

  app.post("/api/auth/login", async (req, reply) => {
    if (!app.auth.enabled) {
      return {
        enabled: false,
        token: "",
        expiresInSeconds: 0,
      };
    }

    if (!app.auth.verifyPassword(req.body?.password)) {
      reply.code(401);
      return { message: "口令不对" };
    }

    return {
      enabled: true,
      token: app.auth.createSessionToken(),
      expiresInSeconds: Math.floor(app.auth.sessionTtlMs / 1000),
    };
  });
}

module.exports = authRoutes;
