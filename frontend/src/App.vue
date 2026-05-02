<template>
  <div class="app-shell">
    <router-view />
    <van-tabbar v-if="showTabbar" route safe-area-inset-bottom class="dashboard-tabbar">
      <van-tabbar-item icon="chat-o" to="/conversation">对话</van-tabbar-item>
      <van-tabbar-item icon="clock-o" to="/timeline">时间轴</van-tabbar-item>
      <van-tabbar-item icon="description-o" to="/diary">日记</van-tabbar-item>
      <van-tabbar-item icon="notes-o" to="/memory">记忆</van-tabbar-item>
      <van-tabbar-item icon="location-o" to="/notes">现场</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const showTabbar = computed(() => route.name !== "login");
</script>

<style>
:root {
  --bg: #f6f2ea;
  --card: #fffdf9;
  --ink: #18230f;
  --text: #18230f;
  --muted: #6d735f;
  --line: #e7dfd1;
  --accent: #31511e;
  --accent-soft: #eef4e5;
  --thinking: #f4efe5;
  --tool: #edf2fa;
  --user: #fff7e8;
  --assistant: #f8fbf3;
  --system: #f1f1f1;
  --cat-life: #ff8f7a;
  --cat-work: #ffb84d;
  --cat-study: #7bc96f;
  --cat-exercise: #4fcfff;
  --cat-entertainment: #ff74c8;
  --cat-health: #52d6c3;
  --cat-social: #a67cff;
  --cat-care: #ff9eb5;
  --cat-travel: #6fa8ff;
  --cat-rest: #8a84ff;
  --cat-state: #4e79a7;
}

html, body, #app {
  margin: 0;
  min-height: 100%;
  background: linear-gradient(180deg, #f9f4eb 0%, #f2efe9 100%);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue",
    "PingFang SC", "Microsoft YaHei", sans-serif;
}

* {
  box-sizing: border-box;
}

.app-shell {
  min-height: 100vh;
  max-width: 920px;
  margin: 0 auto;
  background: transparent;
}

.page {
  min-height: 100vh;
  padding: 16px 14px 90px;
}

.page-title {
  margin: 0 0 6px;
  font-size: 28px;
  line-height: 1.1;
}

.page-subtitle {
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.dashboard-tabbar {
  background: rgba(255, 253, 249, 0.92) !important;
  backdrop-filter: blur(18px);
  border-top: 1px solid rgba(24, 35, 15, 0.06);
}

.dashboard-tabbar .van-tabbar-item--active {
  color: var(--accent);
}

.section-card {
  background: rgba(255, 253, 249, 0.88);
  border: 1px solid rgba(24, 35, 15, 0.06);
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(24, 35, 15, 0.05);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
