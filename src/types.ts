/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// İzmirim Kart Askıda Kart İstatistikleri Model
export interface AskidaKartIstatistik {
  AskidaBekleyenKart: number;
  AskidanAlinanKart: number;
  ToplamOdenenTutar: number;
}

// Durağa Yaklaşan Otobüs Model
export interface YaklasanOtobus {
  KalanDurakSayisi: number;
  HattinYonu: number;
  KoorY: number; // Enlem/Boylam (Depending on Koory/KoorX mapping, standard is usually X=lat, Y=lng or vice versa)
  BisikletAparatliMi: boolean;
  KoorX: number;
  EngelliMi: boolean;
  HatNumarasi: number;
  HatAdi: string;
  OtobusId: number;
}

// Bus location item on a route
export interface OtobusKonumu {
  Yon: number;
  KoorX: number;
  KoorY: number;
  OtobusId: number;
}

// Hatta Ait Otobüs Konum Bilgileri Response
export interface HatOtobusKonumlariResponse {
  HataMesaj: string;
  HatOtobusKonumlari: OtobusKonumu[];
}

// Support logs stored locally for demo/interactivity
export interface BagisKaydi {
  id: string;
  tarih: string;
  miktar: number;
  kartAdedi: number;
  donorIsim: string;
}
