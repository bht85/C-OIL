/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, deleteDoc, query } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Settings, 
  Fuel, 
  Car, 
  Calculator,
  ChevronRight,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  MapPin,
  FileText,
  UserCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

// --- Safe Configuration Handling ---
// We try to get values from globals, but provide meaningful fallbacks for local dev
const getSafeGlobal = (key, fallback) => {
  try {
    return typeof window !== 'undefined' && window[key] ? window[key] : fallback;
  } catch (e) {
    return fallback;
  }
};

const rawConfig = getSafeGlobal('__firebase_config', null);
const firebaseConfig = rawConfig ? (typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig) : {
  apiKey: "AIzaSyANXx1Wj4EGnwWsF8W2CrkC1pzojXXusA8",
  authDomain: "c-oil-b880b.firebaseapp.com",
  projectId: "c-oil-b880b",
  storageBucket: "c-oil-b880b.firebasestorage.app",
  messagingSenderId: "185616673355",
  appId: "1:185616673355:web:1b01544ed887d766cf3bce"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = getSafeGlobal('__app_id', 'vehicle-fuel-tracker');
const initialToken = getSafeGlobal('__initial_auth_token', null);

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'log', 'history', 'settings', 'profile'
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState({
    homeAddress: '',
    homeAlias: '우리집',
    homeLat: 37.5665,
    homeLng: 126.9780,
    vehicleName: '',
    fuelType: 'gasoline',
    savedLocations: [] // [{id, name, address, lat, lng}]
  });
  const [fuelRates, setFuelRates] = useState({
    gasoline: { unitPrice: 229.55, avgPrice: 1836.41 },
    diesel: { unitPrice: 228.62, avgPrice: 1828.92 },
    lpg: { unitPrice: 101.17, avgPrice: 1011.67 },
    depreciation: 10
  });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);

  // Authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (initialToken) {
          await signInWithCustomToken(auth, initialToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
        // Fallback for development if Firebase fails
        if (!rawConfig) {
          setUser({ uid: 'dev-user', isAnonymous: true });
          setLoading(false);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user || user.uid === 'dev-user') {
      if (user?.uid === 'dev-user' && logs.length === 0) {
        // Mock data for dev
        setLogs([
          { id: '1', date: '2026-03-01', userName: '홍길동', departure: '본사', destination: '현장A', purpose: '업무미팅', distance: 15, fuelType: 'gasoline', amount: 3443 },
          { id: '2', date: '2026-03-02', userName: '홍길동', departure: '현장A', destination: '본사', purpose: '복귀', distance: 15, fuelType: 'gasoline', amount: 3443 }
        ]);
      }
      return;
    };

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.gasoline && data.diesel && data.lpg) setFuelRates(data);
      }
    });

    // Logs Listener
    const logsQuery = query(collection(db, 'logs'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() });
      });
      setLogs(logsData.sort((a, b) => new Date(b.date) - new Date(a.date)));
    });

    // Profile Data (User Private) - 경로 단순화
    const profileDoc = doc(db, 'profiles', user.uid);
    const unsubscribeProfile = onSnapshot(profileDoc, (docSnap) => {
      const data = docSnap.data();
      // dev-user이고 데이터가 없거나 주소가 비어있으면 강제로 테스트용 데이터 주입
      if (user.uid === 'dev-user' && (!docSnap.exists() || !data?.homeAddress)) {
        const testProfile = {
          homeAddress: '경기 의왕시 장안중앙로 23',
          homeAlias: '우리집',
          homeLat: 37.3385,
          homeLng: 126.9634,
          vehicleName: '쏘렌토',
          fuelType: 'gasoline',
          savedLocations: [
            { id: 1712543000000, name: '회사', address: '서울 성동구 성수일로12길 26', lat: 37.5446, lng: 127.0567 }
          ]
        };
        setProfile(testProfile);
        setDoc(profileDoc, testProfile);
      } else if (docSnap.exists()) {
        setProfile(data);
      }
    });

    return () => {
      unsubscribeSettings();
      unsubscribeLogs();
      unsubscribeProfile();
    };
  }, [user]);

  const showStatus = (msg, type = 'success') => {
    setStatusMessage({ msg: String(msg), type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const saveLog = async (logData) => {
    if (!user) return;
    if (user.uid === 'dev-user') {
       setLogs([{ id: Date.now().toString(), ...logData, userName: '개발자' }, ...logs]);
       showStatus("운행 내역이 저장되었습니다 (개발 모드).");
       setView('history');
       return;
    }
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        ...logData,
        userId: user.uid,
        userName: user.isAnonymous ? `사용자(${user.uid.slice(0,4)})` : (user.displayName || user.email || "알 수 없음"),
        createdAt: new Date().toISOString()
      });
      showStatus("운행 내역이 저장되었습니다.");
      setView('history');
    } catch (e) {
      showStatus("저장 중 오류가 발생했습니다.", 'error');
    }
  };

  const deleteLog = async (id) => {
    if (user?.uid === 'dev-user') {
      setLogs(logs.filter(l => l.id !== id));
      showStatus("내역이 삭제되었습니다.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', id));
      showStatus("내역이 삭제되었습니다.");
    } catch (e) {
      showStatus("삭제 중 오류가 발생했습니다.", 'error');
    }
  };

  const updateSettings = async (newRates) => {
    if (user?.uid === 'dev-user') {
      setFuelRates(newRates);
      showStatus("단가 설정이 업데이트되었습니다 (개발 모드).");
      return;
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), newRates);
      showStatus("단가 설정이 업데이트되었습니다.");
    } catch (e) {
      showStatus("설정 저장 실패", 'error');
    }
  };

  const updateProfile = async (newProfile) => {
    if (user?.uid === 'dev-user') {
      setProfile(newProfile);
      showStatus("프로필이 업데이트되었습니다 (개발 모드).");
      return;
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), newProfile);
      showStatus("프로필 정보가 저장되었습니다.");
    } catch (e) {
      showStatus("프로필 저장 실패", 'error');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">시스템을 불러오는 중...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <nav className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col p-6 z-10">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
            <Car size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">유류대 마스터</h1>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Enterprise Edition</p>
          </div>
        </div>

        <div className="space-y-1.5 flex-1">
          <NavItem icon={<LayoutDashboard size={20}/>} label="대시보드" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavItem icon={<PlusCircle size={20}/>} label="신규 내역 입력" active={view === 'log'} onClick={() => setView('log')} />
          <NavItem icon={<History size={20}/>} label="운행 내역 관리" active={view === 'history'} onClick={() => setView('history')} />
          <NavItem icon={<Settings size={20}/>} label="시스템 단가 설정" active={view === 'settings'} onClick={() => setView('settings')} />
          <NavItem icon={<UserCircle size={20}/>} label="마이페이지" active={view === 'profile'} onClick={() => setView('profile')} />
        </div>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-xs">
                {user?.uid?.slice(0,1).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{user?.isAnonymous ? '익명 사용자' : (user?.email || '사용자')}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{user?.uid}</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                <span>System</span>
                <ChevronRight size={10} />
                <span className="text-blue-500">{view === 'dashboard' ? 'Overview' : view === 'log' ? 'Entry' : view === 'history' ? 'Records' : 'Settings'}</span>
              </nav>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {view === 'dashboard' ? '운영 통계 대시보드' : view === 'log' ? '신규 운행 내역 등록' : view === 'history' ? '전체 운행 이력' : '유류비 산정 기준 설정'}
              </h2>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-white hover:shadow-md transition-all active:scale-95"
              >
                <Download size={16} /> 레포트 출력
              </button>
            </div>
          </header>

          {statusMessage && (
            <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl flex items-center gap-3 shadow-2xl border animate-fade-in ${statusMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
              <div className={`p-1.5 rounded-lg ${statusMessage.type === 'error' ? 'bg-red-100' : 'bg-green-100'}`}>
                {statusMessage.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
              </div>
              <span className="font-bold text-sm pr-2">{statusMessage.msg}</span>
            </div>
          )}

          <div className="animate-fade-in">
            {view === 'dashboard' && <Dashboard logs={logs} />}
            {view === 'log' && <LogEntryForm fuelRates={fuelRates} profile={profile} onSave={saveLog} />}
            {view === 'history' && <HistoryTable logs={logs} onDelete={deleteLog} />}
            {view === 'settings' && <SettingsPanel fuelRates={fuelRates} onUpdate={updateSettings} />}
            {view === 'profile' && <MyPage profile={profile} onUpdate={updateProfile} />}
          </div>
        </div>
      </main>
    </div>
  );
};

// --- Sub-Components ---

const NavItem = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-200 group ${
      active 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 translate-x-1' 
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`}>{icon}</span>
    <span>{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-40"></div>}
  </button>
);

const Dashboard = ({ logs }) => {
  const stats = useMemo(() => {
    const totalDist = logs.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const totalAmount = logs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const gasolineDist = logs.filter(l => l.fuelType === 'gasoline').reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const dieselDist = logs.filter(l => l.fuelType === 'diesel').reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const lpgDist = logs.filter(l => l.fuelType === 'lpg').reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);

    const userStats = {};
    logs.forEach(l => {
      const name = String(l.userName || "알 수 없음");
      userStats[name] = (userStats[name] || 0) + Number(l.amount || 0);
    });

    const barData = Object.keys(userStats).map(name => ({ name, value: userStats[name] }));
    const pieData = [
      { name: '휘발유', value: gasolineDist },
      { name: '경유', value: dieselDist },
      { name: 'LPG', value: lpgDist },
    ].filter(d => d.value > 0);

    return { totalDist, totalAmount, barData, pieData };
  }, [logs]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="총 정산 금액" value={`${stats.totalAmount.toLocaleString()}원`} icon={<Calculator className="text-blue-600" />} subtitle="당월 지급 예정 합계" color="bg-blue-600" />
        <StatCard title="총 누적 거리" value={`${stats.totalDist.toLocaleString()}km`} icon={<Car className="text-emerald-600" />} subtitle="업무용 운행 전체 거리" color="bg-emerald-500" />
        <StatCard title="기록된 데이터" value={`${logs.length}건`} icon={<History className="text-amber-600" />} subtitle="서버 동기화된 내역" color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-800">사용자별 정산 현황</h3>
              <p className="text-xs font-medium text-slate-400 mt-1">개인별 누적 유류비 지급액</p>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg"><LayoutDashboard size={18} className="text-slate-400" /></div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.barData}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} fontWeight="700" tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={12} fontWeight="700" tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/10000).toFixed(1)}만`} />
                <Tooltip 
                  cursor={{fill: '#f8fafc', radius: 10}} 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: '700' }} 
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 10, 10]} barSize={40} animationBegin={200} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-800">유종 분포</h3>
              <p className="text-xs font-medium text-slate-400 mt-1">주행 거리 기준 비중</p>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg"><Fuel size={18} className="text-slate-400" /></div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.pieData} innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={5} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, subtitle }) => (
  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
    <div className="flex items-start justify-between z-10">
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{title}</p>
        <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
      </div>
      <div className="p-4 bg-slate-50 rounded-2xl group-hover:scale-110 group-hover:bg-slate-100 transition-all duration-300">
        {icon}
      </div>
    </div>
    <div className="mt-6 flex items-center gap-2 z-10">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
      <p className="text-xs font-bold text-slate-500">{subtitle}</p>
    </div>
    {/* Subtle background decoration */}
    <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
  </div>
);

const LogEntryForm = ({ fuelRates, profile, onSave }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    waypoints: [
      { id: 'start', label: '출발지', address: profile?.homeAddress || '', alias: profile?.homeAlias || '', lat: profile?.homeLat || 37.3385, lng: profile?.homeLng || 126.9634 },
      { id: 'end', label: '도착지', address: '', alias: '', lat: 37.5, lng: 127.0 }
    ],
    purpose: '',
    fuelType: profile?.fuelType || 'gasoline',
    distance: 0, // 최종 주행 거리
    isManualDistance: false // 수동 입력 여부
  });

  // Haversine 거리 계산 함수 (사용 전 먼저 선언)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 프로필 정보가 변경되거나 로드되면 기본값 적용 및 거리 계산
  useEffect(() => {
    let sum = 0;
    for (let i = 0; i < formData.waypoints.length - 1; i++) {
        const p1 = formData.waypoints[i];
        const p2 = formData.waypoints[i+1];
        if (p1.address && p2.address) {
            // 직선 거리에 도로 보정 계수(1.25배) 적용하여 카카오맵과 유사하게 맞춤
            sum += calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1.25;
        }
    }
    
    // 사용자가 직접 수정한 상태가 아닐 때만 자동 계산 결과 적용
    if (!formData.isManualDistance) {
      setFormData(prev => ({ ...prev, distance: parseFloat(sum.toFixed(1)) }));
    }
  }, [formData.waypoints, formData.isManualDistance]);

  const isFormValid = useMemo(() => {
    const hasDistance = formData.distance > 0;
    const allWaypointsNamed = formData.waypoints.every(wp => wp.alias && wp.alias.trim() !== '');
    const allWaypointsHaveAddress = formData.waypoints.every(wp => wp.address !== '');
    return hasDistance && allWaypointsNamed && allWaypointsHaveAddress;
  }, [formData.distance, formData.waypoints]);

  const calculatedAmount = useMemo(() => {
    const rate = fuelRates[formData.fuelType]?.unitPrice || 0;
    return Math.round(formData.distance * rate);
  }, [formData.distance, formData.fuelType, fuelRates]);

  const openSearch = (index) => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        const fullAddress = data.address;
        const bname = data.bname || ""; 
        const buildingName = data.buildingName || ""; 
        const autoAlias = buildingName || bname; 

        // 카카오 지오코더로 실제 좌표 검색
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
          const geocoder = new window.kakao.maps.services.Geocoder();
          
          geocoder.addressSearch(fullAddress, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
              const realLat = parseFloat(result[0].y);
              const realLng = parseFloat(result[0].x);
              
              const newWaypoints = [...formData.waypoints];
              newWaypoints[index] = { 
                ...newWaypoints[index], 
                address: fullAddress,
                alias: newWaypoints[index].alias || autoAlias,
                lat: realLat,
                lng: realLng
              };
              setFormData({ ...formData, waypoints: newWaypoints });
            } else {
              // 검색 실패 시 기존 로직 유지 (폴백)
              applyFallbackCoords(index, fullAddress, autoAlias);
            }
          });
        } else {
          // SDK 미로드 시 기존 로직 유지 (폴백)
          applyFallbackCoords(index, fullAddress, autoAlias);
        }
      }
    }).open();
  };

  const applyFallbackCoords = (index, fullAddress, autoAlias) => {
    const seed = fullAddress.length;
    const mockLat = 37.5 + (seed % 100) / 500;
    const mockLng = 127.0 + (seed % 100) / 500;

    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = { 
      ...newWaypoints[index], 
      address: fullAddress,
      alias: newWaypoints[index].alias || autoAlias,
      lat: mockLat,
      lng: mockLng
    };
    setFormData({ ...formData, waypoints: newWaypoints });
  };

  const handleQuickSelect = (index, location) => {
    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = {
      ...newWaypoints[index],
      address: location.address,
      alias: location.name,
      lat: location.lat || 37.5,
      lng: location.lng || 127.0
    };
    setFormData({ ...formData, waypoints: newWaypoints });
  };

  const handleAliasChange = (index, value) => {
    const newWaypoints = [...formData.waypoints];
    newWaypoints[index].alias = value;
    setFormData({ ...formData, waypoints: newWaypoints });
  };

  const addStop = () => {
    const newWaypoints = [...formData.waypoints];
    const insertPos = newWaypoints.length - 1;
    newWaypoints.splice(insertPos, 0, { 
      id: Date.now(), 
      label: `경유지 ${newWaypoints.length - 1}`, 
      address: '', 
      alias: '',
      lat: 37.5, 
      lng: 127.0 
    });
    setFormData({ ...formData, waypoints: newWaypoints });
  };

  const removeStop = (index) => {
    if (formData.waypoints.length <= 2) return;
    const newWaypoints = formData.waypoints.filter((_, i) => i !== index);
    setFormData({ ...formData, waypoints: newWaypoints });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    // 이력 저장을 위해 보낼 데이터 가공 (별칭 포함)
    const payload = {
      date: formData.date,
      departure: formData.waypoints[0].address,
      destination: formData.waypoints[formData.waypoints.length - 1].address,
      purpose: formData.purpose,
      distance: formData.distance,
      fuelType: formData.fuelType,
      amount: calculatedAmount,
      routeSummary: formData.waypoints
        .map(w => `[${w.alias}] ${w.address}`)
        .join(' → ')
    };
    
    onSave(payload);
    setFormData(prev => ({ 
      ...prev, 
      waypoints: [
        { id: 'start', label: '출발지', address: profile?.homeAddress || '', alias: profile?.homeAlias || '', lat: profile?.homeLat || 37.5665, lng: profile?.homeLng || 126.9780 },
        { id: 'end', label: '도착지', address: '', alias: '', lat: 37.4979, lng: 127.0276 }
      ], 
      purpose: '',
      distance: 0,
      isManualDistance: false
    }));
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <InputGroup label="운행 날짜" icon={<History size={16}/>}>
            <input 
              type="date" 
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-bold text-slate-700" 
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </InputGroup>

          <InputGroup label="사용 유종" icon={<Fuel size={16}/>}>
            <select 
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-bold text-slate-700 appearance-none"
              value={formData.fuelType}
              onChange={e => setFormData({...formData, fuelType: e.target.value})}
            >
              <option value="gasoline">휘발유 ({Number(fuelRates?.gasoline?.unitPrice).toFixed(1)}원/km)</option>
              <option value="diesel">경유 ({Number(fuelRates?.diesel?.unitPrice).toFixed(1)}원/km)</option>
              <option value="lpg">LPG ({Number(fuelRates?.lpg?.unitPrice).toFixed(1)}원/km)</option>
            </select>
          </InputGroup>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <MapPin size={16} className="text-blue-500" /> 운행 경로 및 장소명 (필수)
             </label>
             <button 
               type="button"
               onClick={addStop}
               className="text-[10px] font-black bg-slate-100 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-all text-slate-500"
             >
               + 경유지 추가
             </button>
          </div>
          
          <div className="space-y-6">
            {formData.waypoints.map((wp, idx) => (
              <div key={wp.id} className="animate-fade-in group space-y-2">
                <div className="flex flex-wrap gap-2 ml-1">
                  {profile?.homeAddress && (
                    <button 
                      type="button" 
                      onClick={() => handleQuickSelect(idx, { name: profile.homeAlias || '우리집', address: profile.homeAddress, lat: profile.homeLat, lng: profile.homeLng })}
                      className="group/btn flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
                    >
                      <span className="opacity-80">🏠</span>
                      <span>{profile.homeAlias || '우리집'}</span>
                    </button>
                  )}
                  {profile?.savedLocations?.map(loc => (
                    <button 
                      key={loc.id}
                      type="button" 
                      onClick={() => handleQuickSelect(idx, loc)}
                      className="group/btn flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[10px] font-black shadow-sm hover:border-slate-900 hover:bg-slate-900 hover:text-white hover:-translate-y-0.5 transition-all"
                    >
                      <span className="text-blue-500 group-hover/btn:text-white opacity-80">📍</span>
                      <span>{loc.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex-[2] relative">
                    <input 
                      type="text" 
                      placeholder={`${wp.label} 주소 검색`} 
                      readOnly
                      onClick={() => openSearch(idx)}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 group-hover:border-blue-200 cursor-pointer focus:bg-white focus:ring-4 focus:ring-blue-50/50 outline-none transition-all font-bold text-slate-700"
                      value={wp.address}
                    />
                    {!wp.address && (
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-500 pointer-events-none opacity-60">검색</span>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="명칭 (필수입력)" 
                      className={`w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 outline-none transition-all font-bold text-sm ${
                        wp.alias ? 'border-slate-100 text-slate-600 focus:border-blue-400' : 'border-red-100 text-red-500 focus:border-red-300'
                      }`}
                      value={wp.alias}
                      onChange={(e) => handleAliasChange(idx, e.target.value)}
                    />
                    {!wp.alias && (
                      <span className="absolute -top-6 right-1 text-[9px] font-black text-red-500 animate-pulse">명칭 기입 필수</span>
                    )}
                  </div>

                  {idx > 0 && idx < formData.waypoints.length - 1 ? (
                    <button 
                      type="button" 
                      onClick={() => removeStop(idx)}
                      className="p-3 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <div className="w-10"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <InputGroup label="업무 상세 내용" icon={<FileText size={16}/>}>
            <input 
              type="text" 
              placeholder="특이사항이나 세부 목적을 입력하세요." 
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-bold text-slate-700"
              value={formData.purpose}
              onChange={e => setFormData({...formData, purpose: e.target.value})}
            />
          </InputGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Total Distance</p>
              <button 
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isManualDistance: !prev.isManualDistance }))}
                className={`text-[9px] font-black px-2 py-1 rounded-md transition-all ${
                  formData.isManualDistance ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {formData.isManualDistance ? '수동 입력 중' : '자동 계산 중'}
              </button>
            </div>
            <div className="flex items-baseline gap-1">
              {formData.isManualDistance ? (
                <div className="flex items-baseline gap-2">
                  <input 
                    type="number"
                    step="0.1"
                    className="w-24 text-2xl font-black text-blue-600 bg-white border-b-2 border-blue-400 outline-none px-1"
                    value={formData.distance}
                    onChange={(e) => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-sm font-bold text-slate-400">km</span>
                </div>
              ) : (
                <div className="text-2xl font-black text-slate-800 flex items-baseline gap-1">
                  {formData.distance} <span className="text-sm">km</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 px-1">
              {formData.isManualDistance ? '실제 계기판 거리를 입력하세요.' : '좌표 기반 직선 거리(보정치 포함)'}
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-blue-600 shadow-xl shadow-blue-200 border border-blue-500 text-white flex justify-between items-center transition-all duration-300 hover:scale-[1.02]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Expected Amount</p>
              <h4 className="text-2xl font-black">{calculatedAmount.toLocaleString()}원</h4>
            </div>
            <Calculator size={28} className="opacity-40" />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={!isFormValid}
          className={`w-full py-5 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] ${
            isFormValid ? 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800' : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
          }`}
        >
          <PlusCircle size={22} /> {formData.distance > 0 ? '전체 정산 내역 기록하기' : '주소를 입력해 주세요'}
        </button>
      </form>
    </div>
  );
};

const InputGroup = ({ label, icon, children }) => (
  <div className="space-y-3">
    <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest px-1">
      <span className="text-blue-500">{icon}</span>
      {label}
    </label>
    {children}
  </div>
);

const HistoryTable = ({ logs, onDelete }) => {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">운행 정보</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">업무 상세</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">구간 및 유종</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">정산 금액</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-8 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <History size={48} className="text-slate-200" />
                    <p className="text-slate-400 font-bold">기록된 운행 내역이 없습니다.</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="font-black text-slate-900">{log.date}</div>
                    <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      {log.userName}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-slate-700 flex flex-wrap items-center gap-1.5 leading-relaxed">
                      {log.routeSummary ? (
                        log.routeSummary.split(' → ').map((stop, sIdx, arr) => (
                          <React.Fragment key={sIdx}>
                            <span>{stop}</span>
                            {sIdx < arr.length - 1 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
                          </React.Fragment>
                        ))
                      ) : (
                        <>
                          {log.departure} <ChevronRight size={14} className="text-slate-300" /> {log.destination}
                        </>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-400 mt-1.5 bg-slate-50 px-2 py-1 rounded inline-block">
                      {log.purpose}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="font-black text-slate-900">{log.distance} km</div>
                    <div className={`text-[9px] px-2 py-0.5 rounded-full font-black mt-1.5 inline-block ${
                      log.fuelType === 'gasoline' ? 'bg-blue-50 text-blue-600' : 
                      log.fuelType === 'diesel' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {log.fuelType === 'gasoline' ? '휘발유' : log.fuelType === 'diesel' ? '경유' : 'LPG'}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="font-black text-blue-600 text-lg">{Number(log.amount || 0).toLocaleString()}원</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <button 
                      onClick={() => onDelete(log.id)}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                    >
                      <Trash2 size={20} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SettingsPanel = ({ fuelRates, onUpdate }) => {
  const [localRates, setLocalRates] = useState(fuelRates);

  useEffect(() => {
    setLocalRates(fuelRates);
  }, [fuelRates]);

  const handleChange = (fuel, field, value) => {
    setLocalRates({
      ...localRates,
      [fuel]: { ...localRates[fuel], [field]: Number(value) }
    });
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
      <div className="mb-12 p-6 bg-blue-50/50 border border-blue-100 rounded-[1.5rem] flex items-start gap-4">
        <div className="p-3 bg-blue-600 rounded-2xl text-white">
          <AlertCircle size={24} />
        </div>
        <div>
          <h4 className="text-blue-900 font-black mb-1">단가 산정 가이드</h4>
          <p className="text-sm text-blue-700 leading-relaxed font-bold">
            오피넷(Opinet) 전월 평균 가격을 기준으로 km당 단가를 설정하세요.<br/>
            수정된 단가는 신규 입력하는 내역부터 즉시 적용됩니다.
          </p>
        </div>
      </div>

      <div className="space-y-12">
        {['gasoline', 'diesel', 'lpg'].map((fuel) => (
          <div key={fuel} className="grid grid-cols-1 md:grid-cols-3 gap-10 items-end border-b border-slate-50 pb-10 last:border-0 last:pb-0">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">유종 구분</label>
              <div className="px-5 py-4 rounded-2xl bg-slate-50 font-black text-slate-800 border border-slate-100 uppercase tracking-tight">
                {fuel === 'gasoline' ? '휘발유 (Premium)' : fuel === 'diesel' ? '경유 (Diesel)' : '액화석유가스 (LPG)'}
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">평균 판매가 (원/L)</label>
              <input 
                type="number" 
                step="0.01"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-black text-slate-700"
                value={localRates[fuel]?.avgPrice || 0}
                onChange={e => handleChange(fuel, 'avgPrice', e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KM당 보상 단가</label>
              <input 
                type="number" 
                step="0.01"
                className="w-full px-5 py-4 rounded-2xl border-2 border-blue-100 bg-blue-50/20 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-black text-blue-600"
                value={localRates[fuel]?.unitPrice || 0}
                onChange={e => handleChange(fuel, 'unitPrice', e.target.value)}
              />
            </div>
          </div>
        ))}

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-slate-50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-slate-100 rounded-xl text-slate-500"><Settings size={20} /></div>
             <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Global Policy</p>
               <p className="text-sm font-bold text-slate-700">감가상각 정합성 10% 계수 자동 보정됨</p>
             </div>
          </div>
          <button 
            onClick={() => onUpdate(localRates)}
            className="w-full md:w-auto bg-blue-600 text-white px-12 py-5 rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
          >
            변경된 기준값 저장
          </button>
        </div>
      </div>
    </div>
  );
};

const MyPage = ({ profile, onUpdate }) => {
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  const openHomeSearch = () => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        setLocalProfile(prev => ({
          ...prev,
          homeAddress: data.address,
          // 중요: 기존 별칭을 절대 덮어쓰지 않고 유지함
          homeAlias: prev.homeAlias || '우리집',
          homeLat: 37.5 + (data.address.length % 100) / 500,
          homeLng: 126.0 + (data.address.length % 100) / 500
        }));
      }
    }).open();
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 max-w-4xl">
      <div className="mb-12 flex items-center gap-6">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
          <UserCircle size={40} />
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800">개인 설정 관리</h3>
          <p className="text-sm font-bold text-slate-400">자주 사용하는 주소와 차량 정보를 등록하세요.</p>
        </div>
      </div>

      <div className="space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <MapPin size={18} className="text-blue-500" />
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">기본 출발지 설정 (집 주소)</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="md:col-span-2">
                <input 
                  type="text" 
                  readOnly 
                  placeholder="주소 검색 버튼을 눌러주세요"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-700 outline-none"
                  value={localProfile.homeAddress} 
                />
             </div>
             <button 
               onClick={openHomeSearch}
               className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all"
             >
               주소 검색
             </button>
             <div className="md:col-span-3">
                <InputGroup label="집 별칭 (ex: 자택, 본가)" icon={<FileText size={14}/>}>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 outline-none transition-all font-bold text-slate-700"
                    value={localProfile.homeAlias}
                    onChange={(e) => setLocalProfile({...localProfile, homeAlias: e.target.value})}
                  />
                </InputGroup>
             </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <PlusCircle size={18} className="text-blue-500" />
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">자주 가는 장소 (즐겨찾기)</h4>
            </div>
            <button 
              onClick={() => {
                new window.daum.Postcode({
                  oncomplete: function(data) {
                    const newLoc = {
                      id: Date.now(),
                      name: data.buildingName || data.bname || '새 장소',
                      address: data.address,
                      lat: 37.5 + (data.address.length % 100) / 500,
                      lng: 127.0 + (data.address.length % 100) / 500
                    };
                    setLocalProfile({
                       ...localProfile,
                       savedLocations: [...(localProfile.savedLocations || []), newLoc]
                    });
                  }
                }).open();
              }}
              className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
            >
              + 장소 추가
            </button>
          </div>
          
          <div className="space-y-3">
             {(localProfile.savedLocations || []).length === 0 ? (
               <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                 <p className="text-xs font-bold text-slate-400">등록된 장소가 없습니다. 자주 가는 곳을 등록해 보세요!</p>
               </div>
             ) : (
               localProfile.savedLocations.map((loc) => (
                 <div key={loc.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                   <div className="flex items-center gap-4 flex-1">
                     <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                       <MapPin size={20} />
                     </div>
                     <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 max-w-[240px]">
                            <input 
                              className="w-full text-base font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                              value={loc.name}
                              placeholder="예: 회사, 본사"
                              onChange={(e) => {
                                const newList = localProfile.savedLocations.map(l => l.id === loc.id ? {...l, name: e.target.value} : l);
                                setLocalProfile({...localProfile, savedLocations: newList});
                              }}
                            />
                            <div className="absolute -top-4 left-1">
                               <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter opacity-70">명칭 수정 가능</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{loc.address}</p>
                     </div>
                   </div>
                   <button 
                     onClick={() => {
                        const newList = localProfile.savedLocations.filter(l => l.id !== loc.id);
                        setLocalProfile({...localProfile, savedLocations: newList});
                     }}
                     className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                   >
                     <Trash2 size={18} />
                   </button>
                 </div>
               ))
             )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <Fuel size={18} className="text-blue-500" />
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">차량 및 주종 정보</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup label="차량 별명 (ex: 내 차, 소나타)" icon={<Car size={14}/>}>
               <input 
                 type="text" 
                 className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 outline-none transition-all font-bold text-slate-700"
                 placeholder="예: 제네시스"
                 value={localProfile.vehicleName}
                 onChange={(e) => setLocalProfile({...localProfile, vehicleName: e.target.value})}
               />
            </InputGroup>
            <InputGroup label="기본 유종 설정" icon={<Fuel size={14}/>}>
               <select 
                 className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 outline-none transition-all font-bold text-slate-700"
                 value={localProfile.fuelType}
                 onChange={(e) => setLocalProfile({...localProfile, fuelType: e.target.value})}
               >
                 <option value="gasoline">휘발유 (Gasoline)</option>
                 <option value="diesel">경유 (Diesel)</option>
                 <option value="lpg">액화석유가스 (LPG)</option>
               </select>
            </InputGroup>
          </div>
        </section>

        <div className="pt-6 border-t border-slate-50">
          <button 
            onClick={() => onUpdate(localProfile)}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            개인 설정값 저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
