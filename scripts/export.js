
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyANXx1Wj4EGnwWsF8W2CrkC1pzojXXusA8",
  authDomain: "c-oil-b880b.firebaseapp.com",
  projectId: "c-oil-b880b",
  storageBucket: "c-oil-b880b.firebasestorage.app",
  messagingSenderId: "185616673355",
  appId: "1:185616673355:web:1b01544ed887d766cf3bce"
};

const appId = 'vehicle-fuel-tracker';
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportData() {
  console.log('🔄 데이터 추출 시작...');
  const data = {};

  const paths = {
    profiles: `artifacts/${appId}/public/data/profiles`,
    logs: `artifacts/${appId}/public/data/logs`,
    corporateVehicles: `artifacts/${appId}/public/data/corporateVehicles`,
    fuelRates: `artifacts/${appId}/public/data/fuelRates`,
  };

  // 컬렉션 데이터 추출
  for (const [key, path] of Object.entries(paths)) {
    console.log(`📑 ${key} 읽는 중...`);
    const querySnapshot = await getDocs(collection(db, path));
    data[key] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 단일 문서 데이터 추출 (조직도)
  console.log(`📑 orgUnits 읽는 중...`);
  const orgRef = doc(db, `artifacts/${appId}/public/data/settings/orgUnits`);
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    data.orgUnits = orgSnap.data();
  }

  fs.writeFileSync('scripts/backup_data.json', JSON.stringify(data, null, 2));
  console.log('✅ 백업 완료: scripts/backup_data.json');
}

exportData().catch(console.error);
