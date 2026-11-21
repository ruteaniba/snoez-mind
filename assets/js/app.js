let speechEnabled = true;
let childrenList = [];
let selectedChildId = "";
let gameState = null;
let appInitialized = false;

function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  const formLogin = document.getElementById("login-form");
  const formRegister = document.getElementById("register-form");
  const formRecover = document.getElementById("recover-form");
  const childForm = document.getElementById("child-form");
  const clientForm = document.getElementById("client-form");

  formLogin?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email")?.value.trim() || "";
    const pass = document.getElementById("login-pass")?.value || "";
    if (typeof loginUser === "function") {
      loginUser(email, pass);
    } else if (typeof showAlert === "function") {
      showAlert("auth-alert", "Erro ao carregar auth.js.");
    }
  });

  formRegister?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (typeof registerUser === "function") {
      registerUser(
        document.getElementById("reg-nome")?.value.trim() || "",
        document.getElementById("reg-email")?.value.trim() || "",
        document.getElementById("reg-whatsapp")?.value.trim() || "",
        document.getElementById("reg-pass")?.value || ""
      );
    }
  });

  formRecover?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (typeof recoverPassword === "function") {
      recoverPassword(document.getElementById("rec-email")?.value.trim() || "");
    }
  });

  childForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveChild();
  });

  clientForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveClient();
  });

  checkExistingSession();
}

async function checkExistingSession() {
  if (typeof sb === "undefined" || !sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && document.getElementById("app-section")) {
      const { data: profile } = await sb
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        const check = profile.role === "admin" ? { ok: true } : isAccessAllowed(profile);
        if (check.ok) {
          openWorkspace(profile);
        }
      }
    }
  } catch (err) {
    console.error("Erro ao verificar sessão:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function openWorkspace(profile) {
  document.getElementById("auth-section")?.classList.add("hidden");
  document.getElementById("app-section")?.classList.remove("hidden");
  const emailEl = document.getElementById("user-email");
  if (emailEl) emailEl.textContent = profile.email;
  if (profile.role === "admin") {
    document.getElementById("admin-link")?.classList.remove("hidden");
  }
  loadChildren();
  loadReports();
  loadClients();
}

function showAppAlert(msg, type = "success") {
  const el = document.getElementById("app-alert");
  if (!el) return;
  el.textContent = msg;
  el.className = `alert show ${type}`;
  setTimeout(() => el.classList.remove("show"), 3500);
}

function toggleSpeech() {
  speechEnabled = !speechEnabled;
  const span = document.getElementById("speech-status");
  if (span) span.textContent = speechEnabled ? "SIM" : "NÃO";
  if (speechEnabled) speak("Estímulo de fala ativado");
}

function speak(text) {
  if (!speechEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  window.speechSynthesis.speak(utter);
}

function switchTab(tab) {
  ["login-form", "register-form", "recover-form"].forEach(id => {
    document.getElementById(id)?.classList.add("hidden");
  });
  document.getElementById(`${tab}-form`)?.classList.remove("hidden");
  document.getElementById("auth-alert")?.classList.remove("show");
}

function switchWorkspaceTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  ["jogos", "criancas", "emocional"].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle("hidden", t !== tab);
  });
  if (tab === "criancas") {
    loadChildren();
    loadReports();
  } else if (tab === "emocional") {
    loadClients();
  }
}

function onChildChange() {
  selectedChildId = document.getElementById("active-child-select")?.value || "";
}

async function loadChildren() {
  if (!sb) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("criancas")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return;
  childrenList = data || [];

  const select = document.getElementById("active-child-select");
  if (select) {
    const prev = select.value;
    select.innerHTML = `<option value="">Sessão avulsa (sem criança vinculada)</option>` +
      childrenList.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}${c.diagnostico ? " (" + escapeHtml(c.diagnostico) + ")" : ""}</option>`).join("");
    if (prev && childrenList.some(c => c.id === prev)) select.value = prev;
    selectedChildId = select.value;
  }

  const tbody = document.getElementById("children-tbody");
  if (tbody) {
    tbody.innerHTML = childrenList.length === 0
      ? `<tr><td colspan="5">Nenhuma criança cadastrada ainda.</td></tr>`
      : childrenList.map(c => `
        <tr>
          <td><strong>${escapeHtml(c.nome)}</strong></td>
          <td>${c.idade || "-"}</td>
          <td>${escapeHtml(c.diagnostico || "-")}</td>
          <td>${escapeHtml(c.observacoes || "-")}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteChild('${c.id}')">Excluir</button></td>
        </tr>
      `).join("");
  }
}

async function saveChild() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const payload = {
    user_id: user.id,
    nome: document.getElementById("child-nome").value.trim(),
    idade: parseInt(document.getElementById("child-idade").value, 10) || null,
    diagnostico: document.getElementById("child-diag").value.trim() || null,
    observacoes: document.getElementById("child-obs").value.trim() || null
  };

  const { error } = await sb.from("criancas").insert(payload);
  if (error) return showAppAlert("Erro ao salvar criança: " + error.message, "error");
  document.getElementById("child-form").reset();
  showAppAlert("Criança cadastrada com sucesso!");
  loadChildren();
}

async function deleteChild(id) {
  const { error } = await sb.from("criancas").delete().eq("id", id);
  if (error) return showAppAlert("Erro ao remover: " + error.message, "error");
  showAppAlert("Registro removido.");
  loadChildren();
}

async function recordGameSession(jogo, acertos, tentativas, duracaoSeg) {
  if (!sb) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  await sb.from("sessoes_jogos").insert({
    user_id: user.id,
    crianca_id: selectedChildId || null,
    jogo,
    acertos,
    tentativas,
    duracao_seg: duracaoSeg
  });
  loadReports();
}

async function loadReports() {
  if (!sb) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("sessoes_jogos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const tbody = document.getElementById("reports-tbody");
  if (!tbody || error) return;

  const childMap = Object.fromEntries(childrenList.map(c => [c.id, c.nome]));
  const rows = data || [];
  tbody.innerHTML = rows.length === 0
    ? `<tr><td colspan="6">Nenhuma sessão registrada ainda. Jogue uma atividade para gerar relatório.</td></tr>`
    : rows.map(r => {
      const prec = r.tentativas > 0 ? Math.round((r.acertos / r.tentativas) * 100) : 0;
      const dt = new Date(r.created_at).toLocaleDateString("pt-BR");
      return `
        <tr>
          <td>${dt}</td>
          <td>${escapeHtml(childMap[r.crianca_id] || "Avulsa")}</td>
          <td>${escapeHtml(r.jogo)}</td>
          <td>${r.acertos} / ${r.tentativas}</td>
          <td><strong>${prec}%</strong></td>
          <td>${r.duracao_seg}s</td>
        </tr>
      `;
    }).join("");
}

async function loadClients() {
  if (!sb) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("clientes_emocionais")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const tbody = document.getElementById("clients-tbody");
  if (!tbody || error) return;

  const list = data || [];
  tbody.innerHTML = list.length === 0
    ? `<tr><td colspan="5">Nenhum cliente de terapia emocional cadastrado.</td></tr>`
    : list.map(cl => `
      <tr>
        <td><strong>${escapeHtml(cl.nome)}</strong></td>
        <td>${escapeHtml(cl.telefone || "-")}<br><small>${escapeHtml(cl.email || "")}</small></td>
        <td>${escapeHtml(cl.queixa_principal || "-")}</td>
        <td><small>${escapeHtml(cl.anamnese || "-")}</small></td>
        <td class="actions">
          <button class="btn btn-outline btn-sm" onclick='editClient(${JSON.stringify(cl).replace(/'/g, "'")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClient('${cl.id}')">Excluir</button>
        </td>
      </tr>
    `).join("");
}

function editClient(cl) {
  document.getElementById("client-id").value = cl.id;
  document.getElementById("client-nome").value = cl.nome || "";
  document.getElementById("client-tel").value = cl.telefone || "";
  document.getElementById("client-email").value = cl.email || "";
  document.getElementById("client-queixa").value = cl.queixa_principal || "";
  document.getElementById("client-anamnese").value = cl.anamnese || "";
  window.scrollTo({ top: document.getElementById("tab-emocional").offsetTop - 20, behavior: "smooth" });
}

function resetClientForm() {
  document.getElementById("client-id").value = "";
  document.getElementById("client-form").reset();
}

async function saveClient() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const id = document.getElementById("client-id").value;
  const payload = {
    user_id: user.id,
    nome: document.getElementById("client-nome").value.trim(),
    telefone: document.getElementById("client-tel").value.trim() || null,
    email: document.getElementById("client-email").value.trim() || null,
    queixa_principal: document.getElementById("client-queixa").value.trim() || null,
    anamnese: document.getElementById("client-anamnese").value.trim() || null,
    updated_at: new Date().toISOString()
  };

  const res = id
    ? await sb.from("clientes_emocionais").update(payload).eq("id", id)
    : await sb.from("clientes_emocionais").insert(payload);

  if (res.error) return showAppAlert("Erro ao salvar cliente: " + res.error.message, "error");
  resetClientForm();
  showAppAlert("Cliente e anamnese salvos com sucesso!");
  loadClients();
}

async function deleteClient(id) {
  const { error } = await sb.from("clientes_emocionais").delete().eq("id", id);
  if (error) return showAppAlert("Erro ao excluir cliente: " + error.message, "error");
  showAppAlert("Cliente removido.");
  loadClients();
}

function startGame(type) {
  const startedAt = Date.now();
  gameState = {
    type,
    startedAt,
    acertos: 0,
    tentativas: 0,
    selected: null,
    matchedIds: [],
    puzzleOrder: []
  };

  if (type === "pareamento_cores" || type === "pareamento_sobras") {
    const base = [
      { key: "Vermelho", color: "#EF4444", label: "Vermelho" },
      { key: "Azul", color: "#3B82F6", label: "Azul" },
      { key: "Amarelo", color: "#EAB308", label: "Amarelo" },
      { key: "Verde", color: "#22C55E", label: "Verde" }
    ];
    let items = [];
    base.forEach((b, idx) => {
      items.push({ id: `a-${idx}`, key: b.key, label: b.label, color: b.color });
      items.push({ id: `b-${idx}`, key: b.key, label: b.label, color: b.color });
    });
    if (type === "pareamento_sobras") {
      items.push({ id: "extra-1", key: "Roxo", label: "Roxo", color: "#A855F7" });
      items.push({ id: "extra-2", key: "Laranja", label: "Laranja", color: "#F97316" });
    }
    gameState.items = shuffle(items);
    gameState.totalPairs = base.length;
    speak(type === "pareamento_sobras" ? "Pareamento com sobras. Encontre os pares iguais." : "Pareamento colorido. Encontre as cores iguais.");
    renderPairGame();
  } else if (type === "quebra_cabeca") {
    gameState.pieces = [1, 2, 3, 4];
    gameState.puzzleOrder = shuffle([1, 2, 3, 4]);
    speak("Quebra-cabeça. Toque nas peças na ordem de 1 a 4.");
    renderPuzzleGame();
  } else if (type === "identificacao_imagem") {
    const bank = [
      { icon: "🐶", word: "Cachorro" },
      { icon: "🐱", word: "Gato" },
      { icon: "🍎", word: "Maçã" },
      { icon: "🚗", word: "Carro" },
      { icon: "⭐", word: "Estrela" }
    ];
    const target = bank[Math.floor(Math.random() * bank.length)];
    gameState.target = target;
    gameState.options = shuffle(bank);
    speak(`Encontre: ${target.word}`);
    renderIdentifyGame();
  } else if (type === "ligar_imagens") {
    const pairs = [
      { id: 1, left: "🔑", right: "🔒", label: "Chave e cadeado" },
      { id: 2, left: "🖌️", right: "🎨", label: "Pincel e tinta" },
      { id: 3, left: "🧦", right: "👟", label: "Meia e tênis" },
      { id: 4, left: "☀️", right: "🕶️", label: "Sol e óculos" }
    ];
    gameState.pairs = pairs;
    gameState.leftItems = shuffle(pairs.map(p => ({ id: p.id, icon: p.left, label: p.label })));
    gameState.rightItems = shuffle(pairs.map(p => ({ id: p.id, icon: p.right, label: p.label })));
    gameState.selectedLeft = null;
    speak("Ligue uma imagem a outra que combina.");
    renderConnectGame();
  } else if (type === "identificacao_conceitos") {
    const bank = [
      { display: "A", label: "Letra A" },
      { display: "7", label: "Número 7" },
      { display: "🔵", label: "Círculo azul" },
      { display: "🔺", label: "Triângulo" },
      { display: "🦋", label: "Borboleta" },
      { display: "🟨", label: "Quadrado amarelo" }
    ];
    const target = bank[Math.floor(Math.random() * bank.length)];
    gameState.target = target;
    gameState.options = shuffle(bank);
    speak(`Toque em: ${target.label}`);
    renderConceptsGame();
  }
}

function renderPairGame() {
  const board = document.getElementById("game-board");
  const title = gameState.type === "pareamento_sobras" ? "Pareamento com Sobras" : "Pareamento Colorido";
  board.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <strong>${title}</strong>
      <span>Acertos: ${gameState.matchedIds.length / 2} / ${gameState.totalPairs}</span>
    </div>
    <div class="tiles-grid">
      ${gameState.items.map(it => {
        const isMatched = gameState.matchedIds.includes(it.id);
        const isSel = gameState.selected === it.id;
        return `
          <button class="tile-btn ${isSel ? "selected" : ""} ${isMatched ? "matched" : ""}" onclick="clickPairTile('${it.id}')">
            <span style="width:28px;height:28px;border-radius:50%;background:${it.color};display:inline-block;border:1px solid rgba(0,0,0,0.15);"></span>
            <span>${it.label}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

async function clickPairTile(id) {
  if (gameState.matchedIds.includes(id) || gameState.selected === id) return;
  const clicked = gameState.items.find(x => x.id === id);
  speak(clicked.label);

  if (!gameState.selected) {
    gameState.selected = id;
    renderPairGame();
    return;
  }

  const prev = gameState.items.find(x => x.id === gameState.selected);
  gameState.tentativas += 1;
  gameState.selected = null;

  if (prev.key === clicked.key) {
    gameState.acertos += 1;
    gameState.matchedIds.push(prev.id, clicked.id);
    if (gameState.matchedIds.length / 2 === gameState.totalPairs) {
      const dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
      await recordGameSession(
        gameState.type === "pareamento_sobras" ? "Pareamento com Sobras" : "Pareamento Colorido",
        gameState.acertos,
        gameState.tentativas,
        dur
      );
      speak("Parabéns! Você concluiu o pareamento.");
      showAppAlert("Atividade concluída e salva no relatório!");
    }
  }
  renderPairGame();
}

function renderPuzzleGame() {
  const board = document.getElementById("game-board");
  const nextExpected = gameState.acertos + 1;
  board.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <strong>Quebra-Cabeça (Sequência 1 a 4)</strong>
      <span>Próxima peça: <strong>${nextExpected <= 4 ? nextExpected : "Concluído!"}</strong></span>
    </div>
    <div class="tiles-grid">
      ${gameState.puzzleOrder.map(num => {
        const done = num < nextExpected;
        return `
          <button class="tile-btn ${done ? "matched" : ""}" onclick="clickPuzzlePiece(${num})">
            <span style="font-size:1.8rem;">${num}</span>
            <small>Peça ${num}</small>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

async function clickPuzzlePiece(num) {
  const expected = gameState.acertos + 1;
  if (expected > 4) return;
  gameState.tentativas += 1;
  speak(`Peça ${num}`);
  if (num === expected) {
    gameState.acertos += 1;
    if (gameState.acertos === 4) {
      const dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
      await recordGameSession("Quebra-Cabeça", gameState.acertos, gameState.tentativas, dur);
      speak("Muito bem! Quebra-cabeça montado.");
      showAppAlert("Quebra-cabeça concluído e salvo no relatório!");
    }
  }
  renderPuzzleGame();
}

function renderIdentifyGame() {
  const board = document.getElementById("game-board");
  board.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <strong>Identificação de Imagem — Encontre: <span style="color:var(--gold-dark);">${gameState.target.word}</span></strong>
      <button class="btn btn-outline btn-sm" onclick="speak('${gameState.target.word}')">Ouvir palavra</button>
    </div>
    <div class="tiles-grid">
      ${gameState.options.map(opt => `
        <button class="tile-btn" onclick="clickIdentifyOption('${opt.word}')">
          <span style="font-size:2rem;">${opt.icon}</span>
        </button>
      `).join("")}
    </div>
  `;
}

async function clickIdentifyOption(word) {
  gameState.tentativas += 1;
  if (word === gameState.target.word) {
    gameState.acertos += 1;
    const dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
    await recordGameSession("Identificação de Imagem", gameState.acertos, gameState.tentativas, dur);
    speak(`Isso mesmo! ${word}`);
    showAppAlert(`Acertou (${word})! Salvo no relatório.`);
    setTimeout(() => startGame("identificacao_imagem"), 900);
  } else {
    speak("Tente novamente");
  }
}

function renderConnectGame() {
  const board = document.getElementById("game-board");
  board.innerHTML = `
    <strong>Ligar uma Imagem a Outra</strong>
    <p class="subtitle">Toque na imagem da esquerda e depois na imagem correspondente da direita.</p>
    <div class="grid-2">
      <div class="tiles-grid">
        ${gameState.leftItems.map(item => {
          const done = gameState.matchedIds.includes(item.id);
          const sel = gameState.selectedLeft === item.id;
          return `<button class="tile-btn ${sel ? "selected" : ""} ${done ? "matched" : ""}" onclick="selectLeft(${item.id})"><span style="font-size:1.8rem;">${item.icon}</span></button>`;
        }).join("")}
      </div>
      <div class="tiles-grid">
        ${gameState.rightItems.map(item => {
          const done = gameState.matchedIds.includes(item.id);
          return `<button class="tile-btn ${done ? "matched" : ""}" onclick="selectRight(${item.id})"><span style="font-size:1.8rem;">${item.icon}</span></button>`;
        }).join("")}
      </div>
    </div>
  `;
}

function selectLeft(id) {
  if (gameState.matchedIds.includes(id)) return;
  gameState.selectedLeft = id;
  renderConnectGame();
}

async function selectRight(id) {
  if (!gameState.selectedLeft || gameState.matchedIds.includes(id)) return;
  gameState.tentativas += 1;
  if (gameState.selectedLeft === id) {
    gameState.acertos += 1;
    gameState.matchedIds.push(id);
    speak("Boa ligação!");
    if (gameState.matchedIds.length === gameState.pairs.length) {
      const dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
      await recordGameSession("Ligar uma Imagem a Outra", gameState.acertos, gameState.tentativas, dur);
      showAppAlert("Todas as ligações concluídas e salvas no relatório!");
    }
  } else {
    speak("Não combina. Tente outro par.");
  }
  gameState.selectedLeft = null;
  renderConnectGame();
}

function renderConceptsGame() {
  const board = document.getElementById("game-board");
  board.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <strong>Identificação — Toque em: <span style="color:var(--gold-dark);">${gameState.target.label}</span></strong>
      <button class="btn btn-outline btn-sm" onclick="speak('${gameState.target.label}')">Ouvir</button>
    </div>
    <div class="tiles-grid">
      ${gameState.options.map(opt => `
        <button class="tile-btn" onclick="clickConceptOption('${opt.label}')">
          <span style="font-size:1.8rem;">${opt.display}</span>
        </button>
      `).join("")}
    </div>
  `;
}

async function clickConceptOption(label) {
  gameState.tentativas += 1;
  if (label === gameState.target.label) {
    gameState.acertos += 1;
    const dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
    await recordGameSession("Identificação (Letras/Números/Cores/Formas)", gameState.acertos, gameState.tentativas, dur);
    speak(`Muito bem! ${label}`);
    showAppAlert(`Acertou (${label})! Salvo no relatório.`);
    setTimeout(() => startGame("identificacao_conceitos"), 900);
  } else {
    speak("Tente de novo");
  }
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}
