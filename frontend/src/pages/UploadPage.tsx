import React from 'react';
import UploadZone from '../components/UploadZone';
import { Camera, HelpCircle, MapPin } from 'lucide-react';

const UploadPage: React.FC = () => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Report Road Damage</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Upload an image of a pothole, crack, waterlogging, or road collapse to automatically notify municipal services.
        </p>
      </div>

      {/* Upload Zone */}
      <UploadZone />

      {/* User Guides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4.5 space-y-2.5">
          <div className="w-8 h-8 bg-brand-950 text-brand-400 rounded-lg flex items-center justify-center border border-brand-900/30">
            <Camera className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-white text-sm">1. Take a Clear Photo</h4>
          <p className="text-xs text-slate-400 leading-normal">
            Capture the anomaly in daylight. Ensure the damage (e.g. pothole) is centered and clearly visible in the frame.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4.5 space-y-2.5">
          <div className="w-8 h-8 bg-amber-950 text-amber-400 rounded-lg flex items-center justify-center border border-amber-900/30">
            <MapPin className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-white text-sm">2. Enable GPS Services</h4>
          <p className="text-xs text-slate-400 leading-normal">
            Allow location permissions when prompted. The application uses browser geolocation to pin coordinates on the civic map.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4.5 space-y-2.5">
          <div className="w-8 h-8 bg-emerald-950 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-900/30">
            <HelpCircle className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-white text-sm">3. Automatic Logging</h4>
          <p className="text-xs text-slate-400 leading-normal">
            Our YOLOv8 model classifies the damage type and auto-saves the location, allowing municipal workers to verify reports.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
