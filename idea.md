# Proje Adı: CampusBite
**Motto:** Kampüste Akıllı, Hızlı ve İsrafsız Beslenme

## 1. Problem Tanımı
Üniversite kampüslerindeki yemekhane ve kantinler, günlük talep belirsizliği nedeniyle her gün büyük miktarda taze gıdayı israf etmektedir. Mevcut çözümler (Too Good To Go vb.) kampüs dışına odaklıdır ve öğrenci diyetlerine (vegan, glütensiz vb.) göre kişiselleştirilmiş, anlık fırsatlar sunmamaktadır. Ayrıca, kullanıcı bağlılığını artıracak bir motivasyon sistemi eksiktir.

## 2. Çözüm (AI, IE & Gamification)
CampusBite, kampüs ekosistemine özel bir envanter ve paylaşım platformudur:
- **Proaktif Tahminleme:** Geçmiş satış verilerini analiz ederek işletmeciye "artacak" ürünleri önceden haber verir.
- **Dinamik Paketleme:** Sadece gün sonu değil, öğle sonrası gibi ölü saatlerde otomatik indirimli paketler oluşturur.
- **Gıda Kurtarıcısı Rütbe Sistemi:** Öğrenciler yaptıkları her alımla "Karbon Puanı" kazanır ve "Acemi Isırık"tan "Eko-Efsane"ye kadar rütbe atlayarak özel indirimler/ayrıcalıklar kazanır.
- **Fidan Gelişim Sistemi (Yeşilcan):** Kullanıcının kurtardığı her paket, dijital fidanı "Yeşilcan"ı büyütür; ilerleme çubuğu üzerinden bir sonraki rütbeye kalan paket sayısı anlık gösterilir.

## 3. Hedef Kitle
- **Kullanıcılar:** Bütçesini düşünen, sürdürülebilirlik bilinci yüksek ve topluluk içinde statü (rütbe) kazanmak isteyen üniversite öğrencileri.
- **İşletmeler:** Kampüs içi kantinler, yemekhaneler ve okul çevresindeki kafeler.

## 4. Temel Farklılıklar (UVP)
- **Hız ve Yerellik:** Tamamen kampüs içi lojistiğe ve öğrenci programına uygun zamanlama.
- **Diyet Dostu AI:** Sürpriz paketleri kullanıcının alerji ve tercihlerine göre filtreleyen zeka.
- **Oyunlaştırılmış Deneyim:** Basit bir alışveriş uygulamasından öte, bir "kampüs kahramanlık" platformu.
- **Görsel Motivasyon Katmanı:** Rütbe yolculuğunu somutlaştıran "Yeşilcan" fidan ilerlemesi ile günlük kullanım alışkanlığını güçlendirme.

## 5. Teknik Stack (Prototip Planı)
- **Frontend:** Next.js (Web & Mobile Responsive)
- **Backend:** Python / FastAPI
- **AI:** Google Gemini API (Kişiselleştirilmiş öneriler ve kullanıcı motivasyon mesajları)
- **Veri Yönetimi:** Supabase (PostgreSQL) - Kullanıcı puanları ve rütbe takibi için.