// TCDD Bilet Avcısı - Sayfa (MAIN world) API yakalayıcı
// TCDD sitesinin kendi sefer sorgusunu (train-availability) yakalar; eklenti bu
// isteği daha sonra arka planda, sayfa açmadan tekrar kullanır.
(() => {
  if (window.__tcddHookInstalled) return;
  window.__tcddHookInstalled = true;

  function isAvailabilityRequest(url, body) {
    const u = String(url || "");
    if (!u.includes("tcddtasimacilik.gov.tr") && !u.startsWith("/")) return false;
    if (/availability/i.test(u)) return true;
    return typeof body === "string" && body.includes("departureDate") && body.includes("searchRoutes");
  }

  function headersToObject(h) {
    const out = {};
    if (!h) return out;
    try {
      if (h instanceof Headers) {
        h.forEach((v, k) => { out[k] = v; });
      } else if (Array.isArray(h)) {
        h.forEach(([k, v]) => { out[k] = v; });
      } else if (typeof h === "object") {
        Object.keys(h).forEach(k => { out[k] = h[k]; });
      }
    } catch (e) {}
    return out;
  }

  function publish(url, method, headers, body, responseText) {
    try {
      const absUrl = new URL(url, location.href).href;
      window.postMessage({
        __tcddCapture: true,
        url: absUrl,
        method: method || "POST",
        headers: headers,
        body: body,
        response: responseText ? responseText.slice(0, 400000) : null
      }, "*");
    } catch (e) {}
  }

  // fetch
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url);
    const body = init && typeof init.body === "string" ? init.body : null;
    const res = await origFetch.apply(this, arguments);
    try {
      if (isAvailabilityRequest(url, body)) {
        const headers = Object.assign(
          {},
          input && input.headers ? headersToObject(input.headers) : {},
          headersToObject(init && init.headers)
        );
        res.clone().text().then(txt => publish(url, (init && init.method) || "POST", headers, body, txt)).catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  // XMLHttpRequest (axios)
  const origOpen = XMLHttpRequest.prototype.open;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__tcdd = { method, url, headers: {} };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__tcdd) this.__tcdd.headers[k] = v;
    return origSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const info = this.__tcdd;
    if (info && isAvailabilityRequest(info.url, typeof body === "string" ? body : null)) {
      this.addEventListener("load", () => {
        try {
          publish(info.url, info.method, info.headers, typeof body === "string" ? body : null, this.responseText);
        } catch (e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  // Sayfa zaten yüklenmişse Vue store veya global nesnelerden şablonu otomatik çıkar
  function tryExtractFromPage() {
    try {
      const app = document.querySelector("#app");
      const store = (app && app.__vue__ && app.__vue__.$store) || (window.$nuxt && window.$nuxt.$store);
      if (store && store.state) {
        const tmsUrl = (store.getters && store.getters.getTmsServiceUrl) || "https://web-api-prod-ytp.tcddtasimacilik.gov.tr/tms";
        const routes = (store.state.booking && store.state.booking.searchRoutes) || store.state.searchRoutes || (store.getters && store.getters.getSearchRoutes);
        if (tmsUrl && routes && routes.length) {
          publish(tmsUrl + "/train/train-availability", "POST", { "Content-Type": "application/json" }, JSON.stringify({ searchRoutes: routes }), null);
        }
      }
    } catch(e) {}
  }
  // content.js'den gelen koltuk haritasına geçiş talebini ana dünyadaki Vue Router ile anında çalıştır
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || !event.data.__tcddNav) return;
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
      const v = findVue(document.querySelector("#app, .card, [id^='gidis']")) || findVue(document.body);
      if (v && v.$router) {
        console.log("⚡ Main world Vue Router ile /koltuk-haritasi açılıyor...");
        v.$router.push(event.data.path || "/koltuk-haritasi");
      }
    } catch(e) {
      console.warn("Vue router yönlendirme hatası:", e);
    }
  });
})();
