const fs = require("fs");
const path = require("path");

const IMAGE_EXTENSIONS = new Set([".gif", ".webp", ".png", ".jpg", ".jpeg"]);

function getStickerSnapshot(config) {
  const source = resolveStickerSource(config);
  const index = readJson(source.indexFile, {});
  const tags = readJson(source.tagsFile, []);
  const stickers = Object.entries(index)
    .map(([id, value]) => normalizeSticker(id, value, source.assetsDir))
    .filter(Boolean)
    .sort((left, right) => left.id.localeCompare(right.id, "en"));

  return {
    source: source.kind,
    total: stickers.length,
    tags: Array.isArray(tags) ? tags.map(normalizeText).filter(Boolean) : collectTags(stickers),
    stickers,
  };
}

function getStickerImage(config, stickerId) {
  const normalizedId = normalizeStickerId(stickerId);
  if (!normalizedId) {
    return null;
  }
  const source = resolveStickerSource(config);
  const index = readJson(source.indexFile, {});
  if (!index[normalizedId]) {
    return null;
  }
  const filePath = findStickerFilePath(source.assetsDir, normalizedId);
  if (!filePath) {
    return null;
  }
  return {
    filePath,
    contentType: contentTypeForPath(filePath),
  };
}

function resolveStickerSource(config) {
  if (fs.existsSync(config.stickersIndexFile) && fs.existsSync(config.stickerAssetsDir)) {
    return {
      kind: "state",
      indexFile: config.stickersIndexFile,
      tagsFile: config.stickerTagsFile,
      assetsDir: config.stickerAssetsDir,
    };
  }
  return {
    kind: "template",
    indexFile: config.stickersTemplateIndexFile,
    tagsFile: config.stickerTagsTemplateFile,
    assetsDir: config.stickerAssetsTemplateDir,
  };
}

function normalizeSticker(id, value, assetsDir) {
  const normalizedId = normalizeStickerId(id);
  if (!normalizedId || !value || typeof value !== "object") {
    return null;
  }
  const filePath = findStickerFilePath(assetsDir, normalizedId);
  return {
    id: normalizedId,
    tags: Array.isArray(value.tags) ? value.tags.map(normalizeText).filter(Boolean) : [],
    desc: normalizeText(value.desc),
    hasImage: Boolean(filePath),
  };
}

function findStickerFilePath(assetsDir, stickerId) {
  if (!assetsDir || !fs.existsSync(assetsDir)) {
    return "";
  }
  for (const extension of IMAGE_EXTENSIONS) {
    const filePath = path.join(assetsDir, `${stickerId}${extension}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return "";
}

function collectTags(stickers) {
  return [...new Set(stickers.flatMap((item) => item.tags))];
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeStickerId(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/gu, "");
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function contentTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  return "application/octet-stream";
}

module.exports = { getStickerSnapshot, getStickerImage };
