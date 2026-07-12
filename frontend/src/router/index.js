import { createRouter, createWebHistory } from "vue-router";
import { authState, ensureAuthConfig } from "../auth";

const routes = [
  { path: "/", redirect: "/conversation" },
  { path: "/login", name: "login", component: () => import("../views/LoginView.vue") },
  { path: "/conversation", name: "conversation", component: () => import("../views/ConversationView.vue") },
  { path: "/timeline", name: "timeline", component: () => import("../views/TimelineView.vue") },
  { path: "/diary", name: "diary", component: () => import("../views/DiaryView.vue") },
  { path: "/memory", name: "memory", component: () => import("../views/MemoryView.vue") },
  { path: "/notes", name: "notes", component: () => import("../views/NotesView.vue") },
  { path: "/todos", name: "todos", component: () => import("../views/TodoView.vue") },
  { path: "/state", name: "state", component: () => import("../views/StateView.vue") },
  { path: "/weixin-instructions", name: "weixin-instructions", component: () => import("../views/WeixinInstructionsView.vue") },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = await ensureAuthConfig();
  if (!auth.enabled) {
    if (to.name === "login") {
      return { name: "conversation" };
    }
    return true;
  }

  if (to.name === "login") {
    return authState.token ? { path: String(to.query.redirect || "/conversation") } : true;
  }

  if (!authState.token) {
    return {
      name: "login",
      query: to.fullPath && to.fullPath !== "/conversation" ? { redirect: to.fullPath } : {},
    };
  }

  return true;
});

export default router;
