/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile
} from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, deleteDoc, query, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Settings, 
  Fuel, 
  Car, 
  Calculator, 
  ChevronRight, 
  ChevronLeft,
  Menu,
  Trash2, 
  Download, 
  AlertCircle, 
  MapPin, 
  FileText, 
  UserCircle, 
  Mail, 
  Lock, 
  User, 
  Users, 
  LogOut, 
  Calendar,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Search
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
  Legend,
  AreaChart,
  Area
} from 'recharts';

// --- Safe Configuration Handling ---
// We try to get values from globals, but provide meaningful fallbacks for local dev
const getSafeGlobal = (key, fallback) => {
  try {
    return typeof window !== 'undefined' && window[key] ? window[key] : fallback;
  } catch {
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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const MASTER_ADMINS = ['esc913@composecoffee.co.kr', 'choihy@composecoffee.co.kr', 'jang_sw@composecoffee.co.kr'];
const isMasterAdmin = (email) => email && MASTER_ADMINS.includes(email.toLowerCase());

const App = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [view, setView] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [fuelRates, setFuelRates] = useState({
    gasoline: { unitPrice: 229.55, avgPrice: 1836.41 },
    diesel: { unitPrice: 228.62, avgPrice: 1828.92 },
    lpg: { unitPrice: 101.17, avgPrice: 1011.67 },
    depreciation: 10
  });
  const [statusMessage, setStatusMessage] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [orgUnits, setOrgUnits] = useState(['본사', '연구소', '영업부', '현장']);
  const [reportFilters, setReportFilters] = useState({
    department: 'all',
    userId: 'all',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    selectedMonth: new Date().toISOString().slice(0, 7)
  });

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;
    
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'profiles'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 조직 구성 정보 실시간 동기화 (App 레벨로 이동)
    const orgRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'orgUnits');
    const unsubscribeOrg = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) {
        setOrgUnits(snap.data().units || ['본사', '연구소', '영업부', '현장']);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeOrg();
    };
  }, [user, profile?.role]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', u.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setProfile(userDoc.data());
        } else {
          const isMaster = isMasterAdmin(u.email);

          const newProfile = {
            uid: u.uid,
            email: u.email,
            userName: u.displayName || '신규 사용자',
            role: isMaster ? 'admin' : 'staff',
            status: isMaster ? 'approved' : 'pending',
            department: isMaster ? '인사팀' : '미지정',
            vehicleName: '',
            fuelType: 'gasoline',
            homeAddress: '',
            homeAlias: '우리집',
            savedLocations: []
          };
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || (profile?.status !== 'approved' && profile?.role !== 'admin')) return;
    
    const tripMonth = new Date().toISOString().slice(0, 7);
    const fetchRates = async () => {
      const rateRef = doc(db, 'artifacts', appId, 'public', 'data', 'fuelRates', tripMonth);
      const snap = await getDoc(rateRef);
      if (snap.exists()) setFuelRates(snap.data());
    };
    fetchRates();

    const logsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), orderBy('date', 'desc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(log => profile?.role === 'admin' || log.userId === user.uid);
      setLogs(logsData);
    });

    return () => unsubscribeLogs();
  }, [user, profile?.role, profile?.status]);

  const showStatus = (msg, type = 'success') => {
    setStatusMessage({ msg: String(msg), type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showStatus("로그인 성공!");
    } catch (err) { 
      let msg = "로그인 실패";
      if (err.code === 'auth/user-not-found') msg = "등록되지 않은 이메일입니다.";
      else if (err.code === 'auth/wrong-password') msg = "비밀번호가 올바르지 않습니다.";
      else if (err.code === 'auth/invalid-email') msg = "이메일 형식이 올바르지 않습니다.";
      showStatus(msg, 'error'); 
    }
  };

  const signup = async (email, password, userName, department) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const u = cred.user;
      
      await updateAuthProfile(u, { displayName: userName });

      const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', u.uid);
      const isMaster = isMasterAdmin(u.email);

      const newProfile = {
        uid: u.uid,
        email: u.email,
        userName: userName,
        role: isMaster ? 'admin' : 'staff',
        status: isMaster ? 'approved' : 'pending',
        department: isMaster ? '인사팀' : (department || '미지정'),
        vehicleName: '',
        fuelType: 'gasoline',
        homeAddress: '',
        homeAlias: '우리집',
        savedLocations: []
      };
      
      await setDoc(userDocRef, newProfile);
      setProfile(newProfile);
      
      if (isMaster) {
        showStatus("관리자 계정으로 자동 승인되었습니다.");
      } else {
        showStatus("가입 신청 완료! 승인 대기 중입니다.");
      }
    } catch (err) { 
      console.error(err);
      let msg = "회원가입 실패";
      if (err.code === 'auth/email-already-in-use') msg = "이미 사용 중인 이메일입니다. 로그인해 주세요.";
      else if (err.code === 'auth/weak-password') msg = "비밀번호는 6자리 이상이어야 합니다.";
      else if (err.code === 'auth/invalid-email') msg = "이메일 형식이 올바르지 않습니다.";
      showStatus(msg, 'error'); 
    }
  };

  const logout = () => signOut(auth).then(() => setView('dashboard'));

  const saveLog = async (logData) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        ...logData,
        userId: user.uid,
        userName: profile?.userName || user.email,
        createdAt: new Date().toISOString()
      });
      showStatus("저장되었습니다.");
      setView('history');
    } catch { showStatus("저장 실패", 'error'); }
  };

  const deleteLog = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', id));
      showStatus("삭제되었습니다.");
    } catch { showStatus("삭제 실패", 'error'); }
  };

  const updateProfile = async (newProfile) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), newProfile);
      setProfile(newProfile);
      showStatus("저장되었습니다.");
    } catch { showStatus("저장 실패", 'error'); }
  };

  const updateSettings = async (rates, month) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'fuelRates', month), rates);
      setFuelRates(rates);
      showStatus("단가 설정 저장됨");
    } catch { showStatus("저장 실패", 'error'); }
  };

  const handleExportData = () => {
    let dataToExport = logs;
    let filename = `운행정산내역_${new Date().toISOString().slice(0, 10)}.csv`;

    if (view === 'reports') {
      dataToExport = logs.filter(log => {
        const u = allUsers.find(au => au.uid === log.userId);
        const logDept = u?.department || '미지정';
        const matchDept = reportFilters.department === 'all' || logDept === reportFilters.department;
        const matchUser = reportFilters.userId === 'all' || log.userId === reportFilters.userId;
        const matchStart = !reportFilters.startDate || log.date >= reportFilters.startDate;
        const matchEnd = !reportFilters.endDate || log.date <= reportFilters.endDate;
        return matchDept && matchUser && matchStart && matchEnd;
      });
      filename = `유류비_정산리포트_${reportFilters.startDate}_${reportFilters.endDate}.csv`;
    }

    if (dataToExport.length === 0) {
      showStatus("내보낼 데이터가 없습니다.", "error");
      return;
    }

    const headers = ["날짜", "사용자", "부서", "출발지", "도착지", "운행목적", "거리(km)", "유종", "금액(원)", "경로상세"];
    const rows = dataToExport.map(log => {
      const userProfile = allUsers.find(u => u.uid === log.userId);
      return [
        log.date,
        log.userName,
        userProfile?.department || '미지정',
        log.departure || "",
        log.destination || "",
        log.purpose || "",
        log.distance,
        log.fuelType === 'gasoline' ? '휘발유' : log.fuelType === 'diesel' ? '경유' : 'LPG',
        log.amount,
        log.routeSummary || ""
      ];
    });

    let csvContent = "\ufeff"; // UTF-8 BOM
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatus("데이터 내보내기 완료");
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-slate-300">SYSTEM LOADING...</div>;
  if (!user) return <AuthScreen onLogin={login} onSignup={signup} orgUnits={orgUnits} db={db} appId={appId} />;
  
  // 마스터 관리자 이메일 체크
  const isAdmin = profile?.role === 'admin' || isMasterAdmin(user?.email); 

  if (!isAdmin && profile?.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-xl max-w-md">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertCircle size={40} /></div>
          <h2 className="text-2xl font-black text-slate-800 mb-4">승인 대기 중</h2>
          <p className="text-slate-500 font-bold mb-8">인사팀의 승인이 아직 완료되지 않았습니다.</p>
          <button onClick={logout} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black">로그아웃</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-['Outfit']">
      <Sidebar 
        currentView={view} 
        onNavigate={setView} 
        onLogout={logout} 
        isAdmin={isAdmin} 
        userProfile={profile} 
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className={`flex-1 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} min-h-screen`}>
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 animate-fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-px w-8 bg-indigo-500 rounded-full"></span>
              <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]">SYSTEM › {view.toUpperCase()}</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {view === 'dashboard' ? '대시보드' : view === 'log' ? '신규 운행 내역' : view === 'history' ? '정산 및 내역' : view === 'reports' ? '통계 리포트' : view === 'settings' ? '환경 설정' : view === 'admin' ? '인사 관리' : '내 프로필'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {(view === 'history' || view === 'reports') && (
              <button 
                onClick={handleExportData}
                className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-slate-100 text-slate-600 font-bold shadow-sm hover:shadow-md hover:border-indigo-100 transition-all active:scale-95"
              >
                <Download size={18} className="text-indigo-500" /> 
                <span className="text-sm">데이터 내보내기</span>
              </button>
            )}
          </div>
        </header>
        <main className="max-w-7xl">
          {statusMessage && (
            <div className={`fixed top-8 right-8 z-50 p-4 rounded-2xl shadow-2xl border animate-bounce ${statusMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
              <span className="font-black px-4">{statusMessage.msg}</span>
            </div>
          )}
          {view === 'dashboard' && <Dashboard logs={logs} />}
          {view === 'log' && <LogEntryForm fuelRates={fuelRates} profile={profile} onSave={saveLog} />}
          {view === 'history' && <HistoryTable logs={logs} onDelete={deleteLog} />}
          {view === 'reports' && <ManagementReport logs={logs} users={allUsers} db={db} appId={appId} filters={reportFilters} onFilterChange={setReportFilters} />}
          {view === 'settings' && <SettingsPanel fuelRates={fuelRates} onUpdate={updateSettings} db={db} appId={appId} />}
          {view === 'admin' && <AdminPanel db={db} appId={appId} orgUnits={orgUnits} setOrgUnits={setOrgUnits} />}
          {view === 'profile' && <MyPage profile={profile} onUpdate={updateProfile} />}
        </main>
      </div>
    </div>
   </div>
  );
};

// --- Sub-Components ---

const NavItem = ({ icon, label, active, onClick, isCollapsed }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-3.5 rounded-2xl text-[13px] font-bold transition-all duration-300 group relative ${
      active 
      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' 
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
    title={isCollapsed ? label : ''}
  >
    <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500 transition-transform duration-300 group-hover:scale-110'} shrink-0`}>
      {React.cloneElement(icon, { size: 20 })}
    </span>
    {!isCollapsed && <span className="whitespace-nowrap overflow-hidden transition-all duration-300">{label}</span>}
    {active && !isCollapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-40"></div>}
    {active && isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full opacity-60"></div>}
  </button>
);

const Dashboard = ({ logs }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const filteredLogs = useMemo(() => {
    return logs.filter(log => log.date.startsWith(selectedMonth));
  }, [logs, selectedMonth]);

  const stats = useMemo(() => {
    const totalDist = filteredLogs.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const totalAmount = filteredLogs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    
    // 일자별 km 트래킹 데이터 생성
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dailyStats = {};
    filteredLogs.forEach(l => {
      const day = l.date.split('-')[2];
      if (day) {
        dailyStats[day] = (dailyStats[day] || 0) + (Number(l.distance) || 0);
      }
    });

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return {
        name: `${month}/${d}`,
        distance: Number((dailyStats[d] || 0).toFixed(1))
      };
    });

    return { totalDist, totalAmount, count: filteredLogs.length, dailyData };
  }, [filteredLogs, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">종합 운행 데이터</h3>
          <p className="text-sm font-medium text-slate-400">시스템에 동기화된 전체 정산 현황입니다.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-indigo-50 transition-all">
          <Calendar size={16} className="text-indigo-500" />
          <input 
            type="month" 
            className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
        <StatCard title="총 정산 금액" value={`${stats.totalAmount.toLocaleString()}원`} subtitle="당월 지급 예정 합계" icon={<Calculator />} color="indigo" />
        <StatCard title="총 누적 거리" value={`${stats.totalDist.toFixed(1)}km`} subtitle="업무용 운행 전체 거리" icon={<Navigation />} color="emerald" />
        <StatCard title="정산 건수" value={`${stats.count}건`} subtitle="정상 승인된 내역 개수" icon={<History />} color="amber" />
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 min-h-[350px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-sm font-black text-slate-800">일자별 KM 트래킹</h4>
              <p className="text-[9px] font-bold text-slate-400">당월 업무용 운행 거리 일일 변동 추이</p>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400"><Navigation size={18} /></div>
          </div>
          <div className="h-[220px] w-full">
            {stats.dailyData.some(d => d.distance > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }} tickFormatter={(value) => `${value}km`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 900, padding: '12px' }}
                    formatter={(value) => [`${value} km`, '운행 거리']}
                  />
                  <Area type="monotone" dataKey="distance" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorDist)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="해당 월의 주행 데이터가 없습니다." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, subtitle, color }) => {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600'
  };

  return (
    <div className="premium-card p-6 rounded-[2rem] flex flex-col relative overflow-hidden group">
      <div className="flex items-start justify-between z-10">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
        </div>
        <div className={`p-3.5 rounded-2xl group-hover:scale-110 transition-all duration-500 ${colorMap[color] || 'bg-slate-50 text-slate-400'}`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 z-10">
        <div className={`w-1 h-1 rounded-full ${color === 'indigo' ? 'bg-indigo-400' : color === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
        <p className="text-[11px] font-semibold text-slate-400">{subtitle}</p>
      </div>
      {/* Subtle background decoration */}
      <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-slate-50/50 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700"></div>
    </div>
  );
};

const EmptyChart = ({ message }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
      <History size={24} />
    </div>
    <p className="text-xs font-bold text-slate-300">{message}</p>
  </div>
);

const LogEntryForm = ({ fuelRates, profile, onSave }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    waypoints: [
      { id: 'start', label: '출발지', address: '', alias: '', purpose: '', lat: 37.5665, lng: 126.9780 },
      { id: 'end', label: '도착지', address: '', alias: '', purpose: '', lat: 37.4979, lng: 127.0276 }
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
    const allWaypointsHavePurpose = formData.waypoints.every(wp => wp.purpose && wp.purpose.trim() !== '');
    return hasDistance && allWaypointsNamed && allWaypointsHaveAddress && allWaypointsHavePurpose;
  }, [formData.distance, formData.waypoints]);

  const calculatedAmount = useMemo(() => {
    const rate = fuelRates[formData.fuelType]?.unitPrice || 0;
    return Math.round(formData.distance * rate);
  }, [formData.distance, formData.fuelType, fuelRates]);

  const openSearch = (index) => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        const fullAddress = data.address;

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
                lat: realLat,
                lng: realLng
              };
              setFormData({ ...formData, waypoints: newWaypoints });
            } else {
              // 검색 실패 시 기존 로직 유지 (폴백)
              applyFallbackCoords(index, fullAddress);
            }
          });
        } else {
          // SDK 미로드 시 기존 로직 유지 (폴백)
          applyFallbackCoords(index, fullAddress);
        }
      }
    }).open();
  };

  const applyFallbackCoords = (index, fullAddress) => {
    const seed = fullAddress.length;
    const mockLat = 37.5 + (seed % 100) / 500;
    const mockLng = 127.0 + (seed % 100) / 500;

    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = { 
      ...newWaypoints[index], 
      address: fullAddress,
      lat: mockLat,
      lng: mockLng
    };
    setFormData({ ...formData, waypoints: newWaypoints });
  };

  const handleQuickSelect = (index, location) => {
    // 저장된 장소가 이미 좌표를 가지고 있더라도, 정확도를 위해 다시 한번 지오코딩을 수행하는 것이 안전함
    // 특히 기존에 잘못 저장된(더미) 좌표가 있을 수 있으므로 주소를 기반으로 새로 검색함
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(location.address, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const newWaypoints = [...formData.waypoints];
          newWaypoints[index] = {
            ...newWaypoints[index],
            address: location.address,
            alias: location.name,
            lat: parseFloat(result[0].y),
            lng: parseFloat(result[0].x)
          };
          setFormData(prev => ({ ...prev, waypoints: newWaypoints }));
        } else {
          // 실패 시 기존 정보라도 활용
          applyQuickSelectDirectly(index, location);
        }
      });
    } else {
      applyQuickSelectDirectly(index, location);
    }
  };

  const applyQuickSelectDirectly = (index, location) => {
    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = {
      ...newWaypoints[index],
      address: location.address,
      alias: location.name,
      lat: location.lat || 37.5,
      lng: location.lng || 127.0
    };
    setFormData(prev => ({ ...prev, waypoints: newWaypoints }));
  };

  const handleAliasChange = (index, value) => {
    const newWaypoints = [...formData.waypoints];
    newWaypoints[index].alias = value;
    setFormData({ ...formData, waypoints: newWaypoints });
  };

  const handleStopPurposeChange = (index, value) => {
    const newWaypoints = [...formData.waypoints];
    newWaypoints[index].purpose = value;
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
      purpose: '',
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
        .map(w => `[${w.alias}${w.purpose ? ` (${w.purpose})` : ''}] ${w.address}`)
        .join(' → ')
    };
    
    onSave(payload);
    setFormData(prev => ({ 
      ...prev, 
      waypoints: [
        { id: 'start', label: '출발지', address: '', alias: '', purpose: '', lat: 37.5665, lng: 126.9780 },
        { id: 'end', label: '도착지', address: '', alias: '', purpose: '', lat: 37.4979, lng: 127.0276 }
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
          
          <div className="space-y-4">
            {formData.waypoints.map((wp, idx) => (
              <div key={wp.id} className="animate-fade-in group space-y-2">
                <div className="flex flex-wrap gap-2 ml-1">
                  {profile?.homeAddress && (
                    <button 
                      type="button" 
                      onClick={() => handleQuickSelect(idx, { name: profile.homeAlias || '우리집', address: profile.homeAddress, lat: profile.homeLat, lng: profile.homeLng })}
                      className="group/btn flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-black shadow-lg shadow-indigo-100/50 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
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
                      className="group/btn flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[10px] font-black shadow-sm hover:border-indigo-500 hover:text-indigo-600 hover:-translate-y-0.5 transition-all"
                    >
                      <span className="text-indigo-500 opacity-80">📍</span>
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
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:border-indigo-200 cursor-pointer focus:bg-white focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all font-bold text-slate-700 truncate"
                      value={wp.address}
                    />
                    {!wp.address && (
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500 pointer-events-none opacity-60">검색</span>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="명칭 (필수)" 
                      className={`w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 outline-none transition-all font-bold text-sm ${
                        wp.alias ? 'border-transparent text-slate-600 focus:border-indigo-400 focus:bg-white' : 'border-red-50 text-red-500 focus:border-red-200'
                      } truncate`}
                      value={wp.alias}
                      onChange={(e) => handleAliasChange(idx, e.target.value)}
                    />
                    {!wp.alias && (
                      <span className="absolute -top-6 right-1 text-[9px] font-black text-red-500 animate-pulse">필수</span>
                    )}
                  </div>

                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="방문 목적 (필수)" 
                      className={`w-full px-4 py-4 rounded-2xl bg-slate-50 border-2 outline-none transition-all font-bold text-sm truncate ${
                        wp.purpose ? 'border-transparent text-slate-600 focus:border-indigo-400 focus:bg-white' : 'border-red-50 text-red-500 focus:border-red-200'
                      }`}
                      value={wp.purpose}
                      onChange={(e) => handleStopPurposeChange(idx, e.target.value)}
                    />
                    {!wp.purpose && (
                      <span className="absolute -top-6 right-1 text-[9px] font-black text-red-500 animate-pulse">필수</span>
                    )}
                  </div>

                  {idx > 0 && idx < formData.waypoints.length - 1 ? (
                    <button 
                      type="button" 
                      onClick={() => removeStop(idx)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-all active:scale-90"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 premium-card p-8 rounded-[2.5rem]">
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Total Distance</p>
              <button 
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isManualDistance: !prev.isManualDistance }))}
                className={`text-[10px] font-black px-3 py-1.5 rounded-xl transition-all ${
                  formData.isManualDistance ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400 border border-slate-100'
                }`}
              >
                {formData.isManualDistance ? '수동 보정 활성' : '수동 입력 전환'}
              </button>
            </div>
            <div className="flex items-baseline gap-1">
              {formData.isManualDistance ? (
                <div className="flex items-baseline gap-2">
                  <input 
                    type="number"
                    step="0.1"
                    className="w-24 text-3xl font-black text-indigo-600 bg-transparent border-b-4 border-indigo-400 outline-none px-1"
                    value={formData.distance}
                    onChange={(e) => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-base font-black text-slate-400">km</span>
                </div>
              ) : (
                <div className="text-4xl font-black text-slate-900 flex items-baseline gap-1 tracking-tight">
                  {formData.distance} <span className="text-lg text-slate-400">km</span>
                </div>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-2 px-1">
              {formData.isManualDistance ? '실제 계기판 거리를 직접 입력하세요.' : '시스템 자동 산출 직선 거리 (도로 보정 1.25x 적용)'}
            </p>
          </div>
          <div className="p-8 rounded-3xl bg-premium-gradient shadow-2xl shadow-indigo-200 text-white flex justify-between items-center transition-all duration-500 hover:scale-[1.02]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Expected Amount</p>
              <h4 className="text-3xl font-black">{calculatedAmount.toLocaleString()}<span className="text-base ml-1.5 opacity-60">원</span></h4>
            </div>
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 self-center">
              <Calculator size={28} className="opacity-90" />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={!isFormValid}
          className={`w-full py-6 rounded-2xl font-black text-lg transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] ${
            isFormValid 
            ? 'bg-slate-900 text-white shadow-indigo-100 hover:bg-black' 
            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
          }`}
        >
          <PlusCircle size={22} /> 
          {formData.distance > 0 ? '전체 정산 데이터 기록 완료하기' : '주소와 장소명을 입력해 주세요'}
        </button>
      </form>
    </div>
  );
};

const InputGroup = ({ label, icon, children }) => (
  <div className="space-y-3">
    <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 group-focus-within:text-indigo-500 transition-colors">
      <span className="text-indigo-400 group-focus-within:animate-pulse">{icon}</span>
      {label}
    </label>
    {children}
  </div>
);

const HistoryTable = ({ logs, onDelete }) => {
  return (
    <div className="premium-card rounded-[2.5rem] overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-left table-fixed">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="w-[180px] px-4 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">운행 정보</th>
              <th className="px-4 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">운행 경로 및 목적</th>
              <th className="w-[180px] px-4 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">구간 및 유종</th>
              <th className="w-[180px] px-4 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">정산 금액</th>
              <th className="w-[100px] px-4 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center whitespace-nowrap">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-8 py-24 text-center">
                  <div className="flex flex-col items-center gap-5">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                      <History size={32} />
                    </div>
                    <p className="text-slate-400 font-bold">아직 기록된 운행 내역이 없습니다.</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-0">
                  <td className="px-8 py-7">
                    <div className="font-black text-slate-900 text-sm whitespace-nowrap">{log.date}</div>
                    <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                      {log.userName}
                    </div>
                  </td>
                  <td className="px-8 py-7">
                    <div className="text-[13px] font-bold text-slate-700 flex flex-wrap items-center gap-1.5 leading-relaxed max-w-xl">
                      {log.routeSummary ? (
                        log.routeSummary.split(' → ').map((stop, sIdx, arr) => (
                          <React.Fragment key={sIdx}>
                            <span className="bg-slate-50 px-2 py-0.5 rounded text-[11px] font-black text-slate-500 whitespace-nowrap">{stop}</span>
                            {sIdx < arr.length - 1 && <ChevronRight size={10} className="text-slate-300 shrink-0 mx-0.5" />}
                          </React.Fragment>
                        ))
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-50 px-2 py-0.5 rounded text-[11px] font-black text-slate-500">{log.departure}</span>
                          <ChevronRight size={12} className="text-slate-300" /> 
                          <span className="bg-slate-50 px-2 py-0.5 rounded text-[11px] font-black text-slate-500">{log.destination}</span>
                        </div>
                      )}
                    </div>
                    {log.purpose && (
                      <div className="text-[10px] font-black text-indigo-500 mt-2.5 bg-indigo-50/50 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <FileText size={10} />
                        {log.purpose}
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-7 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="font-black text-slate-900 text-sm whitespace-nowrap">{log.distance} <span className="text-[10px] font-bold text-slate-400">km</span></div>
                      <div className={`text-[9px] px-2 py-1 rounded-lg font-black inline-block uppercase tracking-tight shrink-0 ${
                        log.fuelType === 'gasoline' ? 'bg-indigo-50 text-indigo-600' : 
                        log.fuelType === 'diesel' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {log.fuelType === 'gasoline' ? '휘발유' : log.fuelType === 'diesel' ? '경유' : 'LPG'}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-7 text-right">
                    <div className="font-black text-indigo-600 text-[17px] whitespace-nowrap tracking-tight">{Number(log.amount || 0).toLocaleString()} <span className="text-[11px] font-bold opacity-60">원</span></div>
                  </td>
                  <td className="px-8 py-7 text-center">
                    <button 
                      onClick={() => onDelete(log.id)}
                      className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                    >
                      <Trash2 size={18} />
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

const SettingsPanel = ({ fuelRates, onUpdate, db, appId }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [localRates, setLocalRates] = useState(fuelRates);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch rates when selected month changes
  useEffect(() => {
    const fetchSelectedMonthRates = async () => {
      setIsLoading(true);
      try {
        const rateRef = doc(db, 'artifacts', appId, 'public', 'data', 'fuelRates', selectedMonth);
        const snap = await getDoc(rateRef);
        if (snap.exists()) {
          setLocalRates(snap.data());
        } else {
          // If no data for selected month, use current app fuelRates as base
          setLocalRates(fuelRates);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSelectedMonthRates();
  }, [selectedMonth, db, appId]);

  const handleChange = (fuel, field, value) => {
    setLocalRates({
      ...localRates,
      [fuel]: { ...localRates[fuel], [field]: Number(value) }
    });
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h3 className="text-2xl font-black text-slate-800">유류비 산정 기준 관리</h3>
          <p className="text-sm font-bold text-slate-400">인사팀 전용: 월별 유류비 지급 기준을 설정합니다.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <Calendar size={20} className="text-blue-600" />
          <input 
            type="month" 
            className="bg-transparent font-black text-slate-700 outline-none cursor-pointer"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>



      {isLoading ? (
        <div className="py-20 text-center font-black text-slate-300">데이터를 불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          {['gasoline', 'diesel', 'lpg'].map((fuel) => (
            <div key={fuel} className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end border-b border-slate-50 pb-6 last:border-0 last:pb-0 font-['Outfit']">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">유종 구분</label>
                <div className="w-full px-5 h-[64px] flex items-center rounded-2xl bg-slate-50 font-black text-slate-700 border-2 border-slate-50 uppercase tracking-tight text-sm">
                  {fuel === 'gasoline' ? '휘발유 (Premium)' : fuel === 'diesel' ? '경유 (Diesel)' : '액화석유가스 (LPG)'}
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">평균 판매가 (원/L)</label>
                <div className="w-full px-5 h-[64px] flex items-center rounded-2xl bg-slate-50 font-black text-slate-700 border-2 border-slate-50 text-sm">
                  {localRates[fuel]?.avgPrice || 0}
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">{selectedMonth.split('-')[1]}월 KM당 단가</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full px-5 h-[64px] rounded-2xl border-2 border-blue-100 bg-blue-50/20 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-400 outline-none transition-all font-black text-blue-600 text-sm"
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
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Historical Logic</p>
                 <p className="text-sm font-bold text-slate-700">{selectedMonth}월 기준 데이터로 최종 처리됨</p>
               </div>
            </div>
            <button 
              onClick={() => onUpdate(localRates, selectedMonth)}
              className="w-full md:w-auto bg-blue-600 text-white px-12 py-5 rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
            >
              {selectedMonth}월 기준값 저장하기
            </button>
          </div>
        </div>
      )}
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
        const fullAddress = data.address;
        
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
          const geocoder = new window.kakao.maps.services.Geocoder();
          geocoder.addressSearch(fullAddress, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
              setLocalProfile(prev => ({
                ...prev,
                homeAddress: fullAddress,
                homeAlias: prev.homeAlias || '우리집',
                homeLat: parseFloat(result[0].y),
                homeLng: parseFloat(result[0].x)
              }));
            }
          });
        } else {
          setLocalProfile(prev => ({
            ...prev,
            homeAddress: fullAddress,
            homeAlias: prev.homeAlias || '우리집',
            homeLat: 37.5,
            homeLng: 126.9
          }));
        }
      }
    }).open();
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center gap-5">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 shrink-0">
          <UserCircle size={28} />
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{profile?.userName} 님</h3>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{profile?.department || '부서 미지정'}</span>
            <span className="text-[12px] font-bold text-slate-400">{profile?.email}</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <section className="space-y-3 p-5 bg-slate-50/50 rounded-2xl border border-slate-50">
          <div className="flex items-center gap-2 px-1">
            <MapPin size={16} className="text-indigo-500" />
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">기본 출발지 설정 (집 주소)</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
             <div className="md:col-span-3">
                <input 
                  type="text" 
                  readOnly 
                  placeholder="주소 검색 버튼을 눌러주세요"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 font-bold text-slate-700 outline-none text-sm"
                  value={localProfile.homeAddress} 
                />
             </div>
             <button 
               onClick={openHomeSearch}
               className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-black hover:bg-indigo-700 transition-all text-xs shadow-md shadow-indigo-100"
             >
               주소 검색
             </button>
             <div className="md:col-span-4">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">집 별칭 :</label>
                  <input 
                    type="text" 
                    className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-100 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all font-bold text-slate-700 text-sm"
                    value={localProfile.homeAlias}
                    onChange={(e) => setLocalProfile({...localProfile, homeAlias: e.target.value})}
                  />
                </div>
             </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <PlusCircle size={16} className="text-indigo-500" />
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">자주 가는 장소 (즐겨찾기)</h4>
            </div>
            <button 
              onClick={() => {
                new window.daum.Postcode({
                  oncomplete: function(data) {
                    const fullAddress = data.address;
                    const placeName = data.buildingName || data.bname || '새 장소';

                    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                      const geocoder = new window.kakao.maps.services.Geocoder();
                      geocoder.addressSearch(fullAddress, (result, status) => {
                        if (status === window.kakao.maps.services.Status.OK) {
                          const newLoc = {
                            id: Date.now(),
                            name: placeName,
                            address: fullAddress,
                            lat: parseFloat(result[0].y),
                            lng: parseFloat(result[0].x)
                          };
                          setLocalProfile(prev => ({
                             ...prev,
                             savedLocations: [...(prev.savedLocations || []), newLoc]
                          }));
                        }
                      });
                    }
                  }
                }).open();
              }}
              className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-tighter"
            >
              + 장소 추가
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             {(localProfile.savedLocations || []).length === 0 ? (
               <div className="py-4 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-100 md:col-span-2">
                 <p className="text-[10px] font-bold text-slate-400">등록된 장소가 없습니다.</p>
               </div>
             ) : (
               localProfile.savedLocations.map((loc) => (
                 <div key={loc.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                   <div className="flex items-center gap-3 flex-1 overflow-hidden">
                      <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors shrink-0">
                        <MapPin size={16} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <input 
                          className="w-full text-sm font-black text-slate-800 bg-transparent border-none p-0 focus:ring-0 outline-none"
                          value={loc.name}
                          placeholder="명칭 입력"
                          onChange={(e) => {
                            const newList = localProfile.savedLocations.map(l => l.id === loc.id ? {...l, name: e.target.value} : l);
                            setLocalProfile({...localProfile, savedLocations: newList});
                          }}
                        />
                        <p className="text-[10px] font-bold text-slate-400 truncate">{loc.address}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => {
                        const newList = localProfile.savedLocations.filter(l => l.id !== loc.id);
                        setLocalProfile({...localProfile, savedLocations: newList});
                     }}
                     className="p-2 text-slate-200 hover:text-red-500 transition-all shrink-0"
                   >
                     <Trash2 size={16} />
                   </button>
                 </div>
               ))
             )}
          </div>
        </section>

        <section className="space-y-4 p-5 bg-slate-50/50 rounded-2xl border border-slate-50">
          <div className="flex items-center gap-2 px-1">
            <Fuel size={16} className="text-indigo-500" />
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">차량 및 주종 정보</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">차량 별명</label>
                <input 
                   type="text" 
                   className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-bold text-slate-700 text-sm"
                   placeholder="예: 쏘렌토"
                   value={localProfile.vehicleName}
                   onChange={(e) => setLocalProfile({...localProfile, vehicleName: e.target.value})}
                />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">기본 유종</label>
                <select 
                   className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-bold text-slate-700 text-sm appearance-none"
                   value={localProfile.fuelType}
                   onChange={(e) => setLocalProfile({...localProfile, fuelType: e.target.value})}
                >
                   <option value="gasoline">휘발유 (Gasoline)</option>
                   <option value="diesel">경유 (Diesel)</option>
                   <option value="lpg">액화석유가스 (LPG)</option>
                </select>
             </div>
          </div>
        </section>

        <div className="pt-2">
          <button 
            onClick={() => onUpdate(localProfile)}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 text-base"
          >
            개인 설정값 저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Enhanced Components ---

const Sidebar = ({ currentView, onNavigate, onLogout, isAdmin, userProfile, isCollapsed, onToggle }) => (
  <nav className={`fixed bottom-0 lg:top-0 left-0 w-full ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} bg-white border-t lg:border-t-0 lg:border-r border-slate-100 flex lg:flex-col p-4 lg:p-6 z-50 transition-all duration-500 ease-in-out`}>
    <div className={`hidden lg:flex items-center ${isCollapsed ? 'justify-center mb-10' : 'justify-between mb-12 px-2'}`}>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
          <Car size={20} strokeWidth={3} />
        </div>
        {!isCollapsed && (
          <div className="animate-fade-in">
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">C-OIL</h1>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mt-1">Platform</p>
          </div>
        )}
      </div>
      {!isCollapsed && (
        <button 
          onClick={onToggle}
          className="p-1.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
        >
          <PanelLeftClose size={16} />
        </button>
      )}
    </div>

    {isCollapsed && (
      <button 
        onClick={onToggle}
        className="hidden lg:flex items-center justify-center p-3 mb-8 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
      >
        <PanelLeftOpen size={18} />
      </button>
    )}

    <div className="flex lg:flex-col flex-1 gap-1 lg:gap-2">
      <NavItem isCollapsed={isCollapsed} icon={<LayoutDashboard />} label="대시보드" active={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
      <NavItem isCollapsed={isCollapsed} icon={<PlusCircle />} label="신규 운행" active={currentView === 'log'} onClick={() => onNavigate('log')} />
      <NavItem isCollapsed={isCollapsed} icon={<History />} label="정산 내역" active={currentView === 'history'} onClick={() => onNavigate('history')} />
      {isAdmin && (
        <>
          <div className={`hidden lg:block h-px bg-slate-100 my-3 ${isCollapsed ? 'mx-2' : 'mx-4'}`}></div>
          <NavItem isCollapsed={isCollapsed} icon={<FileText />} label="운행 통계" active={currentView === 'reports'} onClick={() => onNavigate('reports')} />
          <NavItem isCollapsed={isCollapsed} icon={<Settings />} label="기준 단가" active={currentView === 'settings'} onClick={() => onNavigate('settings')} />
          <NavItem isCollapsed={isCollapsed} icon={<Users />} label="인사 관리" active={currentView === 'admin'} onClick={() => onNavigate('admin')} />
        </>
      )}
      <div className="flex-1 hidden lg:block"></div>
      <NavItem isCollapsed={isCollapsed} icon={<UserCircle />} label="내 정보" active={currentView === 'profile'} onClick={() => onNavigate('profile')} />
      <button 
        onClick={onLogout}
        className={`hidden lg:flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-5'} py-4 rounded-2xl text-[13px] font-bold text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all mt-4`}
      >
        {isCollapsed ? <LogOut size={20} /> : <><LogOut size={16} /> <span>로그아웃</span></>}
      </button>
    </div>
  </nav>
);

const AuthScreen = ({ onLogin, onSignup, orgUnits: initialOrgUnits, db, appId }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [orgUnits, setOrgUnits] = useState(initialOrgUnits || []);

  useEffect(() => {
    // 로그인이 안된 상태에서도 조직 정보를 가져와야 함
    const orgRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'orgUnits');
    const unsubscribe = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) setOrgUnits(snap.data().units || []);
    });
    return () => unsubscribe();
  }, [db, appId]);

  return (
    <div className="min-h-screen bg-[#f1f4f9] flex items-center justify-center p-4 lg:p-10 font-['Outfit'] relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-60"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-blue-100 rounded-full blur-[100px] opacity-60"></div>
      
      <div className="bg-white w-full max-w-[1150px] min-h-[700px] rounded-[3.5rem] shadow-[0_32px_80px_-16px_rgba(30,41,59,0.1)] overflow-hidden flex flex-col lg:flex-row relative z-10 border border-white">
        {/* Left Panel: Branding & Story */}
        <div className="lg:w-[45%] bg-[#0f172a] p-12 lg:p-16 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Advanced Mesh Gradient Overlay */}
          <div className="absolute top-0 right-0 w-[120%] h-[120%] bg-gradient-to-tr from-indigo-900/40 via-blue-900/20 to-transparent pointer-events-none"></div>
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-600/30 rounded-full blur-[80px]"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-600/20 rounded-full blur-[80px]"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 mb-12">
               <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">System v2.4.0</span>
            </div>
            
            <div className="w-[100px] h-[100px] bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-12 shadow-2xl shadow-indigo-500/30 border border-indigo-400/30">
              <Car size={50} className="text-white" strokeWidth={2.5} />
            </div>
            
            <h2 className="text-5xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-8">
              가장 스마트한<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-300">유류비 정산.</span>
            </h2>
            
            <p className="text-slate-400 font-bold text-lg leading-relaxed max-w-sm">
              인공지능 기반 거리 자동 산출 시스템으로 투명하고 빠른 유류대 지급을 경험하세요.
            </p>
          </div>
          
          <div className="relative z-10 space-y-8">
            <div className="pt-10 border-t border-white/10">
              <div className="flex items-center gap-10">
                <div>
                  <p className="text-3xl font-black text-white">99.8%</p>
                  <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mt-1">Accuracy</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">5k+</p>
                  <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mt-1">Daily Logs</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`w-9 h-9 rounded-full border-2 border-[#0f172a] bg-indigo-${i*100+200}`}></div>
                ))}
              </div>
              <p className="text-xs font-bold text-slate-500">전사 임직원이 함께 사용 중입니다.</p>
            </div>
          </div>
        </div>
        
        {/* Right Panel: Auth Form */}
        <div className="flex-1 p-12 lg:p-24 bg-white flex flex-col justify-center">
          <div className="max-w-[420px] mx-auto w-full">
            <div className="mb-12">
              <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
                {isLogin ? '환영합니다.' : '신규 가입'}
              </h3>
              <p className="text-slate-500 font-bold leading-relaxed">
                {isLogin 
                  ? '시스템 접근을 위해 등록된 사내 계정으로 로그인해 주세요.' 
                  : '유류비 정산 플랫폼 사용을 위해 가입 신청을 진행해 주세요.'}
              </p>
            </div>

            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              isLogin ? onLogin(email, password) : onSignup(email, password, name, department);
            }}>
              {!isLogin && (
                <div className="animate-slide-up space-y-6">
                  <div className="space-y-2">
                    <InputLabel label="사용자 성명" />
                    <div className="relative">
                      <User size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text"
                        className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                        placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} required 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <InputLabel label="소속 부서 선택" />
                    <div className="relative">
                      <Users size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select 
                        className="w-full pl-14 pr-10 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        required
                      >
                        <option value="">부서를 선택해 주세요</option>
                        {orgUnits.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                      <ChevronRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <InputLabel label="사내 이메일 계정" />
                <div className="relative">
                  <Mail size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email"
                    className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                    placeholder="example@co.kr" value={email} onChange={e => setEmail(e.target.value)} required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <InputLabel label="접속 비밀번호" />
                  {isLogin && (
                    <button type="button" className="text-[11px] font-black text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-tight">Forgot PW?</button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="password"
                    className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required 
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xl shadow-2xl shadow-indigo-100 mt-6 active:scale-[0.98] hover:bg-black transition-all group flex items-center justify-center gap-3">
                <span>{isLogin ? '플랫폼 로그인' : '가입 신청 진행하기'}</span>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="mt-12 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-100"></div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">or</span>
              <div className="h-px flex-1 bg-slate-100"></div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm font-bold text-slate-400 mb-4">
                {isLogin ? '아직 사내 계정이 없으신가요?' : '이미 계정이 설정되어 있나요?'}
              </p>
              <button 
                onClick={() => setIsLogin(!isLogin)} 
                className="w-full py-4 rounded-2xl border-2 border-slate-100 text-slate-600 font-black text-sm hover:border-indigo-200 hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                {isLogin ? '신규 계정 참가 신청하기' : '기존 계정으로 이동하기'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative footer text */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] pointer-events-none">
        Secure Access Interface · Enterprise Mobility Platform
      </div>
    </div>
  );
};

const InputLabel = ({ label }) => (
  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block px-1">
    {label}
  </label>
);

const AdminPanel = ({ db, appId, orgUnits, setOrgUnits }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'profiles'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [db, appId]);

  const updateOrgUnitsRemote = async (newUnits) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'orgUnits'), { units: newUnits });
    setOrgUnits(newUnits);
  };

  const updateUser = async (uid, updates) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', uid), updates);
  };

  const deleteUser = async (uid) => {
    if (confirm('정말 이 계정을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', uid));
    }
  };

  const [newOrgUnit, setNewOrgUnit] = useState('');

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchName = user.userName?.toLowerCase().includes(term);
    const matchEmail = user.email?.toLowerCase().includes(term);
    const matchDept = deptFilter === 'all' || user.department === deptFilter;
    return (matchName || matchEmail) && matchDept;
  });

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
              <Users className="text-indigo-600" /> 구성원 및 권한 관리
            </h3>
            <span className="bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-black text-indigo-500 uppercase tracking-widest">
              Total {filteredUsers.length} Users
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-4 px-2">
            <div className="flex-[2] relative">
              <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="성함 또는 이메일로 검색" 
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-400 transition-all font-bold text-slate-700 placeholder:text-slate-300 text-[13px] shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-1 relative">
              <Users size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                className="w-full pl-14 pr-10 py-4 rounded-2xl bg-white border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-400 transition-all font-bold text-slate-700 appearance-none cursor-pointer text-[13px] shadow-sm"
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
              >
                <option value="all">전체 부서 필터</option>
                {orgUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                <option value="미지정">부서 미지정</option>
              </select>
              <ChevronRight size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
            </div>
          </div>

          <div className="premium-card rounded-[2.5rem] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">사용자 정보</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">부서 / 권한</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">상태</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map(u => (
                  <tr key={u.uid} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{u.userName}</div>
                      <div className="text-[11px] font-bold text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-8 py-6">
                      <select 
                        className="bg-slate-50 text-[11px] font-black px-3 py-2 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                        value={u.department}
                        onChange={(e) => updateUser(u.uid, { department: e.target.value })}
                      >
                        {orgUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                      <div className={`text-[9px] font-black mt-2 uppercase tracking-tighter ${u.role === 'admin' ? 'text-blue-600' : 'text-slate-400'}`}>
                        {u.role === 'admin' ? 'Administrator' : 'General Staff'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button 
                        onClick={() => updateUser(u.uid, { status: u.status === 'approved' ? 'pending' : 'approved' })}
                        className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all ${
                          u.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 ring-2 ring-amber-200'
                        }`}
                      >
                        {u.status === 'approved' ? '정식 승인됨' : '승인 대기중'}
                      </button>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                         <button 
                           onClick={() => updateUser(u.uid, { role: u.role === 'admin' ? 'staff' : 'admin' })}
                           className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                           title="권한 변경"
                         >
                           <Settings size={18} />
                         </button>
                         <button 
                           onClick={() => deleteUser(u.uid)}
                           className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                         >
                           <Trash2 size={18} />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

         <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 px-2 tracking-tight">조직 구성 관리</h3>
            <div className="premium-card p-8 rounded-[2.5rem] space-y-6">
               <p className="text-xs font-bold text-slate-400 leading-relaxed">회사의 부서 체계를 관리합니다. 등록된 부서는 직원 프로필 설정에서 바로 선택할 수 있습니다.</p>
               <div className="space-y-3">
                 {orgUnits.map((unit, idx) => (
                   <div key={idx} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl group hover:border-indigo-200 hover:bg-indigo-50/20 transition-all">
                     <span className="font-black text-slate-700 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm">{unit}</span>
                     <button 
                       onClick={() => updateOrgUnitsRemote(orgUnits.filter((_, i) => i !== idx))} 
                       className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                 ))}
               </div>
               <div className="pt-4">
                 <input 
                   type="text" 
                   placeholder="새 부서 추가 (엔터)"
                   className="w-full px-6 py-5 rounded-2xl border-2 border-dashed border-slate-100 focus:border-indigo-400 focus:bg-white outline-none font-black text-sm transition-all text-slate-600"
                   value={newOrgUnit}
                   onChange={(e) => setNewOrgUnit(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.nativeEvent.isComposing && newOrgUnit.trim()) {
                       updateOrgUnitsRemote([...orgUnits, newOrgUnit.trim()]);
                       setNewOrgUnit('');
                     }
                   }}
                 />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

const ManagementReport = ({ logs, users, db, appId, filters, onFilterChange }) => {
  // 월 변경 시 시작/종료일 자동 설정
  const handleMonthChange = (month) => {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, m, 0).toISOString().slice(0, 10);
    onFilterChange(prev => ({ ...prev, selectedMonth: month, startDate: start, endDate: end }));
  };

  const [orgUnits, setOrgUnits] = useState(['본사', '연구소', '영업부', '현장']);

  useEffect(() => {
    const orgRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'orgUnits');
    const unsubscribe = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) setOrgUnits(snap.data().units || []);
    });
    return () => unsubscribe();
  }, [db, appId]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const user = users.find(u => u.uid === log.userId);
      const logDept = user?.department || '미지정';
      
      const matchDept = filters.department === 'all' || logDept === filters.department;
      const matchUser = filters.userId === 'all' || log.userId === filters.userId;
      const matchStart = !filters.startDate || log.date >= filters.startDate;
      const matchEnd = !filters.endDate || log.date <= filters.endDate;
      
      return matchDept && matchUser && matchStart && matchEnd;
    });
  }, [logs, users, filters]);

  const stats = useMemo(() => {
    const totalDist = filteredLogs.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const totalAmount = filteredLogs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return { totalDist, totalAmount, count: filteredLogs.length };
  }, [filteredLogs]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="premium-card p-8 rounded-[2.5rem]">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><FileText size={18} /></div>
             <h4 className="text-lg font-black text-slate-800 tracking-tight">정산 데이터 실시간 필터</h4>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">부서별 필터</label>
            <select 
              className="w-full px-6 py-4.5 rounded-2xl bg-slate-50 border border-slate-100 font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:bg-white focus:border-indigo-400 transition-all appearance-none cursor-pointer text-sm"
              value={filters.department}
              onChange={e => onFilterChange({...filters, department: e.target.value, userId: 'all'})}
            >
              <option value="all">전체 부서 데이터</option>
              {orgUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              <option value="미지정">미지정 구성원</option>
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">특정 구성원 조회</label>
            <select 
              className="w-full px-6 py-4.5 rounded-2xl bg-slate-50 border border-slate-100 font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:bg-white focus:border-indigo-400 transition-all appearance-none cursor-pointer text-sm"
              value={filters.userId}
              onChange={e => onFilterChange({...filters, userId: e.target.value})}
            >
              <option value="all">전체 인원 합산</option>
              {users
                .filter(u => filters.department === 'all' || u.department === filters.department)
                .map(u => <option key={u.uid} value={u.uid}>{u.userName}</option>)
              }
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] ml-1">월 단위 빠른 조회</label>
            <div className="relative group">
              <input 
                type="month" 
                className="w-full px-6 py-4.5 rounded-2xl bg-indigo-600 text-white font-black outline-none focus:ring-4 focus:ring-indigo-200 transition-all appearance-none cursor-pointer text-sm shadow-xl shadow-indigo-100"
                value={filters.selectedMonth}
                onChange={e => handleMonthChange(e.target.value)}
              />
              <Calendar size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">상세 기간 및 범위</label>
            <div className="flex gap-2 items-center">
              <input 
                type="date" 
                className="flex-1 px-4 py-4.5 rounded-2xl bg-slate-50 border border-slate-100 font-black text-slate-700 text-[11px] outline-none focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all"
                value={filters.startDate}
                onChange={e => onFilterChange({...filters, startDate: e.target.value})}
              />
              <span className="text-slate-300 font-black">~</span>
              <input 
                type="date" 
                className="flex-1 px-4 py-4.5 rounded-2xl bg-slate-50 border border-slate-100 font-black text-slate-700 text-[11px] outline-none focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all"
                value={filters.endDate}
                onChange={e => onFilterChange({...filters, endDate: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard title="검색 결과 합계" value={`${stats.totalAmount.toLocaleString()}원`} subtitle="선택된 조건의 총 정산액" icon={<Calculator />} color="indigo" />
        <StatCard title="검색 누적 거리" value={`${stats.totalDist.toFixed(1)}km`} subtitle="선택된 조건의 총 운행거리" icon={<Navigation />} color="emerald" />
      </div>

      <div className="premium-card rounded-[2.5rem] overflow-hidden">
        <table className="w-full text-left table-fixed">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="w-[140px] px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">날짜</th>
              <th className="w-[200px] px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">사용자 / 부서</th>
              <th className="px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">운행 상세 정보</th>
              <th className="w-[180px] px-6 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">거리 및 정산액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-8 py-20 text-center font-bold text-slate-400 italic">조회된 내역이 없습니다.</td>
              </tr>
            ) : (
              filteredLogs.map(log => {
                const user = users.find(u => u.uid === log.userId);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-7 align-top">
                      <div className="font-black text-[13px] text-slate-900">{log.date.slice(5)}</div>
                    </td>
                    <td className="px-8 py-7 align-top">
                      <div className="font-black text-slate-800 text-[13px] group-hover:text-indigo-600 transition-colors">{log.userName}</div>
                      <div className="text-[10px] font-black text-indigo-500 mt-1 uppercase tracking-tight">{user?.department || '미지정'}</div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="text-[12px] font-bold text-slate-600 leading-relaxed truncate group-hover:text-slate-900 transition-colors">
                        {log.routeSummary || `${log.departure} → ${log.destination}`}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 mt-2.5 bg-slate-50 px-2 py-1 rounded-lg inline-flex items-center gap-1.5 border border-slate-100">
                         <FileText size={10} />
                         {log.purpose || '업무 목적 미기재'}
                      </div>
                    </td>
                    <td className="px-8 py-7 text-right align-top">
                      <div className="font-black text-slate-900 whitespace-nowrap text-sm">{log.distance} <span className="text-[10px] text-slate-400 lowercase">km</span></div>
                      <div className="font-black text-indigo-600 text-[15px] mt-1 whitespace-nowrap tracking-tight">{Number(log.amount || 0).toLocaleString()}<span className="text-[10px] opacity-60 ml-0.5">원</span></div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
