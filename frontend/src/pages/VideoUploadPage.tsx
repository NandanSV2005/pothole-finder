import React, { useState, useRef } from 'react';
import { AxiosError } from 'axios';
import { Upload, Film, Clock, MapPin, Eye, AlertCircle, Sparkles } from 'lucide-react';
import api, { API_BASE_URL } from '../api';

interface ApiErrorResponse {
  detail?: {
    error?: string;
    suggestion?: string;
  };
}

interface VideoDetection {
  id: number;
  damage_class: string;
  confidence: number;
  severity: string;
}

interface TimelineEvent {
  time: string;
  seconds: number;
  lat: number;
  lng: number;
  address: string;
  image_path: string;
  detections: VideoDetection[];
}

const VideoUploadPage: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frameInterval, setFrameInterval] = useState(10);
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [totalDetections, setTotalDetections] = useState(0);
  const [errorMsg, setErrorMsg] = useState<{ error: string; suggestion: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const selectFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setErrorMsg({
        error: "Invalid file type.",
        suggestion: "Please upload an MP4, AVI, or MOV video file."
      });
      return;
    }
    setVideoFile(file);
    setErrorMsg(null);
    setTimeline([]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) return;

    setLoading(true);
    setErrorMsg(null);
    setTimeline([]);

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('frame_interval', frameInterval.toString());

    try {
      const response = await api.post('/api/detections/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setTimeline(response.data.timeline);
        setTotalDetections(response.data.total_detections);
      }
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errDetail = axiosError.response?.data?.detail;
      setErrorMsg({
        error: errDetail?.error || 'Video processing failed.',
        suggestion: errDetail?.suggestion || 'Please try again with a shorter video or larger frame interval.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <Film className="w-8 h-8 text-brand-500 animate-pulse" /> Dashcam Route Assessment
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Upload dashcam drive footage (MP4) to batch-process frames, automatically map anomalous hotspots, and build route reports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configurations panel */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 h-fit shadow-lg">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="w-4 h-4 text-brand-400" /> Parameters
          </h3>
          
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Frame Sample Interval</label>
              <input
                type="number"
                min="1"
                max="100"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                value={frameInterval}
                onChange={(e) => setFrameInterval(parseInt(e.target.value) || 10)}
              />
              <span className="text-[10px] text-slate-500 leading-normal block">
                Analyzes every Nth frame. Lower numbers increase detail but take longer to process.
              </span>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!videoFile || loading}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg py-2.5 font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-brand-950/20"
              >
                {loading ? "Processing Video..." : "Start Batch Process"}
              </button>
            </div>
          </form>
        </div>

        {/* Upload Dropzone and Output */}
        <div className="lg:col-span-2 space-y-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${
              videoFile ? 'border-brand-600 bg-slate-900/30' : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
            }`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="video/mp4,video/x-m4v,video/*"
              onChange={(e) => { if (e.target.files?.[0]) selectFile(e.target.files[0]); }}
            />
            
            {loading ? (
              <div className="space-y-3">
                <div className="w-10 h-10 border-4 border-slate-700 border-t-brand-500 rounded-full animate-spin mx-auto" />
                <div className="space-y-1">
                  <p className="font-bold text-white text-sm">Analyzing Footage...</p>
                  <p className="text-xs text-slate-400">Extracting frames and identifying road anomalies.</p>
                </div>
              </div>
            ) : videoFile ? (
              <div className="space-y-2">
                <Film className="w-12 h-12 text-brand-400 mx-auto" />
                <p className="font-semibold text-white text-base">{videoFile.name}</p>
                <p className="text-xs text-slate-400">Size: {(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <p className="text-xs text-brand-400 font-bold uppercase tracking-wider mt-1.5">Click to replace video</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-slate-500 mx-auto" />
                <div>
                  <p className="font-semibold text-lg text-white font-sans">Drag and drop dashcam video here</p>
                  <p className="text-xs text-slate-400 mt-1">supports MP4, AVI, and MOV video formats (Max 100MB)</p>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 flex gap-3 text-red-200">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <div>
                <h4 className="font-bold text-sm">Processing Error</h4>
                <p className="text-xs text-red-300 mt-0.5">{errorMsg.error}</p>
                <p className="text-xs text-slate-400 mt-1 font-mono">Tip: {errorMsg.suggestion}</p>
              </div>
            </div>
          )}

          {/* Timeline Output */}
          {timeline.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-400 animate-pulse" /> Route Incident Timeline
                </h3>
                <span className="bg-brand-950/80 text-brand-400 px-3 py-1 rounded-lg border border-brand-900/30 font-bold text-xs">
                  Detected {totalDetections} anomalies
                </span>
              </div>

              <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6 py-2">
                {timeline.map((event, index) => (
                  <div key={index} className="relative space-y-3">
                    {/* Pulsing indicator node */}
                    <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-brand-500 border-2 border-slate-950 ring-4 ring-brand-950 flex items-center justify-center animate-ping" />
                    <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-brand-600 border-2 border-slate-950 ring-4 ring-brand-950" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/30 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white bg-slate-950 border border-slate-850 px-2 py-0.5 rounded">
                          {event.time}
                        </span>
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {event.address}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold font-mono">
                        GPS: {event.lat.toFixed(5)}, {event.lng.toFixed(5)}
                      </span>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-start bg-slate-950/40 border border-slate-850 p-3.5 rounded-lg">
                      {/* Frame image */}
                      <div className="w-full md:w-48 h-32 rounded border border-slate-800 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
                        <img
                          src={`${API_BASE_URL}${event.image_path}`}
                          alt="Video frame"
                          className="max-h-full max-w-full object-cover"
                        />
                      </div>

                      {/* Frame incident details */}
                      <div className="flex-1 space-y-2">
                        <h4 className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-slate-500" /> Incidents Found in Frame
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {event.detections.map((det, dIdx) => (
                            <div key={dIdx} className="bg-slate-950 border border-slate-850/80 px-2.5 py-1.5 rounded flex justify-between items-center text-xs">
                              <span className="capitalize font-semibold text-white flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  det.severity === 'critical' ? 'bg-red-500' : det.severity === 'moderate' ? 'bg-orange-500' : 'bg-green-500'
                                }`} />
                                {det.damage_class.replace('_', ' ')}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className={`px-1 py-0.1 rounded text-[8px] font-bold ${
                                  det.severity === 'critical' ? 'bg-red-950 text-red-400 border border-red-900/30' : 
                                  det.severity === 'moderate' ? 'bg-orange-950 text-orange-400 border border-orange-900/30' : 
                                  'bg-green-950 text-green-400 border border-green-900/30'
                                }`}>{det.severity}</span>
                                <span className="text-slate-500 font-bold font-mono">{(det.confidence * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoUploadPage;
