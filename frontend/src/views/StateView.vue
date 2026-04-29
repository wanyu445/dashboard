<template>
  <div class="page">
    <section class="page-head">
      <div class="title-meta">
        <h1 class="page-title">状态（State）</h1>
        <button
          type="button"
          class="meta-trigger"
          title="同步数据"
          @click="load"
        >
          ↻
        </button>
      </div>
      <p class="page-subtitle">当前线程绑定、队列、在线/睡眠状态（presence / sleep）和其它本地状态文件都收在这里看。</p>
    </section>

    <van-loading v-if="loading" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <van-collapse v-else v-model="openNames" class="state-collapse">
      <van-collapse-item title="会话（sessions）" name="sessions">
        <pre class="pre-wrap mono">{{ pretty(state.sessions) }}</pre>
      </van-collapse-item>
      <van-collapse-item title="运行上下文（runtime context）" name="runtimeContext">
        <pre class="pre-wrap mono">{{ pretty(state.runtimeContext) }}</pre>
      </van-collapse-item>
      <van-collapse-item title="提醒（reminders）" name="reminders">
        <pre class="pre-wrap mono">{{ pretty(state.reminders) }}</pre>
      </van-collapse-item>
      <van-collapse-item title="系统队列（system queue）" name="systemQueue">
        <pre class="pre-wrap mono">{{ pretty(state.systemQueue) }}</pre>
      </van-collapse-item>
      <van-collapse-item title="睡眠 / 在线 / 生理期（sleep / presence / period）" name="humanStates">
        <pre class="pre-wrap mono">{{ pretty({
          sleepState: state.sleepState,
          presenceState: state.presenceState,
          periodState: state.periodState,
        }) }}</pre>
      </van-collapse-item>
      <van-collapse-item title="主动消息 / 延迟回复（proactive / deferred replies）" name="outboundStates">
        <pre class="pre-wrap mono">{{ pretty({
          proactiveMessages: state.proactiveMessages,
          deferredSystemReplies: state.deferredSystemReplies,
        }) }}</pre>
      </van-collapse-item>
      <van-collapse-item title="位置 / 账号（locations / accounts）" name="deviceStates">
        <pre class="pre-wrap mono">{{ pretty({
          locations: state.locations,
          accounts: state.accounts,
        }) }}</pre>
      </van-collapse-item>
    </van-collapse>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const loading = ref(false);
const error = ref("");
const state = ref({});
const openNames = ref([]);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    state.value = await cyberbossApi.fetchState();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
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

.state-collapse {
  display: grid;
  gap: 10px;
  background: transparent;
}

.state-collapse :deep(.van-collapse-item) {
  overflow: hidden;
  border: 1px solid rgba(24, 35, 15, 0.06);
  border-radius: 18px;
  background: rgba(255, 253, 249, 0.88);
  box-shadow: 0 8px 24px rgba(24, 35, 15, 0.05);
}

.state-collapse :deep(.van-collapse-item__title),
.state-collapse :deep(.van-collapse-item__wrapper),
.state-collapse :deep(.van-cell),
.state-collapse :deep(.van-cell::after),
.state-collapse :deep(.van-collapse-item__content) {
  background: transparent;
}

.state-collapse :deep(.van-cell) {
  padding: 14px 16px;
}

.state-collapse :deep(.van-collapse-item__content) {
  padding: 0 16px 16px;
}

pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
}
</style>
