# idea.md — Track B: Müşteri-Geliştirici Feature Pitch

## Öğrenci
- **Ad Soyad:** İpek Balkız
- **No:** 231118087
- **Track:** B — Yaratıcılık (Müşteri-Geliştirici Feature Pitch)

---

## Fikir (One-liner)
Ham bir fikri alıp AI destekli engineering sorusuyla zenginleştiren, spec üreten ve **uzman AI agent ile interaktif danışma** sunan mobil uygulama.

---

## Problem
Girişimcilerin, öğrencilerin ve mühendislerin aklına gelen ham fikirler WhatsApp notlarında, Notion'da ya da kağıt parçalarında birikerek kaybolur. Hiçbiri sorgulanmadan, olgunlaşmadan ölür. Sebebi: fikri spesifikasyona çevirmek zaman alır ve nasıl yapılacağı bilinmez.

---

## Kullanıcı
- Solo girişimciler / indie hackers
- Öğrenciler (proje fikri geliştirme)
- Ürün yöneticileri (hızlı pre-spec)

---

## Çözüm — Nasıl Çalışır

1. Kullanıcı ham fikri yazar (tek cümle yeterli)
2. AI sistemi 4 adet engineering sorusu sorar:
   - Problem tanımı
   - Hedef kullanıcı
   - Kapsam (scope)
   - Kısıtlar (constraints)
3. Kullanıcı kısa cevaplar verir
4. AI tek sayfalık ürün spesifikasyonu üretir
5. **👤 Uzman AI Agent** devreye girer — spec üzerine soru-cevap, pazar analizi, teknik öneri

---

## Kapsam (Bu Demo İçin)
- ✅ Ham fikir input ekranı
- ✅ 4 soru — cevap akışı
- ✅ Spec üretimi (Claude API)
- ✅ Spec görüntüleme
- ✅ Uzman AI Agent chat ekranı
- ❌ Spec kaydetme / paylaşma (v2)
- ❌ Ses girişi (v2)

---

## Kısıtlar
- Sadece Android (APK)
- React Native CLI (Expo değil)
- Anthropic Claude API bağımlı

---

## Başarı Metriği
Ham fikirden tamamlanmış spec'e kadar geçen süre < 3 dakika.
Uzman agent ile anlamlı 3+ mesaj döngüsü kurulabilmesi.

---

## Track B — Feature Pitch

### Müşteri Perspektifi
**"Fikrimi not aldım ama ne yapacağımı bilmiyorum"** — Solo girişimcinin en büyük sorunu.
NOKTA bu sorunu çözer: fikri alır, mühendislik süzgecinden geçirir, spec üretir ve uzman görüşü sunar.

### Geliştirici Perspektifi
- Claude API ile multi-turn conversation
- Phase-based UI: input → questioning → spec → expert chat
- Stateless agent: her mesajda full context gönderilir

### Neden Bu Feature?
| Özellik | Değer |
|---------|-------|
| AI Soru Döngüsü | Fikri olgunlaştırır |
| Spec Üretimi | Somut çıktı verir |
| Uzman Agent | İnsan-AI işbirliği simüle eder |

---

## NOKTA Tezi ile Bağlantı
Bu uygulama NOKTA ekosisteminin **"Dot → Line → Network"** adımlarını implemente eder.
- Nokta (ham fikir) girer
- Sayfa (spec) çıkar  
- Uzman (agent) derinleştirir

Slopsuz. Hallüsinasyonsuz. Engineering-guided.

---

## Audit-Forge Notları
- **FORGE.md** ledger dosyası eklenecek
- Repair döngüsü: READ → LOCATE → HYPOTHESIZE → REPAIR → TEST → VERIFY → COMMIT/ROLLBACK
- ≥3 başarılı cycle hedefleniyor