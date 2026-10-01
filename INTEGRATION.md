# DuoParty — Web Entegrasyon ve Kullanım Kılavuzu 🍿

Bu kılavuz, **DuoParty** uygulamasını mevcut web sitenize nasıl kolayca entegre edeceğinizi, nasıl çalıştıracağınızı ve tüm özellikleri (YouTube, Netflix, WebRTC Sesli Sohbet) nasıl kullanacağınızı açıklar.

---

## 🚀 Hızlı Başlangıç

### 1. Sunucuyu Başlatma
Terminalde `server` dizinine gidip sunucuyu başlatın:
```bash
cd /Users/denizaltunay/Desktop/teleparty/server
npm start
```
Sunucu başladığında şu çıktıyı göreceksiniz:
```
===============================================
🎬 DuoParty Sunucusu Aktif!
🌐 Web Adresi: http://localhost:3000
💑 Özel Oda: deniz-nehir
===============================================
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine gidin.

---

## 🌐 Mevcut Web Sitenize Entegre Etme Seçenekleri

### Yöntem 1: IFrame ile Herhangi Bir Sayfaya Gömme (En Kolay)
Mevcut web sitenizin herhangi bir sayfasına (HTML, React, WordPress, Next.js vb.) aşağıdaki iframe kodunu ekleyebilirsiniz:

```html
<iframe
  src="https://sizin-sunucu-adresiniz.com"
  allow="microphone; camera; display-capture; autoplay; fullscreen"
  style="width: 100%; height: 100vh; border: none; border-radius: 16px;"
></iframe>
```

> [!IMPORTANT]
> `allow="microphone; display-capture; autoplay; fullscreen"` parametreleri hayati önem taşır. Tarayıcının iframe içerisinden mikrofon ve ekran paylaşımı izni vermesini sağlar.

### Yöntem 2: Alt Alan Adı (Subdomain) ile Yayınlama (Önerilen)
Web sitenizin alt alan adına yönlendirebilirsiniz (Örn: `party.websiteniz.com` veya `sinema.websiteniz.com`).
- Sunucuyu ücretsiz olarak **Render**, **Railway**, **Fly.io** veya kendi VPS sunucunuza (Nginx + PM2) deploy edebilirsiniz.

---

## 🎬 Özellikler ve Kullanım

### 1. Giriş ve Profil Seçimi
- Girişte tek tıkla **👦 Deniz** veya **👧 Nehir** profilinizi seçin.
- Varsayılan oda adı: `deniz-nehir`. Odaya gir butonuna basın.

### 2. Platform Seçimi
- Karşınıza çıkan ekranda **🔴 YouTube** veya **🍿 Netflix** seçeneğine tıklayın.
- İstediğiniz zaman üst bardaki **"Platform Değiştir"** butonuyla diğer platforma geçebilirsiniz; partnerinizin ekranı da sizinle eşzamanlı olarak değişir.

### 3. YouTube Birlikte İzleme
- Arama çubuğuna herhangi bir YouTube video linki yapıştırın (Örn: `https://www.youtube.com/watch?v=...` veya `https://youtu.be/...`).
- **Oynat / Durdur:** Videoyu durdurduğunuzda veya başlattığınızda partnerinizde de <50ms içinde anında durur/başlar.
- **İleri / Geri Sarma:** Video zaman çubuğunda herhangi bir yere tıkladığınızda partneriniz de aynı saniyeye sarılır.
- **🔄 Partnerimle Eşitle Butonu:** İnternet dalgalanması olursa tek tıkla tam zaman hizalaması yapar.

### 4. Netflix Sanal Sinema (Ekran & Ses Paylaşımı)
> Netflix'in güvenlik protokolleri gereği hiçbir web sitesi Netflix'i iframe içinde doğrudan açamaz. Bu yüzden en akıcı yöntem olan WebRTC Sanal Sinema Salonu entegre edilmiştir.

1. Netflix moduna geçin.
2. **"Netflix Sekmesini Paylaş"** butonuna tıklayın.
3. Açılan tarayıcı penceresinde:
   - **Chrome Sekmesi** sekmesini seçin.
   - Açık olan **Netflix** sekmesini seçin.
   - Sol alttaki **"Sekme sesini de paylaş" (Also share tab audio)** kutucuğunu MUTLAKA işaretleyin.
4. Netflix dizisi/filmi, sesiyle birlikte doğrudan partnerinizin ekranına canlı akar! Partnerinizin Netflix hesabı olmasına bile gerek kalmaz.

### 5. Dahili WebRTC Sesli Sohbet (Voice Chat)
- Sağ paneldeki **"🎙️ Mikrofonu Aç"** butonuna basarak mikrofon izni verin.
- **Konuşma Göstergesi:** Konuştuğunuz anda avatarınızın etrafında canlı neon yeşil/mavi/pembe halkalar parıldar.
- **Susturma:** Butona tekrar basarak mikrofonu sessize alabilirsiniz.
- **Partner Ses Düzeyi:** Alttaki kaydırma çubuğu ile film sesini kısmadan partnerinizin sesini istediğiniz gibi kısıp açabilirsiniz.
- Tarayıcı seviyesinde dahili yankı engelleme (Echo Cancellation) ve arka plan gürültü engelleme (Noise Suppression) açıktır.
