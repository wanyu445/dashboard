import client from "./client";

export const cyberbossApi = {
  fetchAuthConfig() {
    return client.get("/auth/config");
  },
  login(password) {
    return client.post("/auth/login", { password });
  },
  fetchConversations(limit = 7) {
    return client.get("/conversations", { params: { limit } });
  },
  fetchConversationAttachmentBlob(filePath) {
    return client.get("/conversations/attachment", {
      params: { path: filePath },
      responseType: "blob",
    });
  },
  fetchTimeline() {
    return client.get("/timeline");
  },
  fetchDiaryFiles() {
    return client.get("/diary");
  },
  fetchDiaryFile(fileName) {
    return client.get(`/diary/${encodeURIComponent(fileName)}`);
  },
  fetchMemoryFiles() {
    return client.get("/memory");
  },
  fetchMemoryFile(fileName) {
    return client.get(`/memory/${encodeURIComponent(fileName)}`);
  },
  fetchState() {
    return client.get("/state");
  },
  fetchWeixinInstructions() {
    return client.get("/weixin-instructions");
  },
};
