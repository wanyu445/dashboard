const fs = require("fs");

const { getStickerImage, getStickerSnapshot } = require("../services/sticker-service");

async function stickerRoutes(app) {
  app.get("/api/stickers", async () => getStickerSnapshot(app.config));

  app.get("/api/stickers/:stickerId/image", async (req, reply) => {
    const image = getStickerImage(app.config, req.params.stickerId);
    if (!image) {
      reply.code(404).send({ message: "Sticker not found" });
      return;
    }
    reply.header("content-type", image.contentType);
    reply.header("cache-control", "private, max-age=300");
    return reply.send(fs.createReadStream(image.filePath));
  });
}

module.exports = stickerRoutes;
