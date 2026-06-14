export interface User {
  id: number;
  username: string;
  role: 'admin' | 'citizen';
}

export interface Detection {
  id: number;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  damage_class: 'pothole' | 'crack' | 'waterlogging' | 'road_collapse';
  confidence: number;
  image_path: string;
  is_verified: boolean;
  severity: 'minor' | 'moderate' | 'critical';
  is_incorrect: boolean;
}

export interface DamageCount {
  damage_class: string;
  count: number;
}

export interface HotspotArea {
  area: string;
  count: number;
}

export interface Stats {
  total_detections_today: number;
  total_detections_all_time: number;
  by_type: DamageCount[];
  hotspots: HotspotArea[];
}

export interface DetectionResponse {
  success: boolean;
  message: string;
  detections: Detection[];
  annotated_image_base64?: string;
}

export interface PaginatedDetections {
  total: number;
  page: number;
  limit: number;
  items: Detection[];
}
