// TCDD Bilet Avcısı - Popup Controller
document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const fromInput = document.getElementById("fromStationInput");
  const toInput = document.getElementById("toStationInput");
  const fromDropdown = document.getElementById("fromStationDropdown");
  const toDropdown = document.getElementById("toStationDropdown");
  const swapBtn = document.getElementById("swapStationsBtn");

  const tabSingleDate = document.getElementById("tabSingleDate");
  const tabDateRange = document.getElementById("tabDateRange");
  const singleDateRow = document.getElementById("singleDateRow");
  const rangeDateRow = document.getElementById("rangeDateRow");
  const startDateInput = document.getElementById("startDateInput");
  const rangeStartInput = document.getElementById("rangeStartInput");
  const rangeEndInput = document.getElementById("rangeEndInput");

  const intervalSelect = document.getElementById("intervalSelect");
  const timeFilterSelect = document.getElementById("timeFilterSelect");
  const minSeatsInput = document.getElementById("minSeatsInput");
  const wagonTypeSelect = document.getElementById("wagonTypeSelect");
  const soundToggle = document.getElementById("soundToggle");
  const testSoundBtn = document.getElementById("testSoundBtn");

  const toggleTrackingBtn = document.getElementById("toggleTrackingBtn");
  const manualCheckBtn = document.getElementById("manualCheckBtn");

  const headerStatusDot = document.getElementById("headerStatusDot");
  const appStatusBadge = document.getElementById("appStatusBadge");
  const lastScanTime = document.getElementById("lastScanTime");
  const countdownVal = document.getElementById("countdownVal");
  const totalScannedCount = document.getElementById("totalScannedCount");

  const foundCountBadge = document.getElementById("foundCountBadge");
  const foundList = document.getElementById("foundList");
  const emptyPlaceholder = document.getElementById("emptyPlaceholder");

  const logsConsole = document.getElementById("logsConsole");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  let isTracking = false;
  let dateMode = "single";
  let countdownInterval = null;

  const getTodayStr = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const today = getTodayStr(0);
  const defaultRangeEnd = getTodayStr(2);

  // Tarih çözümleyici: YYYY-MM-DD ve DD.MM.YYYY formatlarını kesin çözer
  const parseDateStr = (str) => {
    if (!str) return null;
    let m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = String(str).trim().match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  };

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const isPastDate = (val) => {
    if (!val) return true;
    const d = parseDateStr(val);
    if (!d || isNaN(d.getTime())) return true;
    d.setHours(0, 0, 0, 0);
    return d.getTime() < todayDate.getTime();
  };

  const formatDateToIso = (val, fallback) => {
    if (!val) return fallback;
    const d = parseDateStr(val);
    if (!d || isNaN(d.getTime())) return fallback;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Açılışta anında bugünün tarihini kutucuklara yerleştir
  startDateInput.min = today;
  rangeStartInput.min = today;
  rangeEndInput.min = today;
  startDateInput.value = today;
  rangeStartInput.value = today;
  rangeEndInput.value = defaultRangeEnd;

  // Tek tıkla eklentiyi yeniden başlatma butonu (Uzantılar sayfasına gitme zorunluluğunu kaldırır)
  const quickReloadBtn = document.getElementById("quickReloadBtn");
  if (quickReloadBtn) {
    quickReloadBtn.addEventListener("click", () => {
      quickReloadBtn.classList.add("spinning");
      quickReloadBtn.innerHTML = '<span class="reload-icon">🔄</span> Yenileniyor...';
      setTimeout(() => {
        chrome.runtime.reload();
      }, 120);
    });
  }

  // Load stored configuration
  const stored = await chrome.storage.local.get([
    "isTracking",
    "fromStation",
    "toStation",
    "dateMode",
    "startDate",
    "rangeStart",
    "rangeEnd",
    "interval",
    "timeFilter",
    "minSeats",
    "wagonType",
    "soundEnabled",
    "lastScanTime",
    "nextScanTimestamp",
    "totalScannedCount",
    "foundTickets",
    "logs"
  ]);

  fromInput.value = stored.fromStation || "ANKARA GAR";
  toInput.value = stored.toStation || "İSTANBUL(SÖĞÜTLÜÇEŞME)";

  dateMode = stored.dateMode || "single";

  // Dinamik Güncel Gün Kontrolü:
  // Eğer depodaki tarih geçmişte (dünde) kalmışsa veya boşsa dinamik olarak BUGÜNE (güncel güne) eşitlenir!
  let effectiveStartDate = isPastDate(stored.startDate) ? today : formatDateToIso(stored.startDate, today);
  let effectiveRangeStart = isPastDate(stored.rangeStart) ? today : formatDateToIso(stored.rangeStart, today);

  let effectiveRangeEnd = formatDateToIso(stored.rangeEnd, defaultRangeEnd);
  if (isPastDate(effectiveRangeEnd) || effectiveRangeEnd < effectiveRangeStart) {
    effectiveRangeEnd = defaultRangeEnd >= effectiveRangeStart ? defaultRangeEnd : effectiveRangeStart;
  }

  startDateInput.min = today;
  rangeStartInput.min = today;
  rangeEndInput.min = effectiveRangeStart;

  startDateInput.value = effectiveStartDate;
  rangeStartInput.value = effectiveRangeStart;
  rangeEndInput.value = effectiveRangeEnd;

  // Eğer dünün tarihi güncel güne çekildiyse depoya hemen yansıt
  if (stored.startDate !== effectiveStartDate || stored.rangeStart !== effectiveRangeStart || stored.rangeEnd !== effectiveRangeEnd) {
    chrome.storage.local.set({
      startDate: effectiveStartDate,
      rangeStart: effectiveRangeStart,
      rangeEnd: effectiveRangeEnd
    });
  }

  intervalSelect.value = stored.interval || "10";
  timeFilterSelect.value = stored.timeFilter || "all";
  minSeatsInput.value = stored.minSeats || "1";
  wagonTypeSelect.value = stored.wagonType || "all";
  soundToggle.checked = stored.soundEnabled !== undefined ? stored.soundEnabled : true;

  isTracking = Boolean(stored.isTracking);

  setDateMode(dateMode);
  updateTrackingUI(isTracking);
  if (stored.lastScanTime) lastScanTime.textContent = stored.lastScanTime;
  if (stored.totalScannedCount !== undefined) totalScannedCount.textContent = `${stored.totalScannedCount} Sefer`;
  renderFoundTickets(stored.foundTickets || []);
  renderLogs(stored.logs || []);

  startCountdownTimer();

  function setDateMode(mode) {
    dateMode = mode;
    if (mode === "single") {
      tabSingleDate.classList.add("active");
      tabDateRange.classList.remove("active");
      singleDateRow.classList.remove("hidden");
      rangeDateRow.classList.add("hidden");
    } else {
      tabSingleDate.classList.remove("active");
      tabDateRange.classList.add("active");
      singleDateRow.classList.add("hidden");
      rangeDateRow.classList.remove("hidden");
    }
    saveCurrentConfig();
  }

  tabSingleDate.addEventListener("click", () => setDateMode("single"));
  tabDateRange.addEventListener("click", () => setDateMode("range"));

  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      fromInput.value = btn.dataset.from;
      toInput.value = btn.dataset.to;
      fromDropdown.classList.add("hidden");
      toDropdown.classList.add("hidden");
      saveCurrentConfig();
      addLog(`Hızlı rota seçildi: ${btn.dataset.from} ➔ ${btn.dataset.to}`, "info");
    });
  });

  swapBtn.addEventListener("click", () => {
    const temp = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = temp;
    saveCurrentConfig();
  });

  function resolveExactStation(val) {
    if (!val) return "";
    const clean = val.trim();
    const norm = normalizeTr(clean);
    
    if (norm === "ankara") return "ANKARA GAR";
    if (norm === "yozgat") return "YOZGAT";
    if (norm === "sivas") return "SİVAS";
    if (norm === "eskisehir") return "ESKİŞEHİR";
    if (norm === "konya") return "KONYA";
    if (norm === "karaman") return "KARAMAN";
    if (norm === "istanbul") return "İSTANBUL(SÖĞÜTLÜÇEŞME)";

    const results = searchStations(clean);
    if (results.length > 0) {
      const exact = results.find(s => normalizeTr(s.name) === norm || normalizeTr(s.city) === norm);
      return exact ? exact.name : results[0].name;
    }
    return clean.toUpperCase();
  }

  function setupAutocomplete(input, dropdown) {
    let activeIdx = -1;

    const showMatches = () => {
      const q = input.value.trim();
      const results = searchStations(q);
      renderDropdown(results, dropdown, input);
    };

    input.addEventListener("input", showMatches);
    input.addEventListener("focus", () => {
      input.select();
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        dropdown.classList.add("hidden");
        const resolved = resolveExactStation(input.value);
        if (resolved && input.value.trim().length > 1) {
          input.value = resolved;
          saveCurrentConfig();
        }
      }, 200);
    });

    input.addEventListener("keydown", (e) => {
      const items = dropdown.querySelectorAll(".autocomplete-item");
      if (dropdown.classList.contains("hidden") || items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIdx = (activeIdx + 1) % items.length;
        updateActiveItem(items, activeIdx);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx = (activeIdx - 1 + items.length) % items.length;
        updateActiveItem(items, activeIdx);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < items.length) {
          items[activeIdx].dispatchEvent(new MouseEvent("mousedown"));
        } else if (items.length > 0) {
          items[0].dispatchEvent(new MouseEvent("mousedown"));
        }
      } else if (e.key === "Escape") {
        dropdown.classList.add("hidden");
      }
    });

    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  function updateActiveItem(items, activeIdx) {
    items.forEach((item, idx) => {
      if (idx === activeIdx) {
        item.classList.add("active");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active");
      }
    });
  }

  function renderDropdown(items, dropdown, input) {
    dropdown.innerHTML = "";
    if (!items || items.length === 0) {
      dropdown.classList.add("hidden");
      return;
    }

    items.slice(0, 8).forEach(item => {
      const el = document.createElement("div");
      el.className = "autocomplete-item";
      el.innerHTML = `
        <span class="station-name">${item.name}</span>
        <span class="city-tag">${item.city}</span>
      `;

      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = item.name;
        dropdown.classList.add("hidden");
        saveCurrentConfig();
      });

      dropdown.appendChild(el);
    });

    dropdown.classList.remove("hidden");
  }

  setupAutocomplete(fromInput, fromDropdown);
  setupAutocomplete(toInput, toDropdown);

  startDateInput.addEventListener("change", () => {
    const curToday = getTodayStr(0);
    if (startDateInput.value < curToday) {
      startDateInput.value = curToday;
    }
  });

  rangeStartInput.addEventListener("change", () => {
    const curToday = getTodayStr(0);
    if (rangeStartInput.value < curToday) {
      rangeStartInput.value = curToday;
    }
    rangeEndInput.min = rangeStartInput.value;
    if (rangeEndInput.value < rangeStartInput.value) {
      rangeEndInput.value = rangeStartInput.value;
    }
  });

  [
    fromInput, toInput, startDateInput, rangeStartInput, rangeEndInput,
    intervalSelect, timeFilterSelect, minSeatsInput, wagonTypeSelect, soundToggle
  ].forEach(el => {
    el.addEventListener("change", saveCurrentConfig);
  });

  function getCurrentConfig() {
    return {
      fromStation: fromInput.value.trim(),
      toStation: toInput.value.trim(),
      dateMode,
      startDate: startDateInput.value,
      rangeStart: rangeStartInput.value,
      rangeEnd: rangeEndInput.value,
      interval: intervalSelect.value,
      timeFilter: timeFilterSelect.value,
      minSeats: parseInt(minSeatsInput.value, 10) || 1,
      wagonType: wagonTypeSelect.value,
      soundEnabled: soundToggle.checked
    };
  }

  function saveCurrentConfig() {
    chrome.storage.local.set(getCurrentConfig());
  }

  // Toggle Tracking
  toggleTrackingBtn.addEventListener("click", async () => {
    fromInput.value = resolveExactStation(fromInput.value);
    toInput.value = resolveExactStation(toInput.value);
    saveCurrentConfig();

    const currentFrom = fromInput.value.trim();
    const currentTo = toInput.value.trim();

    if (!currentFrom || !currentTo) {
      alert("Lütfen kalkış ve varış istasyonlarını seçin.");
      return;
    }
    if (currentFrom === currentTo) {
      alert("Kalkış ve varış istasyonları aynı olamaz.");
      return;
    }

    if (!isTracking) {
      isTracking = true;
      updateTrackingUI(true);
      addLog(`Otomatik takip başlatıldı: ${currentFrom} ➔ ${currentTo} (${intervalSelect.value} dakikada bir kontrol edilecek)`, "info");
      
      const config = getCurrentConfig();
      await chrome.storage.local.set({
        ...config,
        fromStation: currentFrom,
        toStation: currentTo,
        targetSearchRoute: {
          fromStation: currentFrom,
          toStation: currentTo,
          startDate: config.startDate,
          rangeStart: config.rangeStart,
          rangeEnd: config.rangeEnd,
          dateMode: config.dateMode,
          timestamp: Date.now()
        }
      });
      chrome.runtime.sendMessage({
        type: "START_TRACKING",
        config: config
      });

      // Also trigger immediate check on active TCDD tab
      sendDirectScanToTcddTab(config);
    } else {
      isTracking = false;
      updateTrackingUI(false);
      addLog("Takip durduruldu.", "warn");
      chrome.runtime.sendMessage({ type: "STOP_TRACKING" });
    }
  });

  // Manual Check (Her basıldığında günlüğü ve eski sonuçları tertemiz eder)
  manualCheckBtn.addEventListener("click", async () => {
    fromInput.value = resolveExactStation(fromInput.value);
    toInput.value = resolveExactStation(toInput.value);

    const config = getCurrentConfig();

    // 1. Hedef rotayı, tüm tarih ayarlarını ve anlık tarama isteğini tek seferde kaydet
    await chrome.storage.local.set({
      ...config,
      fromStation: config.fromStation,
      toStation: config.toStation,
      targetSearchRoute: {
        fromStation: config.fromStation,
        toStation: config.toStation,
        startDate: config.startDate,
        rangeStart: config.rangeStart,
        rangeEnd: config.rangeEnd,
        dateMode: config.dateMode,
        timestamp: Date.now()
      },
      foundTickets: [],
      logs: [],
      totalScannedCount: 0,
      shouldScanImmediately: Date.now()
    });
    renderFoundTickets([]);
    foundCountBadge.textContent = "0";
    totalScannedCount.textContent = "0 Sefer";
    logsConsole.innerHTML = '<div class="log-entry info">Canlı işlem günlüğü temizlendi. Yeni tarama başlatılıyor...</div>';

    addLog(`Manuel tarama başlatılıyor: ${fromInput.value} ➔ ${toInput.value} (${config.dateMode === 'range' ? config.rangeStart + ' - ' + config.rangeEnd : config.startDate})`, "info");
    manualCheckBtn.disabled = true;
    manualCheckBtn.textContent = "⏳ Taranıyor...";

    sendDirectScanToTcddTab(config);

    setTimeout(() => {
      manualCheckBtn.disabled = false;
      manualCheckBtn.textContent = "⚡ Şimdi Tara";
    }, 2500);
  });

  // Tarama Başlatıcı (TCDD sekmesini açar / öne getirir ve rotayı doğrulayıp başlatır)
  async function sendDirectScanToTcddTab(config) {
    chrome.tabs.query({}, (tabs) => {
      const tcddTab = tabs.find(t => t.url && t.url.includes("tcddtasimacilik.gov.tr"));
      if (tcddTab) {
        chrome.tabs.update(tcddTab.id, { active: true });
        // TCDD sekmesine rota kontrolü ve tarama emri gönder
        chrome.tabs.sendMessage(tcddTab.id, {
          type: "CHECK_OR_START_SEARCH",
          config: config
        }, (res) => {
          if (chrome.runtime.lastError) {
            chrome.tabs.update(tcddTab.id, { url: "https://ebilet.tcddtasimacilik.gov.tr/" });
          }
        });
      } else {
        // TCDD sekmesi açık değilse: Ana sayfayı aç (Arama formu burada doldurulur!)
        chrome.tabs.create({
          url: "https://ebilet.tcddtasimacilik.gov.tr/",
          active: true
        });
      }
    });
  }

  // Sound Test
  testSoundBtn.addEventListener("click", () => {
    addLog("Alarm sesi test ediliyor 🔔", "info");
    chrome.runtime.sendMessage({ type: "TEST_SOUND" });
  });

  // Clear Logs
  clearLogsBtn.addEventListener("click", () => {
    logsConsole.innerHTML = '<div class="log-entry info">Günlük temizlendi.</div>';
    chrome.storage.local.set({ logs: [] });
  });

  function updateTrackingUI(active) {
    if (active) {
      headerStatusDot.classList.add("active");
      appStatusBadge.textContent = "Takip Aktif";
      appStatusBadge.className = "badge active";

      toggleTrackingBtn.className = "primary-btn stop-state";
      toggleTrackingBtn.querySelector(".btn-icon").textContent = "⏹";
      toggleTrackingBtn.querySelector(".btn-text").textContent = "Takibi Durdur";
    } else {
      headerStatusDot.classList.remove("active");
      appStatusBadge.textContent = "Durduruldu";
      appStatusBadge.className = "badge";

      toggleTrackingBtn.className = "primary-btn start-state";
      toggleTrackingBtn.querySelector(".btn-icon").textContent = "▶";
      toggleTrackingBtn.querySelector(".btn-text").textContent = "Otomatik Takibi Başlat";
      countdownVal.textContent = "Durduruldu";
    }
  }

  function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(async () => {
      const data = await chrome.storage.local.get(["isTracking", "nextScanTimestamp", "lastScanTime", "totalScannedCount", "foundTickets"]);
      if (!data.isTracking || !data.nextScanTimestamp) {
        countdownVal.textContent = "-";
        return;
      }

      const diff = Math.max(0, Math.floor((data.nextScanTimestamp - Date.now()) / 1000));
      const mm = String(Math.floor(diff / 60)).padStart(2, "0");
      const ss = String(diff % 60).padStart(2, "0");
      countdownVal.textContent = `${mm}:${ss}`;

      if (data.lastScanTime) lastScanTime.textContent = data.lastScanTime;
      if (data.totalScannedCount !== undefined) totalScannedCount.textContent = `${data.totalScannedCount} Sefer`;
      if (data.foundTickets) renderFoundTickets(data.foundTickets);
    }, 1000);
  }

  function renderFoundTickets(tickets) {
    foundCountBadge.textContent = tickets.length;
    if (!tickets || tickets.length === 0) {
      foundList.innerHTML = "";
      foundList.appendChild(emptyPlaceholder);
      return;
    }

    foundList.innerHTML = "";
    tickets.forEach(t => {
      const card = document.createElement("div");
      card.className = "ticket-card";

      const isBus = (t.wagonType || t.targetWagon || "").toUpperCase().includes("BUS");
      const wagonLabel = isBus ? "BUSINESS" : "EKONOMİ";
      const btnClass = isBus ? "go-seat-btn business-btn" : "go-seat-btn economy-btn";
      const badgeStyle = isBus ? "background: #8957e5; color: #fff;" : "background: #238636; color: #fff;";

      card.innerHTML = `
        <div class="ticket-info">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span class="ticket-train">🚆 ${t.trainName || "YHT Treni"}</span>
            <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; ${badgeStyle}">${wagonLabel}</span>
          </div>
          <span class="ticket-meta">📅 <b>${t.date}</b> • 🕒 <b>${t.time}</b></span>
          <div style="margin-top: 4px; display: flex; align-items: center; gap: 8px;">
            <span class="ticket-seats">💺 <b>${t.availableSeats} Boş Koltuk</b></span>
            <span style="font-size: 12px; font-weight: 800; color: #ff7b72;">${t.price ? t.price : (isBus ? '₺910,00' : '₺605,00')}</span>
          </div>
        </div>
        <button type="button" class="${btnClass}" title="Doğrudan ${wagonLabel} koltuk haritasına git">
          ${isBus ? '🟣' : '🟢'} ${wagonLabel} Koltuğa Git ➔
        </button>
      `;

      card.querySelector("button").addEventListener("click", () => {
        chrome.runtime.sendMessage({
          type: "NAVIGATE_TO_TRAIN",
          train: t
        });
      });

      foundList.appendChild(card);
    });
  }

  function renderLogs(logs) {
    if (!logs || logs.length === 0) return;
    logsConsole.innerHTML = "";
    logs.slice(-20).forEach(log => {
      const div = document.createElement("div");
      div.className = `log-entry ${log.level || "info"}`;
      div.textContent = `${log.time} - ${log.text}`;
      logsConsole.appendChild(div);
    });
    logsConsole.scrollTop = logsConsole.scrollHeight;
  }

  function addLog(text, level = "info") {
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const div = document.createElement("div");
    div.className = `log-entry ${level}`;
    div.textContent = `${time} - ${text}`;
    logsConsole.appendChild(div);
    logsConsole.scrollTop = logsConsole.scrollHeight;

    chrome.storage.local.get(["logs"], (res) => {
      const logs = res.logs || [];
      logs.push({ time, text, level });
      if (logs.length > 50) logs.shift();
      chrome.storage.local.set({ logs });
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATUS_UPDATE") {
      if (msg.lastScanTime) lastScanTime.textContent = msg.lastScanTime;
      if (msg.totalScannedCount !== undefined) totalScannedCount.textContent = `${msg.totalScannedCount} Sefer`;
      if (msg.foundTickets) renderFoundTickets(msg.foundTickets);
      if (msg.log) addLog(msg.log.text, msg.log.level);
    }
  });

  // ---------- GitHub Otomatik Sürüm Takipçisi ----------
  const GITHUB_REPO = "nicotin66/tcdd-bilet-asistani";
  const CURRENT_VERSION = "1.0.1";

  async function checkGitHubUpdates() {
    const banner = document.getElementById("githubUpdateBanner");
    const verTag = document.getElementById("updateVerTag");
    const changelog = document.getElementById("updateChangelog");
    const downloadBtn = document.getElementById("btnUpdateNow");
    const dismissBtn = document.getElementById("btnUpdateDismiss");

    if (!banner) return;

    if (dismissBtn) {
      dismissBtn.onclick = () => {
        banner.classList.add("hidden");
        sessionStorage.setItem("dismissed_update_banner", "true");
      };
    }

    if (sessionStorage.getItem("dismissed_update_banner")) return;

    try {
      const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json?_t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();

      if (data && data.version && isNewerVersion(data.version, CURRENT_VERSION)) {
        if (verTag) verTag.textContent = `v${data.version}`;
        if (changelog) changelog.textContent = data.changelog || "Yeni güncellemeler hazır.";
        banner.classList.remove("hidden");

        if (downloadBtn) {
          downloadBtn.onclick = () => {
            chrome.tabs.create({ url: data.downloadUrl || `https://github.com/${GITHUB_REPO}` });
          };
        }
      }
    } catch (e) {
      // Çevrimdışı veya repo henüz açılmadıysa sessiz kal
    }
  }

  function isNewerVersion(remote, local) {
    const rParts = String(remote).replace(/^v/, "").split(".").map(Number);
    const lParts = String(local).replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
      const r = rParts[i] || 0;
      const l = lParts[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  }

  checkGitHubUpdates();
});
