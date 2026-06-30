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

const FLEX_GOAL = "听 Dora 安排";
const GOALS = ["上肢", "下肢", "全身力量", "功能性", FLEX_GOAL];
const LOCATIONS = ["235 Grand", "Bisby"];
const STORAGE_KEY = "training-scheduler-mvp-v1";
const DEFAULT_COACH_PIN = "2468";
const CAPACITY = 2;
const STUDENT_STEPS = ["身份", "安排", "常用", "内容", "时间", "地点", "确认"];

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-view-target]");
  if (trigger) {
    event.preventDefault();
    navigateView(trigger.dataset.viewTarget);
    return;
  }
  if (event.target.closest("#unlockCoach")) {
    const pin = document.querySelector("#coachPin")?.value;
    const message = document.querySelector("#pinMessage");
    if (isValidCoachPin(pin)) {
      if (message) message.textContent = "";
      navigateView("coach");
    } else if (message) {
      message.textContent = "PIN 不对。如果忘记了，请联系小黄去云端找回。";
    }
  }
});

function navigateView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  const target = document.querySelector(`#${name === "student" ? "studentView" : name === "pin" ? "pinView" : name === "coach" ? "coachView" : "roleView"}`);
  if (target) target.classList.add("active");
  document.body.dataset.view = name;
  if (name === "coach" && typeof renderCoach === "function") {
    try {
      renderCoach();
    } catch {
      // The entry should still work even if a draft render needs attention.
    }
  }
}

let state = loadState();
let selectedAvailability = new Set();
let selectedPreferredAvailability = new Set();
let selectedGoals = new Set([FLEX_GOAL]);
let lastSubmittedRequest = null;
let currentStudentStep = 0;
let weeklyEditMode = true;
let dragged = null;
let selectedMove = null;
let currentIssue = null;
let cloudStore = null;
let cloudSaveTimer = null;
let applyingRemoteState = false;
let selectedMobileDay = getTodayDayId();
let selectedCoachPage = "schedule";
let manualCourseSlotKey = null;

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  roleView: document.querySelector("#roleView"),
  studentView: document.querySelector("#studentView"),
  studentCard: document.querySelector(".student-card"),
  pinView: document.querySelector("#pinView"),
  coachView: document.querySelector("#coachView"),
  coachActions: document.querySelector(".coach-actions"),
  studentMoreActions: document.querySelector("#studentMoreActions"),
  roleStudent: document.querySelector("#roleStudent"),
  roleCoach: document.querySelector("#roleCoach"),
  prevWeek: document.querySelector("#prevWeek"),
  nextWeek: document.querySelector("#nextWeek"),
  thisWeek: document.querySelector("#thisWeek"),
  currentWeekLabel: document.querySelector("#currentWeekLabel"),
  studentWeekLabel: document.querySelector("#studentWeekLabel"),
  studentWeekContext: document.querySelector("#studentWeekContext"),
  studentHomeWeek: document.querySelector("#studentHomeWeek"),
  studentName: document.querySelector("#studentName"),
  studentCode: document.querySelector("#studentCode"),
  routineOne: document.querySelector("#routineOne"),
  routineTwo: document.querySelector("#routineTwo"),
  routineGoalOne: document.querySelector("#routineGoalOne"),
  routineGoalTwo: document.querySelector("#routineGoalTwo"),
  addRoutineSlot: document.querySelector("#addRoutineSlot"),
  sessionCount: document.querySelector("#sessionCount"),
  sessionCountOptions: document.querySelector("#sessionCountOptions"),
  sessionGoals: document.querySelector("#sessionGoals"),
  availabilityGrid: document.querySelector("#availabilityGrid"),
  studentNotes: document.querySelector("#studentNotes"),
  studentMessage: document.querySelector("#studentMessage"),
  studentProgressCard: document.querySelector("#studentProgressCard"),
  studentStepTabs: document.querySelector("#studentStepTabs"),
  studentPrev: document.querySelector("#studentPrev"),
  studentNext: document.querySelector("#studentNext"),
  defaultPanel: document.querySelector("#defaultPanel"),
  defaultSummary: document.querySelector("#defaultSummary"),
  routineSetupPanel: document.querySelector("#routineSetupPanel"),
  routineSetupTitle: document.querySelector("#routineSetupTitle"),
  routineSetupCopy: document.querySelector("#routineSetupCopy"),
  weeklyQuickActions: document.querySelector("#weeklyQuickActions"),
  saveDefaultRoutine: document.querySelector("#saveDefaultRoutine"),
  editDefaultRoutine: document.querySelector("#editDefaultRoutine"),
  customizeWeek: document.querySelector("#customizeWeek"),
  submitRequest: document.querySelector("#submitRequest"),
  myScheduleTitle: document.querySelector("#myScheduleTitle"),
  mySchedule: document.querySelector("#mySchedule"),
  coachPin: document.querySelector("#coachPin"),
  pinMessage: document.querySelector("#pinMessage"),
  unlockCoach: document.querySelector("#unlockCoach"),
  coachScheduleTab: document.querySelector("#coachScheduleTab"),
  coachWorkbenchTab: document.querySelector("#coachWorkbenchTab"),
  coachPeopleTab: document.querySelector("#coachPeopleTab"),
  coachSchedulePage: document.querySelector("#coachSchedulePage"),
  coachWorkbenchPage: document.querySelector("#coachWorkbenchPage"),
  coachPeoplePage: document.querySelector("#coachPeoplePage"),
  coachPinPage: document.querySelector("#coachPinPage"),
  pinManagerAction: document.querySelector("#pinManagerAction"),
  backToPeopleFromPin: document.querySelector("#backToPeopleFromPin"),
  coachScheduleTitle: document.querySelector("#coachScheduleTitle"),
  coachWeekContext: document.querySelector("#coachWeekContext"),
  coachScheduleOverview: document.querySelector("#coachScheduleOverview"),
  exportCalendar: document.querySelector("#exportCalendar"),
  newCoachPin: document.querySelector("#newCoachPin"),
  saveCoachPin: document.querySelector("#saveCoachPin"),
  coachPinMessage: document.querySelector("#coachPinMessage"),
  publishSchedule: document.querySelector("#publishSchedule"),
  requestCount: document.querySelector("#requestCount"),
  mobileDayTabs: document.querySelector("#mobileDayTabs"),
  mobileCoachDay: document.querySelector("#mobileCoachDay"),
  mobileUnassignedPool: document.querySelector("#mobileUnassignedPool"),
  mobileUnassignedCount: document.querySelector("#mobileUnassignedCount"),
  mobileCoachIssues: document.querySelector("#mobileCoachIssues"),
  mobileIssueCount: document.querySelector("#mobileIssueCount"),
  studentSummary: document.querySelector("#studentSummary"),
  locationRow: document.querySelector("#locationRow"),
  coachCalendar: document.querySelector("#coachCalendar"),
  clearDraftSchedule: document.querySelector("#clearDraftSchedule"),
  unassignedPool: document.querySelector("#unassignedPool"),
  issueTitle: document.querySelector("#issueTitle"),
  issueState: document.querySelector("#issueState"),
  issueText: document.querySelector("#issueText"),
  issueRecommendation: document.querySelector("#issueRecommendation"),
  detailPanel: document.querySelector(".detail-panel"),
  applyRecommendation: document.querySelector("#applyRecommendation"),
  requestPreview: document.querySelector("#requestPreview"),
  manualCourseModal: document.querySelector("#manualCourseModal"),
  manualCourseTitle: document.querySelector("#manualCourseTitle"),
  manualCourseName: document.querySelector("#manualCourseName"),
  manualCourseGoal: document.querySelector("#manualCourseGoal"),
  manualCourseLocation: document.querySelector("#manualCourseLocation"),
  manualCourseMessage: document.querySelector("#manualCourseMessage"),
  cancelManualCourse: document.querySelector("#cancelManualCourse"),
  saveManualCourse: document.querySelector("#saveManualCourse"),
};

bootApp();

function bootApp() {
  try {
    init();
  } catch (error) {
    console.error(error);
    safeLocalStorageRemove(STORAGE_KEY);
    state = normalizeState({});
    try {
      init();
      setSyncStatus("本地草稿已自动修复", "local");
    } catch (retryError) {
      console.error(retryError);
      const status = document.querySelector("#syncStatus");
      if (status) {
        status.textContent = "本地数据需要刷新一下；如果页面不动，请重新打开。";
        status.title = String(retryError?.message || retryError);
        status.className = "sync-status error";
      }
    }
  }
}

function init() {
  syncWeekPointers();
  bindEvents();
  fillSelects();
  renderWeekLabels();
  renderSessionGoals();
  renderAvailability();
  renderDefaultSummary();
  renderStudentSteps();
  renderMySchedule();
  initCloudStore();
}

function bindEvents() {
  on(els.prevWeek, "click", () => changeWeek(-1));
  on(els.nextWeek, "click", () => changeWeek(1));
  on(els.thisWeek, "click", () => setWeekKey(getDefaultWeekKey()));
  on(els.unlockCoach, "click", unlockCoach);
  on(els.coachScheduleTab, "click", () => setCoachPage("schedule"));
  on(els.coachWorkbenchTab, "click", () => setCoachPage("workbench"));
  on(els.coachPeopleTab, "click", () => setCoachPage("people"));
  on(els.sessionCountOptions, "click", handleSessionCountClick);
  on(els.sessionCountOptions, "change", handleSessionCountClick);
  on(els.studentPrev, "click", handleStudentBack);
  on(els.studentNext, "click", () => setStudentStep(currentStudentStep + 1));
  on(els.saveDefaultRoutine, "click", saveDefaultRoutine);
  on(els.addRoutineSlot, "click", showNextRoutineRow);
  on(els.editDefaultRoutine, "click", () => {
    closeActionMenus();
    openDefaultRoutineEditor();
  });
  on(els.customizeWeek, "click", () => {
    closeActionMenus();
    startWeeklyEdit();
  });
  on(els.submitRequest, "click", submitStudentRequest);
  on(els.studentName, "input", () => {
    loadRoutineForName();
    renderDefaultSummary();
    renderMySchedule();
  });
  on(els.studentCode, "input", () => {
    loadRoutineForName();
    renderDefaultSummary();
    renderMySchedule();
  });
  if (els.studentSummary) {
    els.studentSummary.addEventListener("click", handleStudentSummaryClick, true);
  }
  on(els.exportCalendar, "click", () => runCoachAction(exportCalendar));
  on(els.clearDraftSchedule, "click", clearDraftSchedule);
  on(els.pinManagerAction, "click", () => {
    closeCoachActions();
    setCoachPage("pin");
  });
  on(els.backToPeopleFromPin, "click", () => setCoachPage("people"));
  on(els.saveCoachPin, "click", saveCoachPin);
  on(els.publishSchedule, "click", () => runCoachAction(publishSchedule));
  on(els.applyRecommendation, "click", applyRecommendation);
  on(els.cancelManualCourse, "click", closeManualCourseModal);
  on(els.saveManualCourse, "click", saveManualCourse);
  on(els.manualCourseModal, "click", (event) => {
    if (event.target === els.manualCourseModal) closeManualCourseModal();
  });
  document.addEventListener("click", handleManualAddClick, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.manualCourseModal && !els.manualCourseModal.hidden) closeManualCourseModal();
  });
  setupCoachActionMenu();
}

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function setupCoachActionMenu() {
  const actionMenus = [els.coachActions, els.studentMoreActions].filter(Boolean);
  if (!actionMenus.length) return;

  const closeOutsideMenus = (target) => {
    actionMenus.forEach((menu) => {
      if (!menu.open || menu.contains(target)) return;
      menu.open = false;
    });
  };

  document.addEventListener("pointerdown", (event) => {
    closeOutsideMenus(event.target);
  });

  document.addEventListener("focusin", (event) => {
    closeOutsideMenus(event.target);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeActionMenus();
  });

  actionMenus.forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      actionMenus.forEach((otherMenu) => {
        if (otherMenu !== menu) otherMenu.open = false;
      });
    });

    menu.addEventListener("click", (event) => {
      if (event.target.closest("summary")) return;
      if (!event.target.closest("button, a")) return;
      window.setTimeout(() => {
        menu.open = false;
      }, 0);
    });
  });
}

function closeCoachActions() {
  if (els.coachActions) els.coachActions.open = false;
}

function handleManualAddClick(event) {
  const button = event.target.closest("[data-manual-add], [data-mobile-manual-add]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const slotKey = button.dataset.manualAdd || button.dataset.mobileManualAdd;
  if (slotKey) openManualCoursePrompt(slotKey);
}

function runCoachAction(action) {
  closeCoachActions();
  action();
}

function getCoachPin() {
  return state.settings?.coachPin || DEFAULT_COACH_PIN;
}

function isValidCoachPin(pin) {
  return pin === getCoachPin() || pin === DEFAULT_COACH_PIN;
}

function saveCoachPin() {
  const nextPin = els.newCoachPin.value.trim();
  if (nextPin.length < 4) {
    els.coachPinMessage.textContent = "至少 4 位，方便记也更安全。";
    return;
  }
  state.settings = { ...(state.settings || {}), coachPin: nextPin };
  els.newCoachPin.value = "";
  els.coachPinMessage.textContent = "新 PIN 已保存。";
  saveState();
}

function fillSelects() {
  const slotOptions = [`<option value="">不设置</option>`].concat(
    allSlotKeys().map((slotKey) => `<option value="${slotKey}">${formatSlotLabel(slotKey)}</option>`),
  ).join("");
  document.querySelectorAll(".routine-slot-select").forEach((select) => {
    select.innerHTML = slotOptions;
  });
  const goalOptions = GOALS.map((goal) => `<option value="${goal}">${goal}</option>`).join("");
  document.querySelectorAll(".routine-goal-select").forEach((select) => {
    select.innerHTML = goalOptions;
  });
  renderRoutineRows(1);
}

function handleSessionCountClick(event) {
  if (event.currentTarget?.tagName === "SELECT") {
    els.sessionCount.value = event.currentTarget.value;
    renderSessionCountOptions();
    renderSessionGoals();
    trimPreferredAvailability();
    renderAvailability();
    return;
  }
  const button = event.target.closest("[data-session-count]");
  if (!button) return;
  els.sessionCount.value = button.dataset.sessionCount;
  renderSessionCountOptions();
  renderSessionGoals();
  trimPreferredAvailability();
  renderAvailability();
}

function renderSessionCountOptions() {
  if (els.sessionCountOptions?.tagName === "SELECT") {
    els.sessionCountOptions.value = String(els.sessionCount.value || 1);
    return;
  }
  els.sessionCountOptions.querySelectorAll("[data-session-count]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sessionCount === String(els.sessionCount.value));
  });
}

function showView(name) {
  navigateView(name);
}

function setCoachPage(page) {
  if (!["schedule", "workbench", "people", "pin"].includes(page)) page = "schedule";
  selectedCoachPage = page;
  els.coachScheduleTab.classList.toggle("active", page === "schedule");
  els.coachWorkbenchTab.classList.toggle("active", page === "workbench");
  els.coachPeopleTab.classList.toggle("active", page === "people");
  els.coachSchedulePage.classList.toggle("active", page === "schedule");
  els.coachWorkbenchPage.classList.toggle("active", page === "workbench");
  els.coachPeoplePage.classList.toggle("active", page === "people");
  if (els.coachPinPage) els.coachPinPage.classList.toggle("active", page === "pin");
}

function changeWeek(offset) {
  const current = parseDateKey(state.currentWeekKey);
  current.setDate(current.getDate() + offset * 7);
  setWeekKey(formatDateForFile(current));
}

function setWeekKey(weekKey) {
  persistCurrentWeekRefs();
  state.currentWeekKey = weekKey;
  syncWeekPointers();
  resetStudentWeekFlow();
  selectedAvailability = new Set();
  selectedPreferredAvailability = new Set();
  selectedGoals = new Set([FLEX_GOAL]);
  fillSelects();
  loadRoutineForName();
  renderWeekLabels();
  renderSessionGoals();
  renderAvailability();
  renderDefaultSummary();
  renderStudentSteps();
  renderMySchedule();
  if (els.coachView.classList.contains("active")) renderCoach();
  saveState();
}

function resetStudentWeekFlow() {
  lastSubmittedRequest = null;
  weeklyEditMode = false;
  currentStudentStep = 0;
  if (els.studentNotes) els.studentNotes.value = "";
  if (els.studentMessage) els.studentMessage.textContent = "";
}

function syncWeekPointers() {
  if (!state.currentWeekKey) state.currentWeekKey = getDefaultWeekKey();
  if (!isPlainObject(state.weeks)) state.weeks = {};
  const week = ensureWeek(state.currentWeekKey);
  state.requests = week.requests;
  state.draft = week.draft;
  state.published = week.published;
}

function ensureWeek(weekKey) {
  const key = weekKey || formatDateForFile(getWeekStart(new Date()));
  if (!state.currentWeekKey) state.currentWeekKey = key;
  if (!isPlainObject(state.weeks)) state.weeks = {};
  if (!state.weeks[key]) state.weeks[key] = createEmptyWeek();
  state.weeks[key] = normalizeWeek(state.weeks[key]);
  return state.weeks[key];
}

function createEmptyWeek() {
  return {
    requests: [],
    draft: { assignments: [], unassigned: [], dayLocations: {}, issues: [] },
    published: [],
  };
}

function normalizeWeek(week = {}) {
  const empty = createEmptyWeek();
  if (!isPlainObject(week)) return empty;
  return {
    requests: Array.isArray(week.requests) ? week.requests : empty.requests,
    draft: {
      assignments: Array.isArray(week.draft?.assignments) ? week.draft.assignments : empty.draft.assignments,
      unassigned: Array.isArray(week.draft?.unassigned) ? week.draft.unassigned : empty.draft.unassigned,
      dayLocations: week.draft?.dayLocations && typeof week.draft.dayLocations === "object" ? week.draft.dayLocations : empty.draft.dayLocations,
      issues: Array.isArray(week.draft?.issues) ? week.draft.issues : empty.draft.issues,
    },
    published: Array.isArray(week.published) ? week.published : empty.published,
  };
}

function renderWeekLabels() {
  const label = getWeekRangeLabel();
  if (els.currentWeekLabel) els.currentWeekLabel.textContent = label;
  if (els.studentWeekLabel) els.studentWeekLabel.textContent = label;
  if (els.myScheduleTitle) els.myScheduleTitle.textContent = "本周";
  if (els.studentHomeWeek) els.studentHomeWeek.textContent = getWeekRangeChineseLabel();
  if (els.studentWeekContext) {
    els.studentWeekContext.innerHTML = `
      <strong>${label}</strong>
      <span>特殊情况调整其他周时，可以用上方左右箭头切换日期。</span>
    `;
  }
  if (els.coachWeekContext) {
    els.coachWeekContext.textContent = label;
  }
  const exportLabel = els.exportCalendar?.querySelector("strong");
  if (exportLabel) exportLabel.textContent = "导出日历";
}

function renderStudentSteps() {
  if (!els.studentStepTabs) return;
  if (els.studentCard) {
    els.studentCard.dataset.studentStep = String(currentStudentStep);
    els.studentCard.classList.toggle("has-submitted-request", Boolean(lastSubmittedRequest));
  }
  document.body.dataset.studentStep = String(currentStudentStep);
  const notesField = els.studentNotes?.closest(".field");
  if (notesField) notesField.style.display = lastSubmittedRequest ? "none" : "";
  if (lastSubmittedRequest && els.studentMessage) els.studentMessage.textContent = "";
  const inDetailedFlow = currentStudentStep >= 3 && !lastSubmittedRequest;
  if (els.studentProgressCard) {
    const label = STUDENT_STEPS[currentStudentStep];
    els.studentProgressCard.style.display = "none";
    if (inDetailedFlow) {
      els.studentProgressCard.innerHTML = `
        <span>特殊情况调整 ${currentStudentStep - 2}/4</span>
        <strong>${label}</strong>
      `;
    }
  }
  els.studentStepTabs.style.display = "none";
  els.studentStepTabs.innerHTML = "";
  document.querySelectorAll(".student-step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === currentStudentStep);
  });
  els.studentPrev.style.display = currentStudentStep <= 1 || lastSubmittedRequest ? "none" : "";
  els.studentPrev.textContent = currentStudentStep === 2 || currentStudentStep === 3 ? "返回我的训练" : "上一步";
  els.studentNext.style.display = currentStudentStep === 1 || currentStudentStep === 2 || currentStudentStep === STUDENT_STEPS.length - 1 || lastSubmittedRequest ? "none" : "";
  els.saveDefaultRoutine.style.display = currentStudentStep === 2 && !lastSubmittedRequest ? "" : "none";
  els.submitRequest.style.display = currentStudentStep === STUDENT_STEPS.length - 1 && !lastSubmittedRequest ? "" : "none";
  renderRequestPreview();
}

function getStudentStepHelper(step) {
  if (step === 1) return "看已发布课程和常用安排；照常不用操作。";
  if (step === 2) return "设置一次后，照常的周不用再提交。";
  if (step === 3) return "先选择次数和训练重点。";
  if (step === 4) return "多点几个可选时间；优先时间最多和上课次数一样多。";
  if (step === 5) return "地点是偏好，不是最终确认地点。";
  if (step === 6) return "确认无误后提交给 Dora。";
  return "先输入名字和识别码。";
}

function setStudentStep(step) {
  if (step > currentStudentStep && !canLeaveStudentStep(currentStudentStep)) return;
  currentStudentStep = Math.max(0, Math.min(STUDENT_STEPS.length - 1, step));
  els.studentMessage.textContent = "";
  renderStudentSteps();
}

function handleStudentBack() {
  if (currentStudentStep === 2 || currentStudentStep === 3) {
    setStudentStep(1);
    return;
  }
  setStudentStep(currentStudentStep - 1);
}

function startWeeklyEdit() {
  if (!els.studentName.value.trim()) {
    els.studentMessage.textContent = "先填名字或昵称。";
    return;
  }
  weeklyEditMode = true;
  lastSubmittedRequest = null;
  setStudentStep(3);
}

function openDefaultRoutineEditor() {
  if (!els.studentName.value.trim()) {
    els.studentMessage.textContent = "先填名字或昵称。";
    return;
  }
  loadRoutineForName();
  lastSubmittedRequest = null;
  setStudentStep(2);
}

function getRoutineRows() {
  return [...document.querySelectorAll(".routine-item")];
}

function renderRoutineRows(visibleCount = 1) {
  const rows = getRoutineRows();
  const safeCount = Math.max(1, Math.min(rows.length, visibleCount));
  rows.forEach((row, index) => {
    row.classList.toggle("is-hidden", index >= safeCount);
  });
  if (els.addRoutineSlot) {
    els.addRoutineSlot.style.display = safeCount >= rows.length ? "none" : "";
  }
}

function showNextRoutineRow() {
  const rows = getRoutineRows();
  const visibleCount = rows.filter((row) => !row.classList.contains("is-hidden")).length;
  renderRoutineRows(visibleCount + 1);
}

function canLeaveStudentStep(step) {
  if (step === 0 && !els.studentName.value.trim()) {
    els.studentMessage.textContent = "先填名字或昵称。";
    return false;
  }
  if (step === 0 && !isValidStudentPin(els.studentCode.value)) {
    els.studentMessage.textContent = "请填写 4 位数字 PIN。以后就算名字改了，也能用 PIN 找到你的安排。";
    return false;
  }
  if (step === 0 && !confirmStudentPinOwner()) {
    return false;
  }
  if (step === 4 && !selectedAvailability.size) {
    els.studentMessage.textContent = "至少点选一个你有空的时间。";
    return false;
  }
  if (step === 5 && !document.querySelectorAll('input[name="location"]:checked').length) {
    els.studentMessage.textContent = "至少选择一个地点偏好。";
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
    const [{ initializeApp }, firestore, auth] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
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
    if (config.authMode === "anonymous") {
      const { getAuth, signInAnonymously } = auth;
      await signInAnonymously(getAuth(app));
    }
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
  const localWeekKey = state.currentWeekKey;
  const nextState = normalizeState(mergeDeletedStudentProfiles(remoteState, state));
  nextState.currentWeekKey = localWeekKey || nextState.currentWeekKey;
  if (!isPlainObject(nextState.weeks)) nextState.weeks = {};
  if (!nextState.weeks[nextState.currentWeekKey]) nextState.weeks[nextState.currentWeekKey] = createEmptyWeek();
  nextState.weeks[nextState.currentWeekKey] = normalizeWeek(nextState.weeks[nextState.currentWeekKey]);
  if (JSON.stringify(nextState) === JSON.stringify(state)) return;
  applyingRemoteState = true;
  state = nextState;
  syncWeekPointers();
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
  applyingRemoteState = false;
  loadRoutineForName();
  renderDefaultSummary();
  renderMySchedule();
  if (els.coachView.classList.contains("active")) renderCoach();
  setSyncStatus("云端同步中", "cloud");
}

function renderSessionGoals() {
  const count = Math.max(1, Math.min(6, Number(els.sessionCount.value || 1)));
  trimGoalSelection(count);
  renderSessionCountOptions();
  els.sessionGoals.innerHTML = `
    <div class="goal-picker-copy">
      <strong>想练什么</strong>
      <span>最多选 ${count} 个；顺序可以交给 Dora。</span>
    </div>
    <div class="goal-options">
      ${GOALS.map((goal) => `
        <button class="${selectedGoals.has(goal) ? "selected" : ""}" type="button" data-goal="${goal}">
          ${goal}
        </button>
      `).join("")}
    </div>
  `;
  els.sessionGoals.querySelectorAll("[data-goal]").forEach((button) => {
    button.addEventListener("click", () => toggleGoal(button.dataset.goal));
  });
}

function toggleGoal(goal) {
  const count = Math.max(1, Math.min(6, Number(els.sessionCount.value || 1)));
  if (goal === FLEX_GOAL) {
    selectedGoals = new Set([FLEX_GOAL]);
  } else {
    selectedGoals.delete(FLEX_GOAL);
    if (selectedGoals.has(goal)) selectedGoals.delete(goal);
    else if (selectedGoals.size < count) selectedGoals.add(goal);
    if (!selectedGoals.size) selectedGoals.add(FLEX_GOAL);
  }
  renderSessionGoals();
}

function trimGoalSelection(count) {
  const goals = [...selectedGoals].map(normalizeGoal);
  if (goals.includes(FLEX_GOAL)) {
    selectedGoals = new Set([FLEX_GOAL]);
    return;
  }
  selectedGoals = new Set(goals.slice(0, count));
  if (!selectedGoals.size) selectedGoals.add(FLEX_GOAL);
}

function renderAvailability() {
  trimPreferredAvailability();
  const preferredLimit = getPreferredAvailabilityLimit();
  els.availabilityGrid.innerHTML = `
    ${DAYS.map((day, dayIndex) => `
      <section class="availability-day">
        <header>
          <strong>${day.label}</strong>
          <span>${formatMonthDay(getDayDate(dayIndex))}</span>
        </header>
        <div class="availability-slots">
          ${SLOTS.map((slot) => {
        const key = `${day.id}-${slot.id}`;
        const selected = selectedAvailability.has(key);
        const preferred = selectedPreferredAvailability.has(key);
        return `<div class="slot-toggle ${selected ? "selected" : ""} ${preferred ? "preferred" : ""}" data-availability="${key}" role="button" tabindex="0">
          <button class="slot-priority-toggle" type="button" data-preferred-availability="${key}" aria-pressed="${preferred}" aria-label="${preferred ? "取消优先" : "标为优先"}">${preferred ? "优先" : "设优先"}</button>
          <small>${day.label} ${formatMonthDay(getDayDate(dayIndex))}</small>
          <strong>${slot.label}</strong>
          <span>${slot.detail}</span>
          <em>${preferred ? "优先" : selected ? "可用" : "可选"}</em>
        </div>`;
      }).join("")}
        </div>
      </section>
    `).join("")}
    <div class="availability-helper">已标 ${selectedPreferredAvailability.size}/${preferredLimit} 个优先；先点时间选可用，再点右上角设优先。</div>
  `;

  els.availabilityGrid.querySelectorAll("[data-preferred-availability]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePreferredAvailability(button.dataset.preferredAvailability);
      renderAvailability();
    });
  });
  els.availabilityGrid.querySelectorAll("[data-availability]").forEach((card) => {
    card.addEventListener("click", () => {
      toggleAvailability(card.dataset.availability);
      renderAvailability();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleAvailability(card.dataset.availability);
      renderAvailability();
    });
  });
}

function toggleAvailability(key) {
  if (!key) return;
  if (els.studentMessage) els.studentMessage.textContent = "";
  if (selectedAvailability.has(key)) {
    selectedAvailability.delete(key);
    selectedPreferredAvailability.delete(key);
    return;
  }
  selectedAvailability.add(key);
}

function togglePreferredAvailability(key) {
  if (!key) return;
  const preferredLimit = getPreferredAvailabilityLimit();
  if (els.studentMessage) els.studentMessage.textContent = "";
  if (!selectedAvailability.has(key)) {
    selectedAvailability.add(key);
  }
  if (!selectedPreferredAvailability.has(key)) {
    if (selectedPreferredAvailability.size < preferredLimit) selectedPreferredAvailability.add(key);
    else if (els.studentMessage) els.studentMessage.textContent = `最多标 ${preferredLimit} 个优先时间。`;
    return;
  }
  selectedPreferredAvailability.delete(key);
}

function getPreferredAvailabilityLimit() {
  return Math.max(1, Math.min(6, Number(els.sessionCount.value || 1)));
}

function trimPreferredAvailability() {
  const preferredLimit = getPreferredAvailabilityLimit();
  selectedPreferredAvailability = new Set([...selectedPreferredAvailability]
    .filter((slotKey) => selectedAvailability.has(slotKey))
    .slice(0, preferredLimit));
}

function submitStudentRequest() {
  let name = els.studentName.value.trim();
  const code = normalizeStudentPin(els.studentCode.value);
  if (!name) {
    setStudentStep(0);
    els.studentMessage.textContent = "先填名字或昵称。";
    return;
  }
  if (!isValidStudentPin(code)) {
    setStudentStep(0);
    els.studentMessage.textContent = "请填写 4 位数字 PIN。Dora 会用它确认这是你的申请。";
    return;
  }
  if (!confirmStudentPinOwner(name, code)) {
    setStudentStep(0);
    return;
  }
  name = els.studentName.value.trim();
  if (!selectedAvailability.size) {
    setStudentStep(4);
    els.studentMessage.textContent = "至少点选一个你有空的时间。";
    return;
  }

  const locations = [...document.querySelectorAll('input[name="location"]:checked')].map((input) => input.value);
  if (!locations.length) {
    setStudentStep(5);
    els.studentMessage.textContent = "至少选择一个地点偏好。";
    return;
  }

  const desiredCount = Math.max(1, Math.min(6, Number(els.sessionCount.value || 1)));
  const preferredAvailability = [...selectedPreferredAvailability]
    .filter((slotKey) => selectedAvailability.has(slotKey))
    .slice(0, desiredCount);

  const request = {
    id: makeId(),
    name,
    code,
    desiredCount,
    goals: buildGoalsForCount(desiredCount),
    goalPreferences: [...selectedGoals],
    locations,
    availability: [...selectedAvailability],
    preferredAvailability,
    notes: els.studentNotes.value.trim(),
    routine: [],
    submittedAt: new Date().toISOString(),
  };

  state.requests = dedupeRequestsByPin(state.requests.filter((item) => normalizeStudentPin(getStudentIdentity(item).code) !== request.code));
  state.requests.push(request);
  syncRequestIntoDraft(request);
  saveState();
  lastSubmittedRequest = request;
  weeklyEditMode = true;
  currentStudentStep = STUDENT_STEPS.length - 1;
  renderStudentSteps();
  renderDefaultSummary();
  els.studentMessage.textContent = "";
  renderMySchedule();
  focusStudentSubmission();
}

function saveRoutine(name, request) {
  const code = normalizeStudentPin(request.code || els.studentCode.value);
  const key = getRoutineKey(name, code);
  removeRoutineByPin(code);
  state.routines[key] = {
    studentName: name,
    code,
    routine: request.routine,
    locations: request.locations,
    goals: request.goals,
    goalPreferences: (request.goalPreferences || request.goals || [FLEX_GOAL]).map(normalizeGoal),
  };
}

function getSavedRoutine() {
  const name = els.studentName.value.trim();
  const code = normalizeStudentPin(els.studentCode.value);
  if (code) {
    const byPin = Object.entries(state.routines || {}).find(([key, routine]) => {
      const routineCode = routine?.code || String(key).split("::")[1] || "";
      return normalizeStudentPin(routineCode) === code;
    });
    if (byPin) return byPin[1];
  }
  return state.routines[getRoutineKey(name, code)] || state.routines[name] || null;
}

function getRoutineKey(name, code) {
  const cleanName = (name || "").trim();
  const cleanCode = (code || "").trim();
  return cleanCode ? `${cleanName}::${cleanCode}` : cleanName;
}

function getNameFromRoutineKey(key, routine) {
  return routine?.studentName || String(key).split("::")[0];
}

function hasUsableRoutine(routine) {
  return Boolean(routine?.routine?.length && routine?.locations?.length);
}

function renderDefaultSummary() {
  if (!els.defaultSummary) return;
  const name = els.studentName.value.trim();
  if (!name) {
    els.defaultPanel.classList.remove("first-time", "ready");
    els.defaultSummary.innerHTML = "";
    els.weeklyQuickActions.style.display = "none";
    els.editDefaultRoutine.textContent = "设置常用安排";
    els.customizeWeek.textContent = "特殊情况调整";
    return;
  }
  const routine = getSavedRoutine();
  if (!hasUsableRoutine(routine)) {
    els.defaultPanel.classList.add("first-time");
    els.defaultPanel.classList.remove("ready");
    els.defaultSummary.innerHTML = "";
    els.routineSetupTitle.textContent = "常用安排";
    if (els.routineSetupCopy) els.routineSetupCopy.textContent = "选平常最常上的时间、训练内容和地点。保存后会长期有效。";
    els.weeklyQuickActions.style.display = "";
    els.editDefaultRoutine.textContent = "设置常用安排";
    els.customizeWeek.textContent = "特殊情况调整";
    return;
  }
  els.defaultPanel.classList.remove("first-time");
  els.defaultPanel.classList.add("ready");
  els.defaultSummary.innerHTML = "";
  els.routineSetupTitle.textContent = "常用安排";
  if (els.routineSetupCopy) els.routineSetupCopy.textContent = "这里改的是以后常用的时间、内容和地点。";
  els.weeklyQuickActions.style.display = "";
  els.editDefaultRoutine.textContent = "修改常用安排";
  els.customizeWeek.textContent = "特殊情况调整";
}

function saveDefaultRoutine() {
  let name = els.studentName.value.trim();
  const code = normalizeStudentPin(els.studentCode.value);
  if (!name) {
    els.studentMessage.textContent = "先填名字或昵称。";
    return;
  }
  if (!isValidStudentPin(code)) {
    setStudentStep(0);
    els.studentMessage.textContent = "请填写 4 位数字 PIN。Dora 会用它确认这是你的常用安排。";
    return;
  }
  if (!confirmStudentPinOwner(name, code)) {
    return;
  }
  name = els.studentName.value.trim();
  const routine = getRoutineRows()
    .filter((row) => !row.classList.contains("is-hidden"))
    .map((row) => ({
      slotKey: row.querySelector(".routine-slot-select")?.value || "",
      goal: row.querySelector(".routine-goal-select")?.value || FLEX_GOAL,
    }))
    .filter((item) => item.slotKey);
  const locations = getRoutineLocations();
  if (!routine.length) {
    els.studentMessage.textContent = "至少选择一个常用时间。";
    return;
  }
  if (!locations.length) {
    els.studentMessage.textContent = "至少选择一个地点偏好。";
    return;
  }
  const requestLike = {
    code,
    routine,
    locations,
    goals: routine.map((item) => normalizeGoal(item.goal)),
    goalPreferences: routine.map((item) => normalizeGoal(item.goal)),
  };
  saveRoutine(name, requestLike);
  applyRoutineToWeeklyForm(getSavedRoutine());
  saveState();
  setStudentStep(1);
  renderDefaultSummary();
  renderMySchedule();
  els.studentMessage.textContent = "常用安排已保存。照常的周不用提交，Dora 排课时会自动看到。";
}

function loadRoutineForName() {
  const routine = getSavedRoutine();
  getRoutineRows().forEach((row) => {
    const slotSelect = row.querySelector(".routine-slot-select");
    const goalSelect = row.querySelector(".routine-goal-select");
    if (slotSelect) slotSelect.value = "";
    if (goalSelect) goalSelect.value = FLEX_GOAL;
  });
  if (!routine) {
    renderRoutineRows(1);
    return;
  }
  const routineItems = Array.isArray(routine.routine) ? routine.routine : [];
  renderRoutineRows(routineItems.length || 1);
  getRoutineRows().forEach((row, index) => {
    const item = routineItems[index];
    const slotSelect = row.querySelector(".routine-slot-select");
    const goalSelect = row.querySelector(".routine-goal-select");
    if (slotSelect) slotSelect.value = item?.slotKey || "";
    if (goalSelect) goalSelect.value = normalizeGoal(item?.goal);
  });
  applyRoutineToWeeklyForm(routine);
}

function applyRoutineToWeeklyForm(routine) {
  document.querySelectorAll('input[name="location"], input[name="routineLocation"]').forEach((input) => {
    input.checked = routine.locations?.includes(input.value) || false;
  });
  if (routine.routine?.length) {
    els.sessionCount.value = routine.routine.length;
    selectedGoals = new Set((routine.goalPreferences || routine.goals || [FLEX_GOAL]).map(normalizeGoal));
    renderSessionGoals();
    selectedAvailability = new Set(routine.routine.map((item) => item.slotKey).filter(Boolean));
    selectedPreferredAvailability = new Set();
    renderAvailability();
  }
}

function buildGoalsForCount(count) {
  const preferences = [...selectedGoals].map(normalizeGoal).filter(Boolean);
  const base = preferences.length ? preferences : [FLEX_GOAL];
  if (base.includes(FLEX_GOAL)) return Array.from({ length: count }, () => FLEX_GOAL);
  return Array.from({ length: count }, (_, index) => base[index] || FLEX_GOAL);
}

function normalizeGoal(goal) {
  return !goal || goal === "教练安排" ? FLEX_GOAL : goal;
}

function renderRequestPreview() {
  if (!els.requestPreview) return;
  const request = lastSubmittedRequest || buildDraftRequestPreview();
  const submitted = Boolean(lastSubmittedRequest);
  const weekLabel = getWeekRangeLabel();
  const timeLine = request.availability.length ? request.availability.map(formatSlot).map(escapeHtml).join(" / ") : "还没选择";
  const preferredLine = request.preferredAvailability?.length ? request.preferredAvailability.map(formatSlot).map(escapeHtml).join(" / ") : "未特别标记";
  const goalLine = request.goals.length ? request.goals.map((goal) => escapeHtml(normalizeGoal(goal))).join(" / ") : "听 Dora 安排";
  const locationLine = request.locations.length ? request.locations.map(escapeHtml).join(" / ") : "还没选择";
  els.requestPreview.innerHTML = `
    <div class="submission-summary ${submitted ? "submitted compact-submission" : ""}">
      ${submitted ? `<div class="success-mark">✓</div>` : ""}
      ${submitted ? `
        <h3>申请已提交</h3>
        <div class="submission-lines">
          <p><b>时间</b><span>${timeLine}</span></p>
          <p><b>优先</b><span>${preferredLine}</span></p>
          <p><b>内容</b><span>${goalLine}</span></p>
          <p><b>地点</b><span>${locationLine}</span></p>
        </div>
        <p class="success-copy">状态：等待 Dora 确认。确认后会显示在「我的训练」。</p>
      ` : `
        <span>提交前确认</span>
        <strong>${escapeHtml(request.name || "还没填名字")} · 想上 ${request.desiredCount} 节</strong>
        <p class="success-copy">确认你正在提交 ${weekLabel} 的申请。</p>
        <p>时间：${timeLine}</p>
        <p>优先：${preferredLine}</p>
        <p>内容：${goalLine}</p>
        <p>地点：${locationLine}</p>
      `}
      ${submitted ? `
        <div class="submission-actions">
          <button class="primary" type="button" data-return-student-home>回到我的训练</button>
          <button class="ghost" type="button" data-edit-submission>返回修改这次申请</button>
        </div>
      ` : ""}
    </div>
  `;
  on(els.requestPreview.querySelector("[data-return-student-home]"), "click", () => {
    lastSubmittedRequest = null;
    weeklyEditMode = false;
    setStudentStep(1);
    renderMySchedule();
    window.requestAnimationFrame(() => {
      els.mySchedule?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
  on(els.requestPreview.querySelector("[data-edit-submission]"), "click", () => {
    lastSubmittedRequest = null;
    weeklyEditMode = true;
    setStudentStep(4);
  });
}

function closeActionMenus() {
  [els.coachActions, els.studentMoreActions].filter(Boolean).forEach((menu) => {
    menu.open = false;
  });
}

function focusStudentSubmission() {
  if (!els.requestPreview) return;
  window.requestAnimationFrame(() => {
    els.requestPreview.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function buildDraftRequestPreview() {
  const desiredCount = Math.max(1, Math.min(6, Number(els.sessionCount.value || 1)));
  return {
    name: els.studentName.value.trim(),
    code: normalizeStudentPin(els.studentCode.value),
    desiredCount,
    goals: buildGoalsForCount(desiredCount),
    locations: [...document.querySelectorAll('input[name="location"]:checked')].map((input) => input.value),
    availability: [...selectedAvailability],
    preferredAvailability: [...selectedPreferredAvailability].filter((slotKey) => selectedAvailability.has(slotKey)).slice(0, desiredCount),
  };
}

function getRoutineLocations() {
  return [...document.querySelectorAll('input[name="routineLocation"]:checked')].map((input) => input.value);
}

function renderMySchedule() {
  const name = els.studentName.value.trim();
  const code = normalizeStudentPin(els.studentCode.value);
  if (!name || !code) {
    els.mySchedule.innerHTML = `<div class="schedule-home-state is-empty">
      <span>先输入名字和 PIN</span>
      <strong>这里会显示你的训练安排</strong>
      <small>PIN 是你的识别码，名字改了也能找回自己的安排。</small>
    </div>`;
    return;
  }
  const assignments = state.published
    .filter((item) => assignmentMatchesStudent(item, name, code))
    .sort((a, b) => getSlotSortIndex(a.slotKey) - getSlotSortIndex(b.slotKey));
  if (assignments.length) {
    els.mySchedule.innerHTML = `
      <div class="schedule-home-note is-confirmed"><span>已确认</span></div>
      <div class="schedule-home-items">
        ${assignments.map((item) => `
          <article class="schedule-card">
            <strong>${formatSlot(item.slotKey)}</strong>
            <span>${item.goal} · ${item.location}</span>
            ${renderClassmatesLine(item, name, code)}
          </article>
        `).join("")}
      </div>
    `;
    return;
  }
  const request = findCurrentStudentRequest(code);
  if (request) {
    els.mySchedule.innerHTML = `
      <div class="schedule-home-note is-routine"><span>特殊申请已提交</span></div>
      <div class="schedule-home-items">
        ${request.availability.map((slotKey, index) => `
          <article class="schedule-card">
            <strong>${formatSlot(slotKey)}${request.preferredAvailability?.includes(slotKey) ? " · 优先" : ""}</strong>
            <span>${normalizeGoal(request.goals?.[index] || request.goals?.[0])} · ${(request.locations || []).join(" / ") || "地点待定"}</span>
          </article>
        `).join("")}
      </div>
      <div class="schedule-home-state">
        <small>这周 Dora 会优先看这份特殊申请；如果要改时间，可以重新提交一次，旧申请会自动替换。</small>
      </div>
    `;
    return;
  }
  const routine = getSavedRoutine();
  if (hasUsableRoutine(routine)) {
    els.mySchedule.innerHTML = `
      <div class="schedule-home-note is-routine"><span>按常用安排</span></div>
      <div class="schedule-home-items">
        ${routine.routine.map((item, index) => `
          <article class="schedule-card">
            <strong>${formatSlotLabel(item.slotKey)}</strong>
            <span>${normalizeGoal(item.goal || routine.goals?.[index])} · ${routine.locations.join(" / ")}</span>
          </article>
        `).join("")}
      </div>
    `;
    return;
  }
  els.mySchedule.innerHTML = `
    <div class="schedule-home-state is-empty">
      <span>还没有常用安排</span>
      <strong>先设置一次常用安排</strong>
      <small>以后照常的周就不用重复提交。</small>
    </div>
  `;
}

function renderClassmatesLine(assignment, name, code) {
  const classmates = state.published
    .filter((item) => item.slotKey === assignment.slotKey)
    .filter((item) => !assignmentMatchesStudent(item, name, code))
    .map((item) => item.name)
    .filter(Boolean);
  if (!classmates.length) return "";
  return `<small class="schedule-classmates">同课：${[...new Set(classmates)].map(escapeHtml).join("、")}</small>`;
}

function assignmentMatchesStudent(assignment, name, code) {
  if (code) {
    const assignmentCode = assignment.code || findEffectiveRequestById(assignment.requestId)?.code || "";
    return normalizeStudentPin(assignmentCode) === normalizeStudentPin(code);
  }
  if (assignment.name !== name) return false;
  const assignmentCode = assignment.code || findEffectiveRequestById(assignment.requestId)?.code || "";
  return assignmentCode === code;
}

function unlockCoach() {
  if (isValidCoachPin(els.coachPin.value)) {
    els.pinMessage.textContent = "";
    showView("coach");
  } else {
    els.pinMessage.textContent = "PIN 不对。如果忘记了，请联系小黄去云端找回。";
  }
}

function seedDemo() {
  const hasCurrentWeekData = state.requests.length || state.draft.assignments.length || state.published.length;
  if (hasCurrentWeekData && !window.confirm(`这会覆盖 ${getWeekRangeLabel()} 的当前测试/草案数据。确定要填入示例吗？`)) {
    return;
  }
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

function generateDraft(options = {}) {
  const shouldRender = options.render !== false;
  const requests = getEffectiveRequests();
  const dayLocations = suggestDayLocations(requests);
  const sessions = expandSessions(requests);
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
        code: session.request.code || "",
        goal: session.goal,
        slotKey: choice,
        location: formatLocation(dayLocations[getDayId(choice)]),
      });
    } else {
      unassigned.push({ ...session, id: makeId() });
    }
  }

  const issues = findIssues(assignments, unassigned, dayLocations);
  state.draft = { assignments, unassigned, dayLocations, issues };
  saveState();
  if (shouldRender) renderCoach();
}

function syncRequestIntoDraft(request) {
  if (!request?.id) return;
  const sameStudent = (item) => matchesStudentIdentity(item, request.name, request.code || "");
  state.draft.assignments = state.draft.assignments.filter((item) => !sameStudent(item));
  state.draft.unassigned = state.draft.unassigned.filter((item) => !sameStudent(item.request || item));

  const suggestions = suggestDayLocations(getEffectiveRequests());
  Object.keys(suggestions).forEach((dayId) => {
    if (!state.draft.dayLocations[dayId]) state.draft.dayLocations[dayId] = suggestions[dayId];
  });

  const sessions = expandSessions([request]);
  for (const session of sessions) {
    const choice = chooseBestSlot(session, state.draft.assignments, state.draft.dayLocations);
    if (choice) {
      state.draft.assignments.push({
        id: makeId(),
        requestId: session.request.id,
        name: session.request.name,
        code: session.request.code || "",
        goal: session.goal,
        slotKey: choice,
        location: formatLocation(state.draft.dayLocations[getDayId(choice)]),
      });
    } else {
      state.draft.unassigned.push({ ...session, id: makeId() });
    }
  }
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
}

function hasDraftContent() {
  return Boolean(
    state.draft.assignments.length ||
    state.draft.unassigned.length ||
    Object.keys(state.draft.dayLocations || {}).length ||
    state.draft.issues.length
  );
}

function ensureCoachDraft() {
  if (state.published.length || hasDraftContent()) return;
  if (!getEffectiveRequests().length) return;
  generateDraft({ render: false });
}

function suggestDayLocations(requests) {
  const result = {};
  for (const day of DAYS) {
    const votes = countLocationVotes(day.id, requests);
    result[day.id] = chooseDayLocation(votes);
  }
  return result;
}

function chooseDayLocation(votes) {
  if (votes.Bisby > votes["235 Grand"]) return "Bisby";
  if (votes["235 Grand"] > votes.Bisby) return "235 Grand";
  return "";
}

function ensureDraftDayLocations() {
  const suggestions = suggestDayLocations(getEffectiveRequests());
  let changed = false;
  for (const day of DAYS) {
    if (!state.draft.dayLocations[day.id]) {
      state.draft.dayLocations[day.id] = suggestions[day.id];
      changed = true;
    }
  }
  return changed;
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
      goal: normalizeGoal(request.goals[index] || request.goals[0]),
    }));
  });
}

function isManualDraftItem(item) {
  const request = item?.request || {};
  const requestId = String(item?.requestId || request.id || "");
  return Boolean(item?.manual || request.source === "manual" || requestId.startsWith("manual-"));
}

function getEffectiveRequests() {
  state.requests = dedupeRequestsByPin(state.requests || []);
  const weeklyByStudent = new Map(state.requests.map((request) => [getStudentRequestIdentityKey(request), request]));
  const defaults = Object.entries(state.routines || {})
    .filter(([key, routine]) => !isDeletedStudentProfile(key, routine))
    .map(([key, routine]) => buildRequestFromRoutine(key, routine))
    .filter(Boolean)
    .filter((request) => !weeklyByStudent.has(getStudentRequestIdentityKey(request)));
  return defaults.concat(state.requests);
}

function buildRequestFromRoutine(key, routine) {
  if (!hasUsableRoutine(routine)) return null;
  const name = getNameFromRoutineKey(key, routine);
  const code = routine.code || String(key).split("::")[1] || "";
  const routineItems = routine.routine.filter((item) => item.slotKey);
  if (!name || !routineItems.length) return null;
  return {
    id: `default-${encodeURIComponent(getRoutineKey(name, code))}`,
    source: "default",
    name,
    code,
    desiredCount: routineItems.length,
    goals: routineItems.map((item, index) => normalizeGoal(item.goal || routine.goals?.[index])),
    goalPreferences: (routine.goalPreferences || routine.goals || [FLEX_GOAL]).map(normalizeGoal),
    locations: routine.locations || [],
    availability: routineItems.map((item) => item.slotKey),
    notes: "常用安排",
    routine: routineItems,
    submittedAt: "",
  };
}

function findEffectiveRequestById(requestId) {
  return getEffectiveRequests().find((request) => request.id === requestId) || null;
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
  if (session.request.preferredAvailability?.includes(slotKey)) score += 4;
  if (!slotAssignments.length) score += 1;
  for (const item of slotAssignments) {
    score += compatibility(session.goal, item.goal);
  }
  return score;
}

function compatibility(a, b) {
  a = normalizeGoal(a);
  b = normalizeGoal(b);
  if (a === FLEX_GOAL || b === FLEX_GOAL) return 0;
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
        title: `${day.label} 地点未定`,
        text: "这一天已经有人上课，Dora 可以在上方下拉菜单里选 235 Grand 或 Bisby。",
        severity: "review",
      });
    }
    if (dayItems.length && location) {
      const outsidePreference = dayItems.filter((item) => {
        const request = findEffectiveRequestById(item.requestId);
        return request && !request.locations.includes(location);
      });
      if (outsidePreference.length) {
        issues.push({
          type: "location-preference",
          dayId: day.id,
          title: `${day.label} 地点需要 Dora 看一下`,
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
  syncWeekPointers();
  ensureCoachDraft();
  const changedLocations = ensureDraftDayLocations();
  if (normalizeDraftUnassigned() || changedLocations) {
    state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
    saveState();
  }
  const effectiveRequests = getEffectiveRequests();
  els.requestCount.textContent = `${effectiveRequests.length} 位学员`;
  setCoachPage(selectedCoachPage);
  renderCoachScheduleOverview();
  renderMobileCoach();
  renderStudentSummary();
  renderLocationRow();
  renderCoachCalendar();
  renderUnassigned();
  renderIssue(state.draft.issues[0] || null, { focus: false });
}

function renderCoachScheduleOverview() {
  const isPublished = state.published.length > 0;
  const assignments = isPublished ? state.published : state.draft.assignments;
  els.coachScheduleTitle.textContent = isPublished ? "已发布安排" : "草案预览";

  if (!assignments.length) {
    els.coachScheduleOverview.innerHTML = `
      <div class="empty">
        还没有安排。可以去「调整排课」把学员放进时间格。
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
  const dayDate = getDayDate(DAYS.findIndex((item) => item.id === day.id));
  return `
    <article class="coach-day-card">
      <header>
        <strong>${day.label} ${formatMonthDay(dayDate)}</strong>
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
  renderMobileUnassigned();
  renderMobileIssues();
  syncMobileCoachCards();
}

function syncMobileCoachCards() {
  const issueCard = document.querySelector(".mobile-issues-card");
  const scheduleCard = document.querySelector(".mobile-schedule-card");
  if (issueCard && scheduleCard) {
    issueCard.open = state.draft.issues.length > 0;
    scheduleCard.open = state.draft.issues.length === 0;
  }
}

function renderMobileDayTabs() {
  if (!els.mobileDayTabs) return;
  els.mobileDayTabs.innerHTML = DAYS.map((day, index) => `
    <button class="${selectedMobileDay === day.id ? "active" : ""}" data-mobile-day="${day.id}">
      ${day.label}<span>${formatMonthDay(getDayDate(index))}</span>
    </button>
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
  const location = state.draft.dayLocations[day.id] || chooseDayLocation(countLocationVotes(day.id, getEffectiveRequests()));
  state.draft.dayLocations[day.id] = location;
  const dayAssignments = state.draft.assignments.filter((item) => getDayId(item.slotKey) === day.id);
  els.mobileCoachDay.innerHTML = `
    <div class="mobile-location">
      <label>
        <span>${day.label} 地点</span>
        <select data-mobile-day-location="${day.id}">
          <option value="" ${location ? "" : "selected"}>Dora 选地点</option>
          ${LOCATIONS.map((item) => `<option value="${item}" ${location === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </label>
      <strong>${location}</strong>
    </div>
    <div class="mobile-slot-list">
      ${SLOTS.map((slot) => renderMobileSlot(`${day.id}-${slot.id}`, dayAssignments)).join("")}
    </div>
  `;

  els.mobileCoachDay.querySelector("[data-mobile-day-location]")?.addEventListener("change", (event) => {
    updateDayLocation(event.target.dataset.mobileDayLocation, event.target.value);
  });

  els.mobileCoachDay.querySelectorAll(".mobile-slot").forEach((slot) => {
    slot.addEventListener("click", (event) => {
      const manualButton = event.target.closest("[data-mobile-manual-add]");
      if (manualButton) {
        event.preventDefault();
        event.stopPropagation();
        openManualCoursePrompt(manualButton.dataset.mobileManualAdd);
        return;
      }
      if (selectedMove) {
        moveSelectedToSlot(slot.dataset.mobileSlot);
        return;
      }
      const issue = state.draft.issues.find((item) => item.slotKey === slot.dataset.mobileSlot);
      renderIssue(issue || null);
    });
  });

  els.mobileCoachDay.querySelectorAll("[data-mobile-remove-assignment]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeAssignment(button.dataset.mobileRemoveAssignment);
    });
  });

  els.mobileCoachDay.querySelectorAll("[data-mobile-assignment-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectMoveSource("assignment", button.dataset.mobileAssignmentId);
    });
  });

  els.mobileCoachDay.querySelectorAll("[data-mobile-assignment-goal]").forEach((select) => {
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", (event) => {
      event.stopPropagation();
      updateAssignmentGoal(select.dataset.mobileAssignmentGoal, select.value);
    });
  });
}

function renderMobileUnassigned() {
  if (!els.mobileUnassignedPool) return;
  if (els.mobileUnassignedCount) els.mobileUnassignedCount.textContent = String(state.draft.unassigned.length);
  if (!state.draft.unassigned.length) {
    els.mobileUnassignedPool.innerHTML = `<div class="empty compact">没有未安排的申请。</div>`;
    return;
  }
  els.mobileUnassignedPool.innerHTML = state.draft.unassigned.map((item) => `
    <button class="${selectedMove?.type === "unassigned" && selectedMove.id === item.id ? "selected" : ""}" type="button" data-mobile-unassigned-id="${item.id}">
      <strong>${item.request.name} · ${item.goal}</strong>
      <span>可选：${item.request.availability.map(formatSlot).join(" / ")}</span>
      ${item.request.notes ? `<em>备注：${escapeHtml(item.request.notes)}</em>` : ""}
    </button>
  `).join("");
  els.mobileUnassignedPool.querySelectorAll("[data-mobile-unassigned-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectMoveSource("unassigned", button.dataset.mobileUnassignedId);
    });
  });
}

function renderMobileSlot(slotKey, dayAssignments) {
  const assignments = dayAssignments.filter((item) => item.slotKey === slotKey);
  const issue = state.draft.issues.find((item) => item.slotKey === slotKey);
  const statusLabel = issue?.severity === "error" ? "需要调整" : issue?.severity === "review" ? "Dora 看一下" : "";
  const canAdd = assignments.length < CAPACITY;
  return `
    <article class="mobile-slot ${issue ? issue.severity : ""}" data-mobile-slot="${slotKey}">
      <div>
        <strong>${formatSlot(slotKey)}</strong>
        ${statusLabel ? `<em class="mobile-status ${issue.severity}">${statusLabel}</em>` : ""}
        <span>${formatLocation(state.draft.dayLocations[getDayId(slotKey)])}</span>
      </div>
      <div class="mobile-people">
        ${assignments.length ? assignments.map((item) => `
          <div class="mobile-assignment-chip ${selectedMove?.type === "assignment" && selectedMove.id === item.id ? "selected" : ""}">
            <button type="button" data-mobile-assignment-id="${item.id}">${item.name}</button>
            <select data-mobile-assignment-goal="${item.id}" aria-label="修改 ${escapeAttribute(item.name)} 的训练内容">
              ${renderGoalOptions(item.goal)}
            </select>
            ${item.manual ? `<button class="remove-assignment" type="button" data-mobile-remove-assignment="${item.id}" aria-label="移除 ${escapeAttribute(item.name)}">×</button>` : ""}
          </div>
        `).join("") : ""}
        ${canAdd ? `<button class="manual-add-chip mobile-manual-add" type="button" data-mobile-manual-add="${slotKey}" aria-label="手动加课 ${escapeAttribute(formatSlot(slotKey))}">+</button>` : ""}
      </div>
    </article>
  `;
}

function renderMobileIssues() {
  if (!els.mobileCoachIssues) return;
  const issues = state.draft.issues.slice(0, 5);
  if (els.mobileIssueCount) els.mobileIssueCount.textContent = String(state.draft.issues.length);
  if (!issues.length) {
    els.mobileCoachIssues.innerHTML = `<div class="empty compact">暂无提醒。</div>`;
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
  const requests = [...getEffectiveRequests()].sort(compareStudentRequests);
  if (!requests.length) {
    els.studentSummary.innerHTML = `<div class="empty">还没有学员设置常用安排。</div>`;
    return;
  }
  els.studentSummary.innerHTML = requests.map((request) => {
    const code = request.code || "";
    const sourceLabel = request.source === "default" ? "常用安排" : "本周临时改";
    const preferenceItems = getPreferenceItems(request);
    return `
      <article class="student-row preference-row">
        <header class="student-row-heading">
          <div>
            <strong>${request.name}</strong>
            <span>${sourceLabel}</span>
          </div>
          <div class="student-code-line">
            <small>PIN：${code || "未填写"}</small>
            ${code ? `<button type="button" data-copy-code="${escapeAttribute(code)}">复制</button>` : ""}
            <button class="danger-lite" type="button" data-delete-student-name="${escapeAttribute(request.name)}" data-delete-student-code="${escapeAttribute(code)}" data-delete-student-id="${escapeAttribute(request.id || "")}">删除</button>
          </div>
        </header>
        <div class="student-preference-stack">
          ${preferenceItems.map((item, index) => `
            <section class="student-preference-card">
              <span>${item.preferred ? "优先" : `偏好 ${index + 1}`}</span>
              <dl>
                <div>
                  <dt>时间 / 地点</dt>
                  <dd>${item.time} · ${item.location}</dd>
                </div>
                <div>
                  <dt>内容</dt>
                  <dd>${item.goal}</dd>
                </div>
              </dl>
            </section>
          `).join("")}
        </div>
        ${request.notes ? `<p class="student-note">备注：${escapeHtml(request.notes)}</p>` : ""}
        <small>目标 ${request.desiredCount} 节</small>
      </article>
    `;
  }).join("");
}

async function handleStudentSummaryClick(event) {
  const deleteButton = event.target.closest("[data-delete-student-name]");
  if (deleteButton && els.studentSummary.contains(deleteButton)) {
    event.preventDefault();
    event.stopPropagation();
    if (deleteButton.dataset.confirmDelete !== "true") {
      armStudentDeleteButton(deleteButton);
      return;
    }
    await confirmDeleteStudent(
      deleteButton.dataset.deleteStudentName || "",
      deleteButton.dataset.deleteStudentCode || "",
      deleteButton.dataset.deleteStudentId || "",
    );
    return;
  }

  const copyButton = event.target.closest("[data-copy-code]");
  if (!copyButton || !els.studentSummary.contains(copyButton)) return;
  event.preventDefault();
  event.stopPropagation();
  const code = copyButton.dataset.copyCode || "";
  try {
    await navigator.clipboard.writeText(code);
    copyButton.textContent = "已复制";
  } catch {
    copyButton.textContent = code;
  }
  window.setTimeout(() => {
    copyButton.textContent = "复制";
  }, 1600);
}

function armStudentDeleteButton(button) {
  button.dataset.confirmDelete = "true";
  button.textContent = "确认删除";
  window.clearTimeout(button._confirmDeleteTimer);
  button._confirmDeleteTimer = window.setTimeout(() => {
    button.dataset.confirmDelete = "";
    button.textContent = "删除";
  }, 4000);
}

async function confirmDeleteStudent(name, code, requestId = "") {
  const label = code ? `${name}（PIN ${code}）` : name;
  const savedToCloud = await deleteStudentProfile(name, code, requestId);
  if (savedToCloud) {
    window.alert(`${label} 已删除。`);
  } else {
    window.alert(`${label} 已在本机删除，但云端保存失败。请检查网络后再试。`);
  }
}

async function deleteStudentProfile(name, code, requestId = "") {
  persistCurrentWeekRefs();

  const matches = (item) => matchesStudentIdentity(item, name, code);
  const matchingIds = new Set();
  const targetRecordId = String(requestId || "").trim();
  const routineKeyFromId = getRoutineKeyFromDefaultRequestId(targetRecordId);
  const deletedKeys = getDeletedStudentProfileKeys(name, code, requestId);

  markDeletedStudentProfiles(deletedKeys);

  if (targetRecordId) matchingIds.add(targetRecordId);
  deletedKeys.forEach((key) => matchingIds.add(`default-${encodeURIComponent(key)}`));
  if (routineKeyFromId && state.routines && Object.prototype.hasOwnProperty.call(state.routines, routineKeyFromId)) {
    delete state.routines[routineKeyFromId];
  }

  Object.keys(state.routines || {}).forEach((key) => {
    const routine = state.routines[key];
    const routineName = getNameFromRoutineKey(key, routine);
    const routineCode = routine?.code || String(key).split("::")[1] || "";
    if (matchesStudentIdentity({ name: routineName, code: routineCode }, name, code)) {
      delete state.routines[key];
    }
  });

  collectMatchingStudentRecordIds(state, matches, matchingIds);
  Object.keys(state.weeks || {}).forEach((weekKey) => {
    state.weeks[weekKey] = normalizeWeek(state.weeks[weekKey]);
    collectMatchingStudentRecordIds(state.weeks[weekKey], matches, matchingIds);
  });

  const shouldRemove = (item) => {
    if (!item) return false;
    const id = getStudentRecordId(item);
    const nestedId = getStudentRecordId(item.request);
    return matches(item)
      || matches(item.request)
      || (id && matchingIds.has(id))
      || (nestedId && matchingIds.has(nestedId));
  };

  removeStudentRecordsFromContainer(state, shouldRemove);
  Object.keys(state.weeks || {}).forEach((weekKey) => {
    removeStudentRecordsFromContainer(state.weeks[weekKey], shouldRemove);
  });
  pruneDeletedStudentProfiles(state);

  syncWeekPointers();
  selectedMove = null;
  dragged = null;
  saveState();
  window.clearTimeout(cloudSaveTimer);
  const savedToCloud = await saveCloudNow();
  renderCoach();
  return savedToCloud;
}

function collectMatchingStudentRecordIds(container, matches, ids) {
  getStudentRecordLists(container).forEach((list) => {
    list.forEach((item) => {
      if (matches(item) || matches(item?.request)) {
        const id = getStudentRecordId(item);
        const nestedId = getStudentRecordId(item?.request);
        if (id) ids.add(id);
        if (nestedId) ids.add(nestedId);
      }
    });
  });
}

function getStudentRecordLists(container) {
  if (!container) return [];
  return [
    container.requests,
    container.published,
    container.draft?.assignments,
    container.draft?.unassigned,
  ].filter(Array.isArray);
}

function removeStudentRecordsFromContainer(container, shouldRemove) {
  if (!container) return;
  if (Array.isArray(container.requests)) {
    container.requests = container.requests.filter((item) => !shouldRemove(item));
  }
  if (Array.isArray(container.published)) {
    container.published = container.published.filter((item) => !shouldRemove(item));
  }
  if (container.draft) {
    if (Array.isArray(container.draft.assignments)) {
      container.draft.assignments = container.draft.assignments.filter((item) => !shouldRemove(item));
    }
    if (Array.isArray(container.draft.unassigned)) {
      container.draft.unassigned = container.draft.unassigned.filter((item) => !shouldRemove(item));
    }
    container.draft.issues = findIssues(
      container.draft.assignments || [],
      container.draft.unassigned || [],
      container.draft.dayLocations || {},
    );
  }
}

function matchesStudentIdentity(item, name, code) {
  const identity = getStudentIdentity(item);
  const itemName = normalizeIdentityValue(identity.name);
  const itemCode = normalizeStudentPin(identity.code);
  const targetName = normalizeIdentityValue(name);
  const targetCode = normalizeStudentPin(code);
  if (targetCode) return itemCode === targetCode;
  return Boolean(targetName) && itemName === targetName;
}

function getStudentIdentity(item) {
  const source = item || {};
  const request = source.request || {};
  return {
    name: request.name ?? request.studentName ?? source.name ?? source.studentName ?? "",
    code: request.code
      ?? request.pin
      ?? request.studentCode
      ?? request.studentPin
      ?? source.code
      ?? source.pin
      ?? source.studentCode
      ?? source.studentPin
      ?? "",
  };
}

function getStudentRecordId(item) {
  if (!item) return "";
  return String(item.requestId || item.id || item.request?.requestId || item.request?.id || "").trim();
}

function getRoutineKeyFromDefaultRequestId(requestId) {
  if (!String(requestId || "").startsWith("default-")) return "";
  try {
    return decodeURIComponent(String(requestId).slice("default-".length));
  } catch {
    return "";
  }
}

function getDeletedStudentProfileKeys(name, code, requestId = "") {
  const keys = new Set();
  const routineKeyFromId = getRoutineKeyFromDefaultRequestId(requestId);
  if (routineKeyFromId) keys.add(routineKeyFromId);
  const routineKey = getRoutineKey(name, code);
  if (routineKey) keys.add(routineKey);
  return keys;
}

function markDeletedStudentProfiles(keys) {
  if (!state.settings || typeof state.settings !== "object") state.settings = {};
  const existing = Array.isArray(state.settings.deletedStudentProfiles)
    ? state.settings.deletedStudentProfiles
    : [];
  state.settings.deletedStudentProfiles = Array.from(new Set(existing.concat(Array.from(keys))));
}

function getDeletedStudentProfileSet(container = state) {
  return new Set(Array.isArray(container?.settings?.deletedStudentProfiles)
    ? container.settings.deletedStudentProfiles
    : []);
}

function mergeDeletedStudentProfiles(remoteState, localState) {
  const merged = { ...(remoteState || {}) };
  const remoteSettings = isPlainObject(remoteState?.settings) ? remoteState.settings : {};
  const localDeleted = getDeletedStudentProfileSet(localState);
  const remoteDeleted = getDeletedStudentProfileSet(remoteState);
  merged.settings = {
    ...remoteSettings,
    deletedStudentProfiles: Array.from(new Set([...remoteDeleted, ...localDeleted])),
  };
  return pruneDeletedStudentProfiles(merged);
}

function isDeletedStudentProfile(key, routine, container = state) {
  const deleted = getDeletedStudentProfileSet(container);
  if (deleted.has(key)) return true;
  const name = getNameFromRoutineKey(key, routine);
  const code = routine?.code || String(key).split("::")[1] || "";
  return deleted.has(getRoutineKey(name, code));
}

function pruneDeletedStudentProfiles(container) {
  const deleted = getDeletedStudentProfileSet(container);
  if (!deleted.size) return container;
  if (container.routines && typeof container.routines === "object") {
    Object.keys(container.routines).forEach((key) => {
      if (isDeletedStudentProfile(key, container.routines[key], container)) {
        delete container.routines[key];
      }
    });
  }
  const shouldRemove = (item) => {
    const id = getStudentRecordId(item);
    const nestedId = getStudentRecordId(item?.request);
    return deleted.has(id)
      || deleted.has(nestedId)
      || (id && deleted.has(getRoutineKeyFromDefaultRequestId(id)))
      || (nestedId && deleted.has(getRoutineKeyFromDefaultRequestId(nestedId)));
  };
  removeStudentRecordsFromContainer(container, shouldRemove);
  Object.keys(container.weeks || {}).forEach((weekKey) => {
    removeStudentRecordsFromContainer(container.weeks[weekKey], shouldRemove);
  });
  return container;
}

function normalizeIdentityValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStudentPin(value) {
  return String(value || "").trim();
}

function isValidStudentPin(value) {
  return /^\d{4}$/.test(normalizeStudentPin(value));
}

function findStudentByPin(code) {
  const targetCode = normalizeStudentPin(code);
  if (!targetCode) return null;
  for (const [key, routine] of Object.entries(state.routines || {})) {
    const routineCode = normalizeStudentPin(routine?.code || String(key).split("::")[1] || "");
    const routineName = getNameFromRoutineKey(key, routine);
    if (routineCode === targetCode && routineName) return { name: routineName, code: targetCode };
  }
  const request = dedupeRequestsByPin(state.requests || []).find((item) => normalizeStudentPin(item.code) === targetCode);
  if (request?.name) return { name: request.name, code: targetCode };
  return null;
}

function confirmStudentPinOwner(name = els.studentName.value.trim(), code = els.studentCode.value.trim()) {
  const targetName = normalizeIdentityValue(name);
  const owner = findStudentByPin(code);
  if (!owner || normalizeIdentityValue(owner.name) === targetName) return true;
  const confirmed = window.confirm(`这个 PIN 已经属于 ${owner.name}。你是 ${owner.name} 吗？`);
  if (confirmed) {
    els.studentName.value = owner.name;
    els.studentMessage.textContent = `已用 PIN 找到 ${owner.name} 的资料。`;
    loadRoutineForName();
    renderDefaultSummary();
    renderMySchedule();
    return true;
  }
  els.studentMessage.textContent = "这个 PIN 已经有人在使用。请确认自己的 PIN，或换一个新的 4 位 PIN。";
  return false;
}

function getStudentRequestIdentityKey(request) {
  const identity = getStudentIdentity(request);
  const code = normalizeStudentPin(identity.code);
  return code ? `pin:${code}` : `name:${normalizeIdentityValue(identity.name)}`;
}

function dedupeRequestsByPin(requests) {
  const byStudent = new Map();
  (Array.isArray(requests) ? requests : []).forEach((request) => {
    const key = getStudentRequestIdentityKey(request);
    const existing = byStudent.get(key);
    if (!existing || String(request.submittedAt || "") >= String(existing.submittedAt || "")) {
      byStudent.set(key, request);
    }
  });
  return Array.from(byStudent.values());
}

function findCurrentStudentRequest(code) {
  const targetCode = normalizeStudentPin(code);
  if (!targetCode) return null;
  return dedupeRequestsByPin(state.requests || []).find((request) => normalizeStudentPin(request.code) === targetCode) || null;
}

function removeRoutineByPin(code) {
  const targetCode = normalizeStudentPin(code);
  if (!targetCode) return;
  Object.keys(state.routines || {}).forEach((key) => {
    const routine = state.routines[key];
    const routineCode = normalizeStudentPin(routine?.code || String(key).split("::")[1] || "");
    if (routineCode === targetCode) delete state.routines[key];
  });
}

function pruneOrphanedDraftEntries(container) {
  const defaultRequestIds = new Set(Object.entries(container.routines || {})
    .filter(([key, routine]) => !isDeletedStudentProfile(key, routine, container))
    .map(([key, routine]) => `default-${encodeURIComponent(getRoutineKey(getNameFromRoutineKey(key, routine), routine?.code || String(key).split("::")[1] || ""))}`));
  Object.values(container.weeks || {}).forEach((week) => {
    const validIds = new Set([...(week.requests || []).map((request) => request.id), ...defaultRequestIds].filter(Boolean));
    const keep = (item) => {
      const id = getStudentRecordId(item);
      if (!id || id.startsWith("manual-")) return true;
      return validIds.has(id);
    };
    if (week.draft) {
      if (Array.isArray(week.draft.assignments)) week.draft.assignments = week.draft.assignments.filter(keep);
      if (Array.isArray(week.draft.unassigned)) week.draft.unassigned = week.draft.unassigned.filter((item) => keep(item.request || item));
    }
  });
}

function compareStudentRequests(a, b) {
  const nameCompare = normalizeIdentityValue(a.name).localeCompare(normalizeIdentityValue(b.name), "zh-Hans", { numeric: true });
  if (nameCompare) return nameCompare;
  const codeCompare = getSortableCode(a.code).localeCompare(getSortableCode(b.code), "zh-Hans", { numeric: true });
  if (codeCompare) return codeCompare;
  const sourceCompare = getSourceSortIndex(a.source) - getSourceSortIndex(b.source);
  if (sourceCompare) return sourceCompare;
  const slotCompare = getRequestFirstSlotSortIndex(a) - getRequestFirstSlotSortIndex(b);
  if (slotCompare) return slotCompare;
  return String(a.id || "").localeCompare(String(b.id || ""), "zh-Hans", { numeric: true });
}

function getSortableCode(code) {
  const value = normalizeIdentityValue(code);
  return value || "\uffff";
}

function getSourceSortIndex(source) {
  if (source === "default") return 0;
  if (source === "manual") return 2;
  return 1;
}

function getRequestFirstSlotSortIndex(request) {
  const routine = Array.isArray(request.routine) ? request.routine.filter((item) => item.slotKey) : [];
  const slotKeys = routine.length ? routine.map((item) => item.slotKey) : (request.availability || []);
  if (!slotKeys.length) return Number.POSITIVE_INFINITY;
  return Math.min(...slotKeys.map(getSlotSortIndex));
}

function getPreferenceItems(request) {
  const routine = Array.isArray(request.routine) ? request.routine.filter((item) => item.slotKey) : [];
  const location = request.locations.length ? request.locations.join(" / ") : "未设置";
  const items = routine.length
    ? routine
    : request.availability.map((slotKey, index) => ({
      slotKey,
      goal: request.goals[index] || request.goals[0] || FLEX_GOAL,
    }));
  if (!items.length) return [{ time: "未设置", goal: FLEX_GOAL, location }];
  return [...items].sort((a, b) => {
    const preferredDelta = Number(request.preferredAvailability?.includes(b.slotKey) || false) - Number(request.preferredAvailability?.includes(a.slotKey) || false);
    return preferredDelta || getSlotSortIndex(a.slotKey) - getSlotSortIndex(b.slotKey);
  }).map((item) => {
    const goal = normalizeGoal(item.goal || FLEX_GOAL);
    return {
      time: formatSlotLabel(item.slotKey),
      goal,
      location,
      preferred: request.preferredAvailability?.includes(item.slotKey) || false,
    };
  });
}

function renderLocationRow() {
  els.locationRow.innerHTML = `<div class="time-spacer">地点</div>` + DAYS.map((day) => {
    const location = state.draft.dayLocations[day.id] || chooseDayLocation(countLocationVotes(day.id, getEffectiveRequests()));
    state.draft.dayLocations[day.id] = location;
    const dayIssue = state.draft.issues.find((issue) => issue.dayId === day.id);
    return `
      <label class="location-card ${dayIssue ? "review" : "selected"}" data-day-card="${day.id}">
        <span class="location-day-line">${day.label} ${formatMonthDay(getDayDate(DAYS.findIndex((item) => item.id === day.id)))}</span>
        <select data-day-location="${day.id}">
          <option value="" ${location ? "" : "selected"}>Dora 选地点</option>
          ${LOCATIONS.map((item) => `<option value="${item}" ${location === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </label>
    `;
  }).join("");

  els.locationRow.querySelectorAll("[data-day-location]").forEach((select) => {
    select.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    select.addEventListener("change", (event) => {
      event.stopPropagation();
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
    slot.addEventListener("click", (event) => {
      const manualButton = event.target.closest("[data-manual-add]");
      if (manualButton) {
        event.preventDefault();
        event.stopPropagation();
        openManualCoursePrompt(manualButton.dataset.manualAdd);
        return;
      }
      if (selectedMove) {
        moveSelectedToSlot(slot.dataset.slotKey);
        return;
      }
      const issue = state.draft.issues.find((item) => item.slotKey === slot.dataset.slotKey);
      renderIssue(issue || null);
    });
  });

  els.coachCalendar.querySelectorAll("[draggable='true']").forEach((chip) => {
    chip.addEventListener("dragstart", () => {
      dragged = { type: "assignment", id: chip.dataset.assignmentId };
    });
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      selectMoveSource("assignment", chip.dataset.assignmentId);
    });
  });

  els.coachCalendar.querySelectorAll("[data-assignment-goal]").forEach((select) => {
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", (event) => {
      event.stopPropagation();
      updateAssignmentGoal(select.dataset.assignmentGoal, select.value);
    });
  });

  els.coachCalendar.querySelectorAll("[data-remove-assignment]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeAssignment(button.dataset.removeAssignment);
    });
  });
}

function renderSlot(slotKey) {
  const assignments = state.draft.assignments.filter((item) => item.slotKey === slotKey);
  const issue = state.draft.issues.find((item) => item.slotKey === slotKey);
  const className = issue?.severity === "error" ? "error" : issue?.severity === "review" ? "review" : "";
  const statusLabel = issue?.severity === "error" ? "需要调整" : issue?.severity === "review" ? "Dora 看一下" : "";
  const canAdd = assignments.length < CAPACITY;
  return `
    <article class="slot ${className}" data-slot-key="${slotKey}">
      ${statusLabel ? `<span class="slot-status ${issue.severity}">${statusLabel}</span>` : ""}
      <div class="people">
        ${assignments.map((item) => `
          <div class="assignment-chip ${selectedMove?.type === "assignment" && selectedMove.id === item.id ? "selected" : ""}" draggable="true" data-assignment-id="${item.id}">
            <button class="person-chip" type="button">${item.name}</button>
            <select class="assignment-goal-select" data-assignment-goal="${item.id}" aria-label="修改 ${escapeAttribute(item.name)} 的训练内容">
              ${renderGoalOptions(item.goal)}
            </select>
            ${item.manual ? `<button class="remove-assignment" type="button" data-remove-assignment="${item.id}" aria-label="移除 ${escapeAttribute(item.name)}">×</button>` : ""}
          </div>
        `).join("")}
        ${canAdd ? `<button class="manual-add-chip" type="button" data-manual-add="${slotKey}" aria-label="手动加课 ${escapeAttribute(formatSlot(slotKey))}">+</button>` : ""}
      </div>
    </article>
  `;
}

function renderGoalOptions(selectedGoal) {
  return GOALS.map((goal) => `
    <option value="${escapeAttribute(goal)}" ${normalizeGoal(selectedGoal) === goal ? "selected" : ""}>${goal}</option>
  `).join("");
}

function updateAssignmentGoal(assignmentId, goal) {
  const assignment = state.draft.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;
  assignment.goal = normalizeGoal(goal);
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function openManualCoursePrompt(slotKey) {
  const currentCount = state.draft.assignments.filter((item) => item.slotKey === slotKey).length;
  if (currentCount >= CAPACITY) {
    renderIssue({
      type: "capacity",
      title: "这个时间已经满了",
      text: `${formatSlot(slotKey)} 已经有 2 位学员，不能再直接加课。`,
      severity: "error",
      slotKey,
    });
    return;
  }
  manualCourseSlotKey = slotKey;
  if (els.manualCourseTitle) els.manualCourseTitle.textContent = `手动加课 · ${formatSlot(slotKey)}`;
  renderManualStudentOptions();
  if (els.manualCourseGoal) els.manualCourseGoal.value = FLEX_GOAL;
  const dayId = getDayId(slotKey);
  if (els.manualCourseLocation) els.manualCourseLocation.value = state.draft.dayLocations[dayId] || "";
  if (els.manualCourseMessage) els.manualCourseMessage.textContent = "";
  if (els.manualCourseModal) els.manualCourseModal.hidden = false;
  window.requestAnimationFrame(() => els.manualCourseName?.focus());
}

function closeManualCourseModal() {
  manualCourseSlotKey = null;
  if (els.manualCourseModal) els.manualCourseModal.hidden = true;
}

function saveManualCourse() {
  if (!manualCourseSlotKey) return;
  const selectedStudent = parseManualStudentValue(els.manualCourseName?.value || "");
  if (!selectedStudent.name) {
    if (els.manualCourseMessage) els.manualCourseMessage.textContent = "先选择学员。";
    els.manualCourseName?.focus();
    return;
  }
  const goal = normalizeGoal(els.manualCourseGoal?.value || FLEX_GOAL);
  const location = normalizeManualLocation(els.manualCourseLocation?.value || "");
  if (location === null) return;
  addManualCourse(manualCourseSlotKey, selectedStudent.name, goal, location, selectedStudent.code);
  closeManualCourseModal();
}

function renderManualStudentOptions() {
  if (!els.manualCourseName) return;
  const students = getManualStudentOptions();
  els.manualCourseName.innerHTML = `
    <option value="">先选择学员</option>
    ${students.map((student) => `
      <option value="${escapeAttribute(formatManualStudentValue(student))}">
        ${escapeHtml(student.name)}${student.code ? ` · PIN ${escapeHtml(student.code)}` : " · PIN 未填写"}
      </option>
    `).join("")}
  `;
}

function getManualStudentOptions() {
  const students = new Map();
  const addStudent = (item) => {
    const name = String(item?.name || "").trim();
    if (!name) return;
    const code = String(item?.code || "").trim();
    const key = getRoutineKey(name, code);
    if (!students.has(key)) students.set(key, { name, code });
  };
  getEffectiveRequests().forEach(addStudent);
  state.draft.assignments.forEach(addStudent);
  state.draft.unassigned.forEach((item) => addStudent(item.request || item));
  state.published.forEach(addStudent);
  return Array.from(students.values()).sort((a, b) => {
    const nameSort = a.name.localeCompare(b.name, "zh-Hans-u-co-pinyin");
    if (nameSort !== 0) return nameSort;
    return a.code.localeCompare(b.code);
  });
}

function formatManualStudentValue(student) {
  return `${encodeURIComponent(student.name)}::${encodeURIComponent(student.code || "")}`;
}

function parseManualStudentValue(value) {
  const [name = "", code = ""] = String(value || "").split("::");
  return {
    name: decodeURIComponent(name).trim(),
    code: decodeURIComponent(code).trim(),
  };
}

function addManualCourse(slotKey, name, goal, location, code = "") {
  const dayId = getDayId(slotKey);
  if (location) state.draft.dayLocations[dayId] = location;
  const requestId = `manual-${makeId()}`;
  state.draft.assignments.push({
    id: makeId(),
    requestId,
    name: name.trim(),
    code,
    goal,
    slotKey,
    location: formatLocation(state.draft.dayLocations[dayId]),
    manual: true,
  });
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function normalizeManualLocation(value) {
  const location = (value || "").trim();
  if (!location) return "";
  const matched = LOCATIONS.find((item) => item.toLowerCase() === location.toLowerCase());
  if (matched) return matched;
  window.alert("地点只能填 235 Grand 或 Bisby。");
  return null;
}

function removeAssignment(assignmentId) {
  const assignment = state.draft.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;
  if (!window.confirm(`确定移除 ${assignment.name} 的这节课吗？`)) return;
  state.draft.assignments = state.draft.assignments.filter((item) => item.id !== assignmentId);
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  selectedMove = null;
  dragged = null;
  saveState();
  renderCoach();
}

function renderUnassigned() {
  if (!state.draft.unassigned.length) {
    els.unassignedPool.innerHTML = `<span class="muted">没有未安排的申请。</span>`;
  } else {
    els.unassignedPool.innerHTML = state.draft.unassigned.map((item) => `
      <button class="${selectedMove?.type === "unassigned" && selectedMove.id === item.id ? "selected" : ""}" draggable="true" data-unassigned-id="${item.id}">
        <strong>${item.request.name} · ${item.goal}</strong>
        <span>可选：${item.request.availability.map(formatSlot).join(" / ")}</span>
        ${item.request.notes ? `<em>备注：${escapeHtml(item.request.notes)}</em>` : ""}
      </button>
    `).join("");
  }

  els.unassignedPool.ondragover = allowUnassignedDrop;
  els.unassignedPool.ondragleave = clearUnassignedDropState;
  els.unassignedPool.ondrop = moveDraggedToUnassigned;
  els.unassignedPool.onclick = moveSelectedToUnassigned;

  els.unassignedPool.querySelectorAll("[draggable='true']").forEach((button) => {
    button.addEventListener("dragstart", () => {
      dragged = { type: "unassigned", id: button.dataset.unassignedId };
    });
    button.addEventListener("click", () => {
      selectMoveSource("unassigned", button.dataset.unassignedId);
    });
  });
}

function allowUnassignedDrop(event) {
  if (!dragged || dragged.type !== "assignment") return;
  event.preventDefault();
  els.unassignedPool.classList.add("drop-ready");
}

function clearUnassignedDropState() {
  els.unassignedPool.classList.remove("drop-ready");
}

function moveSelectedToUnassigned(event) {
  if (event.target.closest("[data-unassigned-id]")) return;
  if (!selectedMove || selectedMove.type !== "assignment") return;
  dragged = selectedMove;
  moveDraggedToUnassigned(event);
}

function moveDraggedToUnassigned(event) {
  event?.preventDefault?.();
  clearUnassignedDropState();
  if (!dragged || dragged.type !== "assignment") return;
  const index = state.draft.assignments.findIndex((item) => item.id === dragged.id);
  const assignment = state.draft.assignments[index];
  if (!assignment) return;
  state.draft.assignments.splice(index, 1);
  if (!isManualDraftItem(assignment)) {
    state.draft.unassigned.push(buildUnassignedFromAssignment(assignment));
  }
  normalizeDraftUnassigned();
  dragged = null;
  selectedMove = null;
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function buildUnassignedFromAssignment(assignment) {
  const request = findEffectiveRequestById(assignment.requestId) || {
    id: assignment.requestId || `manual-${makeId()}`,
    name: assignment.name,
    code: assignment.code || "",
    desiredCount: 1,
    goals: [assignment.goal],
    locations: assignment.location && LOCATIONS.includes(assignment.location) ? [assignment.location] : [],
    availability: allSlotKeys(),
    notes: "Dora 手动添加",
    source: "manual",
    routine: [],
    submittedAt: "",
  };
  return {
    id: makeId(),
    request,
    index: 0,
    goal: normalizeGoal(assignment.goal),
  };
}

function clearDraftSchedule() {
  if (!state.draft.assignments.length && !state.draft.unassigned.length) {
    renderIssue({
      title: "现在没有要清空的排课",
      text: "当前草案里没有课程，也没有待排申请。",
      severity: "review",
    }, { focus: false });
    return;
  }
  const ok = window.confirm("确定清空当前日历吗？学员申请和常用安排会回到未排入课表，手动添加的课程会移除。");
  if (!ok) return;
  const rebuilt = expandSessions(getEffectiveRequests())
    .filter((session) => !isManualDraftItem(session))
    .map((session) => ({
      ...session,
      id: makeId(),
    }));
  state.draft.assignments = [];
  state.draft.unassigned = rebuilt;
  normalizeDraftUnassigned();
  selectedMove = null;
  dragged = null;
  currentIssue = null;
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
  renderIssue({
    title: "已经放回未排入课表",
    text: "现在可以从下面的待排申请重新放进日历。",
    severity: "review",
  }, { focus: false });
}

function normalizeDraftUnassigned() {
  if (!Array.isArray(state.draft?.unassigned)) return false;
  const assignedCounts = new Map();
  state.draft.assignments.forEach((assignment) => {
    const key = getRequestCountKey(assignment);
    assignedCounts.set(key, (assignedCounts.get(key) || 0) + 1);
  });
  const pendingCounts = new Map();
  const next = [];
  for (const item of state.draft.unassigned) {
    if (isManualDraftItem(item)) continue;
    const request = item.request || findEffectiveRequestById(item.requestId);
    const key = getRequestCountKey(item);
    const desired = Math.max(1, Number(request?.desiredCount || item.request?.desiredCount || 1));
    const assigned = assignedCounts.get(key) || 0;
    const pending = pendingCounts.get(key) || 0;
    if (assigned + pending >= desired) continue;
    next.push(item);
    pendingCounts.set(key, pending + 1);
  }
  if (next.length === state.draft.unassigned.length) return false;
  state.draft.unassigned = next;
  return true;
}

function getRequestCountKey(item) {
  const request = item.request || {};
  return item.requestId || request.id || `${request.name || item.name || "manual"}::${request.code || item.code || ""}`;
}

function renderIssue(issue, options = { focus: true }) {
  selectedMove = null;
  currentIssue = issue;
  els.applyRecommendation.style.display = "";
  if (!issue) {
    if (els.issueState) els.issueState.textContent = "先点提醒格";
    els.issueTitle.textContent = "没有选中问题";
    els.issueText.textContent = "点黄色或红色格子看原因。";
    els.issueRecommendation.innerHTML = "";
    els.applyRecommendation.disabled = true;
    focusIssuePanel(false, false);
    return;
  }
  if (els.issueState) els.issueState.textContent = "正在查看这个提醒";
  els.issueTitle.textContent = issue.title;
  els.issueText.textContent = issue.text;
  const recommendation = buildRecommendation(issue);
  if (issue.type === "location-choice" || issue.type === "location-preference") {
    els.issueRecommendation.innerHTML = renderLocationChoiceAdvice(issue);
    els.applyRecommendation.disabled = true;
    els.applyRecommendation.style.display = "none";
    bindLocationChoiceButtons();
    focusIssuePanel(Boolean(options.focus), Boolean(options.focus));
    return;
  }
  if (issue.type === "ask-availability") {
    els.issueRecommendation.innerHTML = renderAskAvailabilityAdvice(issue);
    els.applyRecommendation.disabled = true;
    focusIssuePanel(Boolean(options.focus), Boolean(options.focus));
    return;
  }
  els.issueRecommendation.innerHTML = recommendation ? `
    <div class="recommend-box">
      <strong>可以直接移动</strong>
      <p>${recommendation.text}</p>
      <ul>${recommendation.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
    </div>
  ` : renderManualPlanAdvice(issue);
  els.applyRecommendation.disabled = !recommendation;
  focusIssuePanel(Boolean(options.focus), Boolean(options.focus));
}

function renderLocationChoiceAdvice(issue) {
  const day = DAYS.find((item) => item.id === issue.dayId);
  const votes = countLocationVotes(issue.dayId, getEffectiveRequests());
  const current = state.draft.dayLocations[issue.dayId] || "";
  const voteText = `偏好票数：235 Grand ${votes["235 Grand"] || 0}，Bisby ${votes.Bisby || 0}`;
  return `
    <div class="recommend-box location-choice-box">
      <strong>${day?.label || "当天"}地点由 Dora 决定</strong>
      <p>${voteText}。选定后，这一天两节课都会使用同一个地点。</p>
      <div class="location-choice-actions">
        ${LOCATIONS.map((location) => `
          <button class="${current === location ? "primary" : "ghost"}" type="button" data-set-day-location="${issue.dayId}" data-location="${location}">
            设为 ${location}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function bindLocationChoiceButtons() {
  els.issueRecommendation.querySelectorAll("[data-set-day-location]").forEach((button) => {
    button.addEventListener("click", () => {
      updateDayLocation(button.dataset.setDayLocation, button.dataset.location);
    });
  });
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
      <p>没有一键移动方案。可以优先尝试这些下一步：</p>
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
    return "这个时间段人数没超，但两个人的训练内容不适合直接拼课。";
  }
  if (issue.type === "duplicate") {
    return "同一个学员的两节课被放到了同一个时间段，需要换开。";
  }
  if (issue.type === "unassigned") {
    return "她提交的可用时间里，目前没有能直接放进去的空位。";
  }
  return "";
}

function updateDayLocation(dayId, location) {
  state.draft.dayLocations[dayId] = location;
  state.draft.assignments
    .filter((item) => getDayId(item.slotKey) === dayId)
    .forEach((item) => {
      item.location = formatLocation(location);
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
      const request = findEffectiveRequestById(item.requestId);
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
        text: `${item.name} → ${formatSlot(alternative)} · ${formatLocation(state.draft.dayLocations[getDayId(alternative)])}`,
        reasons: [
          `${item.name} 也提交了 ${formatSlot(alternative)} 可用`,
          contentReason,
          `当天地点：${formatLocation(state.draft.dayLocations[getDayId(alternative)])}`,
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
      const request = findEffectiveRequestById(item.requestId);
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
  const location = formatLocation(state.draft.dayLocations[getDayId(slotKey)]);
  const compatScore = targetItems.reduce((total, assigned) => total + compatibility(item.goal, assigned.goal), 0);
  let score = 0;
  if (alreadyAvailable) score += 30;
  else score += 8;
  if (!targetItems.length) score += 12;
  if (targetItems.length && compatScore >= 0) score += 8;
  if (getDayId(slotKey) === getDayId(item.slotKey)) score += 3;
  if (location !== "地点待定") score += 1;
  if (targetItems.length && compatScore < 0) score -= 12;

  const action = alreadyAvailable ? "可直接移动" : "先私下问";
  const reasonParts = [];
  reasonParts.push(alreadyAvailable ? "她已经提交这个时间可用" : "需要先私下确认她是否可用");
  reasonParts.push(targetItems.length ? `目前已有 ${describePeopleWithGoals(targetItems)}` : "目前有空位");
  reasonParts.push(`地点：${location}`);
  if (targetItems.length && compatScore < 0) reasonParts.push(`${item.name} 想练 ${normalizeGoal(item.goal)}，和这格内容不太搭`);

  return {
    score,
    text: `${action}：${item.name} (${item.goal}) → ${formatSlot(slotKey)} · ${location}`,
    reason: reasonParts.join("；"),
  };
}

function canSafelyMove(item, targetSlot) {
  const request = findEffectiveRequestById(item.requestId);
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
      location: formatLocation(state.draft.dayLocations[getDayId(targetSlot)]),
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
  const targetItems = state.draft.assignments.filter((assigned) => assigned.slotKey === targetSlot && assigned.id !== item.id);
  if (targetItems.length >= CAPACITY) {
    return {
      title: "这个位置不能放",
      text: `${formatSlot(targetSlot)} 已经满员。`,
      severity: "error",
    };
  }
  if (item.manual) return null;
  const request = findEffectiveRequestById(item.requestId);
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
  const request = findEffectiveRequestById(item.requestId);
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
  const currentPeople = describePeopleWithGoals(targetItems);
  if (targetItems.every((assigned) => compatibility(item.goal, assigned.goal) >= 0)) {
    return `已有 ${currentPeople}；${item.name} 想练 ${normalizeGoal(item.goal)}，内容相对可搭`;
  }
  return `已有 ${currentPeople}；${item.name} 想练 ${normalizeGoal(item.goal)}，所以不太适合直接拼课`;
}

function describePeopleWithGoals(items) {
  return items.map((assigned) => `${assigned.name}（${normalizeGoal(assigned.goal)}）`).join("、");
}

function selectMoveSource(type, id) {
  selectedMove = { type, id };
  dragged = { type, id };
  const label = getMoveSourceLabel(selectedMove);
  currentIssue = null;
  if (els.issueState) els.issueState.textContent = "正在移动学员";
  els.issueTitle.textContent = `已选中 ${label}`;
  els.issueText.textContent = "现在点一个目标时间格，就会把这个学员移动过去。手机上不用拖拽，点选就可以。";
  els.issueRecommendation.innerHTML = `<div class="recommend-box"><strong>移动方式</strong><p>点任意一个有空位的时间格；如果目标时间不在学员可用范围，系统会提示需要先私下确认。</p></div>`;
  els.applyRecommendation.disabled = true;
  renderCoachCalendar();
  renderUnassigned();
  renderMobileCoach();
  focusIssuePanel(false);
}

function getMoveSourceLabel(source) {
  if (!source) return "学员";
  if (source.type === "assignment") {
    const assignment = state.draft.assignments.find((item) => item.id === source.id);
    return assignment ? `${assignment.name}（${normalizeGoal(assignment.goal)}）` : "学员";
  }
  const item = state.draft.unassigned.find((entry) => entry.id === source.id);
  return item ? `${item.request.name}（${normalizeGoal(item.goal)}）` : "学员";
}

function moveSelectedToSlot(slotKey) {
  dragged = selectedMove;
  moveDraggedToSlot(slotKey);
}

function focusIssuePanel(shouldScroll, shouldHighlight = true) {
  if (!els.detailPanel) return;
  els.detailPanel.classList.remove("is-focused");
  if (!shouldHighlight) return;
  window.requestAnimationFrame(() => {
    els.detailPanel.classList.add("is-focused");
    if (shouldScroll && window.matchMedia("(max-width: 1160px)").matches) {
      els.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function applyRecommendation() {
  const recommendation = buildRecommendation(currentIssue);
  if (!recommendation) return;
  const assignment = state.draft.assignments.find((item) => item.id === recommendation.assignmentId);
  assignment.slotKey = recommendation.targetSlot;
  assignment.location = formatLocation(state.draft.dayLocations[getDayId(recommendation.targetSlot)]);
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function moveDraggedToSlot(slotKey) {
  if (!dragged) return;
  if (dragged.type === "assignment") {
    const currentAssignment = state.draft.assignments.find((item) => item.id === dragged.id);
    if (currentAssignment?.slotKey === slotKey) {
      dragged = null;
      selectedMove = null;
      renderCoachCalendar();
      renderUnassigned();
      renderMobileCoach();
      return;
    }
  }
  const currentCount = state.draft.assignments.filter((item) => item.slotKey === slotKey).length;
  if (currentCount >= CAPACITY) {
    renderIssue({
      type: "capacity",
      title: "这个时间已经满了",
      text: `${formatSlot(slotKey)} 已经有 2 位学员，不能再直接放入。`,
      severity: "error",
      slotKey,
    });
    dragged = null;
    selectedMove = null;
    return;
  }
  if (dragged.type === "assignment") {
    const assignment = state.draft.assignments.find((item) => item.id === dragged.id);
    const blockIssue = assignment ? buildMoveBlockIssue(assignment, slotKey) : null;
    if (blockIssue) {
      renderIssue(blockIssue);
      dragged = null;
      selectedMove = null;
      return;
    }
    if (assignment) {
      assignment.slotKey = slotKey;
      assignment.location = formatLocation(state.draft.dayLocations[getDayId(slotKey)]);
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
      selectedMove = null;
      return;
    }
    if (item && item.request.availability.includes(slotKey)) {
      state.draft.assignments.push({
        id: makeId(),
        requestId: item.request.id,
        name: item.request.name,
        code: item.request.code || "",
        goal: item.goal,
        slotKey,
        location: formatLocation(state.draft.dayLocations[getDayId(slotKey)]),
      });
      state.draft.unassigned.splice(index, 1);
    }
  }
  dragged = null;
  selectedMove = null;
  state.draft.issues = findIssues(state.draft.assignments, state.draft.unassigned, state.draft.dayLocations);
  saveState();
  renderCoach();
}

function publishSchedule() {
  state.published = state.draft.assignments.map(enrichAssignmentWithCode);
  saveState();
  renderMySchedule();
  alert("已发布。学员回到提交页输入名字即可看到自己的安排。");
}

function enrichAssignmentWithCode(assignment) {
  const request = findEffectiveRequestById(assignment.requestId);
  return {
    ...assignment,
    code: assignment.code || request?.code || "",
  };
}

function exportCalendar() {
  const assignments = state.published.length ? state.published : state.draft.assignments;
  if (!assignments.length) {
    alert("还没有可导出的安排。可以先去调整排课，把学员放进时间格。");
    return;
  }

  const weekStart = parseDateKey(state.currentWeekKey);
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

function getWeekStart(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getDefaultWeekStart() {
  const today = new Date();
  const day = today.getDay();
  if (day === 0 || day === 5 || day === 6) return getNextTrainingMonday();
  return getWeekStart(today);
}

function getDefaultWeekKey() {
  return formatDateForFile(getDefaultWeekStart());
}

function parseDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return getWeekStart(new Date());
  const [year, month, day] = dateKey.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? getWeekStart(new Date()) : parsed;
}

function getDayDate(dayOffset) {
  const date = parseDateKey(state.currentWeekKey);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function getWeekRangeLabel() {
  const start = parseDateKey(state.currentWeekKey);
  const end = new Date(start);
  end.setDate(start.getDate() + 3);
  return `${formatMonthDay(start)} - ${formatMonthDay(end)}`;
}

function getWeekRangeChineseLabel() {
  const start = parseDateKey(state.currentWeekKey);
  const end = new Date(start);
  end.setDate(start.getDate() + 3);
  return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getSlotDateTime(slotKey, weekStart, edge) {
  const [dayId, slotId] = slotKey.split("-");
  const dayOffset = Math.max(0, DAYS.findIndex((day) => day.id === dayId));
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(text) {
  return escapeHtml(text);
}

function escapeTextarea(text) {
  return escapeHtml(text);
}

function allSlotKeys() {
  return DAYS.flatMap((day) => SLOTS.map((slot) => `${day.id}-${slot.id}`));
}

function getSlotSortIndex(slotKey) {
  const [dayId, slotId] = String(slotKey || "").split("-");
  const dayIndex = DAYS.findIndex((day) => day.id === dayId);
  const slotIndex = SLOTS.findIndex((slot) => slot.id === slotId);
  const safeDayIndex = dayIndex >= 0 ? dayIndex : DAYS.length;
  const safeSlotIndex = slotIndex >= 0 ? slotIndex : SLOTS.length;
  return safeDayIndex * SLOTS.length + safeSlotIndex;
}

function getTodayDayId() {
  const ids = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = ids[new Date().getDay()];
  return DAYS.some((day) => day.id === today) ? today : "mon";
}

function getDayId(slotKey) {
  return String(slotKey || "").split("-")[0];
}

function formatSlot(slotKey) {
  const [dayId, slotId] = String(slotKey || "").split("-");
  const day = DAYS.find((item) => item.id === dayId);
  const dayIndex = DAYS.findIndex((item) => item.id === dayId);
  const slot = SLOTS.find((item) => item.id === slotId);
  if (!day || !slot) return "未设置";
  return `${day.label} ${formatMonthDay(getDayDate(dayIndex))} ${slot.label}`;
}

function formatSlotLabel(slotKey) {
  const [dayId, slotId] = String(slotKey || "").split("-");
  const day = DAYS.find((item) => item.id === dayId);
  const slot = SLOTS.find((item) => item.id === slotId);
  if (!day || !slot) return "未设置";
  return `${day.label} ${slot.label}`;
}

function formatSlotTime(slotKey) {
  const slotId = String(slotKey || "").split("-")[1];
  return SLOTS.find((item) => item.id === slotId)?.label || "";
}

function formatLocation(location) {
  return location || "地点待定";
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(safeLocalStorageGet(STORAGE_KEY));
    const loaded = normalizeState(saved || {});
    loaded.currentWeekKey = getDefaultWeekKey();
    if (!loaded.weeks[loaded.currentWeekKey]) loaded.weeks[loaded.currentWeekKey] = createEmptyWeek();
    return normalizeState(loaded);
  } catch {
    safeLocalStorageRemove(STORAGE_KEY);
  }
  return normalizeState({});
}

function normalizeState(saved) {
  const currentWeekKey = saved.currentWeekKey || getDefaultWeekKey();
  const weeks = isPlainObject(saved.weeks) ? saved.weeks : {};
  if (!weeks[currentWeekKey]) {
    weeks[currentWeekKey] = {
      requests: saved.requests || [],
      draft: saved.draft || { assignments: [], unassigned: [], dayLocations: {}, issues: [] },
      published: saved.published || [],
    };
  }
  Object.keys(weeks).forEach((weekKey) => {
    weeks[weekKey] = normalizeWeek(weeks[weekKey]);
    weeks[weekKey].requests = dedupeRequestsByPin(weeks[weekKey].requests);
  });
  const normalized = {
    currentWeekKey,
    weeks,
    routines: isPlainObject(saved.routines) ? saved.routines : {},
    settings: isPlainObject(saved.settings) ? saved.settings : {},
    coachNotes: isPlainObject(saved.coachNotes) ? saved.coachNotes : {},
  };
  pruneDeletedStudentProfiles(normalized);
  pruneOrphanedDraftEntries(normalized);
  if (!normalized.weeks[normalized.currentWeekKey]) normalized.weeks[normalized.currentWeekKey] = createEmptyWeek();
  normalized.weeks[normalized.currentWeekKey] = normalizeWeek(normalized.weeks[normalized.currentWeekKey]);
  const week = normalized.weeks[normalized.currentWeekKey];
  normalized.requests = week.requests;
  normalized.draft = week.draft;
  normalized.published = week.published;
  return normalized;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function saveState() {
  ensureWeek(state.currentWeekKey);
  persistCurrentWeekRefs();
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(state));
  if (!cloudStore?.ready || applyingRemoteState) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(saveCloudNow, 250);
}

function safeLocalStorageGet(key) {
  try {
    return window.localStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Local preview can still run without browser storage.
  }
}

function safeLocalStorageRemove(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Ignore storage cleanup failures in local preview.
  }
}

function persistCurrentWeekRefs() {
  if (!state.currentWeekKey) return;
  const week = ensureWeek(state.currentWeekKey);
  week.requests = Array.isArray(state.requests) ? state.requests : [];
  week.draft = state.draft && typeof state.draft === "object" ? state.draft : createEmptyWeek().draft;
  week.published = Array.isArray(state.published) ? state.published : [];
}

async function saveCloudNow() {
  if (!cloudStore?.ready) return false;
  try {
    setSyncStatus("正在保存", "syncing");
    await cloudStore.setDoc(cloudStore.documentRef, {
      appState: getCloudState(),
      updatedAt: cloudStore.serverTimestamp(),
    });
    setSyncStatus("云端同步中", "cloud");
    return true;
  } catch (error) {
    setSyncStatus(`保存失败：${formatCloudError(error)}`, "error");
    console.error("Firebase save failed", error);
    return false;
  }
}

function getCloudState() {
  persistCurrentWeekRefs();
  return pruneDeletedStudentProfiles({
    weeks: state.weeks || {},
    routines: state.routines || {},
    settings: state.settings || {},
    coachNotes: state.coachNotes || {},
  });
}
