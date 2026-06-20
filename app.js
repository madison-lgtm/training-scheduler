const DAYS = [
  { id: "mon", label: "周一" },
  { id: "tue", label: "周二" },
  { id: "wed", label: "周三" },
  { id: "thu", label: "周四" },
];

const SLOTS = [
  { id: "early", label: "18:00", detail: "第一节" },
  { id: "late", label: "19:15", detail: "第二节" },
];

const GOALS = ["上肢", "下肢", "全身力量", "功能性", "教练安排"];
const LOCATIONS = ["235 Grand", "Bisby"];
const STORAGE_KEY = "training-scheduler-mvp-v1";
const COACH_PIN = "2468";
const CAPACITY = 2;
const STUDENT_STEPS = ["身份", "课程", "地点", "时间", "提交"];

let state = loadState();
let selectedAvailability = new Set();
let currentStudentStep = 0;
let weeklyEditMode = false;
let dragged = null;
let currentIssue = null;
let cloudStore = null;
let cloudSaveTimer = null;
let applyingRemoteState = false;
let selectedMobileDay = getTodayDayId();
let selectedCoachPage = "schedule";

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  roleView: document.querySelector("#roleView"),
  studentView: document.querySelector("#studentView"),
  pinView: document.querySelector("#pinView"),
  coachView: document.querySelector("#coachView"),
  roleStudent: document.querySelector("#roleStudent"),
  roleCoach: document.querySelector("#roleCoach"),
  studentMode: document.querySelector("#studentMode"),
  coachEntry: document.querySelector("#coachEntry"),
  studentName: document.querySelector("#studentName"),
  studentCode: document.querySelector("#studentCode"),
  routineOne: document.querySelector("#routineOne"),
  routineTwo: document.querySelector("#routineTwo"),
  routineGoalOne: document.querySelector("#routineGoalOne"),
  routineGoalTwo: document.querySelector("#routineGoalTwo"),
  sessionCount: document.querySelector("#sessionCount"),
  sessionGoals: document.querySelector("#sessionGoals"),
  availabilityGrid: document.querySelector("#availabilityGrid"),
  studentNotes: document.querySelector("#studentNotes"),
  studentMessage: document.querySelector("#studentMessage"),
  studentStepTabs: document.querySelector("#studentStepTabs"),
  studentPrev: document.querySelector("#studentPrev"),
  studentNext: document.querySelector("#studentNext"),
  defaultSummary: document.querySelector("#defaultSummary"),
  useDefaultWeek: document.querySelector("#useDefaultWeek"),
  customizeWeek: document.querySelector("#customizeWeek"),
  submitRequest: document.querySelector("#submitRequest"),
  mySchedule: document.querySelector("#mySchedule"),
  coachPin: document.querySelector("#coachPin"),
  pinMessage: document.querySelector("#pinMessage"),
  unlockCoach: document.querySelector("#unlockCoach"),
  coachScheduleTab: document.querySelector("#coachScheduleTab"),
  coachWorkbenchTab: document.querySelector("#coachWorkbenchTab"),
  coachSchedulePage: document.querySelector("#coachSchedulePage"),
  coachWorkbenchPage: document.querySelector("#coachWorkbenchPage"),
  coachScheduleTitle: document.querySelector("#coachScheduleTitle"),
  coachScheduleOverview: document.querySelector("#coachScheduleOverview"),
  seedDemo: document.querySelector("#seedDemo"),
  generateDraft: document.querySelector("#generateDraft"),
  exportCalendar: document.querySelector("#exportCalendar"),
  publishSchedule: document.querySelector("#publishSchedule"),
  requestCount: document.querySelector("#requestCount"),
  mobileDayTabs: document.querySelector("#mobileDayTabs"),
  mobileCoachDay: document.querySelector("#mobileCoachDay"),
  mobileCoachIssues: document.querySelector("#mobileCoachIssues"),
  studentSummary: document.querySelector("#studentSummary"),
  locationRow: document.querySelector("#locationRow"),
  coachCalendar: document.querySelector("#coachCalendar"),
  unassignedPool: document.querySelector("#unassignedPool"),
  issueTitle: document.querySelector("#issueTitle"),
  issueText: document.querySelector("#issueText"),
  issueRecommendation: document.querySelector("#issueRecommendation"),
  applyRecommendation: document.querySelector("#applyRecommendation"),
};

init();

function init() {
  fillSelects();
  renderSessionGoals();
  renderAvailability();
  renderDefaultSummary();
  renderStudentSteps();
  renderMySchedule();
  bindEvents();
  initCloudStore();
}

function bindEvents() {
  els.roleStudent.addEventListener("click", () => showView("student"));
  els.roleCoach.addEventListener("click", () => showView("pin"));
  els.studentMode.addEventListener("click", () => showView("student"));
  els.coachEntry.addEventListener("click", () => showView("pin"));
  els.unlockCoach.addEventListener("click", unlockCoach);
  els.coachScheduleTab.addEventListener("click", () => setCoachPage("schedule"));
  els.coachWorkbenchTab.addEventListener("click", () => setCoachPage("workbench"));
  els.sessionCount.addEventListener("input", renderSessionGoals);
  els.studentPrev.addEventListener("click", () => setStudentStep(currentStudentStep - 1));
  els.studentNext.addEventListener("click", () => setStudentStep(currentStudentStep + 1));
  els.useDefaultWeek.addEventListener("click", submitDefaultWeek);
  els.customizeWeek.addEventListener("click", startWeeklyEdit);
  els.submitRequest.addEventListener("click", submitStudentRequest);
  els.studentName.addEventListener("input", () => {
    loadRoutineForName();
    renderDefaultSummary();
    renderMySchedule();
  });
  els.seedDemo.addEventListener("click", seedDemo);
  els.generateDraft.addEventListener("click", generateDraft);
  els.exportCalendar.addEventListener("click", exportCalendar);
  els.publishSchedule.addEventListener("click", publishSchedule);
  els.applyRecommendation.addEventListener("click", applyRecommendation);
}

function fillSelects() {
  const slotOptions = [`<option value="">不设置</option>`].concat(
    allSlotKeys().map((slotKey) => `<option value="${slotKey}">${formatSlot(slotKey)}</option>`),
  ).join("");
  els.routineOne.innerHTML = slotOptions;
  els.routineTwo.innerHTML = slotOptions;
  const goalOptions = GOALS.map((goal) => `<option value="${goal}">${goal}</option>`).join("");
  els.routineGoalOne.innerHTML = goalOptions;
  els.routineGoalTwo.innerHTML = goalOptions;
}

function showView(name) {
  [els.roleView, els.studentView, els.pinView, els.coachView].forEach((view) => view.classList.remove("active"));
  if (name === "role") els.roleView.classList.add("active");
  if (name === "student") els.studentView.classList.add("active");
  if (name === "pin") els.pinView.classList.add("active");
  if (name === "coach") {
    els.coachView.classList.add("active");
    renderCoach();
  }
}

function setCoachPage(page) {
  selectedCoachPage = page;
  els.coachScheduleTab.classList.toggle("active", page === "schedule");
  els.coachWorkbenchTab.classList.toggle("active", page === "workbench");
  els.coachSchedulePage.classList.toggle("active", page === "schedule");
  els.coachWorkbenchPage.classList.toggle("active", page === "workbench");
}

function renderStudentSteps() {
  if (!els.studentStepTabs) return;
  if (!weeklyEditMode) {
    els.studentStepTabs.style.display = "none";
    document.querySelectorAll(".student-step").forEach((step) => {
      step.classList.toggle("active", Number(step.dataset.step) === 0);
    });
    els.studentPrev.style.display = "none";
    els.studentNext.style.display = "none";
    els.submitRequest.style.display = "none";
    return;
  }
  els.studentStepTabs.style.display = "";
  els.studentStepTabs.innerHTML = STUDENT_STEPS.map((label, index) => `
    <button class="${index === currentStudentStep ? "active" : ""} ${index < currentStudentStep ? "done" : ""}" data-student-step="${index}">
      <span>${index + 1}</span>${label}
    </button>
  `).join("");
  els.studentStepTabs.querySelectorAll("[data-student-step]").forEach((button) => {
    button.addEventListener("click", () => setStudentStep(Number(button.dataset.studentStep)));
  });
  document.querySelectorAll(".student-step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === currentStudentStep);
  });
  els.studentPrev.style.display = currentStudentStep === 0 ? "none" : "";
  els.studentNext.style.display = currentStudentStep === STUDENT_STEPS.length - 1 ? "none" : "";
  els.submitRequest.style.display = currentStudentStep === STUDENT_STEPS.length - 1 ? "" : "none";
}

function setStudentStep(step) {
  if (step > currentStudentStep && !canLeaveStudentStep(currentStudentStep)) return;
  currentStudentStep = Math.max(0, Math.min(STUDENT_STEPS.length - 1, step));
  els.studentMessage.textContent = "";
  renderStudentSteps();
}

function startWeeklyEdit() {
  if (!els.studentName.value.trim()) {
    els.studentMessage.textContent = "先填名字或昵称。";
    return;
  }
  weeklyEditMode = true;
  setStudentStep(1);
}

function canLeaveStudentStep(step) {
  if (step === 0 && !els.studentName.value.trim()) {
    els.studentMessage.textContent = "先填名字或昵称。";
    return false;
  }
  if (step === 2 && !document.querySelectorAll('input[name="location"]:checked').length) {
    els.studentMessage.textContent = "至少选择一个地点偏好。";
    return false;
  }
  if (step === 3 && !selectedAvailability.size) {
    els.studentMessage.textContent = "至少选择一个可用时间。";
    return false;
  }
  return true;
}

async function initCloudStore() {
  const config = window.TRAINING_SCHEDULER_FIREBASE_CONFIG;
  if (!isCloudConfigured(config)) {
    setSyncStatus("本地演示模式", "local");
    return;
  }

  try {
    setSyncStatus("正在连接云端", "syncing");
    const [{ initializeApp }, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
    ]);
    const {
      getFirestore,
      doc,
      getDoc,
      onSnapshot,
      setDoc,
      serverTimestamp,
    } = firestore;
    const app = initializeApp(config.firebase);
    const db = getFirestore(app);
    const [collectionName, documentId] = config.documentPath.split("/");
    const documentRef = doc(db, collectionName, documentId);

    cloudStore = {
      documentRef,
      getDoc,
      onSnapshot,
      setDoc,
      serverTimestamp,
      ready: true,
    };

    const firstSnapshot = await getDoc(documentRef);
    if (firstSnapshot.exists()) {
      applyRemoteState(firstSnapshot.data().appState);
    } else {
      await saveCloudNow();
    }

    onSnapshot(documentRef, (snapshot) => {
      if (!snapshot.exists()) return;
      applyRemoteState(snapshot.data().appState);
    }, (error) => {
      setSyncStatus(`云端连接中断：${formatCloudError(error)}`, "error");
    });

    setSyncStatus("云端同步中", "cloud");
  } catch (error) {
    cloudStore = null;
    setSyncStatus(`云端未连接：${formatCloudError(error)}`, "error");
    console.error("Firebase connection failed", error);
  }
}

function isCloudConfigured(config) {
  if (!config?.enabled) return false;
  if (!config.documentPath?.includes("/")) return false;
  const firebase = config.firebase || {};
  return Boolean(firebase.apiKey && firebase.projectId && !firebase.apiKey.includes("YOUR_"));
}

function setSyncStatus(text, mode) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = text;
  els.syncStatus.title = text;
  els.syncStatus.className = `sync-status ${mode}`;
}

function formatCloudError(error) {
  const code = error?.code || "";
  const message = error?.message || String(error || "");
  if (code.includes("permission-denied")) return "权限未开放";
  if (code.includes("not-found")) return "数据库未创建";
  if (code.includes("unavailable")) return "网络暂不可用";
  if (message.includes("Failed to fetch dynamically imported module")) return "Firebase 模块加载失败";
  if (message.includes("Missing or insufficient permissions")) return "权限未开放";
  return code || message.slice(0, 48) || "未知错误";
}

function applyRemoteState(remoteState) {
  if (!remoteState) return;
  const nextState = normalizeState(remoteState);
  if (JSON.stringify(nextState) === JSON.stringify(state)) return;
  applyingRemoteState = true;
  state = nextState;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  applyingRemoteState = false;
  loadRoutineForName();
  renderDefaultSummary();
  renderMySchedule();
  if (els.coachView.classList.contains("active")) renderCoach();
  setSyncStatus("云端同步中", "cloud");
}

function renderSessionGoals() {
  const count = Math.max(1, Math.min(6, Number(els.sessionCount.value || 1)));
  els.sessionGoals.innerHTML = Array.from({ length: count }, (_, index) => `
    <div class="session-item">
      <strong>Session ${index + 1}</strong>
      <select data-session-goal="${index}">
        ${GOALS.map((goal) => `<option value="${goal}" ${index === 0 && goal === "教练安排" ? "selected" : ""}>${goal}</option>`).join("")}
      </select>
    </div>
  `).join("");
}

function renderAvailability() {
  els.availabilityGrid.innerHTML = `
    <div class="head">时间</div>
    ${DAYS.map((day) => `<div class="head">${day.label}</div>`).join("")}
    ${SLOTS.map((slot) => `
      <div class="time">${slot.label}<br><span>${slot.detail}</span></div>
      ${DAYS.map((day) => {
        const key = `${day.id}-${slot.id}`;
        return `<button class="slot-toggle ${selectedAvailability.has(key) ? "selected" : ""}" data-availability="${key}">
          ${selectedAvailability.has(key) ? "可用" : "不可用"}
        </button>`;
      }).join("")}
    `).join("")}
  `;

  els.availabilityGrid.querySelectorAll("[data-availability]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.availability;
      if (selectedAvailability.has(key)) selectedAvailability.delete(key);
      else selectedAvailability.add(key);
      renderAvailability();
    });
  });
}

function submitStudentRequest() {
  const name = els.studentName.value.trim();
  if (!name) {
    setStudentStep(0);
    els.studentMessage.textContent = "先填名字或昵称。";
    return;
  }
  if (!selectedAvailability.size) {
    setStudentStep(3);
    els.studentMessage.textContent = "至少选择一个可用时间。";
    return;
  }

  const locations = [...document.querySelectorAll('input[name="location"]:checked')].map((input) => input.value);
  if (!locations.length) {
    setStudentStep(2);
    els.studentMessage.textContent = "至少选择一个地点偏好。";
    return;
  }

  const request = {
    id: makeId(),
    name,
    code: els.studentCode.value.trim(),
    desiredCount: Math.max(1, Math.min(6, Number(els.sessionCount.value || 1))),
    goals: [...document.querySelectorAll("[data-session-goal]")].map((select) => select.value),
    locations,
    availability: [...selectedAvailability],
    notes: els.studentNotes.value.trim(),
    routine: [
      { slotKey: els.routineOne.value, goal: els.routineGoalOne.value },
      { slotKey: els.routineTwo.value, goal: els.routineGoalTwo.value },
    ].filter((item) => item.slotKey),
    submittedAt: new Date().toISOString(),
  };

  state.requests = state.requests.filter((item) => item.name !== name || item.code !== request.code);
  state.requests.push(request);
  saveRoutine(name, request);
  saveState();
  weeklyEditMode = false;
  currentStudentStep = 0;
  renderStudentSteps();
  renderDefaultSummary();
  els.studentMessage.textContent = "已提交，等待教练确认。";
  renderMySchedule();
}

function saveRoutine(name, request) {
  state.routines[name] = {
    routine: request.routine,
    locations: request.locations,
    goals: request.goals,
  };
}

function getSavedRoutine() {
  return state.routines[els.studentName.value.trim()] || null;
}

function hasUsableRoutine(routine) {
  return Boolean(routine?.routine?.length && routine?.locations?.length);
}

function renderDefaultSummary() {
  if (!els.defaultSummary) return;
  const name = els.studentName.value.trim();
  if (!name) {
    els.defaultSummary.innerHTML = `
      <div class="default-empty">
        <strong>先输入名字</strong>
        <span>如果之前设置过默认安排，这里会自动带出来。</span>
      </div>
    `;
    els.useDefaultWeek.disabled = true;
    els.customizeWeek.textContent = "填写本周申请";
    return;
  }
  const routine = getSavedRoutine();
  if (!hasUsableRoutine(routine)) {
    els.defaultSummary.innerHTML = `
      <div class="default-empty">
        <strong>还没有默认安排</strong>
        <span>先填写一次本周申请，并在最后一步设置默认偏好。之后就可以一键照常提交。</span>
      </div>
    `;
    els.useDefaultWeek.disabled = true;
    els.customizeWeek.textContent = "设置本周申请";
    return;
  }
  const lines = routine.routine.map((item, index) => {
    const goal = item.goal || routine.goals?.[index] || "教练安排";
    return `${formatSlot(item.slotKey)} · ${goal}`;
  });
  els.defaultSummary.innerHTML = `
    <div class="default-ready">
      <span>默认安排</span>
      <strong>${lines.join("；")}</strong>
      <small>地点：${routine.locations.join(" / ")}</small>
    </div>
  `;
  els.useDefaultWeek.disabled = false;
  els.customizeWeek.textContent = "这周要改";
}

function submitDefaultWeek() {
  const name = els.studentName.value.trim();
  if (!name) {
    els.studentMessage.textContent = "先填名字或昵称。";
    return;
  }
  const routine = getSavedRoutine();
  if (!hasUsableRoutine(routine)) {
    els.studentMessage.textContent = "还没有默认安排，先填写一次本周申请。";
    startWeeklyEdit();
    return;
  }
  const request = {
    id: makeId(),
    name,
    code: els.studentCode.value.trim(),
    desiredCount: routine.routine.length,
    goals: routine.routine.map((item, index) => item.goal || routine.goals?.[index] || "教练安排"),
    locations: routine.locations,
    availability: routine.routine.map((item) => item.slotKey),
    notes: "本周照常。",
    routine: routine.routine,
    submittedAt: new Date().toISOString(),
  };
  state.requests = state.requests.filter((item) => item.name !== name || item.code !== request.code);
  state.requests.push(request);
  saveState();
  weeklyEditMode = false;
  currentStudentStep = 0;
  renderStudentSteps();
  els.studentMessage.textContent = "已按默认安排提交给教练。";
  renderMySchedule();
}

function loadRoutineForName() {
  const routine = getSavedRoutine();
  if (!routine) return;
  els.routineOne.value = routine.routine?.[0]?.slotKey || "";
  els.routineGoalOne.value = routine.routine?.[0]?.goal || "教练安排";
  els.routineTwo.value = routine.routine?.[1]?.slotKey || "";
  els.routineGoalTwo.value = routine.routine?.[1]?.goal || "教练安排";
  document.querySelectorAll('input[name="location"]').forEach((input) => {
    input.checked = routine.locations?.includes(input.value) || false;
  });
  if (routine.routine?.length) {
    els.sessionCount.value = routine.routine.length;
    renderSessionGoals();
    document.querySelectorAll("[data-session-goal]").forEach((select, index) => {
      select.value = routine.routine?.[index]?.goal || routine.goals?.[index] || "教练安排";
    });
    selectedAvailability = new Set(routine.routine.map((item) => item.slotKey).filter(Boolean));
    renderAvailability();
  }
}

function renderMySchedule() {
  const name = els.studentName.value.trim();
  if (!name) {
    els.mySchedule.innerHTML = `<div class="empty">输入名字后可以查看已发布给你的课程。</div>`;
    return;
  }
  const assignments = state.published.filter((item) => item.name === name);
  if (!assignments.length) {
    els.mySchedule.innerHTML = `<div class="empty">目前还没有发布给你的课程。</div>`;
    return;
  }
  els.mySchedule.innerHTML = assignments.map((item) => `
    <article class="schedule-card">
      <strong>${formatSlot(item.slotKey)}</strong>
      <span>${item.goal} · ${item.location}</span>
    </article>
  `).join("");
}

function unlockCoach() {
  if (els.coachPin.value === COACH_PIN) {
    els.pinMessage.textContent = "";
    showView("coach");
  } else {
    els.pinMessage.textContent = "PIN 不对。演示 PIN 是 2468。";
  }
}

function seedDemo() {
  state.requests = [
    {
      id: makeId(),
      name: "苏",
      code: "1111",
      desiredCount: 2,
      goals: ["下肢", "上肢"],
      locations: ["235 Grand", "Bisby"],
      availability: ["mon-late", "wed-late", "thu-early"],
      routine: [{ slotKey: "mon-late", goal: "下肢" }, { slotKey: "wed-late", goal: "上肢" }],
      notes: "上下肢交替。",
    },
    {
      id: makeId(),
      name: "Emma",
      code: "2222",
      desiredCount: 2,
      goals: ["上肢", "下肢"],
      locations: ["235 Grand", "Bisby"],
      availability: ["mon-early", "thu-early"],
      routine: [],
      notes: "",
    },
    {
      id: makeId(),
      name: "Leah",
      code: "3333",
      desiredCount: 2,
      goals: ["全身力量", "功能性"],
      locations: ["235 Grand"],
      availability: ["tue-early", "wed-early"],
      routine: [],
      notes: "",
    },
    {
      id: makeId(),
      name: "Bishy",
      code: "4444",
      desiredCount: 1,
      goals: ["上肢"],
      locations: ["235 Grand"],
      availability: ["mon-early"],
      routine: [],
      notes: "",
    },
    {
      id: makeId(),
      name: "小黄",
      code: "5555",
      desiredCount: 1,
      goals: ["上肢"],
      locations: ["235 Grand"],
      availability: ["mon-early", "tue-late", "wed-early"],
      routine: [],
      notes: "",
    },
    {
      id: makeId(),
      name: "涵姐",
      code: "6666",
      desiredCount: 1,
      goals: ["下肢"],
      locations: ["235 Grand"],
      availability: ["tue-late", "wed-late"],
      routine: [],
      notes: "",
    },
  ];
  state.draft = { assignments: [], unassigned: [], dayLocations: {}, issues: [] };
  saveState();
  generateDraft();
}

function generateDraft() {
  const dayLocations = suggestDayLocations(state.requests);
  const sessions = expandSessions(state.requests);
  const assignments = [];
  const unassigned = [];

  sessions.sort((a, b) => a.request.availability.length - b.request.availability.length);

  for (const session of sessions) {
    const choice = chooseBestSlot(session, assignments, dayLocations);
    if (choice) {
      assignments.push({
        id: makeId(),
        requestId: session.request.id,
        name: session.request.name,
        goal: session.goal,
        slotKey: choice,
        location: dayLocations[getDayId(choice)] || "教练选择",
      });
    } else {
      unassigned.push({ ...session, id: makeId() });
    }
  }

  const issues = findIssues(assignments, unassigned, dayLocations);
  state.draft = { assignments, unassigned, dayLocations, issues };
  saveState();
  renderCoach();
}

function suggestDayLocations(requests) {
  const result = {};
  for (const day of DAYS) {
    const votes = countLocationVotes(day.id, requests);
    if (votes["235 Grand"] > votes.Bisby) result[day.id] = "235 Grand";
    else if (votes.Bisby > votes["235 Grand"]) result[day.id] = "Bisby";
    else result[day.id] = "";
  }
  return result;
}

function countLocationVotes(dayId, requests) {
  const votes = Object.fromEntries(LOCATIONS.map((location) => [location, 0]));
  for (const request of requests) {
    if (!request.availability.some((slotKey) => getDayId(slotKey) === dayId)) continue;
    const selected = LOCATIONS.filter((location) => request.locations.includes(location));
    if (selected.length === 1) votes[selected[0]] += 1;
  }
  return votes;
}

function expandSessions(requests) {
  return requests.flatMap((request) => {
    return Array.from({ length: request.desiredCount }, (_, index) => ({
      request,
      index,
      goal: request.goals[index] || request.goals[0] || "教练安排",
    }));
  });
}

function chooseBestSlot(session, assignments, dayLocations) {
  const candidates = session.request.availability
    .filter((slotKey) => assignments.filter((item) => item.slotKey === slotKey).length < CAPACITY)
    .filter((slotKey) => !assignments.some((item) => item.slotKey === slotKey && item.requestId === session.request.id))
    .map((slotKey) => ({ slotKey, score: scoreSlot(session, slotKey, assignments) }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.slotKey || null;
}

function scoreSlot(session, slotKey, assignments) {
  let score = 0;
  const slotAssignments = assignments.filter((item) => item.slotKey === slotKey);
  const routineMatch = session.request.routine?.some((item) => item.slotKey === slotKey);
  if (routineMatch) score += 5;
  if (!slotAssignments.length) score += 1;
  for (const item of slotAssignments) {
    score += compatibility(session.goal, item.goal);
  }
  return score;
}

function compatibility(a, b) {
  if (a === "教练安排" || b === "教练安排") return 0;
  if (a === b) return 4;
  if ((a === "全身力量" && b === "功能性") || (a === "功能性" && b === "全身力量")) return -1;
  if ((a === "上肢" && b === "下肢") || (a === "下肢" && b === "上肢")) return -3;
  return -1;
}

function findIssues(assignments, unassigned, dayLocations) {
  const issues = [];
  for (const day of DAYS) {
    const dayItems = assignments.filter((item) => getDayId(item.slotKey) === day.id);
    const location = dayLocations[day.id];
    if (dayItems.length && !location) {
      issues.push({
        type: "location-choice",
        dayId: day.id,
        title: `${day.label} 地点待确认`,
        text: "当天地点偏好没有明显多数，需要教练选择 235 Grand 或 Bisby。",
        severity: "review",
      });
    }
    if (dayItems.length && location) {
      const outsidePreference = dayItems.filter((item) => {
        const request = state.requests.find((req) => req.id === item.requestId);
        return request && !request.locations.includes(location);
      });
      if (outsidePreference.length) {
        issues.push({
          type: "location-preference",
          dayId: day.id,
          title: `${day.label} 地点需确认`,
          text: `${outsidePreference.map((item) => item.name).join("、")} 没有优先选择 ${location}，教练可确认是否仍安排在这里。`,
          severity: "review",
        });
      }
    }
  }
  for (const slotKey of allSlotKeys()) {
    const items = assignments.filter((item) => item.slotKey === slotKey);
    if (items.length > CAPACITY) {
      issues.push({ type: "capacity", slotKey, title: `${formatSlot(slotKey)} 超过 2 人`, text: "需要移动一位学员。", severity: "error" });
    }
    const duplicate = findDuplicateStudent(items);
    if (duplicate) {
      issues.push({
        type: "duplicate",
        slotKey,
        title: `${formatSlot(slotKey)} 同一学员重复`,
        text: `${duplicate.name} 的两节课不能排在同一个时间段。`,
        severity: "error",
      });
    }
    if (items.length === 2 && compatibility(items[0].goal, items[1].goal) < 0) {
      issues.push({
        type: "compatibility",
        slotKey,
        title: `${formatSlot(slotKey)} 内容不太搭`,
        text: `${items[0].name} 想练 ${items[0].goal}，${items[1].name} 想练 ${items[1].goal}。这两个内容不太适合直接拼在一节课里。`,
        severity: "review",
      });
    }
  }
  for (const session of unassigned) {
    issues.push({
      type: "unassigned",
      sessionId: session.id,
      title: `${session.request.name} 没有可排时间`,
      text: `${session.request.name} 想练 ${session.goal}，但她提交的可用时间里目前没有合适空位。`,
      severity: "error",
    });
  }
  return issues;
}

function renderCoach() {
  els.requestCount.textContent = `${state.requests.length} 人提交`;
  setCoachPage(selectedCoachPage);
  renderCoachScheduleOverview();
  renderMobileCoach();
  renderStudentSummary();
  renderLocationRow();
  renderCoachCalendar();
  renderUnassigned();
  renderIssue(state.draft.issues[0] || null);
}

function renderCoachScheduleOverview() {
  const isPublished = state.published.length > 0;
  const assignments = isPublished ? state.published : state.draft.assignments;
  els.coachScheduleTitle.textContent = isPublished ? "已发布安排" : "草案预览";

  if (!assignments.length) {
    els.coachScheduleOverview.innerHTML = `
      <div class="empty">
        还没有可查看的安排。可以先去「调整排课」生成草案。
      </div>
    `;
    return;
  }

  els.coachScheduleOverview.innerHTML = `
    <div class="coach-schedule-grid">
      ${DAYS.map((day) => renderCoachDayOverview(day, assignments, isPublished)).join("")}
    </div>
  `;
}

function renderCoachDayOverview(day, assignments, isPublished) {
  const dayItems = assignments.filter((item) => getDayId(item.slotKey) === day.id);
  const location = getDayOverviewLocation(day.id, dayItems, isPublished);
  return `
    <article class="coach-day-card">
      <header>
        <strong>${day.label}</strong>
        <span>${location}</span>
      </header>
      <div class="day-slot-list">
        ${SLOTS.map((slot) => renderCoachSlotOverview(`${day.id}-${slot.id}`, assignments)).join("")}
      </div>
    </article>
  `;
}

function renderCoachSlotOverview(slotKey, assignments) {
  const items = assignments.filter((item) => item.slotKey === slotKey);
  return `
    <section class="day-slot-row">
      <time>${formatSlotTime(slotKey)}</time>
      <div>
        ${items.length ? items.map((item) => `
          <span class="schedule-pill">${item.name} · ${item.goal}</span>
        `).join("") : `<span class="empty-pill">空</span>`}
      </div>
    </section>
  `;
}

function getDayOverviewLocation(dayId, dayItems, isPublished) {
  if (isPublished) {
    const location = dayItems.find((item) => item.location)?.location;
    return location || "未安排地点";
  }
  return state.draft.dayLocations[dayId] || "地点待定";
}

function renderMobileCoach() {
  renderMobileDayTabs();
  renderMobileDay();
  renderMobileIssues();
}

function renderMobileDayTabs() {
  if (!els.mobileDayTabs) return;
  els.mobileDayTabs.innerHTML = DAYS.map((day) => `
    <button class="${selectedMobileDay === day.id ? "active" : ""}" data-mobile-day="${day.id}">${day.label}</button>
  `).join("");
  els.mobileDayTabs.querySelectorAll("[data-mobile-day]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMobileDay = button.dataset.mobileDay;
      renderMobileCoach();
    });
  });
}

function renderMobileDay() {
  if (!els.mobileCoachDay) return;
  const day = DAYS.find((item) => item.id === selectedMobileDay) || DAYS[0];
  const location = state.draft.dayLocations[day.id] || "教练选择";
  const dayAssignments = state.draft.assignments.filter((item) => getDayId(item.slotKey) === day.id);
  els.mobileCoachDay.innerHTML = `
    <div class="mobile-location">
      <span>${day.label} 地点</span>
      <strong>${location}</strong>
    </div>
    <div class="mobile-slot-list">
      ${SLOTS.map((slot) => renderMobileSlot(`${day.id}-${slot.id}`, dayAssignments)).join("")}
    </div>
  `;
}

function renderMobileSlot(slotKey, dayAssignments) {
  const assignments = dayAssignments.filter((item) => item.slotKey === slotKey);
  const issue = state.draft.issues.find((item) => item.slotKey === slotKey);
  return `
    <article class="mobile-slot ${issue ? issue.severity : ""}" data-mobile-slot="${slotKey}">
      <div>
        <strong>${formatSlot(slotKey)}</strong>
        <span>${state.draft.dayLocations[getDayId(slotKey)] || "教练选择"}</span>
      </div>
      <div class="mobile-people">
        ${assignments.length ? assignments.map((item) => `<span>${item.name} · ${item.goal}</span>`).join("") : "<span>空</span>"}
      </div>
    </article>
  `;
}

function renderMobileIssues() {
  if (!els.mobileCoachIssues) return;
  const issues = state.draft.issues.slice(0, 5);
  if (!issues.length) {
    els.mobileCoachIssues.innerHTML = `<div class="empty compact">暂无待处理问题。</div>`;
    return;
  }
  els.mobileCoachIssues.innerHTML = issues.map((issue) => `
    <button class="mobile-issue ${issue.severity}" data-mobile-issue="${issue.slotKey || issue.dayId || issue.sessionId || ""}">
      <strong>${issue.title}</strong>
      <span>${issue.text}</span>
    </button>
  `).join("");
  els.mobileCoachIssues.querySelectorAll(".mobile-issue").forEach((button, index) => {
    button.addEventListener("click", () => renderIssue(issues[index]));
  });
}

function renderStudentSummary() {
  if (!state.requests.length) {
    els.studentSummary.innerHTML = `<div class="empty">还没有学员提交。</div>`;
    return;
  }
  els.studentSummary.innerHTML = state.requests.map((request) => {
    const assigned = state.draft.assignments.filter((item) => item.requestId === request.id).length;
    const status = assigned >= request.desiredCount ? "done" : assigned === 0 ? "blocked" : "needs";
    return `
      <article class="student-row ${status}">
        <strong>${request.name}</strong>
        <span>想上 ${request.desiredCount} · 已排 ${assigned}</span>
        <small>${request.goals.join(" / ")} · 可用 ${request.availability.length} 个时间</small>
      </article>
    `;
  }).join("");
}

function renderLocationRow() {
  els.locationRow.innerHTML = `<div class="time-spacer">地点</div>` + DAYS.map((day) => {
    const location = state.draft.dayLocations[day.id] || "";
    const dayIssue = state.draft.issues.find((issue) => issue.dayId === day.id);
    const votes = countLocationVotes(day.id, state.requests);
    const totalVotes = votes["235 Grand"] + votes.Bisby;
    const suggestion = totalVotes
      ? votes["235 Grand"] === votes.Bisby
        ? `平票 ${votes["235 Grand"]}:${votes.Bisby}`
        : `建议 ${votes["235 Grand"] > votes.Bisby ? "235 Grand" : "Bisby"} · ${votes["235 Grand"]}:${votes.Bisby}`
      : "暂无偏好";
    return `
      <label class="location-card ${dayIssue || !location ? "review" : "selected"}" data-day-card="${day.id}">
        <span>${day.label}</span>
        <select data-day-location="${day.id}">
          <option value="" ${location ? "" : "selected"}>教练选择</option>
          ${LOCATIONS.map((item) => `<option value="${item}" ${location === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <small>${suggestion}</small>
      </label>
    `;
  }).join("");

  els.locationRow.querySelectorAll("[data-day-location]").forEach((select) => {
    select.addEventListener("change", () => {
      updateDayLocation(select.dataset.dayLocation, select.value);
    });
  });
  els.locationRow.querySelectorAll("[data-day-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const issue = state.draft.issues.find((item) => item.dayId === card.dataset.dayCard);
      if (issue) renderIssue(issue);
    });
  });
}

function renderCoachCalendar() {
  els.coachCalendar.innerHTML = SLOTS.map((slot) => `
    <div class="time-label">${slot.label}</div>
    ${DAYS.map((day) => renderSlot(`${day.id}-${slot.id}`)).join("")}
  `).join("");

  els.coachCalendar.querySelectorAll(".slot").forEach((slot) => {
    slot.addEventListener("dragover", (event) => event.preventDefault());
    slot.addEventListener("drop", () => moveDraggedToSlot(slot.dataset.slotKey));
    slot.addEventListener("click", () => {
      const issue = state.draft.issues.find((item) => item.slotKey === slot.dataset.slotKey);
      renderIssue(issue || null);
    });
  });

  els.coachCalendar.querySelectorAll("[draggable='true']").forEach((chip) => {
    chip.addEventListener("dragstart", () => {
      dragged = { type: "assignment", id: chip.dataset.assignmentId };
    });
  });
}

function renderSlot(slotKey) {
  const assignments = state.draft.assignments.filter((item) => item.slotKey === slotKey);
  const issue = state.draft.issues.find((item) => item.slotKey === slotKey);
  const className = issue?.severity === "error" ? "error" : issue?.severity === "review" ? "review" : "";
  return `
    <article class="slot ${className}" data-slot-key="${slotKey}">
      <div class="people">
        ${assignments.map((item) => `<button class="person-chip" draggable="true" data-assignment-id="${item.id}">${item.name}</button>`).join("")}
        ${assignments.length < CAPACITY ? `<span class="drop-chip">可放入 ${CAPACITY - assignments.length} 人</span>` : ""}
      </div>
      <strong>${assignments.map((item) => item.goal).join(" / ") || "空"}</strong>
      <span>${formatSlot(slotKey)} · ${state.draft.dayLocations[getDayId(slotKey)] || "教练选择"}</span>
    </article>
  `;
}

function renderUnassigned() {
  if (!state.draft.unassigned.length) {
    els.unassignedPool.innerHTML = `<span class="muted">没有待放入学员。</span>`;
    return;
  }
  els.unassignedPool.innerHTML = state.draft.unassigned.map((item) => `
    <button draggable="true" data-unassigned-id="${item.id}">${item.request.name} · ${item.goal} · 可 ${item.request.availability.map(formatSlot).join(" / ")}</button>
  `).join("");

  els.unassignedPool.querySelectorAll("[draggable='true']").forEach((button) => {
    button.addEventListener("dragstart", () => {
      dragged = { type: "unassigned", id: button.dataset.unassignedId };
    });
  });
}

function renderIssue(issue) {
  currentIssue = issue;
  if (!issue) {
    els.issueTitle.textContent = "没有选中问题";
    els.issueText.textContent = "点击黄色或红色格子查看建议。";
    els.issueRecommendation.innerHTML = "";
    els.applyRecommendation.disabled = true;
    return;
  }
  els.issueTitle.textContent = issue.title;
  els.issueText.textContent = issue.text;
  const recommendation = buildRecommendation(issue);
  if (issue.type === "ask-availability") {
    els.issueRecommendation.innerHTML = renderAskAvailabilityAdvice(issue);
    els.applyRecommendation.disabled = true;
    return;
  }
  els.issueRecommendation.innerHTML = recommendation ? `
    <div class="recommend-box">
      <strong>可以直接调整</strong>
      <p>${recommendation.text}</p>
      <ul>${recommendation.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
    </div>
  ` : renderManualPlanAdvice(issue);
  els.applyRecommendation.disabled = !recommendation;
}

function renderAskAvailabilityAdvice(issue) {
  const options = issue.options || [];
  const optionList = options.length
    ? `<ul>${options.map((option) => `<li>${formatSlot(option.slotKey)}：${option.reason}</li>`).join("")}</ul>`
    : `<p>目前没有特别好的候选时间，可以直接问 ${issue.studentName} 本周是否还有其他时间能上。</p>`;
  return `
    <div class="recommend-box">
      <strong>建议沟通</strong>
      <p>可以私下问 ${issue.studentName} 是否能临时加选这些时间：</p>
      ${optionList}
    </div>
  `;
}

function renderManualPlanAdvice(issue) {
  const plans = buildManualPlans(issue);
  if (!plans.length) {
    return `<div class="recommend-box"><strong>${getIssueDiagnosisTitle(issue)}</strong><p>${getIssueDiagnosisText(issue)}目前没有明显的沟通候选时间，需要教练自己判断。</p></div>`;
  }
  return `
    <div class="recommend-box">
      <strong>${getIssueDiagnosisTitle(issue)}</strong>
      <p>${getIssueDiagnosisText(issue)}</p>
      <p>可以优先尝试这些沟通方案：</p>
      <div class="plan-list">
        ${plans.map((plan, index) => `
          <article class="plan-card">
            <span>优先 ${index + 1}</span>
            <strong>${plan.text}</strong>
            <small>${plan.reason}</small>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function getIssueDiagnosisTitle(issue) {
  if (issue.type === "compatibility") return "问题：训练内容不太搭";
  if (issue.type === "duplicate") return "问题：同一学员时间重复";
  if (issue.type === "unassigned") return "问题：没有符合可用时间的空位";
  return "问题需要确认";
}

function getIssueDiagnosisText(issue) {
  if (issue.type === "compatibility") {
    return "现在这个时间段可以坐下两个人，但他们想练的内容不太适合直接拼课。";
  }
  if (issue.type === "duplicate") {
    return "同一个学员的两节课被放到了同一个时间段，需要换开。";
  }
  if (issue.type === "unassigned") {
    return "这个学员提交的可用时间里，目前没有能直接放进去的位置。";
  }
  return "";
}

function updateDayLocation(dayId, location) {
  state.draft.dayLocations[dayId] = location;
  state.draft.assignments
    .filter((item) => getDayId(item.slotKey) === dayId)
    .forEach((item) => {
      item.location = location || "教练选择";
    });
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function buildRecommendation(issue) {
  if (issue.type !== "compatibility" && issue.type !== "duplicate") return null;
  const items = state.draft.assignments.filter((item) => item.slotKey === issue.slotKey);
  const startingScore = issueScore(state.draft.issues);
  const sortedItems = items
    .map((item) => {
      const request = state.requests.find((req) => req.id === item.requestId);
      return { item, request, flexibility: request?.availability.length || 0 };
    })
    .sort((a, b) => b.flexibility - a.flexibility);

  for (const { item, request } of sortedItems) {
    if (!request) continue;
    const alternatives = request.availability
      .filter((slotKey) => slotKey !== issue.slotKey)
      .filter((slotKey) => canSafelyMove(item, slotKey))
      .map((slotKey) => {
        const simulated = simulateMove(item.id, slotKey);
        const score = issueScore(findIssues(simulated, state.draft.unassigned, state.draft.dayLocations));
        return { slotKey, score };
      })
      .filter((candidate) => candidate.score < startingScore)
      .sort((a, b) => a.score - b.score);
    const alternative = alternatives[0]?.slotKey;
    if (alternative) {
      const targetPeople = state.draft.assignments.filter((assigned) => assigned.slotKey === alternative);
      const contentReason = targetPeople.length
        ? `${formatSlot(alternative)} 目前内容更容易拼课`
        : `${formatSlot(alternative)} 目前是空位`;
      return {
        assignmentId: item.id,
        targetSlot: alternative,
        text: `把 ${item.name} 移到 ${formatSlot(alternative)}。`,
        reasons: [
          `${item.name} 也提交了 ${formatSlot(alternative)} 可用`,
          contentReason,
          `当天地点为 ${state.draft.dayLocations[getDayId(alternative)] || "教练选择"}`,
        ],
      };
    }
  }
  return null;
}

function buildManualPlans(issue) {
  if (issue.type !== "compatibility" && issue.type !== "duplicate") return [];
  const items = state.draft.assignments.filter((item) => item.slotKey === issue.slotKey);
  return items
    .flatMap((item) => {
      const request = state.requests.find((req) => req.id === item.requestId);
      if (!request) return [];
      return allSlotKeys()
        .filter((slotKey) => slotKey !== item.slotKey)
        .filter((slotKey) => !state.draft.assignments.some((assigned) => assigned.slotKey === slotKey && assigned.requestId === item.requestId))
        .map((slotKey) => buildManualPlanForSlot(item, request, slotKey))
        .filter(Boolean);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function buildManualPlanForSlot(item, request, slotKey) {
  const targetItems = state.draft.assignments.filter((assigned) => assigned.slotKey === slotKey && assigned.id !== item.id);
  if (targetItems.length >= CAPACITY) return null;
  const alreadyAvailable = request.availability.includes(slotKey);
  const location = state.draft.dayLocations[getDayId(slotKey)] || "教练选择";
  const compatScore = targetItems.reduce((total, assigned) => total + compatibility(item.goal, assigned.goal), 0);
  let score = 0;
  if (alreadyAvailable) score += 30;
  else score += 8;
  if (!targetItems.length) score += 12;
  if (targetItems.length && compatScore >= 0) score += 8;
  if (getDayId(slotKey) === getDayId(item.slotKey)) score += 3;
  if (location !== "教练选择") score += 1;
  if (targetItems.length && compatScore < 0) score -= 12;

  const action = alreadyAvailable ? "移到" : "询问能否改到";
  const reasonParts = [];
  reasonParts.push(alreadyAvailable ? "她已经提交这个时间可用" : "需要先私下确认她是否可用");
  reasonParts.push(targetItems.length ? `目前已有 ${targetItems.map((assigned) => assigned.name).join("、")}` : "目前有空位");
  reasonParts.push(`地点：${location}`);
  if (targetItems.length && compatScore < 0) reasonParts.push("训练内容不太搭");

  return {
    score,
    text: `${action} ${formatSlot(slotKey)} · ${location}：${item.name} (${item.goal})`,
    reason: reasonParts.join("；"),
  };
}

function canSafelyMove(item, targetSlot) {
  const request = state.requests.find((req) => req.id === item.requestId);
  if (!request) return false;
  const targetItems = state.draft.assignments.filter((assigned) => assigned.slotKey === targetSlot && assigned.id !== item.id);
  if (targetItems.length >= CAPACITY) return false;
  if (targetItems.some((assigned) => assigned.requestId === item.requestId)) return false;
  return targetItems.every((assigned) => compatibility(item.goal, assigned.goal) >= 0);
}

function simulateMove(assignmentId, targetSlot) {
  return state.draft.assignments.map((item) => {
    if (item.id !== assignmentId) return { ...item };
    return {
      ...item,
      slotKey: targetSlot,
      location: state.draft.dayLocations[getDayId(targetSlot)] || "教练选择",
    };
  });
}

function issueScore(issues) {
  return issues.reduce((total, issue) => total + (issue.severity === "error" ? 10 : 1), 0);
}

function findDuplicateStudent(items) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.requestId)) return item;
    seen.add(item.requestId);
  }
  return null;
}

function buildMoveBlockIssue(item, targetSlot) {
  const request = state.requests.find((req) => req.id === item.requestId);
  if (!request?.availability.includes(targetSlot)) {
    const options = suggestAskableSlots(item, targetSlot);
    return {
      type: "ask-availability",
      title: "时间不在她的可用范围",
      text: `${item.name} 没有提交 ${formatSlot(targetSlot)} 可用。`,
      severity: "review",
      studentName: item.name,
      targetSlot,
      options,
    };
  }
  const targetItems = state.draft.assignments.filter((assigned) => assigned.slotKey === targetSlot && assigned.id !== item.id);
  if (targetItems.length >= CAPACITY) {
    return {
      title: "这个位置不能放",
      text: `${formatSlot(targetSlot)} 已经满员。`,
      severity: "error",
    };
  }
  if (targetItems.some((assigned) => assigned.requestId === item.requestId)) {
    return {
      title: "这个位置不能放",
      text: `${item.name} 已经在 ${formatSlot(targetSlot)}。`,
      severity: "error",
    };
  }
  return null;
}

function suggestAskableSlots(item, targetSlot) {
  const request = state.requests.find((req) => req.id === item.requestId);
  const targetDay = getDayId(targetSlot);
  const candidates = allSlotKeys()
    .filter((slotKey) => slotKey !== item.slotKey)
    .filter((slotKey) => !request?.availability.includes(slotKey))
    .filter((slotKey) => slotKey !== targetSlot || state.draft.assignments.filter((assigned) => assigned.slotKey === slotKey && assigned.id !== item.id).length < CAPACITY)
    .map((slotKey) => {
      const targetItems = state.draft.assignments.filter((assigned) => assigned.slotKey === slotKey && assigned.id !== item.id);
      if (targetItems.length >= CAPACITY) return null;
      if (targetItems.some((assigned) => assigned.requestId === item.requestId)) return null;
      const compatScore = targetItems.reduce((total, assigned) => total + compatibility(item.goal, assigned.goal), 0);
      let score = 0;
      if (slotKey === targetSlot) score += 10;
      if (getDayId(slotKey) === targetDay) score += 2;
      if (!targetItems.length) score += 4;
      score += compatScore;
      if (targetItems.length && compatScore < 0) score -= 8;
      return {
        slotKey,
        score,
        reason: describeAskableSlot(slotKey, targetItems, item),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return candidates.slice(0, 4);
}

function describeAskableSlot(slotKey, targetItems, item) {
  if (!targetItems.length) return "目前有空位，调整成本低";
  if (targetItems.every((assigned) => compatibility(item.goal, assigned.goal) >= 0)) {
    return `已有 ${targetItems.map((assigned) => assigned.name).join("、")}，内容相对可搭`;
  }
  return `已有 ${targetItems.map((assigned) => assigned.name).join("、")}，训练内容不太搭`;
}

function applyRecommendation() {
  const recommendation = buildRecommendation(currentIssue);
  if (!recommendation) return;
  const assignment = state.draft.assignments.find((item) => item.id === recommendation.assignmentId);
  assignment.slotKey = recommendation.targetSlot;
  assignment.location = state.draft.dayLocations[getDayId(recommendation.targetSlot)] || "教练选择";
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function moveDraggedToSlot(slotKey) {
  if (!dragged) return;
  const currentCount = state.draft.assignments.filter((item) => item.slotKey === slotKey).length;
  if (currentCount >= CAPACITY) return;
  if (dragged.type === "assignment") {
    const assignment = state.draft.assignments.find((item) => item.id === dragged.id);
    const blockIssue = assignment ? buildMoveBlockIssue(assignment, slotKey) : null;
    if (blockIssue) {
      renderIssue(blockIssue);
      dragged = null;
      return;
    }
    if (assignment) {
      assignment.slotKey = slotKey;
      assignment.location = state.draft.dayLocations[getDayId(slotKey)] || "教练选择";
    }
  }
  if (dragged.type === "unassigned") {
    const index = state.draft.unassigned.findIndex((item) => item.id === dragged.id);
    const item = state.draft.unassigned[index];
    if (item && !item.request.availability.includes(slotKey)) {
      renderIssue({
        type: "ask-availability",
        title: "时间不在她的可用范围",
        text: `${item.request.name} 没有提交 ${formatSlot(slotKey)} 可用。`,
        severity: "review",
        studentName: item.request.name,
        targetSlot: slotKey,
        options: suggestAskableSlots({
          id: item.id,
          requestId: item.request.id,
          name: item.request.name,
          goal: item.goal,
          slotKey: "",
        }, slotKey),
      });
      dragged = null;
      return;
    }
    if (item && item.request.availability.includes(slotKey)) {
      state.draft.assignments.push({
        id: makeId(),
        requestId: item.request.id,
        name: item.request.name,
        goal: item.goal,
        slotKey,
        location: state.draft.dayLocations[getDayId(slotKey)] || "教练选择",
      });
      state.draft.unassigned.splice(index, 1);
    }
  }
  dragged = null;
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function publishSchedule() {
  state.published = [...state.draft.assignments];
  saveState();
  renderMySchedule();
  alert("已发布。学员回到提交页输入名字即可看到自己的安排。");
}

function exportCalendar() {
  const assignments = state.published.length ? state.published : state.draft.assignments;
  if (!assignments.length) {
    alert("还没有可导出的安排。可以先生成草案或发布最终安排。");
    return;
  }

  const weekStart = getNextTrainingMonday();
  const ics = buildCalendarFile(assignments, weekStart);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `training-schedule-${formatDateForFile(weekStart)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCalendarFile(assignments, weekStart) {
  const now = formatIcsDateTime(new Date());
  const events = allSlotKeys()
    .map((slotKey) => buildCalendarEvent(slotKey, assignments, weekStart, now))
    .filter(Boolean)
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Training Scheduler//Private Coaching//ZH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    events,
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function buildCalendarEvent(slotKey, assignments, weekStart, now) {
  const items = assignments.filter((item) => item.slotKey === slotKey);
  if (!items.length) return null;
  const start = getSlotDateTime(slotKey, weekStart, "start");
  const end = getSlotDateTime(slotKey, weekStart, "end");
  const location = items.find((item) => item.location)?.location || "地点待定";
  const names = items.map((item) => item.name).join("、");
  const goals = items.map((item) => `${item.name}: ${item.goal}`).join("\\n");

  return [
    "BEGIN:VEVENT",
    `UID:${slotKey}-${formatDateForFile(weekStart)}@training-scheduler`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDateTime(start)}`,
    `DTEND:${formatIcsDateTime(end)}`,
    `SUMMARY:${escapeIcsText(`私教课：${names}`)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(goals)}`,
    "END:VEVENT",
  ].join("\r\n");
}

function getNextTrainingMonday() {
  const today = new Date();
  const result = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = result.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  result.setDate(result.getDate() + daysUntilMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getSlotDateTime(slotKey, weekStart, edge) {
  const [dayId, slotId] = slotKey.split("-");
  const dayOffset = DAYS.findIndex((day) => day.id === dayId);
  const time = getSlotClock(slotId, edge);
  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + dayOffset,
    time.hour,
    time.minute,
  );
}

function getSlotClock(slotId, edge) {
  if (slotId === "early") return edge === "start" ? { hour: 18, minute: 0 } : { hour: 19, minute: 0 };
  return edge === "start" ? { hour: 19, minute: 15 } : { hour: 20, minute: 15 };
}

function formatIcsDateTime(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatDateForFile(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function escapeIcsText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function allSlotKeys() {
  return DAYS.flatMap((day) => SLOTS.map((slot) => `${day.id}-${slot.id}`));
}

function getTodayDayId() {
  const ids = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = ids[new Date().getDay()];
  return DAYS.some((day) => day.id === today) ? today : "mon";
}

function getDayId(slotKey) {
  return slotKey.split("-")[0];
}

function formatSlot(slotKey) {
  const [dayId, slotId] = slotKey.split("-");
  const day = DAYS.find((item) => item.id === dayId);
  const slot = SLOTS.find((item) => item.id === slotId);
  return `${day.label} ${slot.label}`;
}

function formatSlotTime(slotKey) {
  const slotId = slotKey.split("-")[1];
  return SLOTS.find((item) => item.id === slotId)?.label || "";
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return normalizeState(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return normalizeState({});
}

function normalizeState(saved) {
  return {
    requests: saved.requests || [],
    routines: saved.routines || {},
    draft: saved.draft || { assignments: [], unassigned: [], dayLocations: {}, issues: [] },
    published: saved.published || [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!cloudStore?.ready || applyingRemoteState) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(saveCloudNow, 250);
}

async function saveCloudNow() {
  if (!cloudStore?.ready) return;
  try {
    setSyncStatus("正在保存", "syncing");
    await cloudStore.setDoc(cloudStore.documentRef, {
      appState: state,
      updatedAt: cloudStore.serverTimestamp(),
    }, { merge: true });
    setSyncStatus("云端同步中", "cloud");
  } catch (error) {
    setSyncStatus(`保存失败：${formatCloudError(error)}`, "error");
    console.error("Firebase save failed", error);
  }
}
