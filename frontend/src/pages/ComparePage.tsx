import React, { useState, useRef, useEffect } from 'react';
import { AxiosError } from 'axios';
import { Upload, GitCompare, AlertCircle, CheckCircle2, Navigation } from 'lucide-react';
import api, { API_BASE_URL } from '../api';

interface ComparePageProps {
  onNavigate: (tab: 'dashboard' | 'upload' | 'video' | 'compare' | 'history' | 'analytics' | 'report' | 'login') => void;
}

interface ApiErrorResponse {
  detail?: {
    error?: string;
    suggestion?: string;
  };
}

interface CompareResult {
  status: 'compared' | 'baseline_saved';
  new_detection_id: string;
  prior_detection_id: string | null;
  prior_detection_date: string | null;
  distance_metres: number | null;
  location_confidence: 'high' | 'medium' | 'low' | null;
  ssim_score: number | null;
  verdict: 'repaired' | 'worsened' | 'unchanged' | 'new_baseline' | 'prior_image_unavailable';
  verdict_explanation: string;
  old_image_url: string | null;
  new_image_url: string;
  prior_detection_address: string | null;
  new_detection_address: string;
  prior_detection_severity: string | null;
}

const ComparePage: React.FC<ComparePageProps> = ({ onNavigate }) => {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ error: string; suggestion: string } | null>(null);

  // GPS Coordinates and Permission State
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check and request GPS location
  const checkGeolocation = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      setGpsActive(false);
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsActive(true);
        setGpsLoading(false);
      },
      (error) => {
        console.warn('Geolocation access failed:', error);
        setGpsActive(false);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    checkGeolocation();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg({
        error: 'Unsupported file type.',
        suggestion: 'Please upload a valid JPEG or PNG image.',
      });
      return;
    }

    // Verify file size limit (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg({
        error: 'File size exceeds 10MB limit.',
        suggestion: 'Please optimize the photo or pick a smaller file.',
      });
      return;
    }

    // Verify coordinates are present
    if (!gpsActive || !coords) {
      setErrorMsg({
        error: 'Location access is required for automatic comparison.',
        suggestion: 'Please enable GPS/location services in your browser settings and try again.',
      });
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    // Run sequential loader message updates
    setLoadingMessage('Searching records within 50m...');
    const timer = setTimeout(() => {
      setLoadingMessage('Running comparison...');
    }, 800);

    const formData = new FormData();
    formData.append('new_image', file);
    formData.append('lat', coords.lat.toString());
    formData.append('lng', coords.lng.toString());

    try {
      const response = await api.post('/api/compare', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errDetail = axiosError.response?.data?.detail;
      setErrorMsg({
        error: errDetail?.error || 'Comparison analysis failed.',
        suggestion: errDetail?.suggestion || 'Confirm server is running and try again.',
      });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  // Redirection: Center on map
  const handleViewOnMap = () => {
    if (!coords) return;
    
    // Save target coordinates of the uploaded image
    localStorage.setItem('map_center_target', JSON.stringify({
      lat: coords.lat,
      lng: coords.lng
    }));
    
    // Fly to dashboard tab
    onNavigate('dashboard');
  };

  // Render color styling for Verdict
  const getVerdictBadgeStyles = (verdict: string) => {
    switch (verdict.toLowerCase()) {
      case 'repaired':
        return 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80';
      case 'unchanged':
        return 'bg-amber-950/60 text-amber-400 border border-amber-800/80';
      case 'worsened':
        return 'bg-red-950/60 text-red-400 border border-red-850/80';
      default:
        return 'bg-slate-800/80 text-slate-300 border border-slate-700';
    }
  };

  const getSeverityBadgeStyles = (severity: string | null) => {
    if (!severity) return 'hidden';
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-950/80 text-red-400 border border-red-900/40 text-[9px] font-bold px-1.5 py-0.5 rounded';
      case 'moderate':
        return 'bg-orange-950/80 text-orange-400 border border-orange-900/40 text-[9px] font-bold px-1.5 py-0.5 rounded';
      default:
        return 'bg-green-950/80 text-green-400 border border-green-900/40 text-[9px] font-bold px-1.5 py-0.5 rounded';
    }
  };

  const getConfidenceBadgeStyles = (conf: string | null) => {
    if (!conf) return 'hidden';
    switch (conf.toLowerCase()) {
      case 'high':
        return 'bg-emerald-950 text-emerald-400 border border-emerald-900/30 text-[10px] font-bold px-2 py-0.5 rounded';
      case 'medium':
        return 'bg-amber-950 text-amber-400 border border-amber-900/30 text-[10px] font-bold px-2 py-0.5 rounded';
      default:
        return 'bg-red-950 text-red-400 border border-red-900/30 text-[10px] font-bold px-2 py-0.5 rounded';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <GitCompare className="w-8 h-8 text-brand-500" /> Automatic Change Detection
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Audit road repair workflows automatically. Upload a photo and we will scan past logs within 50m to compare surface conditions.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-300">
          💡 <span className="font-semibold text-white">How it works:</span> Upload a new photo of a road location. We'll automatically check our records for prior damage reports nearby and compare them for you.
        </p>
      </div>

      {/* Main interaction card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* GPS Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-850">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full shrink-0 ${gpsActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                {gpsActive ? 'GPS Signal Connected' : 'GPS Location Required'}
              </span>
              <p className="text-[11px] text-slate-400">
                {gpsActive 
                  ? `Active coordinates: ${coords?.lat.toFixed(5)}, ${coords?.lng.toFixed(5)}`
                  : 'Enable location access in your browser to use this feature.'
                }
              </p>
            </div>
          </div>
          {!gpsActive && (
            <button
              onClick={checkGeolocation}
              disabled={gpsLoading}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded transition uppercase border border-slate-700"
            >
              {gpsLoading ? 'Checking...' : 'Retry GPS'}
            </button>
          )}
        </div>

        {/* Drag-Drop Zone */}
        {!loading && (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[180px] ${
              dragActive ? 'border-brand-500 bg-slate-800/30' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'
            } ${!gpsActive ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => gpsActive && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={!gpsActive}
            />
            <div className="space-y-2.5">
              <Upload className="w-10 h-10 text-slate-500 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-white">Drag & drop location photo here</p>
                <p className="text-[11px] text-slate-500 mt-0.5">JPEG, PNG formats accepted (Max 10MB)</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-12 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-brand-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-300 font-mono tracking-wider animate-pulse">
              {loadingMessage}
            </p>
          </div>
        )}

        {/* Error Output */}
        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 flex gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <div>
              <h4 className="font-bold text-sm">{errorMsg.error}</h4>
              <p className="text-xs text-red-300 mt-0.5">{errorMsg.suggestion}</p>
            </div>
          </div>
        )}

        {/* STATE A: compared */}
        {result && result.status === 'compared' && (
          <div className="space-y-6 pt-4 border-t border-slate-800 animate-fadeIn">
            {/* Side by side layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {/* Then Card */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Then (Prior Report)</span>
                  {result.prior_detection_severity && (
                    <span className={getSeverityBadgeStyles(result.prior_detection_severity)}>
                      {result.prior_detection_severity.toUpperCase()}
                    </span>
                  )}
                </div>
                {result.old_image_url ? (
                  <div className="rounded-lg overflow-hidden border border-slate-850 bg-slate-900 h-48 flex items-center justify-center">
                    <img 
                      src={`${API_BASE_URL}${result.old_image_url}`} 
                      alt="Prior road condition" 
                      className="max-h-full max-w-full object-cover" 
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-850 bg-slate-900/50 h-48 flex flex-col items-center justify-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mb-1" />
                    <span className="text-xs">Image File Missing</span>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Reported Date</span>
                  <span className="text-xs text-white font-mono">
                    {result.prior_detection_date 
                      ? new Date(result.prior_detection_date).toLocaleString() 
                      : 'N/A'
                    }
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Address</span>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed h-8">
                    {result.prior_detection_address || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Center Badge overlay for Larger Screens */}
              {result.verdict !== 'prior_image_unavailable' && (
                <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl ${getVerdictBadgeStyles(result.verdict)}`}>
                    {result.verdict}
                  </div>
                </div>
              )}

              {/* Now Card */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Now (Current Photo)</span>
                  <span className="bg-brand-950/80 text-brand-400 border border-brand-900/40 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                    YOLO Annotated
                  </span>
                </div>
                <div className="rounded-lg overflow-hidden border border-slate-850 bg-slate-900 h-48 flex items-center justify-center">
                  <img 
                    src={`${API_BASE_URL}${result.new_image_url}`} 
                    alt="Current road condition" 
                    className="max-h-full max-w-full object-cover" 
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Analysis Date</span>
                  <span className="text-xs text-white font-mono">
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Address</span>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed h-8">
                    {result.new_detection_address}
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile-only verdict banner */}
            <div className="md:hidden block text-center py-2">
              <span className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest inline-block ${getVerdictBadgeStyles(result.verdict)}`}>
                Verdict: {result.verdict}
              </span>
            </div>

            {/* Telemetry data info */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Analysis Findings</h4>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {result.verdict_explanation}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-900 pt-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase tracking-wider font-bold text-[10px] block">Location Verification</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white font-semibold">
                      Distance: {result.distance_metres !== null ? `${result.distance_metres}m` : 'N/A'}
                    </span>
                    {result.location_confidence && (
                      <span className={getConfidenceBadgeStyles(result.location_confidence)}>
                        {result.location_confidence.toUpperCase()} CONFIDENCE
                      </span>
                    )}
                  </div>
                </div>

                {result.ssim_score !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                      <span>Surface Similarity Score</span>
                      <span className="text-white font-mono">{Math.round(result.ssim_score * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full ${
                          result.verdict === 'repaired' ? 'bg-emerald-500' :
                          result.verdict === 'unchanged' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.round(result.ssim_score * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STATE B: baseline_saved */}
        {result && result.status === 'baseline_saved' && (
          <div className="space-y-6 pt-4 border-t border-slate-800 animate-fadeIn">
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="rounded-lg overflow-hidden border border-slate-850 bg-slate-900 max-h-[250px] flex items-center justify-center">
                <img 
                  src={`${API_BASE_URL}${result.new_image_url}`} 
                  alt="New baseline report" 
                  className="max-h-full max-w-full object-cover" 
                />
              </div>

              <div className="space-y-4">
                {/* Green info box */}
                <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-xl p-4 text-emerald-200 flex gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">New Location Tracked</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      This is now the baseline for <span className="text-white font-semibold">{result.new_detection_address}</span>. Future uploads here will be compared against this report.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleViewOnMap}
                  className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-brand-950/20"
                >
                  <Navigation className="w-4 h-4 fill-white" />
                  View on Map
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
