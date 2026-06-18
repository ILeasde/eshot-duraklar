export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
}

// Durak verileri artık /api/duraklar endpoint'inden yükleniyor
// Bu şekilde CSV'deki tüm ~11.700+ durak gerçek verilerle eşleşiyor

export async function fetchAllStops(): Promise<Stop[]> {
  try {
    const res = await fetch("/api/duraklar");
    if (res.ok) {
      const data: Stop[] = await res.json();
      return data;
    }
  } catch (e) {
    console.error("[StopsData] Durak verileri yüklenemedi:", e);
  }
  return [];
}
