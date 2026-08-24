# IELTS AI Master - Cloudflare Pages & Mobile PWA

Faqat o'zingiz uchun mo'ljallangan, Cambridge va IDP standartlari asosidagi to'liq dinamik AI-powered IELTS mobil ilovasi.

---

## ⚡ Cloudflare Pages'ga Yuklash (Deploy) Bo'yicha Qo'llanma

Ilova Cloudflare Pages uchun 100% moslashtirilgan. Ma'lumotlar foydalanuvchi qurilmasida (LocalStorage / IndexedDB) xavfsiz saqlanadi, zaxiralash (Export/Import JSON) mavjud va to'g'ridan-to'g'ri Google Gemini AI bilan ishlaydi.

### 🌟 1-usul: Cloudflare Dashboard orqali (Eng oson, 1 daqiqa)
1. Brauzerda [dash.cloudflare.com](https://dash.cloudflare.com/) saytiga kiring.
2. Chap menyudan **Compute (Workers & Pages)** -> **Create Application** -> **Pages** bo'limiga o'ting.
3. **Upload assets** (Fayllarni yuklash) tugmasini bosing.
4. Loyiha nomini kiriting (masalan: `ielts-ai-master`).
5. Loyiha papkasini (`C:\Users\user\.gemini\antigravity\scratch\ielts_ai_master`) yoki tayyorlangan `ielts-ai-master-cloudflare.zip` faylini yuklang.
6. **Deploy Site** tugmasini bosing.
7. Ilovangiz darhol `https://ielts-ai-master.pages.dev` manzilida ishga tushadi!

---

### 🌟 2-usul: GitHub orqali
1. Loyihani GitHub reponizga push qiling.
2. Cloudflare Pages'da **Connect to Git** orqali reponi tanlang.
3. **Build command**: bo'sh qoldiring (hech narsa yozish shart emas).
4. **Build output directory**: `/` (root).
5. **Save and Deploy** tugmasini bosing.

---

### 🌟 3-usul: Wrangler CLI orqali
```bash
npx wrangler pages deploy . --project-name=ielts-ai-master
```

---

## 📱 Smartfonga O'rnatish (PWA - iOS & Android)
1. Telefoningizda `https://<sizning-loyihangiz>.pages.dev` manzilini oching.
2. **iPhone (Safari)**: "Ulashish" (Share) -> **"Bosh ekranga qo'shish" (Add to Home Screen)**.
3. **Android (Chrome)**: 3 nuqta menyu -> **"Ilovani o'rnatish" (Install App)**.
4. Ilova xuddi App Store / Google Play'dagi original dastur kabi to'liq ekranda ishlaydi.

---

## 🧠 Barcha 8 ta Bo'lim:
1. **Dashboard**: Barcha bo'limlar progress-bari, streak, o'rganilgan so'zlar.
2. **Article**: Yakka va ulgurji (~200 ta) maqolalar, matndan so'z tanlab 1-bosishda SRS ga qo'shish, IELTS Comprehension, Speaking (STT mikrofon) va Writing tahlili.
3. **Podcast**: Havola / transkript kiritish, Native TTS audio, Speaking va Writing.
4. **Dictation**: Speechling.com uslubida 2-daqiqa audio diktant, qizil/yashil xatolarni aniqlash.
5. **Vocabulary (SRS)**: 1d, 4d, 7d, 14d, 30d -> Learned bosqichli 3D Flashcard.
6. **Mistakes**: Xatolar daftari va tahlillar.
7. **Sentences**: C1 Band 7.5+ gap qurilmalari bilan daily mashq.
8. **Study Plan**: Kunlik Lesson 1, 2, 3... tartibli rejalar.
9. **🎓 IELTS AI Ustoz**: Jonli Cambridge / IDP mezonlari bo'yicha tahlil.
10. **Zaxira (Backup)**: Barcha ma'lumotlarni 1 bosishda JSON yuklab olish va boshqa telefonga o'tkazish.

---

## ☁️ Cloudflare KV orqali Cloud Sync (haqiqiy bulutli baza)

Standart holatda barcha ma'lumot faqat brauzeringizning LocalStorage'ida saqlanadi (bitta qurilma bilan cheklangan, ~5-10MB limit). Cloud Sync'ni yoqsangiz, `functions/api/kv/[key].js` fayli orqali ma'lumotlar Cloudflare KV'ga ham nusxalanadi — shunda boshqa qurilmadan kirganingizda ham, brauzer keshini tozalasangiz ham ma'lumotingiz saqlanib qoladi.

⚠️ **MUHIM — deploy usuli haqida**: Cloudflare'ning dashboard'dagi oddiy **"drag & drop / Upload assets"** usuli `/functions` papkasini umuman qo'llab-quvvatlamaydi (Cloudflare buni rasman tasdiqlagan cheklov). Ya'ni README'dagi yuqoridagi **1-usul bilan Cloud Sync ishlamaydi**. Cloud Sync uchun albatta **2-usul (GitHub orqali)** yoki **3-usul (Wrangler CLI: `npx wrangler pages deploy .`)** dan foydalaning — ikkalasi ham `/functions` papkasini avtomatik aniqlab, ishga tushiradi.

**Sozlash (bir martalik, ~3 daqiqa):**
1. Loyihani 2- yoki 3-usul bilan deploy qiling (yuqoriga qarang)
2. Cloudflare Dashboard → **Storage & Databases → KV** → **Create namespace** (masalan nomi: `ielts-data`)
3. Loyihangiz sahifasiga o'ting: **Pages loyihangiz → Settings → Functions → KV namespace bindings** → **Add binding**
   - Variable name: `IELTS_DB`
   - KV namespace: yuqorida yaratgan `ielts-data`ni tanlang
4. Yana o'sha loyihada: **Settings → Environment variables** → **Add variable** (Production **va** Preview'ga ham qo'shing)
   - Name: `SYNC_TOKEN`
   - Value: o'zingiz o'ylab topgan uzun, tasodifiy parol (masalan 30+ belgili)
5. O'zgarishlar kuchga kirishi uchun loyihani qayta deploy qiling (Retry deployment)
6. Ilovada: **Sozlamalar → ☁️ Cloudflare Cloud Sync** bo'limiga kiring, "Cloud Sync yoqilgan"ni belgilang, "Sync Token" maydoniga 4-qadamda kiritgan **aynan shu parolni** yozing va saqlang
7. **"Hozirgi ma'lumotni bulutga yuborish"** tugmasini bosing — bu joriy LocalStorage'dagi hammasini bir martalik Cloudflare KV'ga yuklaydi

Shundan keyin har safar artikl/podkast/so'z qo'shganingizda avtomatik ravishda ham LocalStorage'ga, ham Cloudflare KV'ga yoziladi. Boshqa qurilmada ochganingizda (xuddi shu Sync Token bilan) ilova avtomatik bulutdagi eng so'nggi ma'lumotni tortib oladi.

⚠️ **Eslatma**: SYNC_TOKEN'ni hech kimga bermang — bu sizning shaxsiy ma'lumotlaringizni himoya qiladigan yagona parol.
