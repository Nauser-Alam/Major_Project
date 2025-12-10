/* app.js — front-end logic */

/*
  IMPORTANT: set your Apps Script web app URL here:
  e.g. const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfy.../exec'
*/
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx0tPZkh76YEpoxvnmGKmr2LSB4JW4e4N1nixWKo4JSEe9wYiHizUidUhPs66biYSvFeQ/exec";

let currentUser = null;
const toast = id("toast");

document.addEventListener("DOMContentLoaded", init);

function init() {
  // routing
  id("navHome").onclick = () => showPage("home");
  id("navComm").onclick = () => showPage("comm");

  // UI
  id("darkToggle").addEventListener("click", toggleDark);
  id("regSubmit").addEventListener("click", registerUser);
  checkRegistration();

  // charts
  initCharts();

  // daily stack
  renderDailyStack();

  // comm page features
  setupCamera();
  id("startInterview").addEventListener("click", startInterviewFlow);
  id("endInterview").addEventListener("click", endInterviewFlow);
}

function id(s) {
  return document.getElementById(s);
}

function showPage(p) {
  document
    .querySelectorAll(".page")
    .forEach((el) => el.classList.add("hidden"));
  id(p).classList.remove("hidden");
  document
    .querySelectorAll(".topbar .btn")
    .forEach((b) => b.classList.remove("active"));
  id(p === "home" ? "navHome" : "navComm").classList.add("active");
}

function toggleDark() {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") === "dark") {
    root.removeAttribute("data-theme");
    id("darkToggle").textContent = "🌙";
  } else {
    root.setAttribute("data-theme", "dark");
    id("darkToggle").textContent = "☀️";
  }
}

function checkRegistration() {
  const saved = localStorage.getItem("comm_user");
  const welcomeEl = document.querySelector(".welcome");
  if (saved) {
    currentUser = JSON.parse(saved);
    showToast(`Welcome back, ${currentUser.name}`);
    welcomeEl.textContent = "Welcome " + currentUser.name;
    fetchProfileStats();
  } else {
    id("regModal").classList.remove("hidden");
  }
}

async function registerUser() {
  const name = id("regName").value.trim();

  if (!name) {
    showToast("Please enter your name");
    return;
  }

  const userId = "U" + Date.now(); // MUST match backend "userId"
  console.log("🆔 Generated User ID:", userId);

  // Build params EXACTLY matching backend
  const params = new URLSearchParams({
    action: "register",
    userid: userId, // MUST be `userid` for backend
    name: name,
    branch: "",
    sem: "",
  });

  const url = `${APPS_SCRIPT_URL}?${params.toString()}`;
  console.log("🌐 Registration URL:", url);

  try {
    const res = await fetch(url);
    console.log("📥 Raw fetch response:", res);

    const data = await res.json();
    console.log("📥 Parsed JSON response:", data);

    if (data.ok) {
      console.log("✅ Registration OK — saving user:", data.user);

      currentUser = data.user;
      localStorage.setItem("comm_user", JSON.stringify(currentUser));

      // Close modal
      id("regModal").classList.add("hidden");

      showToast("Registration successful");
      fetchProfileStats();
    } else {
      console.warn("⚠ Registration failed:", data);
      showToast("Failed to register: " + (data.error || ""));
    }
  } catch (err) {
    console.error("❌ Network error during register:", err);
    showToast("Network error while registering");
  }
}

/* ----- CHARTS & HOME DATA ----- */
let scoreChart, pieChart;
async function initCharts() {
  // =======================
  // 1. DEFAULT CHART VALUES
  // =======================
  let defaultLabels = [
    "13.10.2025",
    "14.10.2025",
    "18.10.2025",
    "18.10.2025",
    "21.10.2025",
    "21.10.2025",
    "22.11.2025",
  ];

  let defaultScores = [88, 56, 29, 78, 60, 72, 74];

  // ==================================================
  // 2. TRY FETCHING REAL SCORE HISTORY FROM DATABASE
  // ==================================================
  let finalLabels = defaultLabels;
  let finalScores = defaultScores;

  try {
    const scoreResp = await fetch(
      `${APPS_SCRIPT_URL}?action=scores&userid=${currentUser.id}`
    );

    const scoreJson = await scoreResp.json();

    // Expecting: { ok:true, labels: [...], scores: [...] }
    if (
      scoreJson.ok &&
      Array.isArray(scoreJson.labels) &&
      Array.isArray(scoreJson.scores) &&
      scoreJson.labels.length === scoreJson.scores.length &&
      scoreJson.scores.length > 0
    ) {
      finalLabels = scoreJson.labels;
      finalScores = scoreJson.scores;
    }
  } catch (err) {
    console.error("Failed to fetch score history:", err);
  }

  // ==============================
  // 3. BUILD THE SCORE LINE CHART
  // ==============================
  const ctx = id("scoreChart").getContext("2d");

  scoreChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: finalLabels,
      datasets: [
        {
          label: "Score",
          data: finalScores,
          fill: false,
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 10 } },
      },
    },
  });

  const pctx = id("pieChart").getContext("2d");
  pieChart = new Chart(pctx, {
    type: "doughnut", // change type to doughnut
    data: {
      labels: [
        "Genral Talk",
        "Technical Talk",
        "Interview Skills",
        "Current Affairs",
      ],
      datasets: [
        {
          data: [10, 12, 10, 8], // default data],
          backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      cutout: "50%", // 50% inner radius for donut effect
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });

  //suggestion box default
  try {
    const reviewResp = await fetch(
      `${APPS_SCRIPT_URL}?action=suggestion&userid=${currentUser.id}`
    );

    const reviewJson = await reviewResp.json();

    if (reviewJson.ok && reviewJson.feedback && reviewJson.feedback.feedback) {
      // Override default only when real feedback exists
      id("suggestionBox").textContent = reviewJson.feedback.feedback;
    } else {
      id("suggestionBox").textContent = `Strengths:
- Clear structure in answers
- Good factual recall

Areas to improve:
- Use more varied connectors & idiomatic phrases
- Pronunciation: attention to vowel sounds /tʃ/ vs /t/ etc.
`;
    }
  } catch (err) {
    console.error("Failed to load suggestion feedback:", err);
  }
}

function renderDailyStack() {
  const container = id("dailyStack");
  container.innerHTML = "";
  for (let i = 0; i < 70; i++) {
    const d = document.createElement("div");
    if (Math.random() > 0.85) d.classList.add("active");
    container.appendChild(d);
  }
}

/* ----- PROFILE STATS Pull ----- */
async function fetchProfileStats() {
  if (!currentUser) return;
  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=stats&userId=${encodeURIComponent(
        currentUser.id
      )}`
    );
    const j = await res.json();
    if (j.ok) {
      // update charts if provided
      if (j.scores && j.scores.length) {
        scoreChart.data.labels = j.scores.map((s) => s.date);
        scoreChart.data.datasets[0].data = j.scores.map((s) => s.score);
        scoreChart.update();
      }
      if (j.pie) {
        pieChart.data.datasets[0].data = j.pie;
        pieChart.update();
      }
      if (j.suggestion) id("suggestionBox").textContent = j.suggestion;
    }
  } catch (e) {
    console.warn("stats error", e);
  }
}

/* ----- Communication: camera + speech ----- */
let localStream = null;
async function setupCamera() {
  let localStream = null; // store MediaStream reference

  const startBtn = id("startInterview");
  const endBtn = id("endInterview");
  const camPreview = id("camPreview");

  // Start Interview
  startBtn.addEventListener("click", async () => {
    try {
      // ONLY CAMERA
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      camPreview.srcObject = localStream;
      camPreview.play();

      showToast("Camera activated. Interview started.");

      startBtn.classList.add("hidden");
      endBtn.classList.remove("hidden");
    } catch (e) {
      console.warn("Camera error", e);
      showToast("Camera permission needed to start interview");
    }
  });

  // End Interview
  endBtn.addEventListener("click", () => {
    if (localStream) {
      // Stop all tracks (video + audio)
      localStream.getTracks().forEach((track) => track.stop());
      camPreview.srcObject = null;
      localStream = null;
    }

    showToast("Interview ended. Camera and microphone stopped.");

    // Toggle buttons
    endBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
  });
}

let recognition,
  isInterview = false,
  fullTranscript = "";
async function startInterviewFlow() {
  if (!currentUser) {
    showToast("Register first");
    return;
  }
  isInterview = true;
  fullTranscript = "";
  id("startInterview").classList.add("hidden");
  id("endInterview").classList.remove("hidden");
  id("transcriptText").textContent = "Interview started...\n";

  // main loop: request generated question, play TTS, capture response, repeat until user stops
  // main loop: request generated question, play TTS, capture response, repeat until user stops
  while (isInterview) {
    if (!isInterview) break;
    const topic = id("topicSelect").value;

    const qResp = await fetch(
      `${APPS_SCRIPT_URL}?action=question&userId=${currentUser.id}&topic=${topic}`
    );
    const qj = await qResp.json();
    if (!isInterview) break;
    if (!qj.ok) {
      showToast("Failed to fetch question");
      break;
    }

    const questionText = qj.question.question;
    appendTranscript("AI (Q): " + questionText);
    if (!isInterview) break;
    // TTS speak question
    await speakText(questionText);
    if (!isInterview) break;
    // Wait 2 seconds
    await delay(1000);
    if (!isInterview) break;
    // Speak prompt
    await speakText("Please give your answer.");
    if (!isInterview) break;
    // 🎤 Activate microphone AFTER TTS is fully finished
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    console.log("🎤 Microphone activated for answer capture.");
    const userAnswer = await captureUserSpeechOnce(micStream, 5000, 10000);
    console.log("User answer:", userAnswer);
    // Stop mic
    micStream.getTracks().forEach((t) => t.stop());
    if (!isInterview) break;
    appendTranscript("You: " + userAnswer);

    const payload = {
      userId: currentUser.id,
      transcriptSegment: questionText + "Answer: " + userAnswer,
    };
    console.log("Sending transcript payload:", payload);
    if (!isInterview) break;
    try {
      // const resp = await fetch(`${APPS_SCRIPT_URL}?action=saveTranscript`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(payload),
      // });
      // const json = await resp.json().catch(() => null);
      // console.log("Server response:", json);
      const qResp1 = await fetch(
        `${APPS_SCRIPT_URL}?action=saveTranscript&userid=${
          currentUser.id
        }&transcriptSegment=${questionText + "Answer: " + userAnswer}`
      );
      const qj1 = await qResp1.json();
      if (!isInterview) break;
      if (!qj1.ok) {
        console.log("Failed to send the transSegment");
      }
    } catch (err) {
      console.error("Failed to send transcript:", err);
    }
    if (!isInterview) break;
    await delay(600);
  }

  // after loop ends, request review
  const reviewResp = await fetch(
    `${APPS_SCRIPT_URL}?action=review&userid=${currentUser.id}`
  );
  const reviewJson = await reviewResp.json();
  if (reviewJson.ok) {
    id("feedbackBox").textContent = reviewJson.feedback.feedback;
    id("suggestionBox").textContent = reviewJson.feedback.feedback;
  } else {
    id("feedbackBox").textContent = "Could not generate feedback.";
  }
}

async function endInterviewFlow() {
  isInterview = false;
  id("startInterview").classList.remove("hidden");
  id("endInterview").classList.add("hidden");
  showToast("Interview ended. Generating feedback...");

  try {
    const qResp2 = await fetch(
      `${APPS_SCRIPT_URL}?action=markSession&userid=${currentUser.id}`
    );

    const qj2 = await qResp2.json();

    if (qj2.ok) {
      console.log("Successfully marked the latest session");
    } else {
      console.warn("markSession returned:", qj2);
    }
  } catch (err) {
    console.error("Failed to mark the latest session:", err);
  }
}

function appendTranscript(txt) {
  const el = id("transcriptText");
  el.textContent += txt + "\n\n";
  el.scrollTop = el.scrollHeight;
}

/* capture a single user answer using Web Speech API */
function captureUserSpeechOnce(micStream, maxSilence = 5000, maxTime = 10000) {
  return new Promise((resolve) => {
    if (!micStream || !(micStream instanceof MediaStream)) {
      console.error("Invalid micStream:", micStream);
      return resolve("");
    }

    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      const t = prompt("Type your response — speech recognition unsupported");
      return resolve(t || "");
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();

    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    let finalTranscript = "";
    let silenceTimer = null;

    function stopAll() {
      try {
        rec.onend = () => resolve(finalTranscript.trim());
        rec.stop();
      } catch {
        resolve(finalTranscript.trim());
      }
    }

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalTranscript += r[0].transcript + " ";
      }

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(stopAll, maxSilence);
    };

    rec.onerror = () => stopAll();

    rec.start();
    setTimeout(stopAll, maxTime);
  });
}

function speakText(text) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onend = () => {
      console.log("TTS finished");
      resolve();
    };

    speechSynthesis.speak(utterance);
  });
}

/* play base64 audio returned by server */
async function playBase64Audio(base64) {
  return new Promise((resolve) => {
    const audio = new Audio("data:audio/wav;base64," + base64);
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(() => {
      resolve();
    });
  });
}

/* small util */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function showToast(msg, t = 3000) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), t);
}
// let recognition1;
// let finalTranscript = "";
// let silenceTimer;

// function startUserSpeechCapture() {
//   return new Promise((resolve) => {
//     finalTranscript = "";

//     recognition1 = new (window.SpeechRecognition ||
//       window.webkitSpeechRecognition)();
//     recognition1.lang = "en-US";
//     recognition1.interimResults = true;
//     recognition1.continuous = true;

//     console.log("🎤 Listening started...");

//     recognition1.onresult = (event) => {
//       let interim = "";

//       for (let i = event.resultIndex; i < event.results.length; i++) {
//         const result = event.results[i];

//         if (result.isFinal) {
//           finalTranscript += result[0].transcript + " ";
//           console.log("📌 Final chunk:", result[0].transcript);
//         } else {
//           interim += result[0].transcript;
//         }
//       }

//       resetSilenceTimer(resolve);
//     };

//     recognition1.onerror = (e) => {
//       console.warn("rec error:", e);

//       // ignore Chrome "no-speech" error
//       if (e.error === "no-speech") return;

//       // otherwise end gracefully
//       if (recognition1 && recognition1.stop) recognition1.stop();
//       resolve(finalTranscript.trim());
//     };

//     recognition1.onend = () => {
//       // don't double resolve
//     };

//     recognition1.start();
//     resetSilenceTimer(resolve);
//   });
// }

// function resetSilenceTimer(resolve) {
//   if (silenceTimer) clearTimeout(silenceTimer);

//   silenceTimer = setTimeout(() => {
//     console.log("🔕 No speech detected for 5s. Stopping...");

//     if (recognition1 && typeof recognition1.stop === "function") {
//       recognition1.onend = () => resolve(finalTranscript.trim());
//       try {
//         recognition1.stop();
//       } catch {}
//     } else {
//       console.warn("⚠ recognition already stopped.");
//       resolve(finalTranscript.trim());
//     }
//   }, 5000);
// }
