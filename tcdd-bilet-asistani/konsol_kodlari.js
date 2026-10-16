/**
 * 🚄 TCDD BİLET AVCISI - F12 KONSOL CANLI SEFER & SAAT TARAYICI
 * 
 * KULLANIM:
 * 1. ebilet.tcddtasimacilik.gov.tr/sefer-listesi sayfasındayken F12 tuşuna basın.
 * 2. "Console" (Konsol) sekmesini açın.
 * 3. Bu kodun TAMAMINI kopyalayıp yapıştırın ve Enter'a basın.
 * 
 * ÖZELLİKLER:
 * - İstediğiniz tek bir günü (Örn: 16 Ekim) veya tarih aralığını (Örn: 14 - 30 Ekim) tarar.
 * - Saat filtresi: "Akşam (18:00 - 23:59)", "Sabah", "Öğle" veya "Tüm Gün".
 * - Her taramada eski sonuçları tertemiz eder, sadece filtrenize uyan trenleri listeler.
 * - Ekonomi (₺605) ve Business (₺910) biletlerini ayrı ayrı gösterir.
 * - Koltuğa Git butonuna tıklandığında treni açar, vagonu seçer ve doğrudan 4. görseldeki koltuk haritasına (/koltuk-haritasi) yönlendirir!
 */

(function tcddKonsolAvcisiBaslat() {
  // Önceki paneli ve zamanlayıcıları temizle
  const eskiPanel = document.getElementById("tcdd-pro-panel");
  if (eskiPanel) eskiPanel.remove();
  if (window._tcddTimerId) clearTimeout(window._tcddTimerId);

  console.clear();
  console.log("%c=======================================================", "color: #e30613;");
  console.log("%c🚄 TCDD BİLET AVCISI (F12 GELİŞMİŞ MOD) BAŞLATILDI!", "color: #e30613; font-size: 16px; font-weight: bold;");
  console.log("%cEkranın sağ üst köşesindeki panelden tarih ve saat filtresini yönetebilirsiniz.", "color: #388bfd; font-size: 13px;");
  console.log("%c=======================================================", "color: #e30613;");

  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  // Durum Yönetimi
  const bugun = new Date();
  const bugunGunu = bugun.getDate();
  const ayinSonGunu = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0).getDate();
  const varsayilanBitis = Math.min(bugunGunu + 14, ayinSonGunu);
  const suankiAyAdi = bugun.toLocaleDateString("tr-TR", { month: "long" });

  window._tcddState = {
    calisiyor: false,
    durduruldu: false,
    baslangicGunu: bugunGunu,
    bitisGunu: varsayilanBitis,
    saatFiltresi: "evening",
    tekrarDakika: 0,
    bulunanlar: []
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 🔔 Sesli Alarm (Web Audio API)
  function alarmCal() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const sesler = [
        { f: 587.33, t: 0.00, d: 0.2 },
        { f: 880.00, t: 0.22, d: 0.2 },
        { f: 1174.66, t: 0.44, d: 0.4 },
        { f: 880.00, t: 0.88, d: 0.2 },
        { f: 1174.66, t: 1.10, d: 0.5 }
      ];
      sesler.forEach(s => {
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

  // 🖥️ Sağ Üst Yüzen Kontrol Paneli
  const panel = document.createElement("div");
  panel.id = "tcdd-pro-panel";
  panel.style.cssText = `
    position: fixed; top: 15px; right: 15px; width: 380px; max-height: 90vh;
    background: #0d1117; border: 2px solid #e30613; border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.85); z-index: 999999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #e6edf3; display: flex; flex-direction: column; overflow: hidden;
  `;

  panel.innerHTML = `
    <div style="background: linear-gradient(135deg, #e30613 0%, #a0000a 100%); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">🚄</span>
        <span style="font-weight: bold; font-size: 13px; color: #fff;">TCDD BİLET AVCISI</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button id="tcdd-btn-minimize" style="background: rgba(255,255,255,0.2); border: none; color: #fff; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">−</button>
        <button id="tcdd-btn-close" style="background: rgba(255,255,255,0.2); border: none; color: #fff; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">&times;</button>
      </div>
    </div>

    <div id="tcdd-panel-content" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
      <div style="padding: 10px 14px; background: #161b22; border-bottom: 1px solid #30363d;">
        <!-- Gün Aralığı -->
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <div style="flex: 1;">
            <label style="display:block; font-size: 10px; color: #8b949e; margin-bottom: 2px;">BAŞLANGIÇ GÜNÜ</label>
            <input type="number" id="tcdd-input-start" value="${bugunGunu}" min="${bugunGunu}" max="${ayinSonGunu}" style="width: 100%; box-sizing: border-box; background: #21262d; border: 1px solid #30363d; color: #fff; padding: 5px 6px; border-radius: 4px; font-size: 12px; font-weight: bold;">
          </div>
          <div style="flex: 1;">
            <label style="display:block; font-size: 10px; color: #8b949e; margin-bottom: 2px;">BİTİŞ GÜNÜ</label>
            <input type="number" id="tcdd-input-end" value="${varsayilanBitis}" min="${bugunGunu}" max="${ayinSonGunu}" style="width: 100%; box-sizing: border-box; background: #21262d; border: 1px solid #30363d; color: #fff; padding: 5px 6px; border-radius: 4px; font-size: 12px; font-weight: bold;">
          </div>
        </div>

        <!-- Saat Filtresi & Tekrar -->
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <div style="flex: 2;">
            <label style="display:block; font-size: 10px; color: #8b949e; margin-bottom: 2px;">SAAT TERCİHİ</label>
            <select id="tcdd-select-time" style="width: 100%; box-sizing: border-box; background: #21262d; border: 1px solid #30363d; color: #fff; padding: 5px 6px; border-radius: 4px; font-size: 12px;">
              <option value="evening" selected>Akşam (18:00 - 23:59)</option>
              <option value="all">Tüm Gün (Farketmez)</option>
              <option value="morning">Sabah (06:00 - 12:00)</option>
              <option value="afternoon">Öğleden Sonra (12:00 - 18:00)</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display:block; font-size: 10px; color: #8b949e; margin-bottom: 2px;">TEKRAR (DK)</label>
            <select id="tcdd-select-repeat" style="width: 100%; box-sizing: border-box; background: #21262d; border: 1px solid #30363d; color: #fff; padding: 5px 6px; border-radius: 4px; font-size: 12px;">
              <option value="0" selected>Tek Sefer</option>
              <option value="2">2 Dakika</option>
              <option value="5">5 Dakika</option>
              <option value="10">10 Dakika</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="tcdd-btn-start" style="flex: 2; background: #238636; border: none; color: #fff; font-weight: bold; font-size: 12px; padding: 8px; border-radius: 6px; cursor: pointer;">
            ⚡ Şimdi Tara
          </button>
          <button id="tcdd-btn-clear" style="flex: 1; background: #21262d; border: 1px solid #30363d; color: #c9d1d9; font-size: 11px; padding: 8px; border-radius: 6px; cursor: pointer;">
            🧹 Temizle
          </button>
        </div>
      </div>

      <div style="padding: 8px 14px; background: #1c2128; font-size: 11px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center;">
        <span id="tcdd-status-text" style="color: #58a6ff;">Hazır. "Şimdi Tara" butonuna basın.</span>
        <span id="tcdd-countdown-badge" style="display: none; background: #388bfd33; color: #58a6ff; padding: 2px 6px; border-radius: 10px; font-weight: bold; font-size: 10px;"></span>
      </div>

      <!-- Sonuç Listesi -->
      <div style="padding: 8px 14px; font-size: 11px; font-weight: bold; color: #8b949e; display: flex; justify-content: space-between; background: #0d1117;">
        <span>BULUNAN BOŞ SEFERLER</span>
        <span id="tcdd-found-count" style="background: #238636; color: #fff; padding: 1px 6px; border-radius: 10px;">0</span>
      </div>

      <div id="tcdd-results-list" style="padding: 10px 14px; overflow-y: auto; max-height: 380px; display: flex; flex-direction: column; gap: 8px; background: #0d1117;">
        <div id="tcdd-empty-state" style="text-align: center; padding: 20px 10px; color: #8b949e; font-size: 12px;">
          🔍 Henüz boş koltuk yakalanmadı.<br>Tarama başlatıldığında uygun biletler burada listelenir.
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Panel Kontrolleri
  const panelContent = document.getElementById("tcdd-panel-content");
  const btnMin = document.getElementById("tcdd-btn-minimize");
  const btnClose = document.getElementById("tcdd-btn-close");
  const btnStart = document.getElementById("tcdd-btn-start");
  const btnClear = document.getElementById("tcdd-btn-clear");
  const statusText = document.getElementById("tcdd-status-text");
  const countdownBadge = document.getElementById("tcdd-countdown-badge");
  const foundCount = document.getElementById("tcdd-found-count");
  const resultsList = document.getElementById("tcdd-results-list");
  const inputStart = document.getElementById("tcdd-input-start");
  const inputEnd = document.getElementById("tcdd-input-end");
  const selectTime = document.getElementById("tcdd-select-time");
  const selectRepeat = document.getElementById("tcdd-select-repeat");

  btnMin.onclick = () => {
    const isMin = panelContent.style.display === "none";
    panelContent.style.display = isMin ? "flex" : "none";
    btnMin.textContent = isMin ? "−" : "+";
  };

  btnClose.onclick = () => {
    window._tcddState.durduruldu = true;
    window._tcddState.calisiyor = false;
    panel.remove();
    console.log("TCDD Paneli kapatıldı.");
  };

  function sonuclariTemizle() {
    window._tcddState.bulunanlar = [];
    resultsList.innerHTML = `
      <div id="tcdd-empty-state" style="text-align: center; padding: 20px 10px; color: #8b949e; font-size: 12px;">
        🔍 Henüz boş koltuk yakalanmadı.<br>Tarama başlatıldığında uygun biletler burada listelenir.
      </div>
    `;
    foundCount.textContent = "0";
    statusText.textContent = "Sonuçlar temizlendi.";
  }

  btnClear.onclick = sonuclariTemizle;

  btnStart.onclick = () => {
    if (window._tcddState.calisiyor) {
      window._tcddState.durduruldu = true;
      window._tcddState.calisiyor = false;
      btnStart.textContent = "⚡ Şimdi Tara";
      btnStart.style.background = "#238636";
      statusText.textContent = "Tarama durduruldu.";
      countdownBadge.style.display = "none";
    } else {
      sonuclariTemizle();

      window._tcddState.durduruldu = false;
      window._tcddState.calisiyor = true;
      btnStart.textContent = "⏹️ Taramayı Durdur";
      btnStart.style.background = "#da3633";

      let sGun = parseInt(inputStart.value, 10) || bugunGunu;
      if (sGun < bugunGunu) sGun = bugunGunu;
      let eGun = parseInt(inputEnd.value, 10) || sGun;
      if (eGun < sGun) eGun = sGun;

      window._tcddState.baslangicGunu = sGun;
      window._tcddState.bitisGunu = eGun;
      window._tcddState.saatFiltresi = selectTime.value || "all";
      window._tcddState.tekrarDakika = parseInt(selectRepeat.value, 10) || 0;

      taramaDongusu();
    }
  };

  // 📅 Carousel'de Belirli Güne Tıkla
  async function gunSec(gunNo) {
    statusText.textContent = `📅 ${gunNo} ${suankiAyAdi} seçiliyor...`;

    function butonuBul() {
      const candidates = Array.from(document.querySelectorAll("button, .slideArea, [id*='btnSlickGidis'], .slick-slide, [class*='slick']"));
      return candidates.find(el => {
        const text = (el.innerText || "").replace(/\s+/g, " ").trim();
        const regex = new RegExp(`(^|\\s)${gunNo}(\\s|$)`);
        return regex.test(text) && (text.includes("Ekim") || text.includes("Kasım") || text.includes("Pzt") || text.includes("Sal") || text.includes("Çar") || text.includes("Per") || text.includes("Cum") || text.includes("Paz"));
      });
    }

    let gunBtn = butonuBul();
    let adim = 0;
    while (!gunBtn && adim < 20) {
      const nextBtn = document.querySelector(".slick-next, button[aria-label='Next'], .fa-angle-right, .fa-chevron-right, .nextBtn, button.slick-arrow.slick-next");
      if (!nextBtn) break;
      nextBtn.click();
      await sleep(60);
      gunBtn = butonuBul();
      adim++;
    }

    if (gunBtn) {
      console.log(`%c👉 ${gunNo} Ekim seçildi.`, "color: #d29922; font-weight: bold;");
      gunBtn.click();
      // Sayfanın güncellenmesini aktif bekle (Maks 1200ms)
      const waitStart = Date.now();
      while (Date.now() - waitStart < 1200) {
        await sleep(40);
        const cards = Array.from(document.querySelectorAll("[id^='gidis'], .card"));
        const matches = cards.some(c => (c.innerText || "").includes(`${gunNo}.10.`));
        if (matches) break;
      }
      await sleep(60);
      return true;
    }
    console.warn(`${gunNo} Ekim butonu bulunamadı.`);
    return false;
  }

  // 🔍 Trenleri Tara ve Saat Filtresini Uygula
  function trenleriIncele(gunNo) {
    const rawCards = Array.from(document.querySelectorAll("[id^='gidis'], .card, .accordion-item"));
    
    const validTrainCards = rawCards.filter(card => {
      const txt = (card.innerText || "").trim();
      const hasTrainHeader = /YHT:\s*\d+/i.test(txt) || /YHT\s*-\s*[A-Z]/i.test(txt) || /ANAHAT/i.test(txt);
      const hasTime = /\b([0-2]?\d:[0-5]\d)\b/.test(txt);
      const isSubCard = txt.startsWith("Bilet tipi") || (txt.includes("Bilet tipi") && !hasTrainHeader);
      return hasTrainHeader && hasTime && !isSubCard && card.children.length >= 2 && card.children.length <= 40;
    });

    console.log(`%c[${gunNo} Ekim] Sefer Sayısı: ${validTrainCards.length}`, "color: #58a6ff; font-weight: bold;");

    const seenInThisScan = new Set();

    validTrainCards.forEach((card, idx) => {
      const rawText = card.innerText || card.textContent || "";
      const text = rawText.replace(/\s+/g, " ").trim();

      // 1. GERÇEK TREN ADI VE NUMARASI (Örn: "YHT: 81404 ANKARA-SİVAS")
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

      // 2. KALKIŞ VE VARIŞ SAATLERİ (Örn: "18:40 ➔ 19:53")
      const times = Array.from(text.matchAll(/\b([0-2]?\d:[0-5]\d)\b/g)).map(m => m[0]);
      if (times.length === 0) return;
      const depTime = times[0];
      const arrTime = times[1] ? ` ➔ ${times[1]}` : "";
      const timeDisplay = `${depTime}${arrTime}`;

      // Tekilleştirme: Aynı tren numarasını ve saatini günde yalnızca 1 defa işle!
      const key = `${gunNo}_${trainNum || trainName}_${depTime}`;
      if (seenInThisScan.has(key)) return;
      seenInThisScan.add(key);

      // 3. SAAT FİLTRESİ KONTROLÜ
      const hour = parseInt(depTime.split(":")[0], 10);
      const filter = window._tcddState.saatFiltresi;

      if (filter === "morning" && (hour < 6 || hour >= 12)) return;
      if (filter === "afternoon" && (hour < 12 || hour >= 18)) return;
      if (filter === "evening" && hour < 18) return;

      // 4. FİYAT VE VAGON/KOLTUK ANALİZİ
      const priceMatch = text.match(/₺\s*[\d\.,]+/);
      const defaultPrice = priceMatch ? priceMatch[0] : "";

      const wagonAnalysis = parseWagonDetailsFromCard(card);

      if (wagonAnalysis.isAvailable) {
        if (wagonAnalysis.hasWagons) {
          // EKONOMİ BİLETİ
          if (wagonAnalysis.ekonomiSeats > 0) {
            const ekoBilet = {
              gun: gunNo,
              tarih: `${gunNo} Ekim 2026`,
              trainNum: trainNum,
              tren: trainName,
              saat: timeDisplay,
              koltuk: wagonAnalysis.ekonomiSeats,
              vagon: "Ekonomi",
              targetWagon: "EKONOMİ",
              fiyat: wagonAnalysis.ekonomiPrice || defaultPrice || "₺605,00",
              cardElement: card
            };
            window._tcddState.bulunanlar.push(ekoBilet);
            ekranaBiletEkle(ekoBilet);
            alarmCal();
          }

          // BUSINESS BİLETİ
          if (wagonAnalysis.businessSeats > 0) {
            const busBilet = {
              gun: gunNo,
              tarih: `${gunNo} Ekim 2026`,
              trainNum: trainNum,
              tren: trainName,
              saat: timeDisplay,
              koltuk: wagonAnalysis.businessSeats,
              vagon: "Business",
              targetWagon: "BUSINESS",
              fiyat: wagonAnalysis.businessPrice || "₺910,00",
              cardElement: card
            };
            window._tcddState.bulunanlar.push(busBilet);
            ekranaBiletEkle(busBilet);
            alarmCal();
          }
        } else if (wagonAnalysis.totalSeats > 0) {
          const biletObj = {
            gun: gunNo,
            tarih: `${gunNo} Ekim 2026`,
            trainNum: trainNum,
            tren: trainName,
            saat: timeDisplay,
            koltuk: wagonAnalysis.totalSeats,
            vagon: "Ekonomi",
            targetWagon: "EKONOMİ",
            fiyat: defaultPrice || "₺605,00",
            cardElement: card
          };
          window._tcddState.bulunanlar.push(biletObj);
          ekranaBiletEkle(biletObj);
          alarmCal();
        }
      } else if (wagonAnalysis.disabledOnly) {
        console.log(`%c⚠️ [${gunNo} Ekim] ${trainName} (${timeDisplay}): Yalnızca Tekerlekli Sandalye (Engelli) koltuğu var, genel yolcu için DOLU.`, "color: #8b949e;");
      }
    });
  }

  // Vagon Detaylarını ve Gerçek Koltuk Sayısını Çözümle
  function parseWagonDetailsFromCard(card) {
    // 1. Vue Komponent Verisinden Doğrudan Oku
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
    } catch (e) {}

    // 2. DOM Çözümleme (textContent: Akordeon kapalı dahi olsa butonları okur!)
    const rawAll = (card.textContent || card.innerText || "").replace(/\s+/g, " ");
    const wagonButtons = Array.from(card.querySelectorAll("button[selenium-test*='vagonType'], button.btnTicketType, button[id*='vagonType'], div.card, [class*='wagon'], [class*='vagon']"));

    let hasWagons = false;
    let businessSeats = 0;
    let businessPrice = "";
    let ekonomiSeats = 0;
    let ekonomiPrice = "";
    let disabledSeats = 0;

    wagonButtons.forEach(item => {
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

      // SADECE TEKERLEKLİ SANDALYE / ENGELLİ VARSA DOLU SAY
      if (disabledSeats > 0 || (rawAll.includes("TEKERLEKLİ") && !rawAll.includes("DOLU"))) {
        return { hasWagons: true, totalSeats: 0, isAvailable: false, disabledOnly: true };
      }

      return { hasWagons: true, totalSeats: 0, isAvailable: false, disabledOnly: false };
    }

    // 3. Fallback: Kapalı kart başlığı ("Bilet Ücreti ₺605,00 (X)")
    const seatMatch = rawAll.match(/Bilet Ücreti[^\(]*\((\d+)\)/i) || rawAll.match(/\((\d+)\)\s*💺/i) || rawAll.match(/\((\d+)\)/);
    let count = seatMatch ? parseInt(seatMatch[1], 10) : 0;

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
  }

  // 🎨 Ekrana Bilet Kartı Ekleme & Doğrudan 4. Görsel Koltuk Haritasına Geçiş
  function ekranaBiletEkle(bilet) {
    const emptyState = document.getElementById("tcdd-empty-state");
    if (emptyState) emptyState.remove();

    foundCount.textContent = window._tcddState.bulunanlar.length;

    const isBus = (bilet.vagon || bilet.targetWagon || "").toUpperCase().includes("BUS");
    const wagonLabel = isBus ? "BUSINESS" : "EKONOMİ";
    const badgeBg = isBus ? "#8957e5" : "#238636";
    const btnBg = isBus ? "linear-gradient(135deg, #8957e5 0%, #a371f7 100%)" : "linear-gradient(135deg, #238636 0%, #2ea043 100%)";

    const item = document.createElement("div");
    item.style.cssText = `
      background: linear-gradient(135deg, ${isBus ? 'rgba(137, 87, 229, 0.2)' : 'rgba(35, 134, 54, 0.2)'} 0%, #161b22 100%);
      border: 1px solid ${isBus ? '#8957e5' : '#238636'}; border-radius: 8px; padding: 10px;
      display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;

    item.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
          <span style="font-weight: bold; color: ${isBus ? '#a371f7' : '#3fb950'}; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            🚆 ${bilet.tren}
          </span>
          <span style="font-size: 9px; font-weight: 800; background: ${badgeBg}; color: #fff; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">
            ${wagonLabel}
          </span>
        </div>
        <div style="font-size: 11px; color: #c9d1d9;">
          📅 <b>${bilet.tarih}</b> • 🕒 <b>${bilet.saat}</b>
        </div>
        <div style="font-size: 11px; margin-top: 3px; display: flex; align-items: center; gap: 6px;">
          <span style="background: ${isBus ? 'rgba(137,87,229,0.3)' : 'rgba(35,134,54,0.3)'}; color: #fff; padding: 1px 6px; border-radius: 4px; font-weight: bold;">
            💺 ${bilet.koltuk} BOŞ KOLTUK
          </span>
          <span style="color: #ff7b72; font-weight: 800; font-size: 12px;">${bilet.fiyat}</span>
        </div>
      </div>
      <button class="tcdd-git-btn" style="background: ${btnBg}; border: none; color: #fff; padding: 8px 11px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; white-space: nowrap; margin-left: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
        ${isBus ? '🟣' : '🟢'} ${wagonLabel} Koltuğa Git ➔
      </button>
    `;

    // BUTONA TIKLANDIĞINDA: Hızlıca tarihi kontrol et, kartı aç, vagonu seç ve 4. görsele git!
    item.querySelector(".tcdd-git-btn").onclick = async () => {
      statusText.textContent = `⏳ ${bilet.tarih} ${bilet.targetWagon} koltuk haritasına yönlendiriliyor...`;

      // Eğer koltuk-haritası sayfasındaysak "Geri" butonuna basarak Sefer Listesine dön
      const geriBtn = document.querySelector("button.btnPrev, .btnPrev");
      if (geriBtn || window.location.pathname.includes("koltuk-haritasi")) {
        if (geriBtn) {
          geriBtn.click();
        } else if (window.history.length > 1) {
          window.history.back();
        }
        const waitBack = Date.now();
        while (Date.now() - waitBack < 4000) {
          await sleep(40);
          if (document.querySelector("[id^='gidis']")) {
            await sleep(80);
            break;
          }
        }
      }

      // 1. Kartların üzerindeki gerçek tarihi kontrol et
      function getMevcutKartGunu() {
        const cards = Array.from(document.querySelectorAll("[id^='gidis'], .card, .accordion-item"));
        for (const c of cards) {
          const m = (c.innerText || "").match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
          if (m) return parseInt(m[1], 10);
        }
        return null;
      }

      const mevcutGun = getMevcutKartGunu();
      if (mevcutGun !== bilet.gun) {
        console.log(`Farklı gündeyiz (Mevcut: ${mevcutGun}, Hedef: ${bilet.gun}), gün seçiliyor...`);
        await gunSec(bilet.gun);
        const basla = Date.now();
        while (Date.now() - basla < 4000) {
          await sleep(40);
          if (getMevcutKartGunu() === bilet.gun) {
            await sleep(60);
            break;
          }
        }
      }

      const mainCards = Array.from(document.querySelectorAll("[id^='gidis']")).filter(el => /^gidis\d+$/.test(el.id));
      const dep = bilet.saat.split(" ")[0].split("➔")[0].trim();
      let targetCard = mainCards.find(c => {
        const txt = c.innerText || "";
        const times = Array.from(txt.matchAll(/\b([0-2]?\d:[0-5]\d)\b/g)).map(m => m[0]);
        const matchTime = dep && times[0] === dep;
        const matchNum = bilet.trainNum && txt.includes(bilet.trainNum);
        return matchTime && (matchNum || !bilet.trainNum);
      });

      if (!targetCard && dep) {
        targetCard = mainCards.find(c => {
          const times = Array.from((c.innerText || "").matchAll(/\b([0-2]?\d:[0-5]\d)\b/g)).map(m => m[0]);
          return times[0] === dep;
        });
      }

      if (!targetCard) {
        targetCard = mainCards.find(c => {
          const txt = c.innerText || "";
          return bilet.trainNum ? txt.includes(bilet.trainNum) : txt.includes(bilet.tren.split(" ")[0]);
        });
      }

      if (!targetCard) {
        alert("Hedef tren kartı sayfada bulunamadı.");
        return;
      }

      const kartId = targetCard.id; // Örn: "gidis3"
      console.log(`Hedef tren kartı: ${kartId} (${dep})`);

      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      targetCard.style.outline = "4px solid #3fb950";

      // 2. Accordion'u başlık butonu ile aç
      const collapseEl = targetCard.querySelector(".collapse");
      const isOpen = (collapseEl && collapseEl.classList.contains("show")) || targetCard.innerText.includes("Vagon tipini seçin");
      if (!isOpen) {
        const openBtn = document.getElementById(kartId + "btn") ||
                        targetCard.querySelector("button[id*='btn'], button.btn-link, button.collapsed") ||
                        targetCard;
        openBtn.click();
        openBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        // İçerik butonlarının DOM'da belirmesini hızlıca bekle (en fazla 250ms)
        const openStart = Date.now();
        while (Date.now() - openStart < 250) {
          if (targetCard.querySelector("button[selenium-test*='vagonType'], [id*='vagonType'], button.btnTicketType, button[selenium-test*='btn-gidis']")) {
            break;
          }
          await sleep(25);
        }
        await sleep(60);
      }

      // 3. İstenen Vagon Kutusuna tıkla (EKONOMİ veya BUSINESS)
      const isTargetBus = (bilet.targetWagon || "").toUpperCase().includes("BUS");
      let targetBox = null;
      if (isTargetBus) {
        targetBox = targetCard.querySelector("button[selenium-test*='vagonType-1-'], [id*='vagonType-1-']");
      } else {
        targetBox = targetCard.querySelector("button[selenium-test*='vagonType-2'], [id*='vagonType-2']");
      }

      if (!targetBox) {
        const candidateBoxes = Array.from(targetCard.querySelectorAll("button.btnTicketType, button, div, [class*='wagon'], [class*='vagon']")).filter(el => {
          const txt = (el.innerText || "").trim().toUpperCase();
          const sel = (el.getAttribute("selenium-test") || "").toLowerCase();
          const matches = isTargetBus ?
            (sel.includes("vagontype-1-") || txt.startsWith("BUSİNESS") || txt.startsWith("BUSINESS") || (txt.includes("BUS") && !txt.includes("DOLU"))) :
            (sel.includes("vagontype-2-") || txt.startsWith("EKONOMİ") || txt.startsWith("EKONOMI") || (txt.includes("EKO") && !txt.includes("DOLU")));
          return matches && !txt.includes("DOLU");
        });
        targetBox = candidateBoxes.find(el => (el.innerText || "").includes("₺")) || candidateBoxes[0];
      }

      if (targetBox) {
        targetBox.scrollIntoView({ block: "nearest" });
        targetBox.click();
        targetBox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await sleep(80);
      }

      // 4. Bu trene özel kırmızı 'Seçin' butonuna ve varsa 'Devam Et' butonuna tıkla
      let secinBtn = targetCard.querySelector(`[selenium-test='btn-${kartId}'], button.btn-danger.btn-lg`) ||
                     document.querySelector(`[selenium-test='btn-${kartId}']`) ||
                     targetCard.querySelector("button[selenium-test*='btn-gidis']");

      if (secinBtn) {
        statusText.innerHTML = `🚀 <b>${bilet.targetWagon}</b> seçildi! Koltuk haritası açılıyor...`;
        secinBtn.scrollIntoView({ block: "nearest" });
        secinBtn.focus();
        secinBtn.click();
        secinBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await sleep(60);
      }

      const devamBtn = document.querySelector("button.btnContinue, .btnContinue, button[selenium-test*='continue']");
      if (devamBtn && devamBtn.offsetWidth > 0) {
        devamBtn.click();
        devamBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      } else {
        // Fallback: Vue Router ile doğrudan /koltuk-haritasi yönlendirmesi
        try {
          function findVue(el) {
            if (!el) return null;
            if (el.__vue__) return el.__vue__;
            if (el.__vue_app__) return el.__vue_app__;
            for (let c of el.children) {
              const f = findVue(c);
              if (f) return f;
            }
            return null;
          }
          const v = findVue(targetCard) || findVue(document.body);
          if (v && v.$router) {
            v.$router.push("/koltuk-haritasi");
          }
        } catch (e) {}
      }
    };

    resultsList.prepend(item);
  }

  // 🛡️ Cloudflare Turnstile Güvenlik Doğrulaması Yöneticisi
  async function checkAndHandleCloudflare() {
    const isCf = document.body.innerText.includes("Güvenlik Doğrulaması") ||
                 document.body.innerText.includes("Gerçek kişi olduğunuzu doğrulayın") ||
                 document.querySelector("iframe[src*='challenges.cloudflare.com'], iframe[src*='turnstile'], .cf-turnstile");

    if (!isCf) return false;

    console.warn("🚨 Cloudflare Güvenlik Doğrulaması tespit edildi!");
    statusText.innerHTML = "🚨 <b style='color:#da3633;'>GÜVENLİK DOĞRULAMASI!</b> Lütfen kutucuğu işaretleyin...";
    alarmCal();

    tryAutoClickTurnstile();

    const startW = Date.now();
    while (Date.now() - startW < 60000) {
      await sleep(500);
      tryAutoClickTurnstile();
      const stillPresent = document.body.innerText.includes("Güvenlik Doğrulaması") ||
                           document.body.innerText.includes("Gerçek kişi olduğunuzu doğrulayın") ||
                           document.querySelector("iframe[src*='challenges.cloudflare.com']:not([style*='display: none'])");
      if (!stillPresent) {
        console.log("✅ Güvenlik doğrulaması aşıldı! Taramaya devam ediliyor.");
        statusText.innerHTML = "✅ Doğrulama tamamlandı, devam ediliyor...";
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
        } catch (e) {}
      }
    } catch (err) {}
  }

  // 🔁 Ana Tarama Döngüsü
  async function taramaDongusu() {
    while (window._tcddState.calisiyor && !window._tcddState.durduruldu) {
      const basla = window._tcddState.baslangicGunu;
      const bitis = window._tcddState.bitisGunu;

      for (let gun = basla; gun <= bitis; gun++) {
        if (!window._tcddState.calisiyor || window._tcddState.durduruldu) break;
        await checkAndHandleCloudflare();
        statusText.innerHTML = `📅 <b>${gun} ${suankiAyAdi}</b> seferleri inceleniyor...`;
        await gunSec(gun);
        await checkAndHandleCloudflare();
        trenleriIncele(gun);
        if (gun < bitis) {
          await sleep(1100); // Cloudflare bot korumasını tetiklememek için insansı bekleme
        }
      }

      if (!window._tcddState.calisiyor || window._tcddState.durduruldu) break;

      const toplam = window._tcddState.bulunanlar.length;
      statusText.innerHTML = `✅ Bitti! Filtreye uyan <b>${toplam}</b> boş bilet bulundu.`;

      if (window._tcddState.tekrarDakika > 0) {
        let bekleme = window._tcddState.tekrarDakika * 60;
        countdownBadge.style.display = "inline-block";
        while (bekleme > 0 && window._tcddState.calisiyor && !window._tcddState.durduruldu) {
          const dk = Math.floor(bekleme / 60);
          const sn = bekleme % 60;
          countdownBadge.textContent = `Sonraki: ${dk}:${sn < 10 ? '0' : ''}${sn}`;
          await sleep(1000);
          bekleme--;
        }
        countdownBadge.style.display = "none";
      } else {
        window._tcddState.calisiyor = false;
        btnStart.textContent = "⚡ Şimdi Tara";
        btnStart.style.background = "#238636";
        break;
      }
    }
  }

  // Başlangıçta ilk taramayı tetikle
  btnStart.click();
})();
