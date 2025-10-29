import "./style.css";

const elements = {
    dialog: document.querySelector("dialog"),
    btnSettings: document.querySelector("#settings-btn"),
    btnClose: document.querySelector("#close-settings-btn"),
    timeInputs: document.querySelectorAll('input[type="number"]'),
    fontRadios: document.querySelectorAll('input[name="font"]'),
    settingsForm: document.querySelector("form"),
    body: document.body,
    tabList: document.querySelector("[role='tablist']"),
    tabs: document.querySelectorAll("[role='tab']"),
    tabPanels: document.querySelectorAll("[role='tabpanel']"),
};

const timeValues = {
    pomodoro: 25,
    "short-break": 5,
    "long-break": 15,
};

const timerStates = new Map();
let tabFocus = 0;
let sessionCount = parseInt(localStorage.getItem("sessionCount")) || 0;
let currentMode = "pomodoro"; // "pomodoro", "shortBreak", or "longBreak"

const FONT_MAP = {
    "kumbh-sans": "--font-kumbh",
    "roboto-slab": "--font-roboto",
    "space-mono": "--font-space-mono",
};

const COLOR_MAP = {
    coral: "--clr-coral-pink",
    cyan: "--clr-cyan",
    purple: "--clr-purple",
};

const stats = {
    pomodoro: parseInt(localStorage.getItem("pomodoroCount")) || 0,
    shortBreak: parseInt(localStorage.getItem("shortBreakCount")) || 0,
    longBreak: parseInt(localStorage.getItem("longBreakCount")) || 0,
};

function initializeTimerStates() {
    elements.tabPanels.forEach((panel) => {
        timerStates.set(panel.id, {
            interval: null,
            totalTime: 0,
            remainingTime: 0,
            isRunning: false,
        });
    });
}

function initializeProgressBar(panel) {
    const progressBar = panel.querySelector(".progressbar");
    Object.assign(progressBar, {
        role: "progressbar",
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": 100,
        "aria-live": "off",
        "aria-busy": "false",
    });
}

function updateTimerDisplay(panel) {
    const { remainingTime } = timerStates.get(panel.id);
    const minutes = Math.floor(remainingTime / 60)
        .toString()
        .padStart(2, "0");
    const seconds = (remainingTime % 60).toString().padStart(2, "0");

    const timeElement = panel.querySelector("time");
    const timeString = `${minutes}:${seconds}`;
    timeElement.textContent = timeString;
    timeElement.setAttribute("datetime", timeString);
}

function updateProgressBar(panel) {
    const { remainingTime, totalTime } = timerStates.get(panel.id);
    const circle = panel.querySelector("circle");
    const progressBar = panel.querySelector(".progressbar");
    const strokeDasharray = 440;
    const progress = 1 - remainingTime / totalTime;
    const progressPercentage = 100 - progress * 100;

    circle.style.strokeDashoffset = strokeDasharray * progress;
    progressBar.setAttribute("aria-valuenow", progressPercentage.toFixed(2));
}

function setTimerDuration(panel, minutes) {
    const state = timerStates.get(panel.id);
    clearInterval(state.interval);

    Object.assign(state, {
        totalTime: minutes * 60,
        remainingTime: minutes * 60,
        isRunning: false,
        interval: null,
    });

    updateTimerDisplay(panel);
    updateProgressBar(panel);
    panel.querySelector("button").textContent = "start";
}

function resetTimer(panel) {
    const type = getPanelType(panel);
    setTimerDuration(panel, timeValues[type]);
}

function resetAllTimersExcept(currentId) {
    elements.tabPanels.forEach((panel) => {
        if (panel.id !== currentId) resetTimer(panel);
    });
}

function startTimer(panel) {
    const state = timerStates.get(panel.id);
    const button = panel.querySelector("button");
    const progressBar = panel.querySelector(".progressbar");

    resetAllTimersExcept(panel.id);

    state.isRunning = true;
    progressBar.setAttribute("aria-busy", "true");

    state.interval = setInterval(() => {
        if (state.remainingTime > 0) {
            state.remainingTime--;
            updateTimerDisplay(panel);
            updateProgressBar(panel);
        } else {
            clearInterval(state.interval);
            Object.assign(state, { interval: null, isRunning: false });
            button.textContent = "restart";
            progressBar.setAttribute("aria-busy", "false");
            progressBar.setAttribute("aria-live", "polite");

            handleSessionComplete();
        }
    }, 1000);
}

function handleTimerButton(event) {
    const button = event.target;
    const panel = button.closest("[role='tabpanel']");
    const state = timerStates.get(panel.id);
    const progressBar = panel.querySelector(".progressbar");
    const label = button.textContent.trim().toLowerCase();

    switch (label) {
        case "start":
            button.textContent = "pause";
            startTimer(panel);
            break;
        case "pause":
            button.textContent = "start";
            clearInterval(state.interval);
            Object.assign(state, { interval: null, isRunning: false });
            progressBar.setAttribute("aria-busy", "false");
            progressBar.setAttribute("aria-live", "polite");
            break;
        case "restart":
            resetTimer(panel);
            break;
    }
}

function changeTabPanel(event) {
    const target = event.target;
    const container = target.closest("[role='tablist']").parentNode;

    container.querySelector("[aria-selected='true']").setAttribute("aria-selected", false);
    target.setAttribute("aria-selected", true);

    container.querySelectorAll("[role='tabpanel']").forEach((p) => p.classList.add("hidden"));
    container.querySelector(`#${target.getAttribute("aria-controls")}`).classList.remove("hidden");
}

function changeTabFocus(event) {
    const LEFT = 37,
        RIGHT = 39;
    if (![LEFT, RIGHT].includes(event.keyCode)) return;

    elements.tabs[tabFocus].setAttribute("tabindex", -1);
    tabFocus = (tabFocus + (event.keyCode === RIGHT ? 1 : -1) + elements.tabs.length) % elements.tabs.length;
    elements.tabs[tabFocus].setAttribute("tabindex", 0);
    elements.tabs[tabFocus].focus();
}

function getPanelType(panel) {
    if (panel.id.includes("1")) return "pomodoro";
    if (panel.id.includes("2")) return "short-break";
    return "long-break";
}

function loadSettings() {
    const defaultFont = "kumbh-sans";
    const defaultColor = "coral";

    elements.timeInputs.forEach((input) => {
        const saved = localStorage.getItem(input.id);
        if (saved !== null) {
            input.value = saved;
            timeValues[input.id] = parseInt(saved, 10);
        }
    });

    const savedFont = localStorage.getItem("font") || defaultFont;
    elements.body.style.setProperty("--font-body", `var(${FONT_MAP[savedFont]})`);
    document.querySelector(`input[name='font'][value='${savedFont}']`).checked = true;

    const savedColor = localStorage.getItem("color") || defaultColor;
    elements.body.style.setProperty("--selected-color", `var(${COLOR_MAP[savedColor]})`);
    document.querySelector(`input[name='color'][value='${savedColor}']`).checked = true;
}

function updateSettings() {
    elements.timeInputs.forEach((input) => {
        const value = parseInt(input.value, 10);
        timeValues[input.id] = value;
        localStorage.setItem(input.id, value);
    });

    const selectedFont = document.querySelector("input[name='font']:checked").value;
    elements.body.style.setProperty("--font-body", `var(${FONT_MAP[selectedFont]})`);
    localStorage.setItem("font", selectedFont);

    const selectedColor = document.querySelector("input[name='color']:checked").value;
    elements.body.style.setProperty("--selected-color", `var(${COLOR_MAP[selectedColor]})`);
    localStorage.setItem("color", selectedColor);

    elements.tabPanels.forEach((panel) => {
        const type = getPanelType(panel);
        setTimerDuration(panel, timeValues[type]);
    });
}

function updateStatsUI() {
    document.getElementById("pomodoro-count").textContent = stats.pomodoro;
    document.getElementById("shortbreak-count").textContent = stats.shortBreak;
    document.getElementById("longbreak-count").textContent = stats.longBreak;
}

function saveStats() {
    localStorage.setItem("pomodoroCount", stats.pomodoro);
    localStorage.setItem("shortBreakCount", stats.shortBreak);
    localStorage.setItem("longBreakCount", stats.longBreak);
}

function handleSessionComplete() {
    // Update stats
    handleSessionCompleteStats(currentMode);

    if (currentMode === "pomodoro") {
        sessionCount++;
        localStorage.setItem("sessionCount", sessionCount);

        if (sessionCount % 4 === 0) {
            // Every 4 pomodoros → long break
            switchMode("longBreak");
        } else {
            // Otherwise → short break
            switchMode("shortBreak");
        }
    } else {
        // After any break → back to pomodoro
        switchMode("pomodoro");
    }
}

function handleSessionCompleteStats(type) {
    if (type === "pomodoro") {
        stats.pomodoro++;
    } else if (type === "shortBreak") {
        stats.shortBreak++;
    } else if (type === "longBreak") {
        stats.longBreak++;
    }

    saveStats();
    updateStatsUI();
}

function switchMode(type) {
    currentMode = type;

    // Hide all panels
    document.querySelectorAll("[role='tabpanel']").forEach((panel) => {
        panel.classList.add("hidden");
    });

    // Show the active one
    const activePanel = document.querySelector(`[data-type='${type}']`);
    if (activePanel) activePanel.classList.remove("hidden");

    // Reset timer duration for the new mode
    setTimerDuration(activePanel, timeValues[type]);

    // Update tab button UI (if you have them)
    document.querySelectorAll("[role='tab']").forEach((tab) => {
        tab.setAttribute("aria-selected", tab.dataset.type === type ? "true" : "false");
    });

    // Optionally, visually update color scheme for each mode
    elements.body.style.setProperty("--selected-color", `var(${COLOR_MAP[type] || COLOR_MAP.default})`);
}

document.addEventListener("DOMContentLoaded", () => {
    initializeTimerStates();
    loadSettings();
    updateStatsUI();

    elements.tabPanels.forEach((panel) => {
        initializeProgressBar(panel);
        panel.querySelector("button").addEventListener("click", handleTimerButton);
        setTimerDuration(panel, timeValues[getPanelType(panel)]);
    });

    elements.tabList.addEventListener("keydown", changeTabFocus);
    elements.tabs.forEach((tab) => tab.addEventListener("click", changeTabPanel));
    elements.tabs[0].click();

    elements.btnSettings.addEventListener("click", () => {
        elements.timeInputs.forEach((input) => {
            input.value = timeValues[input.id];
            const wrapper = input.closest("div");
            const inc = wrapper.querySelector(".increase-btn");
            const dec = wrapper.querySelector(".decrease-btn");

            inc.onclick = () => (input.value = Math.min(+input.value + 1, +input.max));
            dec.onclick = () => (input.value = Math.max(+input.value - 1, +input.min));
        });
        elements.dialog.showModal();
    });

    elements.settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        updateSettings();
        elements.dialog.close();
    });

    elements.btnClose.addEventListener("click", () => elements.dialog.close());
});
