# Nokta — Dot Capture & Enrich

**Öğrenci:** İpek Balkız • 231118087
**Track:** A — Dot Capture & Enrich

---

## Demo

> **APK:** `app-release.apk` (bu klasörde)

---

## Track Seçimi

**Track A — Dot Capture & Enrich** seçildi.

**Gerekçe:** NOKTA'nın ana tezini en doğrudan implemente eden track bu.
Ham fikir (nokta) girer → engineering sorularıyla zenginleşir → spec (sayfa) çıkar.
Diğer track'lere kıyasla daha net bir kullanıcı akışı ve daha az belirsiz scope.

---

## Uygulama Nasıl Çalışır

1. Kullanıcı ham fikrini yazar
2. Claude AI 4 engineering sorusu sorar (problem, user, scope, constraint)
3. Kullanıcı cevaplar
4. Claude tek sayfalık ürün spesifikasyonu üretir
5. **👤 Uzman Desteği:** "Uzman Görüşü Al" butonuna basarak spec WhatsApp üzerinden gerçek bir uzmana iletilir

---

## 👤 İnsan (Uzman) Desteği

Spec oluşturulduktan sonra **"Uzman Görüşü Al"** butonu aktif olur.
Butona basıldığında fikir ve spec otomatik olarak WhatsApp mesajına dönüştürülür,
kullanıcı istediği uzmana direkt gönderebilir.

> AI spec üretir → İnsan uzman değerlendirir → Gerçek geri bildirim alınır
5. **👤 İnsan Desteği:** "UZMANA GÖNDER" butonuna basarak spec WhatsApp üzerinden gerçek bir uzmana iletilir

---

## İnsan Desteği Özelliği

Spec oluşturulduktan sonra **"UZMANA GÖNDER"** butonu aktif olur.
Butona basıldığında fikir ve spec otomatik olarak WhatsApp mesajına dönüştürülür,
kullanıcı istediği uzmana direkt gönderebilir.

---

## Decision Log

- Track A seçtim çünkü fikir üretme sürecini AI ile desteklemek istedim
- React Native CLI kullandım (Expo yerine)
- Anthropic Claude API entegrasyonu ile sorular ve spec üretimi yapıldı
- İnsan desteği için WhatsApp deep link tercih edildi — ekstra kurulum gerektirmiyor