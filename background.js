// TCDD Bilet Avcısı - Background Service Worker (Manifest V3)
// Tarama artık SAYFA AÇMADAN yapılır: TCDD sitesinin kendi sefer sorgusu bir kez
// yakalanır (page_hook.js) ve arka planda her gün için tekrar gönderilir.
const ALARM_NAME = "TCDD_CHECK_ALARM";
const TCDD_ORIGIN = "https://ebilet.tcddtasimacilik.gov.tr";
let activeTicketForNotification = null;
let apiScanRunning = false;

// ---------- Kurulum ----------
chrome.runtime.onInstalled.addListener(async () => {
  console.log("TCDD Bilet Avcısı yüklendi.");
  const existing = await chrome.storage.local.get(["interval", "soundEnabled"]);
  if (existing.interval === undefined) {
    chrome.storage.local.set({
      interval: "10",
      soundEnabled: true,
      minSeats: 1,
      isTracking: false,
      foundTickets: [],
      logs: []
    });
  }
  setupHeaderRules();
});
chrome.runtime.onStartup.addListener(setupHeaderRules);
setupHeaderRules();

// Eklentiden giden isteklere TCDD sitesinin Origin/Referer bilgisini ekle
async function setupHeaderRules() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1],
      addRules: [{
        id: 1,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "Origin", operation: "set", value: TCDD_ORIGIN },
            { header: "Referer", operation: "set", value: TCDD_ORIGIN + "/" }
          ]
        },
        condition: {
          urlFilter: "||tcddtasimacilik.gov.tr",
          initiatorDomains: [chrome.runtime.id],
          resourceTypes: ["xmlhttprequest", "other"]
        }
      }]
    });
  } catch (e) {
    console.warn("Header kuralı eklenemedi:", e);
  }
}

// ---------- Alarm ----------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const data = await chrome.storage.local.get(["isTracking", "interval"]);
  if (data.isTracking) {
    const intervalMinutes = parseInt(data.interval || "10", 10);
    chrome.storage.local.set({ nextScanTimestamp: Date.now() + intervalMinutes * 60000 });
    runScanProcess();
  }
});

// ---------- Mesajlar ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "START_TRACKING":
      handleStartTracking(message.config);
      sendResponse({ success: true });
      break;
    case "STOP_TRACKING":
      handleStopTracking();
      sendResponse({ success: true });
      break;
    case "TRIGGER_MANUAL_CHECK":
      runScanProcess(message.config, sender.tab);
      sendResponse({ success: true });
      break;
    case "TEST_SOUND":
      playAlarmSound();
      sendResponse({ success: true });
      break;
    case "SCAN_RESULTS":
      handleScanResults(message.results, sender.tab);
      sendResponse({ success: true });
      break;
    case "NAVIGATE_TO_TRAIN":
      navigateToTrain(message.train);
      sendResponse({ success: true });
      break;
    case "API_CAPTURED":
      handleApiCaptured(message.capture);
      sendResponse({ success: true });
      break;
    case "RELOAD_EXTENSION":
      console.log("🔄 RELOAD_EXTENSION mesajı alındı, eklenti yeniden başlatılıyor...");
      sendResponse({ success: true });
      setTimeout(() => { chrome.runtime.reload(); }, 100);
      break;
    default:
      break;
  }
  return true;
});

async function handleStartTracking(config) {
  const intervalMinutes = Math.max(1, parseInt(config.interval || "10", 10));
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: intervalMinutes, periodInMinutes: intervalMinutes });
  await chrome.storage.local.set({ isTracking: true, nextScanTimestamp: Date.now() + intervalMinutes * 60000 });
  runScanProcess(config);
}

async function handleStopTracking() {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.set({ isTracking: false, nextScanTimestamp: null });
}

// ---------- Yakalanan API şablonu ----------
async function handleApiCaptured(capture) {
  if (!capture || !capture.url) return;
  let bodyObj = null;
  try { bodyObj = capture.body ? JSON.parse(capture.body) : null; } catch (e) {}
  if (!bodyObj) return;

  const headers = {};
  Object.keys(capture.headers || {}).forEach(k => {
    const lk = k.toLowerCase();
    if (["content-length", "host", "origin", "referer", "cookie", "user-agent"].includes(lk)) return;
    headers[k] = capture.headers[k];
  });
  if (!Object.keys(headers).some(k => k.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  const route = (bodyObj.searchRoutes && bodyObj.searchRoutes[0]) || {};
  const from = route.departureStationName || null;
  const to = route.arrivalStationName || null;

  const toSave = {
    apiTemplate: { url: capture.url, method: capture.method || "POST", headers, body: bodyObj, savedAt: Date.now() }
  };
  if (from && to) {
    toSave.apiRoute = { from, to };
    toSave.fromStation = from;
    toSave.toStation = to;
  }
  if (capture.response) toSave.apiResponseSample = capture.response.slice(0, 20000);
  await chrome.storage.local.set(toSave);
  console.log("✅ TCDD sefer sorgusu yakalandı, arka plan taraması hazır:", from, "➔", to);
}

// Helper: Tarih formatlayıcı
function getTodayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------- Tarama ----------
async function runScanProcess(passedConfig, senderTab) {
  const stored = await chrome.storage.local.get([
    "fromStation", "toStation", "dateMode", "startDate", "rangeStart", "rangeEnd",
    "timeFilter", "minSeats", "wagonType", "soundEnabled"
  ]);
  const config = Object.assign({}, stored, passedConfig || {});

  // Dinamik güncel gün kontrolü: Eğer tarihler dünde kalmışsa bugüne güncelle!
  const today = getTodayStr(0);
  let datesUpdated = false;
  if (!config.startDate || config.startDate < today) {
    config.startDate = today;
    datesUpdated = true;
  }
  if (!config.rangeStart || config.rangeStart < today) {
    config.rangeStart = today;
    datesUpdated = true;
  }
  if (!config.rangeEnd || config.rangeEnd < config.rangeStart) {
    config.rangeEnd = getTodayStr(2);
    datesUpdated = true;
  }
  if (datesUpdated) {
    chrome.storage.local.set({
      startDate: config.startDate,
      rangeStart: config.rangeStart,
      rangeEnd: config.rangeEnd
    });
  }

  // Açık TCDD sekmesi varsa öne getir ve rotayı kontrol ederek tara
  const allTabs = await chrome.tabs.query({});
  const tcddTab = senderTab || allTabs.find(t => t.url && t.url.includes("tcddtasimacilik.gov.tr"));
  if (tcddTab) {
    chrome.tabs.update(tcddTab.id, { active: true });
    chrome.tabs.sendMessage(tcddTab.id, { type: "CHECK_OR_START_SEARCH", config }).catch(() => {});
    return;
  }

  // TCDD sekmesi açık değilse ana sayfayı aç ve taramayı hazırla!
  await chrome.storage.local.set({
    targetSearchRoute: {
      fromStation: config.fromStation,
      toStation: config.toStation,
      timestamp: Date.now()
    },
    shouldScanImmediately: Date.now()
  });
  chrome.tabs.create({ url: "https://ebilet.tcddtasimacilik.gov.tr/", active: true });
}

function buildDateList(config) {
  const parse = (s) => {
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  };
  const list = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (config.dateMode === "range" && config.rangeStart && config.rangeEnd) {
    let s = parse(config.rangeStart), e = parse(config.rangeEnd);
    if (s && s < today) s = new Date(today);
    if (e && e < s) e = new Date(s);
    if (s && e) {
      for (let d = new Date(s); d <= e && list.length < 31; d.setDate(d.getDate() + 1)) list.push(new Date(d));
    }
  } else {
    let d = parse(config.startDate);
    if (d && d < today) d = new Date(today);
    if (d) list.push(d);
  }
  return list;
}

const pad = n => String(n).padStart(2, "0");

function setDateInRoute(route, d) {
  const out = JSON.parse(JSON.stringify(route));
  const walk = (obj) => {
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v && typeof v === "object") return walk(v);
      if (typeof v !== "string" || !/date/i.test(k)) return;
      let m = v.match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);
      if (m) { obj[k] = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}${m[4]}`; return; }
      m = v.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
      if (m) { obj[k] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${m[4]}`; return; }
      m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})(.*)$/);
      if (m) { obj[k] = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}${m[4]}`; }
    });
  };
  walk(out);
  return out;
}

async function runApiScan(config, tpl) {
  if (apiScanRunning) return;
  apiScanRunning = true;
  const dates = buildDateList(config);
  const allFound = [];
  let totalTrains = 0;
  let failed = 0;

  try {
    await chrome.storage.local.set({ foundTickets: [] });
    broadcast({ type: "SCAN_PROGRESS", text: `🔎 Arka planda taranıyor (${dates.length} gün)...` });

    for (const d of dates) {
      const dateStr = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
      broadcast({ type: "SCAN_PROGRESS", text: `📅 ${dateStr} sorgulanıyor...` });

      const body = JSON.parse(JSON.stringify(tpl.body));
      if (Array.isArray(body.searchRoutes) && body.searchRoutes.length) {
        body.searchRoutes = [setDateInRoute(body.searchRoutes[0], d)];
      } else {
        Object.assign(body, setDateInRoute(body, d));
      }

      try {
        const res = await fetch(tpl.url, {
          method: tpl.method || "POST",
          headers: tpl.headers,
          body: JSON.stringify(body),
          credentials: "include"
        });
        if (res.status === 401 || res.status === 403) {
          failed++;
          await pushLog(`⚠️ ${dateStr}: TCDD erişimi reddetti (${res.status}). TCDD sitesinde güzergahı bir kez yeniden aratın.`, "warn");
          continue;
        }
        if (!res.ok) {
          // Sefer olmayan günlerde TCDD hata dönebilir
          continue;
        }
        const json = await res.json();
        const parsed = parseAvailability(json, dateStr, config, body);
        totalTrains += parsed.totalTrains;
        allFound.push(...parsed.found);
        if (parsed.found.length) {
          await chrome.storage.local.set({ foundTickets: allFound });
          broadcast({ type: "STATUS_UPDATE", foundTickets: allFound });
        }
      } catch (e) {
        failed++;
        console.warn("API isteği hatası:", e);
      }
      await new Promise(r => setTimeout(r, 400));
    }

    if (failed === dates.length && dates.length > 0) {
      await pushLog("❌ Arka plan sorgusu başarısız. TCDD sitesinde güzergahınızı bir kez yeniden aratın.", "error");
    }
    await handleScanResults({ totalTrains, foundTickets: allFound }, null);
  } finally {
    apiScanRunning = false;
  }
}

// ---------- API yanıtı çözümleme (esnek) ----------
function formatTime(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || /^\d{10,}$/.test(String(v))) {
    return new Date(Number(v)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${pad(m[1])}:${m[2]}` : "";
}

function formatPrice(p) {
  if (p === null || p === undefined) return "";
  if (typeof p === "object") p = p.priceAmount ?? p.amount ?? p.price ?? null;
  const n = Number(p);
  if (!isFinite(n) || n <= 0) return "";
  return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function collectTrains(json) {
  const trains = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    Object.keys(o).forEach(k => {
      if (k === "trains" && Array.isArray(o[k])) trains.push(...o[k]);
      else walk(o[k]);
    });
  };
  walk(json);
  if (trains.length) return trains;
  // Yedek: "segments" içeren nesneler tren kabul edilir
  const walk2 = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk2);
    if (Array.isArray(o.segments)) { trains.push(o); return; }
    Object.values(o).forEach(walk2);
  };
  walk2(json);
  return trains;
}

function stationId(seg, kind) {
  const s = seg.segment || seg;
  return s[`${kind}StationId`] ?? (s[`${kind}Station`] && s[`${kind}Station`].id) ?? null;
}

function parseAvailability(json, dateStr, config, reqBody) {
  const route = (reqBody.searchRoutes && reqBody.searchRoutes[0]) || {};
  const depId = route.departureStationId, arrId = route.arrivalStationId;
  const trains = collectTrains(json);
  const found = [];
  const minRequired = parseInt(config.minSeats || 1, 10);
  const wagonPref = config.wagonType || "all";

  trains.forEach((t, idx) => {
    const segs = Array.isArray(t.segments) ? t.segments : [];
    const depSeg = segs.find(s => depId && stationId(s, "departure") == depId) || segs[0] || {};
    const arrSeg = segs.find(s => arrId && stationId(s, "arrival") == arrId) || segs[segs.length - 1] || {};
    const depTime = formatTime(depSeg.departureTime ?? t.departureTime);
    const arrTime = formatTime(arrSeg.arrivalTime ?? t.arrivalTime);
    if (!depTime) return;

    // Saat filtresi
    const hour = parseInt(depTime.split(":")[0], 10);
    const tf = config.timeFilter || "all";
    if (tf === "morning" && (hour < 6 || hour >= 12)) return;
    if (tf === "afternoon" && (hour < 12 || hour >= 18)) return;
    if (tf === "evening" && hour < 18) return;

    const number = String(t.number ?? t.trainNumber ?? t.commercialNumber ?? "").trim();
    const type = t.type || t.trainType || "YHT";
    const name = t.commercialName || t.name || "";
    const trainName = `${typeof type === "string" ? type : "YHT"}: ${number} ${name}`.replace(/\s+/g, " ").trim();

    // Kabin sınıfları
    const cabins = {};
    const source = t.availableFareInfo || t;
    const walk = (o) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(walk);
      if (typeof o.availabilityCount === "number") {
        const cname = String((o.cabinClass && (o.cabinClass.name || o.cabinClass.code)) || o.cabinClassName || o.name || "").toUpperCase();
        // Engelli veya Tekerlekli Sandalye ise kesinlikle genel yolcu kontenjanına dahil etme
        if (cname.includes("TEKERLEK") || cname.includes("ENGEL") || cname.includes("HANDICAP") || o.isWheelchair || o.wheelchair) return;
        if (!o.cabinClass && !o.cabinClassName) return;

        let key = null;
        if (cname.includes("BUS")) key = "BUSINESS";
        else if (cname.includes("EKONOM") || cname.includes("PULMAN")) key = "EKONOMİ";
        if (key) {
          const prev = cabins[key] || { count: 0, price: null };
          const price = o.minPrice ?? o.price ?? null;
          cabins[key] = {
            count: Math.max(prev.count, o.availabilityCount),
            price: prev.price ?? price
          };
        }
      }
      Object.values(o).forEach(walk);
    };
    walk(source);

    [["EKONOMİ", "Ekonomi", "economy", "eko"], ["BUSINESS", "Business", "business", "bus"]].forEach(([key, label, pref, short]) => {
      const c = cabins[key];
      if (!c || c.count < minRequired) return;
      if (wagonPref !== "all" && wagonPref !== pref) return;
      found.push({
        id: `${dateStr}-${number || idx}-${short}`,
        trainNum: number,
        trainName,
        time: arrTime ? `${depTime} ➔ ${arrTime}` : depTime,
        date: dateStr,
        availableSeats: c.count,
        price: formatPrice(c.price) || (short === "bus" ? "₺910,00" : "₺605,00"),
        wagonType: label,
        targetWagon: key
      });
    });
  });

  return { totalTrains: trains.length, found };
}

// ---------- Sonuçlar ----------
async function pushLog(text, level = "info") {
  const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const { logs = [] } = await chrome.storage.local.get(["logs"]);
  logs.push({ time, text, level });
  await chrome.storage.local.set({ logs: logs.slice(-50) });
  broadcast({ type: "STATUS_UPDATE", log: { time, text, level } });
}

async function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
  try {
    const tabs = await chrome.tabs.query({ url: "https://*.tcddtasimacilik.gov.tr/*" });
    tabs.forEach(t => chrome.tabs.sendMessage(t.id, msg).catch(() => {}));
  } catch (e) {}
}

async function handleScanResults(results, sourceTab) {
  const scanTimeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const totalScanned = results.totalTrains || 0;
  const found = results.foundTickets || [];

  const storageData = await chrome.storage.local.get(["logs", "soundEnabled"]);
  const logs = storageData.logs || [];

  if (found.length > 0) {
    logs.push({
      time: scanTimeStr,
      text: `🎉 ${found.length} boş yer bulundu! İlk: ${found[0].date} ${found[0].trainName} (${found[0].time}) - ${found[0].availableSeats} koltuk`,
      level: "success"
    });
    activeTicketForNotification = found[0];
    showDesktopNotification(found[0], found.length);
    if (storageData.soundEnabled !== false) playAlarmSound();
  } else {
    logs.push({ time: scanTimeStr, text: `Tarama tamamlandı: ${totalScanned} sefer incelendi, boş yer bulunamadı.`, level: "info" });
  }

  await chrome.storage.local.set({
    foundTickets: found,
    lastScanTime: scanTimeStr,
    totalScannedCount: totalScanned,
    logs: logs.slice(-50)
  });

  broadcast({
    type: "STATUS_UPDATE",
    lastScanTime: scanTimeStr,
    totalScannedCount: totalScanned,
    foundTickets: found,
    scanDone: true,
    log: logs[logs.length - 1]
  });
}

function showDesktopNotification(ticket, totalFoundCount) {
  chrome.notifications.create("tcdd_ticket_found_" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `🚨 BOŞ KOLTUK BULUNDU! (${totalFoundCount} sonuç)`,
    message: `${ticket.date} | ${ticket.trainName} | ${ticket.time}\n${ticket.wagonType}: ${ticket.availableSeats} boş koltuk. Tıklayın, koltuk haritası açılsın.`,
    contextMessage: "TCDD Bilet Avcısı",
    priority: 2,
    requireInteraction: true
  });
}

chrome.notifications.onClicked.addListener(async (notifId) => {
  chrome.notifications.clear(notifId);
  if (notifId === "extension_update_ready") {
    console.log("🔄 Kullanıcı güncelleme bildirimine tıkladı, eklenti yeniden başlatılıyor...");
    chrome.runtime.reload();
    return;
  }
  if (notifId.startsWith("github_new_release_")) {
    chrome.tabs.create({ url: `https://github.com/nicotin66/tcdd-bilet-asistani` });
    return;
  }
  if (notifId.startsWith("tcdd_ticket_found_") && activeTicketForNotification) {
    navigateToTrain(activeTicketForNotification);
  } else {
    chrome.tabs.create({ url: TCDD_ORIGIN + "/" });
  }
});

// ---------- Otomatik Kod Güncelleme Algılayıcı (Hot-Reload) ----------
let lastBuildTime = 0;

async function checkForExtensionUpdates() {
  try {
    const res = await fetch(chrome.runtime.getURL(`build_info.json?_t=${Date.now()}`), { cache: "no-store" });
    if (!res.ok) return;
    const info = await res.json();
    if (!lastBuildTime) {
      lastBuildTime = info.buildTime || 0;
      return;
    }
    if (info.buildTime && info.buildTime !== lastBuildTime) {
      console.log("🚀 Yeni eklenti güncellemesi algılandı!", info);
      lastBuildTime = info.buildTime;

      chrome.notifications.create("extension_update_ready", {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "⚡ TCDD Bilet Avcısı Güncellendi!",
        message: "Yeni bir güncelleme hazır! Eklentiyi anında uygulamak için bu bildirime tıklayın.",
        contextMessage: "Uzantılar sayfasına gitmenize gerek yok",
        priority: 2,
        requireInteraction: true
      });
    }
  } catch (e) {}
}

setInterval(checkForExtensionUpdates, 3000);
checkForExtensionUpdates();

// ---------- GitHub Uzaktan Sürüm Takipçisi ----------
const GITHUB_REPO = "nicotin66/tcdd-bilet-asistani";
const CURRENT_VERSION = "1.0.1";

async function checkRemoteGitHubVersion() {
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json?_t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.version) return;

    const rParts = String(data.version).replace(/^v/, "").split(".").map(Number);
    const lParts = CURRENT_VERSION.replace(/^v/, "").split(".").map(Number);
    let isNewer = false;
    for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
      const r = rParts[i] || 0;
      const l = lParts[i] || 0;
      if (r > l) { isNewer = true; break; }
      if (r < l) { break; }
    }

    if (isNewer) {
      chrome.notifications.create("github_new_release_" + data.version, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: `🚀 TCDD Bilet Avcısı v${data.version} Yayınlandı!`,
        message: data.changelog || "Yeni güncelleme mevcut. İndirmek için tıklayın.",
        contextMessage: "GitHub Güncellemesi",
        priority: 2,
        requireInteraction: true
      });
    }
  } catch (e) {}
}

setInterval(checkRemoteGitHubVersion, 60 * 60 * 1000);
setTimeout(checkRemoteGitHubVersion, 5000);

// ---------- Koltuğa Git ----------
function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(l); resolve(); }, timeoutMs);
    const l = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(l);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(l);
  });
}

async function navigateToTrain(train) {
  const allTabs = await chrome.tabs.query({});
  let targetTab = allTabs.find(t => t.url && t.url.includes("tcddtasimacilik.gov.tr/sefer-listesi")) ||
                  allTabs.find(t => t.url && t.url.includes("tcddtasimacilik.gov.tr"));

  if (targetTab) {
    await chrome.tabs.update(targetTab.id, { active: true });
    try { await chrome.windows.update(targetTab.windowId, { focused: true }); } catch (e) {}
  } else {
    targetTab = await chrome.tabs.create({ url: "https://ebilet.tcddtasimacilik.gov.tr/", active: true });
    await waitForTabComplete(targetTab.id);
    await new Promise(r => setTimeout(r, 2000));
    try { await chrome.windows.update(targetTab.windowId, { focused: true }); } catch (e) {}
  }

  // İçerik betiği hazır olana kadar birkaç kez dene
  for (let i = 0; i < 10; i++) {
    try {
      const res = await chrome.tabs.sendMessage(targetTab.id, { type: "HIGHLIGHT_AND_SELECT_TRAIN", train });
      if (res && res.success) return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  console.warn("Koltuk seçimi mesajı iletilemedi.");
}

async function playAlarmSound() {
  try {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "TCDD boş koltuk alarm sesini çalmak için"
      });
    }
    chrome.runtime.sendMessage({ type: "PLAY_ALERT_SOUND" });
  } catch (err) {
    console.error("Offscreen ses çalma hatası:", err);
  }
}
