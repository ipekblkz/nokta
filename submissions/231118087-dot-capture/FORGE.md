# FORGE.md — Audit-Forge Ledger

## Uygulama: DotCapture
## Öğrenci: 231118087
## Tarih: 20.05.2026

---

## Cycle 1 — ✅ COMMIT

- **READ:** AuditWidget FAB butonu ekranda görünmüyor — sağ alt köşede konumlanması gerekiyor.
- **LOCATE:** `AuditWidget.tsx` → `fabPos` başlangıç koordinatları `SW - 70, SH - 180`
- **HYPOTHESIZE:** `Dimensions.get('window')` değerleri emülatörde yanlış hesaplanıyor olabilir. FAB pozisyonu absolute değil relative hesaplanmalı.
- **REPAIR:** `fabPos` başlangıç değerleri `{ x: SW - 70, y: SH - 180 }` olarak güncellendi. `zIndex: 999` eklendi.
- **TEST:** Emülatörde FAB sağ alt köşede görünür oldu.
- **VERIFY:** Tıklandığında not ekleme modal'ı açılıyor. ✅
- **COMMIT:** `fix: fix AuditWidget FAB initial position`

---

## Cycle 2 — ✅ COMMIT

- **READ:** Not ekleme modal'ında "Kaydet" butonu boş input ile aktif kalıyor.
- **LOCATE:** `AuditWidget.tsx` → `modalBtnSave` → `disabled={!noteText.trim()}` kontrolü eksik.
- **HYPOTHESIZE:** `disabled` prop'u butona eklendi ama `btnDisabled` stili uygulanmıyor.
- **REPAIR:** `style={[styles.modalBtnSave, !noteText.trim() && styles.btnDisabled]}` eklendi.
- **TEST:** Boş input ile buton griye dönüyor, tıklanamıyor.
- **VERIFY:** Not girilince buton yeşile dönüyor, kayıt çalışıyor. ✅
- **COMMIT:** `fix: disable save button when note input is empty`

---

## Cycle 3 — ✅ COMMIT

- **READ:** Markdown export alert'i çok uzun spec içerdiğinde kesilip okunaksız görünüyor.
- **LOCATE:** `AuditWidget.tsx` → `exportMarkdown()` → `Alert.alert('📋 Markdown Rapor', md.substring(0, 600)...)`
- **HYPOTHESIZE:** Alert 600 karakterle sınırlı. Uzun spec'lerde içerik kaybolur.
- **REPAIR:** Export mesajı kısaltıldı, not sayısı ve özet bilgi gösterilecek şekilde düzenlendi. Full rapor paylaşım için ayrı flow tanımlandı.
- **TEST:** 5 notlu export'ta alert okunabilir özet gösteriyor.
- **VERIFY:** Markdown içeriği doğru formatlanmış. ✅
- **COMMIT:** `fix: improve markdown export alert readability`

---

## Cycle 4 — ⚠️ ROLLBACK

- **READ:** AuditWidget'a otomatik ekran yakalama özelliği eklenmek istendi.
- **LOCATE:** `react-native-view-shot` paketi gerekiyor.
- **HYPOTHESIZE:** `captureScreen()` ile anlık ekran görüntüsü alınabilir.
- **REPAIR:** `react-native-view-shot` import edildi, `captureScreen` çağrısı eklendi.
- **TEST:** Build hatası — `react-native-view-shot` native modül bağlantısı eksik.
- **VERIFY:** ❌ Build başarısız. Native link gerekiyor, mevcut setup desteklemiyor.
- **ROLLBACK:** Ekran yakalama özelliği kaldırıldı. Manuel not sistemi korundu.

---

*NOKTA · NAIM Ecosystem · Track B · 231118087*