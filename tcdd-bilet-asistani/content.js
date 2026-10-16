// TCDD Bilet Avcısı - In-Page Content Script
(() => {
  console.log("⚡ TCDD Bilet Avcısı Content Script devrede.");
  console.log("content.js: v2.0.4 - Akıllı Çoklu Gün Tarayıcı Devrede");

  let isScanningInProgress = false;
  let lastScanStart = 0;
  let hasAutoScannedOnPageLoad = false;

  // Helper: Paneldeki 'Şimdi Tara' butonunu programatik olarak tetikle
  function triggerPanelScanBtn() {
    const scanBtn = document.getElementById("tcddPanelScanBtn");
    if (scanBtn && !scanBtn.disabled && !isScanningInProgress) {
      console.log("👉 Paneldeki '⚡ Şimdi Tara' butonuna otomatik tıklandı!");
      scanBtn.click();
      return true;
    }
    return false;
  }

  const getTodayStr = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const parseDateStr = (str) => {
    if (!str) return null;
    let m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = String(str).trim().match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  };

  const isPastDate = (val) => {
    if (!val) return true;
    const d = parseDateStr(val);
    if (!d || isNaN(d.getTime())) return true;
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < t.getTime();
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

  // Helper: Depodaki ayarları doğrudan paneldeki kutucuklara yansıt
  function applyConfigToPanelInputs(cfg) {
    if (!cfg) return;
    const fromEl = document.getElementById("tcddPanelFrom");
    const toEl = document.getElementById("tcddPanelTo");
    const rangeStartInput = document.getElementById("tcddRangeStart");
    const rangeEndInput = document.getElementById("tcddRangeEnd");
    const singleDateInput = document.getElementById("tcddSingleDate");
    const timeFilterSelect = document.getElementById("tcddTimeFilter");
    const wagonFilterSelect = document.getElementById("tcddWagonFilter");
    const tabSingle = document.getElementById("tcddTabSingle");
    const tabRange = document.getElementById("tcddTabRange");
    const singleRow = document.getElementById("tcddSingleRow");
    const rangeRow = document.getElementById("tcddRangeRow");

    const today = getTodayStr(0);

    if (fromEl && cfg.fromStation) fromEl.value = cfg.fromStation;
    if (toEl && cfg.toStation) toEl.value = cfg.toStation;

    let vStart = isPastDate(cfg.startDate) ? today : formatDateToIso(cfg.startDate, today);
    let vRangeStart = isPastDate(cfg.rangeStart) ? today : formatDateToIso(cfg.rangeStart, today);
    let vRangeEnd = formatDateToIso(cfg.rangeEnd, getTodayStr(2));
    if (isPastDate(vRangeEnd) || vRangeEnd < vRangeStart) {
      vRangeEnd = getTodayStr(2) >= vRangeStart ? getTodayStr(2) : vRangeStart;
    }

    if (singleDateInput) {
      singleDateInput.min = today;
      singleDateInput.value = vStart;
    }
    if (rangeStartInput) {
      rangeStartInput.min = today;
      rangeStartInput.value = vRangeStart;
    }
    if (rangeEndInput) {
      rangeEndInput.min = vRangeStart;
      rangeEndInput.value = vRangeEnd;
    }
    if (timeFilterSelect && cfg.timeFilter) timeFilterSelect.value = cfg.timeFilter;
    if (wagonFilterSelect && cfg.wagonType) wagonFilterSelect.value = cfg.wagonType;

    if (cfg.dateMode === "single") {
      if (tabSingle) tabSingle.classList.add("active");
      if (tabRange) tabRange.classList.remove("active");
      if (singleRow) singleRow.style.display = "flex";
      if (rangeRow) rangeRow.style.display = "none";
    } else {
      if (tabRange) tabRange.classList.add("active");
      if (tabSingle) tabSingle.classList.remove("active");
      if (singleRow) singleRow.style.display = "none";
      if (rangeRow) rangeRow.style.display = "flex";
    }
  }

  // Initialize In-Page Full Floating Control Panel
  initFullFloatingPanel();

  // page_hook.js'nin yakaladığı TCDD sefer sorgusunu arka plana ilet
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || !event.data.__tcddCapture) return;
    const d = event.data;
    chrome.runtime.sendMessage({
      type: "API_CAPTURED",
      capture: { url: d.url, method: d.method, headers: d.headers, body: d.body, response: d.response }
    }).catch(() => { });
    updatePanelStatus("✅ Arka plan taraması hazır (sayfa açmadan çalışır)", true);
  });

  // Handle /koltuk-haritasi if directly navigated (4. Görsel Kontrolü)
  if (window.location.pathname.includes("koltuk-haritasi")) {
    handleKoltukHaritasiPage();
  }

  // Message Listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "CHECK_OR_START_SEARCH":
        isScanningInProgress = false;
        hasAutoScannedOnPageLoad = false;
        if (window.location.pathname.includes("sefer-listesi")) {
          // Zaten sefer listesi sayfasındayız: Paneldeki bilgileri güncelle ve Şimdi Tara butonuna tıkla!
          chrome.storage.local.get(null, async (cfg) => {
            const activeCfg = Object.assign({}, cfg, message.config);
            applyConfigToPanelInputs(activeCfg);
            await sleep(300);
            triggerPanelScanBtn();
          });
        } else {
          checkAndExecuteRouteSearch(message.config).catch(err => {
            console.error("Arama kontrol hatası:", err);
          });
        }
        sendResponse({ started: true });
        break;

      case "TRIGGER_PAGE_SCAN":
        isScanningInProgress = false;
        const scanBtnEl = document.getElementById("tcddPanelScanBtn");
        if (scanBtnEl) {
          scanBtnEl.disabled = true;
          scanBtnEl.textContent = "⏳ Taranıyor...";
        }
        handlePageScan(message.config).finally(() => {
          if (scanBtnEl) {
            scanBtnEl.disabled = false;
            scanBtnEl.textContent = "⚡ Şimdi Tara";
          }
        });
        sendResponse({ started: true });
        break;

      case "HIGHLIGHT_AND_SELECT_TRAIN":
        highlightAndSelectTrain(message.train);
        sendResponse({ success: true });
        break;

      case "UPDATE_WIDGET_STATUS":
        updatePanelStatus(message.text, message.isActive);
        sendResponse({ success: true });
        break;

      case "SCAN_PROGRESS":
        updatePanelStatus(message.text, true);
        sendResponse({ success: true });
        break;

      case "STATUS_UPDATE":
        if (message.foundTickets) renderInPageTickets(message.foundTickets);
        if (message.lastScanTime) {
          const checkEl = document.getElementById("tcddPanelLastCheck");
          if (checkEl) checkEl.textContent = message.lastScanTime;
        }
        if (message.scanDone) {
          const n = (message.foundTickets || []).length;
          updatePanelStatus(n > 0 ? `🎉 <b>${n}</b> BOŞ YER BULUNDU!` : `${message.totalScannedCount || 0} sefer tarandı. Boş yer yok.`, n > 0);
        } else if (message.log && message.log.level !== "info") {
          updatePanelStatus(message.log.text, false);
        }
        sendResponse({ success: true });
        break;

      default:
        break;
    }
    return true;
  });

  // Storage listener: Eklenti popup'ından veya arka plandan anında tarama emri geldiğinde
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.shouldScanImmediately && changes.shouldScanImmediately.newValue) {
      console.log("⚡ Depodan anında tarama tetiklendi!");
      chrome.storage.local.get(null, (cfg) => {
        isScanningInProgress = false;
        if (window.location.pathname.includes("sefer-listesi")) {
          applyConfigToPanelInputs(cfg);
          setTimeout(() => {
            triggerPanelScanBtn();
          }, 300);
        } else {
          checkAndExecuteRouteSearch(cfg);
        }
      });
    }
  });

  // Sayfa Yüklendiğinde Otomatik İşlemler:
  // 1. Ana sayfadayken (ebilet.tcddtasimacilik.gov.tr/) bekleyen arama varsa otomatik doldur ve ara
  if (!window.location.pathname.includes("sefer-listesi") && !window.location.pathname.includes("koltuk-haritasi")) {
    chrome.storage.local.get(null, async (stored) => {
      const isRecentSearch = stored.targetSearchRoute && (Date.now() - stored.targetSearchRoute.timestamp < 90000);
      const isRecentManual = stored.shouldScanImmediately && (Date.now() - stored.shouldScanImmediately < 90000);

      if (isRecentSearch || isRecentManual) {
        const fromSt = (stored.targetSearchRoute ? stored.targetSearchRoute.fromStation : stored.fromStation) || "ANKARA GAR";
        const toSt = (stored.targetSearchRoute ? stored.targetSearchRoute.toStation : stored.toStation) || "YOZGAT YHT";

        console.log("⚡ Bekleyen hedef rota araması ana sayfada otomatik başlatılıyor:", fromSt, "➔", toSt);
        updatePanelStatus(`🔍 ${fromSt} ➔ ${toSt} aranıyor...`, true);

        // Sefer listesi açıldığında 'Şimdi Tara' butonuna otomatik basılması için işaret bırak:
        sessionStorage.setItem("tcdd_auto_scan_needed", "true");

        await sleep(700);
        await fillAndSubmitSearchForm(Object.assign({}, stored, {
          fromStation: fromSt,
          toStation: toSt
        }));
      }
    });
  }

  // Sayfa açıldığında otomatik oturum açma kontrolü
  setTimeout(() => {
    checkAndPerformAutoLogin();
  }, 1200);

  // Giriş penceresi açıldığında anında yakalayan gözlemci
  try {
    const loginModalObserver = new MutationObserver(() => {
      const hasLoginField = document.querySelector("input[type='password']");
      if (hasLoginField && !sessionStorage.getItem("tcdd_modal_login_triggered")) {
        sessionStorage.setItem("tcdd_modal_login_triggered", "true");
        setTimeout(() => {
          checkAndPerformAutoLogin();
          setTimeout(() => sessionStorage.removeItem("tcdd_modal_login_triggered"), 3000);
        }, 400);
      }
    });
    loginModalObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (e) { }

  // 2. Sefer listesi sayfasındayken: Bekleyen tren seçimi varsa aç
  if (window.location.pathname.includes("sefer-listesi")) {
    chrome.storage.local.get(["pendingTrainToSelect"], async (config) => {
      if (config.pendingTrainToSelect) {
        const trainToSelect = config.pendingTrainToSelect;
        await chrome.storage.local.remove(["pendingTrainToSelect"]);
        console.log("⏳ Bekleyen tren seçimi uygulanıyor:", trainToSelect);
        setTimeout(async () => {
          await waitForTrainsToLoad(4000);
          await highlightAndSelectTrain(trainToSelect);
        }, 200);
      }
    });
  }

  // 3. SPA (Vue Router) URL Değişikliği Gözlemcisi (Sayfa yenilenmeden /sefer-listesi açılırsa otomatik Şimdi Tara'ya bas!)
  let lastPathname = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPathname) {
      const oldPath = lastPathname;
      lastPathname = window.location.pathname;
      console.log(`🌐 SPA URL Değişimi: ${oldPath} ➔ ${lastPathname}`);
      setTimeout(checkAndPerformAutoLogin, 800);
      if (lastPathname.includes("sefer-listesi") && !isScanningInProgress) {
        chrome.storage.local.get(null, async (cfg) => {
          const isRecentManual = cfg.shouldScanImmediately && (Date.now() - cfg.shouldScanImmediately < 90000);
          const isRecentTarget = cfg.targetSearchRoute && (Date.now() - cfg.targetSearchRoute.timestamp < 90000);
          const isSessionNeeded = sessionStorage.getItem("tcdd_auto_scan_needed") === "true";
          if ((cfg.isTracking || isRecentManual || isRecentTarget || isSessionNeeded) && !hasAutoScannedOnPageLoad) {
            hasAutoScannedOnPageLoad = true;
            sessionStorage.removeItem("tcdd_auto_scan_needed");
            chrome.storage.local.remove(["shouldScanImmediately"]);
            console.log("🚀 SPA geçişi sonrası Şimdi Tara butonuna basılıyor...");
            await waitForTrainsToLoad(10000);
            await sleep(400);
            triggerPanelScanBtn();
          }
        });
      }
    }
  }, 400);

  // 1. IN-PAGE FULL FLOATING CONTROL PANEL
  function initFullFloatingPanel() {
    if (document.getElementById("tcdd-full-panel")) return;

    // Eski küçük widget varsa kaldır
    const oldWidget = document.getElementById("tcdd-hunter-widget");
    if (oldWidget) oldWidget.remove();
    const oldPill = document.getElementById("tcdd-reopen-pill");
    if (oldPill) oldPill.remove();

    const panel = document.createElement("div");
    panel.id = "tcdd-full-panel";
    panel.className = "tcdd-full-panel";
    panel.innerHTML = `
      <div class="tcdd-panel-header" id="tcddPanelHeader" style="cursor: move;">
        <div class="tcdd-panel-title">
          <span class="tcdd-panel-dot" id="tcddPanelDot"></span>
          <span>🚄 TCDD Bilet Avcısı</span>
        </div>
        <div class="tcdd-panel-actions">
          <button type="button" id="tcddPanelReloadBtn" title="Eklentiyi anında yeniden başlatır / günceller" style="background: rgba(56,139,253,0.18); border: 1px solid #388bfd; color: #58a6ff; border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer; font-weight: bold;">🔄 Yenile</button>
          <button type="button" id="tcddPanelMinBtn" title="Küçült / Büyüt">−</button>
          <button type="button" id="tcddPanelCloseBtn" title="Kapat">&times;</button>
        </div>
      </div>

      <div class="tcdd-panel-body" id="tcddPanelBody">
        <!-- Rota Bilgisi: Canlı Aranabilir & Seçilebilir İstasyonlar -->
        <div class="tcdd-route-bar" style="display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: #0d1117; border-radius: 6px; border: 1px solid #30363d; margin-bottom: 5px;">
          <input type="text" id="tcddPanelFrom" class="tcdd-route-input" list="tcddStationsDatalist" placeholder="Kalkış..." value="ANKARA GAR" style="flex: 1; min-width: 0; background: #161b22; border: 1px solid #30363d; color: #58a6ff; font-weight: bold; font-size: 11px; padding: 5px 6px; border-radius: 4px; text-transform: uppercase;">
          <button type="button" id="tcddPanelSwapBtn" style="background: rgba(88,166,255,0.1); border: 1px solid #30363d; color: #58a6ff; border-radius: 4px; cursor: pointer; font-size: 13px; padding: 3px 6px;" title="İstasyonları Değiştir">⇄</button>
          <input type="text" id="tcddPanelTo" class="tcdd-route-input" list="tcddStationsDatalist" placeholder="Varış..." value="YOZGAT YHT" style="flex: 1; min-width: 0; background: #161b22; border: 1px solid #30363d; color: #58a6ff; font-weight: bold; font-size: 11px; padding: 5px 6px; border-radius: 4px; text-transform: uppercase;">
          <datalist id="tcddStationsDatalist"></datalist>
        </div>
        <button type="button" id="tcddPanelNewSearchBtn" style="background: linear-gradient(135deg, #1f6feb 0%, #1158c7 100%); border: 1px solid #388bfd; color: #ffffff; font-weight: 700; font-size: 11px; padding: 5px 10px; border-radius: 5px; cursor: pointer; width: 100%; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;" title="Yazdığınız yeni kalkış/varış istasyonlarını sitede otomatik aratır">
          🔍 Yeni Rota Ara / Değiştir
        </button>

        <!-- Durum ve Son Kontrol -->
        <div class="tcdd-panel-status-bar">
          <span id="tcddPanelStatusText">⚡ Hazır. Seferler taranabilir.</span>
          <span id="tcddPanelLastCheck" style="color: #8b949e; font-size: 10px;">-</span>
        </div>

        <!-- Tek Tarih / Tarih Aralığı Sekmeleri -->
        <div class="tcdd-tab-row">
          <button type="button" class="tcdd-tab-btn" id="tcddTabSingle">Tek Tarih</button>
          <button type="button" class="tcdd-tab-btn active" id="tcddTabRange">Tarih Aralığı (Çoklu Gün)</button>
        </div>

        <!-- Tarih Girdileri -->
        <div class="tcdd-input-row" id="tcddSingleRow" style="display: none;">
          <label for="tcddSingleDate">Yolculuk Tarihi</label>
          <input type="date" id="tcddSingleDate">
        </div>

        <div class="tcdd-input-row" id="tcddRangeRow">
          <label>Tarih Aralığı (Başlangıç - Bitiş)</label>
          <div style="display: flex; gap: 6px;">
            <input type="date" id="tcddRangeStart" style="flex: 1;">
            <input type="date" id="tcddRangeEnd" style="flex: 1;">
          </div>
        </div>

        <!-- Filtreler: Saat ve Vagon -->
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1;" class="tcdd-input-row">
            <label for="tcddTimeFilter">Saat Tercihi</label>
            <select id="tcddTimeFilter" class="tcdd-panel-select">
              <option value="evening" selected>Akşam (18:00 - 23:59)</option>
              <option value="all">Tüm Gün (Farketmez)</option>
              <option value="morning">Sabah (06:00 - 12:00)</option>
              <option value="afternoon">Öğleden Sonra (12:00 - 18:00)</option>
            </select>
          </div>
          <div style="flex: 1;" class="tcdd-input-row">
            <label for="tcddWagonFilter">Vagon Tercihi</label>
            <select id="tcddWagonFilter" class="tcdd-panel-select">
              <option value="all" selected>Tümü (Eko + Bus)</option>
              <option value="economy">Yalnızca Ekonomi</option>
              <option value="business">Yalnızca Business</option>
            </select>
          </div>
        </div>

        <!-- Eylem Butonları -->
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button type="button" id="tcddPanelTrackBtn" class="tcdd-btn-track">
            ▶ Otomatik Takip
          </button>
          <button type="button" id="tcddPanelScanBtn" class="tcdd-btn-scan">
            ⚡ Şimdi Tara
          </button>
        </div>

        <!-- Bulunan Seferler Başlığı -->
        <div class="tcdd-results-header">
          <span>🎉 BULUNAN BOŞ SEFERLER</span>
          <span class="tcdd-count-badge" id="tcddPanelFoundBadge">0</span>
        </div>

        <!-- Bilet Listesi -->
        <div class="tcdd-tickets-list" id="tcddPanelTicketsList">
          <div class="tcdd-empty-notice" id="tcddPanelEmptyNotice">
            🔍 Henüz boş koltuk yakalanmadı.<br>'Şimdi Tara' butonuna basarak kontrol edebilirsiniz.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Draggable Panel
    makePanelDraggable(panel, document.getElementById("tcddPanelHeader"));

    // DOM Elements
    const bodyEl = document.getElementById("tcddPanelBody");
    const minBtn = document.getElementById("tcddPanelMinBtn");
    const closeBtn = document.getElementById("tcddPanelCloseBtn");
    const reloadBtn = document.getElementById("tcddPanelReloadBtn");

    if (reloadBtn) {
      reloadBtn.onclick = () => {
        reloadBtn.textContent = "⏳...";
        chrome.runtime.sendMessage({ type: "RELOAD_EXTENSION" });
      };
    }
    const tabSingle = document.getElementById("tcddTabSingle");
    const tabRange = document.getElementById("tcddTabRange");
    const singleRow = document.getElementById("tcddSingleRow");
    const rangeRow = document.getElementById("tcddRangeRow");
    const singleDateInput = document.getElementById("tcddSingleDate");
    const rangeStartInput = document.getElementById("tcddRangeStart");
    const rangeEndInput = document.getElementById("tcddRangeEnd");
    const timeFilterSelect = document.getElementById("tcddTimeFilter");
    const wagonFilterSelect = document.getElementById("tcddWagonFilter");
    const trackBtn = document.getElementById("tcddPanelTrackBtn");
    const scanBtn = document.getElementById("tcddPanelScanBtn");
    const fromEl = document.getElementById("tcddPanelFrom");
    const toEl = document.getElementById("tcddPanelTo");

    const today = getTodayStr(0);
    singleDateInput.min = today;
    rangeStartInput.min = today;
    rangeEndInput.min = today;

    singleDateInput.value = today;
    rangeStartInput.value = today;
    rangeEndInput.value = getTodayStr(2);

    // Mode Toggle
    let currentMode = "range";
    const setMode = (mode) => {
      currentMode = mode;
      if (mode === "single") {
        tabSingle.classList.add("active");
        tabRange.classList.remove("active");
        singleRow.style.display = "flex";
        rangeRow.style.display = "none";
      } else {
        tabRange.classList.add("active");
        tabSingle.classList.remove("active");
        singleRow.style.display = "none";
        rangeRow.style.display = "flex";
      }
      savePanelConfig();
    };

    tabSingle.onclick = () => setMode("single");
    tabRange.onclick = () => setMode("range");

    // Minimize & Close
    minBtn.onclick = () => {
      const isMin = bodyEl.classList.toggle("minimized");
      minBtn.textContent = isMin ? "+" : "−";
    };

    closeBtn.onclick = () => {
      panel.style.display = "none";
      showReopenPill(panel);
    };

    // Auto Detect Stations from Page
    detectRouteFromPage(fromEl, toEl);

    // Load initial values from chrome.storage.local
    chrome.storage.local.get([
      "fromStation", "toStation", "dateMode", "startDate", "rangeStart", "rangeEnd",
      "timeFilter", "wagonType", "isTracking", "foundTickets", "lastScanTime",
      "shouldScanImmediately", "targetSearchRoute"
    ], (stored) => {
      if (stored.fromStation) fromEl.value = stored.fromStation;
      if (stored.toStation) toEl.value = stored.toStation;
      const today = getTodayStr(0);
      let vStart = isPastDate(stored.startDate) ? today : formatDateToIso(stored.startDate, today);
      let vRangeStart = isPastDate(stored.rangeStart) ? today : formatDateToIso(stored.rangeStart, today);
      let vRangeEnd = formatDateToIso(stored.rangeEnd, getTodayStr(2));
      if (isPastDate(vRangeEnd) || vRangeEnd < vRangeStart) {
        vRangeEnd = getTodayStr(2) >= vRangeStart ? getTodayStr(2) : vRangeStart;
      }

      singleDateInput.min = today;
      rangeStartInput.min = today;
      rangeEndInput.min = vRangeStart;

      singleDateInput.value = vStart;
      rangeStartInput.value = vRangeStart;
      rangeEndInput.value = vRangeEnd;
      if (stored.timeFilter) timeFilterSelect.value = stored.timeFilter;
      if (stored.wagonType) wagonFilterSelect.value = stored.wagonType;

      if (stored.dateMode) {
        setMode(stored.dateMode);
      } else {
        setMode("range");
      }

      updateTrackBtnUI(Boolean(stored.isTracking));

      if (stored.lastScanTime) {
        const lastCheckEl = document.getElementById("tcddPanelLastCheck");
        if (lastCheckEl) lastCheckEl.textContent = stored.lastScanTime;
      }

      if (stored.foundTickets && stored.foundTickets.length > 0) {
        renderInPageTickets(stored.foundTickets);
      }

      // Kullanıcı Talebi: Yeni sekmede bütün bilgiler panele girildikten sonra 'Şimdi Tara'ya otomatik bir kez daha bassın!
      const isAutoScanNeeded = Boolean(
        sessionStorage.getItem("tcdd_auto_scan_needed") === "true" ||
        (stored.shouldScanImmediately && (Date.now() - stored.shouldScanImmediately < 120000)) ||
        (stored.targetSearchRoute && (Date.now() - stored.targetSearchRoute.timestamp < 120000))
      );

      if (window.location.pathname.includes("sefer-listesi") && isAutoScanNeeded && !hasAutoScannedOnPageLoad) {
        hasAutoScannedOnPageLoad = true;
        sessionStorage.removeItem("tcdd_auto_scan_needed");
        chrome.storage.local.remove(["shouldScanImmediately"]);

        console.log("🚀 Yeni sekmede bütün bilgiler girildi! Şimdi Tara butonuna otomatik basılıyor...");
        updatePanelStatus("⚡ Bilgiler yüklendi, Şimdi Tara otomatik başlatılıyor...", true);

        setTimeout(async () => {
          await waitForTrainsToLoad(10000);
          await sleep(500);
          triggerPanelScanBtn();
        }, 300);
      }
    });

    // Save Config on Change
    const savePanelConfig = () => {
      const config = {
        fromStation: (fromEl.value || "").trim().toUpperCase(),
        toStation: (toEl.value || "").trim().toUpperCase(),
        dateMode: currentMode,
        startDate: singleDateInput.value,
        rangeStart: rangeStartInput.value,
        rangeEnd: rangeEndInput.value,
        timeFilter: timeFilterSelect.value,
        wagonType: wagonFilterSelect.value
      };
      chrome.storage.local.set(config);
      return config;
    };

    fromEl.oninput = savePanelConfig;
    toEl.oninput = savePanelConfig;

    const swapBtn = document.getElementById("tcddPanelSwapBtn");
    if (swapBtn) {
      swapBtn.onclick = () => {
        const tmp = fromEl.value;
        fromEl.value = toEl.value;
        toEl.value = tmp;
        savePanelConfig();
      };
    }

    singleDateInput.onchange = () => {
      const curToday = getTodayStr(0);
      if (singleDateInput.value < curToday) singleDateInput.value = curToday;
      savePanelConfig();
    };
    rangeStartInput.onchange = () => {
      const curToday = getTodayStr(0);
      if (rangeStartInput.value < curToday) rangeStartInput.value = curToday;
      rangeEndInput.min = rangeStartInput.value;
      if (rangeEndInput.value < rangeStartInput.value) rangeEndInput.value = rangeStartInput.value;
      savePanelConfig();
    };
    rangeEndInput.onchange = savePanelConfig;
    timeFilterSelect.onchange = savePanelConfig;
    wagonFilterSelect.onchange = savePanelConfig;

    // Yeni Rota Ara Butonu (Panelden doğrudan yeni arama tetikler)
    const newSearchBtn = document.getElementById("tcddPanelNewSearchBtn");
    if (newSearchBtn) {
      newSearchBtn.onclick = async () => {
        const cfg = savePanelConfig();
        newSearchBtn.disabled = true;
        newSearchBtn.textContent = "⏳ Yeni Arama Yapılıyor...";
        try {
          await checkAndExecuteRouteSearch(cfg);
        } finally {
          setTimeout(() => {
            if (newSearchBtn) {
              newSearchBtn.disabled = false;
              newSearchBtn.textContent = "🔍 Yeni Rota Ara / Değiştir";
            }
          }, 3500);
        }
      };
    }

    // Scan Button (Doğrudan sayfada taramayı anında başlatır)
    scanBtn.onclick = async () => {
      const cfg = savePanelConfig();

      // Eğer mevcut sayfa başlığındaki rota, kullanıcının seçtiği istasyonlardan farklıysa önce yeni arama yap!
      const pageRoute = getRouteFromPageHeader();
      const isDiff = pageRoute && (!isStationMatch(pageRoute.from, cfg.fromStation) || !isStationMatch(pageRoute.to, cfg.toStation));
      if (isDiff) {
        updatePanelStatus(`🔄 Rota değişti, ${cfg.fromStation} ➔ ${cfg.toStation} aranıyor...`, true);
        await checkAndExecuteRouteSearch(cfg);
        return;
      }

      renderInPageTickets([]);
      await chrome.storage.local.set({ foundTickets: [], logs: [] });
      updatePanelStatus("Seferler taranıyor...", true);
      scanBtn.disabled = true;
      scanBtn.textContent = "⏳ Taranıyor...";
      isScanningInProgress = false;
      try {
        await handlePageScan(cfg);
      } catch (e) {
        console.error("Tarama hatası:", e);
        updatePanelStatus("⚠️ Tarama sırasında hata oluştu", false);
      } finally {
        scanBtn.disabled = false;
        scanBtn.textContent = "⚡ Şimdi Tara";
      }
    };

    // Track Button
    trackBtn.onclick = async () => {
      const cfg = savePanelConfig();
      const st = await chrome.storage.local.get(["isTracking"]);
      const nextTracking = !st.isTracking;
      await chrome.storage.local.set({ isTracking: nextTracking });
      updateTrackBtnUI(nextTracking);

      if (nextTracking) {
        chrome.runtime.sendMessage({ type: "START_TRACKING", config: cfg });
        updatePanelStatus("Otomatik takip devrede", true);
      } else {
        chrome.runtime.sendMessage({ type: "STOP_TRACKING" });
        updatePanelStatus("Otomatik takip durduruldu", false);
      }
    };
  }

  function detectRouteFromPage(fromEl, toEl) {
    try {
      // 1. Datalist İstasyonlarını Doldur
      const datalist = document.getElementById("tcddStationsDatalist");
      if (datalist && datalist.children.length === 0) {
        const defaultStations = [
          "ANKARA GAR", "SORGUN YHT", "YOZGAT YHT", "KIRIKKALE YHT", "AKDAĞMADENİ YHT", "YERKÖY YHT", "YILDIZELİ YHT", "SİVAS",
          "ERYAMAN YHT", "POLATLI YHT", "ESKİŞEHİR", "BOZÜYÜK YHT", "BİLECİK YHT", "ARİFİYE", "İZMİT YHT", "GEBZE",
          "İSTANBUL(PENDİK)", "İSTANBUL(BOSTANCI)", "İSTANBUL(SÖĞÜTLÜÇEŞME)", "İSTANBUL(BAKIRKÖY)", "İSTANBUL(HALKALI)",
          "KONYA", "SELÇUKLU", "KARAMAN", "KAYSERİ", "İZMİR(BASMANE)", "ADANA", "MERSİN", "MALATYA", "ERZURUM", "KARS"
        ];

        let allList = defaultStations;
        if (typeof TCDD_STATIONS !== "undefined" && Array.isArray(TCDD_STATIONS)) {
          allList = Array.from(new Set([...defaultStations, ...TCDD_STATIONS.map(s => s.name)]));
        }

        allList.forEach(name => {
          const opt = document.createElement("option");
          opt.value = name;
          datalist.appendChild(opt);
        });
      }

      // 2. Ana Sayfadaki TCDD İnputlarını Canlı Olarak Dinle (Yalnızca ana sayfadayken)
      function syncFromPageInputs() {
        // Kullanıcı panel kutucuklarına odaklanmışsa veya yazıyorsa ASLA müdahale etme!
        if (document.activeElement === fromEl || document.activeElement === toEl) return;
        if (window.location.pathname.includes("sefer-listesi") || window.location.pathname.includes("koltuk-haritasi")) return;

        const pageFromInput = document.getElementById("fromTrainInput");
        const pageToInput = document.getElementById("toTrainInput");

        if (pageFromInput && pageFromInput.value && pageFromInput.value.trim()) {
          const cleanFrom = pageFromInput.value.split(",")[0].trim().toUpperCase();
          if (cleanFrom && fromEl.value !== cleanFrom) {
            fromEl.value = cleanFrom;
            chrome.storage.local.set({ fromStation: cleanFrom });
          }
        }

        if (pageToInput && pageToInput.value && pageToInput.value.trim()) {
          const cleanTo = pageToInput.value.split(",")[0].trim().toUpperCase();
          if (cleanTo && toEl.value !== cleanTo) {
            toEl.value = cleanTo;
            chrome.storage.local.set({ toStation: cleanTo });
          }
        }
      }

      // TCDD ana sayfasında dropdown menüsünden istasyon seçilirse dinle
      if (!window.location.pathname.includes("sefer-listesi")) {
        document.addEventListener("click", (e) => {
          if (document.activeElement === fromEl || document.activeElement === toEl) return;
          const btn = e.target.closest("button.station, button.dropdown-item, .dropdown-menu button, .whereToDropdown button, .whereFromDropdown button");
          if (btn) {
            setTimeout(syncFromPageInputs, 150);
          }
        }, true);

        const pFrom = document.getElementById("fromTrainInput");
        const pTo = document.getElementById("toTrainInput");
        if (pFrom) pFrom.addEventListener("change", syncFromPageInputs);
        if (pTo) pTo.addEventListener("change", syncFromPageInputs);
      }
    } catch (e) {
      console.warn("Rota tespiti hatası:", e);
    }
  }

  // Sayfa başlığından veya özet çubuğundan anlık sefer rotasını okur
  function getRouteFromPageHeader() {
    try {
      const titles = Array.from(document.querySelectorAll("h1, h2, h3, h4, .title, [class*='gidis']"));
      const gidisTitle = titles.find(el => (el.innerText || "").includes("Gidiş -"));
      if (gidisTitle) {
        const clean = gidisTitle.innerText.replace("Gidiş -", "").trim();
        const parts = clean.split(/➔|->|→/);
        if (parts.length >= 2) {
          return {
            from: parts[0].trim().toUpperCase(),
            to: parts[1].trim().toUpperCase()
          };
        }
      }

      const routeEls = Array.from(document.querySelectorAll("div, p, span")).filter(el => (el.innerText || "").includes("Nereden/Nereye:"));
      if (routeEls.length > 0) {
        const text = routeEls[0].innerText;
        const sub = text.split("Nereden/Nereye:")[1] || "";
        const parts = sub.split(/⇄|➔|->|→/);
        if (parts.length >= 2) {
          return {
            from: parts[0].split(",")[0].trim().toUpperCase(),
            to: parts[1].split(",")[0].trim().toUpperCase()
          };
        }
      }
    } catch (e) { }
    return null;
  }

  // İki istasyon isminin aynı yeri temsil edip etmediğini kontrol eder
  function isStationMatch(a, b) {
    if (!a || !b) return false;
    const cleanA = a.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, "").toUpperCase();
    const cleanB = b.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, "").toUpperCase();
    if (cleanA === cleanB) return true;
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

    // Kelime bazlı eşleşme (örn: SÖĞÜTLÜÇEŞME, SORGUN, YOZGAT, ANKARA)
    const wordsA = a.split(/[\s(),]+/);
    const wordsB = b.split(/[\s(),]+/);
    for (const w of wordsA) {
      if (w.length > 3 && wordsB.some(wb => wb.toUpperCase() === w.toUpperCase())) return true;
    }
    return false;
  }

  // Hedef rotayı doğrular: Sayfa rotası hedefle eşleşmiyorsa otomatik yeni arama yapar!
  async function checkAndExecuteRouteSearch(config) {
    const targetFrom = (config.fromStation || "ANKARA GAR").trim().toUpperCase();
    const targetTo = (config.toStation || "YOZGAT YHT").trim().toUpperCase();

    // 1. Ana sayfadaysak doğrudan formu doldur ve arat
    if (!window.location.pathname.includes("sefer-listesi")) {
      console.log("📍 Ana sayfadayız, hedef rota aranıyor:", targetFrom, "➔", targetTo);
      updatePanelStatus(`🔍 ${targetFrom} ➔ ${targetTo} seferi aranıyor...`, true);
      await fillAndSubmitSearchForm(config);
      return;
    }

    // 2. Sefer listesi sayfasındayız: Mevcut sayfanın rotasını kontrol et
    const pageRoute = getRouteFromPageHeader();
    const isSameRoute = pageRoute &&
      isStationMatch(pageRoute.from, targetFrom) &&
      isStationMatch(pageRoute.to, targetTo);

    if (isSameRoute) {
      console.log("✅ Sayfa zaten istenen rotada:", targetFrom, "➔", targetTo);
      const scanBtnEl = document.getElementById("tcddPanelScanBtn");
      if (scanBtnEl) {
        scanBtnEl.disabled = true;
        scanBtnEl.textContent = "⏳ Taranıyor...";
      }
      try {
        await handlePageScan(config);
      } finally {
        if (scanBtnEl) {
          scanBtnEl.disabled = false;
          scanBtnEl.textContent = "⚡ Şimdi Tara";
        }
      }
    } else {
      console.log(`⚠️ Sayfa rotası (${pageRoute?.from || '?'} ➔ ${pageRoute?.to || '?'}) hedef rotayla (${targetFrom} ➔ ${targetTo}) uyuşmuyor! Yeni arama başlatılıyor...`);
      updatePanelStatus(`🔄 Yeni rota aranıyor: ${targetFrom} ➔ ${targetTo}...`, true);

      // Hedef rotayı ve anlık tarama emrini kaydet
      await chrome.storage.local.set({
        fromStation: targetFrom,
        toStation: targetTo,
        targetSearchRoute: { fromStation: targetFrom, toStation: targetTo, timestamp: Date.now() },
        shouldScanImmediately: Date.now()
      });

      // TCDD sayfasındaki 'Yeniden Ara' butonunu dene
      const yenidendenAraBtn = Array.from(document.querySelectorAll("button, a, span")).find(el => (el.innerText || "").trim() === "Yeniden Ara");
      if (yenidendenAraBtn) {
        yenidendenAraBtn.click();
        await sleep(500);
      }

      // Eğer form ekrana geldiyse doldur, gelmediyse ana sayfaya geç
      const pageFromInput = document.getElementById("fromTrainInput");
      if (pageFromInput) {
        await fillAndSubmitSearchForm(config);
      } else {
        window.location.href = "https://ebilet.tcddtasimacilik.gov.tr/";
      }
    }
  }

  function makePanelDraggable(panel, header) {
    let isDragging = false;
    let startX = 0, startY = 0, initLeft = 0, initTop = 0;

    header.onmousedown = (e) => {
      if (e.target.tagName === "BUTTON") return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;
      panel.style.right = "auto";
      panel.style.left = `${initLeft}px`;
      panel.style.top = `${initTop}px`;
      document.onmousemove = onMouseMove;
      document.onmouseup = onMouseUp;
    };

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = `${Math.max(10, Math.min(window.innerWidth - 390, initLeft + dx))}px`;
      panel.style.top = `${Math.max(10, Math.min(window.innerHeight - 80, initTop + dy))}px`;
    }

    function onMouseUp() {
      isDragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    }
  }

  function showReopenPill(panel) {
    if (document.getElementById("tcdd-reopen-pill")) return;
    const pill = document.createElement("div");
    pill.id = "tcdd-reopen-pill";
    pill.className = "tcdd-reopen-pill";
    pill.innerHTML = `<span>🚄</span><span>TCDD Avcısı</span>`;
    document.body.appendChild(pill);

    pill.onclick = () => {
      panel.style.display = "flex";
      pill.remove();
    };
  }

  function updateTrackBtnUI(isTracking) {
    const btn = document.getElementById("tcddPanelTrackBtn");
    const dot = document.getElementById("tcddPanelDot");
    if (!btn) return;

    if (isTracking) {
      btn.textContent = "⏹ Takibi Durdur";
      btn.classList.add("tracking-active");
      if (dot) dot.classList.add("active");
    } else {
      btn.textContent = "▶ Otomatik Takip";
      btn.classList.remove("tracking-active");
      if (dot) dot.classList.remove("active");
    }
  }

  function updatePanelStatus(text, isActive) {
    const statusText = document.getElementById("tcddPanelStatusText");
    const dot = document.getElementById("tcddPanelDot");
    if (statusText) statusText.innerHTML = text;
    if (dot) {
      if (isActive) dot.classList.add("active");
      else dot.classList.remove("active");
    }
  }
  const updateWidgetStatus = updatePanelStatus;

  function renderInPageTickets(tickets) {
    const container = document.getElementById("tcddPanelTicketsList");
    const badge = document.getElementById("tcddPanelFoundBadge");
    if (!container) return;

    if (badge) badge.textContent = tickets ? tickets.length : 0;

    if (!tickets || tickets.length === 0) {
      container.innerHTML = `
        <div class="tcdd-empty-notice" id="tcddPanelEmptyNotice">
          🔍 Henüz boş koltuk yakalanmadı.<br>'Şimdi Tara' butonuna basarak kontrol edebilirsiniz.
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    tickets.forEach(t => {
      const isBus = (t.wagonType || t.targetWagon || "").toUpperCase().includes("BUS");
      const wagonLabel = isBus ? "BUSINESS" : "EKONOMİ";
      const card = document.createElement("div");
      card.className = "tcdd-inpage-ticket";
      card.innerHTML = `
        <div class="tcdd-ticket-left">
          <div class="tcdd-ticket-title-row">
            <span class="tcdd-ticket-title">🚆 ${t.trainName || "YHT Treni"}</span>
            <span class="tcdd-ticket-badge ${isBus ? 'bus' : 'eko'}">${wagonLabel}</span>
          </div>
          <div class="tcdd-ticket-meta">📅 <b>${t.date}</b> • 🕒 <b>${t.time}</b></div>
          <div class="tcdd-ticket-info-row">
            <span class="tcdd-ticket-seats ${isBus ? 'bus' : ''}">💺 <b>${t.availableSeats} Boş Koltuk</b></span>
            <span class="tcdd-ticket-price">${t.price || (isBus ? '₺910,00' : '₺605,00')}</span>
          </div>
        </div>
        <button type="button" class="tcdd-inpage-go-btn ${isBus ? 'bus' : 'eko'}" title="Doğrudan ${wagonLabel} koltuk haritasına git">
          ${isBus ? '🟣' : '🟢'} Koltuğa Git ➔
        </button>
      `;

      card.querySelector("button").onclick = () => {
        highlightAndSelectTrain(t);
      };

      container.appendChild(card);
    });
  }

  function playAudioAlert() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [
        { f: 587.33, t: 0.00, d: 0.2 },
        { f: 880.00, t: 0.22, d: 0.2 },
        { f: 1174.66, t: 0.44, d: 0.4 },
        { f: 880.00, t: 0.88, d: 0.2 },
        { f: 1174.66, t: 1.10, d: 0.5 }
      ];
      notes.forEach(s => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(s.f, ctx.currentTime + s.t);
        gain.gain.setValueAtTime(0, ctx.currentTime + s.t);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + s.t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.t + s.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + s.t);
        osc.stop(ctx.currentTime + s.t + s.d + 0.05);
      });
    } catch (e) {
      console.warn("Ses çalma hatası:", e);
    }
  }

  // 2. PAGE SCAN CONTROLLER
  async function handlePageScan(config) {
    if (isScanningInProgress && Date.now() - lastScanStart < 45000) {
      console.log("Tarama zaten sürüyor, bekleniyor...");
      return;
    }
    isScanningInProgress = true;
    lastScanStart = Date.now();

    try {
      updatePanelStatus("Seferler inceleniyor...", true);
      const isSeferListesi = window.location.pathname.includes("sefer-listesi");

      // Eğer sefer-listesi sayfasında değilsek ana sayfadaki formu doldur
      if (!isSeferListesi) {
        console.log("Ana sayfadayız, bilet formu dolduruluyor...", config);
        updatePanelStatus("İstasyonlar seçiliyor...", true);
        const submitted = await fillAndSubmitSearchForm(config);
        if (!submitted) {
          isScanningInProgress = false;
          updatePanelStatus("Form doldurulamadı", false);
        }
        return;
      }

      // Sefer listesi sayfasındayız
      console.log("Sefer listesi sayfasındayız, seferler taranıyor...");
      updatePanelStatus("Tren seferleri yükleniyor...", true);
      await waitForTrainsToLoad(8000);

      let results = {
        totalTrains: 0,
        allTrains: [],
        foundTickets: []
      };

      function extractDayNumber(val, defaultDay) {
        if (!val) return defaultDay;
        if (typeof val === "number") return val;
        const s = String(val).trim();
        if (s.includes("-")) {
          const parts = s.split("-");
          if (parts[0].length === 4) return parseInt(parts[2], 10) || defaultDay;
          return parseInt(parts[0], 10) || defaultDay;
        }
        if (s.includes(".")) {
          return parseInt(s.split(".")[0], 10) || defaultDay;
        }
        const num = parseInt(s, 10);
        return isNaN(num) ? defaultDay : num;
      }

      const now = new Date();
      const todayDay = now.getDate();
      const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
      const currentYear = now.getFullYear();
      const monthName = now.toLocaleDateString("tr-TR", { month: "long" });

      // Tarih Aralığı (Çoklu Gün) veya Tek Gün Taraması
      if (config.dateMode === "range" && config.rangeStart && config.rangeEnd) {
        let startDay = extractDayNumber(config.rangeStart, todayDay);
        let endDay = extractDayNumber(config.rangeEnd, todayDay + 2);

        // Başlangıç günü geçmişte (dünde) kalamaz, en az bugünün günü olmalıdır!
        if (startDay < todayDay) startDay = todayDay;
        if (startDay > endDay) endDay = startDay;

        console.log(`Çoklu gün taraması başlıyor: ${startDay} - ${endDay} ${monthName}`);

        for (let gun = startDay; gun <= endDay; gun++) {
          await checkAndHandleCloudflare();
          updatePanelStatus(`📅 ${gun} ${monthName} seferleri taranıyor...`, true);
          const switched = await ensurePageDate(gun);
          await checkAndHandleCloudflare();
          if (switched) {
            await sleep(100);
            const formattedDate = `${String(gun).padStart(2, "0")}.${currentMonth}.${currentYear}`;
            const dayRes = parseCurrentSeferList(config, formattedDate);
            results.totalTrains += dayRes.totalTrains;
            results.allTrains.push(...dayRes.allTrains);
            results.foundTickets.push(...dayRes.foundTickets);

            if (results.foundTickets.length > 0) {
              renderInPageTickets(results.foundTickets);
              playAudioAlert();
            }
          }
          if (gun < endDay) {
            await sleep(200);
          }
        }
      } else {
        // Tek gün taraması
        let targetDay = extractDayNumber(config.startDate, todayDay);
        if (targetDay < todayDay) targetDay = todayDay;

        await checkAndHandleCloudflare();
        await ensurePageDate(targetDay);
        await checkAndHandleCloudflare();
        await sleep(200);

        const formattedDate = `${String(targetDay).padStart(2, "0")}.${currentMonth}.${currentYear}`;
        results = parseCurrentSeferList(config, formattedDate);

        if (results.foundTickets.length > 0) {
          renderInPageTickets(results.foundTickets);
          playAudioAlert();
        }
      }

      console.log("Tarama sonuçları:", results);

      chrome.runtime.sendMessage({
        type: "SCAN_RESULTS",
        results: results
      });

      const lastTime = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const checkEl = document.getElementById("tcddPanelLastCheck");
      if (checkEl) checkEl.textContent = lastTime;

      if (results.foundTickets.length > 0) {
        updatePanelStatus(`🎉 <b>${results.foundTickets.length}</b> BOŞ YER BULUNDU!`, true);
      } else {
        updatePanelStatus(`${results.totalTrains} Sefer Tarandı. Boş yer yok.`, false);
      }
    } catch (err) {
      console.error("Tarama hatası:", err);
      updatePanelStatus("Tarama hatası: " + err.message, false);
    } finally {
      isScanningInProgress = false;
    }
  }

  // Carousel Gün Butonunu Bul (Slick klonlarını ele, sadece gerçek gidiş butonlarını al)
  function findDayButton(targetDay) {
    const tumButonlar = Array.from(document.querySelectorAll("button.slideArea, .slideArea button, button"))
      .filter(b => {
        const t = (b.innerText || "").replace(/\s+/g, " ").trim();
        return /\b([1-9]|[12]\d|3[01])\b/.test(t) && /(Ekim|Kasım|Aralık|Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül)/i.test(t) && !b.closest(".slick-cloned");
      });

    return tumButonlar.find(b => {
      const t = b.innerText.replace(/\s+/g, " ");
      const m = t.match(/(?:^|\b)(\d{1,2})(?:\b|$)/);
      return m && parseInt(m[1], 10) === targetDay;
    });
  }

  async function clickCarouselDate(gunNo) {
    return ensurePageDate(gunNo);
  }

  // 3. FILL & SUBMIT HOMEPAGE FORM
  async function fillAndSubmitSearchForm(config) {
    try {
      const fromStation = config.fromStation || "ANKARA GAR";
      const toStation = config.toStation || "YOZGAT YHT";

      console.log(`Seçim başlıyor: ${fromStation} ➔ ${toStation}`);

      async function selectStationOnPage(inputId, targetName) {
        let input = document.getElementById(inputId);
        if (!input) {
          if (inputId.includes("from")) {
            input = document.querySelector("input[name*='kalkış'], input[name*='departure'], .whereFromDropdown input, [aria-label*='departure']");
          } else {
            input = document.querySelector("input[name*='varış'], input[name*='arrival'], .whereToDropdown input, [aria-label*='arrival']");
          }
        }
        if (!input) return false;

        input.focus();
        input.click();
        await sleep(500);

        const container = input.closest(".searchDropdown") || input.closest(".whereFromDropdown") || input.closest(".whereToDropdown") || input.closest(".form-label-group") || input.parentElement;
        const dropdownMenu = container ? container.querySelector(".dropdown-menu") : document.querySelector(".searchDropdown .dropdown-menu.show, .dropdown-menu.show");

        if (!dropdownMenu) return false;

        const searchBox = dropdownMenu.querySelector("input");
        if (searchBox) {
          searchBox.focus();
          let searchKeyword = targetName;
          if (targetName.includes("(") && targetName.includes(")")) {
            const m = targetName.match(/\((.*?)\)/);
            searchKeyword = m ? m[1] : targetName.split(" ")[0];
          } else {
            searchKeyword = targetName.split(" ")[0];
          }
          searchBox.value = searchKeyword;
          searchBox.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(400);
        }

        const buttons = Array.from(dropdownMenu.querySelectorAll("button.station, button.dropdown-item, button"));
        const cleanTarget = targetName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, "").toUpperCase();

        let targetBtn = buttons.find(b => {
          const bText = b.textContent.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, "").toUpperCase();
          return bText.includes(cleanTarget);
        });

        // Parantez içi istasyon kontrolü (örn: SÖĞÜTLÜÇEŞME, PENDİK, HALKALI)
        if (!targetBtn && targetName.includes("(") && targetName.includes(")")) {
          const m = targetName.match(/\((.*?)\)/);
          const inside = m ? m[1].replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, "").toUpperCase() : "";
          if (inside) {
            targetBtn = buttons.find(b => b.textContent.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, "").toUpperCase().includes(inside));
          }
        }

        // İlk kelime eşleşmesi (örn: SORGUN, YOZGAT, ANKARA)
        if (!targetBtn && buttons.length > 0) {
          const firstWord = targetName.split(/[\s(]/)[0].replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, "").toUpperCase();
          targetBtn = buttons.find(b => b.textContent.toUpperCase().includes(firstWord)) || buttons[0];
        }

        if (targetBtn) {
          targetBtn.scrollIntoView({ block: "nearest" });
          targetBtn.click();
          await sleep(400);
          return true;
        }
        return false;
      }

      updatePanelStatus(`Kalkış seçiliyor: ${fromStation}`, true);
      const s1 = await selectStationOnPage("fromTrainInput", fromStation);
      if (!s1) return false;

      updatePanelStatus(`Varış seçiliyor: ${toStation}`, true);
      const s2 = await selectStationOnPage("toTrainInput", toStation);
      if (!s2) return false;

      document.querySelectorAll(".dropdown.show .btnClose, .dropdown-menu.show .btnClose").forEach(b => b.click());
      await sleep(300);

      updatePanelStatus("Sefer Ara butonuna basılıyor...", true);
      const allBtns = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"));
      const searchBtn = document.getElementById("searchSeferButton") ||
        allBtns.find(b => (b.innerText || b.value || "").trim().includes("Sefer Ara")) ||
        document.querySelector(".btnSeferSearch, button.btn-danger");
      if (searchBtn) {
        searchBtn.click();
        updatePanelStatus("⏳ Sefer listesi açılıyor, otomatik taranacak...", true);
        sessionStorage.setItem("tcdd_auto_scan_needed", "true");

        // Vue SPA Router geçişini ve sefer kartlarının yüklenmesini aktif bekle
        const waitStart = Date.now();
        while (Date.now() - waitStart < 15000) {
          await sleep(250);
          if (window.location.pathname.includes("sefer-listesi") || document.querySelector("[id^='gidis']")) {
            console.log("🚀 Sefer listesi açıldı! Bilgiler yükleniyor...");
            updatePanelStatus("Tren seferleri bekleniyor...", true);
            await sleep(400);
            await waitForTrainsToLoad(10000);
            await sleep(400);

            // Depodaki tüm güncel ayarları al, panele uygula ve Şimdi Tara butonuna tıkla!
            const currentCfg = await new Promise(resolve => chrome.storage.local.get(null, resolve));
            applyConfigToPanelInputs(currentCfg);
            await sleep(300);

            if (!hasAutoScannedOnPageLoad) {
              hasAutoScannedOnPageLoad = true;
              sessionStorage.removeItem("tcdd_auto_scan_needed");
              chrome.storage.local.remove(["shouldScanImmediately"]);
              triggerPanelScanBtn();
            }
            return true;
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("Form doldurma hatası:", err);
      return false;
    }
  }

  // 4. WAIT FOR TRAINS TO LOAD ON SEFER-LISTESI (Gerçek tren kartlarının DOM'a gelmesini bekler)
  async function waitForTrainsToLoad(maxWaitMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      // 1. Gerçek gidisX kartlarını kontrol et (#gidis0, #gidis1...)
      const trainCards = Array.from(document.querySelectorAll("[id^='gidis']")).filter(el => /^gidis\d+$/.test(el.id));
      if (trainCards.length > 0) {
        await sleep(200);
        return true;
      }

      // 2. TCDD "Sefer Bulunamadı" uyarısı verdiyse boşuna bekleme
      const pageText = document.body.innerText || "";
      if (pageText.includes("sefer bulunamamıştır") || pageText.includes("uygun sefer bulunamadı") || pageText.includes("Sefer Bulunamadı")) {
        console.log("TCDD: Bu güzergahta sefer bulunamadı.");
        return false;
      }

      // 3. YHT tren başlığı veya tren saatleri belirdi mi?
      const hasTrainHeader = Array.from(document.querySelectorAll(".card, .accordion-item")).some(c => {
        const txt = (c.innerText || "").trim();
        return (txt.includes("YHT:") || txt.includes("ANAHAT")) && /\b([0-2]?\d:[0-5]\d)\b/.test(txt);
      });
      if (hasTrainHeader) {
        await sleep(200);
        return true;
      }

      await sleep(80);
    }
    console.warn("Zaman aşımı: Tren kartları beklenen sürede yüklenmedi.");
    return false;
  }

  // 5. PARSE TRAIN LIST (Tam tren adı, saat ve koltuk çözümleme)
  function parseCurrentSeferList(config, explicitDate = null) {
    const foundTickets = [];
    const allTrainRows = [];
    const seenTrainKeys = new Set();

    let pageDate = explicitDate || config.startDate || new Date().toISOString().split("T")[0];
    const dateHeaderEl = document.querySelector(".date-header, .selected-date, time.current-date, .calendar-day.active, .slideArea.active, .slick-current");
    if (!explicitDate && dateHeaderEl && dateHeaderEl.textContent.trim()) {
      pageDate = dateHeaderEl.textContent.trim().replace(/\s+/g, " ");
    }

    // TCDD ana sefer kartlarını bul
    const rawCards = Array.from(document.querySelectorAll("[id^='gidis'], .card, .accordion-item"));

    const validTrainCards = rawCards.filter(card => {
      const txt = (card.innerText || "").trim();
      const hasTrainHeader = /YHT:\s*\d+/i.test(txt) || /YHT\s*-\s*[A-Z]/i.test(txt) || /ANAHAT/i.test(txt);
      const hasTime = /\b([0-2]?\d:[0-5]\d)\b/.test(txt);
      const isSubOnly = txt.startsWith("Bilet tipi") || (txt.includes("Bilet tipi") && !hasTrainHeader);
      return hasTrainHeader && hasTime && !isSubOnly && card.children.length >= 2 && card.children.length <= 40;
    });

    console.log(`[${pageDate}] Tespit edilen sefer sayısı: ${validTrainCards.length}`);

    const pageCardDay = getPageCardDay();
    const explicitDayNum = explicitDate ? parseInt(explicitDate.split(".")[0], 10) : null;
    if (explicitDayNum && pageCardDay && pageCardDay !== explicitDayNum) {
      console.warn(`[${pageDate}] Dikkat: Ekrandaki kart tarihi (${pageCardDay}. gün) hedef günle (${explicitDayNum}) farklı olabilir.`);
    }

    validTrainCards.forEach((card, idx) => {
      const rawText = card.innerText || card.textContent || "";
      const text = rawText.replace(/\s+/g, " ").trim();

      // 1. Tren Adı ve Numarası (Örn: "YHT: 81458 İSTANBUL-SİVAS")
      let trainName = "";
      let trainNum = "";
      const matchNum = rawText.match(/YHT:\s*(\d+)/i) || rawText.match(/\b(8\d{4})\b/);
      if (matchNum) trainNum = matchNum[1];

      const matchYhtFull = rawText.match(/YHT:\s*\d+\s+[^\n\r\(\)]+/i);
      if (matchYhtFull) {
        trainName = matchYhtFull[0].replace(/Daha fazla bilgi.*/i, "").trim().replace(/\s+/g, " ");
      } else if (matchNum) {
        trainName = `YHT: ${trainNum}`;
      } else {
        const matchAnahat = rawText.match(/(ANAHAT|BÖLGESEL|EKSPRES)[^\n\r]+/i);
        if (matchAnahat) trainName = matchAnahat[0].trim();
      }

      if (!trainName || trainName === "YHT:" || trainName.includes("Bilet tipi")) return;

      // 2. Kalkış ve Varış Saatleri (Örn: "13:20 ➔ 14:27")
      const timeMatches = Array.from(text.matchAll(/\b([0-2]?\d:[0-5]\d)\b/g)).map(m => m[0]);
      if (timeMatches.length === 0) return;

      const depTime = timeMatches[0];
      const arrTime = timeMatches[1] ? ` ➔ ${timeMatches[1]}` : "";
      const timeDisplay = `${depTime}${arrTime}`;

      // TEKİLLEŞTİRME: Aynı tren numarasını ve saatini günde yalnızca 1 kez listele!
      const uniqueKey = `${pageDate}_${trainNum || trainName}_${depTime}`;
      if (seenTrainKeys.has(uniqueKey)) return;
      seenTrainKeys.add(uniqueKey);

      // Saat Filtresi
      if (config.timeFilter && config.timeFilter !== "all" && depTime) {
        const hour = parseInt(depTime.split(":")[0], 10);
        if (config.timeFilter === "morning" && (hour < 6 || hour >= 12)) return;
        if (config.timeFilter === "afternoon" && (hour < 12 || hour >= 18)) return;
        if (config.timeFilter === "evening" && hour < 18) return;
      }

      // 3. Fiyat
      const priceMatch = text.match(/₺\s*[\d\.,]+/);
      const defaultPrice = priceMatch ? priceMatch[0] : "";

      // 4. Vagon ve Gerçek Koltuk Sayısı Analizi
      const wagonAnalysis = parseWagonDetailsFromCard(card, config.wagonType || "all");
      const minRequired = config.minSeats || 1;

      if (wagonAnalysis.isAvailable) {
        if (wagonAnalysis.hasWagons) {
          // EKONOMİ BİLETİ
          if (wagonAnalysis.ekonomiSeats >= minRequired && (config.wagonType === "all" || config.wagonType === "economy")) {
            foundTickets.push({
              id: `${card.id || 'train'}-eko-${trainNum || idx}`,
              trainNum: trainNum,
              trainName: trainName,
              time: timeDisplay,
              date: pageDate,
              availableSeats: wagonAnalysis.ekonomiSeats,
              price: wagonAnalysis.ekonomiPrice || defaultPrice || "₺605,00",
              wagonType: "Ekonomi",
              targetWagon: "EKONOMİ"
            });
          }

          // BUSINESS BİLETİ
          if (wagonAnalysis.businessSeats >= minRequired && (config.wagonType === "all" || config.wagonType === "business")) {
            foundTickets.push({
              id: `${card.id || 'train'}-bus-${trainNum || idx}`,
              trainNum: trainNum,
              trainName: trainName,
              time: timeDisplay,
              date: pageDate,
              availableSeats: wagonAnalysis.businessSeats,
              price: wagonAnalysis.businessPrice || "₺910,00",
              wagonType: "Business",
              targetWagon: "BUSINESS"
            });
          }
        } else if (wagonAnalysis.totalSeats >= minRequired) {
          foundTickets.push({
            id: card.id || `train-${idx}`,
            trainNum: trainNum,
            trainName: trainName,
            time: timeDisplay,
            date: pageDate,
            availableSeats: wagonAnalysis.totalSeats,
            price: defaultPrice || "₺605,00",
            wagonType: wagonAnalysis.wagonLabel || "Ekonomi",
            targetWagon: "EKONOMİ"
          });
        }
      } else if (wagonAnalysis.disabledOnly) {
        console.log(`⚠️ ${trainName} (${timeDisplay}): Yalnızca Tekerlekli Sandalye (Engelli) koltuğu var, genel yolcu için DOLU sayıldı.`);
      }
    });

    return {
      totalTrains: validTrainCards.length,
      allTrains: allTrainRows,
      foundTickets: foundTickets
    };
  }

  // Vagon Detaylarını ve Gerçek Koltuk Sayısını Çözümle
  function parseWagonDetailsFromCard(card, preferredWagonType) {
    // 1. Vue Komponent Verisinden Doğrudan Oku (En kesin ve hatasız yöntem)
    try {
      let v = card.__vue__;
      if (!v) {
        let curr = card;
        while (curr && !v) {
          if (curr.__vue__) v = curr.__vue__;
          curr = curr.parentElement;
        }
      }
      const trainObj = v && (v.train || v.sefer || v.item || v.trainData || (v.data && v.data.train));
      if (trainObj) {
        const wagonList = trainObj.wagonTypes || trainObj.vagonTipleri || trainObj.wagons || trainObj.fareClasses || [];
        if (Array.isArray(wagonList) && wagonList.length > 0) {
          let vEko = 0, vBus = 0, vDis = 0;
          let pEko = "", pBus = "";
          wagonList.forEach(w => {
            const wName = String(w.name || w.type || w.wagonTypeName || w.cabinClassName || "").toUpperCase();
            const wCount = Number(w.availableCount ?? w.seatCount ?? w.count ?? w.kalanKoltuk ?? 0);
            const wPrice = w.price ?? w.biletUcreti ?? "";
            if (wName.includes("TEKERLEK") || wName.includes("ENGEL") || w.disabled) {
              vDis += wCount;
            } else if (wName.includes("BUS")) {
              vBus += wCount;
              if (wPrice) pBus = String(wPrice);
            } else if (wName.includes("EKO") || wName.includes("PUL")) {
              vEko += wCount;
              if (wPrice) pEko = String(wPrice);
            }
          });
          if (vEko > 0 || vBus > 0) {
            return {
              hasWagons: true,
              totalSeats: vEko + vBus,
              ekonomiSeats: vEko,
              ekonomiPrice: pEko || "₺605,00",
              businessSeats: vBus,
              businessPrice: pBus || "₺910,00",
              isAvailable: true,
              disabledOnly: false
            };
          } else if (vDis > 0) {
            return { hasWagons: true, totalSeats: 0, isAvailable: false, disabledOnly: true };
          }
        }
      }
    } catch (e) { }

    // 2. DOM Çözümleme (textContent: Akordeon kapalı dahi olsa butonların içeriğini okur!)
    const rawAll = (card.textContent || card.innerText || "").replace(/\s+/g, " ");
    const wagonButtons = Array.from(card.querySelectorAll("button[selenium-test*='vagonType'], button.btnTicketType, button[id*='vagonType'], div.card, [class*='wagon'], [class*='vagon']"));

    let hasWagons = false;
    let businessSeats = 0;
    let businessPrice = "";
    let ekonomiSeats = 0;
    let ekonomiPrice = "";
    let disabledSeats = 0;

    wagonButtons.forEach(item => {
      // textContent kullanılır çünkü innerText kapalı (.collapse) bloklarda boş döner
      const itemTxt = (item.textContent || item.innerText || "").replace(/\s+/g, " ").trim();
      const upper = itemTxt.toUpperCase();

      const isWagon = upper.includes("BUSİNESS") || upper.includes("BUSINESS") || upper.includes("EKONOMİ") || upper.includes("EKONOMI") || upper.includes("TEKERLEKLİ") || upper.includes("SANDALYE");
      if (!isWagon) return;

      hasWagons = true;
      const isDolu = upper.includes("DOLU");
      const match = itemTxt.match(/\((\d+)\)/);
      const count = (!isDolu && match) ? parseInt(match[1], 10) : 0;
      const priceMatch = itemTxt.match(/₺\s*[\d\.,]+/);

      if (upper.includes("TEKERLEKLİ") || upper.includes("SANDALYE") || upper.includes("ENGELLİ")) {
        disabledSeats += count;
      } else if (upper.includes("BUSİNESS") || upper.includes("BUSINESS")) {
        businessSeats += count;
        if (priceMatch) businessPrice = priceMatch[0];
      } else if (upper.includes("EKONOMİ") || upper.includes("EKONOMI") || upper.includes("PULMAN")) {
        ekonomiSeats += count;
        if (priceMatch) ekonomiPrice = priceMatch[0];
      }
    });

    if (hasWagons) {
      const normalSeats = ekonomiSeats + businessSeats;
      if (normalSeats > 0) {
        return {
          hasWagons: true,
          totalSeats: normalSeats,
          ekonomiSeats: ekonomiSeats,
          ekonomiPrice: ekonomiPrice || "₺605,00",
          businessSeats: businessSeats,
          businessPrice: businessPrice || "₺910,00",
          isAvailable: true,
          disabledOnly: false
        };
      }

      // SADECE ENGELLİ / TEKERLEKLİ SANDALYE VARSA GENEL YOLCU İÇİN DOLU SAY!
      if (disabledSeats > 0 || (rawAll.includes("TEKERLEKLİ") && !rawAll.includes("DOLU"))) {
        return { hasWagons: true, totalSeats: 0, isAvailable: false, disabledOnly: true };
      }

      return { hasWagons: true, totalSeats: 0, isAvailable: false, disabledOnly: false };
    }

    // 3. Fallback: Kapalı kart başlığı ("Bilet Ücreti ₺605,00 (X)")
    const seatMatch = rawAll.match(/Bilet Ücreti[^\(]*\((\d+)\)/i) || rawAll.match(/\((\d+)\)\s*💺/i) || rawAll.match(/\((\d+)\)/);
    let count = seatMatch ? parseInt(seatMatch[1], 10) : 0;

    // Eğer kapalı kart içinde TEKERLEKLİ geçiyor ve ekonomi/business DOLU ise bu sayı engellidir
    const hasTekerlekli = rawAll.includes("TEKERLEKLİ") || rawAll.includes("SANDALYE");
    const isEkoDolu = rawAll.includes("EKONOMİ DOLU") || rawAll.includes("EKONOMI DOLU");
    const isBusDolu = rawAll.includes("BUSINESS DOLU") || rawAll.includes("BUSİNESS DOLU");

    if (hasTekerlekli && (isEkoDolu || isBusDolu || rawAll.includes("DOLU"))) {
      return { hasWagons: true, totalSeats: 0, isAvailable: false, disabledOnly: true };
    }

    const isAllDolu = rawAll.includes("DOLU") && count === 0;

    return {
      hasWagons: false,
      totalSeats: isAllDolu ? 0 : count,
      wagonLabel: "Ekonomi / Pulman",
      isAvailable: count > 0 && !isAllDolu,
      disabledOnly: false
    };

    return {
      hasWagons: false,
      totalSeats: isAllDolu ? 0 : count,
      wagonLabel: "Ekonomi / Pulman",
      isAvailable: count > 0 && !isAllDolu,
      disabledOnly: false
    };
  }

  // SADECE VE SADECE TREN KARTLARININ ÜZERİNDEKİ GERÇEK TARİHİ OKU (Mavi butona ASLA aldanma!)
  function getPageCardDay() {
    const rawCards = Array.from(document.querySelectorAll("[id^='gidis'], .card, .accordion-item"))
      .filter(c => {
        const t = (c.innerText || "").trim();
        return (t.includes("YHT:") || t.includes("ANAHAT") || t.includes("Bilet Ücreti")) && /\b([0-2]?\d:[0-5]\d)\b/.test(t);
      });

    for (const card of rawCards) {
      const txt = card.innerText || "";
      // Saatin hemen altındaki tarihi ara: örn "19.10.2026" veya "19-10-2026"
      const dateMatch = txt.match(/\b(\d{1,2})[\.\/\-]10[\.\/\-]2026\b/) || txt.match(/\b(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})\b/);
      if (dateMatch) return parseInt(dateMatch[1], 10);
    }

    return null;
  }

  async function ensurePageDate(targetDay) {
    const currentDay = getPageCardDay();
    if (currentDay === targetDay) {
      return true;
    }

    const carouselButtons = Array.from(document.querySelectorAll("button.slideArea, .slideArea"))
      .filter(b => !b.closest(".slick-cloned") && /\b([1-9]|[12]\d|3[01])\b/.test(b.innerText || ""));

    let btn = carouselButtons.find(b => {
      const m = b.innerText.replace(/\s+/g, " ").match(/(?:^|\b)(\d{1,2})(?:\b|$)/);
      return m && parseInt(m[1], 10) === targetDay;
    });

    if (!btn) {
      // Eğer carousel kaydırıcının dışında kalmışsa sağ/sol oka tıkla
      const slickNext = document.querySelector(".slick-next, button.slick-next, button[aria-label='Next']");
      const slickPrev = document.querySelector(".slick-prev, button.slick-prev, button[aria-label='Previous']");
      const fallbackDay = new Date().getDate();
      if (slickNext && targetDay > (currentDay || fallbackDay)) {
        slickNext.click();
        await sleep(200);
      } else if (slickPrev && targetDay < (currentDay || fallbackDay)) {
        slickPrev.click();
        await sleep(200);
      }
      btn = Array.from(document.querySelectorAll("button.slideArea, .slideArea"))
        .filter(b => !b.closest(".slick-cloned"))
        .find(b => {
          const m = b.innerText.replace(/\s+/g, " ").match(/(?:^|\b)(\d{1,2})(?:\b|$)/);
          return m && parseInt(m[1], 10) === targetDay;
        });
    }

    if (!btn) {
      console.warn(`⚠️ ${targetDay} gün butonu bulunamadı.`);
      return false;
    }

    const curMonthName = new Date().toLocaleDateString("tr-TR", { month: "long" });
    updatePanelStatus(`📅 ${targetDay} ${curMonthName} seferleri yükleniyor...`, true);
    btn.scrollIntoView({ block: "nearest", inline: "center" });
    btn.click();
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // TCDD KARTLARININ ÜZERİNDEKİ TARİH HEDEF GÜN OLANA KADAR SABIRLA BEKLE (Maksimum 20 saniye adaptif limit)
    const t0 = Date.now();
    let lastRetryClick = Date.now();

    while (Date.now() - t0 < 20000) {
      await sleep(100);
      const ekrandakiGun = getPageCardDay();
      if (ekrandakiGun === targetDay) {
        await sleep(200); // Vue render oturması için
        return true;
      }

      // Eğer 1.2 saniye geçtiyse ve hala hedef gün yüklenmediyse butona tekrar tıkla (Slick odaklanma takılmasını önler)
      if (Date.now() - lastRetryClick > 1200) {
        lastRetryClick = Date.now();
        const currentBtn = Array.from(document.querySelectorAll("button.slideArea, .slideArea"))
          .filter(b => !b.closest(".slick-cloned"))
          .find(b => {
            const m = b.innerText.replace(/\s+/g, " ").match(/(?:^|\b)(\d{1,2})(?:\b|$)/);
            return m && parseInt(m[1], 10) === targetDay;
          }) || btn;
        if (currentBtn) {
          console.log(`🔄 ${targetDay} ${curMonthName} butonuna tekrar tıklanıyor...`);
          currentBtn.click();
          currentBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      }

      // Eğer TCDD o gün için hiç sefer olmadığını belirten mesaj verdiyse (en az 1.5 sn sonra):
      if (Date.now() - t0 > 1500) {
        const accordionTxt = document.querySelector("#accordionSefer")?.innerText || "";
        if (accordionTxt.includes("sefer bulunamadı") || accordionTxt.includes("sefer bulunamamıştır") || accordionTxt.includes("uygun sefer")) {
          return true;
        }
      }
    }

    return true;
  }

  // 6. IŞIK HIZINDA KOLTUK SEÇİMİ VE 4. GÖRSEL KOLTUK HARİTASINA GEÇİŞ
  async function highlightAndSelectTrain(train) {
    if (!train) return;
    console.log("⚡ Koltuk seçimine gidiliyor:", train);
    showInPageToast(`⏳ ${train.date || ''} ${train.trainName || 'Tren'} koltuğuna gidiliyor...`);
    updatePanelStatus(`⏳ ${train.date || ''} ${train.trainName || 'Tren'} koltuğuna gidiliyor...`, true);

    try {
      // Eğer sefer-listesi sayfasında değilsek:
      if (!window.location.pathname.includes("sefer-listesi")) {
        console.log("Sefer listesi sayfasında değiliz, yönlendiriliyor...", train);
        await chrome.storage.local.set({ pendingTrainToSelect: train });

        // 1. Koltuk Haritası sayfasındaysak "Geri" butonuna basarak Sefer Listesine dön
        if (window.location.pathname.includes("koltuk-haritasi") || document.querySelector("button.btnPrev, .btnPrev")) {
          const geriBtn = document.querySelector("button.btnPrev, .btnPrev") ||
            Array.from(document.querySelectorAll("button, a.btn, a")).find(b => {
              const txt = (b.innerText || "").trim().toUpperCase();
              return txt.includes("GERİ") || txt.includes("GERI");
            });

          if (geriBtn) {
            console.log("👉 'Geri' butonuna basılarak sefer listesine dönülüyor:", geriBtn);
            geriBtn.click();
            geriBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          } else if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = "https://ebilet.tcddtasimacilik.gov.tr/sefer-listesi";
          }

          // Sayfa içi SPA geçişini hızlıca bekle (Sefer listesi tekrar yüklenene kadar)
          const waitStart = Date.now();
          while (Date.now() - waitStart < 4000) {
            await sleep(40);
            if (window.location.pathname.includes("sefer-listesi") || document.querySelector("[id^='gidis']")) {
              await sleep(80);
              break;
            }
          }
          await chrome.storage.local.remove(["pendingTrainToSelect"]);
        } else {
          // 2. Ana sayfadaysak bilet arama formunu doldur
          const stored = await chrome.storage.local.get(["fromStation", "toStation"]);
          await fillAndSubmitSearchForm({
            fromStation: stored.fromStation,
            toStation: stored.toStation,
            startDate: train.date
          });
          return;
        }
      }

      // 1. Tarih Kontrolü ve Kesin Geçiş
      let targetDayNo = null;
      if (train.date) {
        if (train.date.includes(".")) targetDayNo = parseInt(train.date.split(".")[0], 10);
        else if (train.date.includes("-")) {
          const parts = train.date.split("-");
          targetDayNo = parseInt(parts[parts.length - 1] || parts[0], 10);
        } else {
          const m = train.date.match(/\b\d{1,2}\b/);
          if (m) targetDayNo = parseInt(m[0], 10);
        }
      }

      if (targetDayNo) {
        await ensurePageDate(targetDayNo);
        await sleep(150);
      }

      // 2. Hedef tren kartını nokta atışı bul (gidis0, gidis1, gidis2...)
      const trainNum = train.trainNum || ((train.trainName || "").match(/\b\d{4,5}\b/) ? (train.trainName || "").match(/\b\d{4,5}\b/)[0] : "");
      const depTime = (train.time || "").split(" ")[0].split("➔")[0].trim();

      console.log(`🎯 Tren kartı aranıyor: Num=${trainNum}, Kalkış Saati=${depTime}`);

      let targetCard = null;
      for (let retry = 0; retry < 30; retry++) {
        const mainCards = Array.from(document.querySelectorAll("[id^='gidis']")).filter(el => /^gidis\d+$/.test(el.id));

        // 1. Öncelik: Kalkış saati (ilk saat) ve Tren No eşleşmesi
        targetCard = mainCards.find(c => {
          const txt = c.innerText || "";
          const times = Array.from(txt.matchAll(/\b([0-2]?\d:[0-5]\d)\b/g)).map(m => m[0]);
          const matchTime = depTime && times[0] === depTime;
          const matchNum = trainNum && txt.includes(trainNum);
          return matchTime && matchNum;
        });

        // 2. Öncelik: Sadece kalkış saatine göre tam eşleşme (Örn: 18:00 veya 18:40)
        if (!targetCard && depTime) {
          targetCard = mainCards.find(c => {
            const times = Array.from((c.innerText || "").matchAll(/\b([0-2]?\d:[0-5]\d)\b/g)).map(m => m[0]);
            return times[0] === depTime;
          });
        }

        // 3. Öncelik: Tren numarasına göre
        if (!targetCard && trainNum) {
          targetCard = mainCards.find(c => (c.innerText || "").includes(trainNum));
        }

        // 4. Öncelik: Alternatif arama (Genel kartlar)
        if (!targetCard) {
          const altCards = Array.from(document.querySelectorAll(".card, .accordion-item")).filter(c => {
            const t = c.innerText || "";
            return (trainNum && t.includes(trainNum)) || (depTime && t.includes(depTime));
          });
          if (altCards.length > 0) targetCard = altCards[0];
        }

        if (targetCard) break;
        await sleep(100);
      }

      if (!targetCard) {
        console.warn("Hedef tren kartı bulunamadı:", train);
        showInPageToast(`⚠️ ${train.trainName || 'Tren'} (${depTime}) bu tarihte bulunamadı.`);
        updatePanelStatus(`⚠️ Tren kartı bulunamadı`, false);
        return;
      }

      const kartId = targetCard.id; // Örn: "gidis3"
      console.log(`%c✅ Hedef Tren Kartı Bulundu: ${kartId} (${depTime})`, "color: #3fb950; font-weight: bold;");

      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      targetCard.style.outline = "4px solid #3fb950";
      targetCard.style.boxShadow = "0 0 35px rgba(63, 185, 80, 0.95)";

      // 3. O trene özel açma butonuna tıkla (Örn: gidis3btn)
      const collapseEl = targetCard.querySelector(".collapse");
      const isAlreadyOpen = (collapseEl && collapseEl.classList.contains("show")) || targetCard.innerText.includes("Vagon tipini seçin");
      if (!isAlreadyOpen) {
        const openBtn = document.getElementById(kartId + "btn") ||
          targetCard.querySelector("button[id*='btn'], button.btn-link, button.collapsed") ||
          targetCard;
        console.log(`👉 ${kartId} açma butonuna tıklanıyor:`, openBtn);
        openBtn.click();
        openBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        // İçerik butonlarının DOM'da belirmesini bekle (en fazla 1500ms)
        const openStart = Date.now();
        while (Date.now() - openStart < 1500) {
          if (targetCard.querySelector("button[selenium-test*='vagonType'], [id*='vagonType'], button.btnTicketType, button[selenium-test*='btn-gidis']")) {
            break;
          }
          await sleep(40);
        }
        await sleep(100);
      }

      // 4. İstenen vagonu belirle (EKONOMİ veya BUSINESS)
      const targetWagon = (train.targetWagon || train.wagonType || "EKONOMİ").toUpperCase();
      console.log(`Hedef vagon: ${targetWagon}`);

      // Bekleyen seçimi kaydet (koltuk haritasında vagon sekmesini açmak için)
      await chrome.storage.local.set({
        pendingWagonSelection: {
          wagonType: targetWagon,
          trainName: train.trainName,
          time: train.time,
          date: train.date
        }
      });

      // 5. TEK TIKLAMADA KESİN GEÇİŞ: Vagon kutusunu seç, kırmızı 'Seçin' butonunu bekle ve tıkla!
      let successNavigated = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        console.log(`🚀 Koltuk haritasına geçiş denemesi ${attempt}/4 (${targetWagon})...`);

        // Vagon kutusuna tıkla
        await selectWagonBox(targetCard, targetWagon);

        // Kırmızı 'Seçin' butonunun aktifleşmesini bekle (en fazla 1200ms)
        const waitSecin = Date.now();
        let secinBtn = null;
        while (Date.now() - waitSecin < 1200) {
          secinBtn = targetCard.querySelector(`[selenium-test='btn-${kartId}'], button.btn-danger.btn-lg`) ||
            document.querySelector(`[selenium-test='btn-${kartId}']`) ||
            targetCard.querySelector("button[selenium-test*='btn-gidis']") ||
            Array.from(targetCard.querySelectorAll("button, a.btn")).find(b => (b.innerText || "").trim().toUpperCase() === "SEÇİN");

          if (secinBtn && !secinBtn.disabled) break;
          await sleep(50);
        }

        // 'Seçin' butonuna tam teşekküllü tıkla
        if (secinBtn) {
          console.log(`👉 'Seçin' butonuna tıklandı:`, secinBtn);
          secinBtn.scrollIntoView({ block: "nearest" });
          secinBtn.focus();
          secinBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          secinBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          secinBtn.click();
          secinBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }

        // Varsa TCDD 'Devam Et' butonuna tıkla
        const devamBtn = document.querySelector("button.btnContinue, .btnContinue, button[selenium-test*='continue']");
        if (devamBtn && devamBtn.offsetWidth > 0) {
          console.log("👉 'Devam Et' butonuna tıklandı:", devamBtn);
          devamBtn.click();
          devamBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }

        // Koltuk haritasına yönlenme başladı mı kontrol et (en fazla 1500ms)
        const checkStart = Date.now();
        while (Date.now() - checkStart < 1500) {
          await sleep(60);
          if (window.location.pathname.includes("koltuk-haritasi") ||
            document.querySelector(".seatPlan, .wagonItem, div[class*='wagon'], div[class*='vagon']")) {
            successNavigated = true;
            break;
          }
        }

        if (successNavigated) {
          console.log("🎉 Koltuk haritasına başarıyla geçildi!");
          break;
        }

        console.warn(`⚠️ Deneme ${attempt} sonrası koltuk haritasına geçilmedi, vagon ve seçim yenileniyor...`);
        await sleep(150);
      }

      showInPageToast(`🚀 ${targetWagon} vagonu seçildi! Koltuk haritası açılıyor...`);
      updatePanelStatus(`🚀 ${targetWagon} seçildi, koltuk haritası açılıyor!`, true);

    } catch (err) {
      console.error("Koltuk seçimi hatası:", err);
      showInPageToast("⚠️ Koltuk seçimi sırasında hata: " + err.message);
      updatePanelStatus("⚠️ Hata: " + err.message, false);
    }
  }

  // Vagon Kutusunu (Ekonomi / Business) Tıklayarak Seçen Fonksiyon
  async function selectWagonBox(card, targetWagonName) {
    const isTargetBusiness = targetWagonName.toUpperCase().includes("BUS");

    // 1. Vagon seçeneği butonunu bul (Exact selenium-test selector)
    let targetBox = null;
    if (isTargetBusiness) {
      targetBox = card.querySelector("button[selenium-test*='vagonType-1-'], [id*='vagonType-1-']");
    } else {
      targetBox = card.querySelector("button[selenium-test*='vagonType-2'], [id*='vagonType-2']");
    }

    if (!targetBox) {
      const candidateBoxes = Array.from(card.querySelectorAll("button.btnTicketType, button, div, [class*='wagon'], [class*='vagon']")).filter(el => {
        const txt = (el.innerText || "").trim().toUpperCase();
        const sel = (el.getAttribute("selenium-test") || "").toLowerCase();
        const matches = isTargetBusiness ?
          (sel.includes("vagontype-1-") || txt.startsWith("BUSİNESS") || txt.startsWith("BUSINESS") || (txt.includes("BUS") && !txt.includes("DOLU"))) :
          (sel.includes("vagontype-2-") || txt.startsWith("EKONOMİ") || txt.startsWith("EKONOMI") || (txt.includes("EKO") && !txt.includes("DOLU")));
        return matches && !txt.includes("DOLU");
      });
      targetBox = candidateBoxes.find(el => (el.innerText || "").includes("₺")) || candidateBoxes[0];
    }

    if (targetBox) {
      console.log(`✅ Vagon kutusuna tıklandı (${targetWagonName}):`, targetBox);
      targetBox.scrollIntoView({ block: "nearest" });
      targetBox.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      targetBox.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      targetBox.click();
      targetBox.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await sleep(100);
      return true;
    }
    return false;
  }

  // Kırmızı 'Seçin' Butonuna ve Varsa 'Devam Et' Butonuna Tıklayan Fonksiyon
  async function clickSecinVeDevamEt(card) {
    const cardId = card.id || "";
    // 1. Bu karta özel kırmızı "Seçin" butonu (Örn: selenium-test="btn-gidis3")
    let secinBtn = card.querySelector(`[selenium-test='btn-${cardId}'], button.btn-danger.btn-lg`) ||
      document.querySelector(`[selenium-test='btn-${cardId}']`) ||
      card.querySelector("button[selenium-test*='btn-gidis']") ||
      Array.from(card.querySelectorAll("button, a.btn")).find(b => (b.innerText || "").trim().toUpperCase() === "SEÇİN");

    if (secinBtn) {
      console.log("👉 Kırmızı 'Seçin' butonuna tıklandı:", secinBtn);
      secinBtn.scrollIntoView({ block: "nearest" });
      secinBtn.focus();
      secinBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      secinBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      secinBtn.click();
      secinBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await sleep(100);
    }

    // 2. Varsa TCDD 'Devam Et' butonu (.btnContinue)
    const devamBtn = document.querySelector("button.btnContinue, .btnContinue, button[selenium-test*='continue']");
    if (devamBtn && devamBtn.offsetWidth > 0) {
      console.log("👉 'Devam Et' butonuna tıklandı:", devamBtn);
      devamBtn.click();
      devamBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }

  // 7. KOLTUK HARİTASI SAYFASI YÖNETİMİ (4. Görsel)
  async function handleKoltukHaritasiPage() {
    console.log("Koltuk haritası sayfasındayız (/koltuk-haritasi)!");
    chrome.storage.local.get(["pendingWagonSelection"], async (data) => {
      if (data.pendingWagonSelection) {
        const target = data.pendingWagonSelection;
        console.log("Hedef vagon haritada seçiliyor:", target);

        const isBus = (target.wagonType || "").toUpperCase().includes("BUS");

        // Vagon sekmesini hızlıca bekle ve tıkla (en fazla 1.5 saniye)
        const waitK = Date.now();
        while (Date.now() - waitK < 1500) {
          const wagonHeaders = Array.from(document.querySelectorAll("button, div[class*='wagon'], div[class*='vagon'], .wagonItem, .vagonItem, li"));
          const matchingHeader = wagonHeaders.find(w => {
            const txt = (w.innerText || "").toUpperCase();
            return isBus ? (txt.includes("BUSINESS") || txt.includes("BUSİNESS")) : (txt.includes("EKONOMİ") || txt.includes("EKONOMI"));
          });
          if (matchingHeader) {
            console.log("Koltuk haritasında vagon sekmesine tıklandı:", matchingHeader.innerText.replace(/\s+/g, ' '));
            matchingHeader.click();
            matchingHeader.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            break;
          }
          await sleep(35);
        }

        showInPageToast(`🎉 Koltuk Haritası Açıldı! (${target.wagonType}) Lütfen oturmak istediğiniz boş koltuğa tıklayın.`);
        chrome.storage.local.remove(["pendingWagonSelection"]);
      }
    });
  }

  function showInPageToast(message) {
    const existing = document.getElementById("tcdd-inpage-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "tcdd-inpage-toast";
    toast.className = "tcdd-inpage-toast";
    toast.innerHTML = `
      <div class="tcdd-toast-content">
        <span class="tcdd-toast-icon">🚨</span>
        <span class="tcdd-toast-text">${message}</span>
      </div>
      <button type="button" class="tcdd-toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    toast.querySelector(".tcdd-toast-close").addEventListener("click", () => {
      toast.remove();
    });

    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 15000);
  }

  // 8. CLOUDFLARE TURNSTILE GÜVENLİK DOĞRULAMASI YÖNETİCİSİ
  async function checkAndHandleCloudflare() {
    const isCf = document.body.innerText.includes("Güvenlik Doğrulaması") ||
      document.body.innerText.includes("Gerçek kişi olduğunuzu doğrulayın") ||
      document.querySelector("iframe[src*='challenges.cloudflare.com'], iframe[src*='turnstile'], .cf-turnstile");

    if (!isCf) return false;

    console.warn("🚨 Cloudflare Güvenlik Doğrulaması tespit edildi!");
    updatePanelStatus("🚨 <b>GÜVENLİK DOĞRULAMASI!</b> Lütfen kutucuğu işaretleyin...", false);
    showInPageToast("🚨 Güvenlik Doğrulaması Çıktı! Lütfen kutucuğu işaretleyin. Doğrulama bitince tarama otomatik devam edecektir.");
    playAudioAlert();

    // Otomatik tıklama denemesi (Mümkünse)
    tryAutoClickTurnstile();

    // Kullanıcı doğrulamayı geçene kadar bekle (Maksimum 60 sn)
    const startW = Date.now();
    while (Date.now() - startW < 60000) {
      await sleep(500);
      tryAutoClickTurnstile();
      const stillPresent = document.body.innerText.includes("Güvenlik Doğrulaması") ||
        document.body.innerText.includes("Gerçek kişi olduğunuzu doğrulayın") ||
        document.querySelector("iframe[src*='challenges.cloudflare.com']:not([style*='display: none'])");
      if (!stillPresent) {
        console.log("✅ Güvenlik doğrulaması aşıldı! İşleme devam ediliyor.");
        updatePanelStatus("✅ Doğrulama aşıldı, devam ediliyor...", true);
        await sleep(500);
        return true;
      }
    }
    return false;
  }

  function tryAutoClickTurnstile() {
    try {
      const iframes = Array.from(document.querySelectorAll("iframe[src*='cloudflare'], iframe[src*='turnstile']"));
      for (const iframe of iframes) {
        iframe.focus();
        iframe.click();
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          if (doc) {
            const cb = doc.querySelector("input[type='checkbox'], #cf-stage input, .ctp-checkbox-label, [role='checkbox']");
            if (cb) {
              cb.click();
              console.log("🎯 Cloudflare kutucuğu tıklandı!");
            }
          }
        } catch (e) { }
      }
    } catch (err) { }
  }

  // =========================================================================
  // 9. TCDD E-POSTA İLE OTOMATİK KULLANICI GİRİŞİ SİSTEMİ
  // =========================================================================
  async function checkAndPerformAutoLogin() {
    try {
      const stored = await chrome.storage.local.get(["autoLoginEnabled", "tcddEmail", "tcddPassword"]);
      if (!stored.autoLoginEnabled || !stored.tcddEmail || !stored.tcddPassword) {
        return false;
      }

      // 1. Zaten oturum açılmış mı kontrol et
      if (isUserAlreadyLoggedIn()) {
        console.log("👤 TCDD: Kullanıcı oturumu zaten açık.");
        return true;
      }

      // 2. Döngü koruması: Çok fazla başarısız denemeyi engelle
      const attempts = parseInt(sessionStorage.getItem("tcdd_login_attempt_count") || "0", 10);
      if (attempts >= 4) {
        return false;
      }

      // 3. Ekranda giriş inputları mevcut mu kontrol et
      let inputs = findLoginInputs();

      // Form görünmüyorsa "Giriş Yap" butonuna basarak modalı açmayı dene
      if (!inputs.email || !inputs.password) {
        const opened = tryOpenLoginModal();
        if (opened) {
          await sleep(600);
          inputs = findLoginInputs();
        }
      }

      if (!inputs.email || !inputs.password) {
        return false;
      }

      // 4. "Üye Girişi" sekmesini aktif et (e-Devlet sekmesindeyse)
      ensureUyeGirisiTabActive();
      await sleep(150);

      // Inputları tekrar tazele
      inputs = findLoginInputs();
      if (!inputs.email || !inputs.password) return false;

      // 5. Zaten doldurulmuş mu kontrol et
      if (inputs.email.value === stored.tcddEmail && inputs.password.value.length > 0) {
        return true;
      }

      sessionStorage.setItem("tcdd_login_attempt_count", String(attempts + 1));
      console.log(`👤 TCDD Otomatik Giriş başlatılıyor: ${stored.tcddEmail}`);
      showInPageToast(`👤 TCDD hesabına otomatik giriş yapılıyor (${stored.tcddEmail})...`);
      updatePanelStatus(`👤 TCDD hesabına giriş yapılıyor...`, true);

      // 6. Vue reaktivitesi için Native Setter ile değerleri yerleştir
      setNativeInputValue(inputs.email, stored.tcddEmail);
      await sleep(150);
      setNativeInputValue(inputs.password, stored.tcddPassword);
      await sleep(250);

      // 7. Giriş Yap / Submit butonunu bul ve tıkla
      const submitBtn = findLoginSubmitBtn(inputs.email);
      if (submitBtn) {
        console.log("👉 TCDD 'Giriş Yap' butonuna tıklandı:", submitBtn);
        submitBtn.scrollIntoView({ block: "nearest" });
        submitBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        submitBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        submitBtn.click();
        submitBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        showInPageToast(`✅ TCDD Giriş Formu Gönderildi! Lütfen bekleyin...`);
        updatePanelStatus(`✅ TCDD Giriş yapılıyor...`, true);

        // Giriş sonrası modalın kapanmasını / kullanıcı profilinin gelmesini bekle
        setTimeout(() => {
          if (isUserAlreadyLoggedIn()) {
            showInPageToast(`🎉 TCDD Hesabına Başarıyla Giriş Yapıldı!`);
            updatePanelStatus(`🎉 TCDD Hesabı Açık (${stored.tcddEmail})`, true);
          }
        }, 2500);

        return true;
      }
    } catch (err) {
      console.error("checkAndPerformAutoLogin hatası:", err);
    }
    return false;
  }

  function isUserAlreadyLoggedIn() {
    const headerEl = document.querySelector("header, nav, .navbar, .top-header, #header") || document.body;
    const txt = (headerEl ? headerEl.innerText : document.body.innerText) || "";

    if (txt.includes("Çıkış Yap") || txt.includes("Çıkış") || txt.includes("Hesabım") || txt.includes("Profilim")) {
      const hasLoginBtn = Array.from(document.querySelectorAll("header button, nav button, header a, nav a, .navbar a, .navbar button"))
        .some(el => {
          const t = (el.innerText || "").trim().toUpperCase();
          return t === "GİRİŞ YAP" || t === "GİRİŞ" || t === "ÜYE GİRİŞİ";
        });
      if (!hasLoginBtn) return true;
    }

    const userProfileEl = document.querySelector("[selenium-test*='profile'], [selenium-test*='user-name'], .user-profile, .user-name, .profile-name, [class*='userDropdown']");
    if (userProfileEl && userProfileEl.innerText.trim().length > 1) {
      return true;
    }

    return false;
  }

  function findLoginInputs() {
    const isVisible = (el) => {
      if (!el) return false;
      return el.offsetWidth > 0 || el.offsetHeight > 0 || (el.offsetParent !== null && window.getComputedStyle(el).display !== "none");
    };

    const emailSelectors = [
      "input[type='email']",
      "input[selenium-test*='email' i]",
      "input[selenium-test*='username' i]",
      "input[selenium-test*='kullanici' i]",
      "input[name*='email' i]",
      "input[name*='username' i]",
      "input[id*='email' i]",
      "input[id*='username' i]",
      "input[placeholder*='posta' i]",
      "input[placeholder*='kullanıcı' i]",
      "input[placeholder*='e-mail' i]",
      "input[type='text'][autocomplete*='username' i]"
    ];

    let emailInput = null;
    for (const sel of emailSelectors) {
      const candidates = Array.from(document.querySelectorAll(sel));
      emailInput = candidates.find(isVisible) || candidates[0];
      if (emailInput && isVisible(emailInput)) break;
    }

    const passSelectors = [
      "input[type='password']",
      "input[selenium-test*='password' i]",
      "input[selenium-test*='sifre' i]",
      "input[name*='password' i]",
      "input[name*='sifre' i]",
      "input[id*='password' i]",
      "input[id*='sifre' i]",
      "input[placeholder*='şifre' i]",
      "input[placeholder*='sifre' i]"
    ];

    let passwordInput = null;
    for (const sel of passSelectors) {
      const candidates = Array.from(document.querySelectorAll(sel));
      passwordInput = candidates.find(isVisible) || candidates[0];
      if (passwordInput && isVisible(passwordInput)) break;
    }

    return { email: emailInput, password: passwordInput };
  }

  function tryOpenLoginModal() {
    const loginCandidates = Array.from(document.querySelectorAll("header button, header a, nav button, nav a, .navbar button, .navbar a, [selenium-test*='login' i], [selenium-test*='giris' i], button.btnLogin, #btnLogin, a.btn-login, button, a"));
    const btn = loginCandidates.find(el => {
      const t = (el.innerText || el.textContent || "").trim().toUpperCase();
      const sel = (el.getAttribute("selenium-test") || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      const cls = (el.className || "").toLowerCase();

      if (sel.includes("login") || sel.includes("giris") || id.includes("login") || cls.includes("login")) return true;
      return t === "GİRİŞ YAP" || t === "ÜYE GİRİŞİ" || t === "GİRİŞ";
    });

    if (btn) {
      console.log("👉 Giriş Yap butonuna tıklandı:", btn);
      btn.click();
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  }

  function ensureUyeGirisiTabActive() {
    const tabs = Array.from(document.querySelectorAll("button, a, .nav-link, [role='tab'], li"));
    const uyeTab = tabs.find(t => {
      const txt = (t.innerText || "").trim().toUpperCase();
      return txt === "ÜYE GİRİŞİ" || txt.includes("ÜYE GİRİŞ");
    });
    if (uyeTab) {
      const isActive = uyeTab.classList.contains("active") || uyeTab.getAttribute("aria-selected") === "true";
      if (!isActive) {
        console.log("👉 'Üye Girişi' sekmesi seçildi");
        uyeTab.click();
        uyeTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }
  }

  function setNativeInputValue(element, value) {
    if (!element) return;
    element.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true }));
    element.blur();
  }

  function findLoginSubmitBtn(nearElement) {
    const formOrModal = nearElement?.closest("form, .modal, .modal-content, [role='dialog'], .login-container, .card") || document;
    const btns = Array.from(formOrModal.querySelectorAll("button, input[type='submit'], a.btn"));

    let btn = btns.find(b => {
      const sel = (b.getAttribute("selenium-test") || "").toLowerCase();
      const type = (b.getAttribute("type") || "").toLowerCase();
      return sel.includes("login-btn") || sel.includes("btn-login") || sel.includes("btnlogin") || (type === "submit" && !b.disabled);
    });

    if (!btn) {
      btn = btns.find(b => {
        const txt = (b.innerText || b.value || "").trim().toUpperCase();
        return (txt === "GİRİŞ YAP" || txt === "GİRİŞ" || txt.includes("GİRİŞ YAP")) && !b.disabled;
      });
    }

    return btn;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
