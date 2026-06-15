import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { type Detection } from '../types';
import { API_BASE_URL } from '../api';
import { Map, Flame, Calendar } from 'lucide-react';

// Custom component to render the Leaflet.heat layer
interface HeatmapLayerProps {
  points: [number, number, number][]; // [lat, lng, intensity]
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    
    const heatLayer = L.heatLayer(points, {
      radius: 28,
      blur: 18,
      maxZoom: 15,
      max: 1.0,
      gradient: {
        0.3: '#3b82f6', // blue
        0.5: '#06b6d4', // cyan
        0.7: '#10b981', // green
        0.85: '#f57c00', // orange
        1.0: '#ef4444'   // red
      }
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
};

// Fix default Leaflet icon assets
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom helper component to center and animate map viewpoint changes
const ChangeMapView: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [map, center, zoom]);
  return null;
};

// Custom pulsing colored severity markers (Green / Orange / Red)
const createSeverityIcon = (severity: string) => {
  const colorMap: Record<string, string> = {
    minor: '#10b981',       // Green
    moderate: '#f97316',    // Orange
    critical: '#ef4444'     // Red
  };
  const color = colorMap[severity] || '#10b981';
  
  return L.divIcon({
    html: `<div class="w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer flex items-center justify-center" style="background-color: ${color}; transition: transform 0.2s; transform-origin: center;" onmouseover="this.style.transform='scale(1.35)'" onmouseout="this.style.transform='scale(1)'">
             <span class="w-1.5 h-1.5 rounded-full bg-white opacity-85"></span>
           </div>`,
    className: 'custom-leaflet-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
};

interface MapDashboardProps {
  detections: Detection[];
}

type TimeFilter = '7' | '30' | 'all';

const MapDashboard: React.FC<MapDashboardProps> = ({ detections }) => {
  const defaultPosition: [number, number] = [12.9716, 77.5946]; // Bengaluru Majestic Center
  const [mapView, setMapView] = useState<'pins' | 'heatmap'>('pins');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  
  // Coordinate centering and zoom state
  const [center, setCenter] = useState<[number, number]>(defaultPosition);
  const [zoom, setZoom] = useState<number>(12);

  // Monitor localStorage for map flying triggers
  useEffect(() => {
    const target = localStorage.getItem('map_center_target');
    if (target) {
      try {
        const { lat, lng } = JSON.parse(target);
        if (typeof lat === 'number' && typeof lng === 'number') {
          setCenter([lat, lng]);
          setZoom(16);
        }
      } catch (e) {
        console.error("Failed to parse map center target:", e);
      }
      localStorage.removeItem('map_center_target');
    }
  }, []);

  // Filter detections by timestamp
  const getFilteredDetections = () => {
    // Exclude flagged/incorrect items
    const correctDetections = detections.filter(d => !d.is_incorrect);
    
    if (timeFilter === 'all') return correctDetections;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (timeFilter === '7' ? 7 : 30));
    
    return correctDetections.filter(d => new Date(d.timestamp) >= cutoffDate);
  };

  const filteredDetections = getFilteredDetections();

  // Map detections to heatmap coordinate array: [lat, lng, intensity]
  // Intensity is higher for critical severity cases
  const heatmapPoints: [number, number, number][] = filteredDetections
    .filter(d => d.lat !== null && d.lng !== null)
    .map(d => {
      let intensity = 0.5;
      if (d.severity === 'critical') intensity = 1.0;
      else if (d.severity === 'moderate') intensity = 0.75;
      return [d.lat!, d.lng!, intensity];
    });

  return (
    <div className="w-full h-full min-h-[450px] relative rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-[#090d16] flex flex-col">
      {/* Premium Floating Controls Bar */}
      <div className="absolute top-3 right-3 z-[500] flex flex-col sm:flex-row gap-2 bg-[#0d1527]/90 backdrop-blur-md border border-slate-800 p-2 rounded-xl shadow-xl">
        {/* Pins vs Heatmap Toggle */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850">
          <button
            onClick={() => setMapView('pins')}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition ${
              mapView === 'pins' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            Pins
          </button>
          <button
            onClick={() => setMapView('heatmap')}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition ${
              mapView === 'heatmap' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Heatmap
          </button>
        </div>

        {/* Time Filter Dropdown */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850 items-center">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            className="bg-transparent border-none text-white text-xs font-bold py-1 px-2 focus:outline-none cursor-pointer"
          >
            <option value="7" className="bg-[#0c1017]">Last 7 Days</option>
            <option value="30" className="bg-[#0c1017]">Last 30 Days</option>
            <option value="all" className="bg-[#0c1017]">All Time</option>
          </select>
        </div>
      </div>

      {/* Main Map */}
      <div className="flex-1 w-full h-full">
        <MapContainer
          center={center}
          zoom={zoom}
          className="w-full h-full"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ChangeMapView center={center} zoom={zoom} />


          {mapView === 'pins' &&
            filteredDetections.map((det) => {
              if (det.lat === null || det.lng === null) return null;
              return (
                <Marker
                  key={det.id}
                  position={[det.lat, det.lng]}
                  icon={createSeverityIcon(det.severity)}
                >
                  <Popup>
                    <div className="p-1 min-w-[200px] text-slate-200">
                      <div className="rounded overflow-hidden mb-2 border border-slate-700 bg-slate-950 flex justify-center items-center h-28">
                        <img
                          src={`${API_BASE_URL}${det.image_path}`}
                          alt={det.damage_class}
                          className="max-h-full max-w-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-white capitalize flex items-center gap-1.5">
                          {det.damage_class.replace('_', ' ')}
                        </h3>
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${
                          det.severity === 'critical' ? 'bg-red-950/80 text-red-400 border border-red-900/30' : 
                          det.severity === 'moderate' ? 'bg-orange-950/80 text-orange-400 border border-orange-900/30' : 
                          'bg-green-950/80 text-green-400 border border-green-900/30'
                        }`}>{det.severity}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-2 space-y-1">
                        <p><b>Confidence:</b> {(det.confidence * 100).toFixed(0)}%</p>
                        <p><b>Location:</b> {det.address || 'location unknown'}</p>
                        <p><b>Reported:</b> {new Date(det.timestamp).toLocaleString()}</p>
                        <p className="mt-1 flex items-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${det.is_verified ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                            {det.is_verified ? 'Verified' : 'Pending Verification'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {mapView === 'heatmap' && <HeatmapLayer points={heatmapPoints} />}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapDashboard;
