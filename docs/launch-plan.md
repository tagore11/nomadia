# Nomadia — Lansman Planı ve İlk 1000 Kullanıcı (23 Tem 2026)

Bu belge: (1) lansman için teknik hazırlık kapısı, (2) Launch Squad ajan takımı,
(3) ilk 1000 kullanıcı GTM. Kaynak: 3 paralel kod incelemesi + founder notları.

---

## 0. TEK CÜMLE GERÇEK
Ürün bugün **gerçek para için hazır değil.** İlk 1000 = **kapalı beta / testnet /
elle gözetilen küçük işlemler** ile "güven + funnel kanıtı" toplama fazı. Hacim değil,
tekrar (repeat) ve yatırımcı verisi peşindeyiz.

---

## 1. LANSMAN HAZIRLIK KAPISI (bu maddeler bitmeden gerçek para YOK)

### 🔴 Bloker — Escrow kontratı (mainnet öncesi ŞART)
- **Yarı-onay açığı (CRITICAL):** karşı taraf nakiti verip on-chain onayladıktan sonra
  bile depositor 2 saat sonunda `refund()` çekip hem nakiti hem kriptoyu alabiliyor.
  Klasik P2P dolandırıcılık kalıbı, kontrat yapısal olarak izin veriyor.
  → Düzeltme: `counterpartyConfirmed == true` iken `refund()` bloklanmalı veya dispute
  state'e gitmeli.
- **confirm vs refund yarışı (HIGH):** timeout anında ikisi de geçerli; depositor geç
  gelen release'i front-run'layıp refund'la geri alabilir. → confirm timeout'ta bitmeli
  ya da refund grace period / depositor-only olmalı.
- **Token allowlist yok (MEDIUM):** herkes "USD Coin" adlı sahte token'la teklif açabilir;
  fee-on-transfer token'lar havuzu boşaltabilir. → sadece Base USDC allowlist.
- **Cancel yolu yok:** yanlış adres / no-show'da fonlar 2 saat kilitli. → pre-timeout cancel/decline.
- **Redesign sonrası dış audit** (state machine değişiyor, mevcut testler yetersiz).

### 🔴 Bloker — Backend / veri
- **DB `/tmp`'de uçuyor (CRITICAL):** better-sqlite3 Vercel `/tmp`'de — her cold start'ta
  siliniyor, instance'lar arası tutarsız. Çok kullanıcılı state İMKANSIZ. → Supabase/Postgres'e geç.
  Bu aynı zamanda analytics'in ön koşulu (event verisi de kalıcı olmalı).
- **Sunucu chain'i doğrulamıyor (CRITICAL):** DB `released`/`refunded` durumunu tarayıcının
  sözüne göre yazıyor; hiçbir on-chain tx olmadan işlem "tamamlandı" işaretlenebilir.
  → sunucu escrow event'ini okuyup doğrulamalı (source of truth = chain).
- **GET endpoint'leri auth'suz (HIGH):** sıralı id'lerle herkesin telegram_id + cüzdan
  adresi hasat edilebilir (PII sızıntısı). → auth + yetki.
- **Teklif claim yarışı (HIGH):** iki kullanıcı aynı teklifi kapabiliyor (koşullu WHERE yok).
- **initData replay (HIGH):** `auth_date` tazelik kontrolü yok, yakalanan initData sonsuza
  dek geçerli. → expiry ekle.

### 🟡 Lansman öncesi temizlik
- `DebugErrorOverlay` prod'dan kaldır (ham hata sızdırıyor).
- `nomadia.db` dosyaları repo'dan çıkar.
- Negatif/garbage input validasyonu (amount, wallet, city).

### Sıra (mühendislik)
1. SQLite → Supabase/Postgres + event tracking tabloları
2. Sunucu-taraflı chain doğrulama (escrow okuma)
3. Escrow kontrat redesign (yarı-onay + race + allowlist + cancel) → test → audit
4. Auth sertleştirme (initData expiry, GET auth, claim WHERE)
5. Analytics funnel event'leri
> Not: 1-2-4-5 kapalı beta için yeterli (testnet, elle gözetim). 3 = gerçek para kapısı.

---

## 2. LAUNCH SQUAD (kurulu ajan takımı)

| Komut | Rol | Ne zaman |
|---|---|---|
| `/nomadia-launch-lead` | Komutan — funnel + koordinasyon + kill kriteri | Haftalık ritüel, giriş noktası |
| `/nomadia-scout` | Hedef kullanıcı avcısı (Telegram+X sinyal taraması) | Yeni koridor açarken |
| `/nomadia-outreach` | Kişiye özel 1:1 davet + takip dizisi | Scout listesi hazır olunca |
| `/nomadia-growth` | Funnel/referral/retention taktikleri | Metrik tıkandığında |

Mevcut destek: `/x-growth-agent` (içerik/tweet), `/council` (stratejik ikilem).
Anti-spam anayasası tüm outreach'te bağlayıcı — Telegram HER ZAMAN MCP, gönderim öncesi Sait onayı.

---

## 3. ÇEKİRDEK ÜÇLÜ (McDonald's sadeliği)
1. Teklif ver · 2. Eşleş · 3. Güvenle değiş + puan.
Menüde bu üçe hizmet etmeyen özellik yok. Çıkarılacaklar: swipe UI, uygulama-içi chat,
ZK+biyometri (şimdilik), çoklu zincir/token, kripto↔kripto, token/kart/API/merchant,
sosyal login kalabalığı, tam harita altyapısı.

---

## 4. İLK 1000 — ŞEHİR BAZLI NOKTA FETHİ
Tek koridor doygunluğu, sırayla:
1. **Kaş / Nashi v Kashe** (Samir @retas_retas, 19.6K Rus) — RUB↔TRY, Sait insider. İLK.
2. **Dubai** — crypto-friendly, gözetimli, Sait bağlantısı.
3. **Bali · Tiflis** — nomad yoğun.
ZuKaş Eylül 2026 = canlı pilot (100+ işlem, yatırımcı kanıtı).

## 5. FUNNEL + KILL KRİTERİ
Görüntüleme → Teklif → Eşleşme → Kilit → Serbest → Puan → **Tekrar**.
Kuzey yıldızı = repeat oranı. 2 noktada repeat < %30 → OTC broker pivotu.

## 6. YATIRIMCI KANITI (paralel hedef)
Toplanacak: funnel dönüşümleri, repeat %, GMV, koridor talebi, kullanıcı hikâyeleri.
Hedef tur: pre-seed $600-750K @$6-8M (Balaji/Eylül penceresi). Analytics olmadan veri yok.

---

## 7. UX / ÜRÜN BÜTÜNLÜĞÜ

### 🔴 3 funnel kırılması (cila değil, bunlar kapıyı kapatıyor)
1. **Prod PWA yazma ölü:** Telegram dışı tarayıcı kullanıcısı (=PWA'nın tüm amacı)
   prod'da teklif oluşturamıyor — auth dev-header'ı reddediyor, ama banner "misafir
   modunda tekliflerin cihaza bağlı" diyerek çalışıyormuş gibi gösteriyor. Sıfırıncı
   adımda kırık vaat. → PWA kullanıcısı için gerçek kimlik yolu (wallet-imza tabanlı)
   veya "Telegram'da aç" yönlendirmesi şart.
2. **Eşleşen taraflar birbirine ulaşamıyor:** karşı taraf @handle'ı hiç saklanmıyor/
   gösterilmiyor; "Telegram sohbetinizde devam edin" denen sohbet yok. Çekirdek buluşma
   adımı ürün içinde imkansız. → eşleşince iki tarafın Telegram handle'ı gösterilmeli/
   deep-link verilmeli.
3. **Poster kendi teklifini bulamıyor + bildirim yok:** "benim tekliflerim" sayfası yok,
   liste sadece `open` gösteriyor, biri kapınca teklif kayboluyor. URL'i kaydetmediyse
   kendi işlemine dönemiyor, eşleştiğini öğrenemiyor. → "my offers" sayfası + eşleşme bildirimi.

### 🔴 Güven yüzeyi — $500 nakit vermeden önce eksik olan her şey
Teklif detay sayfası karşı taraf hakkında SIFIR şey gösteriyor:
- **Kimlik sinyali yok:** isim/foto/@handle yok, boşluğa karşı işlem yapıyorsun.
- **İtibar yok:** puanlar toplanıyor ama ortalama/işlem sayısı/hesap yaşı hiçbir yerde
  gösterilmiyor (veri modeli destekliyor, yüzey yok). MILESTONES Faz 0 "puan match
  kartında görünmeli" diyor — yapılmamış.
- **Escrow kanıtı yok:** `chain_offer_id` "#3" olarak görünüyor, Basescan linki yok,
  on-chain kilitli miktar doğrulaması yok. Nakit taşıyanı ikna edecek TEK şey (kripto
  gerçekten kilitli, kendin doğrula) yok. Testnet/mainnet göstergesi de yok — kullanıcı
  MockUSDC'yi gerçek para sanabilir.
- **Güvenlik rehberi yok:** safe_zone hiç doldurulmuyor, buluşma noktası listesi yok,
  ilk işlem limiti (D-014) yok.
- **Dispute yolu yok:** report butonu yok, `disputed` statüsü yok, no-show'da ne olacağı
  belirsiz (yanlış etiketli refund linki dışında).
- **Adil kur sinyali yok:** piyasadan %20 sapık fiyat işaretlenmiyor (klasik scam vektörü).

### 🟡 Spec vs gerçek (yarım kalanlar)
- Puanlama yazılıyor ama hiçbir yerde GÖSTERİLMİYOR (itibar sisteminin tamamı depoda kalmış).
- Aylık işlem limiti (D-014 sybil önlemi) = %0 uygulanmış.
- Rate reference (piyasa kuru) yok — kullanıcı kör kur uyduruyor.
- Offer expiry yarım: liste filtreliyor ama statü `expired`'a dönmüyor; süresi geçmiş
  teklif direkt URL'den hâlâ kapılabiliyor.
- safe_zone / meetupNote / counterparty handle: kolon var, UI hiç set etmiyor.
- Timeout frontend'de `ESCROW_TIMEOUT_SECONDS` tanımlı ama kullanılmıyor → refund butonu
  kilit anında görünüyor, erken tıklanınca on-chain revert.

### 🟡 i18n (genelde temiz, 4 hata)
- Key pariteleri kusursuz (en/tr/ru aynı).
- **Perspektif bug'ı:** detay sayfası "youSend/youReceive"i izleyenin rolünden değil
  locker rolünden alıyor — teklifi inceleyen yabancı "sen 200 USDC veriyorsun" diye ters
  okuyor. (kod: `offers/[id]/page.tsx:62-63`)
- TR/RU timeout'u sabit kodluyor ("2 saat doldu") — kontrat parametresi değişirse yalan söyler.
- TR/RU "approve" ile "confirm" adımlarını neredeyse aynı stringle gösteriyor (MainButton'da karışıyor).
- RU `markReleasedTitle` 380px'de kesiliyor.

### 🟡 README yanlış
- "wagmi 2 + RainbowKit 2 (pinned)" diyor ama kod **Reown AppKit** kullanıyor ve hiçbir
  şey pinli değil (`^` aralıkları). Güncellenmeli.

### Kapalı beta için minimum UX düzeltme sırası
1. Eşleşen taraflara Telegram handle göster (buluşma mümkün olsun)
2. "Benim tekliflerim" sayfası + eşleşme bildirimi
3. Teklif detayında karşı taraf kimlik + itibar (puan ortalaması, işlem sayısı)
4. Escrow doğrulama rozeti + Basescan linki + testnet göstergesi
5. Onboarding "nasıl çalışır" (escrow/gas/testnet/kim önce kilitler)
6. Confirm adımına "sadece nakit el değiştirdikten sonra onayla" uyarısı
7. i18n perspektif bug'ı + refund buton timeout gate
> Not: fiat→crypto yönünde poster'ın cüzdanı sonradan eklenemiyor (dead-end) — bu da
> onboarding'de wallet akışıyla çözülmeli.
