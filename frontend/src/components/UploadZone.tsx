import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AxiosError } from 'axios';
import { Upload, MapPin, Eye, AlertCircle, MessageCircle, CloudLightning, Wifi } from 'lucide-react';
import api from '../api';
import { type Detection } from '../types';

interface UploadZoneProps {
  onDetectionSuccess?: (detections: Detection[]) => void;
}

interface OfflineQueueItem {
  id: string;
  filename: string;
  fileType: string;
  imageBase64: string;
  lat: number | null;
  lng: number | null;
  timestamp: string;
}

interface ApiErrorResponse {
  detail?: {
    error?: string;
    suggestion?: string;
  };
}

const UploadZone: React.FC<UploadZoneProps> = ({ onDetectionSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<{ error: string; suggestion: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Offline queue state
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    return JSON.parse(localStorage.getItem('roadsense_offline_queue') || '[]');
  });

  const requestCoordinates = (): Promise<{ lat: number | null; lng: number | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 5000 }
      );
    });
  };

  // Convert base64 dataURL to Blob for FormData upload
  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Save report locally in offline queue
  const saveToOfflineQueue = (file: File, coords: { lat: number | null; lng: number | null }) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const newQueueItem = {
        id: Math.random().toString(36).substring(7),
        filename: file.name,
        fileType: file.type,
        imageBase64: base64Data,
        lat: coords.lat,
        lng: coords.lng,
        timestamp: new Date().toISOString()
      };
      
      const updatedQueue = [...offlineQueue, newQueueItem];
      setOfflineQueue(updatedQueue);
      localStorage.setItem('roadsense_offline_queue', JSON.stringify(updatedQueue));
      
      setErrorMsg({
        error: "Offline Queue Active.",
        suggestion: "You are offline or the server is unreachable. We have saved the photo and GPS coordinates locally. It will auto-sync when connection is restored."
      });
      setLoading(false);
    };
  };

  // Sync offline queue reports to server
  const syncOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0 || syncing) return;
    setSyncing(true);
    setErrorMsg(null);

    const remainingQueue = [...offlineQueue];
    const itemsToProcess = [...offlineQueue];

    for (const item of itemsToProcess) {
      try {
        const blob = dataURLtoBlob(item.imageBase64);
        const formData = new FormData();
        formData.append('file', blob, item.filename);
        if (item.lat !== null) formData.append('lat', item.lat.toString());
        if (item.lng !== null) formData.append('lng', item.lng.toString());

        const response = await api.post('/api/detect', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response.data.success) {
          // Remove from local tracker
          const idx = remainingQueue.findIndex(q => q.id === item.id);
          if (idx !== -1) {
            remainingQueue.splice(idx, 1);
          }
          // Set latest detection as main preview for user satisfaction
          setDetections(response.data.detections);
          if (response.data.annotated_image_base64) {
            setPreviewUrl(response.data.annotated_image_base64);
          }
          if (onDetectionSuccess) {
            onDetectionSuccess(response.data.detections);
          }
        }
      } catch (err) {
        console.error("Failed to sync offline item:", err);
        // Break loop if connection is still down
        break;
      }
    }

    setOfflineQueue(remainingQueue);
    localStorage.setItem('roadsense_offline_queue', JSON.stringify(remainingQueue));
    setSyncing(false);
  }, [offlineQueue, onDetectionSuccess, syncing]);

  // Auto-sync when going online
  useEffect(() => {
    const handleOnline = () => {
      if (offlineQueue.length > 0) {
        syncOfflineQueue();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [offlineQueue, syncOfflineQueue]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg({ error: 'Unsupported file type.', suggestion: 'Please upload a valid JPEG or PNG image.' });
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setPreviewUrl(null);
    setDetections([]);

    const coords = await requestCoordinates();

    // Direct check if we are offline
    if (!navigator.onLine) {
      saveToOfflineQueue(file, coords);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (coords.lat !== null) formData.append('lat', coords.lat.toString());
    if (coords.lng !== null) formData.append('lng', coords.lng.toString());

    try {
      const response = await api.post('/api/detect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        setDetections(response.data.detections);
        if (response.data.annotated_image_base64) {
          setPreviewUrl(response.data.annotated_image_base64);
        }
        if (onDetectionSuccess) {
          onDetectionSuccess(response.data.detections);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<ApiErrorResponse>;
      if (axiosError.message === "Network Error" || !axiosError.response) {
        // Fallback to offline queue if server connection fails
        saveToOfflineQueue(file, coords);
      } else {
        const errDetail = axiosError.response?.data?.detail;
        setErrorMsg({
          error: errDetail?.error || 'Inference error.',
          suggestion: errDetail?.suggestion || 'Please review file dimensions and try again.',
        });
        setLoading(false);
      }
    } finally {
      if (navigator.onLine && errorMsg?.error !== "Offline Queue Active.") {
        setLoading(false);
      }
    }
  };

  const handleWhatsAppShare = () => {
    if (detections.length === 0) return;
    const damageDesc = detections.map(d => `${d.damage_class.replace('_', ' ').toUpperCase()} (${d.severity} severity)`).join(', ');
    const firstAddr = detections[0]?.address || 'location unknown';
    const text = `RoadSense Alert 🚨: I just reported road damage in Bengaluru. Detected: ${damageDesc} at ${firstAddr}. Join me in making our roads safer!`;
    const encodedText = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(url, '_blank');
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Offline Queue sync panel */}
      {offlineQueue.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex items-center justify-between text-amber-200">
          <div className="flex items-center gap-3">
            <CloudLightning className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <h4 className="font-bold text-sm">Offline Reports Queued</h4>
              <p className="text-xs text-amber-300">There are {offlineQueue.length} reports awaiting connection.</p>
            </div>
          </div>
          <button
            onClick={syncOfflineQueue}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold transition"
          >
            {syncing ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Wifi className="w-3.5 h-3.5" />
            )}
            Sync Now
          </button>
        </div>
      )}

      {/* Main Drag-Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[200px] ${
          dragActive ? 'border-brand-500 bg-slate-800/50' : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        {loading ? (
          <div className="space-y-2 text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-brand-500 rounded-full animate-spin mx-auto" />
            <p>Uploading and running YOLOv8 detection...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-12 h-12 text-slate-500 mx-auto" />
            <div>
              <p className="font-semibold text-lg text-white">Drag and drop road image here</p>
              <p className="text-sm text-slate-400 mt-1">or click to browse from files (Max 10MB)</p>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className={`border rounded-xl p-4 flex gap-3 ${
          errorMsg.error.includes("Offline") ? 'bg-blue-950/40 border-blue-800/80 text-blue-200' : 'bg-red-950/40 border-red-800/80 text-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${errorMsg.error.includes("Offline") ? 'text-blue-400' : 'text-red-400'}`} />
          <div>
            <h4 className="font-bold text-sm">{errorMsg.error}</h4>
            <p className="text-xs text-slate-300 mt-0.5">{errorMsg.suggestion}</p>
          </div>
        </div>
      )}

      {/* Results output */}
      {previewUrl && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm"><Eye className="w-4 h-4 text-emerald-400" /> Detection Output</h3>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Coordinates Captured</span>
          </div>
          
          <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 max-h-[400px] flex justify-center items-center">
            <img src={previewUrl} alt="Annotated Detection Output" className="max-h-[400px] object-contain w-full" />
          </div>
          
          {detections.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {detections.map((det, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-800 text-xs flex justify-between items-center">
                    <span className="capitalize font-medium text-white flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        det.severity === 'critical' ? 'bg-red-500' : det.severity === 'moderate' ? 'bg-orange-500' : 'bg-green-500'
                      }`} />
                      {det.damage_class.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        det.severity === 'critical' ? 'bg-red-950 text-red-400 border border-red-900/30' : 
                        det.severity === 'moderate' ? 'bg-orange-950 text-orange-400 border border-orange-900/30' : 
                        'bg-green-950 text-green-400 border border-green-900/30'
                      }`}>{det.severity}</span>
                      <span className="text-slate-400 font-semibold font-mono">{(det.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/20"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  Share Report on WhatsApp
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-500 py-1">No anomalies detected in this image frame.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadZone;
