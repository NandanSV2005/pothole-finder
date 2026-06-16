import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  MapPin, Menu, X, Github, Upload, ScanLine, 
  FileText, Flame, AlertTriangle, GitCompare, 
  Film, Smartphone, Linkedin, CheckCircle2 
} from 'lucide-react';
import './Landing.css';

interface LandingProps {
  onNavigate: (path: string) => void;
}

const DEMO_MARKERS = [
  { lat: 12.9716, lng: 77.5946, label: 'MG Road', cls: 'pothole',     sev: 'critical'  },
  { lat: 12.9178, lng: 77.6220, label: 'Silk Board', cls: 'crack',    sev: 'moderate'  },
  { lat: 13.0358, lng: 77.5970, label: 'Hebbal', cls: 'pothole',      sev: 'critical'  },
  { lat: 12.9591, lng: 77.6974, label: 'Marathahalli', cls: 'crack',  sev: 'moderate'  },
  { lat: 12.9698, lng: 77.7499, label: 'Whitefield', cls: 'pothole',  sev: 'minor'     },
  { lat: 12.8399, lng: 77.6770, label: 'Electronic City', cls: 'waterlogging', sev: 'moderate' },
  { lat: 13.0298, lng: 77.5556, label: 'Yeshwanthpur', cls: 'crack',  sev: 'minor'     },
  { lat: 12.9279, lng: 77.6271, label: 'BTM Layout', cls: 'pothole',  sev: 'critical'  },
  { lat: 12.9850, lng: 77.5533, label: 'Rajajinagar', cls: 'crack',   sev: 'moderate'  },
  { lat: 12.9010, lng: 77.5800, label: 'JP Nagar', cls: 'pothole',    sev: 'minor'     },
];

const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  // Navigation states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNavbarScrolled, setIsNavbarScrolled] = useState(false);

  // Stats Counters
  const [reportsCount, setReportsCount] = useState(0);
  const [roadsCount, setRoadsCount] = useState(0);
  const [severityCount, setSeverityCount] = useState(0);

  // Live Demo Widget State
  const [activeDemo, setActiveDemo] = useState<'pothole' | 'crack' | 'waterlogging'>('pothole');
  const [demoTransitioning, setDemoTransitioning] = useState(false);
  const [formattedTime, setFormattedTime] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const intervalRef = useRef<number | null>(null);

  // 1. Stats Counter Animation
  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1800;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      setReportsCount(Math.floor(easeProgress * 1240));
      setRoadsCount(Math.floor(easeProgress * 38));
      setSeverityCount(Math.floor(easeProgress * 3));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animFrameId);
  }, []);

  // 2. Leaflet Map Background and Markers
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map('hero-map', {
      center: [12.9716, 77.5946],
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    mapRef.current = map;

    let index = 0;
    const timeoutId = setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        if (index >= DEMO_MARKERS.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        const m = DEMO_MARKERS[index];
        const colorMap: Record<string, string> = {
          critical: '#E63946',
          moderate: '#F4A261',
          minor: '#2EC4B6',
        };
        const color = colorMap[m.sev] || '#E63946';

        const customIcon = L.divIcon({
          className: 'leaflet-div-icon-reset',
          html: `<div class="custom-pulsing-marker" style="background-color: ${color}; border-color: #ffffff;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);
        index++;
      }, 1200);
    }, 600);

    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) clearInterval(intervalRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 3. Navbar Bottom Border Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNavbarScrolled(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // 4. Global Scroll Reveal IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.getAttribute('data-delay');
            if (delay) {
              setTimeout(() => {
                el.classList.add('visible');
              }, parseInt(delay));
            } else {
              el.classList.add('visible');
            }
            observer.unobserve(el);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  // 5. Get current HH:MM formatted time on load for the demo widget
  useEffect(() => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setFormattedTime(`${hours}:${minutes}`);
  }, []);

  const handleDemoChange = (demoType: 'pothole' | 'crack' | 'waterlogging') => {
    setDemoTransitioning(true);
    setTimeout(() => {
      setActiveDemo(demoType);
      setDemoTransitioning(false);
    }, 200);
  };

  // Live Demo Bounding Box Helper style configurations
  const getDemoOverlayStyle = () => {
    switch (activeDemo) {
      case 'pothole':
        return { top: '28%', left: '22%', width: '38%', height: '40%' };
      case 'crack':
        return { top: '35%', left: '40%', width: '38%', height: '40%' };
      case 'waterlogging':
        return { top: '20%', left: '15%', width: '55%', height: '45%' };
    }
  };

  const getDemoMetadata = () => {
    switch (activeDemo) {
      case 'pothole':
        return {
          label: 'Pothole',
          confidence: '87% confident',
          severity: 'Critical',
          address: 'MG Road, near Trinity Circle, Bengaluru',
          badgeStyle: 'bg-[#E63946]/15 border-[#E63946]/40 text-[#E63946]',
          severityStyle: 'bg-[#E63946]/20 text-[#E63946]',
          imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=800&auto=format&fit=crop', // fallback link placeholder
        };
      case 'crack':
        return {
          label: 'Road Crack',
          confidence: '74% confident',
          severity: 'Moderate',
          address: 'Silk Board Junction, Bengaluru',
          badgeStyle: 'bg-[#F4A261]/15 border-[#F4A261]/40 text-[#F4A261]',
          severityStyle: 'bg-[#F4A261]/20 text-[#F4A261]',
          imageUrl: 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?q=80&w=800&auto=format&fit=crop', // fallback link placeholder
        };
      case 'waterlogging':
        return {
          label: 'Waterlogging',
          confidence: '91% confident',
          severity: 'Minor',
          address: 'Hebbal Flyover, Bengaluru',
          badgeStyle: 'bg-[#2EC4B6]/15 border-[#2EC4B6]/40 text-[#2EC4B6]',
          severityStyle: 'bg-[#2EC4B6]/20 text-[#2EC4B6]',
          imageUrl: 'https://images.unsplash.com/photo-1485594050903-8e8ee7b071a8?q=80&w=800&auto=format&fit=crop', // fallback link placeholder
        };
    }
  };

  const demoInfo = getDemoMetadata();

  return (
    <div className="landing-root min-h-screen relative flex flex-col">
      {/* Sticky Navbar (Phase 2) */}
      <nav className={`sticky-navbar ${isNavbarScrolled ? 'scrolled' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <MapPin className="w-5 h-5 text-[#E63946] shrink-0" />
              <span className="font-semibold text-lg text-white tracking-wide">PotholeAI</span>
            </div>
            <span className="bg-[#2EC4B6]/15 border border-[#2EC4B6]/30 text-[#2EC4B6] text-[11px] font-medium px-2 py-0.5 rounded-full tracking-wide">
              Open Source
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-[var(--clr-muted)] hover:text-white transition-colors duration-150">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-[var(--clr-muted)] hover:text-white transition-colors duration-150">How It Works</a>
            <a href="#tech-stack" className="text-sm font-medium text-[var(--clr-muted)] hover:text-white transition-colors duration-150">Tech Stack</a>
            <a href="https://github.com/NandanSV2005/pothole-finder" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--clr-muted)] hover:text-white transition-colors duration-150 flex items-center gap-1.5">
              <Github className="w-4 h-4" /> GitHub
            </a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="bg-[var(--clr-accent)] hover:bg-[#c1121f] text-white px-4 py-2 rounded-lg text-[13px] md:text-sm font-semibold tracking-wide transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-red-950/20"
            >
              See Bengaluru's Roads Live →
            </button>
            <button
              className="md:hidden p-1.5 text-slate-400 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-nav-dropdown md:hidden border-t border-[var(--clr-border)] flex flex-col py-4 px-6 gap-4 animate-fadeIn">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-[var(--clr-muted)] hover:text-white py-1">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-[var(--clr-muted)] hover:text-white py-1">How It Works</a>
            <a href="#tech-stack" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-[var(--clr-muted)] hover:text-white py-1">Tech Stack</a>
            <a href="https://github.com/NandanSV2005/pothole-finder" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-[var(--clr-muted)] hover:text-white py-1 flex items-center gap-1.5">
              <Github className="w-4 h-4" /> GitHub
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section (Phase 3) */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div id="hero-map" className="hero-map-container" />
        <div className="hero-overlay" />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center justify-center pt-20 pb-28">
          <span className="bg-[#E63946]/12 border border-[#E63946]/35 text-[#E63946] text-[11px] md:text-xs font-semibold tracking-[0.12em] px-4 py-1.5 rounded-full mb-6 uppercase">
            🚧  CIVIC AI PLATFORM  ·  BENGALURU, INDIA
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.08] select-none">
            Roads that break <br />
            <span className="text-[var(--clr-accent)]">get reported.</span>
          </h1>

          <p className="text-slate-400 text-sm md:text-lg max-w-xl mx-auto mt-6 leading-relaxed">
            Upload a photo. YOLOv8 detects the damage, scores the severity, and pins it to Bengaluru's live road intelligence map — automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto justify-center">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="bg-[var(--clr-accent)] hover:bg-[#c1121f] text-white px-7 py-3.5 rounded-lg text-sm md:text-base font-bold tracking-wide transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              See Bengaluru's Roads Live →
            </button>
            <a
              href="https://github.com/NandanSV2005/pothole-finder"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[var(--clr-border)] hover:border-slate-500 text-white px-7 py-3.5 rounded-lg text-sm md:text-base font-bold tracking-wide transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Github className="w-4.5 h-4.5" /> View on GitHub
            </a>
          </div>
        </div>

        <div ref={sentinelRef} className="absolute bottom-0 left-0 w-full h-1 pointer-events-none" />

        {/* Stat Strip */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/45 border-t border-white/5 py-5">
          <div className="max-w-5xl mx-auto grid grid-cols-3 text-center gap-4">
            <div className="space-y-1">
              <span className="block text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {reportsCount.toLocaleString()}+
              </span>
              <span className="block text-[10px] md:text-xs text-[var(--clr-muted)] font-medium uppercase tracking-wider">
                Damage Reports Logged
              </span>
            </div>
            <div className="space-y-1 border-l border-white/5">
              <span className="block text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {roadsCount}
              </span>
              <span className="block text-[10px] md:text-xs text-[var(--clr-muted)] font-medium uppercase tracking-wider">
                Roads Monitored
              </span>
            </div>
            <div className="space-y-1 border-l border-white/5">
              <span className="block text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {severityCount}
              </span>
              <span className="block text-[10px] md:text-xs text-[var(--clr-muted)] font-medium uppercase tracking-wider">
                Severity Levels Tracked
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement Section (Phase 4) */}
      <section id="problem" className="bg-[var(--clr-bg)] py-24 px-6 border-t border-[var(--clr-border)]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left: quotation stat panel */}
          <div className="relative text-center p-8 bg-slate-950/20 border border-[var(--clr-border)] rounded-2xl reveal">
            <span className="absolute top-[-30px] left-4 text-[#E63946] opacity-10 text-[160px] font-black pointer-events-none font-serif leading-none">
              “
            </span>
            <span className="block text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#E63946] tracking-tight">
              150,000+
            </span>
            <span className="block text-base md:text-lg text-white font-semibold mt-3 max-w-sm mx-auto leading-snug">
              road accident deaths annually in India
            </span>
            <span className="block text-xs md:text-sm text-[var(--clr-muted)] font-medium italic mt-6">
              — Ministry of Road Transport & Highways, 2023
            </span>
          </div>

          {/* Right: details narrative */}
          <div className="space-y-6 reveal" data-delay="100">
            <span className="text-[11px] md:text-xs font-bold text-[var(--clr-teal)] uppercase tracking-[0.1em] block">
              THE PROBLEM
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              India's roads are dangerous. The data doesn't exist.
            </h2>
            <div className="space-y-4 text-sm md:text-base text-[var(--clr-muted)] leading-relaxed">
              <p>
                Every year, thousands of accidents on Indian roads are directly caused by potholes and deteriorating road surfaces. Yet there is no automated, real-time system for citizens to report this damage and for municipalities to act on it.
              </p>
              <p>
                Corporations like BBMP rely on manual reports and phone calls. By the time a pothole is logged and a work order is raised, the damage has already caused accidents, vehicle damage, and delays for thousands of commuters.
              </p>
              <p className="text-white font-medium">
                PotholeAI changes this:
                <span className="block mt-2 font-mono text-[13px] md:text-sm text-[var(--clr-teal)] tracking-wider">
                  &gt; One photo from a phone.<br />
                  &gt; Automatic AI detection.<br />
                  &gt; Live city map.<br />
                  &gt; Municipality-ready PDF.<br />
                  &gt; All in under ten seconds.
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section (Phase 5) */}
      <section id="how-it-works" className="bg-[var(--clr-bg-2)] py-24 px-6 border-t border-[var(--clr-border)]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3 reveal">
            <span className="text-xs font-bold text-[var(--clr-teal)] uppercase tracking-[0.12em] block">
              THE PROCESS
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              From photo to civic report in seconds.
            </h2>
          </div>

          {/* 4 Step Layout */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative pt-4 reveal" data-delay="100">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center relative z-10 px-4 group">
              <div className="absolute top-[20px] left-[50%] w-full h-[1px] bg-[var(--clr-border)] hidden md:block z-0" />
              <div className="w-10 h-10 rounded-full bg-[var(--clr-accent)] text-white font-bold text-sm flex items-center justify-center mb-4 relative z-10 shadow-md">
                1
              </div>
              <Upload className="w-8 h-8 text-[var(--clr-teal)] mb-3 relative z-10 transition-transform duration-200 group-hover:scale-110" />
              <h3 className="text-base font-bold text-white">Upload</h3>
              <p className="text-xs text-[var(--clr-muted)] max-w-[170px] mt-2 leading-relaxed">
                Photo or dashcam video. GPS captured automatically from your browser.
              </p>
              <div className="w-[1px] h-6 bg-[var(--clr-border)] md:hidden mt-4" />
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center relative z-10 px-4 group">
              <div className="absolute top-[20px] left-[50%] w-full h-[1px] bg-[var(--clr-border)] hidden md:block z-0" />
              <div className="w-10 h-10 rounded-full bg-[var(--clr-accent)] text-white font-bold text-sm flex items-center justify-center mb-4 relative z-10 shadow-md">
                2
              </div>
              <ScanLine className="w-8 h-8 text-[var(--clr-teal)] mb-3 relative z-10 transition-transform duration-200 group-hover:scale-110" />
              <h3 className="text-base font-bold text-white">Detect</h3>
              <p className="text-xs text-[var(--clr-muted)] max-w-[170px] mt-2 leading-relaxed">
                YOLOv8 identifies damage. 4 classes, 3 severity levels, confidence score.
              </p>
              <div className="w-[1px] h-6 bg-[var(--clr-border)] md:hidden mt-4" />
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center relative z-10 px-4 group">
              <div className="absolute top-[20px] left-[50%] w-full h-[1px] bg-[var(--clr-border)] hidden md:block z-0" />
              <div className="w-10 h-10 rounded-full bg-[var(--clr-accent)] text-white font-bold text-sm flex items-center justify-center mb-4 relative z-10 shadow-md">
                3
              </div>
              <MapPin className="w-8 h-8 text-[var(--clr-teal)] mb-3 relative z-10 transition-transform duration-200 group-hover:scale-110" />
              <h3 className="text-base font-bold text-white">Locate</h3>
              <p className="text-xs text-[var(--clr-muted)] max-w-[170px] mt-2 leading-relaxed">
                GPS pins it to the map. Reverse geocoded to a real Bengaluru address.
              </p>
              <div className="w-[1px] h-6 bg-[var(--clr-border)] md:hidden mt-4" />
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center relative z-10 px-4 group">
              <div className="w-10 h-10 rounded-full bg-[var(--clr-accent)] text-white font-bold text-sm flex items-center justify-center mb-4 relative z-10 shadow-md">
                4
              </div>
              <FileText className="w-8 h-8 text-[var(--clr-teal)] mb-3 relative z-10 transition-transform duration-200 group-hover:scale-110" />
              <h3 className="text-base font-bold text-white">Report</h3>
              <p className="text-xs text-[var(--clr-muted)] max-w-[170px] mt-2 leading-relaxed">
                Live map updates. PDF civic report ready for BBMP in one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Bento Grid Section (Phase 6) */}
      <section id="features" className="bg-[var(--clr-bg)] py-24 px-6 border-t border-[var(--clr-border)]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3 reveal">
            <span className="text-xs font-bold text-[var(--clr-teal)] uppercase tracking-[0.12em] block">
              FEATURES
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Everything a civic platform needs.
            </h2>
          </div>

          {/* Grid Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {/* 1. Large Card: Live Heatmap Intelligence */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-7 flex flex-col justify-between hover:border-[#E63946] hover:translate-y-[-3px] transition-all duration-200 md:col-span-2 reveal" data-delay="0">
              <div className="space-y-4">
                <Flame className="w-7 h-7 text-[#E63946]" />
                <h3 className="text-lg font-bold text-white">Live Heatmap Intelligence</h3>
                <p className="text-xs md:text-sm text-[var(--clr-muted)] leading-relaxed max-w-2xl">
                  Density heatmap shows damage concentration across Bengaluru. Time slider: 7 days, 30 days, all time. From raw reports to city-wide infrastructure intelligence in two clicks.
                </p>
              </div>
            </div>

            {/* 2. Severity Triage Engine */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-7 flex flex-col justify-between hover:border-[#E63946] hover:translate-y-[-3px] transition-all duration-200 reveal" data-delay="80">
              <div className="space-y-4">
                <AlertTriangle className="w-7 h-7 text-[#E63946]" />
                <h3 className="text-lg font-bold text-white">Severity Triage Engine</h3>
                <p className="text-xs md:text-sm text-[var(--clr-muted)] leading-relaxed">
                  Every detection is scored Minor, Moderate, or Critical using bounding box analysis and depth cues. Actionable priorities, not just a list of locations.
                </p>
              </div>
            </div>

            {/* 3. Automatic Before/After */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-7 flex flex-col justify-between hover:border-[var(--clr-teal)] hover:translate-y-[-3px] transition-all duration-200 reveal" data-delay="160">
              <div className="space-y-4">
                <GitCompare className="w-7 h-7 text-[var(--clr-teal)]" />
                <h3 className="text-lg font-bold text-white">Automatic Before/After</h3>
                <p className="text-xs md:text-sm text-[var(--clr-muted)] leading-relaxed">
                  Upload one photo. The system finds the prior report within 50m using GPS + Haversine, compares with SSIM, and verdicts: Repaired, Unchanged, or Worsened.
                </p>
              </div>
            </div>

            {/* 4. Dashcam Batch Processing */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-7 flex flex-col justify-between hover:border-[var(--clr-teal)] hover:translate-y-[-3px] transition-all duration-200 reveal" data-delay="240">
              <div className="space-y-4">
                <Film className="w-7 h-7 text-[var(--clr-teal)]" />
                <h3 className="text-lg font-bold text-white">Dashcam Batch Processing</h3>
                <p className="text-xs md:text-sm text-[var(--clr-muted)] leading-relaxed">
                  Upload an MP4 video. Every 10th frame is analysed. Output: a timestamped driving route damage timeline report.
                </p>
              </div>
            </div>

            {/* 5. Municipality PDF Report */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-7 flex flex-col justify-between hover:border-[#F4A261] hover:translate-y-[-3px] transition-all duration-200 reveal" data-delay="320">
              <div className="space-y-4">
                <FileText className="w-7 h-7 text-[#F4A261]" />
                <h3 className="text-lg font-bold text-white">Municipality PDF Report</h3>
                <p className="text-xs md:text-sm text-[var(--clr-muted)] leading-relaxed">
                  Formal cover page, executive summary, top 10 worst roads, severity breakdown, detection annexure. Formatted for BBMP submission in one click.
                </p>
              </div>
            </div>

            {/* 6. Large Card: PWA - No Install Needed */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-7 hover:border-[var(--clr-teal)] hover:translate-y-[-3px] transition-all duration-200 md:col-span-2 flex flex-col sm:flex-row justify-between gap-6 reveal" data-delay="400">
              <div className="space-y-4 flex-1">
                <Smartphone className="w-7 h-7 text-[var(--clr-teal)]" />
                <h3 className="text-lg font-bold text-white">PWA — No Install Needed</h3>
                <p className="text-xs md:text-sm text-[var(--clr-muted)] leading-relaxed">
                  Add to home screen on Android. Camera, GPS, and detection — all from a browser. No app store. No account. Just open the link and report. Any citizen, any phone, any road.
                </p>
              </div>

              {/* Phone Mockup */}
              <div className="relative shrink-0 w-[72px] h-[124px] border-2 border-[var(--clr-border)] rounded-[14px] bg-slate-950 p-[1.5px] mx-auto sm:mx-0 self-center">
                <div className="w-full h-full rounded-[10px] bg-[var(--clr-bg)] relative overflow-hidden">
                  <div className="absolute top-[5px] left-[50%] translate-x-[-50%] w-[18px] h-[3px] bg-[var(--clr-border)] rounded-full" />
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-[#E63946] border border-white shadow top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] animate-pulse" />
                </div>
              </div>
            </div>

            {/* 7. Model Statistics Card */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-7 flex flex-col justify-between hover:border-[var(--clr-teal)] hover:translate-y-[-3px] transition-all duration-200 reveal" data-delay="480">
              <div className="space-y-4">
                <CheckCircle2 className="w-7 h-7 text-[var(--clr-teal)]" />
                <h3 className="text-lg font-bold text-white">98.4% Model Precision</h3>
                <p className="text-xs md:text-sm text-[var(--clr-muted)] leading-relaxed">
                  YOLOv8 fine-tuned on custom Indian road damage dataset (RDD2020) for optimal precision in complex local road layouts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Widget Section (Phase 7) */}
      <section id="demo" className="bg-[var(--clr-bg-2)] py-24 px-6 border-t border-[var(--clr-border)]">
        <div className="max-w-4xl mx-auto space-y-12 reveal">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              See the detection in action.
            </h2>
            <p className="text-sm text-[var(--clr-muted)]">
              Click a sample — no upload needed.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => handleDemoChange('pothole')}
              className={`px-5 py-2.5 rounded-lg text-xs md:text-sm font-semibold border transition-all duration-150 ${
                activeDemo === 'pothole'
                  ? 'border-[var(--clr-accent)] text-[var(--clr-accent)] bg-[var(--clr-accent)]/8'
                  : 'bg-[var(--clr-bg-3)] border-[var(--clr-border)] text-[var(--clr-muted)] hover:text-white'
              }`}
            >
              🕳 Pothole
            </button>
            <button
              onClick={() => handleDemoChange('crack')}
              className={`px-5 py-2.5 rounded-lg text-xs md:text-sm font-semibold border transition-all duration-150 ${
                activeDemo === 'crack'
                  ? 'border-[var(--clr-accent)] text-[var(--clr-accent)] bg-[var(--clr-accent)]/8'
                  : 'bg-[var(--clr-bg-3)] border-[var(--clr-border)] text-[var(--clr-muted)] hover:text-white'
              }`}
            >
              🔱 Road Crack
            </button>
            <button
              onClick={() => handleDemoChange('waterlogging')}
              className={`px-5 py-2.5 rounded-lg text-xs md:text-sm font-semibold border transition-all duration-150 ${
                activeDemo === 'waterlogging'
                  ? 'border-[var(--clr-accent)] text-[var(--clr-accent)] bg-[var(--clr-accent)]/8'
                  : 'bg-[var(--clr-bg-3)] border-[var(--clr-border)] text-[var(--clr-muted)] hover:text-white'
              }`}
            >
              💧 Waterlogging
            </button>
          </div>

          {/* Results Display */}
          <div 
            className={`bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-5 gap-8 transition-opacity duration-200 ${
              demoTransitioning ? 'opacity-30' : 'opacity-100'
            }`}
          >
            {/* Left: Image Box */}
            <div className="md:col-span-3 aspect-video bg-[#0d1117] rounded-lg border border-[var(--clr-border)] relative overflow-hidden flex items-center justify-center">
              <img 
                src={demoInfo.imageUrl} 
                alt={demoInfo.label} 
                className="w-full h-full object-cover opacity-60" 
              />
              <span className="absolute inset-0 bg-[#0d1117]/10 pointer-events-none" />

              {/* Bounding Box Overlay */}
              <div 
                className="absolute border-2 border-[var(--clr-accent)] transition-all duration-300"
                style={getDemoOverlayStyle()}
              >
                <span className="absolute top-[-1px] left-[-1px] bg-[var(--clr-accent)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-tr rounded-bl uppercase">
                  {demoInfo.label}
                </span>
              </div>
            </div>

            {/* Right: Meta Details */}
            <div className="md:col-span-2 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <span className={`text-[10px] md:text-xs font-semibold px-3 py-1 rounded-full border uppercase ${demoInfo.badgeStyle}`}>
                    {demoInfo.label}
                  </span>
                  <span className={`text-[10px] md:text-xs font-semibold px-3 py-1 rounded-full uppercase ${demoInfo.severityStyle}`}>
                    {demoInfo.severity} Severity
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="block text-2xl font-black text-white leading-none">
                    {demoInfo.confidence}
                  </span>
                  <span className="block text-[10px] text-[var(--clr-muted)] font-bold uppercase tracking-wider">
                    Model Inference score
                  </span>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-[var(--clr-border)]">
                  <div className="flex items-start gap-1.5 text-xs text-[var(--clr-muted)] leading-normal">
                    <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{demoInfo.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--clr-muted)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span>Logged: Today at {formattedTime}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigate('/dashboard')}
                className="w-full bg-[var(--clr-accent)] hover:bg-[#c1121f] text-white py-2.5 rounded-lg text-xs md:text-sm font-bold uppercase tracking-wider transition-colors"
              >
                Try with your own photo →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section (Phase 8) */}
      <section id="tech-stack" className="bg-[var(--clr-bg)] py-24 px-6 border-t border-[var(--clr-border)]">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-3 reveal">
            <span className="text-xs font-bold text-[var(--clr-teal)] uppercase tracking-[0.12em] block">
              BUILT WITH
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Production-grade AI stack.
            </h2>
          </div>

          {/* 3 Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {/* Group 1 */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-6 flex flex-col reveal" data-delay="0">
              <span className="text-[10px] font-bold text-[var(--clr-teal)] uppercase tracking-[0.08em] block mb-4">
                ML / Computer Vision
              </span>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">YOLOv8</span>
                  <span className="text-xs text-[var(--clr-muted)]">Object detection</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">OpenCV</span>
                  <span className="text-xs text-[var(--clr-muted)]">Image drawing + SSIM</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">scikit-image</span>
                  <span className="text-xs text-[var(--clr-muted)]">SSIM logic</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-xs font-semibold text-white">PyTorch</span>
                  <span className="text-xs text-[var(--clr-muted)]">Model runtime</span>
                </div>
              </div>
            </div>

            {/* Group 2 */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-6 flex flex-col reveal" data-delay="100">
              <span className="text-[10px] font-bold text-[var(--clr-teal)] uppercase tracking-[0.08em] block mb-4">
                Backend
              </span>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">FastAPI</span>
                  <span className="text-xs text-[var(--clr-muted)]">API framework</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">SQLAlchemy</span>
                  <span className="text-xs text-[var(--clr-muted)]">Database ORM</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">SQLite</span>
                  <span className="text-xs text-[var(--clr-muted)]">Local storage</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-xs font-semibold text-white">ReportLab</span>
                  <span className="text-xs text-[var(--clr-muted)]">PDF generation</span>
                </div>
              </div>
            </div>

            {/* Group 3 */}
            <div className="bg-[var(--clr-bg-3)] border border-[var(--clr-border)] rounded-2xl p-6 flex flex-col reveal" data-delay="200">
              <span className="text-[10px] font-bold text-[var(--clr-teal)] uppercase tracking-[0.08em] block mb-4">
                Frontend & DevOps
              </span>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">React 18</span>
                  <span className="text-xs text-[var(--clr-muted)]">UI framework</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">TypeScript</span>
                  <span className="text-xs text-[var(--clr-muted)]">Type safety</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-[var(--clr-border)]">
                  <span className="text-xs font-semibold text-white">Leaflet.js</span>
                  <span className="text-xs text-[var(--clr-muted)]">Interactive map</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-xs font-semibold text-white">Docker</span>
                  <span className="text-xs text-[var(--clr-muted)]">Deploy runtime</span>
                </div>
              </div>
            </div>
          </div>

          {/* GitHub links */}
          <div className="text-center pt-4">
            <a 
              href="https://github.com/NandanSV2005/pothole-finder" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs md:text-sm text-[var(--clr-muted)] hover:text-white transition-colors"
            >
              <Github className="w-4.5 h-4.5" />
              <span>Fully open source · MIT License · View source on GitHub</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer Section (Phase 9) */}
      <footer className="bg-[#060A14] border-t border-[var(--clr-border)] pt-16 pb-8 px-6 mt-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 text-xs leading-normal">
          {/* Logo & Author (Col 1) */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#E63946] shrink-0" />
              <span className="font-semibold text-base text-white tracking-wide">PotholeAI</span>
            </div>
            <p className="text-[var(--clr-muted)] max-w-sm">
              Making Indian roads safer, one report at a time.
            </p>
            <p className="text-[var(--clr-muted)] font-mono leading-relaxed">
              Built by Nandan<br />
              BMS Institute of Technology & Management, Bengaluru
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="https://github.com/NandanSV2005" target="_blank" rel="noopener noreferrer" className="text-[var(--clr-muted)] hover:text-white transition-colors">
                <Github className="w-4.5 h-4.5" />
              </a>
              <a href="https://linkedin.com/in/nandansv" target="_blank" rel="noopener noreferrer" className="text-[var(--clr-muted)] hover:text-white transition-colors">
                <Linkedin className="w-4.5 h-4.5" />
              </a>
            </div>
          </div>

          {/* Quick links (Col 2) */}
          <div className="md:col-span-3 space-y-4">
            <span className="block font-bold text-[10px] text-[var(--clr-muted)] uppercase tracking-wider">
              Quick Links
            </span>
            <div className="flex flex-col gap-2.5 text-[var(--clr-muted)]">
              <button onClick={() => onNavigate('/dashboard')} className="text-left hover:text-white transition-colors">Live Dashboard</button>
              <button onClick={() => onNavigate('/dashboard')} className="text-left hover:text-white transition-colors">Upload Detection</button>
              <button onClick={() => onNavigate('/dashboard')} className="text-left hover:text-white transition-colors">Detection History</button>
              <button onClick={() => onNavigate('/dashboard')} className="text-left hover:text-white transition-colors">Generate PDF Report</button>
              <a href="https://github.com/NandanSV2005/pothole-finder" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub Repository</a>
            </div>
          </div>

          {/* Data & Legal (Col 3) */}
          <div className="md:col-span-4 space-y-4">
            <span className="block font-bold text-[10px] text-[var(--clr-muted)] uppercase tracking-wider">
              Data & Legal
            </span>
            <div className="space-y-1.5 text-[var(--clr-muted)]">
              <p>Map data: &copy; OpenStreetMap contributors, &copy; CARTO</p>
              <p>Statistics: MoRTH Annual Report 2023</p>
              <p>Detection model: Ultralytics YOLOv8</p>
              <p>License: MIT Open Source</p>
            </div>
            
            <div className="pt-2">
              <span className="block text-[var(--clr-muted)] leading-relaxed">
                Interested in using this data for civic planning? <br />
                <a href="mailto:contact@nandansv.me" className="text-[var(--clr-teal)] hover:underline">
                  contact@nandansv.me
                </a>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-6xl mx-auto border-t border-[var(--clr-border)] mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[var(--clr-muted)]">
          <span>
            &copy; {new Date().getFullYear()} PotholeAI &middot; Student Project &middot; Not affiliated with any government body &middot; Made in Bengaluru 🇮🇳
          </span>
          <span>
            Powered by YOLOv8 &middot; FastAPI &middot; React
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
