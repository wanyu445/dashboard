const fs = require("fs");
const path = require("path");

function listMemoryFiles(config) {
  if (!fs.existsSync(config.memoryDir)) {
    return [];
  }
  return fs.readdirSync(config.memoryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[A-Za-z0-9._-]+\.md$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function readMemoryFile(config, fileName) {
  const filePath = resolveMemoryFile(config.memoryDir, fileName);
  return {
    fileName,
    filePath,
    text: fs.readFileSync(filePath, "utf8"),
  };
}

function resolveMemoryFile(memoryDir, fileName) {
  const normalized = String(fileName || "").trim();
  if (!normalized || path.basename(normalized) !== normalized || !/^[A-Za-z0-9._-]+\.md$/u.test(normalized)) {
    throw new Error(`invalid file name: ${fileName}`);
  }
  const filePath = path.join(memoryDir, normalized);
  if (!fs.existsSync(filePath)) {
    throw new Error(`file not found: ${normalized}`);
  }
  return filePath;
}

module.exports = {
  listMemoryFiles,
  readMemoryFile,
};
