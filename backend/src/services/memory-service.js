const fs = require("fs");
const path = require("path");

function listMemoryTree(config) {
  if (!fs.existsSync(config.memoryDir)) {
    return null;
  }
  return buildTreeNode(config.memoryDir, config.memoryDir);
}

function buildTreeNode(baseDir, currentDir) {
  const name = path.basename(currentDir) || path.relative(baseDir, currentDir) || ".";
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const children = [];
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const subNode = buildTreeNode(baseDir, fullPath);
      if (subNode.children.length > 0) {
        children.push(subNode);
      }
    } else if (entry.isFile() && /\.md$/iu.test(entry.name)) {
      children.push({
        name: entry.name,
        type: "file",
        path: path.relative(baseDir, fullPath).replace(/\\/g, "/"),
      });
    }
  }

  return {
    name,
    type: "directory",
    children,
  };
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
  const normalized = String(fileName || "").trim().replace(/\\/g, "/");
  if (!normalized) {
    throw new Error("file name is required");
  }
  const candidate = path.join(memoryDir, normalized);
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(path.resolve(memoryDir) + path.sep) && resolved !== path.resolve(memoryDir)) {
    throw new Error(`path traversal blocked: ${fileName}`);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`file not found: ${normalized}`);
  }
  return resolved;
}

module.exports = {
  listMemoryTree,
  readMemoryFile,
};
