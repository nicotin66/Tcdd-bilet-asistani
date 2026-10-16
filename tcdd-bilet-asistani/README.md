# 🚄 TCDD Bilet Avcısı - Otomatik Koltuk Takip Eklentisi (Chrome / Edge / Brave)

TCDD Taşımacılık (**ebilet.tcddtasimacilik.gov.tr**) sisteminde bilet bulmanın ne kadar zor olduğunu ve sürekli elle girip kontrol etmenin yoruculuğunu ortadan kaldırmak için geliştirilmiş profesyonel bir tarayıcı eklentisidir (Manifest V3).

---

## 🌟 Öne Çıkan Özellikler

1. **İstasyon Seçimi (Akıllı Arama & Hızlı Rotalar):**
   - Ankara Gar, İstanbul (Söğütlüçeşme, Halkalı, Pendik), Eskişehir, Konya, Karaman, Sivas vb. tüm popüler istasyonlar için otomatik tamamlama ve tek tıkla hızlı rota seçimi.
2. **Esnek Tarih Seçenekleri:**
   - **Tek Tarih:** Belirli bir gün için seferleri takip eder.
   - **Tarih Aralığı (Çoklu Gün):** Başlangıç ve bitiş tarihleri arasındaki günleri sırayla tarar.
3. **Özelleştirilebilir Tarama Sıklığı:**
   - İster **10 dakikada bir** (önerilen), isterseniz 1, 3, 5, 15 veya 30 dakikada bir arka planda otomatik kontrol.
4. **Saat ve Vagon Filtreleme:**
   - Sabah (06-12), Öğleden Sonra (12-18), Akşam (18-24) veya Tüm Gün filtreleri.
   - Ekonomi (2+2 Pulman), Business veya Yataklı vagon tercihleri.
   - İstenen minimum koltuk adedi (örn. en az 1 veya 2 boş yer).
5. **Sesli ve Görsel Alarm:**
   - Boş yer açıldığı anda ekrana **Masaüstü Bildirimi (Chrome Notification)** gelir.
   - Hoparlörden dikkat çekici tren istasyonu zil sesi çalar (arka planda olsanız bile uyarır).
6. **🎯 Tek Tıkla Koltuk Seçimine Yönlendirme:**
   - Bildirime tıkladığınız anda TCDD sekmesi öne gelir, boş koltuk bulunan tren açılır, ilgili vagon ve **"Seçin"** butonuna ışıklı/hareketli ok ile odaklanılır. Size sadece koltuğu seçip onaylamak kalır!
7. **Sayfa İçi Asistan Paneli (Floating Widget):**
   - TCDD sitesine girdiğinizde sağ altta şık bir kontrol paneli görünür; son kontrol zamanını, geri sayımı görebilir veya anında manuel tarama yapabilirsiniz.

---

## 🚀 1 Dakikada Kurulum Kılavuzu

Eklenti Chrome, Microsoft Edge, Brave veya Opera tarayıcılarında doğrudan çalışır:

1. **Google Chrome**'u (veya Edge/Brave) açın.
2. Adres çubuğuna şunu yazıp Enter'a basın:
   ```text
   chrome://extensions
   ```
   *(Edge kullanıyorsanız: `edge://extensions`)*
3. Sağ üst köşedeki **"Geliştirici Modu" (Developer Mode)** anahtarını açık konuma getirin.
4. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
5. Açılan pencerede şu klasörü seçin:
   ```text
   C:\Users\PC\.gemini\antigravity-ide\scratch\tcdd-bilet-asistani
   ```
6. Tebrikler! Eklenti simgesi sağ üst uzantılar çubuğuna eklenecektir. (İğne 📌 simgesine basarak eklentiyi görünür yapabilirsiniz).

---

## 🛠️ Nasıl Kullanılır?

1. Tarayıcının sağ üstündeki **TCDD Bilet Avcısı** simgesine tıklayın.
2. **Kalkış** ve **Varış** istasyonlarını seçin (veya üstteki hızlı butonlardan birine tıklayın).
3. **Yolculuk Tarihini** (veya Tarih Aralığını) belirleyin.
4. **Tarama Sıklığını** belirleyin *(Varsayılan: 10 Dakika)*.
5. **"▶️ Otomatik Takibi Başlat"** butonuna basın.
6. Tarayıcınızı kapatmadığınız sürece eklenti arka planda belirtilen aralıkla boş koltuk kontrolü yapacaktır.
7. Boş yer açıldığında bildirim gelir; bildirime tıklayarak anında koltuğunuzu alabilirsiniz!

---

## 💡 Bilet Yakalama İpuçları
- TCDD'de son 24-48 saat kala yolcular cezasız iptal/iade hakkı dolmadan biletlerini sıkça iade ederler. Bu süreçte takip sıklığını 3 veya 5 dakikaya düşürerek iptal edilen biletleri anında yakalayabilirsiniz.
- Bilgisayar başından kalkacağınız zaman hoparlör sesini biraz açarak "Sesi Dene" butonundan alarm sesinin duyulabilirliğini test edebilirsiniz.
