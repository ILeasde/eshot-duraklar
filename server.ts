/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dns from "dns";

// Force Node to prefer IPv4 when fetching from APIs
dns.setDefaultResultOrder("ipv4first");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Global Memory Storage for Interactive States & Live Simulators
  let askidaState = {
    AskidaBekleyenKart: 1845,
    AskidanAlinanKart: 52410,
    ToplamOdenenTutar: 1048200.0,
  };

  // Recent Donation Logs
  let bagisGecmisi = [
    { id: "1", tarih: "14:15", miktar: 50, kartAdedi: 2, donorIsim: "S. Değer" },
    { id: "2", tarih: "13:42", miktar: 25, kartAdedi: 1, donorIsim: "A. Yılmaz" },
    { id: "3", tarih: "12:05", miktar: 100, kartAdedi: 4, donorIsim: "M. Kaya" },
  ];

  // --- Tüm ESHOT Durak Verileri (CSV'den) ---
  let cachedStops: any[] | null = null;
  
  function loadStopsFromCSV(): any[] {
    if (cachedStops) return cachedStops;
    
    const csvPath = path.join(__dirname, "eshot-otobus-duraklari.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.trim().split("\n");
    
    cachedStops = lines.slice(1) // Skip header
      .map(line => {
        const parts = line.split(";");
        if (parts.length < 4) return null;
        const id = parts[0].trim();
        const name = parts[1].trim();
        const lat = parseFloat(parts[2]);
        const lng = parseFloat(parts[3]);
        const linesStr = parts[4] ? parts[4].trim().replace(/\r/g, "") : "";
        const hatlar = linesStr ? linesStr.split("-").map((l: string) => l.trim()).filter((l: string) => l !== "") : [];
        if (isNaN(lat) || isNaN(lng)) return null;
        return { id, name, lat, lng, lines: hatlar };
      })
      .filter((s: any): s is any => s !== null);
    
    return cachedStops;
  }

  // In-memory bus positioning simulation to guarantee animated, responsive feeds if official APIs time out
  // Lines: 121 (Mavişehir - Konak), 253 (Halkapınar - Konak), 446 (Alaybey - Bostanlı)
  const popularLines = [121, 253, 446, 802];
  const popularStops = [21050, 21056, 21057, 21852];

  // Latitudes and longitudes of various stops around İzmir
  const stopsCoordinates: Record<number, { name: string; lat: number; lng: number }> = {
    21050: { name: "Alsancak Gar", lat: 38.4398, lng: 27.1472 },
    21056: { name: "Konak İskele", lat: 38.4189, lng: 27.1287 },
    21057: { name: "Belediye Sarayı", lat: 38.4192, lng: 27.1293 },
    21852: { name: "Bornova Metro", lat: 38.4632, lng: 27.2117 },
  };

  // Generate real-time simulation tick for buses moving on routes
  function getSimulatedApproachingBuses(durakId: number): any[] {
    const seed = Number(durakId) || 21050;
    
    const stops = loadStopsFromCSV();
    const stop = stops.find(s => s.id === durakId.toString());
    
    // Eğer durak bulunduysa ve geçen hatlar varsa, o hatları kullan. Yoksa rastgele uydur.
    const activeLines = stop && stop.lines.length > 0 ? stop.lines : ["121", "253", "446"];
    
    const lat = stop ? stop.lat : (stopsCoordinates[seed]?.lat || 38.4189);
    const lng = stop ? stop.lng : (stopsCoordinates[seed]?.lng || 27.1287);

    // Limit to max 5 buses
    const linesToSimulate = activeLines.slice(0, 5);

    return linesToSimulate.map((lineNumStr: string, i: number) => {
      const stopsLeft = ((seed + i * 3) % 8) + 1;
      const hatNum = parseInt(lineNumStr) || 0;
      return {
        KalanDurakSayisi: stopsLeft,
        HattinYonu: (i % 2) + 1,
        KoorY: lat + 0.002 * stopsLeft * (i % 2 === 0 ? 1 : -1),
        BisikletAparatliMi: (seed + i) % 2 === 0,
        KoorX: lng - 0.0015 * stopsLeft * (i % 3 === 0 ? 1 : -1),
        EngelliMi: true,
        HatNumarasi: hatNum,
        HatAdi: stop ? `${lineNumStr} Nolu Hat` : "Bilinmeyen Hat",
        OtobusId: 3500 + hatNum + (seed % 10),
      };
    });
  }

  function getSimulatedBusPositions(hatId: number): any {
    const count = 3;
    const items = [];
    const baseStop = stopsCoordinates[21056]; // Konak base

    for (let i = 0; i < count; i++) {
      const stopsAway = i * 4 + 1;
      items.push({
        Yon: (i % 2) + 1,
        KoorX: baseStop.lng + (i - 1) * 0.015 + (Math.sin(Date.now() / 15000 + i) * 0.005),
        KoorY: baseStop.lat + (i - 1) * 0.008 + (Math.cos(Date.now() / 15000 + i) * 0.003),
        OtobusId: 4600 + hatId + i,
      });
    }

    return {
      HataMesaj: "",
      HatOtobusKonumlari: items,
    };
  }

  // --- API ROUTE 1: Askıda İzmirim Kart İstatistikleri (GET) ---
  app.get("/api/iztek/askidaizmirimkart", async (req, res) => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000); // 2-second timeout

      const response = await fetch("https://openapi.izmir.bel.tr/api/iztek/askidaizmirimkart", {
        signal: controller.signal,
      });
      clearTimeout(id);

      if (response.ok) {
        const rawData: any = await response.json();
        // The real API returns details inside structures, we normalize or merge our interactive local gains!
        // Combine real statistics with local interactive support donations so users can see live updates!
        let result = rawData;
        
        // If the server returns empty or unexpected structure, parse it gracefully
        if (result && Array.isArray(result) && result[0]) {
          result = result[0];
        } else if (result && result.askidaizmirimkartistatistik) {
          result = result.askidaizmirimkartistatistik;
        }

        // Merge state to allow donor demo updates
        const merged = {
          AskidaBekleyenKart: Math.max(0, (result.AskidaBekleyenKart || askidaState.AskidaBekleyenKart) - (askidaState.AskidanAlinanKart - 52410)),
          AskidanAlinanKart: result.AskidanAlinanKart || askidaState.AskidanAlinanKart,
          ToplamOdenenTutar: result.ToplamOdenenTutar || askidaState.ToplamOdenenTutar,
        };
        
        return res.json(merged);
      }
    } catch (e) {
      console.log(`[Info] Askida Kart - Serving simulated dataset.`);
    }

    // Fallback to local memory state
    res.json(askidaState);
  });

  // --- API ROUTE 2: Durağa Yaklaşan Otobüsler (GET) ---
  app.get("/api/iztek/duragayaklasanotobusler/:durakId", async (req, res) => {
    const { durakId } = req.params;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://openapi.izmir.bel.tr/api/iztek/duragayaklasanotobusler/${durakId}`, {
        signal: controller.signal,
      });
      clearTimeout(id);

      if (response.ok) {
        const data = await response.json();
        // Return standard array format
        return res.json(Array.isArray(data) ? data : [data]);
      }
    } catch (e) {
      console.log(`[Info] Duraga Yaklasan Otobusler for ${durakId} - Serving simulated predictions.`);
    }

    // Fallback
    res.json(getSimulatedApproachingBuses(Number(durakId)));
  });

  // --- API ROUTE 3: Hattın Durağa Yaklaşan Otobüsleri (GET) ---
  app.get("/api/iztek/hattinyaklasanotobusleri/:hatId/:durakId", async (req, res) => {
    const { hatId, durakId } = req.params;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(
        `https://openapi.izmir.bel.tr/api/iztek/hattinyaklasanotobusleri/${hatId}/${durakId}`,
        { signal: controller.signal }
      );
      clearTimeout(id);

      if (response.ok) {
        const data = await response.json();
        return res.json(Array.isArray(data) ? data : [data]);
      }
    } catch (e) {
      console.log(`[Info] Hattin Yaklasan Otobusleri for ${hatId}/${durakId} - Serving simulation.`);
    }

    // Filter dynamic simulation by line/route
    const allApproaching = getSimulatedApproachingBuses(Number(durakId));
    const filtered = allApproaching.filter((bus) => bus.HatNumarasi === Number(hatId));
    res.json(filtered);
  });

  // --- API ROUTE 4: Hatta Ait Otobüslerin Anlık Konum Bilgileri (GET) ---
  app.get("/api/iztek/hatotobuskonumlari/:hatId", async (req, res) => {
    const { hatId } = req.params;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`https://openapi.izmir.bel.tr/api/iztek/hatotobuskonumlari/${hatId}`, {
        signal: controller.signal,
      });
      clearTimeout(id);

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) {
      console.log(`[Info] Hatta Ait Otobus Konum Bilgileri - Utilizing live position simulator.`);
    }

    res.json(getSimulatedBusPositions(Number(hatId)));
  });

  // --- POST INTERACTIVE API 1: Askıdan Kart Fulfill / Bağış Yap (POST) ---
  app.post("/api/iztek/askidabagis", (req, res) => {
    const { donorIsim, kartAdedi } = req.body;
    const numCards = Number(kartAdedi) || 1;
    const name = donorIsim || "Anonim Destekçi";
    const constPricePerCard = 25.0; // 25 TL per ride donation loading
    const totalDonation = numCards * constPricePerCard;

    if (askidaState.AskidaBekleyenKart >= numCards) {
      askidaState.AskidaBekleyenKart -= numCards;
    } else {
      askidaState.AskidaBekleyenKart = 0;
    }

    askidaState.AskidanAlinanKart += numCards;
    askidaState.ToplamOdenenTutar += totalDonation;

    // Add logs
    const now = new Date();
    const timeFormatted = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    bagisGecmisi.unshift({
      id: Math.random().toString(36).substring(2, 9),
      tarih: timeFormatted,
      miktar: totalDonation,
      kartAdedi: numCards,
      donorIsim: name,
    });

    if (bagisGecmisi.length > 8) {
      bagisGecmisi.pop();
    }

    res.json({
      success: true,
      updatedState: askidaState,
      latestLogs: bagisGecmisi,
    });
  });

  // --- POST INTERACTIVE API 2: Askıya Kart Talebi Ekle (POST) ---
  app.post("/api/iztek/askidatalep", (req, res) => {
    const { talepNo } = req.body;
    const demandCount = Number(talepNo) || 1;

    askidaState.AskidaBekleyenKart += demandCount;

    res.json({
      success: true,
      updatedState: askidaState,
    });
  });

  // --- GET ROUTE: Donor Logs ---
  app.get("/api/iztek/bagisgecmisi", (req, res) => {
    res.json(bagisGecmisi);
  });

  // --- POST ROUTE: AI assistant (Gemini 3.5-flash model) ---
  app.post("/api/iztek/asistan", async (req, res) => {
    const { soru, gecmis } = req.body;
    const prompt = soru || "Merhaba";

    // Detailed context containing specifications from the PDF
    const pdfSpecificationsContext = `
Sen İzmir İnovasyon ve Teknoloji A.Ş. Yazılım Müdürlüğü Web Servisleri hakkında bilgi veren Akıllı Ulaşım Asistanısın.
Kullanıcıya nazik, minimalist ve yardımsever bir dille Türkçe yanıtlar ver. Yanıtlarında gereksiz teknik karmaşadan kaçın ve samimi ol.

Aşağıdaki bilgileri (PDF'ten alınmıştır) referans alarak kullanıcının sorularını yanıtla:

1. Genel Bilgiler:
   - Web servisler JSON objesi olarak dönüş yapar.
   - durakId: Durağın benzersiz numarasıdır. Örnek: 21050 (Alsancak Gar), 21056 (Konak İskele), 21852 (Bornova Metro), 21057 (Belediye Sarayı).
   - hatId: Hattın benzersiz numarasıdır (Örnek: 121 Mavişehir-Konak, 253 Halkapınar-Konak, 446 Alaybey-Bostanlı).
   - KoorX: Boylam bilgisi, KoorY: Enlem bilgisini ifade eder.

2. Web Servisleri Detayı:
   - 4.1 Askıda İzmirim Kart İstatistik Web Servisi:
     * Metot: GET
     * URL: https://openapi.izmir.bel.tr/api/iztek/askidaizmirimkart
     * Dönüş Verileri: 
       - AskidaBekleyenKart (int): Askıda bekleyen kart sayısı.
       - AskidanAlinanKart (int): Askıdan alınmış kart sayısı.
       - ToplamOdenenTutar (double): Askıdan alınmış kartlar için ödenen toplam tutar.
   - 4.2 Durağa Yaklaşan Otobüsler Web Servisi:
     * Metot: GET
     * URL: https://openapi.izmir.bel.tr/api/iztek/duragayaklasanotobusler/{durakId}
     * Örnek URL: https://openapi.izmir.bel.tr/api/iztek/duragayaklasanotobusler/21050
     * Dönüş: KalanDurakSayisi, HattinYonu, KoorY (Enlem), KoorX (Boylam), BisikletAparatliMi, EngelliMi, HatNumarasi, HatAdi, OtobusId.
   - 4.3 Hattın Durağa Yaklaşan Otobüsleri Web Servisi:
     * Metot: GET
     * URL: https://openapi.izmir.bel.tr/api/iztek/hattinyaklasanotobusleri/{hatId}/{durakId}
     * Örnek URL: https://openapi.izmir.bel.tr/api/iztek/hattinyaklasanotobusleri/446/21056
   - 4.4 Hatta Ait Otobüslerin Anlık Konum Bilgileri Web Servisi:
     * Metot: GET
     * URL: https://openapi.izmir.bel.tr/api/iztek/hatotobuskonumlari/{hatId}
     * Örnek URL: https://openapi.izmir.bel.tr/api/iztek/hatotobuskonumlari/446
     * Yanıt Formatı: HataMesaj (string) ve HatOtobusKonumlari dizisi (Yon, KoorX, KoorY, OtobusId).

3. Durum Kodları (HTTP Status Codes):
   - 200: Başarılı İşlem
   - 204: İçerik yok
   - 401: Kullanıcının bu metoda erişim yetkisi bulunmamaktadır
   - 404: Kaynak bulunamadı
   - 500: Sunucu hatası

Kullanıcının Sorusuna veya talebine göre kısa ve öz minimalist yanıt ver. Cevap formatında markdown kullanabilirsin ama çok karmaşık olmasın.
Eğer istekte bulunulursa simülasyon özelliklerini nasıl test edeceklerini de söyleyebilirsin.
Kullanıcı Sorusu: "${prompt}"
`;

    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" && process.env.GEMINI_API_KEY !== "") {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const contents = [];
        if (gecmis && Array.isArray(gecmis)) {
          gecmis.forEach((item: any) => {
            contents.push({
              role: item.role === "user" ? "user" : "model",
              parts: [{ text: item.text }],
            });
          });
        }
        contents.push({ role: "user", parts: [{ text: pdfSpecificationsContext }] });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: contents,
          config: {
            temperature: 0.7,
          },
        });

        if (response && response.text) {
          return res.json({ response: response.text });
        }
      } catch (err: any) {
        console.log(`[Info] Gemini API processed - fallback activated.`);
      }
    }

    // Smart Local Fallback to maintain wonderful experience without an active API Key
    let fallbackText = "";
    const cleanPrompt = prompt.toLowerCase();
    
    if (cleanPrompt.includes("askıda") || cleanPrompt.includes("istatistik") || cleanPrompt.includes("yardım") || cleanPrompt.includes("bağış")) {
      fallbackText = `İzmirim Askıda Kart projesi kapsamında, dar gelirli hemşehrilerimizin ulaşım ihtiyaçlarını karşılamak adına bağışlar toplanır. Bu servise \`https://openapi.izmir.bel.tr/api/iztek/askidaizmirimkart\` adresinden erişebilirsiniz.
Güncel durum:
- **Askıda Bekleyen Kart**: ${askidaState.AskidaBekleyenKart} adet
- **Askıdan Alınan Kart**: ${askidaState.AskidanAlinanKart} adet
- **Toplam Bağış Miktarı**: ${askidaState.ToplamOdenenTutar} TL

Arayüzümüzdeki "Bağış Yap" butonu ile askıdaki kart sayısını düşürüp bağış miktarını artırarak bu süreci dinamik olarak simüle edebilirsiniz!`;
    } else if (cleanPrompt.includes("durak") || cleanPrompt.includes("yaklaşan") || cleanPrompt.includes("durakid")) {
      fallbackText = `Durağa yaklaşan otobüsleri sorgulamak için \`https://openapi.izmir.bel.tr/api/iztek/duragayaklasanotobusler/{durakId}\` endpoint'ini kullanabilirsiniz.
Örneğin Alsancak Gar için durak numarası \`21050\`'dir. Enlem (\`KoorY\`) ve Boylam (\`KoorX\`) bilgileriyle beraber yaklaşan otobüslerin kalan durak sayısı listelenir.
Uygulamamızdaki **Durağa Yaklaşan Otobüsler** panelinden canlı sorgulama yapabilirsiniz.`;
    } else if (cleanPrompt.includes("hat") || cleanPrompt.includes("konum") || cleanPrompt.includes("otobüsler")) {
      fallbackText = `Belirli bir hatta ait tüm otobüslerin anlık konumlarını (\`https://openapi.izmir.bel.tr/api/iztek/hatotobuskonumlari/{hatId}\`) servisiyle çekebilirsiniz.
Cevap içinde enlem-boylam verileri, otobüs ID, ve yön bilgisi dönmektedir. Örnek olarak \`121 (Mavişehir - Konak)\` hattını seçip haritadaki live simülatörümüz üzerinde canlı konumları izleyebilirsiniz!`;
    } else if (cleanPrompt.includes("kod") || cleanPrompt.includes("durum") || cleanPrompt.includes("status")) {
      fallbackText = `İzmir Akıllı Ulaşım API Durum Kodları:
- **200 (Success)**: İşlem başarılı oldu ve veri sağlandı.
- **204 (No Content)**: İstek başarılı ancak içerik bulunamadı.
- **401 (Unauthorized)**: Erişim yetkiniz eksik veya hatalı token.
- **404 (Not Found)**: Belirtilen durak veya hat bulunamadı.
- **500 (Server Error)**: İzmir belediye sunucularında genel bir hata oluştu.`;
    } else {
      fallbackText = `Merhaba! Ben İzmir Akıllı Ulaşım Portal Asistanıyım. Sorduğun soruyu anladım.
Uygulamamız üzerinden şu ESHOT / İzmir Teknoloji servislerini test edebilir ve entegre edebilirsin:
1. **Askıda Kart İstatistikleri & Bağış Modülü** (4.1)
2. **Durağa Yaklaşan Otobüsler Listesi & Canlı Yaklaşım Görünümü** (4.2 & 4.3)
3. **Anlık Otobüs Hat Konum Simülatörü ve Haritası** (4.4)
4. **Durum Kodları ve API Örnek İstek & Yanıt Görüntüleyici** (4.5)

Sorularını yanıtlamaya hazırım. Hangi servis hakkında daha fazla detaya ihtiyacın var?`;
    }

    res.json({ response: fallbackText });
  });

  app.get("/api/duraklar", (req, res) => {
    const stops = loadStopsFromCSV();
    res.json(stops);
  });

  // Vite Integration for Serving UI
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Proxy Server] İzmir Akıllı Ulaşım Backend running on http://localhost:${PORT}`);
  });
}

startServer();
