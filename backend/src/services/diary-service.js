const fs = require("fs");
const path = require("path");

function listDiaryFiles(config) {
  return listMarkdownFiles(config.diaryDir, /^[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$/u, "desc");
}

function readDiaryFile(config, fileName) {
  const filePath = resolveChildFile(config.diaryDir, fileName, /^[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$/u);
  return {
    fileName,
    filePath,
    text: fs.readFileSync(filePath, "utf8"),
  };
}

function listMarkdownFiles(dirPath, matcher, direction = "asc") {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const files = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && matcher.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  return direction === "desc" ? files.reverse() : files;
}

function resolveChildFile(dirPath, fileName, matcher) {
  const normalized = String(fileName || "").trim();
  if (!normalized || path.basename(normalized) !== normalized || !matcher.test(normalized)) {
    throw new Error(`invalid file name: ${fileName}`);
  }
  const filePath = path.join(dirPath, normalized);
  if (!fs.existsSync(filePath)) {
    throw new Error(`file not found: ${normalized}`);
  }
  return filePath;
}

module.exports = {
  listDiaryFiles,
  readDiaryFile,
};
