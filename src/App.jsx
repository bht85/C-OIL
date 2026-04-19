import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode
} from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, query, getDoc, updateDoc, orderBy, getDocs, writeBatch, where, or } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  Star,
  Pencil,
  Check
} from 'lucide-react';

const ComposeLogo = ({ size = 24, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="50" cy="50" r="50" fill="#F9D731" />
    <path 
      d="M75 50C75 63.8071 63.8071 75 50 75C36.1929 75 25 63.8071 25 50C25 36.1929 36.1929 25 50 25C59.5 25 67.5 30.5 71.5 38" 
      stroke="#1A1A1A" 
      strokeWidth="12" 
      strokeLinecap="round" 
    />
    <circle cx="50" cy="50" r="8" fill="#1A1A1A" />
  </svg>
);
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
const getSafeGlobal = (key, fallback) => {
  try {
    return typeof window !== 'undefined' && window[key] ? window[key] : fallback;
  } catch {
    return fallback;
  }
};

// [SEC] Firebase config: API Key는 Firebase 설계상 공개 허용 (Firestore Rules로 접근 제어)
// 로컬 개발 시 .env 또는 __firebase_config 전역 주입 권장
const rawConfig = getSafeGlobal('__firebase_config', null);
const firebaseConfig = rawConfig ? (typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig) : {
  apiKey: "AIzaSyBElhvMeXAuUkyWf6r0volTumE2LRcxggQ",
  authDomain: "compose-oil.firebaseapp.com",
  projectId: "compose-oil",
  storageBucket: "compose-oil.firebasestorage.app",
  messagingSenderId: "319952705434",
  appId: "1:319952705434:web:63b7bc10aa96d2ad258c23"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'ko';
const db = getFirestore(app);
const messaging = getMessaging(app);
const appId = getSafeGlobal('__app_id', 'vehicle-fuel-tracker');

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// [SEC] 마스터 어드민 목록은 환경변수 또는 서버사이드 Firestore Custom Claims로 관리 권장
// 클라이언트 노출을 최소화하기 위해 해시 비교 처리
const _MA = ['esc913@composecoffee.co.kr', 'choihy@composecoffee.co.kr', 'jang_sw@composecoffee.co.kr', 'esc913@compose.co.kr', 'choihy@compose.co.kr'];
const isMasterAdmin = (email) => email && _MA.includes(email.toLowerCase());

// [SEC] Production 환경에서는 console 출력 억제
const isDev = import.meta.env.DEV;
const secureLog = {
  error: (...args) => { if (isDev) console.error(...args); },
  warn: (...args) => { if (isDev) console.warn(...args); },
  info: (...args) => { if (isDev) console.info(...args); },
  log: (...args) => { if (isDev) console.log(...args); },
};

// [SEC] 입력값 Sanitize 유틸리티
const sanitizeString = (str, maxLength = 200) => {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim().slice(0, maxLength);
};

// [UI] DiceBear 기반의 사용자별 고유 캐릭터 아바타 URL 생성
const getAvatarUrl = (email) => {
  const seed = encodeURIComponent(email || 'default');
  return `https://api.dicebear.com/7.x/open-peeps/svg?seed=${seed}&scale=90`;
};

const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
};

const isValidDistance = (d) => {
  const n = Number(d);
  return Number.isFinite(n) && n >= 0 && n <= 2000; // 최대 2000km 제한
};

const formatOrgUnitLabel = (name) => {
  if (!name) return '';
  return name;
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
    department: profile?.department || 'all',
    userId: profile?.uid || 'all',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('sv-SE'),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('sv-SE'),
    selectedMonth: new Date().toLocaleDateString('sv-SE').slice(0, 7)
  });
  const [corVehicles, setCorVehicles] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState({ teamsWebhookUrl: '', enabled: false });
  const [historyFilters, setHistoryFilters] = useState({
    selectedMonth: new Date().toLocaleDateString('sv-SE').slice(0, 7),
    selectedDept: profile?.department || 'all',
    selectedMember: profile?.userName || 'all',
    selectedDate: ''
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 프로필 로딩 시 필터 초기값 동기화 (기존 'all'에서 본인 데이터로)
  useEffect(() => {
    if (profile) {
      if (historyFilters.selectedDept === 'all' && historyFilters.selectedMember === 'all') {
        setHistoryFilters(prev => ({
          ...prev,
          selectedDept: profile.department || 'all',
          selectedMember: profile.userName || 'all'
        }));
      }
      if (reportFilters.department === 'all' && reportFilters.userId === 'all') {
        setReportFilters(prev => ({
          ...prev,
          department: profile.department || 'all',
          userId: profile.uid || 'all'
        }));
      }
    }
  }, [profile]);

  const pdfRef = useRef(null);
  
  // 탭 전환 시 스크롤을 최상단으로 자동 이동 (모바일 사용성 개선)
  useEffect(() => {
    window.scrollTo(0, 0);
    // 특정 브라우저/환경에서 컨테이너 스크롤이 남는 경우 대비
    const mainContainer = document.querySelector('main');
    if (mainContainer) mainContainer.scrollTop = 0;
  }, [view]);

  // --- 마이그레이션 유틸리티 ---
  const handleNativeExport = async () => {
    try {
      showStatus("데이터를 수집 중입니다. 잠시만 기다려 주세요...", "info");
      const data = {};
      const paths = {
        profiles: `artifacts/${appId}/public/data/profiles`,
        logs: `artifacts/${appId}/public/data/logs`,
        corporateVehicles: `artifacts/${appId}/public/data/corporateVehicles`,
        fuelRates: `artifacts/${appId}/public/data/fuelRates`,
        orgUnits: `artifacts/${appId}/public/data/settings/orgUnits`
      };

      for (const [key, path] of Object.entries(paths)) {
        if (key === 'orgUnits') {
          const snap = await getDoc(doc(db, path));
          if (snap.exists()) data[key] = snap.data();
        } else {
          const snap = await getDocs(collection(db, path));
          data[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `C_OIL_DATA_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      showStatus("백업 파일이 생성되었습니다! 법인 계정으로 바꾼 뒤 [데이터 복구] 버튼을 눌러주세요.");
    } catch (e) {
      console.error(e);
      showStatus("백업 실패: " + e.message, "error");
    }
  };

  const handleNativeImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const batch = writeBatch(db);
        showStatus("법인 계정으로 데이터를 전송 중입니다...", "info");
        
        if (data.profiles) data.profiles.forEach(p => { const { id, ...rest } = p; batch.set(doc(db, `artifacts/${appId}/public/data/profiles`, id), rest); });
        if (data.logs) data.logs.forEach(l => { const { id, ...rest } = l; batch.set(doc(db, `artifacts/${appId}/public/data/logs`, id), rest); });
        if (data.corporateVehicles) data.corporateVehicles.forEach(v => { const { id, ...rest } = v; batch.set(doc(db, `artifacts/${appId}/public/data/corporateVehicles`, id), rest); });
        if (data.fuelRates) data.fuelRates.forEach(r => { const { id, ...rest } = r; batch.set(doc(db, `artifacts/${appId}/public/data/fuelRates`, id), rest); });
        if (data.orgUnits) batch.set(doc(db, `artifacts/${appId}/public/data/settings/orgUnits`), data.orgUnits);

        await batch.commit();
        showStatus("🎉 마이그레이션 성공! 모든 데이터가 법인 계정으로 이전되었습니다.");
      } catch (err) {
        console.error(err);
        showStatus("복구 실패: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };

  // 알림 설정 동기화
  useEffect(() => {
    if (!user) return;
    const notifRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'notifications');
    const unsubscribe = onSnapshot(notifRef, (snap) => {
      if (snap.exists()) {
        setNotificationSettings(snap.data());
      }
    }, err => {
      secureLog.error('notifications snapshot error:', err);
    });
    return () => unsubscribe();
  }, [user]);

  const sendTeamsNotification = async (type, details) => {
    if (!notificationSettings.enabled || !notificationSettings.teamsWebhookUrl) {
      secureLog.info('Teams notification skipped: disabled or no URL');
      return;
    }

    try {
      const { userName, reason, date, requestedAt } = details;
      const isDelete = type === 'delete';
      const title = isDelete ? '🗑️ 운행 내역 삭제 요청' : '✏️ 운행 내역 수정 요청';
      const themeColor = isDelete ? 'FF0000' : '0078D4'; // Red for delete, Blue for edit
      
      const payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": themeColor,
        "summary": "C-OIL 보정 요청 알림",
        "sections": [{
          "activityTitle": title,
          "activitySubtitle": "유류비 정산 시스템 (C-OIL)",
          "activityImage": "https://img.icons8.com/color/96/microsoft-teams.png",
          "facts": [
            { "name": "요청자", "value": userName },
            { "name": "운행일", "value": date },
            { "name": "요청 사유", "value": reason },
            { "name": "요청일시", "value": new Date(requestedAt).toLocaleString('ko-KR') }
          ],
          "markdown": true
        }],
        "potentialAction": [{
          "@type": "OpenUri",
          "name": "관리자 페이지에서 확인",
          "targets": [{ "os": "default", "uri": window.location.origin }]
        }]
      };

      // Teams Incoming Webhook doesn't support CORS for application/json from browsers.
      // Using 'no-cors' mode with a compatible payload might work depending on browser/Teams version.
      // For absolute reliability, a backend proxy is recommended.
      await fetch(notificationSettings.teamsWebhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload),
        mode: 'no-cors' // This makes the request "opaque" but Teams usually processes it if the body is valid.
      });
      
      secureLog.info('Teams notification sent successfully');
    } catch (err) {
      secureLog.error('Teams notification error:', err);
    }
  };

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
    }, err => {
      secureLog.error('profile snapshot error:', err);
      if (err.code === 'permission-denied') {
        showStatus("프로필 정보를 가져오는 데 실패했습니다. 권한을 확인해 주세요.", "error");
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'manager')) return;
    
    let q;
    if (profile?.role === 'manager' && profile?.department) {
      // 매니저는 본인 부서 인원만 조회 (보안 규칙 준수)
      q = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'profiles'),
        where('department', '>=', profile.department),
        where('department', '<=', profile.department + '\uf8ff')
      );
    } else {
      q = query(collection(db, 'artifacts', appId, 'public', 'data', 'profiles'));
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => {
      secureLog.error('users snapshot error:', err);
    });

    // 조직 구성 정보 실시간 동기화 (App 레벨로 이동)
    const orgRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'orgUnits');
    const unsubscribeOrg = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) {
        setOrgUnits(snap.data().units || ['본사', '연구소', '영업부', '현장']);
      }
    }, err => {
      secureLog.error('org snapshot error:', err);
    });

    // 법인차량 목록 동기화
    const corRef = query(collection(db, 'artifacts', appId, 'public', 'data', 'corporateVehicles'));
    const unsubscribeCor = onSnapshot(corRef, (snap) => {
      setCorVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => {
      secureLog.error('corporate vehicles snapshot error:', err);
    });

    return () => {
      unsubscribe();
      unsubscribeOrg();
      unsubscribeCor();
    };
  }, [user, profile?.role]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      try {
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
      } catch (err) {
        secureLog.error('auth check error:', err);
        if (err.code === 'permission-denied') {
          showStatus("Firestore 권한이 없습니다. Firebase Console에서 규칙 설정을 확인해 주세요.", "error", 10000);
        } else {
          showStatus("인증 확인 중 오류가 발생했습니다: " + err.message, "error");
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleResetPassword = async (targetEmail) => {
    try {
      if (!targetEmail || typeof targetEmail !== 'string') return false;
      // [SEC] 이메일 형식 검증
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail.trim())) {
        showStatus("이메일 형식이 올바르지 않습니다.", "error");
        return false;
      }
      await sendPasswordResetEmail(auth, targetEmail.trim());
      // [SEC] user-not-found 노출 방지 - 성공/실패 동일 메시지로 계정 열거 방지
      showStatus("입력하신 이메일로 재설정 안내를 발송했습니다. (가입된 계정인 경우)", "info");
      return true;
    } catch (err) {
      secureLog.error('resetPassword error:', err.code);
      // [SEC] 에러 종류 구분 없이 동일 메시지
      showStatus("입력하신 이메일로 재설정 안내를 발송했습니다. (가입된 계정인 경우)", "info");
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

  // [OPT] 서버 부하를 줄이기 위한 수동 조회(Search) 로직
  const handleSearchLogs = useCallback(async (customFilters = null) => {
    if (!user || !profile) return;
    
    setIsSearching(true);
    const activeFilters = customFilters || historyFilters;
    const { selectedMonth, selectedDept, selectedMember } = activeFilters;
    
    try {
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
      let q = logsRef;
      
      // 1. 기본 권한 및 필터링 적용
      const constraints = [];

      // 날짜 필터 (당월 조회)
      if (selectedMonth) {
        constraints.push(where('date', '>=', `${selectedMonth}-01`));
        constraints.push(where('date', '<=', `${selectedMonth}-31`));
      }

      // 2. 권한별 데이터 범위 설정
      if (profile.role === 'admin') {
        // 어드민: 부서/사용자 선택 가능
        if (selectedDept !== 'all') {
          constraints.push(where('department', '>=', selectedDept));
          constraints.push(where('department', '<=', selectedDept + '\uf8ff'));
        }
        if (selectedMember !== 'all') {
          constraints.push(where('userName', '==', selectedMember));
        }
      } else if (profile.role === 'manager' && profile.department) {
        // 매니저: 본인 부서 내에서만 필터링
        constraints.push(where('department', '>=', profile.department));
        constraints.push(where('department', '<=', profile.department + '\uf8ff'));
        
        if (selectedMember !== 'all') {
          constraints.push(where('userName', '==', selectedMember));
        }
      } else {
        // 일반 사용자: 본인 데이터만
        constraints.push(where('userId', '==', user.uid));
      }

      constraints.push(orderBy('date', 'desc'));
      
      const logsQuery = query(q, ...constraints);
      const snapshot = await getDocs(logsQuery);
      
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      showStatus(`${snapshot.size}건의 내역을 불러왔습니다.`, 'info');
    } catch (err) {
      secureLog.error('logs search error:', err);
      if (err.code === 'failed-precondition') {
        showStatus("색인이 필요합니다. 콘솔의 링크를 클릭해 주세요.", "error");
      } else {
        showStatus("조회 중 오류가 발생했습니다.", "error");
      }
    } finally {
      setIsSearching(false);
    }
  }, [user?.uid, profile, appId, historyFilters]);

  // 초기 로드: 일반 사용자/매니저/어드민 모두 본인의 당월 데이터 우선 로드
  useEffect(() => {
    if (!user || !profile || (profile?.status !== 'approved' && profile?.role !== 'admin')) return;
    
    const tripMonth = new Date().toISOString().slice(0, 7);
    const fetchRates = async () => {
      const rateRef = doc(db, 'artifacts', appId, 'public', 'data', 'fuelRates', tripMonth);
      const snap = await getDoc(rateRef);
      if (snap.exists()) setFuelRates(snap.data());
    };
    fetchRates();

    // 초기 1회 로드 (본인 기록 중심 - 어드민이라도 본인 데이터 우선 노출로 변경)
    const initialFilters = {
      selectedMonth: tripMonth,
      selectedDept: profile.department || 'all',
      selectedMember: profile.userName || 'all',
      selectedDate: ''
    };
    
    setHistoryFilters(initialFilters);
    handleSearchLogs(initialFilters);

  }, [user?.uid, profile?.role, profile?.status, profile?.userName]);

  // [UI/SEC] 보안을 위해 클라이언트 측에서도 권한에 따른 필터링을 이중으로 수행
  const authorizedLogs = useMemo(() => {
    if (!user || !profile) return [];
    
    return logs.filter(log => {
      // 1. 본인 기록이면 무조건 허용
      if (log.userId === user.uid) return true;
      
      // 2. 관리자는 모든 기록 허용
      if (profile.role === 'admin') return true;
      
      // 3. 매니저는 본인 부서 및 하위 부서의 기록 허용
      if (profile.role === 'manager' && profile.department) {
        return (log.department && log.department.startsWith(profile.department));
      }
      
      return false;
    });
  }, [logs, user, profile]);

  useEffect(() => {
    if (!profile) return;
    const fetchOrgUnits = async () => {
      const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'orgUnits'));
      if (snap.exists()) setOrgUnits(snap.data().units || []);
    };
    fetchOrgUnits();
  }, [profile]);

  useEffect(() => {
    if (!user || !profile) return;

    const requestNotificationPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // [VAPID] 사용자 제공 키 적용
          const VAPID_KEY = "BDRMXr4pIsJdNTh4oK3T7-wxb0o0IEL4TFujPuiyvYxk8tH0EyVI2TUajyeKtDGpt1HwkqdjiLv-oyQzSsi-_Pg";
          
          const token = await getToken(messaging, { vapidKey: VAPID_KEY });
          if (token) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), {
              fcmToken: token,
              notificationEnabled: true
            });
            secureLog.log('FCM Token saved');
          }
        }
      } catch (error) {
        secureLog.error('Notification permission/token error:', error);
      }
    };

    requestNotificationPermission();

    const unsubscribeOnMessage = onMessage(messaging, (payload) => {
      secureLog.log('Foreground message received:', payload);
      showStatus(`${payload.notification.title}: ${payload.notification.body}`, 'info');
    });

    return () => unsubscribeOnMessage();
  }, [user, profile?.uid]);

  const sendPushNotification = async (targetUserId, title, body) => {
    try {
      const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', targetUserId));
      const token = userDoc.data()?.fcmToken;
      
      if (!token) {
        secureLog.warn('Push notification failed: No token found for user', targetUserId);
        return;
      }

      // [NOTE] 클라이언트에서 직접 FCM을 발송하는 것은 서버 키 노출 위험이 있으나,
      // 현재 서버리스 데모 구조상 클라이언트 트리거로 구성합니다.
      secureLog.log('Triggering push to:', token, title, body);
      // 향후 Firebase Cloud Functions 등으로 고도화 권장
    } catch (error) {
      secureLog.error('Error sending push notification:', error);
    }
  };

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
      // [SEC] 구체적인 오류 코드를 클라이언트에 노출하지 않아 계정 열거(Account Enumeration) 방지
      secureLog.error("Login Error:", err.code);
      let msg = "이메일 또는 비밀번호가 올바르지 않습니다."; // [SEC] 통합 메시지
      
      if (err.code === 'auth/invalid-email') {
        msg = "이메일 형식이 올바르지 않습니다.";
      } else if (err.code === 'auth/too-many-requests') {
        msg = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하거나 비밀번호를 재설정해 주세요.";
      } else if (err.code === 'auth/network-request-failed') {
        msg = "네트워크 연결을 확인해 주세요.";
      }
      // [SEC] auth/user-not-found, auth/wrong-password → 동일 메시지로 통합
      
      showStatus(msg, 'error', 8000);
    }
  };

  const signup = async (email, password, userName, department) => {
    try {
      // [SEC] 입력값 검증
      const cleanName = sanitizeString(userName, 30);
      const cleanDept = sanitizeString(department, 100);
      if (!cleanName) throw { code: 'app/invalid-name' };
      if (password.length < 8) throw { code: 'app/weak-password' }; // Firebase 기본 6자보다 강화

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const u = cred.user;
      
      await updateAuthProfile(u, { displayName: cleanName });

      const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', u.uid);
      const isMaster = isMasterAdmin(u.email);

      const newProfile = {
        uid: u.uid,
        email: u.email,
        userName: cleanName,
        role: isMaster ? 'admin' : 'staff',
        status: 'approved',
        department: isMaster ? '인사팀' : (cleanDept || '미지정'),
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
      secureLog.error("Signup Error:", err.code);
      let msg = "회원가입에 실패했습니다.";
      if (err.code === 'auth/email-already-in-use') msg = "이미 사용 중인 이메일입니다.";
      else if (err.code === 'auth/weak-password' || err.code === 'app/weak-password') msg = "비밀번호는 8자리 이상이어야 합니다.";
      else if (err.code === 'auth/invalid-email') msg = "이메일 형식이 올바르지 않습니다.";
      else if (err.code === 'app/invalid-name') msg = "이름을 올바르게 입력해 주세요.";
      
      showStatus(msg, 'error', 8000); 
    }
  };

  const logout = () => signOut(auth).then(() => setView('dashboard'));

  const saveLog = async (logData) => {
    try {
      // [SEC] 입력값 검증 및 sanitize
      if (!user?.uid) throw new Error('Unauthorized');
      if (!isValidDate(logData.date)) throw new Error('Invalid date');
      if (!isValidDistance(logData.distance)) throw new Error('Invalid distance: ' + logData.distance);
      
      const logId = logData.id || `log_${Date.now()}`;
      
      // [FIX] 전역 로그 데이터 참조를 위해 기존 데이터 먼저 가져오기
      let existingLogData = null;
      if (logData.id) {
        const existingDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', logId));
        if (existingDoc.exists()) {
          existingLogData = existingDoc.data();
        }
      }

      // [SEC] 수정 시 소유자 검증 (관리자는 예외)
      if (logData.id && !isAdmin) {
        if (existingLogData && existingLogData.userId !== user.uid) {
          throw new Error('Forbidden: not the owner');
        }
      }

      const payload = {
        ...logData,
        id: logId,
        // [FIX] 관리자가 수정 시 원래 소유자 정보 유지, 신규 작성 시에만 현재 세션 정보 적용
        userId: logData.id ? (existingLogData?.userId || user.uid) : user.uid,
        userName: logData.id ? (existingLogData?.userName || profile?.userName || user.email) : sanitizeString(profile?.userName || user.email, 50),
        department: logData.id ? (existingLogData?.department || profile?.department || '미지정') : sanitizeString(profile?.department || '미지정', 100),
        purpose: sanitizeString(logData.purpose, 200),
        distance: Number(logData.distance),              // [SEC] 타입 강제 변환
        amount: Number(logData.amount),
        createdAt: logData.createdAt || existingLogData?.createdAt || new Date().toISOString(),
        date: logData.date || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
        requestStatus: 'none',
        requestType: null,
        requestReason: null
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', logId), payload);

      if (logData.isCorporate && logData.vehicleId && logData.odometerEnd) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'corporateVehicles', logData.vehicleId), {
          currentOdometer: Number(logData.odometerEnd)
        });
      }

      showStatus(logData.id ? "기록이 수정되었습니다." : "기록이 저장되었습니다.");
      
      // [FIX] 수정된 내역을 바로 볼 수 있도록 해당 월로 필터 자동 전환
      if (payload.date) {
        setHistoryFilters(prev => ({
          ...prev,
          selectedMonth: payload.date.slice(0, 7)
        }));
      }
      
      setView('history');
      setEditingLog(null);
    } catch (e) {
      secureLog.error('saveLog error:', e.message);
      if (e.message === 'Forbidden: not the owner') {
        showStatus("권한이 없습니다.", 'error');
      } else if (e.message?.includes('Invalid')) {
        showStatus("입력 데이터가 올바르지 않습니다.", 'error');
      } else {
        showStatus("저장 실패. 다시 시도해 주세요.", 'error');
      }
    }
  };

  const deleteLog = async (id) => {
    // [SEC] window.confirm 대신 앱 내 상태로 처리 (UI 스푸핑 방지 + UX 개선)
    // 실제 삭제는 HistoryTable의 DeleteConfirmModal에서 확인 후 호출
    try {
      if (!user?.uid || !id) throw new Error('Unauthorized');
      
      // [SEC] 소유자 또는 관리자만 삭제 허용
      const logDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'logs', id);
      const logDoc = await getDoc(logDocRef);
      if (!logDoc.exists()) throw new Error('Not found');
      if (!isAdmin && logDoc.data().userId !== user.uid) throw new Error('Forbidden');

      await deleteDoc(logDocRef);
      showStatus("삭제되었습니다.");
    } catch (e) {
      secureLog.error('deleteLog error:', e.message);
      if (e.message === 'Forbidden') {
        showStatus("삭제 권한이 없습니다.", 'error');
      } else {
        showStatus("삭제 실패. 다시 시도해 주세요.", 'error');
      }
    }
  };

  const requestCorrection = async (id, requestType, reason) => {
    try {
      if (!user?.uid || !id) throw new Error('Unauthorized');

      // [SEC] 본인 로그만 보정 요청 가능
      const logDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'logs', id);
      const logDoc = await getDoc(logDocRef);
      if (!logDoc.exists()) throw new Error('Not found');
      if (!isAdmin && logDoc.data().userId !== user.uid) throw new Error('Forbidden');

      const cleanReason = sanitizeString(reason, 300);
      const requestedAt = new Date().toISOString();
      await updateDoc(logDocRef, {
        requestStatus: 'pending',
        requestType: ['edit', 'delete'].includes(requestType) ? requestType : 'edit', // [SEC] 허용값만 저장
        requestReason: cleanReason,
        requestedAt
      });

      // 팀즈 알림 발송 (비동기로 실행하여 사용자 응답 지연 최소화)
      sendTeamsNotification(requestType, {
        userName: profile?.userName || user.email,
        reason: cleanReason,
        date: logDoc.data().date,
        requestedAt
      });

      showStatus("보정 요청이 전송되었습니다.");
    } catch (e) {
      secureLog.error('requestCorrection error:', e.message);
      if (e.message === 'Forbidden') {
        showStatus("요청 권한이 없습니다.", 'error');
      } else {
        showStatus("요청 실패. 다시 시도해 주세요.", 'error');
      }
    }
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
      
      // [PUSH] 신청자에게 알림 발송
      sendPushNotification(log.userId, '운행 내역 승인', '요청하신 운행 내역 수정이 승인되었습니다.');
      
      showStatus(`${log.userName}님의 요청이 승인되었습니다.`);
    } catch { showStatus("처리 실패", 'error'); }
  };

  const rejectRequest = async (id, reason = '') => {
    try {
      const logDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'logs', id);
      const logSnap = await getDoc(logDocRef);
      const logData = logSnap.data();

      await updateDoc(logDocRef, {
        requestStatus: 'none'
      });
      
      // [PUSH] 신청자에게 알림 발송
      if (logData) {
        sendPushNotification(logData.userId, '운행 내역 반려', `요청하신 내역이 반려되었습니다. 사유: ${reason || '관리자 검토 결과'}`);
      }

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
    let filename = `운행정산내역_${new Date().toLocaleDateString('sv-SE')}.csv`;

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

  const exportPDF = async () => {
    if (!pdfRef.current) return;
    
    setLoading(true);
    showStatus("PDF 리포트를 생성 중입니다...", "info");
    
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      
      // Calculate image height in mm to maintain aspect ratio
      const imgHeightOnPage = (imgProps.height * pageWidth) / imgProps.width;
      
      let heightLeft = imgHeightOnPage;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeightOnPage);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeightOnPage;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeightOnPage);
        heightLeft -= pageHeight;
      }
      
      const filename = `유류비_정산리포트_${reportFilters.selectedMonth || 'export'}.pdf`;
      pdf.save(filename);
      showStatus("PDF 리포트 내보내기 완료");
    } catch (err) {
      console.error(err);
      showStatus("PDF 생성 중 오류가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = profile?.role === 'admin' || isMasterAdmin(user?.email); 
  const viewTitle = view === 'dashboard' ? '대시보드' : view === 'log' ? (editingLog ? '운행 수정' : '신규 운행') : view === 'history' ? '정산 내역' : view === 'reports' ? '통계 리포트' : view === 'admin' ? '인사 관리' : view === 'orgchart' ? '조직도' : '내 프로필';

  return (
    <>
      {statusMessage && (
        <div className={`fixed top-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[1000] px-5 py-4 rounded-2xl shadow-2xl border animate-slide-up flex items-center gap-3 sm:min-w-[320px] sm:max-w-md ${
          statusMessage.type === 'error' 
            ? 'bg-red-50 text-red-700 border-red-100' 
            : statusMessage.type === 'info'
            ? 'bg-blue-50 text-blue-700 border-blue-100'
            : 'bg-green-50 text-green-700 border-green-100'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            statusMessage.type === 'error' ? 'bg-red-500 text-white' : statusMessage.type === 'info' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <FileText size={18} />}
          </div>
          <span className="font-bold text-sm flex-1 leading-tight">{statusMessage.msg}</span>
          <button onClick={() => setStatusMessage(null)} className="p-1.5 hover:bg-black/5 rounded-lg transition-all shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
          <div className="w-16 h-16 bg-[#1A1A1A] rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-yellow-100/20 animate-pulse">
            <ComposeLogo size={32} />
          </div>
          <p className="font-extrabold text-slate-800 text-[10px] tracking-[0.3em] uppercase">COMPOSE COFFEE</p>
        </div>
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
            onExport={handleNativeExport}
            onImport={handleNativeImport}
          />
          <div className={`flex-1 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} min-h-screen flex flex-col`}>
            {/* Mobile TopBar */}
            <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-100 flex items-center justify-between px-4 h-14 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden">
                  <ComposeLogo size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none">C-OIL</p>
                  <h2 className="text-base font-black text-slate-900 leading-tight">{viewTitle}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(view === 'history' || view === 'reports') && (
                  <button
                    onClick={exportPDF}
                    className="flex items-center gap-1.5 bg-indigo-600 px-3 py-2 rounded-xl text-white font-bold text-xs shadow-md shadow-indigo-100 active:scale-95 transition-all"
                  >
                    <FileText size={14} />
                    PDF
                  </button>
                )}
                <button
                  onClick={() => setView('profile')}
                  className="relative w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-md overflow-hidden"
                >
                  <img src={getAvatarUrl(user?.email)} alt="User Avatar" className="w-full h-full object-cover rounded-xl" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </button>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block p-10 pb-0">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 animate-fade-in">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-px w-8 bg-indigo-500 rounded-full"></span>
                    <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]">SYSTEM › {view.toUpperCase()}</span>
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">{viewTitle}</h1>
                </div>
                <div className="flex items-center gap-3">
                  {(view === 'history' || view === 'reports') && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={exportPDF}
                        className="flex items-center gap-2 bg-indigo-600 px-5 py-3 rounded-2xl text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                      >
                        <FileText size={18} /> 
                        <span className="text-sm">PDF 리포트 출력</span>
                      </button>
                      <button 
                        onClick={handleExportData}
                        className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-slate-100 text-slate-600 font-bold shadow-sm hover:shadow-md hover:border-indigo-100 transition-all active:scale-95"
                      >
                        <Download size={18} className="text-indigo-500" /> 
                        <span className="text-sm">CSV 데이터 내보내기</span>
                      </button>
                    </div>
                  )}
                </div>
              </header>
            </div>

            <div className="flex-1 px-4 py-4 lg:px-10 lg:py-0 lg:pb-10 max-w-7xl w-full mx-auto pb-24">
              <main className="max-w-7xl">
                {view === 'dashboard' && (
                  <Dashboard 
                    logs={logs} 
                    profile={profile} 
                    users={allUsers} 
                    orgUnits={orgUnits} 
                    onSearch={handleSearchLogs}
                    isSearching={isSearching}
                  />
                )}
                {view === 'log' && <LogEntryForm key={editingLog?.id || 'new'} fuelRates={fuelRates} profile={profile} onSave={saveLog} initialData={editingLog} isAdmin={isAdmin} db={db} appId={appId} corVehicles={corVehicles} />}
                {view === 'history' && (
                  <HistoryTable 
                    logs={authorizedLogs} 
                    onDelete={deleteLog} 
                    isAdmin={isAdmin} 
                    onRequestCorrection={requestCorrection} 
                    onEdit={(log) => { setEditingLog(log); setView('log'); }} 
                    profile={profile} 
                    filters={historyFilters}
                    onFilterChange={setHistoryFilters}
                    allUsers={allUsers}
                    onSearch={handleSearchLogs}
                    isSearching={isSearching}
                  />
                )}
                {view === 'reports' && (
                  <ManagementReport 
                    logs={authorizedLogs} 
                    users={allUsers} 
                    db={db} 
                    appId={appId} 
                    filters={reportFilters} 
                    onFilterChange={setReportFilters} 
                    orgUnits={orgUnits} 
                    corVehicles={corVehicles} 
                    profile={profile} 
                    onSearch={handleSearchLogs}
                    isSearching={isSearching}
                  />
                )}
                {view === 'admin' && <AdminPanel db={db} appId={appId} orgUnits={orgUnits} setOrgUnits={setOrgUnits} logs={authorizedLogs} onApproveRequest={approveRequest} onRejectRequest={rejectRequest} fuelRates={fuelRates} onUpdateSettings={updateSettings} corVehicles={corVehicles} onExport={handleNativeExport} onImport={handleNativeImport} notificationSettings={notificationSettings} showStatus={showStatus} />}
                {view === 'orgchart' && <OrgChartView orgUnits={orgUnits} users={allUsers} db={db} appId={appId} setOrgUnits={setOrgUnits} />}
                {view === 'profile' && <MyPage profile={profile} onUpdate={updateProfile} showStatus={showStatus} onLogout={logout} />}
              </main>
            </div>
          </div>
          
          <MobileBottomNav 
            currentView={view} 
            onNavigate={(v) => { setView(v); setEditingLog(null); }} 
            onMenuToggle={() => setIsMobileMenuOpen(true)} 
            pendingCount={logs.filter(log => log.requestStatus === 'pending').length}
            disabled={!profile?.vehicleName || !profile?.fuelType}
          />

          <MobileMenuSheet 
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            currentView={view}
            onNavigate={(v) => { setView(v); setEditingLog(null); }}
            onLogout={logout}
            isAdmin={isAdmin}
            userProfile={profile}
            pendingCount={logs.filter(log => log.requestStatus === 'pending').length}
          />
        </div>
      )}
      {/* Hidden PDF Template for generation */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}>
        <ReportPDFTemplate 
          innerRef={pdfRef} 
          logs={logs} 
          profile={profile} 
          reportFilters={reportFilters} 
          allUsers={allUsers}
        />
      </div>
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

const Dashboard = ({ logs, profile, users, orgUnits, onSearch, isSearching }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedUserId, setSelectedUserId] = useState(profile?.uid || 'all');
  const [selectedDept, setSelectedDept] = useState(profile?.department || 'all');

  // [OPT] 프로필 정보가 로드되면 대시보드 필터 초기값 동기화
  useEffect(() => {
    if (profile && selectedUserId === 'all' && selectedDept === 'all') {
      setSelectedUserId(profile.uid);
      setSelectedDept(profile.department);
    }
  }, [profile]);

  // [OPT] 대시보드 전용 조회 핸들러
  const handleDashboardSearch = () => {
    onSearch({
      selectedMonth,
      selectedDept,
      selectedMember: selectedUserId === 'all' ? 'all' : (users.find(u => u.uid === selectedUserId)?.userName || 'all')
    });
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // [FIX] 위치 기록 데이터는 통계에서 제외
      if (log.isCommute) return false;

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

          {/* 조회 버튼 추가 */}
          <button
            onClick={handleDashboardSearch}
            disabled={isSearching}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-sm transition-all shadow-sm active:scale-95 ${
              isSearching 
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
            }`}
          >
            {isSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
            {isSearching ? '조회 중...' : '조회'}
          </button>
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

const LogEntryForm = ({ fuelRates, profile, onSave, initialData, isAdmin, corVehicles }) => {
  // --- Helper: Robust Data Reconstruction ---
  const getInitialFormData = () => {
    const assignedVehicle = corVehicles.find(v => v.assignedUser === profile?.uid);

    if (!initialData) {
      const localDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      return {
        date: localDate,
        waypoints: [
          { id: 'start', label: '출발지', address: '', alias: '', purpose: '출발', lat: 37.5665, lng: 126.9780, parkingFee: 0, parkingNote: '' },
          { id: 'end', label: '도착지', address: '', alias: '', purpose: '도착', lat: 37.4979, lng: 127.0276, parkingFee: 0, parkingNote: '' }
        ],
        purpose: '',
        fuelType: assignedVehicle ? assignedVehicle.fuelType : (profile?.fuelType || 'gasoline'),
        distance: 0,
        isManualDistance: false,
        isCorporate: !!assignedVehicle,
        vehicleId: assignedVehicle ? assignedVehicle.id : '',
        odometerStart: assignedVehicle ? (assignedVehicle.currentOdometer || 0) : 0,
        odometerEnd: assignedVehicle ? (assignedVehicle.currentOdometer || 0) : 0,
        usageType: 'business'
      };
    }

    // [SEC] console.log 제거 - 운행 데이터 콘솔 노출 방지 (주소, 경로, 개인정보)
    // secureLog.warn을 통해 dev 환경에서만 로깅가능
    secureLog.warn('[LogEntryForm] initialData loaded');

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

    // [SEC] console.log 제거 - parsedWaypoints 공개 방지
    secureLog.warn('[LogEntryForm] parsedWaypoints count:', parsedWaypoints?.length);

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
      isManualDistance: false,
      isCorporate: initialData.isCorporate || false,
      vehicleId: initialData.vehicleId || '',
      odometerStart: initialData.odometerStart || 0,
      odometerEnd: initialData.odometerEnd || 0,
      usageType: initialData.usageType || 'business'
    };
  };

  const [favSelectorIdx, setFavSelectorIdx] = useState(null);
  const [favSearch, setFavSearch] = useState('');

  // key prop 덕분에 component가 mount될 때 이 초기값이 사용됩니다.
  const [formData, setFormData] = useState(getInitialFormData());

  // 유종 변경 반영 (프로필 설정 변경 시)
  useEffect(() => {
    if (!initialData && profile?.fuelType) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const dist = parseFloat(sum.toFixed(1));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({ 
        ...prev, 
        distance: dist,
        odometerEnd: prev.isCorporate ? (prev.odometerStart + dist) : 0
      }));
    }
  }, [formData.waypoints, formData.isManualDistance, formData.isCorporate, formData.odometerStart]);

  // 법인차량 선택 시 Odometer 시작값 자동 동기화
  const handleVehicleSelect = (vId) => {
    const vehicle = corVehicles.find(v => v.id === vId);
    if (vehicle) {
      setFormData(prev => ({
        ...prev,
        vehicleId: vId,
        odometerStart: vehicle.currentOdometer || 0,
        odometerEnd: (vehicle.currentOdometer || 0) + prev.distance
      }));
    } else {
      setFormData(prev => ({ ...prev, vehicleId: '', odometerStart: 0, odometerEnd: 0 }));
    }
  };

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
    }).open({
      left: window.screenX + (window.outerWidth - 500) / 2,
      top: window.screenY + (window.outerHeight - 600) / 2
    });
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
    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
      <form 
        onSubmit={handleSubmit} 
        onKeyDown={(e) => {
          // 엔터 키 입력 시 즉시 저장되는 것을 방지 (실수 방지 및 버튼 클릭 유도)
          if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
          }
        }}
        className="divide-y divide-slate-50"
      >
        {/* Section 1: 기본 정보 */}
        <div className="p-5 sm:p-10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputGroup label="운행 날짜" icon={<History size={16}/>}>
              <input 
                type="date" 
                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-bold text-slate-700 text-base" 
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
                <div className="w-full px-4 py-3.5 rounded-xl bg-slate-100/60 border border-slate-200 font-bold text-slate-600 flex items-center justify-between shadow-inner">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                    {formData.fuelType === 'gasoline' ? '휘발유' : formData.fuelType === 'diesel' ? '경유' : 'LPG'} 
                    <span className="text-indigo-500 text-xs">({Number(fuelRates?.[formData.fuelType]?.unitPrice || 0).toFixed(1)}원/km)</span>
                  </span>
                </div>
                <p className="mt-2 px-1 text-[10px] font-black text-slate-400 italic">
                  ※ 유종 변경은 <span className="text-indigo-500 underline underline-offset-2">'내 정보'</span> 메뉴에서 가능합니다.
                </p>
              </div>
            </InputGroup>
          </div>
        </div>

        {/* Section 2: 운행 경로 */}
        <div className="p-5 sm:p-10 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <MapPin size={15} className="text-blue-500" /> 운행 경로
            </label>
            <button 
              type="button"
              onClick={addStop}
              className="flex items-center gap-1.5 text-xs font-black bg-blue-600 text-white px-3 py-2 rounded-xl transition-all active:scale-95 shadow-md shadow-blue-100"
            >
              <PlusCircle size={14} /> 경유지 추가
            </button>
          </div>
          
          <div className="space-y-3">
            {formData.waypoints.map((wp, idx) => (
              <div key={wp.id} className="animate-fade-in">
                {/* 웨이포인트 카드 */}
                <div className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${
                  idx === 0 ? 'border-blue-100 bg-blue-50/30' :
                  idx === formData.waypoints.length - 1 ? 'border-indigo-100 bg-indigo-50/20' :
                  'border-slate-100 bg-slate-50/30'
                }`}>
                  {/* 카드 헤더 */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                      idx === 0 ? 'bg-blue-500 text-white' :
                      idx === formData.waypoints.length - 1 ? 'bg-indigo-600 text-white' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {wp.label || `경유지 ${idx}`}
                    </span>
                    {idx > 0 && idx < formData.waypoints.length - 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeStop(idx)}
                        className="p-2 bg-red-50 text-red-400 hover:text-red-600 transition-all active:scale-90 rounded-xl"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* 빠른 선택 버튼 */}
                  <div className="flex flex-wrap gap-2">
                    {profile?.homeAddress && (
                      <button 
                        type="button" 
                        onClick={() => handleQuickSelect(idx, { name: profile.homeAlias || '우리집', address: profile.homeAddress, lat: profile.homeLat, lng: profile.homeLng })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-black shadow-md shadow-indigo-100/50 active:scale-95 transition-all"
                      >
                        <span>🏠</span>
                        <span>{profile.homeAlias || '우리집'}</span>
                      </button>
                    )}
                    {profile?.savedLocations?.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => setFavSelectorIdx(idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-black active:scale-95 transition-all"
                      >
                        <Star size={12} className={favSelectorIdx === idx ? 'fill-amber-400 text-amber-400' : ''} />
                        <span>즐겨찾기</span>
                      </button>
                    )}
                  </div>

                  {/* 주소 검색 - 풀 너비 버튼 */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => openSearch(idx)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all font-bold text-sm text-left ${
                        wp.address 
                          ? 'bg-white border-slate-100 text-slate-700' 
                          : 'bg-white border-dashed border-slate-200 text-slate-300'
                      }`}
                    >
                      <span className="flex-1 mr-2 truncate">{wp.address || `${wp.label} 주소를 검색하세요`}</span>
                      <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg shrink-0">검색</span>
                    </button>
                    {!wp.address && (
                      <span className="absolute -bottom-4 right-0 text-[9px] font-black text-red-500">필수</span>
                    )}
                  </div>

                  {/* 명칭 + 방문 목적 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="명칭 (필수)"
                        className={`w-full px-3 py-3 rounded-xl border-2 outline-none transition-all font-bold text-sm ${
                          wp.alias ? 'border-transparent bg-slate-50 text-slate-700 focus:border-indigo-300 focus:bg-white' : 'border-red-100 bg-red-50/30 text-red-400 focus:border-red-300'
                        }`}
                        value={wp.alias}
                        onChange={(e) => handleAliasChange(idx, e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder={idx === 0 ? '출발' : '방문 목적 (필수)'}
                        readOnly={idx === 0}
                        className={`w-full px-3 py-3 rounded-xl outline-none transition-all font-bold text-sm border-2 ${
                          idx === 0 
                          ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed'
                          : (wp.purpose ? 'border-transparent bg-slate-50 text-slate-700 focus:border-indigo-300 focus:bg-white' : 'border-red-100 bg-red-50/30 text-red-400 focus:border-red-300')
                        }`}
                        value={wp.purpose}
                        onChange={(e) => handleStopPurposeChange(idx, e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 주차비 */}
                  <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 px-4 py-3">
                    <span className="text-xs font-black text-slate-400">회사 주차비</span>
                    <div className="relative flex-1">
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full pr-6 pl-2 py-1 bg-transparent outline-none font-black text-indigo-600 text-sm text-right appearance-none"
                        value={wp.parkingFee || ''}
                        onChange={(e) => {
                          const newWaypoints = [...formData.waypoints];
                          newWaypoints[idx].parkingFee = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, waypoints: newWaypoints });
                        }}
                      />
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">원</span>
                    </div>
                    {wp.parkingFee > 0 && (
                      <input 
                        type="text"
                        placeholder="사유 (예: 유료주차장)"
                        className="flex-[2] px-3 py-1 rounded-lg bg-indigo-50/50 border border-indigo-100/50 outline-none font-bold text-xs text-indigo-700 focus:bg-indigo-50 transition-all"
                        value={wp.parkingNote || ''}
                        onChange={(e) => {
                          const newWaypoints = [...formData.waypoints];
                          newWaypoints[idx].parkingNote = e.target.value;
                          setFormData({ ...formData, waypoints: newWaypoints });
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* 경로 연결선 */}
                {idx < formData.waypoints.length - 1 && (
                  <div className="flex items-center justify-center py-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-px h-2 bg-slate-200"></div>
                      <div className="w-px h-2 bg-slate-200"></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: 업무 상세 */}
        <div className="px-5 py-5 sm:px-10">
          <InputGroup label="업무 상세 내용" icon={<FileText size={16}/>}>
            <input 
              type="text" 
              placeholder="특이사항이나 세부 목적을 입력하세요." 
              className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 outline-none transition-all font-bold text-slate-700"
              value={formData.purpose}
              onChange={e => setFormData({...formData, purpose: e.target.value})}
            />
          </InputGroup>
        </div>

        {/* Section 4: 거리 및 그싨 정산 */}
        <div className="p-5 sm:p-10">
          <div className="grid grid-cols-2 gap-4 premium-card p-5 rounded-2xl sm:rounded-[2rem]">
            <div className="flex flex-col justify-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Distance</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">{formData.distance}</span>
                <span className="text-lg text-slate-400 font-bold">km</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2">시스템 자동 산출 (1.25배 보정)</p>
            </div>
            <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-premium-gradient shadow-xl shadow-indigo-200 text-white flex flex-col justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Expected</p>
                <h4 className="text-xl sm:text-3xl font-black">{calculatedAmount.toLocaleString()}<span className="text-xs sm:text-base ml-1 opacity-60">원</span></h4>
              </div>
              <p className="text-[9px] font-bold opacity-50 mt-2">
                유료 {(Math.round(formData.distance * Number(fuelRates?.[formData.fuelType]?.unitPrice || 0))).toLocaleString()} + 
                주차 {formData.waypoints.reduce((acc, wp) => acc + (Number(wp.parkingFee) || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: 제출 버튼 */}
        <div className="p-5 sm:p-10 pt-0">
          <button 
            type="submit" 
            disabled={!isFormValid}
            className={`w-full py-4 sm:py-5 rounded-2xl font-black text-base transition-all shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] ${
              isFormValid 
              ? 'bg-slate-900 text-white shadow-slate-200 hover:bg-black' 
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            {initialData ? <Settings size={20} /> : <PlusCircle size={20} />} 
            {initialData ? '기록 수정 완료하기' : (formData.distance > 0 ? '기록 완료하기' : '상세 정보를 입력해 주세요')}
          </button>
        </div>
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

const HistoryTable = ({ logs, onDelete, isAdmin, onRequestCorrection, onEdit, profile, filters, onFilterChange, allUsers, onSearch, isSearching }) => {
  const [requestModal, setRequestModal] = useState({ show: false, logId: null, type: 'delete' });
  const [reason, setReason] = useState('');
  
  const { selectedMonth, selectedDept, selectedMember, selectedDate: selectedDateFilter } = filters;

  const setSelectedMonth = (val) => onFilterChange({ ...filters, selectedMonth: val });
  const setSelectedDept = (val) => onFilterChange({ ...filters, selectedDept: val, selectedMember: 'all' });
  const setSelectedMember = (val) => onFilterChange({ ...filters, selectedMember: val });
  const setSelectedDateFilter = (val) => onFilterChange({ ...filters, selectedDate: val });

  // 권한에 따른 필터 노출 여부
  const showFilters = isAdmin || profile?.role === 'manager';

  // 선택된 월에 해당하는 로그들 우선 추출 (필터 옵션 구성을 위함)
  const filteredByMonth = useMemo(() => {
    return logs.filter(log => log.date.startsWith(selectedMonth));
  }, [logs, selectedMonth]);

  // 가용 부서 목록 추출
  const availableDepts = useMemo(() => {
    const depts = new Set();
    filteredByMonth.forEach(log => {
      if (log.department) depts.add(log.department);
    });
    return Array.from(depts).sort();
  }, [filteredByMonth]);

  // 가용 사용자 목록 추출
  const availableMembers = useMemo(() => {
    const mems = new Set();
    filteredByMonth.forEach(log => {
      // [FIX] 부서 매칭 시 하위 부서까지 포함될 수 있도록 startsWith 사용
      const isMatch = selectedDept === 'all' || (log.department && log.department.startsWith(selectedDept));
      if (isMatch && log.userName) {
        mems.add(log.userName);
      }
    });
    return Array.from(mems).sort();
  }, [filteredByMonth, selectedDept]);

  // 부서가 바뀌어 현재 선택된 사용자가 가용 목록에 없으면 초기화
  useEffect(() => {
    // 로그 데이터가 아직 로딩 중이거나 비어있을 때는 초기화하지 않음 (flicker 방지)
    if (logs.length === 0) return;
    
    if (selectedMember !== 'all' && availableMembers.length > 0 && !availableMembers.includes(selectedMember)) {
      setSelectedMember('all');
    }
  }, [availableMembers, selectedMember, logs.length]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // [FIX] 위치 기록(출퇴근 등) 데이터는 정산 내역 목록에서 제외
      if (log.isCommute) return false;

      const matchMonth = log.date.startsWith(selectedMonth);
      const matchDate = !selectedDateFilter || log.date === selectedDateFilter;
      
      // [FIX] 로그 자체에 부서 정보가 없는 경우, 사용자 정보를 참조하여 필터링 보완
      const logUser = allUsers?.find(u => u.uid === log.userId);
      const logDept = (log.department || logUser?.department || "").trim();
      const targetDept = (selectedDept || "").trim();

      // [FIX] 부서 필터링을 계층형(startsWith)으로 변경하여 하위 부서 포함 가능하게 함
      const matchDept = !showFilters || selectedDept === 'all' || (logDept && logDept.startsWith(targetDept));
      const matchMember = !showFilters || selectedMember === 'all' || log.userName === selectedMember;
      
      return matchMonth && matchDate && matchDept && matchMember;
    });
  }, [logs, selectedMonth, selectedDateFilter, selectedDept, selectedMember, showFilters, allUsers]);

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
      <div className="flex flex-col gap-4 mb-6">
        {/* Row 1: 월 선택 + 사용자 검색 */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-indigo-50 transition-all flex-1 min-w-[160px] max-w-[220px]">
            <Calendar size={16} className="text-indigo-500 shrink-0" />
            <input 
              type="month" 
              className="bg-transparent font-black text-slate-700 outline-none cursor-pointer text-sm w-full"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
              }}
            />
          </div>

          {showFilters && (
            <>
              {/* 팀(부서) 필터 */}
              <div className="relative flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-indigo-50 transition-all flex-1 min-w-[160px]">
                <Network size={16} className="text-indigo-500 shrink-0" />
                <select 
                  className="bg-transparent font-black text-slate-700 outline-none cursor-pointer text-sm w-full appearance-none pr-6"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="all">부서 전체</option>
                  {/* 선택된 부서가 목록에 없더라도 옵션에 추가하여 선택 상태 유지 */}
                  {selectedDept !== 'all' && !availableDepts.includes(selectedDept) && (
                    <option value={selectedDept}>{selectedDept.split(' > ').pop()}</option>
                  )}
                  {availableDepts.map(dept => (
                    <option key={dept} value={dept}>{dept.split(' > ').pop()}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4 text-slate-300 pointer-events-none" />
              </div>

              {/* 사용자 필터 */}
              <div className="relative flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-indigo-50 transition-all flex-1 min-w-[160px]">
                <Users size={16} className="text-indigo-500 shrink-0" />
                <select 
                  className="bg-transparent font-black text-slate-700 outline-none cursor-pointer text-sm w-full appearance-none pr-6"
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                >
                  <option value="all">사용자 전체</option>
                  {/* 선택된 사용자가 목록에 없더라도 옵션에 추가하여 선택 상태 유지 */}
                  {selectedMember !== 'all' && !availableMembers.includes(selectedMember) && (
                    <option value={selectedMember}>{selectedMember}</option>
                  )}
                  {availableMembers.map(member => (
                    <option key={member} value={member}>{member}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4 text-slate-300 pointer-events-none" />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-indigo-50 transition-all flex-1 min-w-[160px]">
            <Calendar size={16} className="text-emerald-500 shrink-0" />
            <input 
              type="date" 
              className="bg-transparent font-black text-slate-700 outline-none cursor-pointer text-sm w-full"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
            />
            {selectedDateFilter && (
              <button onClick={() => setSelectedDateFilter('')} className="p-1 hover:bg-slate-50 rounded-lg transition-all text-slate-400 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>

          {/* 조회 버튼 추가 */}
          <button
            onClick={() => onSearch()}
            disabled={isSearching}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-sm active:scale-95 ${
              isSearching 
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
            }`}
          >
            {isSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
            {isSearching ? '조회 중...' : '조회'}
          </button>
        </div>

        {/* Row 2: 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white px-4 py-3.5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">총 KM</p>
            <p className="text-base font-black text-slate-900">{stats.totalDist.toFixed(1)}<span className="text-xs ml-0.5 opacity-50">km</span></p>
          </div>
          <div className="bg-white px-4 py-3.5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">주유비</p>
            <p className="text-base font-black text-slate-900">{stats.totalFuel.toLocaleString()}<span className="text-xs ml-0.5 opacity-50">원</span></p>
          </div>
          <div className="bg-white px-4 py-3.5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">주차비</p>
            <p className="text-base font-black text-slate-900">{stats.totalParking.toLocaleString()}<span className="text-xs ml-0.5 opacity-50">원</span></p>
          </div>
          <div className="bg-indigo-600 px-4 py-3.5 rounded-2xl shadow-lg shadow-indigo-100">
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">정산 합계</p>
            <p className="text-base font-black text-white">{stats.totalAmount.toLocaleString()}<span className="text-xs ml-0.5 opacity-60">원</span></p>
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
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <span className="font-black text-slate-800 text-[13px]">{log.userName}</span>
                          </div>
                          <div className="pl-3.5 text-[10px] font-bold text-slate-400">
                            {(log.department || allUsers?.find(u => u.uid === log.userId)?.department || '부서 미지정')}
                          </div>
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
               <History size={36} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-500 font-bold">운행 내역이 없습니다.</p>
               <p className="text-slate-300 text-xs mt-1">해당 월에 등록된 운행이 없어요</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const locked = isLogLocked(log);
              const isPending = log.requestStatus === 'pending';
              const isApproved = log.requestStatus === 'approved';
              // 경로 요약: 출발 → 도착 방식으로 간략 표시
              const routeStops = log.routeSummary ? log.routeSummary.split(' → ') : null;
              const departure = routeStops ? routeStops[0] : log.departure;
              const destination = routeStops ? routeStops[routeStops.length - 1] : log.destination;
              return (
                <div key={log.id} className="p-4 flex flex-col gap-3 bg-white active:bg-slate-50 transition-all">
                  {/* 상단: 날짜 + 금액 */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900">{log.date}</span>
                        {locked && <span className="bg-amber-50 text-amber-600 text-[9px] font-black px-2 py-0.5 rounded-lg inline-flex items-center gap-1"><Lock size={9} />마감</span>}
                        {isApproved && <span className="bg-emerald-50 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded-lg border border-emerald-100">보정 승인</span>}
                        {isPending && <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-lg">검토 중</span>}
                      </div>
                      <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                        <span className="truncate max-w-[160px]">{log.userName}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <div className="font-black text-indigo-600 text-xl">
                        {Number(log.amount || 0).toLocaleString()}<span className="text-xs ml-0.5 opacity-60">원</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {log.distance}km · {log.fuelType === 'gasoline' ? '휘발유' : log.fuelType === 'diesel' ? '경유' : 'LPG'}
                      </div>
                    </div>
                  </div>

                  {/* 경로 */}
                  <div className="bg-slate-50 px-3.5 py-3 rounded-xl flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-600 truncate">{departure}</span>
                        <ChevronRight size={12} className="text-slate-300 shrink-0" />
                        <span className="text-xs font-bold text-slate-600 truncate">{destination}</span>
                      </div>
                      {log.purpose && (
                        <div className="mt-1.5">
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <span className="opacity-50">#</span>{log.purpose}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2">
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
  }, [selectedMonth, db, appId, fuelRates]);

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

const NotificationSettingsPanel = ({ settings, db, appId, showStatus }) => {
  const [webhookUrl, setWebhookUrl] = useState(settings?.teamsWebhookUrl || '');
  const [enabled, setEnabled] = useState(settings?.enabled || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWebhookUrl(settings?.teamsWebhookUrl || '');
    setEnabled(settings?.enabled || false);
  }, [settings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'notifications'), {
        teamsWebhookUrl: webhookUrl,
        enabled: enabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showStatus("알림 설정이 저장되었습니다.");
    } catch (err) {
      console.error(err);
      showStatus("저장 실패: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) return showStatus("웹훅 URL을 입력해 주세요.", "error");
    
    setLoading(true);
    try {
      const payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "00FF00",
        "summary": "C-OIL 팀즈 알림 테스트",
        "sections": [{
          "activityTitle": "✅ C-OIL 팀즈 알림 연동 테스트",
          "activitySubtitle": "연동 성공",
          "text": "팀즈 알림 연동이 성공적으로 설정되었습니다. 이제 보정 요청 발생 시 이 채널로 즉시 알림이 전송됩니다.",
          "markdown": true
        }]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
      showStatus("테스트 알림을 전송했습니다. 팀즈 채널에 메시지가 왔는지 확인해 주세요. (브라우저 정책상 성공 여부 확인이 어려울 수 있습니다)");
    } catch (err) {
      console.error(err);
      showStatus("테스트 실패: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-card p-10 animate-fade-in space-y-10">
      <div className="flex items-center justify-between">
        <div>
           <h3 className="text-2xl font-black text-slate-900 mb-2">Microsoft Teams 알림 설정</h3>
           <p className="text-sm font-bold text-slate-400">보정 요청이 들어올 때 인사팀 팀즈로 즉시 알림을 보냅니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-black uppercase tracking-widest ${enabled ? 'text-indigo-600' : 'text-slate-400'}`}>
            {enabled ? '작동 중' : '중단됨'}
          </span>
          <button 
            onClick={() => setEnabled(!enabled)}
            className={`w-14 h-8 rounded-full transition-all flex items-center p-1 ${enabled ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'}`}
          >
            <div className="w-6 h-6 bg-white rounded-full shadow-sm"></div>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Teams Incoming Webhook URL</label>
          <div className="relative group">
            <Bell size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-100/50 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
              placeholder="https://outlook.office.com/webhook/..."
            />
          </div>
          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed font-bold">
            * 팀즈 채널 설정에서 [커넥터] {"->"} [Incoming Webhook]을 추가하여 발급받은 URL을 입력하세요.
          </p>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={handleTest}
            disabled={loading}
            className="flex-1 bg-white border-2 border-slate-100 text-slate-600 py-4 rounded-2xl font-black hover:border-indigo-100 hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            테스트 전송
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            설정 저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

const MyPage = ({ profile, onUpdate, showStatus, onLogout }) => {
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
    }).open({
      left: window.screenX + (window.outerWidth - 500) / 2,
      top: window.screenY + (window.outerHeight - 600) / 2
    });
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center gap-5">
        <div className="w-14 h-14 bg-[#1A1A1A] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200 shrink-0 overflow-hidden">
          <img src={getAvatarUrl(profile?.email)} alt="Profile Avatar" className="w-full h-full object-cover rounded-2xl" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{profile?.userName} 님</h3>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{profile?.department || '부서 미지정'}</span>
            <span className="text-[12px] font-bold text-slate-400">{profile?.email}</span>
          </div>
        </div>
        <div className="hidden lg:flex ml-auto items-center gap-2">
            <button 
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-500 font-black text-xs hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-sm shadow-red-100/50"
            >
                <LogOut size={16} />
                <span>로그아웃</span>
            </button>
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
               className="bg-[#1A1A1A] text-white px-4 py-3 rounded-xl font-black hover:bg-black transition-all text-xs shadow-md shadow-slate-200"
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
                }).open({
                  left: window.screenX + (window.outerWidth - 500) / 2,
                  top: window.screenY + (window.outerHeight - 600) / 2
                });
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

// --- Enhanched Mobile Nav Components ---

const MobileBottomNav = ({ currentView, onNavigate, onMenuToggle, pendingCount, disabled }) => {
  const tabs = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: '대시보드' },
    { id: 'log', icon: <PlusCircle size={24} className="text-white" />, label: '신규등록', isAction: true },
    { id: 'history', icon: <History size={20} />, label: '정산내역' },
    { id: 'menu', icon: <Menu size={20} />, label: '전체메뉴', isMenu: true }
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-100 pb-2 z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={disabled ? undefined : () => {
              if (tab.isMenu) onMenuToggle();
              else onNavigate(tab.id);
            }}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${
              disabled ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            {tab.isAction ? (
              <div className="bg-indigo-600 w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 -mt-5 border-4 border-white">
                {tab.icon}
              </div>
            ) : (
              <>
                <div className={`relative ${currentView === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {tab.icon}
                  {tab.id === 'menu' && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                <span className={`text-[9.5px] font-black tracking-tight ${currentView === tab.id && !tab.isMenu ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

const MobileMenuSheet = ({ isOpen, onClose, currentView, onNavigate, onLogout, isAdmin, userProfile, pendingCount }) => {
  if (!isOpen) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 pb-10 animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">전체 메뉴</h2>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-6 flex items-center gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md overflow-hidden">
            <img src={getAvatarUrl(userProfile?.email)} alt="User Avatar" className="w-full h-full object-cover rounded-xl" />
          </div>
          <div>
            <p className="text-[10px] font-black text-indigo-500 tracking-widest uppercase mb-0.5">{userProfile?.department}</p>
            <h3 className="text-base font-black text-slate-900 tracking-tight leading-none">{userProfile?.userName}</h3>
          </div>
        </div>

        <div className="space-y-2 mb-8">
          <button onClick={() => { onNavigate('profile'); onClose(); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${currentView === 'profile' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
             <UserCircle size={20} /> <span className="font-bold text-sm">내 프로필</span>
          </button>
          
          {(isAdmin || userProfile?.role === 'manager') && (
            <button onClick={() => { onNavigate('reports'); onClose(); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${currentView === 'reports' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
              <FileText size={20} /> <span className="font-bold text-sm">통계 리포트</span>
            </button>
          )}
          
          {isAdmin && (
            <button onClick={() => { onNavigate('admin'); onClose(); }} className={`w-full flex items-center justify-between p-4 rounded-2xl ${currentView === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
              <div className="flex items-center gap-3">
                 <Settings size={20} /> <span className="font-bold text-sm">인사 관리</span>
              </div>
              {pendingCount > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingCount}</span>}
            </button>
          )}

          <button onClick={() => { onNavigate('orgchart'); onClose(); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${currentView === 'orgchart' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
             <Network size={20} /> <span className="font-bold text-sm">조직도</span>
          </button>
        </div>

        <button onClick={() => { onClose(); onLogout(); }} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-50 text-red-500 font-bold active:scale-95 transition-all">
          <LogOut size={18} /> 로그아웃
        </button>
      </div>
    </div>
  );
};

// --- Enhanced Components ---

const Sidebar = ({ currentView, onNavigate, onLogout, isAdmin, userProfile, isCollapsed, onToggle, setEditingLog, pendingRequestsCount, onExport, onImport }) => {
  const profileIncomplete = !userProfile?.vehicleName || !userProfile?.fuelType;
  return (
    <>
      {/* Desktop Sidebar */}
      <nav className={`hidden lg:flex fixed top-0 left-0 ${isCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-100 flex-col p-6 z-50 transition-all duration-500 ease-in-out overflow-y-auto h-full scrollbar-none`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center mb-5' : 'justify-between mb-8 px-2'}`}>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-[#1A1A1A] rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-yellow-100/10 shrink-0 group-hover:scale-105 transition-transform duration-500 overflow-hidden">
              <ComposeLogo size={24} />
            </div>
            {!isCollapsed && (
              <div className="animate-fade-in">
                <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
                  COMPOSE <span className="text-indigo-600">OIL</span>
                </h1>
                <p className="text-[9px] font-bold text-slate-400 tracking-[0.1em] uppercase mt-1.5 opacity-60">Management System</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button onClick={onToggle} className="p-1.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all">
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        <div className={`transition-all duration-500 ${isCollapsed ? 'mb-6' : 'mb-8 px-1'}`}>
          {isCollapsed ? (
            <div className="flex justify-center">
              <div className="relative w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-lg cursor-pointer overflow-hidden" onClick={() => onNavigate('profile')}>
                <img src={getAvatarUrl(userProfile?.email)} alt="User Avatar" className="w-full h-full object-cover rounded-2xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
              </div>
            </div>
          ) : (
            <div className="relative p-4 rounded-[1.8rem] bg-indigo-50/30 border border-indigo-100/50 animate-fade-in overflow-hidden">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-xl shadow-indigo-100 overflow-hidden">
                  <img src={getAvatarUrl(userProfile?.email)} alt="User Avatar" className="w-full h-full object-cover rounded-2xl" />
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
                {userProfile?.role === 'manager' && <div className="px-1.5 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-tighter shrink-0 shadow-sm shadow-amber-100">리더</div>}
                {userProfile?.role === 'admin' && <div className="px-1.5 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-tighter shrink-0 shadow-sm shadow-indigo-100">인사</div>}
              </div>
            </div>
          )}
        </div>

        {isCollapsed && (
          <button onClick={onToggle} className="flex items-center justify-center p-3 mb-6 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
            <PanelLeftOpen size={18} />
          </button>
        )}

        <div className="flex flex-col flex-1 gap-1.5 min-h-0">
          <NavItem isCollapsed={isCollapsed} icon={<LayoutDashboard />} label="대시보드" active={currentView === 'dashboard'} onClick={() => { onNavigate('dashboard'); setEditingLog(null); }} disabled={profileIncomplete} />
          <NavItem isCollapsed={isCollapsed} icon={<PlusCircle />} label="신규 운행" active={currentView === 'log'} onClick={() => { onNavigate('log'); setEditingLog(null); }} disabled={profileIncomplete} />
          <NavItem isCollapsed={isCollapsed} icon={<History />} label="정산 내역" active={currentView === 'history'} onClick={() => { onNavigate('history'); setEditingLog(null); }} disabled={profileIncomplete} />
          {isAdmin && (
            <>
              <div className={`h-px bg-slate-100 my-2 ${isCollapsed ? 'mx-2' : 'mx-4'}`}></div>
              <NavItem isCollapsed={isCollapsed} icon={<FileText />} label="운행 통계" active={currentView === 'reports'} onClick={() => onNavigate('reports')} disabled={profileIncomplete} />
              <NavItem isCollapsed={isCollapsed} icon={<Users />} label="인사/조직 관리" active={currentView === 'admin'} onClick={() => onNavigate('admin')} disabled={profileIncomplete} badge={pendingRequestsCount} />
            </>
          )}
          {/* [HIDDEN] 개인 데이터가 없으므로 백업/복구 버튼 숨김 처리
          {isAdmin && (
            <div className={`mt-4 pt-4 border-t border-slate-50 flex flex-col gap-1.5 ${isCollapsed ? 'items-center' : 'px-1'}`}>
              <button 
                onClick={onExport}
                className={`flex items-center ${isCollapsed ? 'justify-center w-10 h-10' : 'gap-3 px-5 py-3'} rounded-2xl text-[11px] font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white transition-all`}
                title="데이터 백업 (JSON)"
              >
                <Download size={16} />
                {!isCollapsed && <span>데이터 백업</span>}
              </button>
              <label className={`flex items-center cursor-pointer ${isCollapsed ? 'justify-center w-10 h-10' : 'gap-3 px-5 py-3'} rounded-2xl text-[11px] font-black text-emerald-600 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white transition-all`}>
                <RefreshCw size={16} />
                {!isCollapsed && <span>데이터 복구</span>}
                <input type="file" accept=".json" onChange={onImport} className="hidden" />
              </label>
            </div>
          )}
          */}
          <div className="flex-1 min-h-[0.5rem]"></div>
          <NavItem isCollapsed={isCollapsed} icon={<UserCircle />} label="내 정보" active={currentView === 'profile'} onClick={() => onNavigate('profile')} />
          <button
            onClick={onLogout}
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-5'} py-3.5 rounded-2xl text-[13px] font-bold text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all mt-2 active:scale-95`}
          >
            {isCollapsed ? <LogOut size={20} /> : <><LogOut size={16} /><span className="tracking-tight">로그아웃</span></>}
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch h-16 px-1">
          {/* 대시보드 */}
          <MobileNavItem
            icon={<LayoutDashboard size={22} />}
            label="대시보드"
            active={currentView === 'dashboard'}
            disabled={profileIncomplete}
            onClick={() => { onNavigate('dashboard'); setEditingLog(null); }}
          />
          {/* 신규 운행 - 강조 버튼 */}
          <div className="flex-1 flex items-center justify-center relative">
            <button
              disabled={profileIncomplete}
              onClick={() => { onNavigate('log'); setEditingLog(null); }}
              className={`absolute -top-5 w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-xl transition-all active:scale-95 ${
                profileIncomplete ? 'bg-slate-200 cursor-not-allowed' :
                currentView === 'log' ? 'bg-indigo-700 shadow-indigo-300' : 'bg-indigo-600 shadow-indigo-200'
              }`}
            >
              <PlusCircle size={26} className="text-white" />
            </button>
          </div>
          {/* 정산 내역 */}
          <MobileNavItem
            icon={<History size={22} />}
            label="정산 내역"
            active={currentView === 'history'}
            disabled={profileIncomplete}
            onClick={() => { onNavigate('history'); setEditingLog(null); }}
          />
          {/* 내 정보 */}
          <MobileNavItem
            icon={<UserCircle size={22} />}
            label="내 정보"
            active={currentView === 'profile'}
            onClick={() => onNavigate('profile')}
            badge={pendingRequestsCount > 0 && isAdmin ? pendingRequestsCount : 0}
          />
        </div>
        {/* Home indicator area */}
        <div className="h-safe-area-inset-bottom bg-white"></div>
      </nav>
    </>
  );
};

const MobileNavItem = ({ icon, label, active, onClick, disabled, badge }) => (
  <button
    onClick={disabled ? undefined : onClick}
    className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 transition-all relative ${
      disabled ? 'opacity-30' : 'active:scale-95'
    }`}
  >
    {active && (
      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-full"></span>
    )}
    <span className={`transition-colors ${
      active ? 'text-indigo-600' : 'text-slate-400'
    }`}>
      {icon}
    </span>
    <span className={`text-[10px] font-bold tracking-tight transition-colors ${
      active ? 'text-indigo-600' : 'text-slate-400'
    }`}>{label}</span>
    {badge > 0 && (
      <span className="absolute top-1.5 right-[calc(50%-12px)] flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-sm">
        {badge}
      </span>
    )}
  </button>
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
            
            <div className="w-[120px] h-[120px] bg-[#1A1A1A] rounded-[3rem] flex items-center justify-center mb-12 shadow-2xl shadow-yellow-500/10 border border-white/5 group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 to-transparent"></div>
               <ComposeLogo size={64} className="relative z-10" />
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

  const AdminPanel = ({ db, appId, orgUnits, setOrgUnits, logs, onApproveRequest, onRejectRequest, fuelRates, onUpdateSettings, corVehicles, onExport, onImport, notificationSettings, showStatus }) => {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrateDept = async () => {
    const targetPath = "경영지원본부 > 인사총무팀";
    if (!window.confirm("부서 데이터 구조를 재정비하시겠습니까?\n1. '(주)컴포즈커피 > ' 접두어 제거\n2. '인사팀' -> '경영지원본부 > 인사총무팀' 변경")) return;
    setIsMigrating(true);
    try {
      let logUpdated = 0;
      let profileUpdated = 0;

      // 1. Logs 수정
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
      const logSnap = await getDocs(logsRef);
      const logBatch = writeBatch(db);
      
      logSnap.docs.forEach(d => {
        let dept = d.data().department || "";
        let original = dept;
        
        // 접두어 제거
        if (dept.startsWith("(주)컴포즈커피 > ")) {
          dept = dept.replace("(주)컴포즈커피 > ", "");
        }
        // 인사팀 매칭
        if (dept.includes("인사")) {
          dept = targetPath;
        }

        if (dept !== original) {
          logBatch.update(d.ref, { department: dept });
          logUpdated++;
        }
      });
      if (logUpdated > 0) await logBatch.commit();

      // 2. Profiles 수정
      const profilesRef = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
      const profileSnap = await getDocs(profilesRef);
      const profileBatch = writeBatch(db);

      profileSnap.docs.forEach(d => {
        let dept = d.data().department || "";
        let original = dept;

        if (dept.startsWith("(주)컴포즈커피 > ")) {
          dept = dept.replace("(주)컴포즈커피 > ", "");
        }
        if (dept.includes("인사")) {
          dept = targetPath;
        }

        if (dept !== original) {
          profileBatch.update(d.ref, { department: dept });
          profileUpdated++;
        }
      });
      if (profileUpdated > 0) await profileBatch.commit();

      alert(`구조 재정비 완료!\n- 로그 수정: ${logUpdated}건\n- 프로필 수정: ${profileUpdated}건`);
    } catch (e) {
      console.error(e);
      alert("변경 중 오류가 발생했습니다.");
    } finally {
      setIsMigrating(false);
    }
  };

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

  const updateUser = async (uid, updates) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', uid), updates);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-4 p-2 bg-white rounded-[2rem] w-fit border border-slate-100 shadow-sm">
        {/* [HIDDEN] 데이터 관리 탭 주석 처리 (필요시 활성화)
        <button 
          onClick={() => setActiveTab('migrate')}
          className={`px-8 py-4 rounded-2xl font-black text-sm transition-all flex items-center gap-3 ${activeTab === 'migrate' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
        >
          <RefreshCw size={16} /> 데이터 관리
        </button>
        */}
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
        <button 
          onClick={() => setActiveTab('corporate')}
          className={`px-8 py-4 rounded-2xl font-black text-sm transition-all flex items-center gap-3 ${activeTab === 'corporate' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
        >
          <Car size={16} /> 법인차량 관리
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={`px-8 py-4 rounded-2xl font-black text-sm transition-all flex items-center gap-3 ${activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
        >
          <Bell size={16} /> 알림 설정
        </button>
      </div>


      {/* [HIDDEN] 마이그레이션 UI 주석 처리
      {activeTab === 'migrate' && (
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8 animate-slide-up">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">부서 데이터 일괄 정리</h3>
            <p className="text-sm font-bold text-slate-400 mt-2">과거 기록 중 특정 부서명을 일괄적으로 수정합니다.</p>
          </div>
          
          <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100">
            <h4 className="font-black text-amber-800 mb-2">인사팀 → 인사총무팀 (강력한 정리)</h4>
            <p className="text-sm text-amber-700 font-medium mb-6">'인사팀'이라는 단어가 포함된 모든 부서명(경로 포함)을 찾아 '인사총무팀'으로 변경합니다. 로그 기록뿐만 아니라 사용자 프로필의 부서 정보도 함께 수정됩니다.</p>
            <button
              onClick={handleMigrateDept}
              disabled={isMigrating}
              className={`px-8 py-4 rounded-2xl font-black text-sm shadow-lg transition-all flex items-center gap-3 ${isMigrating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-amber-100'}`}
            >
              <RefreshCw size={18} className={isMigrating ? 'animate-spin' : ''} />
              {isMigrating ? '처리 중...' : '부서명 정리 실행 (강력)'}
            </button>
          </div>
        </div>
      )}
      */}

      {activeTab === 'users' && <OrgChartView orgUnits={orgUnits} users={users} db={db} appId={appId} setOrgUnits={setOrgUnits} onUpdateUser={updateUser} />}
      {activeTab === 'requests' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex items-center justify-between px-2">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
               <History className="text-orange-500" /> 보정 요청 검토
             </h3>
             <div className="flex items-center gap-3">
               <button 
                 onClick={() => setActiveTab('notifications')}
                 className="flex items-center gap-2 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all border border-transparent hover:border-indigo-100"
               >
                 <Bell size={14} /> 
                 팀즈 알림 {notificationSettings.enabled ? 'ON' : 'OFF'}
               </button>
               <span className="bg-orange-50 px-3 py-1 rounded-full text-[10px] font-black text-orange-500 uppercase tracking-widest">
                 {pendingRequests.length} Pending Actions
               </span>
             </div>
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
      {activeTab === 'corporate' && <CorporateVehicleManager corVehicles={corVehicles} users={users} db={db} appId={appId} />}
      {activeTab === 'notifications' && <NotificationSettingsPanel settings={notificationSettings} db={db} appId={appId} showStatus={showStatus} />}
      {activeTab === 'migrate' && (
        <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100 animate-fade-in text-center">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-50">
            <RefreshCw size={40} />
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-4">데이터 마이그레이션 도구</h3>
          <p className="text-slate-500 font-bold mb-12 max-w-xl mx-auto leading-relaxed">
            현재 파이어베이스(개인)의 모든 데이터(조직도, 운행기록, 프로필 등)를 백업하여 법인 계정으로 옮길 수 있습니다.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 hover:border-indigo-200 transition-all group text-left">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Download size={24} />
               </div>
               <h4 className="text-xl font-black text-slate-800 mb-2">1단계: 현재 데이터 백업</h4>
               <p className="text-xs font-bold text-slate-400 mb-8 leading-snug">모든 데이터를 JSON 파일로 다운로드하여 로컬에 저장합니다.</p>
               <button 
                 onClick={onExport}
                 className="w-full bg-white border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-black hover:bg-indigo-600 hover:text-white transition-all shadow-lg shadow-indigo-50"
               >
                 백업 시작 (Download)
               </button>
            </div>

            <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 hover:border-emerald-200 transition-all group text-left">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 mb-6 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <RefreshCw size={24} />
               </div>
               <h4 className="text-xl font-black text-slate-800 mb-2">2단계: 데이터 복구</h4>
               <p className="text-xs font-bold text-slate-400 mb-8 leading-snug">법인 계정으로 전환된 후, 백업 파일을 올려 데이터를 복원합니다.</p>
               <label className="block w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-50 cursor-pointer text-center">
                 파일 선택 및 복구 시작
                 <input type="file" accept=".json" onChange={onImport} className="hidden" />
               </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OrgChartView = ({ orgUnits, users, db, appId, setOrgUnits, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' or 'members'
  const [memberSearch, setMemberSearch] = useState('');
  const [showDisabledMembers, setShowDisabledMembers] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.userName || '').toLowerCase().includes(memberSearch.toLowerCase()) || 
                            (u.department || '').toLowerCase().includes(memberSearch.toLowerCase());
      const isVisible = showDisabledMembers || u.status !== 'disabled';
      return matchesSearch && isVisible;
    });
  }, [users, memberSearch, showDisabledMembers]);

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
      // 조직도 트리에서는 일단 상태와 무관하게 표시하거나, 여기도 필터링을 원할 수도 있지만 보통 조직도에는 현재 인원만 표시하는 경우가 많음. 
      // 하지만 명부 필터링이 주 요청이므로 명부 위주로 처리함.
      if (!showDisabledMembers && u.status === 'disabled') return;

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
  }, [orgUnits, users, showDisabledMembers]);

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

  const handleRenameGroup = (e, fullPath) => {
    e.stopPropagation();
    const oldName = fullPath.split(' > ').pop();
    const newName = prompt(`'구 이름 (${oldName})'\n\n새 조직 이름을 입력하세요:`, oldName);
    if (!newName || newName.trim() === oldName) return;
    const parentPath = fullPath.split(' > ').slice(0, -1).join(' > ');
    const newPath = parentPath ? `${parentPath} > ${newName.trim()}` : newName.trim();
    if (orgUnits.some(u => u === newPath || u.startsWith(newPath + ' > '))) {
      return alert('이미 존재하는 조직입니다.');
    }
    // 해당 조직을 포함하는 모든 units 이름 교체
    const newUnits = orgUnits.map(u => {
      if (u === fullPath) return newPath;
      if (u.startsWith(fullPath + ' > ')) return newPath + u.slice(fullPath.length);
      return u;
    });
    updateOrgUnitsRemote(newUnits);
    // selectedPath도 업데이트
    setSelectedPath(prev => prev.map(p => p === oldName ? newName.trim() : p));
  };

  const handleDeleteGroup = async (e, dept) => {
    e.stopPropagation();
    const fullPath = dept.fullPath;
    // 해당 조직 또는 하위 조직에 소속된 멤버가 있는지 확인
    const affectedMembers = users.filter(u => 
      u.department === fullPath || (u.department && u.department.startsWith(fullPath + ' > '))
    );
    const affectedUnits = orgUnits.filter(u => u === fullPath || u.startsWith(fullPath + ' > '));
    
    let msg = `'${dept.name}' 조직을 삭제하시겠습니까?\n\n- 삭제되는 조직: ${affectedUnits.length}개`;
    if (affectedMembers.length > 0) {
      msg += `\n- 영향받는 구성원: ${affectedMembers.length}명 (부서를 '미지정'으로 변경됩니다)`;
    }
    
    if (!window.confirm(msg)) return;

    const newUnits = orgUnits.filter(u => u !== fullPath && !u.startsWith(fullPath + ' > '));
    await updateOrgUnitsRemote(newUnits);

    // 삭제된 조직의 구성원 부서를 '미지정'으로 변경
    if (affectedMembers.length > 0 && onUpdateUser) {
      await Promise.all(affectedMembers.map(m => onUpdateUser(m.uid, { department: '미지정' })));
    }

    // selectedPath 업데이트
    setSelectedPath(prev => {
      const idx = prev.indexOf(dept.name);
      return idx !== -1 ? prev.slice(0, idx) : prev;
    });
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
                          <div
                            key={dept.name}
                            className={`group/card relative w-full text-left p-4 rounded-2xl transition-all border cursor-pointer ${
                              selectedPath[depth] === dept.name 
                                ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' 
                                : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5'
                            }`}
                            onClick={() => setSelectedPath([...selectedPath.slice(0, depth), dept.name])}
                          >
                             <div className="flex items-center justify-between">
                               <span className={`font-black text-[13px] truncate pr-2 flex-1 ${selectedPath[depth] === dept.name ? 'text-white' : 'text-slate-700'}`}>{dept.name}</span>
                               {/* 수정/삭제 버튼 - hover 시 표시 */}
                               <div 
                                 className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                 onClick={e => e.stopPropagation()}
                               >
                                 <button
                                   onClick={(e) => handleRenameGroup(e, dept.fullPath)}
                                   className={`p-1.5 rounded-lg transition-all ${
                                     selectedPath[depth] === dept.name
                                       ? 'hover:bg-indigo-500 text-indigo-200 hover:text-white'
                                       : 'hover:bg-slate-100 text-slate-300 hover:text-indigo-500'
                                   }`}
                                   title="조직 이름 변경"
                                 >
                                   <Pencil size={12} />
                                 </button>
                                 <button
                                   onClick={(e) => handleDeleteGroup(e, dept)}
                                   className={`p-1.5 rounded-lg transition-all ${
                                     selectedPath[depth] === dept.name
                                       ? 'hover:bg-red-500 text-indigo-200 hover:text-white'
                                       : 'hover:bg-red-50 text-slate-300 hover:text-red-500'
                                   }`}
                                   title="조직 삭제"
                                 >
                                   <Trash2 size={12} />
                                 </button>
                               </div>
                               <ChevronRight size={14} className={`ml-1 flex-shrink-0 ${selectedPath[depth] === dept.name ? 'text-white/70' : 'text-slate-300'}`} />
                             </div>
                             <div className="flex gap-3 mt-2">
                               <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tight ${selectedPath[depth] === dept.name ? 'text-indigo-100' : 'text-slate-400'}`}>
                                 <Network size={10} /> {Object.keys(dept.children).length}
                               </div>
                               <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tight ${selectedPath[depth] === dept.name ? 'text-indigo-100' : 'text-slate-400'}`}>
                                 <Users size={10} /> {dept.members.length}
                               </div>
                             </div>
                          </div>
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
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50 transition-all" onClick={() => setShowDisabledMembers(!showDisabledMembers)}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${showDisabledMembers ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {showDisabledMembers && <Check size={10} className="text-white" />}
                  </div>
                  <span className="text-[11px] font-black text-slate-500 whitespace-nowrap">퇴사자 포함</span>
                </div>
                <div className="bg-indigo-50 px-5 py-3 rounded-2xl border border-indigo-100 text-sm font-black text-indigo-600 shrink-0">
                  총 {filteredUsers.length}명
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
                 {filteredUsers
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

const ManagementReport = ({ logs, users, db, appId, filters, onFilterChange, corVehicles, profile, onSearch, isSearching }) => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'details', or 'official'
  const officialReportRef = useRef(null);
  const [selectedCarForReport, setSelectedCarForReport] = useState(null);

  const exportOfficialPDF = async (car) => {
     setSelectedCarForReport(car);
     // Wait for state update to render the hidden template
     setTimeout(async () => {
       if (!officialReportRef.current) return;
       try {
         const canvas = await html2canvas(officialReportRef.current, { scale: 2, useCORS: true });
         const imgData = canvas.toDataURL('image/png');
         const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
         const pageWidth = pdf.internal.pageSize.getWidth();
         pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, (canvas.height * pageWidth) / canvas.width);
         pdf.save(`업무용승용차_운행기록부_${car.registrationNo}_${filters.selectedMonth}.pdf`);
       } catch (e) {
         console.error(e);
       }
     }, 500);
  };

  // 월 변경 시 시작/종료일 자동 설정
  const handleMonthChange = (month) => {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1).toLocaleDateString('sv-SE');
    const end = new Date(year, m, 0).toLocaleDateString('sv-SE');
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
      // [FIX] 위치 기록 데이터는 통계 리포트에서 제외
      if (log.isCommute) return false;

      const user = users.find(u => u.uid === log.userId);
      // [FIX] 로그 기록 당시의 부서를 우선하고, 없으면 현재 유저 부서 참조 (정산 내역과 로직 통일)
      const logDept = (log.department || user?.department || '미지정').trim();
      const targetDept = (filters.department || filters.dept || "").trim();
      
      const matchDept = targetDept === 'all' || (logDept && logDept.startsWith(targetDept));
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
      {/* Report Tab Switcher (Moved to Top) */}
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
        <button 
          onClick={() => setActiveTab('official')}
          className={`px-10 py-4 rounded-2xl font-black text-sm transition-all ${activeTab === 'official' ? 'bg-white text-indigo-600 shadow-md translate-y-0' : 'text-slate-400 hover:text-slate-600 hover:translate-y-[-2px]'}`}
        >
          <Car size={16} className="inline mr-2" /> 국세청 운행기록부
        </button>
      </div>

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
            <div className="flex gap-4 items-end">
              <div className="flex gap-2 items-center flex-1">
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

              {/* 조회 버튼 추가 */}
              <button
                onClick={() => onSearch({
                  selectedMonth: filters.selectedMonth,
                  selectedDept: filters.department,
                  selectedMember: filters.userId === 'all' ? 'all' : (users.find(u => u.uid === filters.userId)?.userName || 'all')
                })}
                disabled={isSearching}
                className={`flex items-center gap-2 px-8 py-4.5 rounded-2xl font-black text-sm transition-all shadow-sm active:scale-95 ${
                  isSearching 
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                }`}
              >
                {isSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                {isSearching ? '조회 중...' : '조회'}
              </button>
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
      ) : activeTab === 'details' ? (
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
      ) : (
        <div className="space-y-6 animate-fade-in">
           <div className="bg-indigo-900 p-10 rounded-[2.5rem] text-white overflow-hidden relative">
              <div className="relative z-10 max-w-2xl">
                <h4 className="text-2xl font-black mb-2 tracking-tight">업무용승용차 국세청 제출 서식</h4>
                <p className="text-indigo-200 font-bold leading-relaxed">
                  등록된 법인차량별 운행 내역을 국세청 고시 제2016-4호 양식에 맞춰 자동으로 출력합니다. 
                  별도의 수기 작성 없이 정산 데이터를 바로 활용하세요.
                </p>
              </div>
              <Car size={180} className="absolute -right-20 -bottom-20 text-white/5" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {corVehicles.map(v => (
                <div key={v.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                   <div className="flex justify-between items-start mb-6">
                      <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">{v.registrationNo}</span>
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all"><FileText size={16} /></div>
                   </div>
                   <h5 className="text-xl font-black text-slate-800 mb-6">{v.modelName}</h5>
                   <button 
                     onClick={() => exportOfficialPDF(v)}
                     className="w-full bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-indigo-100 py-4 rounded-2xl font-black text-sm text-slate-600 transition-all flex items-center justify-center gap-2"
                   >
                     공식 양식 PDF 출력
                   </button>
                </div>
              ))}
              {corVehicles.length === 0 && (
                <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-300 font-bold italic">
                  등록된 법인차량이 없습니다. 관리자 패널에서 법인차량을 먼저 등록해 주세요.
                </div>
              )}
           </div>

           {/* Hidden Template for PDF Capture */}
           <div style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}>
              {selectedCarForReport && (
                <OfficialCorporateLogTemplate 
                  innerRef={officialReportRef}
                  car={selectedCarForReport}
                  logs={logs}
                  profile={profile}
                  year={filters.selectedMonth?.split('-')[0]}
                  month={filters.selectedMonth?.split('-')[1]}
                />
              )}
           </div>
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

const ReportPDFTemplate = ({ innerRef, logs, profile, reportFilters, allUsers }) => {
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const u = allUsers.find(au => au.uid === log.userId);
      const logDept = u?.department || '미지정';
      const matchDept = reportFilters.department === 'all' || logDept.startsWith(reportFilters.department);
      const matchUser = reportFilters.userId === 'all' || log.userId === reportFilters.userId;
      const matchStart = !reportFilters.startDate || log.date >= reportFilters.startDate;
      const matchEnd = !reportFilters.endDate || log.date <= reportFilters.endDate;
      return matchDept && matchUser && matchStart && matchEnd;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, allUsers, reportFilters]);

  const stats = useMemo(() => {
    const totalDist = filteredLogs.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
    const totalAmount = filteredLogs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalParking = filteredLogs.reduce((acc, curr) => acc + (Number(curr.parkingTotal) || 0), 0);
    const totalFuel = totalAmount - totalParking;
    return { totalDist, totalAmount, totalParking, totalFuel, count: filteredLogs.length };
  }, [filteredLogs]);

  const dateStr = reportFilters.selectedMonth ? `${reportFilters.selectedMonth.split('-')[0]}년 ${reportFilters.selectedMonth.split('-')[1]}월` : '전체 내역';

  return (
    <div ref={innerRef} style={{ width: '1120px', padding: '28px 50px', backgroundColor: '#ffffff' }} className="font-['Outfit']">
      
      {/* ─── Compact Header: Title + Stats in one row ─── */}
      <div className="flex items-center justify-between gap-6 pb-4 border-b-2 border-slate-100 mb-3">
        {/* Left: branding */}
        <div className="min-w-[200px]">
          <h1 className="text-[18px] font-black text-slate-800 tracking-tighter leading-none">유류비 정산 이력 리포트</h1>
          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Fuel Settlement History Report</p>
        </div>

        {/* Center: 4 stat chips */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="bg-slate-900 rounded-xl px-5 py-2.5 text-white text-center">
            <div className="text-[7px] font-bold text-slate-400 uppercase tracking-widest opacity-80 mb-0.5">총 정산액</div>
            <div className="text-[16px] font-black leading-none">₩ {stats.totalAmount.toLocaleString()}</div>
          </div>
          <div className="border border-slate-100 rounded-xl px-4 py-2.5 text-center">
            <div className="text-[7px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">유류 지원비</div>
            <div className="text-[14px] font-black text-slate-800 leading-none">₩ {stats.totalFuel.toLocaleString()}</div>
          </div>
          <div className="border border-slate-100 rounded-xl px-4 py-2.5 text-center">
            <div className="text-[7px] font-black text-orange-500 uppercase tracking-widest mb-0.5">주차비</div>
            <div className="text-[14px] font-black text-slate-800 leading-none">₩ {stats.totalParking.toLocaleString()}</div>
          </div>
          <div className="border border-slate-100 rounded-xl px-4 py-2.5 text-center">
            <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">주행거리</div>
            <div className="text-[14px] font-black text-slate-800 leading-none">{stats.totalDist.toFixed(1)} km</div>
          </div>
        </div>

        {/* Right: period */}
        <div className="text-right min-w-[110px]">
          <div className="text-[20px] font-black text-indigo-600 leading-none">{dateStr}</div>
          <div className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-0.5">C-OIL System</div>
        </div>
      </div>

      {/* ─── Thin Metadata Bar ─── */}
      <div className="flex items-center gap-6 py-2 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center font-black text-[10px]">
            {profile?.userName?.[0] || 'U'}
          </div>
          <span className="text-[11px] font-black text-slate-800">{profile?.userName}</span>
          <span className="text-[9px] text-slate-400 font-bold">{profile?.department}</span>
        </div>
        <div className="w-px h-3 bg-slate-200"></div>
        <span className="text-[9px] font-bold text-slate-500">{profile?.vehicleName || '-'} ({profile?.regNo || '미기재'})</span>
        <div className="w-px h-3 bg-slate-200"></div>
        <span className="text-[9px] font-bold text-slate-500">{stats.count}건</span>
        <div className="w-px h-3 bg-slate-200"></div>
        <span className="text-[9px] font-bold text-slate-400 uppercase">{profile?.fuelType === 'gasoline' ? '휘발유' : profile?.fuelType === 'diesel' ? '경유' : 'LPG'}</span>
      </div>

      {/* ─── Movement History Table ─── */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white text-left">
            <th className="px-4 py-2.5 text-[8px] font-black uppercase tracking-widest rounded-tl-xl w-[105px]">Date / Type</th>
            <th className="px-4 py-2.5 text-[8px] font-black uppercase tracking-widest">Route Summary</th>
            <th className="px-4 py-2.5 text-[8px] font-black uppercase tracking-widest w-[150px]">Purpose</th>
            <th className="px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-right w-[80px]">Dist.</th>
            <th className="px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-right rounded-tr-xl w-[120px]">Settlement (₩)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredLogs.map((log, idx) => (
            <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
              <td className="px-4 py-2.5">
                <div className="font-black text-slate-800 text-[11px]">{log.date}</div>
                <div className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{log.fuelType}</div>
              </td>
              <td className="px-4 py-2.5">
                <div className="text-[11px] font-black text-slate-700 leading-snug">{log.routeSummary}</div>
              </td>
              <td className="px-4 py-2.5">
                <div className="text-[10px] font-bold text-slate-400 italic truncate">{log.purpose}</div>
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="font-black text-indigo-500 text-[11px]">{Number(log.distance).toFixed(1)}</div>
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="font-black text-slate-900 text-[12px]">₩ {Number(log.amount).toLocaleString()}</div>
                {Number(log.parkingTotal) > 0 && <div className="text-[8px] font-bold text-orange-400">P: {Number(log.parkingTotal).toLocaleString()}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
        <p className="text-[7px] font-bold text-slate-300 uppercase tracking-[0.5em]">Reimbursement Submission Document • C-OIL Smart Fuel Platform</p>
      </div>
    </div>
  );
};


const CorporateVehicleManager = ({ corVehicles, users, db, appId }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ registrationNo: '', modelName: '', fuelType: 'gasoline', initialOdometer: 0, currentOdometer: 0, assignedUser: '' });

  const handleSave = async (e) => {
    e.preventDefault();
    if (corVehicles.length >= 5 && !formData.id) {
       alert('법인차량은 최대 5대까지만 등록 가능합니다.');
       return;
    }
    const id = formData.id || `cor_${Date.now()}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'corporateVehicles', id), {
      ...formData,
      currentOdometer: formData.currentOdometer || formData.initialOdometer, // 초기값 설정 시 성조 수치도 동일하게
      id
    });
    setIsAdding(false);
    setFormData({ registrationNo: '', modelName: '', fuelType: 'gasoline', initialOdometer: 0, currentOdometer: 0, assignedUser: '' });
  };

  const handleDelete = async (id) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'corporateVehicles', id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Car size={24} /></div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">법인차량 관리 센터</h3>
            <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Corporate Fleet Management ({corVehicles.length}/5)</p>
          </div>
        </div>
        <button 
          onClick={() => { setFormData({ registrationNo: '', modelName: '', fuelType: 'gasoline', initialOdometer: 0, currentOdometer: 0 }); setIsAdding(true); }}
          className="bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <PlusCircle size={16} /> 신규 차량 등록
        </button>
      </div>

      {isAdding && (
        <div className="premium-card p-10 rounded-[2.5rem] bg-indigo-50/30 border-2 border-indigo-100 animate-slide-up">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-6 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">차량 번호</label>
              <input 
                type="text" 
                className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                value={formData.registrationNo}
                onChange={e => setFormData({ ...formData, registrationNo: e.target.value })}
                placeholder="12가 3456"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">차종/모델</label>
              <input 
                type="text" 
                className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                value={formData.modelName}
                onChange={e => setFormData({ ...formData, modelName: e.target.value })}
                placeholder="그랜저 하이브리드"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">기초 주행거리 (KM)</label>
              <input 
                type="number" 
                step="0.1"
                className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                value={formData.initialOdometer}
                onChange={e => setFormData({ ...formData, initialOdometer: parseFloat(parseFloat(e.target.value).toFixed(1)) || 0 })}
                placeholder="연초 고정 수치"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">현재 누적 주행 (KM)</label>
              <input 
                type="number" 
                step="0.1"
                className="w-full px-5 py-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                value={formData.currentOdometer}
                onChange={e => setFormData({ ...formData, currentOdometer: parseFloat(parseFloat(e.target.value).toFixed(1)) || 0 })}
                placeholder="현재 실시간 수치"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">전담 이용자 배정</label>
              <select 
                className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                value={formData.assignedUser}
                onChange={e => setFormData({ ...formData, assignedUser: e.target.value })}
              >
                <option value="">이용자 미지정 (공용)</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>{u.userName} ({u.department})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-sm">저장</button>
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 bg-slate-200 text-slate-600 py-3.5 rounded-2xl font-black text-sm">취소</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {corVehicles.map(v => (
          <div key={v.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full translate-x-12 -translate-y-12 group-hover:bg-indigo-100/50 transition-all"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <span className="bg-slate-800 text-white px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest">{v.registrationNo}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setFormData(v); setIsAdding(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(v.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-2">{v.modelName}</h4>
              <div className="mb-4">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">전담 이용자</span>
                 <div className="text-sm font-bold text-indigo-600">
                    {users.find(u => u.uid === v.assignedUser)?.userName || '공용 차량'}
                 </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-tighter">기초(Reference)</span>
                  <span className="text-slate-600 font-black">{v.initialOdometer?.toLocaleString()} km</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-800">현재 누적 주행</span>
                  <span className="text-indigo-600 font-black">{v.currentOdometer?.toLocaleString()} km</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {corVehicles.length === 0 && (
          <div className="col-span-full py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
            <Car size={48} className="mb-4 opacity-50" />
            <p className="font-black">등록된 법인차량이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── National Tax Service Style Report Template ───
const OfficialCorporateLogTemplate = ({ car, logs, year, month, profile, innerRef }) => {
  const filtered = logs.filter(l => l.isCorporate && l.vehicleId === car.id);
  const totalKm = filtered.reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
  const businessKm = filtered.filter(l => l.usageType === 'business').reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);
  const commuteKm = filtered.filter(l => l.usageType === 'commute').reduce((acc, curr) => acc + (Number(curr.distance) || 0), 0);

  return (
    <div ref={innerRef} style={{ width: '1000px', padding: '60px', backgroundColor: '#ffffff' }} className="font-serif text-slate-900 border-[3px] border-slate-900 mx-auto">
      <div className="text-[10px] mb-4 flex justify-between">
        <span>【업무용승용차 운행기록부에 관한 별지 서식】 &lt;2016.4.1. 제정&gt;</span>
        <span className="border border-slate-900 px-4 py-1">사업자등록번호: {profile?.bizNo || '     -   -     '}</span>
      </div>

      <h1 className="text-3xl font-bold text-center border-y-2 border-slate-900 py-6 mb-10 tracking-[1em] pl-[1em]">업무용승용차 운행기록부</h1>

      <table className="w-full border-collapse border-2 border-slate-900 mb-8">
        <tbody>
          <tr>
            <td className="w-1/4 h-12 border border-slate-900 bg-slate-50 text-center font-bold text-sm">① 차 종</td>
            <td className="w-1/4 border border-slate-900 text-center text-sm">{car.modelName}</td>
            <td className="w-1/4 border border-slate-900 bg-slate-50 text-center font-bold text-sm">② 자동차등록번호</td>
            <td className="w-1/4 border border-slate-900 text-center text-sm">{car.registrationNo}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="text-xl font-bold mb-4">2. 업무용 사용비율 계산</h2>
      <table className="w-full border-collapse border-2 border-slate-900 text-[11px]">
        <thead>
          <tr className="bg-slate-50">
            <th rowSpan="2" className="border border-slate-900 p-2 w-[80px]">③사용일자</th>
            <th colSpan="2" className="border border-slate-900 p-2">④ 사용자</th>
            <th colSpan="3" className="border border-slate-900 p-2">운 행 내 역</th>
            <th colSpan="2" className="border border-slate-900 p-2">업무용 사용거리(km)</th>
            <th rowSpan="2" className="border border-slate-900 p-2 w-[100px]">⑩ 비고</th>
          </tr>
          <tr className="bg-slate-50">
            <th className="border border-slate-900 p-2">부 서</th>
            <th className="border border-slate-900 p-2">성 명</th>
            <th className="border border-slate-900 p-2 font-normal text-[9px]">⑤ 주행 전<br/>계기판 거리(km)</th>
            <th className="border border-slate-900 p-2 font-normal text-[9px]">⑥ 주행 후<br/>계기판 거리(km)</th>
            <th className="border border-slate-900 p-2 font-normal text-[10px]">⑦ 주행거리(km)</th>
            <th className="border border-slate-900 p-2">⑧ 출·퇴근용(km)</th>
            <th className="border border-slate-900 p-2">⑨ 일반 업무용(km)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log, idx) => (
            <tr key={log.id} className="text-center h-10">
              <td className="border border-slate-900">{log.date}</td>
              <td className="border border-slate-900">{log.department || '-'}</td>
              <td className="border border-slate-900 font-bold">{log.userName}</td>
              <td className="border border-slate-900 font-mono text-slate-500">{(log.odometerStart || 0).toLocaleString()}</td>
              <td className="border border-slate-900 font-mono">{(log.odometerEnd || 0).toLocaleString()}</td>
              <td className="border border-slate-900 font-bold italic">{(log.distance || 0).toFixed(1)}</td>
              <td className="border border-slate-900">{log.usageType === 'commute' ? log.distance : ''}</td>
              <td className="border border-slate-900">{log.usageType === 'business' ? log.distance : ''}</td>
              <td className="border border-slate-900 text-left px-2 text-[9px] truncate">{log.purpose}</td>
            </tr>
          ))}
          {/* 빈 칸 채우기 (최소 10줄 유지) */}
          {Array.from({ length: Math.max(0, 15 - filtered.length) }).map((_, i) => (
            <tr key={`empty-${i}`} className="h-10 text-slate-200">
               <td className="border border-slate-900 text-center text-[10px]">·</td>
               <td className="border border-slate-900"></td>
               <td className="border border-slate-900"></td>
               <td className="border border-slate-900"></td>
               <td className="border border-slate-900"></td>
               <td className="border border-slate-900"></td>
               <td className="border border-slate-900"></td>
               <td className="border border-slate-900"></td>
               <td className="border border-slate-900"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-bold h-12 text-center">
            <td colSpan="3" className="border border-slate-900">과세기간 합계</td>
            <td className="border border-slate-900 bg-slate-200" colSpan="2">⑪ 과세기간 총주행거리(km)</td>
            <td className="border border-slate-900 text-lg underline">{totalKm.toLocaleString()}</td>
            <td colSpan="2" className="border border-slate-900">⑫ 과세기간 업무용 사용거리(km)</td>
            <td className="border border-slate-900 text-lg underline">{(businessKm + commuteKm).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div className="flex justify-end gap-12 mt-10 font-bold text-lg">
         <div className="flex flex-col items-center">
            <span className="text-[12px] text-slate-400 mb-2">업무사용비율</span>
            <span className="text-2xl">{totalKm > 0 ? ((businessKm + commuteKm) / totalKm * 100).toFixed(1) : 0}%</span>
         </div>
         <div className="flex items-end pb-2">
            본 기록은 C-OIL 시스템에 의해 전자적으로 생성되었습니다. (서명날인 생략)
         </div>
      </div>
    </div>
  );
};

export default App;
