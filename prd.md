# 📋 CampusBite - Ürün Gereksinim Belgesi (PRD)

## 1. Proje Özeti
**CampusBite**, üniversite kampüslerindeki yemekhane ve kantinlerin gıda israfını önlemek için tasarlanmış, yapay zeka destekli ve oyunlaştırma temelli bir web uygulamasıdır. Sistem, işletmelerin üretim fazlasını tahmin eder ve bu ürünleri öğrenciler için uygun fiyatlı "Sürpriz Paketler" haline getirir.

---

## 2. Kullanıcı Hedefleri
### 👤 Öğrenci (Tüketici)
- Bütçe dostu ve taze gıdaya hızlıca ulaşmak.
- Beslenme tercihlerine (Vegan, Glütensiz vb.) uygun seçenekleri görmek.
- Gıda kurtardıkça puan kazanıp rütbe atlamak.

### 💼 İşletmeci (Kantin/Kafe)
- Gün sonu oluşacak zararı ve israfı minimize etmek.
- AI destekli stok tahmini ile üretimi optimize etmek.
- Kampüs içinde sürdürülebilir bir marka imajı çizmek.

---

## 3. Temel Özellikler (Core Features)

### 🤖 AI Tahminleme & Dinamik Fiyatlandırma
- **Tahmin Motoru:** Geçmiş satış verileri ve kampüs yoğunluğuna göre potansiyel artacak ürünleri belirler.
- **Otomatik İndirim:** Kapanış saatine yaklaştıkça ürün fiyatlarını kademeli olarak düşüren algoritma.

### 🎮 Oyunlaştırma (Gamification)
- **Rütbe Sistemi:** Kullanıcılar aldıkları her paketle XP (Deneyim Puanı) kazanır.
- **Liderlik Tablosu:** Haftalık/Aylık bazda en çok karbon tasarrufu yapan "İsraf Avcıları" listesi.
- **Fidan Gelişim Sistemi (Yeşilcan):** Kullanıcı profilinde yer alan dijital fidan, kurtarılan her paketle büyür ve kullanıcıya bir sonraki rütbeye kalan paket sayısını progress bar ile gösterir.

### 🔍 Akıllı Filtreleme
- Kullanıcının önceden seçtiği diyet tercihlerine göre AI destekli paket önerileri.

---

## 4. Uygulama Sayfaları (Sitemap)
1. **Giriş/Kayıt:** Google veya üniversite e-postası ile hızlı erişim.
2. **Keşfet (Ana Sayfa):** Mevcut paketlerin listelendiği, harita destekli ana ekran.
3. **İşletme Paneli:** Stok girişi, AI tahmin raporları ve "Yeni Paket Yayınla" alanı.
4. **Profil & Başarılar:** Kullanıcının rütbesi, toplam kurtarılan yemek sayısı ve dijital rozetler.
   - Fidan Gelişim Modali: "Yeşilcan" emojisi, ilerleme çubuğu ve "Eko-Kaşif rütbesine X paket kaldı" bilgisi.

---

## 5. Teknik Altyapı (Tech Stack)
- **Frontend:** Next.js (Tailwind CSS ile Mobil Uyumlu Tasarım)
- **Backend:** Python (FastAPI)
- **Veritabanı:** Supabase (PostgreSQL)
- **Yapay Zeka:** Google Gemini API