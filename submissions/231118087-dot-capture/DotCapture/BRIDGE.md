# BRIDGE.md — Uzman Görüşme Özeti

## Öğrenci: 231118087
## Uygulama: DotCapture · nokta
## Tarih: 28.05.2026

---

## Görüşme 1 — Junior Danışman (Ahmet Yılmaz)

**Fikir:** Mahalledeki atıkları toplayan bir mobil uygulama

**Özet:**
Kullanıcı, mahalle sakinlerinin atık toplama taleplerini harita üzerinden bildirebildiği, belediye veya gönüllü ekiplerle eşleştiren bir platform fikrini paylaştı. Junior danışman Ahmet Yılmaz, fikrin çekirdek problemi olan "düzensiz atık toplama" konusunu netleştirdi ve hedef kullanıcıyı tanımladı.

**Soru-Cevap Özeti:**
- S: "Atık toplama taleplerini kim görecek — belediye mi, gönüllüler mi?"
- C: "İkisi de olabilir, önce belediye entegrasyonu deneyelim."
- S: "Başarıyı nasıl ölçeceksin — toplanan atık miktarı mı, kullanıcı sayısı mı?"
- C: "Her ikisi de, ama önce aktif kullanıcı sayısı."

**Sonuç:** Spec oluşturuldu ✅

---

## Görüşme 2 — Expert Danışman (Dr. Kemal Arslan)

**Tetikleyici:** STUCK tespiti — kullanıcı "belediye entegrasyonu nasıl yapılır" sorusuna 2 kez "bilmiyorum" yanıtı verdi.

**Özet:**
Dr. Kemal Arslan, belediye API entegrasyonunun teknik ve bürokratik zorluklarını açıkladı. REST API yerine önce manuel veri girişiyle MVP çıkarılmasını, ardından belediye ile pilot anlaşma yapılmasını önerdi. Akademik referans olarak "Civic Tech" literatüründen örnekler sundu.

**Kritik Karar:**
Kullanıcı, MVP aşamasında belediye entegrasyonunu kapsam dışına aldı. Gönüllü ağı modeli ile ilerleme kararı verildi.

**Köprü Notu:**
Bu karar FORGE Cycle 2'ye girdi işlendi, spec güncellendi.

---

## Görüşme 3 — Senior Danışman (Selin Kaya)

**Fikir:** Spec hazır, yatırımcı sunumu için analiz isteniyor

**Özet:**
Selin Kaya, pazar büyüklüğü (Türkiye'de 81 il, 970+ belediye), rakip analizi (Çevre Bakanlığı uygulamaları, özel atık firmaları) ve büyüme metriği (aylık aktif kullanıcı, toplanan atık kg) üzerine analiz sundu.

**Sonuç:** Yatırımcı sunum materyali için 3 kritik metrik belirlendi ✅

---

## Sistem Notları

- `saveBridge()` fonksiyonu her uzman görüşmesinden sonra `AsyncStorage`'a kaydeder
- Anahtar: `BRIDGE_latest`
- Format: `[KULLANICI] ... [UZMAN] ...` transcript yapısı
- STUCK tespiti sonrası Expert görüşmesi otomatik BRIDGE kaydına eklenir

---

*NOKTA · NAIM Ecosystem · Track B · 231118087*