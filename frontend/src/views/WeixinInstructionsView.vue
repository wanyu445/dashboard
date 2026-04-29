<template>
  <div class="page">
    <section class="page-head">
      <div class="title-meta">
        <h1 class="page-title">微信说明</h1>
        <button
          type="button"
          class="meta-trigger"
          title="同步数据"
          @click="load"
        >
          ↻
        </button>
      </div>
      <p class="page-subtitle">直接读取 `weixin-instructions.md`，按 Markdown 展示。</p>
    </section>

    <van-loading v-if="loading" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <section v-else class="section-card file-card">
      <div class="file-header">
        <strong>{{ current.fileName || "weixin-instructions.md" }}</strong>
      </div>
      <div
        v-if="current.text"
        class="markdown-body"
        v-html="renderMarkdown(current.text)"
      ></div>
      <div v-else class="empty-copy">还没有内容</div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const loading = ref(false);
const error = ref("");
const current = ref({});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    current.value = await cyberbossApi.fetchWeixinInstructions();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
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

onMounted(load);
</script>

<style scoped>
.page-head {
  position: relative;
  margin-bottom: 18px;
}

.title-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.meta-trigger {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.12);
  border-radius: 999px;
  width: 24px;
  height: 24px;
  padding: 0;
  background: rgba(255, 253, 249, 0.9);
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(24, 35, 15, 0.05);
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
