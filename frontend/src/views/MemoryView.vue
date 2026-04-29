<template>
  <div class="page">
    <section class="page-head">
      <h1 class="page-title">记忆</h1>
      <p class="page-subtitle">这里用来查看已经整理好的记忆文件，按你现在的使用习惯直接读，不打断原本的记忆结构。</p>

      <button
        v-if="files.length && !loadingFiles && !error"
        type="button"
        class="memory-select-trigger"
        @click="pickerOpen = true"
      >
        <span class="memory-select-trigger__label">{{ selectedFile || "选择记忆" }}</span>
        <span class="memory-select-trigger__icon">⌄</span>
      </button>
    </section>

    <van-loading v-if="loadingFiles" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <template v-else>
      <section class="section-card file-card">
        <div class="file-header">
          <strong>{{ current.fileName || selectedFile || "未选择" }}</strong>
        </div>
        <div
          v-if="current.text"
          class="markdown-body"
          v-html="renderMarkdown(current.text)"
        ></div>
        <div v-else class="empty-copy">还没有内容</div>
      </section>
    </template>

    <teleport to="body">
      <div v-if="pickerOpen" class="picker-overlay" @click.self="pickerOpen = false">
        <div class="picker-sheet">
          <div class="picker-sheet__header">
            <div>
              <div class="picker-sheet__kicker">记忆文件</div>
              <h3>{{ selectedFile || "选择记忆" }}</h3>
            </div>
            <button type="button" class="modal-close" aria-label="关闭" @click="pickerOpen = false">×</button>
          </div>

          <div class="picker-sheet__body">
            <button
              v-for="file in files"
              :key="file"
              type="button"
              class="picker-item"
              :class="{ 'picker-item--active': file === selectedFile }"
              @click="handlePick(file)"
            >
              {{ file }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const loadingFiles = ref(false);
const error = ref("");
const files = ref([]);
const selectedFile = ref("");
const current = ref({});
const pickerOpen = ref(false);

async function loadFiles() {
  loadingFiles.value = true;
  error.value = "";
  try {
    const result = await cyberbossApi.fetchMemoryFiles();
    files.value = Array.isArray(result.files) ? result.files : [];
    selectedFile.value = files.value[0] || "";
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingFiles.value = false;
  }
}

async function loadCurrent() {
  if (!selectedFile.value) {
    current.value = {};
    return;
  }
  current.value = await cyberbossApi.fetchMemoryFile(selectedFile.value);
}

function handlePick(file) {
  selectedFile.value = file;
  pickerOpen.value = false;
}

function renderMarkdown(source) {
  const text = String(source || "").replace(/\r\n?/gu, "\n");
  if (!text.trim()) {
    return "";
  }

  const lines = text.split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let orderedList = false;
  let blockquoteLines = [];
  let codeFence = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }
    blocks.push(`<p>${renderInline(paragraphLines.join("<br />"))}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) {
      return;
    }
    const tag = orderedList ? "ol" : "ul";
    blocks.push(`<${tag}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`);
    listItems = [];
  };

  const flushBlockquote = () => {
    if (!blockquoteLines.length) {
      return;
    }
    blocks.push(`<blockquote>${renderInline(blockquoteLines.join("<br />"))}</blockquote>`);
    blockquoteLines = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
  };

  for (const line of lines) {
    if (codeFence) {
      if (/^```/u.test(line)) {
        blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
        codeFence = null;
      } else {
        codeFence.push(line);
      }
      continue;
    }

    if (/^```/u.test(line)) {
      flushAll();
      codeFence = [];
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/u);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^---+$|^\*\*\*+$|^___+$/u.test(line.trim())) {
      flushAll();
      blocks.push("<hr />");
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/u);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blockquoteLines.push(quoteMatch[1]);
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/u);
    if (unorderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listItems.length && orderedList) {
        flushList();
      }
      orderedList = false;
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/u);
    if (orderedMatch) {
      flushParagraph();
      flushBlockquote();
      if (listItems.length && !orderedList) {
        flushList();
      }
      orderedList = true;
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    flushBlockquote();
    paragraphLines.push(line);
  }

  if (codeFence) {
    blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
  }

  flushAll();
  return blocks.join("");
}

function renderInline(input) {
  return escapeHtml(input)
    .replace(/`([^`]+)`/gu, (_, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gu, (_, label, href) => (
      `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
    ))
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/gu, "<em>$1</em>");
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function escapeAttribute(input) {
  return escapeHtml(input);
}

watch(selectedFile, () => {
  loadCurrent().catch((err) => {
    error.value = err.message;
  });
});

onMounted(async () => {
  await loadFiles();
  await loadCurrent();
});
</script>

<style scoped>
.page-head {
  position: relative;
  margin-bottom: 18px;
}

.memory-select-trigger {
  appearance: none;
  width: 100%;
  min-height: 44px;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 16px;
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font: inherit;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.memory-select-trigger__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}

.memory-select-trigger__icon {
  color: var(--muted);
  flex: 0 0 auto;
}

.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(24, 35, 15, 0.32);
  backdrop-filter: blur(4px);
}

.picker-sheet {
  width: min(100%, 420px);
  max-height: min(78vh, 620px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px 14px;
  background: linear-gradient(180deg, #fbf7ef 0%, #f4efe6 100%);
  border-radius: 24px;
  box-shadow: 0 20px 48px rgba(24, 35, 15, 0.18);
}

.picker-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.picker-sheet__kicker {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.picker-sheet__header h3 {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.3;
  word-break: break-word;
}

.modal-close {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.1);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  padding: 0;
  background: rgba(255, 253, 249, 0.92);
  color: var(--muted);
  font: inherit;
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
}

.picker-sheet__body {
  display: grid;
  gap: 8px;
  overflow-y: auto;
}

.picker-item {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 14px;
  min-height: 44px;
  padding: 0 12px;
  background: rgba(255, 253, 249, 0.92);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  text-align: left;
}

.picker-item--active {
  background: #eef4e5;
  border-color: rgba(49, 81, 30, 0.2);
  color: var(--accent);
}

.file-card {
  padding: 14px;
}

.file-header {
  margin-bottom: 12px;
  color: var(--muted);
}

.empty-copy {
  color: var(--muted);
  font-size: 14px;
}

.markdown-body {
  color: var(--ink);
  font-size: 14px;
  line-height: 1.7;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1.1em 0 0.45em;
  line-height: 1.3;
}

.markdown-body :deep(h1) {
  font-size: 22px;
}

.markdown-body :deep(h2) {
  font-size: 19px;
}

.markdown-body :deep(h3) {
  font-size: 17px;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre) {
  margin: 0 0 12px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
}

.markdown-body :deep(li + li) {
  margin-top: 4px;
}

.markdown-body :deep(blockquote) {
  padding: 8px 12px;
  border-left: 3px solid rgba(49, 81, 30, 0.24);
  background: rgba(238, 244, 229, 0.32);
  color: var(--muted);
}

.markdown-body :deep(pre) {
  overflow-x: auto;
  padding: 12px;
  border-radius: 12px;
  background: rgba(24, 35, 15, 0.06);
}

.markdown-body :deep(code) {
  font-family: "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
}

.markdown-body :deep(p code),
.markdown-body :deep(li code),
.markdown-body :deep(blockquote code) {
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(24, 35, 15, 0.06);
}

.markdown-body :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(24, 35, 15, 0.08);
  margin: 16px 0;
}
</style>
