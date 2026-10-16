// TCDD İstasyon Veritabanı ve Arama Yardımcısı
const TCDD_STATIONS = [
  // Popüler YHT ve Ana Hat İstasyonları
  { id: "1", name: "ANKARA GAR", city: "Ankara", popular: true, yht: true },
  { id: "2", name: "İSTANBUL(SÖĞÜTLÜÇEŞME)", city: "İstanbul", popular: true, yht: true },
  { id: "3", name: "İSTANBUL(HALKALI)", city: "İstanbul", popular: true, yht: true },
  { id: "4", name: "İSTANBUL(PENDİK)", city: "İstanbul", popular: true, yht: true },
  { id: "5", name: "İSTANBUL(BAKIRKÖY)", city: "İstanbul", popular: true, yht: true },
  { id: "6", name: "İSTANBUL(BOSTANCI)", city: "İstanbul", popular: false, yht: true },
  { id: "7", name: "ESKİŞEHİR", city: "Eskişehir", popular: true, yht: true },
  { id: "8", name: "KONYA", city: "Konya", popular: true, yht: true },
  { id: "9", name: "KARAMAN", city: "Karaman", popular: true, yht: true },
  { id: "10", name: "İZMİT YHT", city: "Kocaeli", popular: true, yht: true },
  { id: "11", name: "GEBZE", city: "Kocaeli", popular: true, yht: true },
  { id: "12", name: "BOZÜYÜK YHT", city: "Bilecik", popular: false, yht: true },
  { id: "13", name: "BİLECİK YHT", city: "Bilecik", popular: false, yht: true },
  { id: "14", name: "ARİFİYE", city: "Sakarya", popular: true, yht: true },
  { id: "15", name: "POLATLI YHT", city: "Ankara", popular: false, yht: true },
  { id: "16", name: "SELÇUKLU", city: "Konya", popular: false, yht: true },
  { id: "17", name: "SİVAS", city: "Sivas", popular: true, yht: true },
  { id: "18", name: "YOZGAT", city: "Yozgat", popular: true, yht: true },
  { id: "19", name: "KIRIKKALE", city: "Kırıkkale", popular: true, yht: true },
  { id: "50", name: "SORGUN YHT", city: "Yozgat", popular: true, yht: true },
  { id: "51", name: "AKDAĞMADENİ YHT", city: "Yozgat", popular: true, yht: true },
  { id: "52", name: "YERKÖY YHT", city: "Yozgat", popular: true, yht: true },
  { id: "53", name: "ERYAMAN YHT", city: "Ankara", popular: true, yht: true },
  { id: "54", name: "ELMADAĞ YHT", city: "Ankara", popular: false, yht: true },
  { id: "55", name: "YILDIZELİ YHT", city: "Sivas", popular: true, yht: true },
  { id: "20", name: "İZMİR(BASMANE)", city: "İzmir", popular: true, yht: false },
  { id: "21", name: "KAYSERİ", city: "Kayseri", popular: true, yht: false },
  { id: "22", name: "ADANA", city: "Adana", popular: true, yht: false },
  { id: "23", name: "MERSİN", city: "Mersin", popular: true, yht: false },
  { id: "24", name: "BALIKESİR", city: "Balıkesir", popular: true, yht: false },
  { id: "25", name: "BANDIRMA", city: "Balıkesir", popular: true, yht: false },
  { id: "26", name: "MANİSA", city: "Manisa", popular: true, yht: false },
  { id: "27", name: "KÜTAHYA", city: "Kütahya", popular: true, yht: false },
  { id: "28", name: "AFYON A.ÇETİNKAYA", city: "Afyon", popular: true, yht: false },
  { id: "29", name: "MALATYA", city: "Malatya", popular: true, yht: false },
  { id: "30", name: "ELAZIĞ", city: "Elazığ", popular: true, yht: false },
  { id: "31", name: "DİYARBAKIR", city: "Diyarbakır", popular: true, yht: false },
  { id: "32", name: "BATMAN", city: "Batman", popular: false, yht: false },
  { id: "33", name: "ERZURUM", city: "Erzurum", popular: true, yht: false },
  { id: "34", name: "ERZİNCAN", city: "Erzincan", popular: true, yht: false },
  { id: "35", name: "KARS", city: "Kars", popular: true, yht: false },
  { id: "36", name: "TATVAN", city: "Bitlis", popular: false, yht: false },
  { id: "37", name: "DENİZLİ", city: "Denizli", popular: true, yht: false },
  { id: "38", name: "AYDIN", city: "Aydın", popular: true, yht: false },
  { id: "39", name: "NAZİLLİ", city: "Aydın", popular: false, yht: false },
  { id: "40", name: "SÖKE", city: "Aydın", popular: false, yht: false },
  { id: "41", name: "ÖDEMİŞ", city: "İzmir", popular: false, yht: false },
  { id: "42", name: "TİRE", city: "İzmir", popular: false, yht: false },
  { id: "43", name: "UŞAK", city: "Uşak", popular: false, yht: false },
  { id: "44", name: "EDİRNE", city: "Edirne", popular: true, yht: false },
  { id: "45", name: "ÇERKEZKÖY", city: "Tekirdağ", popular: false, yht: false },
  { id: "46", name: "ÇORLU", city: "Tekirdağ", popular: false, yht: false },
  { id: "47", name: "KAPIKULE", city: "Edirne", popular: false, yht: false },
  { id: "48", name: "UZUNKÖPRÜ", city: "Edirne", popular: false, yht: false },
  { id: "49", name: "GAZİANTEP", city: "Gaziantep", popular: true, yht: false }
];

function normalizeTr(text) {
  if (!text) return "";
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function searchStations(query) {
  if (!query) return TCDD_STATIONS.filter(s => s.popular);
  const qNorm = normalizeTr(query);
  return TCDD_STATIONS.filter(s => {
    return normalizeTr(s.name).includes(qNorm) || normalizeTr(s.city).includes(qNorm);
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TCDD_STATIONS, searchStations, normalizeTr };
}
