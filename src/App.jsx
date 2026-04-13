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
  updateProfile as updateAuthProfile,
  sendPasswordResetEmail,
  updatePassword,
  confirmPasswordReset,
  verifyPasswordResetCode
} from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, deleteDoc, query, getDoc, updateDoc, orderBy, getDocs, writeBatch, where } from 'firebase/firestore';
import { 
  Trash2, 
  Download,
  Network,
  Users,
  AlertCircle,
  PlusCircle,
  Car,
  LayoutDashboard,
  History,
  Settings,
  Fuel,
  Calculator,
  ChevronRight,
  ChevronLeft,
  Menu,
  Lock,
  FileText,
  UserCircle,
  Bell,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Mail,
  LogOut,
  MapPin,
  Clock,
  Eye,
  EyeOff,
  Search,
  CheckCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MoreVertical,
  Edit2,
  ChevronDown,
  User,
  Calendar,
  X,
  Star
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
auth.languageCode = 'ko';
const db = getFirestore(app);
const appId = getSafeGlobal('__app_id', 'vehicle-fuel-tracker');

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const MASTER_ADMINS = ['esc913@composecoffee.co.kr', 'choihy@composecoffee.co.kr', 'jang_sw@composecoffee.co.kr'];
const isMasterAdmin = (email) => email && MASTER_ADMINS.includes(email.toLowerCase());

const formatOrgUnitLabel = (name) => {
  if (!name) return '';
  const parts = String(name).split(' > ');
  const depth = parts.length - 1;
  if (depth <= 0) return name;
  return '\u00A0\u00A0'.repeat(depth) + 'ㄴ ' + parts[parts.length - 1];
};

const App = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [view, setView] = useState('dashboard');
  const [editingLog, setEditingLog] = useState(null);
  const [resetCode, setResetCode] = useState(null);
  const [authAction, setAuthAction] = useState(null);
  const [logs, setLogs] = useState([]);
  const [fuelRates, setFuelRates] = useState({
    gasoline: { unitPrice: 229.55, avgPrice: 1836.41 },
    diesel: { unitPrice: 228.62, avgPrice: 1828.92 },
    lpg: { unitPrice: 101.17, avgPrice: 1011.67 },
    depreciation: 10
  });
  const [statusMessage, setStatusMessage] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [isNewUser, setIsNewUser] = useState(false);
  const [orgUnits, setOrgUnits] = useState(['(주)컴포즈커피', '(주)컴포즈커피 > 경영지원본부', '(주)컴포즈커피 > 경영지원본부 > IT지원팀', '(주)컴포즈커피 > 경영지원본부 > 법무팀', '(주)컴포즈커피 > 경영지원본부 > 인사총무팀']);
  const [reportFilters, setReportFilters] = useState({
    department: 'all',
    userId: 'all',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    selectedMonth: new Date().toISOString().slice(0, 7)
  });

  // 현재 사용자 프로필 실시간 동기화 및 상태 체크 (퇴사자 차단 등)
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    
    const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const unsubscribe = onSnapshot(profileRef, snap => {
      if (snap.exists()) {
        const profileData = snap.data();
        if (profileData.status === 'disabled') {
          showStatus("인사 처리에 의해 계정이 비활성화되었습니다. (퇴사 등 관리자 조치)", "error");
          signOut(auth);
          setUser(null);
          setProfile(null);
          return;
        }
        setProfile(profileData);
      }
    });

    return () => unsubscribe();
  }, [user, db, appId]);

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
          const existingProfile = userDoc.data();
          if (existingProfile.status === 'disabled') {
            showStatus("인사 처리에 의해 비활성화된 계정입니다. (퇴직 등)", "error");
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          setProfile(existingProfile);
          // 기존 사용자인데 차량/유종 미입력 시 내 정보 화면으로 이동
          if (!existingProfile.vehicleName || !existingProfile.fuelType) {
            setIsNewUser(true);
          }
        } else {
          const isMaster = isMasterAdmin(u.email);

          const newProfile = {
            uid: u.uid,
            email: u.email,
            userName: u.displayName || '신규 사용자',
            role: isMaster ? 'admin' : 'staff',
            status: 'approved', // 자동 승인 신청 시스템으로 변경
            department: isMaster ? '(주)컴포즈커피 > 경영지원본부 > 인사총무팀' : '미지정',
            vehicleName: '',
            fuelType: '',
            homeAddress: '',
            homeAlias: '우리집',
            savedLocations: []
          };
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
          setIsNewUser(true); // 신규 사용자 → 내 정보 화면으로 이동 트리거
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  const handleResetPassword = async (targetEmail) => {
    try {
      if (!targetEmail) return false;
      
      await sendPasswordResetEmail(auth, targetEmail);
      showStatus("비밀번호 재설정 이메일이 발송되었습니다. 메일함을 확인해 주세요.", "info");
      return true;
    } catch (err) {
      console.error(err);
      let msg = "발송에 실패했습니다.";
      if (err.code === 'auth/user-not-found') msg = "등록되지 않은 이메일 주소입니다.";
      showStatus(msg, "error");
      return false;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    
    if (mode === 'resetPassword' && oobCode) {
      setAuthAction('resetPassword');
      setResetCode(oobCode);
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    let timer;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
        showStatus("보안을 위해 10분간 무활동 시 자동 로그아웃되었습니다.", "info");
      }, 10 * 60 * 1000);
    };
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user]);
  
  // 신규 가입 또는 정보 미완성 시 내 정보 화면으로 자동 이동
  useEffect(() => {
    if (isNewUser && user && profile && (profile.status === 'approved' || isMasterAdmin(user.email))) {
      setView('profile');
      setIsNewUser(false);
      showStatus("차량명과 유종을 입력하면 바로 서비스를 이용할 수 있습니다.", "info");
    }
  }, [isNewUser, user, profile]);

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
        .filter(log => {
          if (profile?.role === 'admin') return true;
          if (profile?.role === 'manager') {
            // 본인 부서 또는 하위 부서의 내역 모두 조회 가능 (댑스 기반 처리)
            return (log.department && log.department.startsWith(profile.department)) || log.userId === user.uid;
          }
          return log.userId === user.uid;
        });
      setLogs(logsData);
    });

    return () => unsubscribeLogs();
  }, [user, profile?.role, profile?.status, profile?.department]);

  const showStatus = (msg, type = 'success', duration = 5000) => {
    setStatusMessage({ msg: String(msg), type });
    // 이미 타이머가 있다면 초기화하는 로직은 여기 없지만, 단순화를 위해 시간만 늘림
    setTimeout(() => setStatusMessage(null), duration);
  };

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showStatus("로그인 성공!");
    } catch (err) { 
      console.error("Login Error:", err.code, err.message);
      let msg = "로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.";
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = "등록되지 않은 아이디이거나 비밀번호가 일치하지 않습니다.";
      } else if (err.code === 'auth/wrong-password') {
        msg = "비밀번호가 올바르지 않습니다.";
      } else if (err.code === 'auth/invalid-email') {
        msg = "이메일 형식이 올바르지 않습니다.";
      } else if (err.code === 'auth/too-many-requests') {
        msg = "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
      }
      
      showStatus(msg, 'error', 8000); // 에러는 8초간 표시
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
        status: 'approved', // 자동 승인 시스템
        department: isMaster ? '인사팀' : (department || '미지정'),
        vehicleName: '',
        fuelType: '',
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
      
      showStatus(msg, 'error', 8000); 
    }
  };

  const logout = () => signOut(auth).then(() => setView('dashboard'));

  const saveLog = async (logData) => {
    try {
      const logId = logData.id || `log_${Date.now()}`;
      const payload = {
        ...logData,
        id: logId,
        userId: user.uid,
        userName: profile?.userName || user.email,
        department: profile?.department || '미지정',
        createdAt: logData.createdAt || new Date().toISOString(),
        requestStatus: 'none',
        requestType: null,
        requestReason: null
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', logId), payload);
      showStatus(logData.id ? "기록이 수정되었습니다." : "기록이 저장되었습니다.");
      setView('history');
      setEditingLog(null);
    } catch (e) {
      console.error(e);
      showStatus("저장 실패", 'error');
    }
  };

  const deleteLog = async (id) => {
    try {
      if (confirm('정말 이 기록을 삭제하시겠습니까?')) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', id));
        showStatus("삭제되었습니다.");
      }
    } catch { showStatus("삭제 실패", 'error'); }
  };

  const requestCorrection = async (id, requestType, reason) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', id), {
        requestStatus: 'pending',
        requestType,
        requestReason: reason,
        requestedAt: new Date().toISOString()
      });
      showStatus("보정 요청이 전송되었습니다.");
    } catch { showStatus("요청 실패", 'error'); }
  };

  const approveRequest = async (log) => {
    try {
      if (log.requestType === 'delete') {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', log.id));
        showStatus("요청 승인: 내역이 삭제되었습니다.");
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', log.id), {
          requestStatus: 'approved'
        });
        showStatus("요청 승인: 이제 해당 내역을 수정할 수 있습니다.");
      }
    } catch { showStatus("처리 실패", 'error'); }
  };

  const rejectRequest = async (id) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', id), {
        requestStatus: 'none'
      });
      showStatus("요청이 반려되었습니다.");
    } catch { showStatus("처리 실패", 'error'); }
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
      // 1. 기준 단가 저장 (월별 문서에 저장)
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'fuelRates', month), rates);
      
      // 2. 해당 월의 모든 기존 운행 내역을 새로운 단가로 재계산하여 업데이트 (소급 적용)
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
      const start = `${month}-01`;
      const end = `${month}-31`;
      const q = query(logsRef, where("date", ">=", start), where("date", "<=", end));
      const logSnap = await getDocs(q);
      
      const batch = writeBatch(db);
      let count = 0;
      
      logSnap.docs.forEach(logDoc => {
        const data = logDoc.data();
        const fuelType = data.fuelType || 'gasoline';
        const unitPrice = rates[fuelType]?.unitPrice || 0;
        const parkingTotal = Number(data.parkingTotal || 0);
        const newFuelAmount = Math.round(data.distance * unitPrice);
        const newTotalAmount = newFuelAmount + parkingTotal;
        
        if (data.amount !== newTotalAmount) {
          batch.update(logDoc.ref, { 
            amount: newTotalAmount,
            fuelAmount: newFuelAmount // 이 필드가 있다면 함께 업데이트
          });
          count++;
        }
      });
      
      await batch.commit();
      
      showStatus(`${month}월 기준 단가 저장 및 관련 내역(${count}건) 재계산 완료`);
      // App 전체에 공유되는 기본값도 업데이트 (필요 시)
      setFuelRates(rates);
    } catch (err) {
      console.error(err);
      showStatus('설정 저장 중 오류가 발생했습니다.', 'error');
    }
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

  const isAdmin = profile?.role === 'admin' || isMasterAdmin(user?.email); 

  return (
    <>
      {statusMessage && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[1000] px-8 py-5 rounded-[2rem] shadow-2xl border-2 animate-slide-up flex items-center gap-4 min-w-[320px] max-w-[90vw] ${
          statusMessage.type === 'error' 
            ? 'bg-red-50 text-red-700 border-red-100' 
            : statusMessage.type === 'info'
            ? 'bg-blue-50 text-blue-700 border-blue-100'
            : 'bg-green-50 text-green-700 border-green-100'
        }`}>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            statusMessage.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {statusMessage.type === 'error' ? <AlertCircle size={24} /> : <FileText size={24} />}
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">System Alert</p>
            <span className="font-black text-sm block leading-tight">{statusMessage.msg}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-2 hover:bg-black/5 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-screen flex items-center justify-center font-black text-slate-300">SYSTEM LOADING...</div>
      ) : authAction === 'resetPassword' ? (
        <PasswordResetView code={resetCode} onComplete={() => { setAuthAction(null); window.history.replaceState({}, document.title, window.location.pathname); }} />
      ) : !user ? (
        <AuthScreen onLogin={login} onSignup={signup} onResetPassword={handleResetPassword} orgUnits={orgUnits} db={db} appId={appId} />
      ) : (
        <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-['Outfit']">
          <Sidebar 
            currentView={view} 
            onNavigate={setView} 
            onLogout={logout} 
            isAdmin={isAdmin} 
            userProfile={profile} 
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            setEditingLog={setEditingLog}
            pendingRequestsCount={logs.filter(log => log.requestStatus === 'pending').length}
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
                    {view === 'dashboard' ? '대시보드' : view === 'log' ? (editingLog ? '운행 내역 수정' : '신규 운행 내역') : view === 'history' ? '정산 및 내역' : view === 'reports' ? '통계 리포트' : view === 'admin' ? '인사 관리' : view === 'orgchart' ? '조직도 안내' : '내 프로필'}
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
                {view === 'dashboard' && <Dashboard logs={logs} profile={profile} users={allUsers} orgUnits={orgUnits} />}
                {view === 'log' && <LogEntryForm key={editingLog?.id || 'new'} fuelRates={fuelRates} profile={profile} onSave={saveLog} initialData={editingLog} isAdmin={isAdmin} db={db} appId={appId} />}
                {view === 'history' && <HistoryTable logs={logs} onDelete={deleteLog} isAdmin={isAdmin} onRequestCorrection={requestCorrection} onUpdateLog={saveLog} onEdit={(log) => { setEditingLog(log); setView('log'); }} />}
                {view === 'reports' && <ManagementReport logs={logs} users={allUsers} db={db} appId={appId} filters={reportFilters} onFilterChange={setReportFilters} orgUnits={orgUnits} />}
                {view === 'admin' && <AdminPanel db={db} appId={appId} orgUnits={orgUnits} setOrgUnits={setOrgUnits} logs={logs} onApproveRequest={approveRequest} onRejectRequest={rejectRequest} fuelRates={fuelRates} onUpdateSettings={updateSettings} />}
                {view === 'orgchart' && <OrgChartView orgUnits={orgUnits} users={allUsers} db={db} appId={appId} setOrgUnits={setOrgUnits} />}
                {view === 'profile' && <MyPage profile={profile} onUpdate={updateProfile} />}
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- Sub-Components ---

const NavItem = ({ icon, label, active, onClick, isCollapsed, disabled, badge }) => (
  <button 
    onClick={disabled ? () => {} : onClick}
    className={`w-full flex items-center gap-3 ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-3.5 rounded-2xl text-[13px] font-bold transition-all duration-300 group relative ${
      disabled ? 'opacity-30 cursor-not-allowed' :
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
    {badge > 0 && (
      <span className={`absolute ${isCollapsed ? 'top-1 right-1' : 'right-4'} flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-sm ring-2 ring-white animate-pulse z-20`}>
        {badge}
      </span>
    )}
    {active && !isCollapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-40"></div>}
    {active && isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full opacity-60"></div>}
  </button>
);

const Dashboard = ({ logs, profile, users, orgUnits }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchMonth = log.date.startsWith(selectedMonth);
      const matchUser = selectedUserId === 'all' || log.userId === selectedUserId;
      const matchDept = selectedDept === 'all' || (log.department && log.department.startsWith(selectedDept));
      return matchMonth && matchUser && matchDept;
    });
  }, [logs, selectedMonth, selectedUserId, selectedDept]);

  const stats = useMemo(() => {
    const totalDist = filteredLogs.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const totalAmount = filteredLogs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalParking = filteredLogs.reduce((acc, curr) => acc + (Number(curr.parkingTotal) || 0), 0);
    const totalFuel = totalAmount - totalParking;
    
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

    return { totalDist, totalAmount, totalParking, totalFuel, count: filteredLogs.length, dailyData };
  }, [filteredLogs, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">종합 운행 데이터</h3>
          <p className="text-sm font-medium text-slate-400">시스템에 동기화된 전체 정산 현황입니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {profile?.role === 'admin' && (
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-indigo-50 transition-all">
              <Users size={16} className="text-indigo-500" />
              <select 
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-sm min-w-[100px]"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setSelectedUserId('all');
                }}
              >
                <option value="all">전체 부서</option>
                {orgUnits.map(unit => <option key={unit} value={unit}>{unit.split(' > ').pop()}</option>)}
              </select>
            </div>
          )}
          {(profile?.role === 'admin' || profile?.role === 'manager') && (
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-indigo-50 transition-all">
              <User size={16} className="text-indigo-500" />
              <select 
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-sm min-w-[100px]"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="all">전체 인원</option>
                {users
                  .filter(u => {
                    if (profile?.role === 'admin') {
                      return selectedDept === 'all' || (u.department && u.department.startsWith(selectedDept));
                    }
                    if (profile?.role === 'manager') {
                      // 본인은 무조건 포함
                      if (u.uid === profile.uid) return true;
                      
                      const myDept = (profile?.department || '').trim();
                      if (!myDept) return false;
                      
                      // 부서명이 포함되어 있거나 하위 부서인 경우 모두 포함
                      return u.department && (u.department.startsWith(myDept) || myDept.startsWith(u.department));
                    }
                    return u.uid === profile.uid;
                  })
                  .sort((a, b) => (a.userName || '').localeCompare(b.userName || ''))
                  .map(u => <option key={u.uid} value={u.uid}>{u.userName} ({u.department?.split(' > ').pop() || '미지정'})</option>)
                }
              </select>
            </div>
          )}
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
        <StatCard title="총 정산 금액" value={`${stats.totalAmount.toLocaleString()}원`} subtitle={`유류 ${stats.totalFuel.toLocaleString()} + 주차 ${stats.totalParking.toLocaleString()}`} icon={<Calculator />} color="indigo" />
        <StatCard title="총 누적 거리" value={`${stats.totalDist.toFixed(1)}km`} subtitle="업무용 운행 전체 거리" icon={<Navigation />} color="emerald" />
        <StatCard title="순수 유류비" value={`${stats.totalFuel.toLocaleString()}원`} subtitle="KM 단가 기준 합산액" icon={<Fuel />} color="blue" />
        <StatCard title="총 주차 비용" value={`${stats.totalParking.toLocaleString()}원`} subtitle="발생 주차비 전체 합계" icon={<PlusCircle />} color="amber" />
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
              <ResponsiveContainer width="100%" height="100%" minHeight={220}>
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

const LogEntryForm = ({ fuelRates, profile, onSave, initialData, isAdmin }) => {
  // --- Helper: Robust Data Reconstruction ---
  const getInitialFormData = () => {
    if (!initialData) {
      return {
        date: new Date().toISOString().split('T')[0],
        waypoints: [
          { id: 'start', label: '출발지', address: '', alias: '', purpose: '출발', lat: 37.5665, lng: 126.9780, parkingFee: 0, parkingNote: '' },
          { id: 'end', label: '도착지', address: '', alias: '', purpose: '', lat: 37.4979, lng: 127.0276, parkingFee: 0, parkingNote: '' }
        ],
        purpose: '',
        fuelType: profile?.fuelType || 'gasoline',
        distance: 0,
        isManualDistance: false
      };
    }

    // 1. routeSummary에서 파싱 시도
    // 디버그: 실제 저장된 데이터 구조 확인
    console.log('[LogEntryForm] initialData:', JSON.stringify({
      routeSummary: initialData.routeSummary,
      waypoints: initialData.waypoints,
      departure: initialData.departure,
      destination: initialData.destination
    }, null, 2));

    // ⚠️ 핵심 수정: → 만을 기준으로 분리 (공백 기준 split 제거 - 주소 안 공백과 충돌)
    // ⚠️ Greedy regex 버그 수정: 가장 바깥 대괄호 쌍을 non-greedy하게 찾아야 함
    const parsedWaypoints = (initialData.routeSummary ? initialData.routeSummary
      .split(' → ')
      .map((segment, idx, allSegs) => {
        const trimmed = segment.trim();
        // 형식: [alias (purpose) [🅿️fee: note]] address
        // 마지막 ] 이후가 address이므로, 마지막 `] ` 위치를 기준으로 분리
        const lastBracketEnd = trimmed.lastIndexOf('] ');
        if (lastBracketEnd === -1) return null;

        const address = trimmed.slice(lastBracketEnd + 2).trim();
        let infoPart = trimmed.slice(1, lastBracketEnd); // 첫 번째 [ 이후, 마지막 ] 이전

        let purpose = '';
        let parkingFee = 0;
        let parkingNote = '';

        // 주차비 추출: [🅿️숫자] 또는 [🅿️숫자: 메모] 패턴
        const pMatch = infoPart.match(/\s*\[(?:🅿️|P)\s*([\d,]+)(?:\s*:\s*([^\]]*))?\]/);
        if (pMatch) {
          parkingFee = Number(pMatch[1].replace(/,/g, ''));
          parkingNote = (pMatch[2] || '').trim();
          infoPart = infoPart.replace(/\s*\[(?:🅿️|P).*?\]/, '').trim();
        }

        // 방문 목적 추출: (목적) 패턴
        let alias = infoPart;
        const purpMatch = alias.match(/\(([^)]+)\)\s*$/);
        if (purpMatch) {
          purpose = purpMatch[1].trim();
          alias = alias.replace(/\s*\([^)]+\)\s*$/, '').trim();
        }

        if (!address) return null;

        return {
          id: idx === 0 ? 'start' : idx === allSegs.length - 1 ? 'end' : `mid_${idx}_${Date.now()}`,
          label: idx === 0 ? '출발지' : idx === allSegs.length - 1 ? '도착지' : '경유지',
          alias: alias || (idx === 0 ? '출발지' : '도착지'),
          purpose: purpose || (idx === 0 ? '출발' : '업무'),
          parkingFee: parkingFee,
          parkingNote: parkingNote,
          address: address,
          lat: initialData.waypoints?.[idx]?.lat || 37.5665,
          lng: initialData.waypoints?.[idx]?.lng || 126.9780
        };
      }).filter(Boolean) : null);

    console.log('[LogEntryForm] parsedWaypoints:', parsedWaypoints);

    // 2. 최종 waypoint 구성
    // ⚠️ 중요: routeSummary를 항상 우선 사용 (DB의 waypoints 염에 잘못된 데이터가 있을 수 있음)
    // waypoints 배열은 lat/lng 좌표 가져오는 용도로만 사용
    let finalWaypoints = [];

    // 맨 먼저 routeSummary 파싱이 성공페스면 귽사담에 사용
    if (parsedWaypoints && parsedWaypoints.length >= 2) {
      finalWaypoints = parsedWaypoints;
    } else if (Array.isArray(initialData.waypoints) && initialData.waypoints.length >= 2) {
      // routeSummary 파싱 실패 시에만 waypoints 배열 사용
      finalWaypoints = initialData.waypoints;
    } else {
      // 둘 다 없으면 상위 필드 기반으로 생성
      finalWaypoints = [
        { id: 'start', label: '출발지', address: initialData.departure || '', alias: '출발지', purpose: '출발', lat: initialData.startLat || 37.5665, lng: initialData.startLng || 126.9780, parkingFee: 0, parkingNote: '' },
        { id: 'end', label: '도착지', address: initialData.destination || '', alias: '도착지', purpose: '업무', lat: initialData.endLat || 37.4979, lng: initialData.endLng || 127.0276, parkingFee: 0, parkingNote: '' }
      ];
    }

    // 3. 누락된 필드 최종 보충
    finalWaypoints = finalWaypoints.map((wp, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === finalWaypoints.length - 1;
      return {
        ...wp,
        address: (wp.address || (isStart ? initialData.departure : (isEnd ? initialData.destination : ""))).toString().trim(),
        alias: (wp.alias || (isStart ? "출발지" : "도착지")).toString().trim(),
        purpose: (wp.purpose || (isStart ? "출발" : "업무")).toString().trim(),
        parkingFee: Number(wp.parkingFee) || 0,
        parkingNote: wp.parkingNote || ""
      };
    });

    return {
      ...initialData,
      date: initialData.date || new Date().toISOString().split('T')[0],
      waypoints: finalWaypoints,
      purpose: initialData.purpose || '',
      fuelType: initialData.fuelType || profile?.fuelType || 'gasoline',
      distance: Number(initialData.distance) || 0,
      isManualDistance: initialData.isManualDistance !== undefined ? initialData.isManualDistance : (initialData.distance > 0 ? true : false)
    };
  };

  const [favSelectorIdx, setFavSelectorIdx] = useState(null);
  const [favSearch, setFavSearch] = useState('');

  // key prop 덕분에 component가 mount될 때 이 초기값이 사용됩니다.
  const [formData, setFormData] = useState(getInitialFormData());

  // 유종 변경 반영 (프로필 설정 변경 시)
  useEffect(() => {
    if (!initialData && profile?.fuelType) {
      setFormData(prev => ({ ...prev, fuelType: profile.fuelType }));
    }
  }, [profile?.fuelType, initialData]);

  // Haversine 거리 계산 함수
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

  const calculatedAmount = useMemo(() => {
    const rate = Number(fuelRates?.[formData.fuelType]?.unitPrice || 0);
    const fuelCost = Math.round(formData.distance * rate);
    const totalParking = formData.waypoints.reduce((acc, wp) => acc + (Number(wp.parkingFee) || 0), 0);
    return fuelCost + totalParking;
  }, [formData.distance, formData.fuelType, fuelRates, formData.waypoints]);

  // 거리 자동 계산 효과
  useEffect(() => {
    let sum = 0;
    for (let i = 0; i < formData.waypoints.length - 1; i++) {
        const p1 = formData.waypoints[i];
        const p2 = formData.waypoints[i+1];
        if (p1.address && p2.address) {
            sum += calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1.25;
        }
    }
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
      parkingFee: 0,
      parkingNote: '',
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
      ...formData,
      date: formData.date,
      departure: formData.waypoints[0].address,
      destination: formData.waypoints[formData.waypoints.length - 1].address,
      purpose: formData.purpose,
      distance: formData.distance,
      fuelType: formData.fuelType,
      amount: calculatedAmount,
      parkingTotal: formData.waypoints.reduce((acc, wp) => acc + (Number(wp.parkingFee) || 0), 0),
      fuelAmount: calculatedAmount - formData.waypoints.reduce((acc, wp) => acc + (Number(wp.parkingFee) || 0), 0),
      waypoints: formData.waypoints, 
      routeSummary: formData.waypoints
        .map(w => {
          let base = `[${w.alias}${w.purpose ? ` (${w.purpose})` : ''}`;
          if (w.parkingFee > 0) {
            base += ` [🅿️${w.parkingFee.toLocaleString()}${w.parkingNote ? `: ${w.parkingNote}` : ''}]`;
          }
          return base + `] ${w.address}`;
        })
        .join(' → ')
    };
    
    onSave(payload);
    setFormData(prev => ({ 
      ...prev, 
      waypoints: [
        { id: 'start', label: '출발지', address: '', alias: '', purpose: '출발', lat: 37.5665, lng: 126.9780, parkingFee: 0, parkingNote: '' },
        { id: 'end', label: '도착지', address: '', alias: '', purpose: '', lat: 37.4979, lng: 127.0276, parkingFee: 0, parkingNote: '' }
      ], 
      purpose: '',
      distance: 0,
      isManualDistance: false
    }));
  };

  return (
    <div className="bg-white p-5 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
          <InputGroup label="운행 날짜" icon={<History size={16}/>}>
            <input 
              type="date" 
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-bold text-slate-700" 
              value={formData.date}
              min={(() => {
                if (isAdmin || initialData) return undefined;
                const d = new Date();
                d.setDate(d.getDate() - 1);
                return d.toISOString().split('T')[0];
              })()}
              max={(() => {
                if (isAdmin || initialData) return undefined;
                return new Date().toISOString().split('T')[0];
              })()}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </InputGroup>

          <InputGroup label="사용 유종" icon={<Fuel size={16}/>}>
            <div className="relative group">
              <div className="w-full px-5 py-4 rounded-2xl bg-slate-100/50 border border-slate-200 font-bold text-slate-600 flex flex-wrap items-center justify-between shadow-inner gap-2">
                <span className="flex items-center gap-2 text-sm sm:text-base">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                  {formData.fuelType === 'gasoline' ? '휘발유' : formData.fuelType === 'diesel' ? '경유' : 'LPG'} 
                  <span className="text-indigo-500 ml-1 text-xs sm:text-sm">({Number(fuelRates?.[formData.fuelType]?.unitPrice || 0).toFixed(1)}원/km)</span>
                </span>
              </div>
              <p className="mt-2.5 px-1 text-[9px] sm:text-[10px] font-black text-slate-400 italic">
                ※ 유종 변경은 <span className="text-indigo-500 underline underline-offset-2">'내 정보'</span> 메뉴에서 가능합니다.
              </p>
            </div>
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
                      className="group/btn flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 text-white text-[11px] font-black shadow-lg shadow-indigo-100/50 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
                    >
                      <span className="opacity-80">🏠</span>
                      <span>{profile.homeAlias || '우리집'}</span>
                    </button>
                  )}
                  {profile?.savedLocations?.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setFavSelectorIdx(idx)}
                      className="group/btn flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-50 border border-slate-100 text-slate-500 text-[11px] font-black hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all border-dashed"
                    >
                      <Star size={12} className={favSelectorIdx === idx ? 'fill-indigo-500 text-indigo-500' : ''} />
                      <span>즐겨찾기 선택</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50/50 p-4 sm:p-0 rounded-2xl sm:bg-transparent">
                  <div className="w-full sm:flex-[2] relative">
                    <input 
                      type="text" 
                      placeholder={`${wp.label} 주소 검색`} 
                      readOnly
                      onClick={() => openSearch(idx)}
                      className="w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-white sm:bg-slate-50 border border-slate-100 group-hover:border-indigo-200 cursor-pointer focus:bg-white focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all font-bold text-slate-700 truncate"
                      value={wp.address}
                    />
                    {!wp.address && (
                      <span className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500 border border-indigo-100 px-2 py-1 rounded-lg pointer-events-none opacity-60">검색</span>
                    )}
                  </div>

                  <div className="w-full sm:flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="명칭 (필수)" 
                      className={`w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-white sm:bg-slate-50 border-2 outline-none transition-all font-bold text-sm ${
                        wp.alias ? 'border-transparent text-slate-600 focus:border-indigo-400 focus:bg-white' : 'border-red-50 text-red-500 focus:border-red-200'
                      } truncate`}
                      value={wp.alias}
                      onChange={(e) => handleAliasChange(idx, e.target.value)}
                    />
                    {!wp.alias && (
                      <span className="absolute -top-5 right-1 text-[9px] font-black text-red-500 animate-pulse">필수</span>
                    )}
                  </div>

                  <div className="w-full sm:flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="방문 목적 (필수)" 
                      readOnly={idx === 0}
                      className={`w-full px-4 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl outline-none transition-all font-bold text-sm truncate ${
                        idx === 0 
                        ? 'bg-slate-100/50 text-slate-400 border-transparent cursor-not-allowed'
                        : (wp.purpose ? 'bg-white sm:bg-slate-50 border-transparent text-slate-600 focus:border-indigo-400 focus:bg-white' : 'bg-white sm:bg-slate-50 border-red-50 text-red-500 focus:border-red-200')
                      }`}
                      value={wp.purpose}
                      onChange={(e) => handleStopPurposeChange(idx, e.target.value)}
                    />
                    {!wp.purpose && (
                      <span className="absolute -top-5 right-1 text-[9px] font-black text-red-500 animate-pulse">필수</span>
                    )}
                  </div>

                  <div className="flex w-full sm:w-auto items-center gap-3">
                    <div className="flex-1 sm:w-24 relative">
                      <input 
                        type="number" 
                        placeholder="주차비" 
                        className="w-full pl-3 pr-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-white sm:bg-slate-50 border-none outline-none font-bold text-sm sm:text-xs text-indigo-600 focus:bg-indigo-50/50 transition-all text-right appearance-none"
                        value={wp.parkingFee || ''}
                        onChange={(e) => {
                          const newWaypoints = [...formData.waypoints];
                          newWaypoints[idx].parkingFee = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, waypoints: newWaypoints });
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">원</span>
                    </div>

                    {idx > 0 && idx < formData.waypoints.length - 1 ? (
                      <button 
                        type="button" 
                        onClick={() => removeStop(idx)}
                        className="p-3 bg-red-50 text-red-400 hover:text-red-600 sm:bg-transparent sm:text-slate-300 transition-all active:scale-90 rounded-xl"
                      >
                        <Trash2 size={20} />
                      </button>
                    ) : (
                      <div className="w-10 sm:w-8"></div>
                    )}
                  </div>
                  
                  {wp.parkingFee > 0 && (
                    <div className="w-full animate-fade-in sm:mt-1">
                      <input 
                        type="text"
                        placeholder="주차 사유/장소 (예: 유료주차장, 발렛 등)"
                        className="w-full px-4 py-3 rounded-xl bg-indigo-50/30 border border-indigo-100/50 outline-none font-bold text-xs text-indigo-700"
                        value={wp.parkingNote || ''}
                        onChange={(e) => {
                          const newWaypoints = [...formData.waypoints];
                          newWaypoints[idx].parkingNote = e.target.value;
                          setFormData({ ...formData, waypoints: newWaypoints });
                        }}
                      />
                    </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 premium-card p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem]">
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between mb-3 sm:mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Total Distance</p>
              <button 
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isManualDistance: !prev.isManualDistance }))}
                className={`text-[9px] sm:text-[10px] font-black px-3 py-2 rounded-xl transition-all ${
                  formData.isManualDistance ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400 border border-slate-100'
                }`}
              >
                {formData.isManualDistance ? '수동 보정 활성中' : '수동 입력 전환'}
              </button>
            </div>
            <div className="flex items-baseline gap-1">
              {formData.isManualDistance ? (
                <div className="flex items-baseline gap-2 w-full">
                  <input 
                    type="number"
                    step="0.1"
                    className="w-full max-w-[120px] text-3xl sm:text-4xl font-black text-indigo-600 bg-transparent border-b-4 border-indigo-400 outline-none px-1"
                    value={formData.distance}
                    onChange={(e) => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-xl font-black text-slate-400">km</span>
                </div>
              ) : (
                <div className="text-4xl sm:text-5xl font-black text-slate-900 flex items-baseline gap-1 tracking-tight">
                  {formData.distance} <span className="text-xl text-slate-400">km</span>
                </div>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-3 px-1">
              {formData.isManualDistance ? '실제 계기판 거리를 직접 입력하세요.' : '시스템 자동 산출 직선 거리 (1.25배 보정)'}
            </p>
          </div>
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-premium-gradient shadow-2xl shadow-indigo-200 text-white flex justify-between items-center transition-all duration-500 hover:scale-[1.02]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Expected Amount</p>
              <h4 className="text-3xl sm:text-4xl font-black">{calculatedAmount.toLocaleString()}<span className="text-base sm:text-lg ml-1.5 opacity-60">원</span></h4>
              <p className="text-[10px] sm:text-[11px] font-black opacity-50 mt-1">
                유류 {(Math.round(formData.distance * Number(fuelRates?.[formData.fuelType]?.unitPrice || 0))).toLocaleString()} + 
                주차 {formData.waypoints.reduce((acc, wp) => acc + (Number(wp.parkingFee) || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/30 self-center">
              <Calculator size={24} className="opacity-90" />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={!isFormValid}
          className={`w-full py-4 sm:py-6 rounded-2xl font-black text-base sm:text-lg transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] ${
            isFormValid 
            ? 'bg-slate-900 text-white shadow-indigo-100 hover:bg-black' 
            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
          }`}
        >
          {initialData ? <Settings size={22} /> : <PlusCircle size={22} />} 
          {initialData ? '기록 수정 완료하기' : (formData.distance > 0 ? '기록 완료하기' : '상세 정보를 입력해 주세요')}
        </button>
      </form>

      {/* Favorites Selector Modal - Moved outside loop to prevent UI flickering/duplication */}
      {favSelectorIdx !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h4 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                     <Star className="fill-amber-400 text-amber-400" size={24}/> 즐겨찾기
                   </h4>
                   <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Select from saved locations</p>
                </div>
                <button onClick={() => { setFavSelectorIdx(null); setFavSearch(''); }} className="p-2.5 hover:bg-white rounded-2xl transition-all shadow-sm">
                   <X size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="relative">
                <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                   type="text"
                   placeholder="장소를 검색하세요..."
                   className="w-full pl-14 pr-6 py-4.5 rounded-[1.5rem] bg-white border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:border-indigo-400 transition-all font-black text-slate-700 shadow-sm"
                   autoFocus
                   value={favSearch}
                   onChange={e => setFavSearch(e.target.value)}
                />
              </div>
              <div className="mt-3 px-1 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-400"></div>
                <p className="text-[10px] font-black text-indigo-500/80">즐겨찾기 장소는 <span className="underline underline-offset-2">'내 정보'</span> 메뉴에서 등록 및 관리할 수 있습니다.</p>
              </div>
            </div>
            <div className="max-h-[350px] overflow-y-auto p-4 custom-scrollbar space-y-2 bg-white">
              {profile.savedLocations
                .filter(loc => loc.name?.toLowerCase().includes(favSearch.toLowerCase()) || loc.address?.toLowerCase().includes(favSearch.toLowerCase()))
                .map(loc => (
                   <button 
                      key={loc.id}
                      onClick={() => {
                        handleQuickSelect(favSelectorIdx, loc);
                        setFavSelectorIdx(null);
                        setFavSearch('');
                      }}
                      className="w-full flex items-center gap-4 p-5 rounded-[1.5rem] hover:bg-slate-50 transition-all text-left group border border-transparent hover:border-slate-100"
                   >
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                        <MapPin size={20}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight truncate">{loc.name}</span>
                        <span className="block text-[11px] font-bold text-slate-400 mt-1 truncate">{loc.address}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-200 group-hover:text-indigo-300 transition-all pr-1" />
                   </button>
                ))
              }
              {profile.savedLocations.filter(loc => loc.name?.toLowerCase().includes(favSearch.toLowerCase()) || loc.address?.toLowerCase().includes(favSearch.toLowerCase())).length === 0 && (
                <div className="py-20 text-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Star size={30} className="text-slate-200" />
                   </div>
                   <p className="font-black text-slate-300 tracking-tight">검색 결과가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

const HistoryTable = ({ logs, onDelete, isAdmin, onRequestCorrection, onEdit }) => {
  const [requestModal, setRequestModal] = useState({ show: false, logId: null, type: 'delete' });
  const [reason, setReason] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [memberFilter, setMemberFilter] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchMonth = log.date.startsWith(selectedMonth);
      const matchDate = !selectedDateFilter || log.date === selectedDateFilter;
      const matchMember = (log.userName || '').toLowerCase().includes(memberFilter.toLowerCase());
      return matchMonth && matchDate && matchMember;
    });
  }, [logs, selectedMonth, selectedDateFilter, memberFilter]);

  const stats = useMemo(() => {
    const totalDist = filteredLogs.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const totalAmount = filteredLogs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalParking = filteredLogs.reduce((acc, curr) => acc + (Number(curr.parkingTotal) || 0), 0);
    const totalFuel = totalAmount - totalParking;
    return { totalDist, totalAmount, totalParking, totalFuel };
  }, [filteredLogs]);

  // 익일 자동 마감 판단: createdAt 다음날 00:00 이후 잠기는지 확인
  const isLogLocked = (log) => {
    if (isAdmin) return false; // 관리자는 언제나 수정 가능
    if (log.requestStatus === 'approved') return false; // 승인된 건은 잠금 해제
    
    // 1. 운행 날짜(date) 기반 마감: 오늘 이전 날짜는 무조건 마감
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    if (logDate < today) return true;

    // 2. 작성 일시(createdAt) 기반 익일 마감: 작성일 다음날 00시부터 마감
    if (!log.createdAt) return false;
    const created = new Date(log.createdAt);
    const lockTime = new Date(created);
    lockTime.setDate(lockTime.getDate() + 1);
    lockTime.setHours(0, 0, 0, 0);
    return new Date() >= lockTime;
  };

  const handleRequestSubmit = () => {
    if (!reason.trim()) return alert('사유를 입력해주세요.');
    onRequestCorrection(requestModal.logId, requestModal.type, reason);
    setRequestModal({ show: false, logId: null, type: 'delete' });
    setReason('');
  };

  return (
    <>
      {/* Statistics & Filter Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 px-2">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-[1.5rem] border border-slate-100 shadow-sm focus-within:ring-4 ring-indigo-50 transition-all">
            <Calendar size={18} className="text-indigo-500" />
            <input 
              type="month" 
              className="bg-transparent font-black text-slate-700 outline-none cursor-pointer text-sm"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDateFilter(''); // 월 변경 시 특정 일자 필터 초기화
              }}
            />
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-[1.5rem] border border-slate-100 shadow-sm focus-within:ring-4 ring-indigo-50 transition-all">
            <Search size={16} className="text-slate-300" />
            <input 
              type="text" 
              placeholder="사용자명 검색"
              className="bg-transparent font-black text-slate-700 outline-none text-sm placeholder:text-slate-300 w-28"
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-[1.5rem] border border-slate-100 shadow-sm focus-within:ring-4 ring-indigo-50 transition-all">
            <Calendar size={18} className="text-emerald-500" />
            <input 
              type="date" 
              className="bg-transparent font-black text-slate-700 outline-none cursor-pointer text-sm"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
            />
            {selectedDateFilter && (
              <button onClick={() => setSelectedDateFilter('')} className="p-1 hover:bg-slate-50 rounded-lg transition-all text-slate-400">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2 hidden xl:block"></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
             <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">총 KM</p>
                <p className="text-sm font-black text-slate-900">{stats.totalDist.toFixed(1)}<span className="text-[10px] ml-0.5 opacity-50">km</span></p>
             </div>
             <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">주유비</p>
                <p className="text-sm font-black text-slate-900">{stats.totalFuel.toLocaleString()}<span className="text-[10px] ml-0.5 opacity-50">원</span></p>
             </div>
             <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">주차비</p>
                <p className="text-sm font-black text-slate-900">{stats.totalParking.toLocaleString()}<span className="text-[10px] ml-0.5 opacity-50">원</span></p>
             </div>
             <div className="bg-indigo-600 px-6 py-3 rounded-2xl shadow-lg shadow-indigo-100">
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">정산 합계</p>
                <p className="text-sm font-black text-white">{stats.totalAmount.toLocaleString()}<span className="text-[10px] ml-0.5 opacity-60">원</span></p>
             </div>
          </div>
        </div>
      </div>

      {requestModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-[8px]">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl animate-fade-in relative overflow-hidden">
            {/* Header Decoration */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            <div className="flex flex-col items-center text-center mb-10">
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl ${requestModal.type === 'delete' ? 'bg-red-50 text-red-500 shadow-red-100' : 'bg-indigo-50 text-indigo-500 shadow-indigo-100'}`}>
                 {requestModal.type === 'delete' ? <Trash2 size={32} /> : <Edit2 size={32} />}
              </div>
              <h4 className="text-3xl font-black text-slate-900 tracking-tight mb-2">마감 내역 보정 요청</h4>
              <p className="text-sm font-bold text-slate-400">마감된 내역의 {requestModal.type === 'delete' ? <span className="text-red-500 font-black">'삭제'</span> : <span className="text-indigo-500 font-black">'내용 수정'</span>}을 위해<br/>인사팀 검토 사유를 작성해 주세요.</p>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <FileText size={14} className="text-indigo-400" /> 세부 요청 사유
                  </label>
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md italic">REQUIRED</span>
                </div>
                <textarea 
                  className="w-full px-7 py-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 outline-none focus:ring-8 focus:ring-indigo-50 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 min-h-[160px] resize-none leading-relaxed text-sm"
                  placeholder="예: 도착지 주소 오기입으로 인한 실제 주행거리와 정산 금액의 차이가 발생하여 수정을 요청합니다."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { setRequestModal({ show: false, logId: null, type: 'delete' }); setReason(''); }}
                  className="py-5 rounded-2xl font-black text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all active:scale-95"
                >
                  취소
                </button>
                <button 
                  onClick={handleRequestSubmit}
                  className={`py-5 rounded-2xl font-black text-white shadow-2xl transition-all active:scale-95 ${requestModal.type === 'delete' ? 'bg-red-500 hover:bg-red-600 shadow-red-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                >
                  요청 전송하기
                </button>
              </div>
            </div>

            {/* Background Decoration */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-50"></div>
          </div>
        </div>
      )}

      <div className="premium-card rounded-2xl sm:rounded-[2.5rem] overflow-hidden animate-fade-in relative">
        {/* Table View (Desktop) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="w-[180px] px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">운행 정보</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">운행 경로 및 목적</th>
                <th className="w-[180px] px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">구간 및 유종</th>
                <th className="w-[180px] px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">정산 금액</th>
                <th className="w-[120px] px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center whitespace-nowrap">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-5">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <History size={32} />
                      </div>
                      <p className="text-slate-400 font-bold">해당 월의 운행 내역이 없습니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const locked = isLogLocked(log);
                  const isPending = log.requestStatus === 'pending';
                  const isApproved = log.requestStatus === 'approved';
                  return (
                    <tr key={log.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-0 relative">
                      <td className="px-8 py-7">
                        <div className="flex items-center gap-2">
                          <div className="font-black text-slate-900 text-sm whitespace-nowrap">{log.date}</div>
                          {locked && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight shrink-0">
                              <Lock size={8} />
                              마감
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight shrink-0 animate-pulse border border-emerald-100">
                              <CheckCircle size={8} />
                              보정 승인됨
                            </span>
                          )}
                        </div>
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
                        {isPending && (
                          <div className="mt-2 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block">
                             관리자 보정 승인 대기 중 ({log.requestType === 'delete' ? '삭제' : '수정'} 요청)
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-7 text-right">
                        <div className="flex items-center justify-end gap-3 font-black text-slate-900 text-sm whitespace-nowrap">
                          {log.distance} <span className="text-[10px] font-bold text-slate-400">km</span>
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
                        {log.parkingTotal > 0 && (
                          <div className="text-[9px] font-bold text-slate-400 mt-1">
                            (유류 {Number(log.fuelAmount || 0).toLocaleString()} + 주차 {Number(log.parkingTotal).toLocaleString()})
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-7 text-center">
                        <ActionButtons log={log} locked={locked} isPending={isPending} isApproved={isApproved} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} setRequestModal={setRequestModal} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="px-6 py-20 text-center">
               <History size={32} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-bold">운행 내역이 없습니다.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const locked = isLogLocked(log);
              const isPending = log.requestStatus === 'pending';
              const isApproved = log.requestStatus === 'approved';
              return (
                <div key={log.id} className="p-5 flex flex-col gap-4 bg-white hover:bg-slate-50/50 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{log.date}</span>
                        {locked && <span className="bg-amber-50 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded-md">마감</span>}
                        {isApproved && <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded-md animate-pulse">보정 승인</span>}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        {log.userName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-indigo-600 text-lg">
                        {Number(log.amount || 0).toLocaleString()}<span className="text-[10px] ml-0.5 opacity-60">원</span>
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 shrink-0">
                        {log.distance}km · {log.fuelType === 'gasoline' ? '휘발유' : log.fuelType === 'diesel' ? '경유' : 'LPG'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-4 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {log.routeSummary ? (
                        log.routeSummary.split(' → ').map((stop, sIdx, arr) => (
                          <React.Fragment key={sIdx}>
                            <span className="text-[11px] font-bold text-slate-600">{stop}</span>
                            {sIdx < arr.length - 1 && <ChevronRight size={10} className="text-slate-300" />}
                          </React.Fragment>
                        ))
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600">{log.departure}</span>
                          <ChevronRight size={10} className="text-slate-300" />
                          <span className="text-[11px] font-bold text-slate-600">{log.destination}</span>
                        </div>
                      )}
                    </div>
                    {log.purpose && (
                      <div className="text-[10px] font-black text-indigo-500 bg-white px-2 py-1 rounded-md inline-flex items-center gap-1.5 border border-indigo-50">
                        <span className="opacity-50">#</span> {log.purpose}
                      </div>
                    )}
                    {isPending && (
                      <div className="text-[9px] font-black text-blue-600 block pt-1">
                        보정 승인 대기 중 ({log.requestType === 'delete' ? '삭제' : '수정'})
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
                    <ActionButtons log={log} locked={locked} isPending={isPending} isApproved={isApproved} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} setRequestModal={setRequestModal} isMobile />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

const ActionButtons = ({ log, locked, isPending, isApproved, isAdmin, onEdit, onDelete, setRequestModal, isMobile = false }) => {
  const btnClass = isMobile ? "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all active:scale-95" : "p-2.5 rounded-2xl transition-all active:scale-90 flex items-center justify-center";
  
  if ((locked || isPending || isApproved) && !isAdmin) {
    if (isPending) return <div className={`${isMobile ? 'w-full py-2 bg-blue-50/50 text-blue-400 rounded-xl text-center font-bold text-[10px]' : 'p-3 text-blue-300 animate-pulse'}`}><History size={isMobile ? 14 : 18} className="inline mr-1" /> 검토 중</div>;
    
    if (isApproved) return (
      <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
        <button 
          onClick={() => onEdit(log)}
          className={`${btnClass} ${isMobile ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm'}`}
          title="승인됨: 수정하기"
        >
          <Settings size={isMobile ? 14 : 18} />
          {isMobile && "수정"}
        </button>
        <button 
          onClick={() => onDelete(log.id)}
          className={`${btnClass} ${isMobile ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white shadow-sm'}`}
          title="승인됨: 삭제하기"
        >
          <Trash2 size={isMobile ? 14 : 18} />
          {isMobile && "삭제"}
        </button>
      </div>
    );

    return (
      <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
        <button 
          onClick={() => setRequestModal({ show: true, logId: log.id, type: 'edit' })}
          className={`${btnClass} ${isMobile ? 'bg-slate-100 text-slate-600' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
          title="수정 요청"
        >
          <Settings size={isMobile ? 14 : 16} />
          {isMobile && "수정 요청"}
        </button>
        <button 
          onClick={() => setRequestModal({ show: true, logId: log.id, type: 'delete' })}
          className={`${btnClass} ${isMobile ? 'bg-slate-100 text-red-400' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
          title="삭제 요청"
        >
          <Trash2 size={isMobile ? 14 : 16} />
          {isMobile && "삭제 요청"}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isMobile ? 'w-full' : 'justify-center'}`}>
      <button 
        onClick={() => onEdit(log)}
        className={`${btnClass} ${isMobile ? 'bg-indigo-50 text-indigo-600' : 'text-slate-200 hover:text-indigo-500 hover:bg-indigo-50'}`}
        title="수정"
      >
        <Settings size={isMobile ? 14 : 18} />
        {isMobile && "수정"}
      </button>
      <button 
        onClick={() => onDelete(log.id)}
        className={`${btnClass} ${isMobile ? 'bg-red-50 text-red-500' : (locked && isAdmin ? 'text-red-300 hover:text-red-600 hover:bg-red-50 border border-dashed border-red-200' : 'text-slate-200 hover:text-red-500 hover:bg-red-50')}`}
        title={locked && isAdmin ? '관리자 강제 삭제' : '삭제'}
      >
        <Trash2 size={isMobile ? 14 : 18} />
        {isMobile && "삭제"}
      </button>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  차량 별명 <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input 
                   type="text" 
                   className={`w-full px-4 py-3 rounded-xl bg-white border-2 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-bold text-slate-700 text-sm ${
                     !localProfile.vehicleName ? 'border-red-200 focus:border-red-400' : 'border-slate-100 focus:border-indigo-400'
                   }`}
                   placeholder="예: 쏘렌토  (필수 입력)"
                   value={localProfile.vehicleName}
                   onChange={(e) => setLocalProfile({...localProfile, vehicleName: e.target.value})}
                />
                {!localProfile.vehicleName && (
                  <p className="text-[10px] font-black text-red-400 ml-1">차량 별명을 입력해 주세요</p>
                )}
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  기본 유종 <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select 
                   className={`w-full px-4 py-3 rounded-xl bg-white border-2 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-bold text-slate-700 text-sm appearance-none ${
                     !localProfile.fuelType ? 'border-red-200 focus:border-red-400' : 'border-slate-100 focus:border-indigo-400'
                   }`}
                   value={localProfile.fuelType}
                   onChange={(e) => setLocalProfile({...localProfile, fuelType: e.target.value})}
                >
                   <option value="">유종 선택 (필수)</option>
                   <option value="gasoline">휘발유 (Gasoline)</option>
                   <option value="diesel">경유 (Diesel)</option>
                   <option value="lpg">액화석유가스 (LPG)</option>
                </select>
                {!localProfile.fuelType && (
                  <p className="text-[10px] font-black text-red-400 ml-1">유종을 선택해 주세요</p>
                )}
             </div>
          </div>
        </section>

          <button 
            onClick={() => {
              if (!localProfile.vehicleName || !localProfile.fuelType) {
                showStatus("차량 별명과 유종은 필수 입력 사항입니다.", "error");
                return;
              }
              onUpdate(localProfile);
            }}
            disabled={!localProfile.vehicleName || !localProfile.fuelType}
            className={`w-full py-4 rounded-xl font-black shadow-lg transition-all active:scale-95 text-base ${
              !localProfile.vehicleName || !localProfile.fuelType
                ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
            }`}
          >
            {(!localProfile.vehicleName || !localProfile.fuelType)
              ? '차량 정보 입력 후 저장 가능'
              : '개인 설정값 저장하기'}
          </button>
        </div>
      </div>
    );
};

// --- Enhanced Components ---

const Sidebar = ({ currentView, onNavigate, onLogout, isAdmin, userProfile, isCollapsed, onToggle, setEditingLog, pendingRequestsCount }) => (
  <nav className={`fixed bottom-0 lg:top-0 left-0 w-full ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} bg-white border-t lg:border-t-0 lg:border-r border-slate-100 flex lg:flex-col p-4 lg:p-6 z-50 transition-all duration-500 ease-in-out lg:overflow-y-auto lg:h-full scrollbar-none`}>
    <div className={`hidden lg:flex items-center ${isCollapsed ? 'justify-center mb-5' : 'justify-between mb-6 px-2'}`}>
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

    {/* User Profile Summary */}
    <div className={`hidden lg:block transition-all duration-500 ${isCollapsed ? 'mb-6' : 'mb-8 px-1'}`}>
      {isCollapsed ? (
        <div className="flex justify-center">
          <div className="relative w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-slate-100 group cursor-pointer" onClick={() => onNavigate('profile')}>
            {userProfile?.userName?.[0] || 'U'}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
        </div>
      ) : (
        <div className="relative p-4 rounded-[1.8rem] bg-indigo-50/30 border border-indigo-100/50 animate-fade-in overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-xl shadow-indigo-100">
                {userProfile?.userName?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Connect Status</p>
                <h2 className="text-sm font-black text-slate-900 truncate tracking-tight">{userProfile?.userName || '사용자'}</h2>
                <p className="text-[9.5px] font-bold text-slate-400 truncate mt-0.5">{userProfile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2.5 border-t border-indigo-100/50">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl text-indigo-600 shadow-sm border border-indigo-50 overflow-hidden shrink min-w-0">
                <Users size={11} strokeWidth={3} className="shrink-0" />
                <span className="text-[9.5px] font-black tracking-tight truncate">{userProfile?.department || '미지정'}</span>
              </div>
              {userProfile?.role === 'manager' && (
                <div className="px-1.5 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-tighter shrink-0 animate-fade-in shadow-sm shadow-amber-100">리더</div>
              )}
              {userProfile?.role === 'admin' && (
                <div className="px-1.5 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-tighter shrink-0 animate-fade-in shadow-sm shadow-indigo-100">인사</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {isCollapsed && (
      <button 
        onClick={onToggle}
        className="hidden lg:flex items-center justify-center p-3 mb-6 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
      >
        <PanelLeftOpen size={18} />
      </button>
    )}

    <div className="flex lg:flex-col flex-1 gap-1 lg:gap-1.5 min-h-0">
      {(() => {
        const profileIncomplete = !userProfile?.vehicleName || !userProfile?.fuelType;
        return (
          <>
            <NavItem isCollapsed={isCollapsed} icon={<LayoutDashboard />} label="대시보드" active={currentView === 'dashboard'} onClick={() => { onNavigate('dashboard'); setEditingLog(null); }} disabled={profileIncomplete} />
            <NavItem isCollapsed={isCollapsed} icon={<PlusCircle />} label="신규 운행" active={currentView === 'log'} onClick={() => { onNavigate('log'); setEditingLog(null); }} disabled={profileIncomplete} />
            <NavItem isCollapsed={isCollapsed} icon={<History />} label="정산 내역" active={currentView === 'history'} onClick={() => { onNavigate('history'); setEditingLog(null); }} disabled={profileIncomplete} />
            {isAdmin && (
              <>
                <div className={`hidden lg:block h-px bg-slate-100 my-2 ${isCollapsed ? 'mx-2' : 'mx-4'}`}></div>
                <NavItem isCollapsed={isCollapsed} icon={<FileText />} label="운행 통계" active={currentView === 'reports'} onClick={() => onNavigate('reports')} disabled={profileIncomplete} />
                <NavItem isCollapsed={isCollapsed} icon={<Users />} label="인사/조직 관리" active={currentView === 'admin'} onClick={() => onNavigate('admin')} disabled={profileIncomplete} badge={pendingRequestsCount} />
              </>
            )}
            <div className="flex-1 hidden lg:block min-h-[1.5rem]"></div>
            <NavItem isCollapsed={isCollapsed} icon={<UserCircle />} label="내 정보" active={currentView === 'profile'} onClick={() => onNavigate('profile')} />
          </>
        );
      })()}
      <button 
        onClick={onLogout}
        className={`hidden lg:flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-5'} py-3.5 rounded-2xl text-[13px] font-bold text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all mt-2 active:scale-95`}
      >
        {isCollapsed ? <LogOut size={20} /> : <><LogOut size={16} /> <span className="tracking-tight">로그아웃</span></>}
      </button>
    </div>
  </nav>
);

const AuthScreen = ({ onLogin, onSignup, onResetPassword, orgUnits: initialOrgUnits, db, appId }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [loginError, setLoginError] = useState('');
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
            {isForgotPassword ? (
              <div className="animate-slide-up">
                <div className="mb-12">
                  <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-4">비밀번호 찾기</h3>
                  <p className="text-slate-500 font-bold leading-relaxed">
                    가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
                  </p>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setLoginError('');
                  if (!email) {
                    setLoginError('이메일을 입력해 주세요.');
                    return;
                  }
                  const success = await onResetPassword(email);
                  if (success) {
                    setIsForgotPassword(false);
                  }
                }} className="space-y-8">
                  <div className="space-y-6">
                    <div>
                      <InputLabel label="가입 이메일 계정" />
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl pl-14 pr-6 py-4 outline-none font-bold transition-all"
                          placeholder="name@company.com"
                          required
                        />
                      </div>
                    </div>
                    {loginError && <p className="text-red-500 text-xs font-black pl-1">{loginError}</p>}
                  </div>
                  
                  <div className="space-y-4 pt-4">
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      재설정 메일 보내기
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setIsForgotPassword(false)}
                      className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                      BACK TO LOGIN
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
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
                    <button 
                      type="button" 
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[11px] font-black text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-tight"
                    >
                      Forgot PW?
                    </button>
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
          </>
        )}
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

const AdminPanel = ({ db, appId, orgUnits, setOrgUnits, logs, onApproveRequest, onRejectRequest, fuelRates, onUpdateSettings }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'requests', or 'fuel'

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'profiles'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [db, appId]);

  const pendingRequests = useMemo(() => {
    return logs.filter(log => log.requestStatus === 'pending');
  }, [logs]);

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
  const [newDeptParent, setNewDeptParent] = useState('');

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchName = user.userName?.toLowerCase().includes(term);
    const matchEmail = user.email?.toLowerCase().includes(term);
    const matchDept = deptFilter === 'all' || user.department === deptFilter;
    return (matchName || matchEmail) && matchDept;
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-4 p-2 bg-white rounded-[2rem] w-fit border border-slate-100 shadow-sm">
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-8 py-4 rounded-2xl font-black text-sm transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
        >
          인원/조직 관리
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={`px-8 py-4 rounded-2xl font-black text-sm transition-all flex items-center gap-3 ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
        >
          보정 요청
          {pendingRequests.length > 0 && (
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTab === 'requests' ? 'bg-white text-indigo-600' : 'bg-red-500 text-white animate-pulse'}`}>
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('fuel')}
          className={`px-8 py-4 rounded-2xl font-black text-sm transition-all flex items-center gap-3 ${activeTab === 'fuel' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
        >
          유류비 단가 관리
        </button>
      </div>

      {activeTab === 'users' && <OrgChartView orgUnits={orgUnits} users={users} db={db} appId={appId} setOrgUnits={setOrgUnits} onUpdateUser={updateUser} />}
      {activeTab === 'requests' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex items-center justify-between px-2">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
               <History className="text-orange-500" /> 보정 요청 검토
             </h3>
             <span className="bg-orange-50 px-3 py-1 rounded-full text-[10px] font-black text-orange-500 uppercase tracking-widest">
               {pendingRequests.length} Pending Actions
             </span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="premium-card p-20 flex flex-col items-center justify-center text-center">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                  <FileText size={40} />
               </div>
               <h4 className="text-xl font-black text-slate-800">모든 요청이 처리되었습니다.</h4>
               <p className="text-sm font-bold text-slate-400 mt-2">현재 검토 대기 중인 보정 요청이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
               {pendingRequests.map(request => (
                 <div key={request.id} className="premium-card p-8 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between group">
                    <div className="flex-1 space-y-4">
                       <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${request.requestType === 'delete' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                             {request.requestType === 'delete' ? '삭제 요청' : '수정 요청'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">요청일: {new Date(request.requestedAt).toLocaleString()}</span>
                       </div>
                       <div>
                          <h5 className="text-lg font-black text-slate-900">{request.userName} 님의 요청</h5>
                          <p className="text-sm font-bold text-slate-500 mt-1 max-w-2xl leading-relaxed">
                             <span className="text-indigo-600 font-black">사유:</span> {request.requestReason}
                          </p>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl flex flex-wrap gap-4 text-[11px] font-black text-slate-500 italic">
                          <span>{request.date} 운행</span>
                          <span>{request.routeSummary}</span>
                          <span>{Number(request.amount).toLocaleString()}원</span>
                       </div>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                       <button 
                         onClick={() => onRejectRequest(request.id)}
                         className="flex-1 lg:flex-none px-8 py-4 rounded-2xl font-black text-slate-500 border border-slate-100 hover:bg-slate-50 transition-all"
                       >
                         반려
                       </button>
                       <button 
                         onClick={() => onApproveRequest(request)}
                         className={`flex-1 lg:flex-none px-8 py-4 rounded-2xl font-black text-white shadow-xl transition-all ${request.requestType === 'delete' ? 'bg-red-500 hover:bg-red-600 shadow-red-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                       >
                         요청 승인
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'fuel' && <SettingsPanel fuelRates={fuelRates} onUpdate={onUpdateSettings} db={db} appId={appId} />}
    </div>
  );
};

const OrgChartView = ({ orgUnits, users, db, appId, setOrgUnits, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' or 'members'
  const [memberSearch, setMemberSearch] = useState('');

  const tree = useMemo(() => {
    const root = { name: 'Root', fullPath: '', children: {}, members: [] };
    orgUnits.forEach(unit => {
      const parts = unit.split(' > ');
      let current = root;
      let path = '';
      parts.forEach((part) => {
        path = path ? `${path} > ${part}` : part;
        if (!current.children[part]) {
          current.children[part] = { name: part, fullPath: path, children: {}, members: [] };
        }
        current = current.children[part];
      });
    });
    users.forEach(u => {
      if (!u.department || u.department === '미지정') return;
      const parts = u.department.split(' > ');
      let current = root;
      let found = true;
      parts.forEach(part => {
        if (current.children[part]) current = current.children[part];
        else found = false;
      });
      if (found) current.members.push(u);
    });
    return root;
  }, [orgUnits, users]);

  const [selectedPath, setSelectedPath] = useState([]);
  
  const updateOrgUnitsRemote = async (newUnits) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'orgUnits'), { units: newUnits });
    setOrgUnits(newUnits);
  };

  const handleAddSubGroup = (parentPath) => {
    const name = prompt(`${parentPath || '최상위'}에 추가할 조직 이름을 입력하세요.`);
    if (!name) return;
    const newPath = parentPath ? `${parentPath} > ${name.trim()}` : name.trim();
    if (orgUnits.includes(newPath)) return alert('이미 존재하는 조직입니다.');
    updateOrgUnitsRemote([...orgUnits, newPath]);
  };

  const columns = useMemo(() => {
    let current = tree;
    const cols = [{ depts: Object.values(current.children), members: [], parentPath: '' }];
    
    selectedPath.forEach(name => {
      if (current && current.children[name]) {
        current = current.children[name];
        cols.push({
           depts: Object.values(current.children),
           members: current.members,
           parentPath: current.fullPath
        });
      }
    });

    return cols;
  }, [tree, selectedPath]);

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-220px)] min-h-[600px] space-y-6">
       <div className="flex gap-4 p-2 bg-slate-100/50 rounded-[2rem] w-fit mx-auto mb-2">
         <button 
           onClick={() => setActiveTab('chart')}
           className={`px-10 py-4 rounded-2xl font-black text-sm transition-all ${activeTab === 'chart' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
         >
           조직도 안내
         </button>
         <button 
           onClick={() => setActiveTab('members')}
           className={`px-10 py-4 rounded-2xl font-black text-sm transition-all ${activeTab === 'members' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
         >
           전체 구성원 명부
         </button>
       </div>

       {activeTab === 'chart' ? (
         <>
           <div className="flex bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden h-full">
             <div className="flex overflow-x-auto custom-scrollbar h-full">
                {columns.map((col, depth) => (
                    <div key={depth} className="w-80 flex-shrink-0 flex flex-col border-r border-slate-50 last:border-0 md:relative">
                      <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{depth === 0 ? '전사 조직' : `${depth} DEPTH`}</div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-800 truncate pr-2">{depth === 0 ? '(주)컴포즈커피' : selectedPath[depth-1]}</h4>
                          <button onClick={() => handleAddSubGroup(col.parentPath)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                            <PlusCircle size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {col.depts.length === 0 && col.members.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                             <div className="text-slate-200 mb-2"><Network size={32} /></div>
                             <p className="text-[10px] font-bold text-slate-400">하위 조직이나 구성원이 없습니다.</p>
                          </div>
                        )}

                        {col.depts.map(dept => (
                          <button 
                            key={dept.name}
                            onClick={() => setSelectedPath([...selectedPath.slice(0, depth), dept.name])}
                            className={`w-full text-left p-4 rounded-2xl transition-all border ${selectedPath[depth] === dept.name ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5'}`}
                          >
                             <div className="flex items-center justify-between">
                               <span className={`font-black text-[13px] truncate ${selectedPath[depth] === dept.name ? 'text-white' : 'text-slate-700'}`}>{dept.name}</span>
                               <ChevronRight size={14} className={selectedPath[depth] === dept.name ? 'text-white/70' : 'text-slate-300'} />
                             </div>
                             <div className="flex gap-3 mt-2">
                               <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tight ${selectedPath[depth] === dept.name ? 'text-indigo-100' : 'text-slate-400'}`}>
                                 <Network size={10} /> {Object.keys(dept.children).length}
                               </div>
                               <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tight ${selectedPath[depth] === dept.name ? 'text-indigo-100' : 'text-slate-400'}`}>
                                 <Users size={10} /> {dept.members.length}
                               </div>
                             </div>
                          </button>
                        ))}

                        {col.members.length > 0 && (
                          <div className="pt-4 mt-4 border-t border-slate-50">
                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 px-2">구성원 ({col.members.length})</div>
                            <div className="space-y-2">
                              {col.members.map(m => (
                                <div key={m.uid} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                   <div className="w-8 h-8 rounded-lg bg-white text-indigo-500 font-black flex items-center justify-center text-xs shadow-sm border border-slate-100">
                                     {m.userName[0]}
                                   </div>
                                   <div className="min-w-0">
                                     <div className="font-black text-slate-700 text-[12px]">{m.userName}</div>
                                     <div className="text-[9px] font-bold text-slate-400 truncate tracking-tight">{m.email}</div>
                                   </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                ))}
             </div>
           </div>
           <div className="px-4 py-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3 shrink-0">
              <AlertCircle size={14} className="text-indigo-500" />
              <p className="text-[11px] font-bold text-indigo-600">조직도를 클릭하여 상세 댑스를 조회하고, 구성원 현황과 하위 조직 구성을 한눈에 관리할 수 있습니다.</p>
           </div>
         </>
       ) : (
         <div className="premium-card rounded-[2.5rem] overflow-hidden flex-1 flex flex-col border border-slate-100 animate-slide-up">
           <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between bg-slate-50/30 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100"><Users size={18} /></div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 tracking-tight">전사 구성원 명부</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Total Employee Directory</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 max-w-md ml-auto">
                   <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                      type="text"
                      placeholder="이름 또는 부서로 검색..."
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-100 focus:ring-4 focus:ring-indigo-100/30 focus:border-indigo-400 outline-none font-bold text-sm transition-all"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                   />
                </div>
                <div className="bg-indigo-50 px-5 py-3 rounded-2xl border border-indigo-100 text-sm font-black text-indigo-600 shrink-0">
                  총 {users.length}명
                </div>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
             <table className="w-full text-left">
               <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md border-b border-slate-100 z-10">
                 <tr>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">이름 / 계정</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">소속 부서</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">차량 / 유종</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">권한 등급</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">상태</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {users
                   .filter(u => 
                     (u.userName || '').toLowerCase().includes(memberSearch.toLowerCase()) || 
                     (u.department || '').toLowerCase().includes(memberSearch.toLowerCase())
                   )
                   .sort((a, b) => (a.userName || '').localeCompare(b.userName || '')).map(u => (
                   <tr key={u.uid} className="hover:bg-indigo-50/30 transition-all group">
                     <td className="px-8 py-6">
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                           {u.userName ? u.userName[0] : '?'}
                         </div>
                         <div>
                            <div className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{u.userName}</div>
                            <div className="text-[11px] font-bold text-slate-400">{u.email}</div>
                         </div>
                       </div>
                     </td>
                     <td className="px-8 py-6">
                       <select 
                         className="bg-slate-50 text-[11px] font-black px-3 py-2 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer w-full text-slate-700"
                         value={u.department}
                         onChange={(e) => onUpdateUser(u.uid, { department: e.target.value })}
                       >
                         {orgUnits.map(unit => <option key={unit} value={unit}>{formatOrgUnitLabel(unit)}</option>)}
                         <option value="미지정">미지정</option>
                       </select>
                     </td>
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${
                             u.fuelType === 'gasoline' ? 'bg-indigo-50 text-indigo-600' : 
                             u.fuelType === 'diesel' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                           }`}>
                             {u.fuelType === 'gasoline' ? '휘발유' : u.fuelType === 'diesel' ? '경유' : 'LPG'}
                           </div>
                           <div className="text-[12px] font-black text-slate-600">{u.regNo || '-'}</div>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                       <select 
                         className={`text-[9px] font-black px-2 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-indigo-200 transition-all cursor-pointer uppercase w-full ${
                           u.role === 'admin' ? 'bg-indigo-600 text-white' : 
                           u.role === 'manager' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                         }`}
                         value={u.role}
                         onChange={(e) => onUpdateUser(u.uid, { role: e.target.value })}
                       >
                         <option value="staff">Staff (사원)</option>
                         <option value="manager">Leader (팀장)</option>
                         <option value="admin">HR Admin (인사)</option>
                       </select>
                     </td>
                     <td className="px-8 py-6">
                        <select 
                          className={`text-[9px] font-black px-2 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-indigo-200 transition-all cursor-pointer uppercase w-full ${
                            u.status === 'disabled' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
                          }`}
                          value={u.status || 'approved'}
                          onChange={(e) => onUpdateUser(u.uid, { status: e.target.value })}
                        >
                          <option value="approved">정상 활동</option>
                          <option value="disabled">사용 중지 (퇴사)</option>
                        </select>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
       )}
    </div>
  );
};

const ManagementReport = ({ logs, users, db, appId, filters, onFilterChange }) => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'details'

  // 월 변경 시 시작/종료일 자동 설정
  const handleMonthChange = (month) => {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, m, 0).toISOString().slice(0, 10);
    onFilterChange(prev => ({ ...prev, selectedMonth: month, startDate: start, endDate: end }));
  };

  const [orgUnits, setOrgUnits] = useState(['(주)컴포즈커피', '(주)컴포즈커피 > 경영지원본부', '(주)컴포즈커피 > 경영지원본부 > IT지원팀', '(주)컴포즈커피 > 경영지원본부 > 법무팀', '(주)컴포즈커피 > 경영지원본부 > 인사총무팀']);

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
      
      const matchDept = filters.department === 'all' || (logDept && logDept.startsWith(filters.department));
      const matchUser = filters.userId === 'all' || log.userId === filters.userId;
      const matchStart = !filters.startDate || log.date >= filters.startDate;
      const matchEnd = !filters.endDate || log.date <= filters.endDate;
      
      return matchDept && matchUser && matchStart && matchEnd;
    });
  }, [logs, users, filters]);

  const stats = useMemo(() => {
    const totalDist = filteredLogs.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const totalAmount = filteredLogs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalParking = filteredLogs.reduce((acc, curr) => acc + (Number(curr.parkingTotal) || 0), 0);
    const totalFuel = totalAmount - totalParking;
    return { totalDist, totalAmount, totalParking, totalFuel, count: filteredLogs.length };
  }, [filteredLogs]);

  const deptStats = useMemo(() => {
    const dStats = {};
    filteredLogs.forEach(log => {
      const user = users.find(u => u.uid === log.userId);
      const dept = user?.department || '미지정';
      if (!dStats[dept]) {
        dStats[dept] = { dist: 0, fuel: 0, parking: 0, total: 0, count: 0 };
      }
      dStats[dept].dist += Number(log.distance) || 0;
      dStats[dept].parking += Number(log.parkingTotal) || 0;
      dStats[dept].total += Number(log.amount) || 0;
      dStats[dept].fuel = dStats[dept].total - dStats[dept].parking;
      dStats[dept].count += 1;
    });
    return Object.entries(dStats).sort((a, b) => b[1].total - a[1].total);
  }, [filteredLogs, users]);

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
              {orgUnits.map(unit => <option key={unit} value={unit}>{formatOrgUnitLabel(unit)}</option>)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="총 유류비 합계" value={`${stats.totalFuel.toLocaleString()}원`} subtitle="순수 유류비 정산 총액" icon={<Fuel />} color="indigo" />
        <StatCard title="총 주차비 합계" value={`${stats.totalParking.toLocaleString()}원`} subtitle="발생한 모든 주차 비용" icon={<PlusCircle />} color="amber" />
        <StatCard title="검색 누적 거리" value={`${stats.totalDist.toFixed(1)}km`} subtitle="선택된 조건의 총 운행거리" icon={<Navigation />} color="emerald" />
        <StatCard title="최종 정산 합계" value={`${stats.totalAmount.toLocaleString()}원`} subtitle="유류비 + 주차비 총합" icon={<Calculator />} color="slate" />
      </div>

      {/* Report Tab Switcher */}
      <div className="flex gap-4 p-2 bg-slate-100/50 rounded-[2rem] w-fit mx-auto">
        <button 
          onClick={() => setActiveTab('summary')}
          className={`px-10 py-4 rounded-2xl font-black text-sm transition-all ${activeTab === 'summary' ? 'bg-white text-indigo-600 shadow-md translate-y-0' : 'text-slate-400 hover:text-slate-600 hover:translate-y-[-2px]'}`}
        >
          부서별 정산 요약 리포트
        </button>
        <button 
          onClick={() => setActiveTab('details')}
          className={`px-10 py-4 rounded-2xl font-black text-sm transition-all ${activeTab === 'details' ? 'bg-white text-indigo-600 shadow-md translate-y-0' : 'text-slate-400 hover:text-slate-600 hover:translate-y-[-2px]'}`}
        >
          전체 상세 운행 내역
        </button>
      </div>

      {activeTab === 'summary' ? (
        <div className="premium-card p-10 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 animate-slide-up">
          <div className="flex items-center gap-3 mb-10">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><Network size={22} /></div>
            <div>
              <h4 className="text-xl font-black text-slate-900 tracking-tight">부서별 정산 현황 요약</h4>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Departmental Settlement Breakdown</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {deptStats.length === 0 ? (
               <div className="col-span-2 py-20 text-center font-bold text-slate-300 italic bg-white rounded-3xl border border-dashed border-slate-200">
                 해당 기간 내 정산 데이터가 존재하지 않습니다.
               </div>
             ) : (
               deptStats.map(([dept, data]) => (
                 <div key={dept} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
                   <div className="flex justify-between items-start mb-6">
                     <div>
                       <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg mb-3 inline-block">Department</span>
                       <h5 className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{dept}</h5>
                     </div>
                     <div className="text-right">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">총 정산액</span>
                       <div className="text-2xl font-black text-indigo-600 tracking-tighter">{data.total.toLocaleString()}원</div>
                     </div>
                   </div>
                   <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-50">
                      <div className="bg-slate-50/50 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">운행 거리</p>
                        <p className="text-base font-black text-slate-900">{data.dist.toFixed(1)}km</p>
                      </div>
                      <div className="bg-indigo-50/30 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">유류비</p>
                        <p className="text-base font-black text-slate-900">{data.fuel.toLocaleString()}원</p>
                      </div>
                      <div className="bg-amber-50/30 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">주차비</p>
                        <p className="text-base font-black text-slate-900">{data.parking.toLocaleString()}원</p>
                      </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>
      ) : (
        <div className="premium-card rounded-[2.5rem] overflow-hidden animate-slide-up">
          <div className="p-8 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><History size={16} /></div>
             <h4 className="font-black text-slate-800 tracking-tight">상세 운행 로그 리스트</h4>
          </div>
          <table className="w-full text-left table-fixed">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th className="w-[140px] px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">날짜</th>
                <th className="w-[200px] px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">사용자 / 부서</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">운행 상세 정보</th>
                <th className="w-[180px] px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">거리 및 정산액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
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
                        {log.parkingTotal > 0 && (
                          <div className="text-[9px] font-bold text-slate-400 mt-1">
                            주차 {Number(log.parkingTotal).toLocaleString()}원 포함
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PasswordResetView = ({ code, onComplete }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, code);
        setEmail(userEmail);
        setIsVerified(true);
      } catch (err) {
        console.error(err);
        setError("유효하지 않거나 만료된 링크입니다. 다시 시도해 주세요.");
      }
    };
    verifyCode();
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword.length < 6) {
      setError("비밀번호는 6자리 이상이어야 합니다.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, code, newPassword);
      setSuccess(true);
      setTimeout(() => onComplete(), 3000);
    } catch (err) {
      console.error(err);
      setError("비밀번호 변경 중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 animate-fade-in font-['Outfit']">
      <div className="max-w-md w-full bg-white rounded-[3.5rem] shadow-2xl p-12 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full translate-x-16 -translate-y-16"></div>
        
        <div className="relative">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-100">
            <Lock size={32} />
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 mb-2">비밀번호 재설정</h2>
          <p className="text-slate-500 font-bold mb-8">{email ? `${email} 계정의 새로운 비밀번호를 입력해 주세요.` : '전송된 코드를 확인 중입니다...'}</p>

          {success ? (
            <div className="text-center py-8 animate-slide-up">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">변경 완료!</h3>
              <p className="text-slate-500 font-bold">잠시 후 로그인 화면으로 이동합니다.</p>
            </div>
          ) : !isVerified && !error ? (
              <div className="flex flex-col items-center py-10">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Verifying Code...</p>
              </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-6 rounded-3xl border border-red-100 mb-8 animate-slide-up">
              <div className="flex items-center gap-2 mb-2 font-black">
                <AlertCircle size={20} />
                오류 발생
              </div>
              <p className="font-bold text-sm leading-relaxed">{error}</p>
              <button onClick={onComplete} className="mt-4 text-xs font-black uppercase tracking-widest underline">로그인 화면으로 돌아가기</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">새로운 비밀번호</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-6 py-4 outline-none font-bold transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">비밀번호 확인</label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-6 py-4 outline-none font-bold transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? '처리 중...' : '비밀번호 변경하기'}
              </button>
              
              <button 
                type="button"
                onClick={onComplete}
                className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                CANCEL
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
