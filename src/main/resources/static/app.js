/* ============================================================
   OracleBot — Web UI (app.js)
   Conecta con los mismos endpoints REST que usa el bot Telegram:
     POST /api/tasks          → crear tarea
     GET  /api/tasks          → listar tareas
     POST /api/assistant/chat → enviar mensaje al agente
   ============================================================ */

const taskList         = document.getElementById("task-list");
const taskForm         = document.getElementById("task-form");
const refreshTasksBtn  = document.getElementById("refresh-tasks");
const submitTaskBtn    = document.getElementById("submit-task-btn");
const taskFeedback     = document.getElementById("task-form-feedback");
const taskLoading      = document.getElementById("task-loading");
const taskEmpty        = document.getElementById("task-empty");

const chatMessages     = document.getElementById("chat-messages");
const chatForm         = document.getElementById("chat-form");
const chatInput        = document.getElementById("chat-input");
const chatSendBtn      = document.getElementById("chat-send-btn");
const clearChatBtn     = document.getElementById("clear-chat");

// ─── Helpers ──────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showFeedback(msg, type = "success") {
  taskFeedback.textContent = msg;
  taskFeedback.className = "form-feedback " + type;
  setTimeout(() => { taskFeedback.textContent = ""; taskFeedback.className = "form-feedback"; }, 3500);
}

function setTaskLoading(show) {
  taskLoading.hidden = !show;
}

// ─── Tasks ────────────────────────────────────────────────────────

async function fetchTasks() {
  setTaskLoading(true);
  taskEmpty.hidden = true;
  taskList.innerHTML = "";
  try {
    const res = await fetch("/api/tasks");
    if (!res.ok) throw new Error("Error al cargar tareas");
    const tasks = await res.json();
    renderTasks(tasks);
  } catch (err) {
    taskList.innerHTML = `<p style="color:var(--danger);font-size:14px">${escapeHtml(err.message)}</p>`;
  } finally {
    setTaskLoading(false);
  }
}

function statusLabel(status) {
  const map = { DONE: "✓ Done", IN_PROGRESS: "⏳ En Progreso", PENDING: "○ Pendiente" };
  return map[status] ?? status;
}

function renderTasks(tasks) {
  if (!tasks.length) {
    taskEmpty.hidden = false;
    return;
  }
  tasks.forEach((task) => {
    const badgeClass = task.status === "DONE" ? "done"
      : task.status === "IN_PROGRESS"          ? "progress"
      : "pending";

    const card = document.createElement("article");
    card.className = "task-card";
    card.innerHTML = `
      <div class="task-card-top">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="badge ${badgeClass}">${escapeHtml(statusLabel(task.status))}</span>
      </div>
      <div class="task-meta">
        <span>👤 ${escapeHtml(task.assignee)}</span>
        <span>⚡ ${escapeHtml(String(task.storyPoints))} pts</span>
        <span>📅 ${escapeHtml(task.sprintName)}</span>
        ${task.dueDate ? `<span>🗓 ${escapeHtml(task.dueDate)}</span>` : ""}
      </div>
    `;
    taskList.appendChild(card);
  });
}

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  if (!title) {
    showFeedback("El título es obligatorio.", "error");
    return;
  }

  submitTaskBtn.disabled = true;
  submitTaskBtn.textContent = "Creando…";
  try {
    const payload = {
      title,
      assignee: document.getElementById("assignee").value.trim() || "Sin asignar",
      storyPoints: Number(document.getElementById("storyPoints").value || 3),
      sprintName: document.getElementById("sprintName").value.trim() || "Sin sprint",
    };
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("No se pudo crear la tarea");
    taskForm.reset();
    showFeedback("✓ Tarea creada correctamente.", "success");
    await fetchTasks();
  } catch (err) {
    showFeedback(err.message, "error");
  } finally {
    submitTaskBtn.disabled = false;
    submitTaskBtn.innerHTML = "＋ Crear Tarea";
  }
});

refreshTasksBtn.addEventListener("click", fetchTasks);

// ─── Chat ─────────────────────────────────────────────────────────

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  appendMessage("user", message);
  chatInput.value = "";
  chatSendBtn.disabled = true;
  chatInput.disabled = true;

  const loadingMsg = appendMessage("loading", "Pensando…");

  try {
    const res = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("Error al contactar al agente");
    const data = await res.json();
    loadingMsg.remove();
    appendMessage("assistant", data.response);
    // Refresh task list after assistant interactions (may have created tasks)
    await fetchTasks();
  } catch (err) {
    loadingMsg.remove();
    appendMessage("error-msg", "⚠ " + err.message);
  } finally {
    chatSendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
});

document.querySelectorAll(".hint").forEach((btn) => {
  btn.addEventListener("click", () => {
    chatInput.value = btn.dataset.message;
    chatInput.focus();
  });
});

clearChatBtn.addEventListener("click", () => {
  chatMessages.innerHTML = "";
  appendMessage("assistant", "Hola. Puedo ayudarte con tareas, sprint y carga del equipo.");
});

// ─── Init ─────────────────────────────────────────────────────────
appendMessage("assistant", "Hola 👋 Puedo ayudarte con tareas, sprint y carga del equipo.\n\nUsa el chat o crea tareas con el formulario.");
fetchTasks();
