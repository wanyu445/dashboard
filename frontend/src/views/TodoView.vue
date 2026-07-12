<template>
  <div class="page">
    <section class="page-head">
      <div class="title-meta">
        <h1 class="page-title">待办</h1>
        <button type="button" class="meta-trigger" title="刷新" @click="load">↻</button>
      </div>
      <p class="page-subtitle">来自 cyberboss todo MCP，和 agent 共用同一份数据。</p>
    </section>

    <van-loading v-if="loading" size="24px" vertical>加载中</van-loading>
    <van-notice-bar v-else-if="error" color="#8b1538" background="#fdecef" :text="error" />

    <template v-else>
      <form class="add-form" @submit.prevent="handleAdd">
        <input v-model="newTitle" class="add-input" placeholder="新待办..." maxlength="200" />
        <button type="submit" class="add-btn" :disabled="!newTitle.trim()">+</button>
      </form>

      <div v-if="activeTodos.length" class="todo-section">
        <h2 class="section-label">进行中 ({{ activeTodos.length }})</h2>
        <div v-for="todo in activeTodos" :key="todo.id" class="todo-card section-card" :class="{ 'todo-card--editing': editingId === todo.id }">
          <template v-if="editingId === todo.id">
            <input v-model="editTitle" class="edit-input" placeholder="标题" />
            <textarea v-model="editDesc" class="edit-textarea" rows="3" placeholder="描述" />
            <div class="edit-actions">
              <button type="button" class="btn-save" @click="handleSave(todo.id)">保存</button>
              <button type="button" class="btn-cancel" @click="editingId = null">取消</button>
            </div>
          </template>
          <template v-else>
            <div class="todo-head">
              <button type="button" class="check-btn" @click="handleComplete(todo.id)">○</button>
              <div class="todo-body" @click="startEdit(todo)">
                <strong class="todo-title">{{ todo.title }}</strong>
                <span v-if="todo.description" class="todo-desc">{{ todo.description }}</span>
                <span class="todo-meta mono">
                  创建于 {{ formatDate(todo.createdAt) }}
                  <template v-if="todo.startedAt">
                    · 开始 {{ formatDate(todo.startedAt) }}
                    <span class="duration-tag">{{ formatDuration(todo.startedAt, null) }}</span>
                  </template>
                  <template v-else>
                    <button type="button" class="start-btn" @click.stop="handleStart(todo.id)">▶ 开始</button>
                  </template>
                </span>
              </div>
              <button type="button" class="del-btn" @click="handleDelete(todo.id)">×</button>
            </div>
          </template>
        </div>
      </div>

      <div v-if="completedTodos.length" class="todo-section">
        <h2 class="section-label">已完成 ({{ completedTodos.length }})</h2>
        <div v-for="todo in completedTodos" :key="todo.id" class="todo-card section-card todo-card--done">
          <div class="todo-head">
            <button type="button" class="check-btn check-btn--done" @click="handleUncomplete(todo.id)">●</button>
            <div class="todo-body">
              <strong class="todo-title todo-title--done">{{ todo.title }}</strong>
              <span class="todo-meta mono">
                完成于 {{ formatDate(todo.completedAt) }}
                <span v-if="todo.startedAt" class="duration-tag">{{ formatDuration(todo.startedAt, todo.completedAt) }}</span>
              </span>
            </div>
            <button type="button" class="del-btn" @click="handleDelete(todo.id)">×</button>
          </div>
        </div>
      </div>

      <div v-if="!activeTodos.length && !completedTodos.length" class="empty-copy">还没有待办，让 agent 帮你加一条吧</div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { cyberbossApi } from "../api/cyberboss";

const loading = ref(false);
const error = ref("");
const todos = ref([]);
const newTitle = ref("");
const editingId = ref(null);
const editTitle = ref("");
const editDesc = ref("");

const activeTodos = computed(() => todos.value.filter((t) => !t.completed));
const completedTodos = computed(() => todos.value.filter((t) => t.completed));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await cyberbossApi.fetchTodos();
    todos.value = Array.isArray(result.todos) ? result.todos : [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  const t = newTitle.value.trim();
  if (!t) return;
  try {
    await cyberbossApi.createTodo({ title: t, description: "" });
    newTitle.value = "";
    await load();
  } catch (err) {
    error.value = err.message;
  }
}

async function handleStart(id) {
  await cyberbossApi.updateTodo(id, { startedAt: new Date().toISOString() });
  await load();
}

function startEdit(todo) {
  editingId.value = todo.id;
  editTitle.value = todo.title;
  editDesc.value = todo.description;
}

async function handleComplete(id) {
  await cyberbossApi.updateTodo(id, { completed: true });
  await load();
}

async function handleUncomplete(id) {
  await cyberbossApi.updateTodo(id, { completed: false });
  await load();
}

async function handleSave(id) {
  await cyberbossApi.updateTodo(id, {
    title: editTitle.value.trim(),
    description: editDesc.value.trim(),
  });
  editingId.value = null;
  await load();
}

async function handleDelete(id) {
  await cyberbossApi.deleteTodo(id);
  await load();
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return "";
  const end = completedAt ? new Date(completedAt) : new Date();
  const ms = end - new Date(startedAt);
  if (ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "< 1m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

onMounted(load);
</script>

<style scoped>
.title-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.meta-trigger {
  appearance: none;
  border: 1px solid rgba(24, 35, 15, 0.1);
  border-radius: 999px;
  width: 32px;
  height: 32px;
  padding: 0;
  background: rgba(255, 253, 249, 0.92);
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
}
.add-form {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}
.add-input {
  flex: 1;
  min-height: 44px;
  border: 1px solid rgba(24, 35, 15, 0.08);
  border-radius: 14px;
  padding: 0 14px;
  font: inherit;
  font-size: 14px;
  background: rgba(255, 253, 249, 0.92);
}
.add-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 14px;
  background: var(--accent);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.add-btn:disabled {
  opacity: 0.4;
}
.section-label {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.todo-section {
  margin-bottom: 20px;
}
.todo-card {
  padding: 12px 14px;
  margin-bottom: 8px;
}
.todo-card--done {
  opacity: 0.6;
}
.todo-card--editing {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.todo-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.check-btn {
  appearance: none;
  border: 1.5px solid rgba(24, 35, 15, 0.2);
  border-radius: 999px;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--muted);
}
.check-btn--done {
  color: var(--accent);
  border-color: var(--accent);
}
.todo-body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.todo-title {
  display: block;
  font-size: 15px;
  line-height: 1.4;
}
.todo-title--done {
  text-decoration: line-through;
  color: var(--muted);
}
.todo-desc {
  display: block;
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.todo-meta {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-top: 6px;
}
.del-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0 4px;
}
.edit-input, .edit-textarea {
  width: 100%;
  border: 1px solid rgba(24, 35, 15, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  font: inherit;
  font-size: 14px;
  background: rgba(255, 253, 249, 0.92);
}
.edit-actions {
  display: flex;
  gap: 8px;
}
.btn-save, .btn-cancel {
  appearance: none;
  border: none;
  border-radius: 10px;
  padding: 6px 16px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.btn-save {
  background: var(--accent);
  color: #fff;
}
.btn-cancel {
  background: rgba(24, 35, 15, 0.06);
  color: var(--muted);
}
.start-btn {
  appearance: none;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 6px;
  margin-left: 2px;
}
.start-btn:hover {
  background: var(--accent-soft);
}
.duration-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  margin-left: 4px;
}
.empty-copy {
  color: var(--muted);
  font-size: 14px;
  text-align: center;
  margin-top: 40px;
}
</style>
