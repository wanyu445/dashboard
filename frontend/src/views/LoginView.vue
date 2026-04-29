<template>
  <div class="page login-page">
    <section class="login-card section-card">
      <div class="login-card__head">
        <div class="login-kicker">Dashboard</div>
        <h1 class="page-title">登录</h1>
        <p class="page-subtitle">这个面板读取的是你本地的 Cyberboss 数据，进入前先验证访问口令。</p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit">
        <label class="login-label" for="password">访问口令</label>
        <van-field
          id="password"
          v-model="password"
          type="password"
          placeholder="输入后端配置的口令"
          autocomplete="current-password"
          clearable
        />
        <div v-if="error" class="login-error">{{ error }}</div>
        <button type="submit" class="login-submit" :disabled="submitting || !password.trim()">
          {{ submitting ? "登录中…" : "进入面板" }}
        </button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ensureAuthConfig, loginWithPassword } from "../auth";

const router = useRouter();
const route = useRoute();

const password = ref("");
const error = ref("");
const submitting = ref(false);

async function handleSubmit() {
  if (!password.value.trim()) {
    return;
  }

  submitting.value = true;
  error.value = "";
  try {
    await loginWithPassword(password.value);
    router.replace(String(route.query.redirect || "/conversation"));
  } catch (err) {
    error.value = err.message;
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  const auth = await ensureAuthConfig();
  if (!auth.enabled) {
    router.replace("/conversation");
  }
});
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 24px 18px 18px;
}

.login-card__head {
  margin-bottom: 18px;
}

.login-kicker {
  margin-bottom: 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.login-form {
  display: grid;
  gap: 12px;
}

.login-label {
  font-size: 13px;
  color: var(--muted);
}

.login-error {
  color: #8b1538;
  font-size: 13px;
}

.login-submit {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  background: var(--accent);
  color: #fffdf9;
  font-size: 15px;
  font-weight: 600;
}

.login-submit:disabled {
  opacity: 0.55;
}
</style>
