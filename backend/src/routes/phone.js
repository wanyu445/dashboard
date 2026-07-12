const fs = require("fs");
const path = require("path");

const PKG_NAMES = {
  "com.tencent.mm": "微信",
  "com.tencent.mobileqq": "QQ",
  "com.tencent.wework": "企业微信",
  "com.tencent.androidqqmail": "QQ邮箱",
  "com.sina.weibo": "微博",
  "com.zhihu.android": "知乎",
  "com.taobao.taobao": "手机淘宝",
  "com.jingdong.app.mall": "京东",
  "com.xingin.xhs": "小红书",
  "com.sankuai.meituan": "美团",
  "com.xunmeng.pinduoduo": "拼多多",
  "com.achievo.vipshop": "唯品会",
  "com.suning.mobile.ebuy": "苏宁易购",
  "com.sdu.didi.psnger": "滴滴出行",
  "com.autonavi.minimap": "高德地图",
  "com.baidu.BaiduMap": "百度地图",
  "ctrip.android.view": "携程旅行",
  "com.MobileTicket": "铁路12306",
  "com.cainiao.wireless": "菜鸟裹裹",
  "tv.danmaku.bili": "哔哩哔哩",
  "com.netease.cloudmusic": "网易云音乐",
  "com.ss.android.ugc.aweme": "抖音",
  "com.qiyi.video": "爱奇艺",
  "com.youku.phone": "优酷",
  "com.mfashiongallery.emag": "杂志锁屏",
  "com.miui.mediaviewer": "媒体查看器",
  "com.baidu.searchbox": "百度",
  "com.netease.mobimail": "网易邮箱大师",
  "io.iftech.timeminer": "时间日志",
  "com.tailscale.ipn": "Tailscale",
  "com.deepseek.chat": "DeepSeek",
  "com.example.cyberboss_app": "cyberboss_app",
  "com.miui.home": "系统桌面",
  "com.miui.securitycenter": "安全服务",
  "com.miui.securitycore": "安全核心",
  "com.miui.packageinstaller": "包安装程序",
  "com.miui.gallery": "相册",
  "com.xiaomi.market": "应用商店",
  "com.android.settings": "设置",
  "com.android.incallui": "电话",
  "com.android.deskclock": "时钟",
  "com.android.mms": "短信",
  "com.android.fileexplorer": "文件管理",
};

function resolvePhoneDataDir(config) {
  return config.stateDir;
}

function resolveAppName(pkg) {
  return PKG_NAMES[pkg] || pkg;
}

// 计算北京时间的当天 0 点（ms）
function beijingMidnightMs() {
  const now = Date.now();
  return now - ((now + 8 * 3600000) % 86400000);
}

// 从事件列表聚合出每个 app 的使用时长
// 事件类型: 1=MOVE_TO_FOREGROUND, 2=MOVE_TO_BACKGROUND
function aggregateEvents(events, sinceMs, untilMs) {
  const byPkg = {};
  for (const e of events) {
    const t = parseInt(e.time);
    if (isNaN(t) || t < sinceMs || t > untilMs) continue;

    let list = byPkg[e.pkg];
    if (!list) { list = []; byPkg[e.pkg] = list; }
    list.push({ type: parseInt(e.type), time: t });
  }

  const apps = [];
  for (const [pkg, evts] of Object.entries(byPkg)) {
    evts.sort((a, b) => a.time - b.time);
    let totalMs = 0;
    let fgTime = null;

    for (const e of evts) {
      if (e.type === 1) {
        fgTime = e.time;
      } else if (e.type === 2 && fgTime !== null) {
        totalMs += e.time - fgTime;
        fgTime = null;
      }
    }
    // 未关闭的前台事件计算到 untilMs
    if (fgTime !== null) totalMs += untilMs - fgTime;

    if (totalMs > 0) {
      apps.push({ packageName: pkg, appName: resolveAppName(pkg), durationMs: totalMs });
    }
  }

  apps.sort((a, b) => b.durationMs - a.durationMs);
  return apps;
}

function readPhoneLocation(config) {
  const filePath = path.join(resolvePhoneDataDir(config), "locations.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) return data[data.length - 1];
    if (data && data.lat !== undefined) return data;
    return null;
  } catch {
    return null;
  }
}

function readPhoneUsage(config, { hours = 24, type = "accumulated" } = {}) {
  const filePath = path.join(resolvePhoneDataDir(config), "phone-usage.json");
  if (!fs.existsSync(filePath)) {
    return { apps: [], lastReported: null, totalMs: 0, hours };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const events = data.events || [];
    if (!events.length) {
      return { apps: [], lastReported: data.lastReported || null, totalMs: 0, hours };
    }

    const now = Date.now();
    let apps;

    if (type === "snapshots") {
      const cutoff = now - hours * 3600 * 1000;
      apps = aggregateEvents(events, cutoff, now);
    } else {
      // accumulated：北京时间今天 0 点到 now
      apps = aggregateEvents(events, beijingMidnightMs(), now);
    }

    const totalMs = apps.reduce((s, a) => s + a.durationMs, 0);
    return { apps, lastReported: data.lastReported || null, totalMs, hours };
  } catch {
    return { apps: [], lastReported: null, totalMs: 0, hours };
  }
}

function savePhoneReport(config, report) {
  const dir = resolvePhoneDataDir(config);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const usageFile = path.join(dir, "phone-usage.json");

  // 事件数据
  if (report.events && Array.isArray(report.events)) {
    let usageData = { events: [], lastReported: null, date: "" };
    if (fs.existsSync(usageFile)) {
      try { usageData = JSON.parse(fs.readFileSync(usageFile, "utf8")); } catch {}
    }

    const beijingNow = new Date(new Date(now).getTime() + 8 * 3600000);
    const today = beijingNow.toISOString().slice(0, 10);

    // 换日清空
    if (usageData.date !== today) {
      usageData = { events: [], lastReported: null, date: today };
    }

    // 增量追加新事件（手机每次传上次同步以来的增量）

    // 按包名+类型+时间戳去重
    const existingKeys = new Set(usageData.events.map(e => `${e.pkg}|${e.type}|${e.time}`));
    for (const e of report.events) {
      const key = `${e.pkg}|${e.type}|${e.time}`;
      if (!existingKeys.has(key)) {
        usageData.events.push({ pkg: e.pkg, type: e.type, time: e.time });
        existingKeys.add(key);
      }
    }

    // 只保留最近 2 天的事件
    const cutoff = Date.now() - 2 * 86400 * 1000;
    usageData.events = usageData.events.filter(e => parseInt(e.time) > cutoff);
    usageData.lastReported = now;
    usageData.date = today;

    fs.writeFileSync(usageFile, JSON.stringify(usageData, null, 2));
  }

  // 位置数据（保持原逻辑）
  if (report.location && report.location.lat !== undefined) {
    const locFile = path.join(dir, "locations.json");
    let locations = [];
    if (fs.existsSync(locFile)) {
      try { locations = JSON.parse(fs.readFileSync(locFile, "utf8")); } catch {}
      if (!Array.isArray(locations)) locations = [];
    }
    locations.push({
      lat: report.location.lat,
      lng: report.location.lng,
      accuracy: report.location.accuracy || null,
      timestamp: now,
    });
    if (locations.length > 200) locations = locations.slice(-200);
    fs.writeFileSync(locFile, JSON.stringify(locations, null, 2));
  }
}

async function phoneRoutes(app) {
  app.post("/api/phone/report", async (req, reply) => {
    const body = req.body || {};
    if (!body.events && !body.location) {
      reply.code(400);
      return { message: "至少需要 events 或 location 字段" };
    }
    savePhoneReport(app.config, body);
    return { ok: true, timestamp: new Date().toISOString() };
  });

  app.get("/api/phone/usage", async (req) => {
    const hours = Math.max(1, Math.min(168, Number(req.query?.hours) || 24));
    const type = req.query?.type === "snapshots" ? "snapshots" : "accumulated";
    return readPhoneUsage(app.config, { hours, type });
  });

  app.get("/api/phone/location", async () => {
    const loc = readPhoneLocation(app.config);
    if (!loc) return { location: null };
    return { location: { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, timestamp: loc.timestamp } };
  });
}

module.exports = phoneRoutes;
