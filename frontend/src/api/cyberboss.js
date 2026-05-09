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
  fetchConversationDays(limit = 31) {
    return client.get("/conversations/days", { params: { limit } });
  },
  fetchConversationDay(date) {
    return client.get("/conversations/day", { params: { date } });
  },
  fetchConversationSearch(query, limit = 200) {
    return client.get("/conversations/search", { params: { q: query, limit } });
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
  fetchTimelineIndex() {
    return client.get("/timeline/index");
  },
  fetchTimelineDay(date) {
    return client.get(`/timeline/day/${encodeURIComponent(date)}`);
  },
  fetchTimelineWeek(weekKey) {
    return client.get(`/timeline/week/${encodeURIComponent(weekKey)}`);
  },
  fetchTimelineRange(type, key) {
    return client.get(`/timeline/range/${encodeURIComponent(type)}/${encodeURIComponent(key)}`);
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
  fetchNoteDates() {
    return client.get("/notes/dates");
  },
  fetchNotesByDate(date) {
    return client.get("/notes/day", { params: { date } });
  },
  fetchState() {
    return client.get("/state");
  },
  fetchStickers() {
    return client.get("/stickers");
  },
  fetchStickerBlob(stickerId) {
    return client.get(`/stickers/${encodeURIComponent(stickerId)}/image`, {
      responseType: "blob",
    });
  },
  fetchWeixinInstructions() {
    return client.get("/weixin-instructions");
  },
};
