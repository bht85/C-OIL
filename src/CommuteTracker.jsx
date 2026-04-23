import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { MapPin, Navigation, StopCircle, PlayCircle, Clock, Map as MapIcon, X, ChevronRight } from 'lucide-react';

// Haversine 공식을 사용한 거리 계산 (km 반환)
const calculateDistance = (path) => {
  if (!path || path.length < 2) return 0;
  
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  
  let totalKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i+1];
    
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lng - p1.lng);
    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    totalKm += R * c;
  }
  return totalKm;
};

const CommuteTracker = ({ db, appId, profile }) => {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [map, setMap] = useState(null);
  const [polyline, setPolyline] = useState(null);

  const [status, setStatus] = useState('idle'); // idle, commute, move, off
  const [path, setPath] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [showMap, setShowMap] = useState(false);

  const closeMap = () => {
    setShowMap(false);
    setMap(null);
    setPolyline(null);
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
  };

  // 날짜 기반 문서 ID (예: 2026-04-23)
  const getTodayDocId = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Firestore에서 오늘자 경로 불러오기
  useEffect(() => {
    if (!profile?.email) return;

    const fetchTodayPath = async () => {
      const docRef = doc(db, 'artifacts', appId, 'commutes', `${profile.email}_${getTodayDocId()}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPath(data.path || []);
        if (data.status) setStatus(data.status);
      }
    };

    fetchTodayPath();
  }, [db, appId, profile?.email]);

  // 지도 렌더링 (showMap이 true일 때만)
  useEffect(() => {
    if (showMap && mapRef.current && !map && window.kakao && window.kakao.maps) {
      const options = {
        center: new window.kakao.maps.LatLng(37.566826, 126.9786567),
        level: 3,
      };
      const newMap = new window.kakao.maps.Map(mapRef.current, options);
      setMap(newMap);

      const newPolyline = new window.kakao.maps.Polyline({
        map: newMap,
        path: [],
        strokeWeight: 4,
        strokeColor: '#4f46e5',
        strokeOpacity: 0.8,
        strokeStyle: 'dashed',
      });
      setPolyline(newPolyline);
      
      // 모달 애니메이션(예: slide-up) 완료 후 지도의 올바른 크기 계산을 위해 relayout 호출
      setTimeout(() => {
        newMap.relayout();
      }, 100);
    }
  }, [showMap, mapRef, map]);

  // 지도에 경로 및 마커 업데이트
  useEffect(() => {
    if (map && polyline && path.length > 0) {
      const linePath = path.map(p => new window.kakao.maps.LatLng(p.lat, p.lng));
      polyline.setPath(linePath);
      
      // 기존 마커/오버레이 초기화
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      
      let moveCount = 1;
      
      path.forEach((p, idx) => {
        const position = new window.kakao.maps.LatLng(p.lat, p.lng);
        let labelText = getStatusLabel(p.status);
        if (p.status === 'move') {
          labelText = `${labelText} ${moveCount}`;
          moveCount++;
        }

        const content = document.createElement('div');
        content.className = `px-2.5 py-1.5 bg-white border-2 rounded-full text-xs font-black shadow-md whitespace-nowrap -translate-y-4 ${
          p.status === 'commute' ? 'border-indigo-500 text-indigo-600' :
          p.status === 'off' ? 'border-slate-800 text-slate-800' :
          'border-amber-500 text-amber-600'
        }`;
        content.innerHTML = `
          <div class="flex items-center gap-1.5">
            <div class="w-2 h-2 rounded-full ${
              p.status === 'commute' ? 'bg-indigo-500' :
              p.status === 'off' ? 'bg-slate-800' :
              'bg-amber-500'
            }"></div>
            ${labelText}
          </div>
        `;
        
        const overlay = new window.kakao.maps.CustomOverlay({
          position: position,
          content: content,
          yAnchor: 1,
          xAnchor: 0.5,
          zIndex: idx // 나중에 찍힌 핀이 위에 오도록
        });
        
        overlay.setMap(map);
        markersRef.current.push(overlay);
      });
      
      // 경로가 여러 개면 바운더리 조정, 아니면 센터 이동
      if (linePath.length > 1) {
        const bounds = new window.kakao.maps.LatLngBounds();
        linePath.forEach(p => bounds.extend(p));
        // 패딩을 위해 약간 지연 후 bound 적용
        setTimeout(() => map.setBounds(bounds, 50, 50, 50, 50), 50);
      } else {
        map.setCenter(linePath[0]);
      }
    }
  }, [map, polyline, path]);

  // 상태 변경 및 위치 저장 함수
  const saveLocation = async (lat, lng, currentStatus) => {
    if (!profile?.email) return;

    const newPoint = { lat, lng, timestamp: Date.now(), status: currentStatus };
    const docRef = doc(db, 'artifacts', appId, 'commutes', `${profile.email}_${getTodayDocId()}`);
    
    setPath(prev => [...prev, newPoint]);

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, {
          path: arrayUnion(newPoint),
          status: currentStatus,
          lastUpdated: Date.now()
        });
      } else {
        await setDoc(docRef, {
          email: profile.email,
          userName: profile.userName,
          date: getTodayDocId(),
          path: [newPoint],
          status: currentStatus,
          createdAt: Date.now(),
          lastUpdated: Date.now()
        });
      }
    } catch (error) {
      console.error("Error saving location:", error);
    }
  };

  // 위치 기록 (수동)
  const recordPoint = (newStatus) => {
    if (!navigator.geolocation) {
      setErrorMsg("GPS를 지원하지 않는 기기입니다.");
      return;
    }

    const prevStatus = status;
    setStatus(newStatus);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveLocation(pos.coords.latitude, pos.coords.longitude, newStatus);
      },
      (err) => {
        console.error("Geolocation Error:", err);
        let errorText = "위치 정보를 가져올 수 없습니다. GPS 설정과 권한을 확인해주세요.";
        
        if (err.code === 1) {
          errorText = "위치 정보 접근 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.";
          setStatus(prevStatus); // 상태 원상복구
          setErrorMsg(errorText);
        } else {
          // PC/Mac 테스트 환경에서 위치를 잡지 못하거나 타임아웃 발생 시 임시(Mock) 데이터로 진행
          console.warn("Using mock location for testing due to geolocation error:", err.message);
          saveLocation(37.54767, 127.05407, newStatus);
        }
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 5000 }
    );
  };

  const totalKm = calculateDistance(path);

  const getStatusLabel = (s) => {
    switch (s) {
      case 'commute': return '출근';
      case 'move': return '이동';
      case 'off': return '퇴근';
      default: return '기록';
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'commute': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      case 'move': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'off': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 max-w-4xl mx-auto animate-fade-in mb-20">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Navigation className="text-indigo-600" size={28} />
            일일 동선 체크인
            <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full ml-2">
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </h2>
          <p className="text-sm font-bold text-slate-400 mt-2">
            출근, 이동, 퇴근 시점에 버튼을 눌러 시간과 위치를 기록합니다.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-8 p-4 bg-red-50/80 backdrop-blur text-red-600 rounded-2xl text-sm font-bold border border-red-100 flex items-center gap-3 animate-slide-up shadow-sm">
          <StopCircle size={20} className="shrink-0" />
          <span className="leading-snug">{errorMsg}</span>
        </div>
      )}

      {/* 프리미엄 액션 버튼 패널 */}
      <div className="relative bg-slate-50/50 p-2 sm:p-3 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100/80 shadow-inner mb-10">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <button
            onClick={() => recordPoint('commute')}
            disabled={status === 'commute' || status === 'off'}
            className={`group relative flex flex-col items-center justify-center py-6 sm:py-8 px-2 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-500 overflow-hidden ${
              status === 'commute' 
                ? 'bg-gradient-to-b from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-200' 
                : status === 'off'
                  ? 'bg-transparent text-slate-300 cursor-not-allowed opacity-50'
                  : 'bg-white text-slate-600 shadow-sm hover:shadow-md hover:border-indigo-100 active:scale-[0.97]'
            }`}
          >
            <div className={`mb-3 p-3 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1 ${status === 'commute' ? 'bg-white/20' : 'bg-slate-50'}`}>
              <PlayCircle size={26} className={status === 'commute' ? 'text-white' : 'text-indigo-500'} strokeWidth={2.5} />
            </div>
            <span className="font-black text-sm sm:text-base tracking-tight mb-0.5">출근</span>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${status === 'commute' ? 'text-indigo-200' : 'text-slate-400'}`}>Check-in</span>
            {status === 'commute' && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
          </button>

          <button
            onClick={() => recordPoint('move')}
            disabled={status === 'idle' || status === 'off'}
            className={`group relative flex flex-col items-center justify-center py-6 sm:py-8 px-2 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-500 overflow-hidden ${
              status === 'move' 
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-xl shadow-amber-200' 
                : status === 'idle' || status === 'off'
                  ? 'bg-transparent text-slate-300 cursor-not-allowed opacity-50'
                  : 'bg-white text-slate-600 shadow-sm hover:shadow-md hover:border-amber-100 active:scale-[0.97]'
            }`}
          >
            <div className={`mb-3 p-3 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1 ${status === 'move' ? 'bg-white/20' : 'bg-slate-50'}`}>
              <Clock size={26} className={status === 'move' ? 'text-white' : 'text-amber-500'} strokeWidth={2.5} />
            </div>
            <span className="font-black text-sm sm:text-base tracking-tight mb-0.5">이동</span>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${status === 'move' ? 'text-amber-100' : 'text-slate-400'}`}>Waypoint</span>
            {status === 'move' && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
          </button>

          <button
            onClick={() => recordPoint('off')}
            disabled={status === 'idle' || status === 'off'}
            className={`group relative flex flex-col items-center justify-center py-6 sm:py-8 px-2 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-500 overflow-hidden ${
              status === 'off' 
                ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-xl shadow-slate-300' 
                : status === 'idle'
                  ? 'bg-transparent text-slate-300 cursor-not-allowed opacity-50'
                  : 'bg-white text-slate-600 shadow-sm hover:shadow-md hover:border-slate-200 active:scale-[0.97]'
            }`}
          >
            <div className={`mb-3 p-3 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1 ${status === 'off' ? 'bg-white/10' : 'bg-slate-50'}`}>
              <StopCircle size={26} className={status === 'off' ? 'text-white' : 'text-slate-700'} strokeWidth={2.5} />
            </div>
            <span className="font-black text-sm sm:text-base tracking-tight mb-0.5">퇴근</span>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${status === 'off' ? 'text-slate-400' : 'text-slate-400'}`}>Check-out</span>
            {status === 'off' && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
          </button>
        </div>
      </div>
      
      {/* 타임라인 */}
      <div className="bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <h3 className="text-lg font-black text-slate-800">오늘의 타임라인</h3>
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">총 이동 거리</p>
              <p className="text-xl font-black text-indigo-600 leading-none">{totalKm.toFixed(2)} <span className="text-sm text-slate-500 font-bold">km</span></p>
            </div>
            <button 
              onClick={() => setShowMap(true)}
              disabled={path.length === 0}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all shrink-0 whitespace-nowrap ${
                path.length === 0 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-slate-900 text-white shadow-md hover:bg-black active:scale-95'
              }`}
            >
              <MapIcon size={18} />
              <span>지도 보기</span>
            </button>
          </div>
        </div>

        {path.length === 0 ? (
          <div className="text-center py-10 opacity-50">
            <Clock size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-sm font-bold text-slate-500">아직 기록된 일정이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {path.map((point, idx) => {
              const timeStr = new Date(point.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-indigo-100 text-indigo-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 relative">
                    <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                  </div>
                  
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className={`px-3 py-1.5 rounded-xl border font-black text-xs shrink-0 ${getStatusColor(point.status)}`}>
                      {getStatusLabel(point.status)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base font-black text-slate-800">{timeStr}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">
                        {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 지도 모달 */}
      {showMap && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeMap}></div>
          <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-slide-up h-[80vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white z-10">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <MapPin className="text-indigo-600" /> 오늘의 동선 지도
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1">총 {totalKm.toFixed(2)}km 이동 • 포인트 {path.length}개</p>
              </div>
              <button 
                onClick={closeMap}
                className="p-2 bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 relative">
              <div ref={mapRef} className="absolute inset-0"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommuteTracker;
