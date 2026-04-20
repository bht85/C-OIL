import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBElhvMeXAuUkyWf6r0volTumE2LRcxggQ",
  authDomain: "compose-oil.firebaseapp.com",
  projectId: "compose-oil",
  storageBucket: "compose-oil.firebasestorage.app",
  messagingSenderId: "319952705434",
  appId: "1:319952705434:web:63b7bc10aa96d2ad258c23"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const appId = 'vehicle-fuel-tracker';

async function updateDepartment() {
  console.log("부서명 일괄 변경 작업을 시작합니다: '인사팀' -> '인사총무팀'");
  const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
  const q = query(logsRef, where("department", "==", "인사팀"));
  
  const querySnapshot = await getDocs(q);
  console.log(`총 ${querySnapshot.size}건의 데이터를 찾았습니다.`);

  if (querySnapshot.empty) {
    console.log("업데이트할 데이터가 없습니다.");
    return;
  }

  const batch = writeBatch(db);
  querySnapshot.forEach((document) => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'logs', document.id);
    batch.update(docRef, { department: "인사총무팀" });
    console.log(`- 문서 ID: ${document.id} 업데이트 예약`);
  });

  await batch.commit();
  console.log("일괄 업데이트가 완료되었습니다!");
  process.exit(0);
}

updateDepartment().catch((err) => {
  console.error("오류 발생:", err);
  process.exit(1);
});
