const fs = require("fs");

function getWeixinInstructions(config) {
  const filePath = String(config.weixinInstructionsFile || "").trim();
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("weixin-instructions.md not found");
  }

  return {
    fileName: "weixin-instructions.md",
    filePath,
    text: fs.readFileSync(filePath, "utf8"),
  };
}

function getWeixinOperations(config) {
  const filePath = String(config.weixinOperationsFile || "").trim();
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("weixin-operations.md not found");
  }

  return {
    fileName: "weixin-operations.md",
    filePath,
    text: fs.readFileSync(filePath, "utf8"),
  };
}

module.exports = { getWeixinInstructions, getWeixinOperations };
