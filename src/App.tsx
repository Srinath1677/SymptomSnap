import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Mic, 
  ChevronDown, 
  Loader2, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  ArrowLeft,
  Navigation,
  Navigation2,
  RefreshCcw,
  Hospital,
  Settings,
  Phone,
  PhoneCall,
  Clock,
  MessageSquare,
  X,
  User,
  Activity,
  Apple,
  Camera,
  Image as ImageIcon,
  Trash2,
  ShieldAlert,
  Mars,
  Venus,
  Calendar,
  Satellite,
  Minus,
  Plus
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { jsPDF } from 'jspdf';

// Fix Leaflet marker icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom red marker for clinics
const RedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map centering
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 14);
  return null;
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyJ_7lQ-wRDrN8bHerTGh_ngZhDxASujo",
  authDomain: "symptomsnap-c419e.firebaseapp.com",
  projectId: "symptomsnap-c419e",
  storageBucket: "symptomsnap-c419e.firebasestorage.app",
  messagingSenderId: "427388818557",
  appId: "1:427388818557:web:aaeb53b0b3755028dc4d14",
  measurementId: "G-35KSS3BC3B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "missing_api_key" });

type Screen = 'splash' | 'home' | 'loading' | 'result' | 'map' | 'emergency' | 'guide';
type Severity = 'red' | 'yellow' | 'green';

interface TriageResult {
  severity: Severity;
  title: string;
  reasoning: string;
  dos: string[];
  donts: string[];
  dietary?: string[];
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const mainScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [currentScreen]);
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('symptom_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [followUpMsg, setFollowUpMsg] = useState('');
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [language, setLanguage] = useState('English');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [nearbyClinics, setNearbyClinics] = useState<any[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dietPreference, setDietPreference] = useState<'global' | 'indian'>('global');
  const [uploadedImage, setUploadedImage] = useState<{ base64: string, mimeType: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [emergencyContact, setEmergencyContact] = useState(() => {
    const saved = localStorage.getItem('emergency_contact');
    return saved ? JSON.parse(saved) : { name: '', phone: '' };
  });

  const [activeRegions, setActiveRegions] = useState<Record<string, Severity>>({});

  const bodyRegions = [
    { id: 'head', name: 'Head', path: 'M50 5 C58 5 65 12 65 20 C65 28 58 35 50 35 C42 35 35 28 35 20 C35 12 42 5 50 5 Z', labelPos: { x: 50, y: 20 } },
    { id: 'neck', name: 'Neck', path: 'M45 35 L55 35 L55 40 L45 40 Z', labelPos: { x: 50, y: 37.5 } },
    { id: 'chest', name: 'Chest', path: 'M35 40 L65 40 L68 65 L32 65 Z', labelPos: { x: 50, y: 52.5 } },
    { id: 'abdomen', name: 'Abdomen', path: 'M32 65 L68 65 L65 90 L35 90 Z', labelPos: { x: 50, y: 77.5 } },
    { id: 'right-arm', name: 'Right Arm', path: 'M68 45 L85 75 L80 80 L65 50 Z', labelPos: { x: 75, y: 62.5 } },
    { id: 'left-arm', name: 'Left Arm', path: 'M32 45 L15 75 L20 80 L35 50 Z', labelPos: { x: 25, y: 62.5 } },
    { id: 'right-leg', name: 'Right Leg', path: 'M52 90 L65 90 L70 145 L55 145 Z', labelPos: { x: 61, y: 117.5 } },
    { id: 'left-leg', name: 'Left Leg', path: 'M35 90 L48 90 L45 145 L30 145 Z', labelPos: { x: 39, y: 117.5 } },
  ];

  const toggleRegion = (regionId: string) => {
    setActiveRegions(prev => {
      const current = prev[regionId];
      const next: Record<string, Severity> = { ...prev };
      
      if (!current) {
        next[regionId] = 'green';
      } else if (current === 'green') {
        next[regionId] = 'yellow';
      } else if (current === 'yellow') {
        next[regionId] = 'red';
      } else {
        delete next[regionId];
      }

      // Update symptoms text based on selected regions and their severities
      const regionAssessments = Object.entries(next).map(([id, sev]) => {
        const name = bodyRegions.find(r => r.id === id)?.name;
        return `${name} (${sev} pain)`;
      });

      const assessmentText = regionAssessments.length > 0 
        ? `Pain assessment: ${regionAssessments.join(', ')}.`
        : '';

      if (assessmentText) {
        if (!symptoms.includes('Pain assessment:')) {
          setSymptoms(prevSympt => `${assessmentText} ${prevSympt}`);
        } else {
          setSymptoms(prevSympt => prevSympt.replace(/Pain assessment: [^.]*\./, assessmentText));
        }
      } else {
        setSymptoms(prevSympt => prevSympt.replace(/Pain assessment: [^.]*\. /, ''));
      }
      
      return next;
    });
  };

  const commonSymptoms = [
    'Chest Pain', 'Shortness of Breath', 'Severe Headache', 
    'Fever', 'Dizziness', 'Abdominal Pain', 'Allergic Reaction',
    'Deep Cut', 'Burn', 'Persistent Cough', 'Joint Pain',
    'Blurred Vision', 'Numbness', 'Nausea', 'Anxiety', 'Toothache'
  ];

  const filteredSuggestions = commonSymptoms.filter(s => 
    s.toLowerCase().includes(symptoms.toLowerCase()) && 
    symptoms.length > 0 &&
    s.toLowerCase() !== symptoms.toLowerCase()
  );

  // Persist emergency contact
  useEffect(() => {
    localStorage.setItem('emergency_contact', JSON.stringify(emergencyContact));
  }, [emergencyContact]);

  useEffect(() => {
    if (filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [symptoms]);

  const handleSuggestionClick = (suggestion: string) => {
    // Basic append logic
    const current = symptoms.trim();
    if (current && !current.endsWith('.')) {
      setSymptoms(current + ', ' + suggestion);
    } else {
      setSymptoms((current ? current + ' ' : '') + suggestion);
    }
    setShowSuggestions(false);
  };

  // Splash Screen Timer
  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => {
        setCurrentScreen('home');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Haversine formula for accurate KM distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle Geolocation and Fetch Clinics
  const getUserLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          await fetchClinics(lat, lng);
          setIsLocating(false);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setIsLocating(false);
          setError("Failed to fetch location. Please ensure GPS is enabled.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const fetchClinics = async (lat: number, lng: number) => {
    setIsLoadingClinics(true);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      if (!apiKey) {
        console.error("Google Maps API key is missing");
        setError("Google Maps API key is missing. Please add VITE_GOOGLE_MAPS_KEY to your .env file.");
        setIsLoadingClinics(false);
        return;
      }

      // Determine specialty keywords based on symptoms
      let specificSpecialty = '';
      const lowerSymptoms = symptoms.toLowerCase();
      
      if (lowerSymptoms.includes('skin') || lowerSymptoms.includes('rash') || lowerSymptoms.includes('itch') || lowerSymptoms.includes('dermatology') || lowerSymptoms.includes('pimple') || lowerSymptoms.includes('burn')) {
        specificSpecialty = 'dermatology';
      } else if (lowerSymptoms.includes('heart') || lowerSymptoms.includes('chest') || lowerSymptoms.includes('cardiac')) {
        specificSpecialty = 'cardiology';
      } else if (lowerSymptoms.includes('child') || lowerSymptoms.includes('baby') || lowerSymptoms.includes('kid') || lowerSymptoms.includes('pediatrics')) {
        specificSpecialty = 'pediatrics';
      } else if (lowerSymptoms.includes('eye') || lowerSymptoms.includes('vision') || lowerSymptoms.includes('ophthalmology') || lowerSymptoms.includes('blur')) {
        specificSpecialty = 'ophthalmology';
      } else if (lowerSymptoms.includes('tooth') || lowerSymptoms.includes('dental') || lowerSymptoms.includes('dentist') || lowerSymptoms.includes('gum')) {
        specificSpecialty = 'dentist';
      } else if (lowerSymptoms.includes('bone') || lowerSymptoms.includes('fracture') || lowerSymptoms.includes('orthopedic') || lowerSymptoms.includes('joint') || lowerSymptoms.includes('back pain')) {
        specificSpecialty = 'orthopedics';
      } else if (lowerSymptoms.includes('stomach') || lowerSymptoms.includes('abdominal') || lowerSymptoms.includes('digestion') || lowerSymptoms.includes('nausea') || lowerSymptoms.includes('vomit') || lowerSymptoms.includes('diarrhea')) {
        specificSpecialty = 'gastroenterology';
      } else if (lowerSymptoms.includes('headache') || lowerSymptoms.includes('numbness') || lowerSymptoms.includes('seizure') || lowerSymptoms.includes('neurology')) {
        specificSpecialty = 'neurology';
      } else if (lowerSymptoms.includes('ear') || lowerSymptoms.includes('nose') || lowerSymptoms.includes('throat') || lowerSymptoms.includes('ent')) {
        specificSpecialty = 'ent';
      }

      // Build Google Places nearbySearch query targeting hospitals within 5km
      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=hospital&key=${apiKey}`;
      if (specificSpecialty) {
        url += `&keyword=${specificSpecialty}`;
      }

      // Using a CORS proxy since Google Places API doesn't support direct client-side requests
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      if (data.results) {
        const clinics = data.results.map((place: any) => {
          return {
            id: place.place_id,
            name: place.name,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            addr: place.vicinity || 'Near your location',
            type: specificSpecialty ? `${specificSpecialty.charAt(0).toUpperCase() + specificSpecialty.slice(1)} Clinic` : 'Hospital/Clinic',
            specialty: specificSpecialty || 'General',
            phone: null,
            openingHours: place.opening_hours?.open_now ? 'Open Now' : null
          };
        });

        const sortedClinics = clinics.map((c: any) => {
          const distance = calculateDistance(lat, lng, c.lat, c.lng);
          return { ...c, distanceVal: distance };
        }).sort((a: any, b: any) => a.distanceVal - b.distanceVal).slice(0, 5);

        setNearbyClinics(sortedClinics);
      }
    } catch (err) {
      console.error("Failed to fetch clinics:", err);
    } finally {
      setIsLoadingClinics(false);
    }
  };

  useEffect(() => {
    if (currentScreen === 'map') {
      getUserLocation();
    }
  }, [currentScreen]);

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'Tamil' ? 'ta-IN' : 
                      language === 'Hindi' ? 'hi-IN' : 
                      language === 'Telugu' ? 'te-IN' : 'en-US';
    
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSymptoms(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.start();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setUploadedImage({ base64: base64Data, mimeType: file.type });
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Audio utility for severity alerts with "syllabic" vocal-like sounds
  const playSeveritySound = (severity: 'red' | 'yellow' | 'green') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playSyllable = (freq: number, startTime: number, duration: number, volume = 0.1) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        
        // Pitch envelope for "vocal" inflection
        osc.frequency.setValueAtTime(freq, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.1, startTime + duration * 0.2);
        osc.frequency.exponentialRampToValueAtTime(freq, startTime + duration);
        
        // Volume envelope for "syllabic" feel
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;

      if (severity === 'green') {
        // "Ta-DA!" (Ascending bright)
        playSyllable(392, now, 0.2, 0.24); // G4
        playSyllable(523, now + 0.15, 0.4, 0.3); // C5
      } else if (severity === 'yellow') {
        // "Uh-OH" (Descending soft)
        playSyllable(440, now, 0.2, 0.24); // A4
        playSyllable(349, now + 0.18, 0.35, 0.24); // F4
      } else if (severity === 'red') {
        // "OOH-NO!" (Deep cautionary)
        playSyllable(293, now, 0.2, 0.3); // D4
        playSyllable(220, now + 0.2, 0.4, 0.3); // A3
      }
    } catch (e) {
      console.error("Audio play failed:", e);
    }
  };

  const handleTriage = async (text: string) => {
    if (!text.trim() && !uploadedImage) return;

    // Age Validation Logic
    const ageNum = age ? parseInt(age) : null;
    if (ageNum !== null && ageNum < 12) {
      setSymptoms(text);
      
      const intenseKeywords = ['intense', 'severe', 'red pain', 'hard pain', 'emergency', 'breathing', 'seizure', 'unconscious', 'bleeding', 'high fever', 'dehydration'];
      const isIntense = intenseKeywords.some(key => text.toLowerCase().includes(key));
      const isLongDuration = duration === '1-3 days' || duration === 'More than 3 days';
      const severityValue = (isIntense || isLongDuration) ? 'red' : 'yellow';

      setResult({
        severity: severityValue,
        title: "Pediatric Care Required",
        reasoning: "SymptomSnap is designed for adults. For children under 12, symptoms can progress much faster and require specialized pediatric evaluation.",
        dos: ["Check temperature", "Monitor breathing", "Seek pediatric help"],
        donts: ["Do not wait", "Do not self-medicate", "Do not ignore crying"],
        dietary: []
      });
      playSeveritySound(severityValue);
      setCurrentScreen('result');
      return;
    }

    if (analytics) logEvent(analytics, 'triage_started');
    setSymptoms(text);
    setCurrentScreen('loading');
    setError(null);
    setChatMessages([]);

    try {
      const ageNote = age ? `Age: ${age}` : "Note: Patient age unknown. Give conservative advice.";
      const prompt = `Analyze these symptoms for a ${ageNote} ${gender || 'unknown gender'} person: "${text}". 
      Clinical Context:
      - Duration: ${duration || 'not specified'}

      ${uploadedImage ? 'The user has also uploaded an image of their symptom. Analyze both the text description and the image together.' : ''}
      Language context: ${language}.
      Be professional but concise. 
      Severity should be 'red' (emergency/hospital), 'yellow' (doctor soon), or 'green' (home care).
      CRITICAL LOGIC: 
      - If Symptom duration is "More than 3 days", prioritize 'red' severity unless symptoms are extremely minor.
      - If Symptom duration is "Less than 24 hrs", prioritize 'yellow' or 'green' for monitoring, unless acute emergency signs are present.
      Return purely as JSON with keys: severity, title, reasoning, dos (array of 3 specific actions to take), donts (array of 3 specific things to avoid), dietary (array of food/drink recommendations strictly for abdominal/digestive issues - if the symptoms are not related to abdominal pain, return an empty array for dietary. ${dietPreference === 'indian' ? 'Focus on Indian cuisine e.g., Rasam, Idli, Congee, buttermilk if applicable.' : 'Focus on standard healthy diet recommendations if applicable.'})`;

      const contents = [];
      if (uploadedImage) {
        contents.push({
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: uploadedImage.base64,
                mimeType: uploadedImage.mimeType
              }
            }
          ]
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: prompt }]
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              severity: { type: Type.STRING, enum: ['red', 'yellow', 'green'] },
              title: { type: Type.STRING },
              reasoning: { type: Type.STRING },
              dos: { type: Type.ARRAY, items: { type: Type.STRING } },
              donts: { type: Type.ARRAY, items: { type: Type.STRING } },
              dietary: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['severity', 'title', 'reasoning', 'dos', 'donts', 'dietary']
          }
        }
      });

      const data = JSON.parse(response.text || '{}') as TriageResult;
      if (analytics) logEvent(analytics, 'triage_completed', { severity: data.severity });
      setResult(data);
      playSeveritySound(data.severity);
      
      const newHistoryItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        symptoms: text,
        age,
        gender,
        duration,
        result: data
      };
      const updatedHistory = [newHistoryItem, ...history.slice(0, 9)];
      setHistory(updatedHistory);
      localStorage.setItem('symptom_history', JSON.stringify(updatedHistory));
      
      setCurrentScreen('result');
    } catch (err) {
      console.error(err);
      setError('Failed to analyze symptoms. Please try again.');
    }
  };


  const handleSaveSummary = () => {
    if (!result) return;
    const doc = new jsPDF();
    let y = 20;
    
    doc.setFontSize(20);
    doc.text('SymptomSnap Health Summary', 20, y);
    y += 10;
    
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y);
    y += 10;
    
    doc.setFontSize(14);
    doc.text('Symptoms:', 20, y);
    y += 7;
    doc.setFontSize(12);
    const splitSymptoms = doc.splitTextToSize(symptoms, 170);
    doc.text(splitSymptoms, 20, y);
    y += splitSymptoms.length * 7 + 3;

    doc.setFontSize(14);
    doc.text('Assessment: ' + result.severity.toUpperCase(), 20, y);
    y += 10;

    doc.text('Title: ' + result.title, 20, y);
    y += 10;

    doc.text('Reasoning:', 20, y);
    y += 7;
    doc.setFontSize(12);
    const splitReasoning = doc.splitTextToSize(result.reasoning, 170);
    doc.text(splitReasoning, 20, y);
    y += splitReasoning.length * 7 + 3;

    // Optional pagination check function
    const checkPage = (addedHeight: number) => {
      if (y + addedHeight > 280) {
        doc.addPage();
        y = 20;
      }
    };

    checkPage(20);
    doc.setFontSize(14);
    doc.text('Dos:', 20, y);
    y += 7;
    doc.setFontSize(12);
    result.dos.forEach(d => {
      const splitDo = doc.splitTextToSize(`- ${d}`, 170);
      checkPage(splitDo.length * 7);
      doc.text(splitDo, 20, y);
      y += splitDo.length * 7;
    });
    y += 3;

    checkPage(20);
    doc.setFontSize(14);
    doc.text("Don'ts:", 20, y);
    y += 7;
    doc.setFontSize(12);
    result.donts.forEach(d => {
      const splitDont = doc.splitTextToSize(`- ${d}`, 170);
      checkPage(splitDont.length * 7);
      doc.text(splitDont, 20, y);
      y += splitDont.length * 7;
    });
    y += 3;

    if (result.dietary?.length) {
      checkPage(20);
      doc.setFontSize(14);
      doc.text('Dietary Advice:', 20, y);
      y += 7;
      doc.setFontSize(12);
      result.dietary.forEach(d => {
        const splitDiet = doc.splitTextToSize(`- ${d}`, 170);
        checkPage(splitDiet.length * 7);
        doc.text(splitDiet, 20, y);
        y += splitDiet.length * 7;
      });
    }

    doc.save(`symptomsnap_summary_${Date.now()}.pdf`);
    alert("Summary PDF saved to your device!");
  };

  const handleFollowUp = async () => {
    if (!followUpMsg.trim() || isSendingFollowUp || !result) return;
    
    const userMsg = followUpMsg.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setFollowUpMsg('');
    setIsSendingFollowUp(true);

    try {
      const chatPrompt = `The user is a ${age || 'unknown age'} ${gender || 'unknown gender'}. 
      Initial symptoms were: "${symptoms}". 
      Original triage assessment: ${result.title} (${result.severity} priority).
      Reasoning was: ${result.reasoning}.
      User follow-up question: "${userMsg}".
      Provide a concise, helpful, and professional answer. Avoid definitive diagnoses - maintain your role as a triage aid.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: chatPrompt }] }],
      });

      setChatMessages(prev => [...prev, { role: 'ai', text: response.text || "I'm sorry, I couldn't process that question." }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Sorry, I'm having trouble responding right now. Please try again." }]);
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <AnimatePresence mode="wait">
        {currentScreen === 'splash' && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              <Heart size={100} className="text-medical mb-8 fill-medical/5 stroke-medical stroke-[1px]" />
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-5xl font-extrabold text-slate-800 mb-4 tracking-tight"
              >
                SymptomSnap
              </motion.h1>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: 60 }}
                transition={{ delay: 0.8, duration: 1 }}
                className="h-1 bg-medical/20 mb-6 rounded-full"
              />
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-sm font-medium text-slate-400 tracking-[0.2em] uppercase"
              >
                Precision Triage
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout Component */}
      {currentScreen !== 'splash' && (
        <div className="flex flex-col h-screen overflow-hidden relative">
          
          {/* Settings Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden"
                >
                  <div className="p-8 border-b border-teal-50 flex justify-between items-center bg-teal-50/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-100 rounded-xl">
                        <Settings size={18} className="text-teal-700" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 tracking-tight">Identity & Safety</h3>
                    </div>
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="p-1.5 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-teal-50"
                    >
                      <X size={18} className="text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Liaison Contact</label>
                      <div className="space-y-3">
                        <div className="relative">
                          <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input 
                            type="text"
                            placeholder="Primary Contact Name"
                            value={emergencyContact.name}
                            onChange={(e) => setEmergencyContact(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 focus:border-medical focus:bg-white rounded-xl transition-all font-bold text-xs uppercase tracking-widest text-slate-700 outline-none placeholder:text-slate-300"
                          />
                        </div>
                        <div className="relative">
                          <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input 
                            type="tel"
                            placeholder="Liaison Line"
                            value={emergencyContact.phone}
                            onChange={(e) => setEmergencyContact(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 focus:border-medical focus:bg-white rounded-xl transition-all font-bold text-xs uppercase tracking-widest text-slate-700 outline-none placeholder:text-slate-300"
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-relaxed">
                      Liaison data is encrypted locally. Used strictly for rapid emergency dispatch protocols.
                    </p>

                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full py-4 bg-slate-950 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg"
                    >
                      Confirm Configuration
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Bar */}
          <nav className="h-16 border-b border-teal-50 px-3 sm:px-12 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 bg-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-100">
                <Heart size={18} className="text-white fill-white/20 md:w-5 md:h-5" />
              </div>
              <span className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">SymptomSnap</span>
            </div>
            
            <div className="flex items-center gap-2 md:gap-6">
              <div className="hidden md:flex gap-6 mr-6">
                <button 
                  onClick={() => setCurrentScreen('emergency')}
                  className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${currentScreen === 'emergency' ? 'text-medical font-black' : 'text-slate-400 hover:text-teal-600'}`}
                >
                  Critical Actions
                </button>
                <button 
                  onClick={() => setCurrentScreen('guide')}
                  className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${currentScreen === 'guide' ? 'text-medical font-black' : 'text-slate-400 hover:text-teal-600'}`}
                >
                  Urgency Index
                </button>
              </div>

              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="p-2 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-all"
                title="Symptom History"
              >
                <Activity size={18} />
              </button>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-all"
                title="Emergency Settings"
              >
                <Settings size={18} />
              </button>

              <div className="relative">
                <button 
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-1.5 md:gap-3 text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-600 border border-slate-100 px-3 py-2 md:px-5 md:py-2.5 rounded-full hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
                >
                  {language} <ChevronDown size={12} className={`md:w-3.5 md:h-3.5 transition-transform duration-300 ${isLangOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isLangOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-3 bg-white shadow-2xl rounded-2xl border border-slate-100 overflow-hidden min-w-[160px] z-[210] p-1.5"
                    >
                      {['English', 'Tamil', 'Hindi', 'Telugu'].map(lang => (
                        <button 
                          key={lang}
                          onClick={() => {
                            setLanguage(lang);
                            setIsLangOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                            language === lang ? 'bg-medical text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </nav>

          {/* Screen Content Wrapper */}
          <main ref={mainScrollRef} className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            <AnimatePresence mode="wait">
              {currentScreen === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[1200px] mx-auto p-3 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10"
                >
                  <section className="lg:col-span-8 flex flex-col">
                      <div className="mb-10 text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: 30 }}
                            className="h-1 bg-medical mb-6 rounded-full"
                          />
                          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2 tracking-tight">How are you feeling?</h1>
                          <p className="text-sm md:text-base text-slate-500 font-medium max-w-lg">Describe your concerns. Our clinical AI will perform an instantaneous diagnostic triage.</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex flex-col gap-2 min-w-[120px] md:min-w-[160px]">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Age</label>
                            <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl overflow-hidden h-10 md:h-12">
                              <button 
                                onClick={() => setAge(prev => Math.max(0, (parseInt(prev || '0') || 0) - 1).toString())}
                                className="w-8 md:w-10 h-full flex items-center justify-center text-slate-400 hover:text-medical hover:bg-medical/5 transition-colors"
                              >
                                <Minus size={14} strokeWidth={3} />
                              </button>
                              <input 
                                type="text"
                                inputMode="numeric"
                                placeholder="Age"
                                value={age}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                                  if (val === '') {
                                    setAge('');
                                  } else {
                                    const num = parseInt(val);
                                    setAge(Math.min(num, 120).toString());
                                  }
                                }}
                                className="w-full h-full text-center bg-transparent text-xs md:text-sm font-black text-slate-700 focus:outline-none"
                              />
                              <button 
                                onClick={() => setAge(prev => Math.min(120, (parseInt(prev || '0') || 0) + 1).toString())}
                                className="w-8 md:w-10 h-full flex items-center justify-center text-slate-400 hover:text-medical hover:bg-medical/5 transition-colors"
                              >
                                <Plus size={14} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Gender</label>
                            <div className="flex gap-2">
                              {[
                                { id: 'Male', icon: Mars, label: 'M', activeClass: 'bg-blue-50 border-blue-200 text-blue-600 ring-4 ring-blue-50' },
                                { id: 'Female', icon: Venus, label: 'F', activeClass: 'bg-pink-50 border-pink-200 text-pink-600 ring-4 ring-pink-50' },
                                { id: 'Other', icon: User, label: 'O', activeClass: 'bg-slate-100 border-slate-200 text-slate-600 ring-4 ring-slate-50' }
                              ].map((g) => (
                                <button
                                  key={g.id}
                                  onClick={() => setGender(g.id)}
                                  className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-xl border transition-all ${
                                    gender === g.id 
                                    ? g.activeClass 
                                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                                  }`}
                                >
                                  <g.icon size={16} />
                                  <span className="text-xs font-bold">{g.label}</span>
                                </button>
                              ))}
                            </div>
                      </div>
                    </div>
                      </div>

                    <div className="relative flex flex-col gap-6">
                      <div className="relative group shadow-sm rounded-3xl overflow-hidden">
                        <textarea
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          onFocus={() => symptoms.length > 0 && setShowSuggestions(true)}
                          placeholder="Describe your symptoms (e.g., 'I have a sharp pain in my lower back that started 2 hours ago...')"
                          className="w-full h-[300px] md:h-[400px] p-4 md:p-8 rounded-3xl bg-white border border-slate-200 focus:border-medical focus:ring-4 focus:ring-medical/10 transition-all resize-none text-base md:text-xl leading-relaxed text-slate-700 placeholder:text-slate-300"
                        />

                        {/* Diet Preference Toggle */}
                        <div className="absolute top-8 right-8 flex items-center gap-3">
                          <button
                            onClick={() => setDietPreference(prev => prev === 'global' ? 'indian' : 'global')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                              dietPreference === 'indian' 
                              ? 'bg-amber-50 text-amber-600 border-amber-200' 
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                            title="Toggle Diet Preference (Global/Indian)"
                          >
                            <Apple size={14} className={dietPreference === 'indian' ? 'text-amber-500' : 'text-slate-400'} />
                            {dietPreference === 'indian' ? 'Indian Diet' : 'Global Diet'}
                          </button>
                        </div>
                        
                        <AnimatePresence>
                          {showSuggestions && filteredSuggestions.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-[120] p-4 flex flex-wrap gap-2"
                            >
                              <div className="w-full mb-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suggestions</span>
                              </div>
                              {filteredSuggestions.map((suggestion, i) => (
                                <button 
                                  key={i}
                                  onClick={() => handleSuggestionClick(suggestion)}
                                  className="px-4 py-2 bg-gray-50 hover:bg-primary/10 hover:text-primary rounded-xl text-sm font-bold text-gray-600 transition-all border border-gray-100"
                                >
                                  + {suggestion}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="absolute bottom-8 right-8 flex items-center gap-4">
                          <AnimatePresence>
                            {imagePreview && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.8, x: 20 }}
                                className="relative group/thumb"
                              >
                                <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-medical shadow-lg ring-4 ring-medical/5">
                                  <img src={imagePreview} alt="Symptom preview" className="w-full h-full object-cover" />
                                </div>
                                <button 
                                  onClick={clearImage}
                                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:scale-110 active:scale-90"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-5 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 bg-white text-medical border border-slate-100 hover:border-medical/30 shadow-medical/5"
                            title="Upload symptom photo"
                          >
                            <Camera size={24} />
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            className="hidden" 
                          />

                          {isRecording && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="px-5 py-2 bg-red-100/50 text-red-600 rounded-full text-[10px] font-bold tracking-widest uppercase animate-pulse border border-red-100 shadow-sm"
                            >
                              Listening
                            </motion.div>
                          )}
                          <button 
                            onClick={handleVoiceInput}
                            className={`p-5 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 ${
                              isRecording ? 'bg-red-500 text-white shadow-red-100' : 'bg-medical text-white shadow-medical/20'
                            }`}
                          >
                            <Mic size={24} className={isRecording ? 'animate-pulse' : ''} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 mb-8 p-4 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col gap-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white text-medical rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                              <Calendar size={16} />
                            </div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest text-left">How long have you had these symptoms?</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { id: 'Less than 24 hrs', label: 'Less than 24 hrs' },
                              { id: '1-3 days', label: '1-3 days' },
                              { id: 'More than 3 days', label: 'More than 3 days' }
                            ].map((d) => (
                              <button
                                key={d.id}
                                onClick={() => setDuration(d.id)}
                                className={`py-4 rounded-xl border font-bold text-xs transition-all ${
                                  duration === d.id 
                                  ? 'bg-medical text-white border-medical shadow-lg shadow-medical/10' 
                                  : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleTriage(symptoms)}
                        disabled={!symptoms.trim()}
                        className={`w-full py-6 rounded-2xl font-bold text-lg tracking-tight transition-all shadow-lg ${
                          symptoms.trim() 
                            ? 'bg-medical text-white shadow-medical/10 shadow-xl' 
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                        }`}
                      >
                        Start Clinical Assessment
                      </motion.button>
                    </div>
                  </section>

                  {/* Body Map Sidebar */}
                  <aside className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-white rounded-[32px] border-2 border-gray-50 p-4 md:p-8 shadow-sm flex flex-col h-fit">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex flex-col">
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Pain Location</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-tighter">Click to pinpoint</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <Activity size={18} className="text-gray-400" />
                        </div>
                      </div>
                      
                      <div className="relative flex justify-center py-6 bg-gray-50/50 rounded-3xl mb-8">
                        <svg width="180" height="300" viewBox="0 0 100 150" className="drop-shadow-sm">
                          {/* Base figure background */}
                          <path 
                            d="M50 5 C58 5 65 12 65 20 C65 28 58 35 50 35 C42 35 35 28 35 20 C35 12 42 5 50 5 Z M45 35 L55 35 L55 40 L45 40 Z M35 40 L65 40 L68 65 L65 90 L35 90 L32 65 Z M68 45 L85 75 L80 80 L65 50 Z M32 45 L15 75 L20 80 L35 50 Z M52 90 L65 90 L70 145 L55 145 Z M35 90 L48 90 L45 145 L30 145 Z" 
                            fill="#f1f5f9"
                            stroke="#cbd5e1"
                            strokeWidth="1"
                          />
                          
                            {/* Interactive regions */}
                            {bodyRegions.map((region) => {
                              const severity = activeRegions[region.id];
                              const color = severity === 'red' ? '#fee2e2' : severity === 'yellow' ? '#fef3c7' : severity === 'green' ? '#d1fae5' : 'transparent';
                              const stroke = severity === 'red' ? '#ef4444' : severity === 'yellow' ? '#f59e0b' : severity === 'green' ? '#10b981' : 'transparent';
                              
                              return (
                               <motion.path
                                 key={region.id}
                                 d={region.path}
                                 fill={color}
                                 stroke={stroke}
                                 strokeWidth={severity ? "1" : "0"}
                                 onClick={() => toggleRegion(region.id)}
                                 whileHover={{ fill: severity ? color : '#f1f5f9', opacity: 1 }}
                                 transition={{ duration: 0.2 }}
                                 className="cursor-pointer transition-colors duration-200"
                               />
                             );
                           })}
                         </svg>
                       </div>
 
                       <div className="flex flex-wrap gap-2">
                         {bodyRegions.map(region => {
                           const severity = activeRegions[region.id];
                           const colors = {
                             red: 'bg-red-50 text-red-600 border-red-100',
                             yellow: 'bg-amber-50 text-amber-600 border-amber-100',
                             green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                             none: 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                           };
                           const activeClass = severity ? colors[severity] : colors.none;
                           
                           return (
                             <button
                               key={region.id}
                               onClick={() => toggleRegion(region.id)}
                               className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${activeClass} ${severity ? 'shadow-sm' : ''}`}
                             >
                               {region.name} {severity ? `(${severity})` : ''}
                             </button>
                           );
                         })}
                       </div>
                       
                       <div className="mt-6 pt-6 border-t border-gray-50">
                         <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                           <span>Pain Scale Key (Click multiple times)</span>
                         </div>
                         <div className="flex gap-4 mt-3">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-md bg-emerald-50 border border-emerald-100" />
                             <span className="text-[9px] font-bold text-emerald-600">Mild</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-md bg-amber-50 border border-amber-100" />
                             <span className="text-[9px] font-bold text-amber-600">Urgent</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-md bg-red-50 border border-red-100" />
                             <span className="text-[9px] font-bold text-red-600">Critical</span>
                           </div>
                         </div>
                       </div>
                    </div>
                  </aside>
                </motion.div>
              )}

              {currentScreen === 'loading' && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="max-w-[800px] mx-auto min-h-[500px] flex flex-col items-center justify-center p-8 text-center"
                >
                  {error ? (
                    <div className="flex flex-col items-center gap-8">
                      <div className="w-24 h-24 bg-brand-red/10 rounded-3xl flex items-center justify-center">
                        <AlertCircle size={48} className="text-brand-red" />
                      </div>
                      <div className="max-w-md">
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Analysis Failed</h3>
                        <p className="text-lg text-gray-500 leading-relaxed">{error}</p>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => handleTriage(symptoms)}
                          className="flex items-center gap-2 px-10 py-4 bg-medical rounded-xl text-white font-bold hover:shadow-brand transition-all"
                        >
                          <RefreshCcw size={20} /> Retry Now
                        </button>
                        <button 
                          onClick={() => setCurrentScreen('home')}
                          className="px-10 py-4 bg-gray-50 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-all"
                        >
                          Go Back
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="relative mb-12">
                        <div className="absolute inset-0 bg-medical/10 rounded-full blur-[40px] opacity-60 animate-pulse" />
                        <Loader2 size={100} className="text-medical animate-spin relative" />
                      </div>
                      <h3 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Analyzing Symptoms</h3>
                      <p className="text-xl text-gray-500 max-w-md">Our MedGemma AI engine is reviewing your clinical description...</p>
                    </div>
                  )}
                </motion.div>
              )}

              {currentScreen === 'result' && result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-[1000px] mx-auto p-3 sm:p-10 flex flex-col items-center"
                >
                  <div className="w-full flex items-center mb-10">
                    <button 
                      onClick={() => setCurrentScreen('home')}
                      className="group flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-medical transition-all py-3 px-5 rounded-xl bg-white border border-slate-100 shadow-sm"
                    >
                      <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> New Session
                    </button>
                  </div>

                  <div className={`w-full rounded-[40px] p-1 mb-12 overflow-hidden shadow-sm border border-slate-100 ${
                    result.severity === 'red' ? 'bg-brand-red' : 
                    result.severity === 'yellow' ? 'bg-brand-orange' : 'bg-brand-green'
                  }`}>
                    <div className="bg-white rounded-[38px] p-5 md:p-14 flex flex-col items-center">
                      <div className="w-full flex flex-col md:flex-row gap-8 items-start md:items-center mb-12">
                        <motion.div 
                          initial={{ y: -20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className={`shrink-0 p-6 rounded-[32px] border-8 shadow-sm ${
                            result.severity === 'red' ? 'border-red-50 text-brand-red bg-red-50/10' : 
                            result.severity === 'yellow' ? 'border-amber-50 text-brand-orange bg-amber-50/10' : 'border-green-50 text-brand-green bg-green-50/10'
                          }`}
                        >
                          {result.severity === 'red' && <AlertCircle size={64} strokeWidth={2} />}
                          {result.severity === 'yellow' && <AlertTriangle size={64} strokeWidth={2} />}
                          {result.severity === 'green' && <CheckCircle2 size={64} strokeWidth={2} />}
                        </motion.div>
                        
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black uppercase tracking-[0.3em] mb-3 ${
                            result.severity === 'red' ? 'text-brand-red' : 
                            result.severity === 'yellow' ? 'text-brand-orange' : 'text-brand-green'
                          }`}>
                            Protocol: {result.severity.toUpperCase()}
                          </span>
                          <h2 className={`text-xl md:text-5xl font-extrabold leading-tight tracking-tight ${
                            result.severity === 'red' ? 'text-red-900' : 
                            result.severity === 'yellow' ? 'text-amber-900' : 'text-green-900'
                          }`}>
                            {result.severity === 'red' ? "Immediate Clinical Care" : 
                             result.severity === 'yellow' ? "Physician Consultation" : "Home-Based Recovery"}
                          </h2>
                        </div>
                      </div>

                      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-12">
                          {result.severity === 'red' && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="w-full p-4 md:p-8 bg-red-600 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-8 mb-6 shadow-xl shadow-red-200"
                            >
                              <div className="flex items-center gap-6 text-left text-white">
                                <div className="p-3 md:p-4 bg-white/20 text-white rounded-2xl">
                                  <Phone size={24} className="md:w-8 md:h-8" strokeWidth={3} />
                                </div>
                                <div className="flex flex-col text-left">
                                  <h4 className="text-lg md:text-2xl font-black uppercase tracking-tight text-white leading-tight">Immediate Assistance</h4>
                                  <p className="text-[10px] md:text-sm font-bold opacity-80 uppercase tracking-widest text-white">Medical Emergency Services</p>
                                </div>
                              </div>
                              <a 
                                href="tel:108"
                                className="w-full md:w-auto px-8 md:px-12 py-4 md:py-6 bg-white text-red-600 rounded-2xl font-black text-xl md:text-2xl shadow-lg hover:bg-red-50 transition-all flex items-center justify-center gap-4"
                              >
                                <Phone size={20} className="md:w-6 md:h-6" /> CALL 108
                              </a>
                            </motion.div>
                          )}

                          {emergencyContact.name && emergencyContact.phone && result.severity === 'red' && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="w-full p-8 bg-red-50 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-8 border border-red-100"
                            >
                              <div className="flex items-center gap-6 text-left">
                                <div className="p-4 bg-red-500 text-white rounded-2xl shadow-lg ring-4 ring-red-100 animate-pulse">
                                  <Phone size={28} />
                                </div>
                                <div className="flex flex-col">
                                  <h4 className="text-xl font-bold text-red-900">Emergency Contact</h4>
                                  <p className="text-xs text-red-600 font-bold uppercase tracking-widest mt-1">Notify: {emergencyContact.name}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 w-full md:w-auto">
                                <a 
                                  href={`tel:${emergencyContact.phone}`}
                                  className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-red-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg"
                                >
                                  <Phone size={18} /> Initiate Call
                                </a>
                              </div>
                            </motion.div>
                          )}

                          {result && parseInt(age || '99') < 12 && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="w-full mt-8"
                            >
                              <button 
                                onClick={() => window.open(`https://www.google.com/maps/search/children's+hospital+near+me/`, '_blank')}
                                className="w-full p-6 md:p-8 bg-emerald-500 text-white rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 shadow-2xl shadow-emerald-500/30 hover:scale-[1.01] transition-all group"
                              >
                                <div className="flex items-center gap-4 md:gap-6 text-left">
                                  <div className="p-3 md:p-4 bg-white/20 text-white rounded-2xl">
                                    <Hospital size={24} className="md:w-8 md:h-8" />
                                  </div>
                                  <div className="flex flex-col">
                                    <h4 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white leading-none">Pediatric Care Found</h4>
                                    <p className="text-xs md:text-sm font-bold opacity-80 uppercase tracking-widest text-white mt-1">Specialized Children's Centers</p>
                                  </div>
                                </div>
                                <div className="w-full md:w-auto px-8 md:px-10 py-4 md:py-5 bg-white text-emerald-600 rounded-2xl font-black text-base md:text-lg shadow-lg group-hover:bg-emerald-50 transition-all flex items-center justify-center gap-3">
                                  Locate Hospital <Navigation2 size={18} className="md:w-5 md:h-5" />
                                </div>
                              </button>
                            </motion.div>
                          )}
                        </div>

                        <div className="lg:col-span-7">
                          <div className="text-left bg-slate-50/50 p-4 md:p-8 rounded-[32px] border border-slate-100">
                            <div className="flex items-center gap-3 mb-4 md:mb-6">
                              <div className="w-1 h-4 md:h-5 bg-teal-600 rounded-full" />
                              <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Analysis Summary</h3>
                            </div>
                            <p className="text-slate-700 text-sm md:text-xl leading-relaxed font-medium">
                              {result.reasoning}
                            </p>
                          </div>
                        </div>

                        <div className="lg:col-span-5 flex flex-col gap-6">
                          {result.severity !== 'red' && (
                            <div className="flex flex-col gap-8">
                              <div className="flex flex-col gap-3">
                                <h4 className="text-[10px] font-black text-brand-green uppercase tracking-[0.2em] flex items-center gap-2">
                                   <div className="w-1 h-3 bg-brand-green rounded-full" /> Recommended Actions
                                </h4>
                                <div className="grid grid-cols-1 lg:flex lg:flex-col gap-2">
                                  {result.dos.map((item, i) => (
                                    <div key={i} className="flex items-start gap-2 p-2 md:p-3 bg-green-50/30 rounded-xl border border-green-100/50">
                                      <CheckCircle2 size={12} className="text-brand-green shrink-0 mt-0.5" />
                                      <span className="text-[10px] md:text-xs font-bold text-slate-700 leading-tight line-clamp-2">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col gap-3">
                                <h4 className="text-[10px] font-black text-brand-red uppercase tracking-[0.2em] flex items-center gap-2">
                                   <div className="w-1 h-3 bg-brand-red rounded-full" /> Mitigation Strategies
                                </h4>
                                <div className="grid grid-cols-1 lg:flex lg:flex-col gap-2">
                                  {result.donts.map((item, i) => (
                                    <div key={i} className="flex items-start gap-2 p-2 md:p-3 bg-red-50/30 rounded-xl border border-red-100/50">
                                      <AlertCircle size={12} className="text-brand-red shrink-0 mt-0.5" />
                                      <span className="text-[10px] md:text-xs font-bold text-slate-700 leading-tight line-clamp-2">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {result.dietary && result.dietary.length > 0 && 
                         (symptoms.toLowerCase().match(/abdomen|abdominal|stomach|belly|tummy|digestive|gut|abs/) || activeRegions['abdomen']) && (
                          <div className="lg:col-span-12">
                            <div className="flex flex-col gap-4 p-4 md:p-8 bg-amber-50/30 rounded-[32px] border border-amber-100 border-dashed">
                              <h4 className="text-[9px] md:text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] flex items-center gap-3 justify-center">
                                 <Apple size={16} /> Supportive Nutrition
                              </h4>
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                                {result.dietary.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-amber-50 shadow-sm">
                                    <div className="p-1.5 bg-amber-50 rounded-lg shrink-0">
                                      <Apple size={14} className="text-amber-500" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-700 leading-tight line-clamp-1">{item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="lg:col-span-12 mt-12 pt-12 border-t border-slate-50">
                          <div className="flex flex-col gap-8">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-50 text-medical rounded-xl flex items-center justify-center">
                                <MessageSquare size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">Follow-up Consultation</h4>
                                <p className="text-[8px] md:text-xs text-slate-400 font-bold uppercase tracking-widest">Ask our AI any clarifying questions</p>
                              </div>
                            </div>

                            <div className="flex flex-col gap-4 max-h-[250px] md:max-h-[400px] overflow-y-auto custom-scrollbar p-3 md:p-4 bg-slate-50/50 rounded-3xl border border-slate-100">
                              {chatMessages.length === 0 && (
                                <div className="text-center py-6">
                                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">No questions asked yet</p>
                                </div>
                              )}
                              {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[90%] md:max-w-[85%] p-3 md:p-5 rounded-2xl text-xs md:text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                    ? 'bg-medical text-white font-medium rounded-br-none shadow-md' 
                                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none shadow-sm'
                                  }`}>
                                    {msg.text}
                                  </div>
                                </div>
                              ))}
                              {isSendingFollowUp && (
                                <div className="flex justify-start">
                                  <div className="bg-white border border-slate-100 p-3 md:p-5 rounded-2xl rounded-bl-none flex items-center gap-2 md:gap-3">
                                    <div className="flex gap-1">
                                      <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-medical/40 rounded-full animate-bounce" />
                                      <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-medical/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                                      <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-medical/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                                    </div>
                                    <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">typing</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <input 
                                type="text"
                                value={followUpMsg}
                                onChange={(e) => setFollowUpMsg(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                                placeholder="Any follow-up questions?"
                                className="flex-1 px-4 py-3 md:px-8 md:py-5 rounded-xl md:rounded-2xl bg-white border border-slate-200 focus:border-medical focus:ring-4 focus:ring-medical/5 transition-all text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-300"
                              />
                              <button 
                                onClick={handleFollowUp}
                                disabled={!followUpMsg.trim() || isSendingFollowUp}
                                className={`px-4 md:px-8 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${
                                  followUpMsg.trim() && !isSendingFollowUp
                                  ? 'bg-medical text-white shadow-xl shadow-medical/10' 
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {isSendingFollowUp ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Send"}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-12 mt-8">
                          <button 
                            onClick={handleSaveSummary}
                            className="w-full py-6 bg-white text-slate-900 rounded-2xl font-bold text-lg uppercase tracking-tight flex items-center justify-center gap-3 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                          >
                            Download Report
                          </button>
                        </div>

                        <div className="lg:col-span-12 mt-10">
                          <div className="bg-slate-50 border border-slate-100 rounded-[40px] p-4 md:p-12">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
                              <div>
                                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-4">
                                  <div className="w-2 h-8 bg-medical rounded-full" />
                                  Nearby Medical Centers
                                </h3>
                                <p className="text-slate-400 font-bold mt-2 text-xs uppercase tracking-[0.2em] pl-6">
                                  Verified facilities within your immediate response radius
                                </p>
                              </div>
                              <button 
                                onClick={() => setCurrentScreen('map')}
                                className="px-6 py-3 bg-medical text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 transition-all shadow-xl shadow-medical/20 flex items-center gap-3"
                              >
                                <MapPin size={18} /> OPEN INTERACTIVE MAP
                              </button>
                            </div>

                            {!userLocation ? (
                              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-6 text-center flex flex-col items-center">
                                {isLocating ? (
                                  <div className="flex flex-col items-center gap-8 py-6">
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                      {/* Radar Ripple Effect */}
                                      {[1, 2, 3].map((i) => (
                                        <motion.div
                                          key={i}
                                          initial={{ scale: 0.5, opacity: 1 }}
                                          animate={{ scale: 2.5, opacity: 0 }}
                                          transition={{ 
                                            repeat: Infinity, 
                                            duration: 2, 
                                            delay: (i - 1) * 0.6,
                                            ease: "easeOut" 
                                          }}
                                          className="absolute inset-0 rounded-full bg-medical/10 border border-medical/20"
                                        />
                                      ))}
                                      {/* Core pulse */}
                                      <motion.div
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                        className="relative z-10 w-16 h-16 bg-medical rounded-2xl shadow-xl shadow-medical/30 flex items-center justify-center"
                                      >
                                        <Satellite size={32} className="text-white animate-bounce" />
                                      </motion.div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                      <h4 className="text-medical font-black text-sm uppercase tracking-widest animate-pulse">Establishing Satellite Uplink</h4>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Resolving Global Coordinates...</p>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="p-3 bg-slate-50 rounded-2xl w-fit mx-auto mb-4">
                                      <MapPin size={32} className="text-slate-300" />
                                    </div>
                                    <h4 className="text-slate-700 font-bold text-base mb-1">Location Required</h4>
                                    <p className="text-slate-400 text-xs mb-6 max-w-md mx-auto">We need your GPS coordinates to find the fastest medical routes. Enable location for a live facility map.</p>
                                    <button 
                                      onClick={getUserLocation}
                                      className="px-10 py-4 bg-medical text-white rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-lg transition-all"
                                    >
                                      Enable GPS Location
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : isLoadingClinics ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className="h-40 bg-white rounded-3xl border border-slate-100 shadow-sm" />
                                ))}
                              </div>
                            ) : nearbyClinics.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {nearbyClinics.slice(0, 4).map((clinic) => (
                                  <motion.div
                                    key={clinic.id}
                                    whileHover={{ y: -5 }}
                                    className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="px-1.5 py-0.5 bg-slate-50 rounded text-medical font-bold text-[8px] uppercase tracking-widest">
                                        {clinic.distanceVal.toFixed(1)} km
                                      </div>
                                      <Hospital size={14} className="text-slate-200" />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-bold text-slate-800 text-[10px] mb-0.5 line-clamp-1">{clinic.name}</h4>
                                      <p className="text-[8px] text-slate-400 font-medium line-clamp-1">{clinic.addr}</p>
                                    </div>
                                    <button 
                                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}`)}
                                      className="mt-1 text-medical font-black text-[8px] uppercase tracking-[0.1em] hover:opacity-70 flex items-center gap-1"
                                    >
                                      Go <Navigation size={8} />
                                    </button>
                                  </motion.div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">No facilities detected in 25km radius</p>
                                <button 
                                  onClick={() => fetchClinics(userLocation.lat, userLocation.lng)}
                                  className="mt-6 text-medical font-black text-xs uppercase tracking-widest hover:underline"
                                >
                                  Retry System Scan
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="lg:col-span-12 mt-16 p-8 bg-teal-50/30 border border-teal-100/50 rounded-[32px] shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                            <ShieldAlert size={120} className="text-teal-900" />
                          </div>
                          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                            <div className="p-4 bg-white rounded-2xl text-teal-500/50 shrink-0 shadow-sm border border-teal-50">
                              <ShieldAlert size={24} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <h5 className="text-xs font-black text-teal-600/50 uppercase tracking-[0.2em]">Medical Disclaimer</h5>
                              <p className="text-[13px] text-slate-500 font-medium leading-relaxed max-w-2xl">
                                This triage report is generated by AI for educational purposes only. It is <span className="text-slate-900 font-bold">not a medical diagnosis</span>, clinical advice, or a substitute for professional judgement. If you are experiencing a life-threatening emergency, call your local emergency services immediately.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentScreen === 'map' && (
                <motion.div
                  key="map"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col bg-gray-25"
                >
                  <div className="w-full max-w-[1200px] mx-auto p-3 md:p-8 flex flex-col gap-6 md:gap-8 pb-20">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <button 
                        onClick={() => setCurrentScreen('result')}
                        className="w-full sm:w-auto flex items-center justify-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-100"
                      >
                        <ArrowLeft size={16} /> Analysis Report
                      </button>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            if (userLocation) {
                              fetchClinics(userLocation.lat, userLocation.lng);
                            }
                          }}
                          className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-medical rounded-2xl transition-all shadow-sm"
                          title="Refresh nearby facilities"
                        >
                          <RefreshCcw size={20} className={isLoadingClinics ? 'animate-spin' : ''} />
                        </button>
                        <div className="bg-medical/10 text-medical px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-medical/5 shadow-sm">
                          {nearbyClinics.length} Facilities Found
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-8">
                      <div className="w-full h-[300px] sm:h-[400px] relative bg-slate-50 overflow-hidden rounded-[40px] border border-slate-100 shadow-xl">
                        <MapContainer 
                          center={userLocation ? [userLocation.lat, userLocation.lng] : [13.0827, 80.2707]} 
                          zoom={13} 
                          style={{ height: '100%', width: '100%', zIndex: 1 }}
                          zoomControl={true}
                          scrollWheelZoom={true}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          {userLocation && (
                            <>
                              <ChangeView center={[userLocation.lat, userLocation.lng]} />
                              <Marker position={[userLocation.lat, userLocation.lng]}>
                                <Popup>
                                  <div className="font-bold">Patient Location</div>
                                </Popup>
                              </Marker>
                            </>
                          )}

                          {nearbyClinics.map(c => (
                            <Marker key={c.id} position={[c.lat, c.lng]} icon={RedIcon}>
                              <Tooltip direction="top" offset={[0, -32]} opacity={1}>
                                <div className="p-1 px-2">
                                  <div className="font-bold text-slate-800">{c.name}</div>
                                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{c.type}</div>
                                </div>
                              </Tooltip>
                              <Popup>
                                <div className="p-2 min-w-[200px]">
                                  <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2">{c.name}</div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-3 bg-slate-50 px-2 py-1 rounded">
                                    <MapPin size={10} /> {c.addr}
                                  </div>
                                  
                                  {c.phone && (
                                    <div className="flex items-center gap-2 text-[11px] text-medical mb-2">
                                      <PhoneCall size={12} /> {c.phone}
                                    </div>
                                  )}
                                  
                                  {c.openingHours && (
                                    <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-3">
                                      <Clock size={12} /> {c.openingHours}
                                    </div>
                                  )}

                                  <button 
                                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`)}
                                    className="w-full mt-2 py-2.5 bg-medical text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-teal-700 transition-all shadow-sm"
                                  >
                                    Get Directions
                                  </button>
                                </div>
                              </Popup>
                            </Marker>
                          ))}
                        </MapContainer>
                      </div>

                      <div className="lg:col-span-12 flex flex-col">
                        <div className="mb-8">
                          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-4 uppercase">
                            <div className="w-1.5 h-6 bg-medical rounded-full" />
                            Recommended Care Facilities
                          </h2>
                          <p className="text-slate-400 font-bold mt-2 text-xs uppercase tracking-widest pl-5">
                            {userLocation 
                              ? `Geographically optimized medical services (10km radius)` 
                              : 'Resolving satellite coordinates...'}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {isLoadingClinics ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300 gap-6 bg-slate-50/30 rounded-[32px] border border-slate-50">
                              <Loader2 size={48} className="animate-spin text-medical/30" />
                              <span className="font-black uppercase tracking-[0.3em] text-[11px]">System: Scanning Network Facilities</span>
                            </div>
                          ) : nearbyClinics.length > 0 ? (
                            nearbyClinics.map((clinic) => (
                              <motion.button
                                key={clinic.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.name + ' ' + clinic.addr)}`)}
                                className="group flex flex-col p-4 md:p-8 rounded-[32px] border border-slate-100 bg-white hover:border-medical/30 hover:shadow-2xl hover:shadow-medical/5 transition-all text-left shadow-sm"
                              >
                                <div className="flex justify-between items-start mb-8">
                                  <div className="p-4 bg-slate-50 group-hover:bg-medical/10 rounded-2xl transition-colors">
                                    <Hospital size={28} className="text-slate-400 group-hover:text-medical transition-colors" />
                                  </div>
                                  <div className="bg-slate-50 group-hover:bg-medical/10 px-4 py-2 rounded-full transition-colors">
                                    <span className="text-[10px] font-black text-slate-400 group-hover:text-medical uppercase tracking-widest">
                                      {clinic.distanceVal.toFixed(1)} km
                                    </span>
                                  </div>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2 leading-tight group-hover:text-medical transition-colors">{clinic.name}</h3>
                                <p className="text-sm text-slate-400 mb-4 font-medium line-clamp-2">{clinic.addr}</p>
                                
                                <div className="flex flex-col gap-2 mb-8">
                                  {clinic.phone && (
                                    <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
                                      <div className="p-1.5 bg-slate-50 rounded-lg text-medical">
                                        <PhoneCall size={14} />
                                      </div>
                                      {clinic.phone}
                                    </div>
                                  )}
                                  {clinic.openingHours && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                      <div className="p-1.5 bg-slate-50 rounded-lg">
                                        <Clock size={14} />
                                      </div>
                                      <span className="line-clamp-1">{clinic.openingHours}</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center justify-between mt-auto pt-8 border-t border-slate-50">
                                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{clinic.type}</span>
                                  <div className="p-2 bg-slate-50 group-hover:bg-medical text-slate-400 group-hover:text-white rounded-xl transition-all">
                                    <Navigation size={18} />
                                  </div>
                                </div>
                              </motion.button>
                            ))
                          ) : (
                            <div className="col-span-full text-center py-20 bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200">
                              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <Hospital size={32} className="text-slate-200" />
                              </div>
                              <p className="text-base text-slate-400 font-bold uppercase tracking-widest">No specialized facilities detected nearby</p>
                              <p className="text-xs text-slate-300 mt-2">Adjust your location settings or broaden your search.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              {currentScreen === 'emergency' && (
                <motion.div
                  key="emergency"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-[1200px] mx-auto p-3 md:p-10"
                >
                  <button 
                    onClick={() => setCurrentScreen('home')}
                    className="group flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-medical transition-all mb-12"
                  >
                    <ArrowLeft size={16} /> Back to Triage
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="md:col-span-2 lg:col-span-3 bg-red-50 border-2 border-red-100 p-4 md:p-8 rounded-[32px] flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-red-900 mb-2 uppercase tracking-tight">Active Life Threat?</h2>
                        <p className="text-red-700 font-bold text-sm uppercase tracking-widest opacity-80">Immediate Professional Intervention Required</p>
                      </div>
                      <a href="tel:108" className="bg-red-600 text-white px-10 py-5 rounded-2xl font-black text-xl flex items-center gap-3 shadow-xl shadow-red-200 hover:bg-red-700 transition-all">
                        <Phone size={24} /> CALL 108
                      </a>
                    </div>

                    {[
                      { title: 'Cardiac Arrest', steps: ['Check Responsiveness', 'Call for AED', 'Start Continuous Compressions', 'Fast and Deep (100-120 bpm)'], icon: <Activity className="text-red-500" /> },
                      { title: 'Choking (Adult)', steps: ['Identify "Universal Sign"', 'Five Back Blows', 'Five Abdominal Thrusts', 'Repeat until object cleared'], icon: <AlertCircle className="text-red-500" /> },
                      { title: 'Severe Bleeding', steps: ['Apply Direct Pressure', 'Do Not Remove Original Bandage', 'Elevate Wound Higher than Heart', 'Use Tourniquet if uncontrolled'], icon: <X className="text-red-500" /> },
                      { title: 'Overdose', steps: ['Check Airway', 'Look for pinpoint pupils', 'Administer Narcan if available', 'Rescue breathing if necessary'], icon: <MessageSquare className="text-red-500" /> },
                      { title: 'Severe Burn', steps: ['Remove from Heat Source', 'Cool with Cool (not cold) Water', 'Remove tight jewelry', 'Cover with sterile nonstick pad'], icon: <AlertTriangle className="text-red-500" /> },
                      { title: 'Seizure', steps: ['Clear immediate area', 'Protect Head with padding', 'Turn onto side (Recovery position)', 'Time the duration'], icon: <Navigation className="text-red-500" /> }
                    ].map((item, idx) => (
                      <div key={idx} className="bg-white border border-slate-100 p-4 md:p-8 rounded-[32px] shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="p-3 bg-slate-50 rounded-2xl">
                            {item.icon}
                          </div>
                          <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">{item.title}</h3>
                        </div>
                        <div className="space-y-4">
                          {item.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex gap-4">
                              <span className="text-red-600 font-black text-xs shrink-0">{sIdx + 1}</span>
                              <p className="text-sm text-slate-500 font-medium">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentScreen === 'guide' && (
                <motion.div
                  key="guide"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="max-w-[1200px] mx-auto p-3 md:p-10"
                >
                  <button 
                    onClick={() => setCurrentScreen('home')}
                    className="group flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-medical transition-all mb-12"
                  >
                    <ArrowLeft size={16} /> Back to Triage
                  </button>

                  <div className="mb-16 text-center max-w-2xl mx-auto">
                    <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Understanding Severity</h2>
                    <p className="text-lg text-slate-500 font-medium">Not all pain requires a hospital. Use this guide to understand the color-coded triage levels used by SymptomSnap.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    {/* GREEN SECTION */}
                    <div className="bg-emerald-50 border border-emerald-100 p-4 md:p-8 rounded-[40px] flex flex-col">
                      <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-200">
                        <CheckCircle2 size={32} className="text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-emerald-900 mb-4 uppercase tracking-tight">MILD (GREEN)</h3>
                      <p className="text-emerald-700/80 font-bold text-sm mb-8 leading-relaxed italic">"Manageable discomfort usually treatable at home."</p>
                      <ul className="space-y-4 mb-10">
                        {['Common cold/sore throat', 'Light aches or soreness (level 1-3)', 'Minor scrapes and bruises', 'Seasonal allergy symptoms'].map((item, i) => (
                          <li key={i} className="flex gap-3 items-start">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-1" />
                            <span className="text-sm text-emerald-900 font-medium">{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-6 border-t border-emerald-200/50">
                        <p className="text-xs font-black text-emerald-600 uppercase tracking-widest text-center">HOME CARE & MONITORING</p>
                      </div>
                    </div>

                    {/* YELLOW SECTION */}
                    <div className="bg-amber-50 border border-amber-100 p-4 md:p-8 rounded-[40px] flex flex-col">
                      <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-amber-200">
                        <AlertTriangle size={32} className="text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-amber-900 mb-4 uppercase tracking-tight">URGENT (YELLOW)</h3>
                      <p className="text-amber-700/80 font-bold text-sm mb-8 leading-relaxed italic">"Significant pain or illness requiring professional review."</p>
                      <ul className="space-y-4 mb-10">
                        {['Persistent high fever', 'Moderate pain (level 4-7)', 'Minor fractures or sprains', 'Deep cuts needing stitches'].map((item, i) => (
                          <li key={i} className="flex gap-3 items-start">
                            <Activity size={16} className="text-amber-600 shrink-0 mt-1" />
                            <span className="text-sm text-amber-900 font-medium">{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-6 border-t border-amber-200/50">
                        <p className="text-xs font-black text-amber-600 uppercase tracking-widest text-center">SEE A DOCTOR WITHIN 24H</p>
                      </div>
                    </div>

                    {/* RED SECTION */}
                    <div className="bg-red-50 border border-red-100 p-4 md:p-8 rounded-[40px] flex flex-col">
                      <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-red-200">
                        <AlertCircle size={32} className="text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-red-900 mb-4 uppercase tracking-tight">CRITICAL (RED)</h3>
                      <p className="text-red-700/80 font-bold text-sm mb-8 leading-relaxed italic">"Immediate life threat or permanent damage risk."</p>
                      <ul className="space-y-4 mb-10">
                        {['Crushing chest pain', 'Sudden confusion/slurred speech', 'Difficulty breathing', 'Severe, uncontrolled bleeding'].map((item, i) => (
                          <li key={i} className="flex gap-3 items-start">
                            <X size={16} className="text-red-600 shrink-0 mt-1" />
                            <span className="text-sm text-red-900 font-medium">{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-6 border-t border-red-200/50">
                        <p className="text-xs font-black text-red-600 uppercase tracking-widest text-center">GO TO HOSPITAL IMMEDIATELY</p>
                      </div>
                    </div>
                  </div>


                </motion.div>
              )}

              {currentScreen === 'portal' && (
                <motion.div
                  key="portal"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="max-w-[500px] mx-auto p-6 md:p-12 mt-20 bg-white border border-slate-100 rounded-[48px] shadow-2xl flex flex-col items-center text-center"
                >
                  <div className="p-6 bg-medical/10 rounded-3xl mb-8">
                    <Hospital size={48} className="text-medical" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight uppercase">Provider Terminal</h2>
                  <p className="text-slate-500 font-medium mb-10">Access clinical dashboards and real-time triage routing.</p>
                  
                  <div className="w-full space-y-4 mb-10">
                    <input 
                      type="text" 
                      placeholder="Access Token / DEA ID" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none focus:border-medical transition-all"
                    />
                    <input 
                      type="password" 
                      placeholder="Security Passphrase" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none focus:border-medical transition-all"
                    />
                  </div>

                  <button className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all mb-6">
                    Connect to Network
                  </button>
                  
                  <button 
                    onClick={() => setCurrentScreen('home')}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-medical transition-colors"
                  >
                    Return to Patient Triage
                  </button>

                  <div className="mt-12 pt-8 border-t border-slate-50 w-full">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Enterprise Edition • MedGemma v2.4</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isHistoryOpen && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex justify-end"
                  onClick={() => setIsHistoryOpen(false)}
                >
                  <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 text-medical rounded-lg">
                          <Activity size={20} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Health History</h3>
                      </div>
                      <button 
                        onClick={() => setIsHistoryOpen(false)}
                        className="p-2 text-slate-300 hover:text-slate-500 rounded-full hover:bg-slate-50 transition-all"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                      {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-2xl flex items-center justify-center mb-6">
                            <Activity size={32} />
                          </div>
                          <h4 className="text-slate-700 font-bold mb-2">No Reports Found</h4>
                          <p className="text-slate-400 text-sm max-w-[200px]">Your diagnostic history will appear here once you complete a triage session.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {history.map((item: any) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setResult(item.result);
                                setSymptoms(item.symptoms);
                                setAge(item.age);
                                setGender(item.gender);
                                setDuration(item.duration || '');
                                setChatMessages([]);
                                setCurrentScreen('result');
                                setIsHistoryOpen(false);
                              }}
                              className="w-full text-left p-6 rounded-2xl border border-slate-100 bg-white hover:border-medical/30 hover:shadow-lg transition-all group"
                            >
                              <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-medical">
                                  {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${
                                  item.result.severity === 'red' ? 'bg-red-500' : 
                                  item.result.severity === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                              </div>
                              <h4 className="text-slate-800 font-bold mb-2 line-clamp-1">{item.result.title}</h4>
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.symptoms}</p>
                            </button>
                          ))}
                          
                          <div className="flex flex-col gap-2 mt-6">
                            {isConfirmingClear ? (
                              <div className="flex flex-col gap-2 p-4 bg-red-50 rounded-2xl border border-red-100">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest text-center">Are you absolutely sure?</p>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => {
                                      setHistory([]);
                                      localStorage.removeItem('symptom_history');
                                      setIsConfirmingClear(false);
                                    }}
                                    className="flex-1 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all"
                                  >
                                    Yes, Clear
                                  </button>
                                  <button 
                                    onClick={() => setIsConfirmingClear(false)}
                                    className="flex-1 py-3 bg-white text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-50 transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setIsConfirmingClear(true)}
                                className="py-4 text-xs font-bold text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest text-center w-full"
                              >
                                Clear All History
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <footer className="h-14 border-t border-gray-100 px-6 sm:px-10 flex items-center justify-between bg-white text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-300 shrink-0">
            <span>&copy; 2026 SymptomSnap AI • Emergency Index 4.2</span>
            <div className="hidden sm:flex items-center gap-6">
              <button className="hover:text-primary transition-colors">HIPAA Compliance</button>
              <button className="hover:text-primary transition-colors">Privacy Information</button>
              <button className="hover:text-primary transition-colors">Terms of Service</button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
