# IETT Heatmap ArcGIS Dashboard

ArcGIS Maps SDK for JavaScript kullanılarak geliştirilen bu web GIS uygulaması, İstanbul’daki IETT otobüs duraklarını interaktif bir harita üzerinde görselleştirir. Uygulama; heatmap, cluster, point gösterimi, durak etiketleri, tablo görünümü ve rota oluşturma özelliklerini içerir.

## Proje Özeti

Bu proje, IETT otobüs duraklarının konumsal dağılımını analiz etmek ve kullanıcıya farklı zoom seviyelerinde farklı görselleştirme yöntemleri sunmak amacıyla hazırlanmıştır.

Harita davranışı zoom seviyesine göre değişir:

* Uzak ölçekte duraklar heatmap olarak gösterilir.
* Orta ölçekte duraklar cluster olarak gruplanır.
* Yakın ölçekte duraklar point olarak gösterilir ve durak adları etiketlenir.
* Yakın ölçekte Feature Effect kullanılarak durak noktaları daha görünür hale getirilir.

## Kullanılan Teknolojiler

* ArcGIS Maps SDK for JavaScript
* Vite
* JavaScript
* HTML
* CSS
* GeoJSON

## Temel Özellikler

* 2D ArcGIS MapView haritası
* IETT otobüs duraklarının GeoJSON üzerinden gösterimi
* Heatmap görselleştirme
* Cluster gösterimi
* Point gösterimi
* Yakın zoom seviyesinde durak adı etiketleri
* Feature Effect kullanımı
* Search Widget ile durak arama
* Directions Widget ile rota oluşturma
* Durak tablosu görüntüleme
* Harita extent’i içindeki durak sayısını gösterme
* Başlangıç noktası seçerek rota oluşturma
* Haritadan seçilen durak veya noktaya rota alma
* Rota paneli açma/kapatma
* Rota temizleme
* Responsive ve modern dashboard arayüzü

## Veri

Uygulamada kullanılan durak verisi GeoJSON formatındadır.

Dosya yolu:

```text
public/Data/OtobusDuraklari.geojson
```

GeoJSON içerisindeki temel alanlar:

```text
ADI
DURAK_KODU
DURAK_TIPI
YON_BILGISI
DURUMU
ILCEID
MAHALLEID
```

## Kurulum

Projeyi klonladıktan sonra bağımlılıkları yükleyin:

```bash
npm install
```

Geliştirme sunucusunu başlatın:

```bash
npm run dev
```

Tarayıcıda açın:

```text
http://localhost:5173/
```

## ArcGIS API Key

Directions Widget ve bazı ArcGIS servisleri için ArcGIS Developer API key gereklidir.

Proje ana dizininde `.env` dosyası oluşturun:

```env
VITE_ARCGIS_API_KEY=YOUR_ARCGIS_API_KEY
```

`src/main.js` içinde API key şu şekilde kullanılmalıdır:

```js
esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
```

> Not: `.env` dosyası GitHub’a gönderilmemelidir. Bu nedenle `.gitignore` içerisinde `.env` tanımlı olmalıdır.

## Kullanım Akışı

1. Harita açıldığında IETT durakları heatmap olarak görüntülenir.
2. Haritaya yakınlaştıkça gösterim cluster moduna geçer.
3. Daha yakın zoom seviyesinde duraklar point olarak görünür.
4. Point modunda durak adları etiket olarak gösterilir.
5. Başlangıç noktası seçilerek haritadan bir durak veya nokta için rota oluşturulabilir.
6. Durak tablosu açılarak GeoJSON kayıtları tablo halinde incelenebilir.

## Klasör Yapısı

```text
iett-heatmap
│
├── public
│   └── Data
│       └── OtobusDuraklari.geojson
│
├── src
│   ├── main.js
│   └── style.css
│
├── index.html
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Geliştirici Notları

* Heatmap, cluster ve point gösterimi `applyZoomBasedRenderer()` fonksiyonu ile yönetilir.
* Durak etiketleri yalnızca point modunda aktiftir.
* Rota oluşturma işlemi kullanıcının haritadan seçtiği başlangıç noktası üzerinden yapılır.
* Otomatik kullanıcı konumu alınmaz.
* Durak tablosu ArcGIS FeatureTable Widget ile oluşturulmuştur.

## Ekran Görüntüsü
<img width="1899" height="912" alt="image" src="https://github.com/user-attachments/assets/bc7ce9c5-ac70-4b3f-9483-02466613d3be" />

Proje arayüzü modern dashboard yaklaşımıyla hazırlanmıştır. Sol panelde analiz ve kontrol araçları, sağ tarafta ise harita, rota paneli ve durak tablosu yer alır.

## Lisans

Bu proje eğitim ve geliştirme amacıyla hazırlanmıştır.
