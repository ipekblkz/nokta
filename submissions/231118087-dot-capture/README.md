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
5. **👤 Uzman Desteği:** "Uzman Görüşü Al" butonuyla AI destekli danışmanla gerçek zamanlı chat açılır

---

## 👤 Uzman Desteği

Spec oluşturulduktan sonra **"Uzman Görüşü Al"** butonu aktif olur.
Butona basıldığında ayrı bir chat ekranı açılır; kullanıcı **Ahmet Yılmaz** adlı
15 yıllık deneyimli girişim danışmanıyla (Claude API destekli) sohbet edebilir.

> AI spec üretir → Uzman agent değerlendirir → Gerçek zamanlı geri bildirim alınır

- Danışman, kullanıcının fikrini ve spec'i bağlam olarak alır
- Pazar analizi, teknik öneri, strateji soruları sorulabilir
- Tam mesajlaşma arayüzü: sohbet geçmişi korunur, klavye uyumlu

---

## Decision Log

- Track A seçtim çünkü fikir üretme sürecini AI ile desteklemek istedim
- React Native CLI kullandım (Expo yerine)
- Anthropic Claude API entegrasyonu ile sorular, spec üretimi ve uzman chat yapıldı
- Uzman desteği için embedded AI agent tercih edildi — ayrı servis gerektirmiyor, spec bağlamı otomatik aktarılıyor
- Fade animasyonları promise-based async/await ile yeniden yazıldı (state race condition düzeltildi)