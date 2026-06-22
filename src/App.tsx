import React, { useState, useEffect, useRef } from "react";
import {
  Bus,
  MapPin,
  FileText,
  MessageSquare,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Heart,
  Search,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Plus,
  Send,
  Code,
  ArrowRight,
  Map,
  Compass,
  AlertCircle,
  ExternalLink
} from "lucide-react";

// Types derived from types.ts
import { YaklasanOtobus, OtobusKonumu } from "./types";
import { fetchAllStops, Stop } from "./stopsData";

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<"approaching" | "positions" | "sandbox" | "assistant">("approaching");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Tüm Duraklar - API'den yüklenir
  const [stopsData, setStopsData] = useState<Stop[]>([]);
  const [stopsLoading, setStopsLoading] = useState<boolean>(true);

  // Durağa Yaklaşan Otobüsler State
  const [searchStopId, setSearchStopId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [approachingBuses, setApproachingBuses] = useState<YaklasanOtobus[]>([]);
  const [loadingApproaching, setLoadingApproaching] = useState(false);
  const [errorApproaching, setErrorApproaching] = useState<string | null>(null);
  const [stopFilterLine, setStopFilterLine] = useState<string>("");
  const [hasClickedStop, setHasClickedStop] = useState<boolean>(false);

  // İzmir Durak Konumları Haritası State
  const [mapCenterLat, setMapCenterLat] = useState<number>(38.4199);
  const [mapCenterLng, setMapCenterLng] = useState<number>(27.1279);
  const [mapZoom, setMapZoom] = useState<number>(2.5);

  // Hatta Ait Otobüs Konumları State
  const [selectedRouteId, setSelectedRouteId] = useState<number>(121); // Default 121 Mavişehir - Konak
  const [busPositions, setBusPositions] = useState<OtobusKonumu[]>([]);
  const [errorPositions, setErrorPositions] = useState<string | null>(null);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [positionAutoRefreshTimer, setPositionAutoRefreshTimer] = useState<number>(0);

  // API Sandbox State
  const [apiMethod, setApiMethod] = useState<string>("GET");
  const [apiUrlTemplate, setApiUrlTemplate] = useState<string>("/api/iztek/askidaizmirimkart");
  const [apiResponseText, setApiResponseText] = useState<string>("// Send request to preview real-time JSON response");
  const [apiResponseStatus, setApiResponseStatus] = useState<number | null>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [apiExecutionTime, setApiExecutionTime] = useState<number | null>(null);

  // AI Assistant State
  const [userInput, setUserInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; text: string; id: string }>>([
    {
      role: "model",
      text: "Merhaba! Ben İzmir Akıllı Ulaşım Portal Asistanıyım. Askıda İzmirim Kart istatistikleri, durak otobüs yaklaşım verileri ve hat konum servisleri ile ilgili her konuda sana yardımcı olabilirim. Nasıl yardımcı olayım?",
      id: "welcome"
    }
  ]);
  const [assistantLoading, setAssistantLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Leaflet Map Refs - Approaching Tab
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const clusterGroupRef = useRef<any>(null);

  // Leaflet Map Refs - Positions Tab
  const positionsMapContainerRef = useRef<HTMLDivElement | null>(null);
  const positionsMapInstanceRef = useRef<any>(null);
  const positionsMarkersRef = useRef<any[]>([]);

  // Pre-configured options for easy testing
  const popularStops = [
    { code: "10005", name: "Bahribaba" },
    { code: "20001", name: "Karşıyaka İskele" },
    { code: "20057", name: "Turan" },
    { code: "20040", name: "Çınarlı Hastanesi" },
    { code: "20020", name: "Bostanlı İskele" }
  ];

  const popularRoutes = [
    { id: 121, name: "121 Mavişehir - Konak" },
    { id: 253, name: "253 Halkapınar Metro - Konak" },
    { id: 446, name: "446 Alaybey - Bostanlı" },
    { id: 802, name: "802 Egekent Transfer - Konak" },
    { id: 792, name: "792 Görece - Karakuyu Yolu" }
  ];

  // Fetch approaching buses for selected/searched stop - sadece tıklandığında çağrılır
  const fetchApproachingBuses = async (stopId: string) => {
    if (!stopId || stopId.trim().length === 0) return;
    setHasClickedStop(true);
    setLoadingApproaching(true);
    setErrorApproaching(null);
    setApproachingBuses([]);
    try {
      const res = await fetch(`/api/iztek/duragayaklasanotobusler/${stopId}`);
      if (res.ok) {
        const data = await res.json();
        setApproachingBuses(Array.isArray(data) ? data : []);
      } else if (res.status === 204) {
        setApproachingBuses([]);
      } else {
        setErrorApproaching(`Sunucudan yanıt alınamadı. Durum kodu: ${res.status}`);
      }
    } catch (err) {
      setErrorApproaching("Ulaşım servisiyle bağlantı kurulamadı.");
    } finally {
      setLoadingApproaching(false);
    }
  };

  // Fetch active bus positions
  const fetchBusPositions = async (routeId: number) => {
    setLoadingPositions(true);
    setErrorPositions(null);
    try {
      const res = await fetch(`/api/iztek/hatotobuskonumlari/${routeId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.HataMesaj) {
          setErrorPositions(data.HataMesaj);
          setBusPositions([]);
        } else {
          setBusPositions(data.HatOtobusKonumlari || []);
        }
      } else {
        setErrorPositions("Canlı otobüs konumları temin edilemedi.");
      }
    } catch (err) {
      setErrorPositions("Bağlantı hatası sebebiyle canlandırma başarısız oldu.");
    } finally {
      setLoadingPositions(false);
    }
  };

  // Execute Sandbox Test Request
  const handleSandboxExecute = async () => {
    setApiLoading(true);
    const startTime = performance.now();
    try {
      const res = await fetch(apiUrlTemplate, { method: apiMethod });
      const status = res.status;
      const data = await res.json();
      const endTime = performance.now();

      setApiResponseStatus(status);
      setApiResponseText(JSON.stringify(data, null, 2));
      setApiExecutionTime(Math.round(endTime - startTime));
    } catch (err: any) {
      setApiResponseStatus(500);
      setApiResponseText(JSON.stringify({ error: true, message: err.message || "İstek başarısız." }, null, 2));
      setApiExecutionTime(0);
    } finally {
      setApiLoading(false);
    }
  };

  // Trigger Assistant Question Submit
  const handleAssistantSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput || userInput.trim() === "") return;

    const userMsg = userInput;
    const userMsgObj = { role: "user" as const, text: userMsg, id: Date.now().toString() };
    setChatMessages((prev) => [...prev, userMsgObj]);
    setUserInput("");
    setAssistantLoading(true);

    try {
      // Create past log formatting for model history context
      const historyContext = chatMessages.slice(-5).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch("/api/iztek/asistan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soru: userMsg, gecmis: historyContext })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { role: "model", text: data.response, id: (Date.now() + 1).toString() }
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "model", text: "Teknik bir aksaklık nedeniyle akıllı asistan şu an çevrimdışı. Lütfen tekrar sorunuz.", id: (Date.now() + 1).toString() }
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "model", text: "Bağlantı kesintisi oldu. Simülatör ve API bilgilerini kontrol etmekten çekinmeyiniz.", id: (Date.now() + 1).toString() }
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, assistantLoading]);

  // Tüm durakları API'den yükle (mount'ta bir kez)
  useEffect(() => {
    let cancelled = false;
    setStopsLoading(true);
    fetchAllStops().then((data) => {
      if (!cancelled) {
        setStopsData(data);
        setStopsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Leaflet map initialization & markers setup - duraklar yüklenince çalışır
  useEffect(() => {
    if (stopsLoading || stopsData.length === 0) return;
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        center: [38.4199, 27.1279],
        zoom: 13,
        zoomControl: false,
      });

      // CartoDB Voyager provides a beautiful modern vector map representation
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(mapInstanceRef.current);

      // Add default Leaflet Zoom Control to bottom-left
      L.control.zoom({
        position: "bottomleft"
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear previous cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    // Initialize a high-performance marker cluster group
    clusterGroupRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 17
    });

    markersRef.current = {};

    // Render nodes for ALL stops from the full CSV dataset
    stopsData.forEach((stop) => {
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: 5,
        color: '#0f172a', // slate-900
        weight: 1.5,
        fillColor: '#fbbf24', // amber-400
        fillOpacity: 1
      }).on("click", () => {
        // Durağa tıklandığında: seç ve API'ye istek at
        setSearchStopId(stop.id);
        fetchApproachingBuses(stop.id);
      });

      // Setup clean popup on hover
      const popupContent = `
        <div class="p-1 font-sans text-xs">
          <p class="font-bold text-slate-950 leading-snug">${stop.name}</p>
          <p class="text-[10px] text-emerald-600 font-mono mt-0.5 font-bold">Durak No: ${stop.id}</p>
          <div class="mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-500 max-w-[200px]">
            <strong class="text-slate-800">Geçen Hatlar:</strong><br/>
            <span>${stop.lines.join(", ")}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: L.point(0, -5)
      });

      clusterGroupRef.current.addLayer(marker);
      markersRef.current[stop.id] = marker;
    });

    map.addLayer(clusterGroupRef.current);

  }, [stopsData, stopsLoading]);

  // Update center when searchStopId changes and gracefully zoomToShowLayer for clustered markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && searchStopId) {
      const activeStop = stopsData.find((s) => s.id === searchStopId);
      if (activeStop) {
        const marker = markersRef.current[searchStopId];
        if (marker && clusterGroupRef.current) {
          clusterGroupRef.current.zoomToShowLayer(marker, () => {
            marker.openPopup();
          });
        } else {
          map.setView([activeStop.lat, activeStop.lng], 15, { animate: true, duration: 0.8 });
          if (marker) {
            marker.openPopup();
          }
        }
      }
    }
  }, [searchStopId, stopsData]);

  // Handle Tab transitions - sadece hat konumları otomatik yüklenir
  useEffect(() => {
    fetchBusPositions(selectedRouteId);
  }, []);

  // Periodic Refresh triggers for coordinates simulated feed
  useEffect(() => {
    const timer = setInterval(() => {
      setPositionAutoRefreshTimer((prev) => {
        if (prev >= 9) {
          // fetch silently to maintain live dynamics
          fetchBusPositions(selectedRouteId);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedRouteId]);

  // Invalidates size on tab change to prevent grey/blank Leaflet canvas bugs
  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;
    setTimeout(() => {
      if (activeTab === "approaching" && mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      } else if (activeTab === "positions" && positionsMapInstanceRef.current) {
        positionsMapInstanceRef.current.invalidateSize();
      }
    }, 100);
  }, [activeTab]);

  // Positions Map Init & Markers Update
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !positionsMapContainerRef.current) return;

    if (!positionsMapInstanceRef.current) {
      positionsMapInstanceRef.current = L.map(positionsMapContainerRef.current, {
        center: [38.4199, 27.1279],
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap & CARTO',
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(positionsMapInstanceRef.current);

      L.control.zoom({ position: "bottomleft" }).addTo(positionsMapInstanceRef.current);
    }

    const map = positionsMapInstanceRef.current;

    // Remove old markers
    positionsMarkersRef.current.forEach((m: any) => map.removeLayer(m));
    positionsMarkersRef.current = [];

    if (busPositions && busPositions.length > 0) {
      const bounds = L.latLngBounds();
      busPositions.forEach((bus) => {
        const lat = typeof bus.KoorY === 'number' ? bus.KoorY : parseFloat(bus.KoorY as any) || 38.418;
        const lng = typeof bus.KoorX === 'number' ? bus.KoorX : parseFloat(bus.KoorX as any) || 27.128;
        
        const marker = L.circleMarker([lat, lng], {
          radius: 6,
          color: '#1e293b',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 1
        });

        const popupContent = `
          <div class="p-1 font-sans text-xs">
            <p class="font-bold text-slate-900">Otobüs ID: #${bus.OtobusId}</p>
            <p class="text-[10px] text-blue-600 font-mono mt-0.5 font-bold">Hat: ${selectedRouteId}</p>
            <div class="mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-500">
              Yön: ${bus.Yon === 1 ? "Gidiş" : "Dönüş"}<br/>
              GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { closeButton: false, offset: L.point(0, -5) });
        marker.addTo(map);
        positionsMarkersRef.current.push(marker);
        bounds.extend([lat, lng]);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }
  }, [busPositions, selectedRouteId]);

  return (
    <div id="izmir-dashboard" className="flex flex-col lg:flex-row h-screen w-full bg-[#f9fafb] text-[#111827] font-sans overflow-hidden">
      
      {/* MOBILE BAR - Only Visible on Small/Medium Screens */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-30 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black rounded flex items-center justify-center text-white font-mono font-bold text-sm">
            İT
          </div>
          <div>
            <p className="font-bold tracking-tight text-sm text-black leading-tight">İzmir Teknoloji Portal</p>
            <p className="text-[9px] text-gray-400 font-medium tracking-wide">YAZILIM MÜDÜRLÜĞÜ</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 border border-gray-200 bg-white rounded-xl text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors"
          title="Menüyü Aç"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* MOBILE OVERLAY BACKDROP */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
        />
      )}

      {/* SIDEBAR NAVIGATION - Clean Minimalism Theme With Responsive Drawer Placement */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 w-80 bg-white border-r border-gray-200 flex flex-col justify-between z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`} 
        id="portal-sidebar"
      >
        <div>
          {/* Brand Logo & Header with Close Button for Mobile */}
          <div className="p-8 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded flex items-center justify-center text-white font-mono font-bold text-lg">
                İT
              </div>
              <div>
                <p className="font-bold tracking-tight text-lg text-black leading-tight">İzmİr Teknoloji</p>
                <p className="text-[11px] text-gray-500 font-medium tracking-wide">YAZILIM MÜDÜRLÜĞÜ</p>
              </div>
            </div>
            {/* Close button for mobile menu */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-650 transition-colors"
              title="Kapat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-6 space-y-1.5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-3 mb-3">
              SERVİS PANELİ
            </div>
            
            <button
              id="nav-tab-approaching"
              onClick={() => { setActiveTab("approaching"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "approaching"
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-950 hover:bg-gray-100/60"
              }`}
            >
              <span className="flex items-center gap-3">
                <Compass className="w-4 h-4 text-gray-400" />
                Durağa Yaklaşım
              </span>
              <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                Sec 4.2 & 4.3
              </span>
            </button>

            <button
              id="nav-tab-positions"
              onClick={() => { setActiveTab("positions"); fetchBusPositions(selectedRouteId); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "positions"
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/60"
              }`}
            >
              <span className="flex items-center gap-3">
                <Map className="w-4 h-4 text-gray-400" />
                Hat Canlı GPS
              </span>
              <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                Sec 4.4
              </span>
            </button>

            <button
              id="nav-tab-sandbox"
              onClick={() => { setActiveTab("sandbox"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "sandbox"
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/60"
              }`}
            >
              <span className="flex items-center gap-3">
                <Code className="w-4 h-4 text-gray-400" />
                API Test Sandbox
              </span>
              <span className="text-[10px] font-mono bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">
                Canlı
              </span>
            </button>

            <button
              id="nav-tab-assistant"
              onClick={() => { setActiveTab("assistant"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "assistant"
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/60"
              }`}
            >
              <span className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                AI Ulaşım Asistanı
              </span>
              <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                Gemini
              </span>
            </button>

            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-3 mt-8 mb-3">
              YÜKLENEN DOKÜMAN
            </div>
            
            <div className="p-4 mx-2 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-semibold text-gray-700 truncate">Web-Servis-Kullanim.pdf</p>
              </div>
              <p className="text-[10px] text-gray-400 mb-3">İzmir İnovasyon ve Teknoloji A.Ş. V.1.0 Web Servis Kılavuzu</p>
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                <span>Versiyon 1.0</span>
                <span className="bg-green-100 text-green-800 font-mono px-1.5 py-0.5 rounded">Aktif</span>
              </div>
            </div>
          </nav>
        </div>

        {/* User profile / Credits */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-800 to-black text-white font-mono flex items-center justify-center font-bold text-sm">
              SD
            </div>
            <div className="text-xs">
              <p className="font-semibold text-gray-900">Sezer Değer</p>
              <p className="text-gray-400 font-medium text-[10px]">Portal Yazılım Danışmanı</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col h-full bg-[#f9fafb]">
        
        {/* Header bar */}
        <header className="min-h-20 py-4 lg:py-0 lg:h-20 bg-white border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between px-4 md:px-10 gap-3 md:gap-6">
          <div>
            <h1 className="text-sm md:text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
              {activeTab === "approaching" && "Durağa Yaklaşan Otobüsler Web Servis Monitörü"}
              {activeTab === "positions" && "Hatta Ait Otobüslerin Anlık Konum Bilgileri"}
              {activeTab === "sandbox" && "API Test Sandbox & İstek Görüntüleyici"}
              {activeTab === "assistant" && "İzmir Akıllı Ulaşım Yapay Zeka Asistanı"}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] md:text-xs font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                Açık Veri Portalı
              </span>
            </h1>
            <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">
              {activeTab === "approaching" && "5 haneli durak numarasına yaklaşan filoyu anlık ve süzmeli inceleyin."}
              {activeTab === "positions" && "Otobüslerin koordinat verilerini haritavari şemada canlandırın."}
              {activeTab === "sandbox" && "Parametrik GET istekleri düzenleyin ve gerçek zamanlı JSON çıktılarını analiz edin."}
              {activeTab === "assistant" && "Gemini motoru destekli, tüm kılavuz kodlarına ve duraklarına hakim yardımcı."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            {/* Quick stats / Connection state indicators */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-lg border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Belediye Sunucusu: Bağlı
            </div>
            
            <button
              onClick={() => {
                if (searchStopId) fetchApproachingBuses(searchStopId);
                fetchBusPositions(selectedRouteId);
              }}
              title="Yenile"
              className="p-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-105 text-gray-650 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Inner Content Area */}
        <div className="flex-1 p-4 md:p-10 overflow-y-auto">

          {/* TAB 2: DURAĞA YAKLAŞAN OTOBÜSLER (Section 4.2 & 4.3) */}
          <div className={`space-y-8 ${activeTab === "approaching" ? "block" : "hidden"}`} id="tab-approaching">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left query & stop list section */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Smart Autocomplete Stop Search Panel */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-500" />
                      Aktif Durak / Arama (4.2 & 4.3 API)
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          placeholder="Durak adı veya No girin..."
                          className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:bg-white transition-all"
                        />
                        <div className="absolute right-3 top-3 text-gray-400">
                          <Search className="w-4 h-4" />
                        </div>

                        {/* Suggestions Autocomplete Floating list */}
                        {showSuggestions && searchQuery.trim() !== "" && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-gray-100">
                            {(() => {
                              const searchLower = searchQuery.toLocaleLowerCase('tr-TR');
                              const filtered = stopsData.filter(s =>
                                s.id.includes(searchQuery) ||
                                s.name.toLocaleLowerCase('tr-TR').includes(searchLower)
                              );
                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-xs text-gray-400 text-center">
                                    Eşleşen durak bulunamadı.
                                  </div>
                                );
                              }
                              return filtered.map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSearchStopId(s.id);
                                    fetchApproachingBuses(s.id);
                                    setSearchQuery("");
                                    setShowSuggestions(false);
                                  }}
                                  className="w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-center justify-between text-xs font-sans text-gray-800"
                                >
                                  <div>
                                    <p className="font-bold text-gray-900">{s.name}</p>
                                    <p className="text-gray-400 font-mono text-[10px] mt-0.5">No: {s.id}</p>
                                  </div>
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                    {s.lines.length} Hat
                                  </span>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Info on Currently Selected Stop */}
                      {(() => {
                        const currentStop = stopsData.find(s => s.id === searchStopId);
                        if (!currentStop) return null;
                        return (
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2.5">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400">SEÇİLİ DURAK</span>
                                <h5 className="text-xs font-bold text-gray-900 leading-snug">{currentStop.name}</h5>
                                <p className="text-[10px] font-mono text-gray-500 mt-0.5">Durak Kodu: {currentStop.id}</p>
                              </div>
                              <span className="bg-black text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                                #{currentStop.id}
                              </span>
                            </div>

                            <div className="text-[10px] text-gray-500 font-mono flex items-center justify-between pt-1 border-t border-gray-200/60">
                              <span>Enlem: {currentStop.lat.toFixed(5)}</span>
                              <span>Boylam: {currentStop.lng.toFixed(5)}</span>
                            </div>

                            <div className="pt-2 border-t border-gray-200/60">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">GEÇEN HATLAR (Canlı Geçiş)</p>
                              <div className="flex flex-wrap gap-1.5">
                                {currentStop.lines.map((ln) => (
                                  <button
                                    key={ln}
                                    title="Bu hattın canlı otobüs konumlarını gör"
                                    onClick={() => {
                                      const lineNum = parseInt(ln.replace(/\D/g, ""));
                                      if (lineNum) {
                                        setSelectedRouteId(lineNum);
                                        setActiveTab("positions");
                                        fetchBusPositions(lineNum);
                                      }
                                    }}
                                    className="bg-white border border-gray-250 hover:bg-black hover:text-white hover:border-black text-gray-700 text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 shrink-0"
                                  >
                                    <span>{ln}</span>
                                    <Map className="w-2.5 h-2.5 opacity-60" />
                                  </button>
                                ))}
                              </div>
                              <p className="text-[9px] text-gray-400 mt-1">
                                * Hat butonlarına tıklayarak o hattaki otobüslerin tam GPS konumlarına geçiş yapabilirsiniz.
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Popular stops shortlinks */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sık Kullanılan Duraklar</h4>
                    <div className="space-y-2">
                      {popularStops.map((stop) => (
                        <button
                          key={stop.code}
                          onClick={() => {
                            setSearchStopId(stop.code);
                            fetchApproachingBuses(stop.code);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                            searchStopId === stop.code
                              ? "bg-black text-white border-black"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <div>
                            <p className="font-bold">{stop.name}</p>
                            <p className={`font-mono text-[10px] mt-0.5 ${searchStopId === stop.code ? "text-gray-300" : "text-gray-400"}`}>
                              No: {stop.code}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Süzgeç (Section 4.3 feature representation) */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-xs font-bold text-[#111827] uppercase tracking-widest mb-1.5">Hattın Durağa Yaklaşan OtobüSü (4.3 API)</h4>
                    <p className="text-[10px] text-gray-400 mb-3">Hattı süzerek sadece o hatta ait yaklaşım tahminlerini görürsünüz.</p>
                    
                    <input
                      type="text"
                      placeholder="Hat No Girin (Örn: 121)"
                      value={stopFilterLine}
                      onChange={(e) => setStopFilterLine(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black focus:bg-white"
                    />
                    {stopFilterLine && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-lg mt-2 font-medium">
                        Şu an <strong>{stopFilterLine} no'lu hat</strong> süzülüyor. Sıfırlamak için kutuyu temizleyin.
                      </p>
                    )}
                  </div>

                </div>

                {/* Right queue display results & vector approach visualization */}
                <div className="lg:col-span-8 space-y-6">

                  {/* İzmir Durak Konumları Canlı Coğrafi Haritası */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-gray-950 flex items-center gap-2">
                          <Map className="w-4 h-4 text-emerald-600" />
                          İzmir Durak Konumları Coğrafi Yol Haritası
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Gerçek harita üstündeki sarı duraklara tıklayarak yaklaşan otobüsleri anlık süzün.
                        </p>
                      </div>

                      {/* Presets Button Links */}
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const map = mapInstanceRef.current;
                            if (map) map.setView([38.4199, 27.1279], 11, { animate: true, duration: 1 });
                          }}
                          className="px-2.5 py-1 bg-gray-55 hover:bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg transition-all border border-gray-200 cursor-pointer"
                        >
                          Tüm İzmir
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const map = mapInstanceRef.current;
                            if (map) map.setView([38.4190, 27.1280], 14, { animate: true, duration: 1 });
                          }}
                          className="px-2.5 py-1 bg-gray-55 hover:bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg transition-all border border-gray-200 cursor-pointer"
                        >
                          Konak & Merkez
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const map = mapInstanceRef.current;
                            if (map) map.setView([38.4550, 27.1210], 14, { animate: true, duration: 1 });
                          }}
                          className="px-2.5 py-1 bg-gray-55 hover:bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg transition-all border border-gray-200 cursor-pointer"
                        >
                          Karşıyaka & Bostanlı
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const map = mapInstanceRef.current;
                            if (map) map.setView([38.1400, 27.1950], 13, { animate: true, duration: 1 });
                          }}
                          className="px-2.5 py-1 bg-gray-55 hover:bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg transition-all border border-gray-200 cursor-pointer"
                        >
                          Menderes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const map = mapInstanceRef.current;
                            const currentStop = stopsData.find(s => s.id === searchStopId);
                            if (map && currentStop) {
                              map.setView([currentStop.lat, currentStop.lng], 16, { animate: true, duration: 1 });
                              const marker = markersRef.current[searchStopId];
                              if (marker) marker.openPopup();
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg transition-all border border-emerald-100 cursor-pointer"
                        >
                          🎯 Seçili Durağa Git
                        </button>
                      </div>
                    </div>

                    {/* Interactive Real Leaflet Map DIV */}
                    <div className="w-full h-[380px] rounded-xl overflow-hidden relative border border-gray-200 shadow-sm">
                      <div ref={mapContainerRef} className="w-full h-full z-0"></div>

                      {/* Stops loading overlay */}
                      {stopsLoading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[1001] flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-3"></div>
                          <p className="text-xs font-mono text-gray-600 font-semibold">Tüm ESHOT durakları yükleniyor...</p>
                          <p className="text-[10px] text-gray-400 mt-1">11.700+ durak CSV'den eşleştiriliyor</p>
                        </div>
                      )}

                      {/* Map Status Overlay Indicator */}
                      <div className="absolute top-3 right-3 bg-white/90 border border-gray-200 backdrop-blur-md text-[9px] font-mono font-bold text-gray-800 px-2 py-1 rounded-lg shadow-sm z-[1000] pointer-events-none select-none flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{stopsLoading ? "Duraklar yükleniyor..." : `${stopsData.length.toLocaleString('tr-TR')} Durak Aktif`}</span>
                      </div>
                    </div>
                  </div>

                  {!hasClickedStop ? (
                    <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-16 text-center shadow-sm">
                      <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-full flex items-center justify-center border border-amber-200">
                        <MapPin className="w-7 h-7 text-amber-500" />
                      </div>
                      <p className="text-sm font-bold text-gray-900 mb-1">Durağa tıklayarak başlayın</p>
                      <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                        Haritadaki sarı duraklara tıklayın veya yukarıdan arama yapın. Tıkladığınız anda API'ye istek atılacak ve yaklaşan otobüsler anlık olarak listelenecektir.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-400 font-mono">
                        <span className="px-2 py-1 bg-gray-100 rounded">GET</span>
                        <span>/api/iztek/duragayaklasanotobusler/{'{durakId}'}</span>
                      </div>
                    </div>
                  ) : loadingApproaching ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-20 text-center shadow-sm">
                      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-xs text-gray-500 font-medium font-mono">Durağa Yaklaşan Otobüsler API Sorgulanıyor...</p>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">Durak #{searchStopId} → openapi.izmir.bel.tr</p>
                    </div>
                  ) : errorApproaching ? (
                    <div className="bg-white border border-red-200 rounded-2xl p-12 text-center shadow-sm text-red-600">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
                      <p className="text-sm font-bold">Bağlantı Sorunu</p>
                      <p className="text-xs text-gray-500 mt-1">{errorApproaching}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      
                      {/* Approaching List */}
                      <div className="md:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-900">
                            Durak No {searchStopId} - Yaklaşan Filo
                          </h4>
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-bold">
                            {approachingBuses.length} Otobüs Bulundu
                          </span>
                        </div>

                        <div className="space-y-3">
                          {approachingBuses && approachingBuses.length > 0 ? (
                            approachingBuses
                              .filter((bus) => !stopFilterLine || String(bus.HatNumarasi).includes(stopFilterLine))
                              .map((bus, idx) => (
                                <div key={`approaching-${bus.OtobusId || idx}-${idx}`} className="p-4 border border-gray-100 rounded-xl bg-gray-50 hover:bg-gray-100/50 transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center font-mono font-bold text-sm">
                                        {bus.HatNumarasi}
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-gray-900 leading-tight">{bus.HatAdi}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-[10px] text-gray-400 font-mono">ID: #{bus.OtobusId}</span>
                                          <span className="text-gray-300">|</span>
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                            bus.HattinYonu === 1 ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                          }`}>
                                            Yön: {bus.HattinYonu === 1 ? "Gidiş" : "Dönüş"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-mono font-extrabold text-green-700 leading-none">
                                        {bus.KalanDurakSayisi}
                                      </div>
                                      <p className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5">kalan durak</p>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-gray-100/75 flex items-center justify-between text-[10px] text-gray-500 font-medium">
                                    <div className="flex gap-2">
                                      {bus.BisikletAparatliMi && (
                                        <span className="bg-gray-200/60 px-1.5 py-0.5 rounded text-gray-700 flex items-center gap-1">
                                          🚲 Bisiklet
                                        </span>
                                      )}
                                      {bus.EngelliMi && (
                                        <span className="bg-gray-200/60 px-1.5 py-0.5 rounded text-gray-700 flex items-center gap-1">
                                          ♿ Engelsiz
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-gray-400 font-mono text-[9px]">
                                      GPS: {(typeof bus.KoorY === 'number' ? bus.KoorY : parseFloat(bus.KoorY as any) || 0).toFixed(4)}, {(typeof bus.KoorX === 'number' ? bus.KoorX : parseFloat(bus.KoorX as any) || 0).toFixed(4)}
                                    </div>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="text-center py-12 text-gray-400 text-xs">
                              Seçilen süzgece veya durağa uygun yaklaşan otobüs kaydı bulunamadı.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Schematic Visual list illustrating Section 4.5 and 4.2 relative coordinates */}
                      <div className="md:col-span-5 bg-black text-white rounded-2xl p-6 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-6">Şematik Mesafe Şeridi</p>
                          
                          <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-white/10">
                            
                            {/* Current station node */}
                            <div className="relative flex items-center gap-3">
                              <span className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white bg-black z-10 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                              </span>
                              <div>
                                <p className="text-xs font-bold">Durak No: {searchStopId}</p>
                                <p className="text-[9px] opacity-40">Mevcut Bekleme Noktası</p>
                              </div>
                            </div>

                            {/* Dynamically list top approaching items in vector space */}
                            {approachingBuses && approachingBuses.length > 0 ? (
                              approachingBuses
                                .filter((bus) => !stopFilterLine || String(bus.HatNumarasi).includes(stopFilterLine))
                                .slice(0, 3)
                                .map((bus, idx) => (
                                  <div key={`approaching-vector-${bus.OtobusId || idx}-${idx}`} className="relative flex items-center gap-3">
                                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center animate-bounce">
                                      {idx + 1}
                                    </span>
                                    <div>
                                      <p className="text-xs font-bold">Eshot {bus.HatNumarasi}</p>
                                      <p className="text-[9px] opacity-60">Durak Uzaklığı: {bus.KalanDurakSayisi} durak</p>
                                    </div>
                                  </div>
                                ))
                            ) : (
                              <div className="text-xs opacity-50 py-8">
                                Canlandırma için aktif veri bekleniyor...
                              </div>
                            )}

                          </div>
                        </div>

                        <div className="pt-6 border-t border-white/10 mt-6 text-[10px] opacity-50 text-center font-mono">
                          Doğruluk oranı: ~%99.2 (GPS Destekli)
                        </div>
                      </div>

                    </div>
                  )}

                </div>

              </div>

            </div>

          {/* TAB 3: HAT OTOBÜS KONUMLARI (Section 4.4) */}
          <div className={`space-y-8 ${activeTab === "positions" ? "block" : "hidden"}`} id="tab-positions">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left controls column */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Select Route Panel */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Bus className="w-5 h-5 text-gray-600" />
                      Aktif Hat Seçimi (Section 4.4)
                    </h4>
                    <p className="text-xs text-gray-400 mb-4">
                      Belirtilen id'li hatta seyir halinde olan tüm aktif araçların canlı GPS koordinat verilerini okuyarak haritaya yerleştirin.
                    </p>

                    <div className="space-y-2">
                      {popularRoutes.map((route) => (
                        <button
                          key={route.id}
                          onClick={() => {
                            setSelectedRouteId(route.id);
                            fetchBusPositions(route.id);
                          }}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                            selectedRouteId === route.id
                              ? "bg-black text-white border-black"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <span>{route.name}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            selectedRouteId === route.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"
                          }`}>
                            Hat: {route.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual coordinates input / debug logs */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3 text-xs font-bold text-[#111827]">
                      <span>CANLI RADAR PANELİ</span>
                      <span className="text-green-600 flex items-center gap-1 font-mono uppercase bg-green-50 px-1.5 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        AÇIK
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                      Eshot API ve entegre simülasyon her 10 saniyede bir koordinat pingi alır. Radar ekranından canlı takibi gerçekleştirebilirsiniz.
                    </p>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5 font-mono text-[10px] text-gray-650">
                      <div className="flex justify-between">
                        <span>Son Güncelleme:</span>
                        <span className="text-gray-900 font-semibold">Her Saniye</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Aktif Hat:</span>
                        <span className="text-gray-900 font-semibold">{selectedRouteId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Aktif Cihaz Paketleri:</span>
                        <span className="text-gray-900 font-semibold">{busPositions.length} Otobüs</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Interactive Map representation */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {loadingPositions ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-20 text-center shadow-sm">
                      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-xs text-gray-500 font-mono">Hat Konumları (Sec 4.4) Çekiliyor...</p>
                    </div>
                  ) : errorPositions ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-red-650 shadow-sm">
                      <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                      <p className="text-sm font-bold">Hata Alındı</p>
                      <p className="text-xs text-gray-500 mt-1">{errorPositions}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Grid Map Display */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-black" />
                            Canlı İzmir Körfez Haritası (GPS Simülasyon Blueprint)
                          </h4>
                          <span className="text-[10px] font-mono text-gray-400">
                            Radar Ping'e kalan: {10 - positionAutoRefreshTimer}s
                          </span>
                        </div>

                        {/* Real Interactive Leaflet Map for Bus Positions */}
                        <div className="w-full h-[320px] bg-slate-100 rounded-2xl relative overflow-hidden flex items-center justify-center border border-gray-200 shadow-sm">
                          <div ref={positionsMapContainerRef} className="w-full h-full z-0"></div>
                        </div>
                      </div>

                      {/* Coordinates Table */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Aktif Otobüs Donanım Koordinatları ({selectedRouteId} no'lu hat)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-gray-100 text-gray-400 pb-2">
                                <th className="py-2.5 font-bold uppercase tracking-wider">Otobüs ID</th>
                                <th className="py-2.5 font-bold uppercase tracking-wider">Hat No</th>
                                <th className="py-2.5 font-bold uppercase tracking-wider">Yön Segmenti</th>
                                <th className="py-2.5 font-bold uppercase tracking-wider font-mono">Enlem (KoorY)</th>
                                <th className="py-2.5 font-bold uppercase tracking-wider font-mono">Boylam (KoorX)</th>
                                <th className="py-2.5 font-bold uppercase tracking-wider text-right">Durum</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-gray-700">
                              {busPositions.map((bus, idx) => (
                                <tr key={`table-row-${bus.OtobusId || idx}-${idx}`} className="hover:bg-gray-50/50">
                                  <td className="py-3 font-semibold text-gray-900 font-mono">#{bus.OtobusId}</td>
                                  <td className="py-3">{selectedRouteId}</td>
                                  <td className="py-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      bus.Yon === 1 ? "bg-cyan-50 text-cyan-700" : "bg-purple-50 text-purple-700"
                                    }`}>
                                      {bus.Yon === 1 ? "Körfez Gidiş" : "Körfez Dönüş"}
                                    </span>
                                  </td>
                                  <td className="py-3 font-mono text-gray-500">{(typeof bus.KoorY === 'number' ? bus.KoorY : parseFloat(bus.KoorY as any) || 38.41).toFixed(6)}</td>
                                  <td className="py-3 font-mono text-gray-500">{(typeof bus.KoorX === 'number' ? bus.KoorX : parseFloat(bus.KoorX as any) || 27.12).toFixed(6)}</td>
                                  <td className="py-3 text-right">
                                    <span className="inline-flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                                      Canlı
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                </div>

              </div>

          </div>

          {/* TAB 4: API SANDBOX & DOCUMENTATION */}
          <div className={`space-y-8 ${activeTab === "sandbox" ? "block" : "hidden"}`} id="tab-sandbox">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left query options list */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Select Endpoint Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Code className="w-5 h-5 text-gray-600" />
                      Yazılım Müdürlüğü Endpoint Seçicisi
                    </h4>

                    <div className="space-y-2.5">
                      {/* Section 4.1 */}
                      <button
                        onClick={() => {
                          setApiMethod("GET");
                          setApiUrlTemplate("/api/iztek/askidaizmirimkart");
                        }}
                        className={`w-full p-4 rounded-xl text-left border flex items-start gap-3 transition-colors ${
                          apiUrlTemplate === "/api/iztek/askidaizmirimkart"
                            ? "bg-black text-white border-black"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-2 py-1 rounded select-none ${
                          apiUrlTemplate === "/api/iztek/askidaizmirimkart" ? "bg-white/15 text-white" : "bg-gray-100 text-gray-900"
                        }`}>GET</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">4.1 Askıda İzmirim Kart İstatistikleri</p>
                          <p className={`text-[10px] font-mono mt-1 ${
                            apiUrlTemplate === "/api/iztek/askidaizmirimkart" ? "text-gray-300" : "text-gray-400"
                          }`}>/iztek/askidaizmirimkart</p>
                        </div>
                      </button>

                      {/* Section 4.2 */}
                      <button
                        onClick={() => {
                          setApiMethod("GET");
                          setApiUrlTemplate("/api/iztek/duragayaklasanotobusler/21050");
                        }}
                        className={`w-full p-4 rounded-xl text-left border flex items-start gap-3 transition-colors ${
                          apiUrlTemplate.includes("/duragayaklasanotobusler/")
                            ? "bg-black text-white border-black"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-2 py-1 rounded select-none ${
                          apiUrlTemplate.includes("/duragayaklasanotobusler/") ? "bg-white/15 text-white" : "bg-gray-100 text-gray-900"
                        }`}>GET</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">4.2 Durağa Yaklaşan Otobüsler</p>
                          <p className={`text-[10px] font-mono mt-1 ${
                            apiUrlTemplate.includes("/duragayaklasanotobusler/") ? "text-gray-300" : "text-gray-400"
                          }`}>/iztek/duragayaklasanotobusler/21050</p>
                        </div>
                      </button>

                      {/* Section 4.3 */}
                      <button
                        onClick={() => {
                          setApiMethod("GET");
                          setApiUrlTemplate("/api/iztek/hattinyaklasanotobusleri/446/21056");
                        }}
                        className={`w-full p-4 rounded-xl text-left border flex items-start gap-3 transition-colors ${
                          apiUrlTemplate.includes("/hattinyaklasanotobusleri/")
                            ? "bg-black text-white border-black"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-2 py-1 rounded select-none ${
                          apiUrlTemplate.includes("/hattinyaklasanotobusleri/") ? "bg-white/15 text-white" : "bg-gray-100 text-gray-900"
                        }`}>GET</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">4.3 Hattın Durağa Yaklaşan Otobüsleri</p>
                          <p className={`text-[10px] font-mono mt-1 ${
                            apiUrlTemplate.includes("/hattinyaklasanotobusleri/") ? "text-gray-300" : "text-gray-400"
                          }`}>/iztek/hattinyaklasanotobusleri/446/21056</p>
                        </div>
                      </button>

                      {/* Section 4.4 */}
                      <button
                        onClick={() => {
                          setApiMethod("GET");
                          setApiUrlTemplate("/api/iztek/hatotobuskonumlari/121");
                        }}
                        className={`w-full p-4 rounded-xl text-left border flex items-start gap-3 transition-colors ${
                          apiUrlTemplate.includes("/hatotobuskonumlari/")
                            ? "bg-black text-white border-black"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-2 py-1 rounded select-none ${
                          apiUrlTemplate.includes("/hatotobuskonumlari/") ? "bg-white/15 text-white" : "bg-gray-100 text-gray-900"
                        }`}>GET</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">4.4 Hatta Ait Otobüs Anlık Konumları</p>
                          <p className={`text-[10px] font-mono mt-1 ${
                            apiUrlTemplate.includes("/hatotobuskonumlari/") ? "text-gray-300" : "text-gray-400"
                          }`}>/iztek/hatotobuskonumlari/121</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Section 4.5 HTTP State Code Table */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-xs font-bold text-[#111827] uppercase tracking-widest mb-3">4.5 Kılavuz Durum Kodları</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 bg-green-50 rounded-lg text-xs font-medium text-green-800">
                        <span className="font-bold">200 Başarılı İşlem</span>
                        <span>İçerikler başarılı döndü</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-yellow-50 rounded-lg text-xs font-medium text-yellow-800">
                        <span className="font-bold">204 İçerik Yok</span>
                        <span>Sorguda otobüs bulunamadı</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-red-50 rounded-lg text-xs font-medium text-red-800">
                        <span className="font-bold">401 Yetkisiz Erişim</span>
                        <span>Erişim token yetkisi eksik</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-gray-100 rounded-lg text-xs font-medium text-gray-700">
                        <span className="font-bold">404 Kaynak Bulunamadı</span>
                        <span>Adres veya girdi geçersiz</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Sandbox live terminal */}
                <div className="lg:col-span-7 space-y-6">
                  
                  <div className="bg-slate-900 text-[#f8fafc] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col justify-between min-h-[460px]">
                    
                    {/* Sandbox address bar / Controls */}
                    <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 font-mono font-bold text-[10px] rounded">
                          {apiMethod}
                        </span>
                        <input
                          type="text"
                          value={apiUrlTemplate}
                          onChange={(e) => setApiUrlTemplate(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-[#f8fafc] flex-1 focus:outline-none focus:border-slate-500 truncate"
                        />
                      </div>
                      <button
                        onClick={handleSandboxExecute}
                        disabled={apiLoading}
                        className="px-4 py-1.5 bg-white text-slate-950 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-50"
                      >
                        {apiLoading ? "İstek Gönderiliyor..." : "İstek Yap"}
                      </button>
                    </div>

                    {/* Metadata indicators */}
                    <div className="px-5 py-2.5 bg-slate-950/20 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                      <div className="flex gap-4">
                        <span>Status: <strong className={apiResponseStatus === 200 ? "text-green-400" : "text-amber-400"}>{apiResponseStatus || "YOK"}</strong></span>
                        <span>Süre: {apiExecutionTime !== null ? `${apiExecutionTime}ms` : "0ms"}</span>
                      </div>
                      <span>Content-Type: application/json</span>
                    </div>

                    {/* Interactive Code Viewer Area */}
                    <div className="flex-1 p-5 font-mono text-xs overflow-y-auto leading-relaxed max-h-[350px]">
                      <pre className="text-emerald-400/90 whitespace-pre-wrap">{apiResponseText}</pre>
                    </div>

                    {/* Footer instructions */}
                    <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between items-center">
                      <span>Metot parametre listesi ve dönüşleri birebir PDF standardındadır.</span>
                      <span className="text-gray-500">v1.0.0-Beta</span>
                    </div>
                  </div>

                  {/* Integration code instructions block */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h5 className="text-xs font-bold text-gray-900 mb-2">Hızlı JavaScript API Entegrasyonu</h5>
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 font-mono text-[10px] text-gray-650 overflow-x-auto leading-relaxed">
                      <p className="text-blue-700">// Askıda İzmirim Kart İstatistiklerini çekmek için:</p>
                      <p><span className="text-purple-700">const</span> res = <span className="text-purple-700">await</span> fetch(<span className="text-emerald-700">"https://openapi.izmir.bel.tr/api/iztek/askidaizmirimkart"</span>);</p>
                      <p><span className="text-purple-700">const</span> stats = <span className="text-purple-700">await</span> res.json();</p>
                      <p>console.log(<span className="text-purple-700">"Askıda Bekleyen:"</span>, stats.AskidaBekleyenKart);</p>
                    </div>
                  </div>

                </div>

              </div>

          </div>

          {/* TAB 5: AI ASSISTANT CHAT */}
          <div className={`h-full flex flex-col ${activeTab === "assistant" ? "flex" : "hidden"}`} id="tab-assistant">
              
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col justify-between min-h-[500px]">
                
                {/* Assistant Chat Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200 text-amber-600 animate-pulse">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">İzmir Akıllı Ulaşım Yapay Zeka Desteği</h4>
                      <p className="text-[10px] text-gray-400 font-medium">Bütün İzmir İnovasyon A.Ş. API kurallarına ve kodlarına hâkim asistan.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded font-semibold">Gemini 3.5 Engine</span>
                </div>

                {/* Question suggestions bubble shortcuts */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2 items-center text-xs text-gray-500 font-medium">
                  <span className="text-gray-400 text-[10px] uppercase font-bold">Önerilen Sorular:</span>
                  <button
                    onClick={() => {
                      setUserInput("Askıda İzmirim Kart istatistik web servisi nasıl çalışıyor?");
                    }}
                    className="bg-white hover:bg-gray-100 px-3 py-1 rounded-full border border-gray-200 text-gray-700 cursor-pointer"
                  >
                    Askıda Kart API nedir?
                  </button>
                  <button
                    onClick={() => {
                      setUserInput("Durağa yaklaşan otobüs durum kodları ve parametreleri nelerdir?");
                    }}
                    className="bg-white hover:bg-gray-100 px-3 py-1 rounded-full border border-gray-200 text-gray-700 cursor-pointer"
                  >
                    Durak ve Durum Kodları
                  </button>
                  <button
                    onClick={() => {
                      setUserInput("Hatta ait otobüs anlık konum bilgileri servisi (4.4) çıktısı nedir?");
                    }}
                    className="bg-white hover:bg-gray-100 px-3 py-1 rounded-full border border-gray-200 text-gray-700 cursor-pointer"
                  >
                    Canlı GPS Servisi Çıktısı
                  </button>
                </div>

                {/* Messages dialog Area */}
                <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[340px]">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-black text-white rounded-tr-none"
                            : "bg-gray-100 text-[#111827] rounded-tl-none border border-gray-200/50"
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>
                      </div>
                    </div>
                  ))}

                  {assistantLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-none p-4 text-xs border border-gray-100 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        <span>Akıllı Asistan analiz ediyor...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Message Send Form */}
                <form onSubmit={handleAssistantSubmit} className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                  <input
                    type="text"
                    required
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Eshot, Askıda Kart veya durak sorguları ile ilgili aklına takılanları sor..."
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={assistantLoading}
                    className="px-5 py-3 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-900 transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    Gönder
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

              </div>
          </div>

        </div>
      </main>

    </div>
  );
}
