let childrenList = [];
let clientsCache = [];
let selectedChildId = "";
let gameState = null;
const CREDS_KEY = "snoezmind_saved_creds_v1";
const TARGET_CORRECT = 10;

// --- FUNÇÃO QUE ESTAVA FALTANDO PARA INICIAR OS JOGOS ---
function startGame(gameType) {
  document.getElementById("game-board").classList.remove("shake");
  const startObj = { startedAt: Date.now(), acertos: 0, tentativas: 0, totalAcertos: 0, totalTentativas: 0, levelCorrects: 0, level: 1, matchedIds: [], selected: null, selectedLeft: null, selectedPiece: null };

  if (gameType === "pareamento_cores") {
    var colors = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#A855F7", "#EC4899"];
    var icons = ["🍎", "🚗", "🐶", "⭐", "🌸", "⚽"];
    var items = [];
    for(var i=0; i<6; i++) {
      items.push({ id: "a"+i, color: colors[i], icon: icons[i] });
      items.push({ id: "b"+i, color: colors[i], icon: icons[i] });
    }
    gameState = { ...startObj, type: gameType, items: shuf(items) };
    renderPairGame();
  } 
  else if (gameType === "pareamento_sobras") {
    var targets = [
      { id: "t1", color: "#EF4444", key: "maçã", filled: false },
      { id: "t2", color: "#3B82F6", key: "carro", filled: false },
      { id: "t3", color: "#22C55E", key: "cachorro", filled: false }
    ];
    var pieces = [
      { id: "p1", color: "#EF4444", icon: "🍎", key: "maçã", placed: false },
      { id: "p2", color: "#3B82F6", icon: "🚗", key: "carro", placed: false },
      { id: "p3", color: "#22C55E", icon: "🐶", key: "cachorro", placed: false },
      { id: "p4", color: "#EAB308", icon: "⭐", key: "estrela", placed: false },
      { id: "p5", color: "#A855F7", icon: "🌸", key: "flor", placed: false }
    ];
    gameState = { ...startObj, type: gameType, targets: targets, pieces: shuf(pieces) };
    renderSobrasGame();
  }
  else if (gameType === "quebra_cabeca") {
    startRealPuzzle();
  }
  else if (gameType === "identificacao_imagem") {
    var bank = [
      { icon: "🐶", word: "Cachorro" }, { icon: "🐱", word: "Gato" }, { icon: "🍎", word: "Maçã" }, { icon: "🚗", word: "Carro" },
      { icon: "⭐", word: "Estrela" }, { icon: "🐘", word: "Elefante" }, { icon: "🍌", word: "Banana" }, { icon: "✈️", word: "Avião" }
    ];
    var options = shuf(bank).slice(0, 4);
    gameState = { ...startObj, type: gameType, options: options, target: options[Math.floor(Math.random() * options.length)] };
    renderIdentifyGame();
  }
  else if (gameType === "ligar_imagens") {
    var leftItems = [{ id: 1, icon: "🔑" }, { id: 2, icon: "🐟" }, { id: 3, icon: "☕" }, { id: 4, icon: "🎈" }];
    var rightItems = [{ id: 1, icon: "🔒" }, { id: 2, icon: "🌊" }, { id: 3, icon: "🥛" }, { id: 4, icon: "🎉" }];
    gameState = { ...startObj, type: gameType, leftItems: leftItems, rightItems: shuf(rightItems), pairs: leftItems };
    renderConnectGame();
  }
  else if (gameType === "identificacao_conceitos") {
    var cBank = [
      { display: "A", label: "Letra A" }, { display: "7", label: "Número 7" }, { display: "🔵", label: "Círculo azul" },
      { display: "🔺", label: "Triângulo" }, { display: "🦋", label: "Borboleta" }, { display: "🟨", label: "Quadrado amarelo" }
    ];
    var opts = shuf(cBank).slice(0, 6);
    gameState = { ...startObj, type: gameType, options: opts, target: opts[Math.floor(Math.random() * opts.length)] };
    renderConceptsGame();
  }
}

function playTone(freq, type, duration, volume = 0.1) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playSuccess() { 
  playTone(523.25, "sine", 0.4, 0.08); 
  setTimeout(() => playTone(659.25, "sine", 0.4, 0.08), 100); 
  setTimeout(() => playTone(783.99, "sine", 0.6, 0.08), 200); 
}

function playError() { 
  playTone(180, "triangle", 0.3, 0.06); 
}

async function finishGame(gameName, acertos, tentativas, duration) {
  const score = tentativas > 0 ? Math.min(100, Math.round((acertos / tentativas) * 100)) : 0;
  playSuccess();
  
  const overlay = document.createElement("div");
  overlay.className = "game-modal-overlay";
  overlay.style.cssText = "position:fixed; top:15px; left:0; width:100%; display:flex; justify-content:center; z-index:9999; pointer-events:none; opacity:0; transition:opacity 0.3s;";
  
  overlay.innerHTML = `
    <div class="game-modal" style="background:#fff; padding:15px 20px; border-radius:10px; text-align:center; max-width:400px; width:90%; box-shadow:0 4px 15px rgba(0,0,0,0.3); border:2px solid #EAB308; pointer-events:auto;">
      <h2 style="margin-top:0; margin-bottom:5px; font-size:1.2rem; color:#333;">Fim do Jogo!</h2>
      <p style="margin:5px 0; color:#555;"><strong>${gameName}</strong></p>
      <div class="score" style="font-size:1.8rem; font-weight:bold; color:#EAB308; margin:5px 0;">${score}%</div>
      <p style="margin:5px 0; font-size:0.9rem; color:#666;">Acertos: ${acertos} | Erros: ${Math.max(0, tentativas - acertos)} | Tempo: ${duration}s</p>
      <div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
        <button class="btn btn-gold btn-sm" onclick="this.closest('.game-modal-overlay').remove(); startGame('${gameName.toLowerCase().includes('identifica') ? 'identificacao_imagem' : (gameName.toLowerCase().includes('conceito') ? 'identificacao_conceitos' : (gameName.toLowerCase().includes('quebra') ? 'quebra_cabeca' : 'pareamento_cores'))}')">Jogar Novamente</button>
        <button class="btn btn-outline btn-sm" onclick="this.closest('.game-modal-overlay').remove();">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.style.opacity = "1", 10);
  await recordGameSession(gameName, acertos, tentativas, duration);
}

function setAuthAlert(msg, isOk) {
  const el = document.getElementById("auth-alert");
  if (!el) return;
  el.textContent = msg;
  el.className = "alert show " + (isOk ? "success" : "error");
}

function applySavedCredsToForm() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (document.getElementById("login-email") && parsed.email) document.getElementById("login-email").value = parsed.email;
    if (document.getElementById("login-pass") && parsed.password) document.getElementById("login-pass").value = parsed.password;
    if (document.getElementById("save-creds-checkbox")) document.getElementById("save-creds-checkbox").checked = true;
  } catch (e) {}
}

function saveOrClearCreds(email, password) {
  const chk = document.getElementById("save-creds-checkbox");
  try {
    if (chk && chk.checked) localStorage.setItem(CREDS_KEY, JSON.stringify({ email, password }));
    else localStorage.removeItem(CREDS_KEY);
  } catch (e) {}
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function shuf(arr) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy;
}

function switchTab(tab) {
  ["login-form", "register-form", "recover-form"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  var target = document.getElementById(tab + "-form");
  if (target) target.classList.remove("hidden");
  var alertEl = document.getElementById("auth-alert");
  if (alertEl) alertEl.classList.remove("show");
}

function switchWorkspaceTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(function(btn) {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
  });
  ["jogos", "emocional"].forEach(function(t) {
    var sec = document.getElementById("tab-" + t);
    if (sec) sec.classList.toggle("hidden", t !== tab);
  });
  if (tab === "emocional") { 
    loadAnamneseModels();
    loadAnamneseResponses(); 
  }
}

function showAppAlert(msg, type) {
  var el = document.getElementById("app-alert");
  if (!el) return;
  el.textContent = msg;
  el.className = "alert show " + (type || "success");
  setTimeout(function() { el.classList.remove("show"); }, 3500);
}

function onChildChange() {
  selectedChildId = document.getElementById("active-child-select")?.value || "";
}

function openWorkspace(profile) {
  document.getElementById("auth-section")?.classList.add("hidden");
  document.getElementById("app-section")?.classList.remove("hidden");
  var emailEl = document.getElementById("user-email");
  if (emailEl && profile) emailEl.textContent = profile.email || "";
  if (profile && profile.role === "admin") document.getElementById("admin-link")?.classList.remove("hidden");
  
  loadAnamneseModels();
  loadAnamneseResponses(); 
}

async function logoutUser() {
  if (typeof sb !== "undefined" && sb && sb.auth) await sb.auth.signOut();
  window.location.href = "index.html";
}

async function handleLoginSubmit() {
  var email = (document.getElementById("login-email")?.value || "").trim();
  var password = document.getElementById("login-pass")?.value || "";
  if (typeof sb === "undefined" || !sb || !sb.auth) return setAuthAlert("Erro: cliente Supabase não inicializado.", false);
  saveOrClearCreds(email, password);
  setAuthAlert("A verificar credenciais...", true);
  try {
    var res = await sb.auth.signInWithPassword({ email: email, password: password });
    if (res.error) return setAuthAlert("Erro ao entrar: " + res.error.message, false);
    var profRes = await sb.from("profiles").select("*").eq("id", res.data.user.id).single();
    var profile = profRes.data;
    if (profRes.error || !profile) return setAuthAlert("Autenticado, mas sem perfil.", false);
    if (profile.role === "admin") { window.location.href = "admin.html"; return; }
    if (!profile.ativo) { await sb.auth.signOut(); return setAuthAlert("A sua conta ainda não foi ativada.", false); }
    var today = new Date().toISOString().split("T")[0];
    if (profile.data_inicio && today < profile.data_inicio) { await sb.auth.signOut(); return setAuthAlert("Acesso será liberado em " + profile.data_inicio, false); }
    if (profile.data_fim && today > profile.data_fim) { await sb.auth.signOut(); return setAuthAlert("Acesso expirou em " + profile.data_fim, false); }
    openWorkspace(profile);
  } catch (err) { setAuthAlert("Falha no login: " + (err && err.message ? err.message : err), false); }
}

async function handleRegisterSubmit() {
  var nome = (document.getElementById("reg-nome")?.value || "").trim();
  var email = (document.getElementById("reg-email")?.value || "").trim();
  var whatsapp = (document.getElementById("reg-whatsapp")?.value || "").replace(/\D/g, "");
  var password = document.getElementById("reg-pass")?.value || "";
  if (typeof sb === "undefined" || !sb || !sb.auth) return setAuthAlert("Erro: cliente Supabase não inicializado.", false);
  setAuthAlert("A enviar cadastro...", true);
  try {
    var res = await sb.auth.signUp({ email, password, options: { data: { nome, whatsapp } } });
    if (res.error) return setAuthAlert("Erro: " + res.error.message, false);
    setAuthAlert("Cadastro enviado! Aguarde a ativação.", true);
  } catch (err) { setAuthAlert("Falha inesperada: " + err.message, false); }
}

async function handleRecoverSubmit() {
  var email = (document.getElementById("rec-email")?.value || "").trim();
  if (typeof sb === "undefined" || !sb || !sb.auth) return setAuthAlert("Erro: cliente Supabase não inicializado.", false);
  var basePath = window.location.pathname.replace(/\/[^/]*$/, "/");
  var res = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + basePath + "redefinir-senha.html" });
  if (res.error) return setAuthAlert("Erro: " + res.error.message, false);
  setAuthAlert("Enviámos uma ligação para o seu e-mail.", true);
}

async function loadChildren() {
  if (typeof sb === "undefined" || !sb) return;
  var uRes = await sb.auth.getUser(); var user = uRes && uRes.data ? uRes.data.user : null;
  if (!user) return;
  var res = await sb.from("criancas").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  childrenList = res.data || [];
  var sel = document.getElementById("active-child-select");
  if (sel) {
    var prev = sel.value;
    var opts = ['<option value="">Sessão avulsa (sem paciente vinculado)</option>'];
    childrenList.forEach(function(c) { opts.push('<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.nome) + (c.diagnostico ? " (" + escapeHtml(c.diagnostico) + ")" : "") + "</option>"); });
    sel.innerHTML = opts.join("");
    if (prev && childrenList.some(function(c) { return c.id === prev; })) sel.value = prev;
    selectedChildId = sel.value;
  }
  var tbody = document.getElementById("children-tbody");
  if (tbody) {
    if (childrenList.length === 0) tbody.innerHTML = '<tr><td colspan="5">Nenhum paciente cadastrado.</td></tr>';
    else {
      var rows = [];
      childrenList.forEach(function(c) { rows.push('<tr><td><strong>' + escapeHtml(c.nome) + '</strong></td><td>' + escapeHtml(c.idade || "-") + '</td><td>' + escapeHtml(c.diagnostico || "-") + '</td><td>' + escapeHtml(c.observacoes || "-") + '</td><td><button type="button" class="btn btn-danger btn-sm" onclick="deleteChild(\'' + escapeHtml(c.id) + '\')">Excluir</button></td></tr>'); });
      tbody.innerHTML = rows.join("");
    }
  }
}

async function saveChild() {
  if (typeof sb === "undefined" || !sb) return;
  var uRes = await sb.auth.getUser(); var user = uRes && uRes.data ? uRes.data.user : null;
  if (!user) return showAppAlert("Faça login para salvar.", "error");
  var payload = { user_id: user.id, nome: (document.getElementById("child-nome")?.value || "").trim(), idade: parseInt(document.getElementById("child-idade")?.value, 10) || null, diagnostico: (document.getElementById("child-diag")?.value || "").trim() || null, observacoes: (document.getElementById("child-obs")?.value || "").trim() || null };
  var res = await sb.from("criancas").insert(payload);
  if (res.error) return showAppAlert("Erro: " + res.error.message, "error");
  document.getElementById("child-form")?.reset(); showAppAlert("Paciente cadastrado!"); loadChildren();
}

async function deleteChild(id) {
  if (typeof sb === "undefined" || !sb) return;
  var res = await sb.from("criancas").delete().eq("id", id);
  if (res.error) return showAppAlert("Erro: " + res.error.message, "error");
  showAppAlert("Removido."); loadChildren();
}

async function recordGameSession(jogo, acertos, tentativas, duracaoSeg) {
  if (typeof sb === "undefined" || !sb) return;
  var uRes = await sb.auth.getUser(); var user = uRes && uRes.data ? uRes.data.user : null;
  if (!user) return;
  await sb.from("sessoes_jogos").insert({ user_id: user.id, crianca_id: selectedChildId || null, jogo: jogo, acertos: acertos, tentativas: tentativas, duracao_seg: duracaoSeg });
  loadReports();
}

async function loadReports() {
  if (typeof sb === "undefined" || !sb) return;
  var uRes = await sb.auth.getUser(); var user = uRes && uRes.data ? uRes.data.user : null;
  if (!user) return;
  var res = await sb.from("sessoes_jogos").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  var tbody = document.getElementById("reports-tbody");
  if (!tbody) return;
  var childMap = {}; childrenList.forEach(function(c) { childMap[c.id] = c.nome; });
  var rows = res.data || [];
  if (rows.length === 0) tbody.innerHTML = '<tr><td colspan="6">Nenhuma sessão registrada.</td></tr>';
  else {
    var htmlRows = [];
    rows.forEach(function(r) { var prec = r.tentativas > 0 ? Math.round((r.acertos / r.tentativas) * 100) : 0; var dt = new Date(r.created_at).toLocaleDateString("pt-BR"); htmlRows.push('<tr><td>' + dt + '</td><td>' + escapeHtml(childMap[r.crianca_id] || "Avulsa") + '</td><td>' + escapeHtml(r.jogo) + '</td><td>' + r.acertos + ' / ' + r.tentativas + '</td><td><strong>' + prec + '%</strong></td><td>' + r.duracao_seg + 's</td></tr>'); });
    tbody.innerHTML = htmlRows.join("");
  }
}

function renderPairGame() {
  var board = document.getElementById("game-board");
  var btns = [];
  gameState.items.forEach(function(it) {
    var isMatched = gameState.matchedIds.indexOf(it.id) !== -1;
    var isSel = gameState.selected === it.id;
    btns.push('<button type="button" class="tile-btn ' + (isSel ? "selected" : "") + ' ' + (isMatched ? "matched" : "") + '" style="border: 3px solid ' + it.color + ';" onclick="clickPairTile(\'' + it.id + '\')"><span style="font-size:2.5rem;">' + it.icon + '</span></button>');
  });
  board.innerHTML = '<div style="text-align:center; margin-bottom:15px; color:#555; font-weight:bold;">Encontre os pares de objetos iguais!</div><div class="tiles-grid">' + btns.join("") + '</div>';
}

function clickPairTile(id) {
  if (gameState.matchedIds.indexOf(id) !== -1) return;
  if (!gameState.selected) {
    gameState.selected = id; renderPairGame();
  } else if (gameState.selected === id) {
    gameState.selected = null; renderPairGame();
  } else {
    var item1 = gameState.items.find(function(i) { return i.id === gameState.selected; });
    var item2 = gameState.items.find(function(i) { return i.id === id; });
    gameState.tentativas++;
    if (item1.color === item2.color) {
      gameState.acertos++; gameState.matchedIds.push(gameState.selected); gameState.matchedIds.push(id); playSuccess();
      if (gameState.matchedIds.length === gameState.items.length) {
        var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
        finishGame("Pareamento Colorido", gameState.acertos, gameState.tentativas, dur);
      }
    } else {
      playError(); document.getElementById("game-board").classList.add("shake");
      setTimeout(() => document.getElementById("game-board").classList.remove("shake"), 300);
    }
    gameState.selected = null; renderPairGame();
  }
}

function renderSobrasGame() {
  var board = document.getElementById("game-board");
  var targetHtml = gameState.targets.map(function(t) {
     return '<div style="width:70px; height:70px; border:3px dashed ' + t.color + '; border-radius:10px; display:flex; justify-content:center; align-items:center; background:' + (t.filled ? t.color : '#fff') + '; cursor:pointer;" onclick="clickSobrasTarget(\'' + t.id + '\')">' +
            (t.filled ? '<span style="font-size:2rem; color:#fff;">✔️</span>' : '') + '</div>';
  }).join('');

  var pieceHtml = gameState.pieces.map(function(p) {
     if (p.placed) return '';
     var isSel = gameState.selectedPiece === p.id;
     return '<button type="button" class="tile-btn ' + (isSel ? "selected" : "") + '" style="border: 3px solid ' + p.color + ';" onclick="clickSobrasPiece(\'' + p.id + '\')"><span style="font-size:2.5rem;">' + p.icon + '</span></button>';
  }).join('');

  board.innerHTML = `
    <div style="text-align:center; margin-bottom:15px; color:#555; font-weight:bold; line-height:1.4;">
      Selecione um objeto abaixo e clique na cor correspondente.<br>
      <span style="font-size:0.9rem; font-weight:normal; color:#888;">Deixe as peças que não têm par de lado (sobras).</span>
    </div>
    <div style="display:flex; justify-content:center; gap:15px; margin-bottom:30px; flex-wrap:wrap; padding:15px; background:#f9f9f9; border-radius:10px;">
      ${targetHtml}
    </div>
    <div class="tiles-grid">
      ${pieceHtml}
    </div>
  `;
}

function clickSobrasPiece(id) {
  var piece = gameState.pieces.find(function(p) { return p.id === id; });
  if (!piece || piece.placed) return;
  gameState.selectedPiece = id;
  renderSobrasGame();
}

async function clickSobrasTarget(targetId) {
  if (!gameState.selectedPiece) return;
  var target = gameState.targets.find(function(t) { return t.id === targetId; });
  var piece = gameState.pieces.find(function(p) { return p.id === gameState.selectedPiece; });
  if (!target || !piece || target.filled) return;

  gameState.tentativas++;
  if (piece.key === target.key) {
    gameState.acertos++;
    gameState.levelCorrects++;
    piece.placed = true;
    target.filled = true;
    gameState.selectedPiece = null;
    playSuccess();

    if (gameState.targets.every(function(t) { return t.filled; })) {
       var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
       finishGame("Pareamento com Sobras", gameState.acertos, gameState.tentativas, dur);
    } else {
       renderSobrasGame();
    }
  } else {
     playError();
     document.getElementById("game-board").classList.add("shake");
     setTimeout(() => document.getElementById("game-board").classList.remove("shake"), 300);
     gameState.selectedPiece = null;
     renderSobrasGame();
  }
}

let puzzlePieces = []; let puzzleSolved = false;
const puzzleImages = [
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=400&fit=crop"
];

function startRealPuzzle() {
  gameState = { type: "quebra_cabeca", level: 1, startedAt: Date.now(), acertos: 0, tentativas: 0, levelCorrects: 0 };
  puzzleSolved = false;
  gameState.currentPuzzleImage = puzzleImages[Math.floor(Math.random() * puzzleImages.length)];
  puzzlePieces = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
  renderRealPuzzle();
}

function renderRealPuzzle() {
  const board = document.getElementById("game-board");
  const imgUrl = gameState.currentPuzzleImage || puzzleImages[0];
  let html = `
    <div style="text-align:center; margin-bottom:15px;">
      <button class="btn btn-outline btn-sm" onclick="startRealPuzzle()">Trocar Imagem / Embaralhar</button>
    </div>
    <div class="puzzle-grid" id="puzzle-board">
  `;
  puzzlePieces.forEach((pieceIndex, currentIndex) => {
    const row = Math.floor(pieceIndex / 3);
    const col = pieceIndex % 3;
    const bgPos = `-${col * 100}px -${row * 100}px`;
    html += `
      <div class="puzzle-piece" draggable="true" data-index="${currentIndex}"
           ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropPiece(event)"
           style="background-image: url('${imgUrl}'); background-position: ${bgPos}; background-size: 300px 300px;">
      </div>
    `;
  });
  html += `</div>`;
  board.innerHTML = html;
}

function dragStart(e) { e.dataTransfer.setData("text/plain", e.target.getAttribute("data-index")); e.target.classList.add("dragging"); }
function dragOver(e) { e.preventDefault(); }
async function dropPiece(e) {
  e.preventDefault();
  const draggedIndex = parseInt(e.dataTransfer.getData("text/plain"));
  const target = e.target.closest(".puzzle-piece"); if (!target) return;
  const droppedIndex = parseInt(target.getAttribute("data-index"));
  if (draggedIndex !== droppedIndex) {
    const temp = puzzlePieces[draggedIndex]; puzzlePieces[draggedIndex] = puzzlePieces[droppedIndex]; puzzlePieces[droppedIndex] = temp;
    gameState.tentativas++;
    document.querySelector(".dragging")?.classList.remove("dragging");
    if (puzzlePieces[draggedIndex] === draggedIndex || puzzlePieces[droppedIndex] === droppedIndex) {
      playTone(600, "sine", 0.1, 0.05);
    }
    renderRealPuzzle();
    checkPuzzleSolved();
  }
}

async function checkPuzzleSolved() {
  if (puzzleSolved) return;
  const isSolved = puzzlePieces.every((val, index) => val === index);
  if (isSolved) {
    puzzleSolved = true; gameState.acertos = 9; 
    const dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
    finishGame("Quebra-Cabeça", gameState.acertos, gameState.tentativas + 1, dur);
  }
}

function renderIdentifyGame(feedbackMsg = "", feedbackType = "") {
  var board = document.getElementById("game-board");
  var btns = [];
  gameState.options.forEach(function(opt) { btns.push('<button type="button" class="tile-btn" onclick="clickIdentifyOption(\'' + opt.word + '\')"><span style="font-size:3rem;">' + opt.icon + '</span></button>'); });
  
  var feedbackHtml = feedbackMsg ? `<div style="text-align:center; font-weight:bold; color:${feedbackType === 'success' ? '#22C55E' : '#EF4444'}; margin-bottom:10px; font-size:1.2rem;">${feedbackMsg}</div>` : '<div style="height:24px; margin-bottom:10px;"></div>';

  board.innerHTML = `
    ${feedbackHtml}
    <div style="text-align:center;margin-bottom:15px;">
      <strong>Acertos: ${gameState.levelCorrects} / ${TARGET_CORRECT}</strong><br>
      Encontre: <span style="color:var(--gold-dark);font-size:1.5rem;">${gameState.target.word}</span>
    </div>
    <div class="tiles-grid">${btns.join("")}</div>
  `;
}

async function clickIdentifyOption(word) {
  gameState.tentativas++; gameState.totalTentativas = (gameState.totalTentativas || 0) + 1;
  if (word === gameState.target.word) {
    gameState.acertos++; gameState.totalAcertos = (gameState.totalAcertos || 0) + 1; gameState.levelCorrects++; playSuccess();
    
    if (gameState.levelCorrects >= TARGET_CORRECT) {
       var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
       finishGame("Identificação de Imagem", gameState.totalAcertos, gameState.totalTentativas, dur);
    } else {
       renderIdentifyGame("Acertou! 🎉", "success");
       setTimeout(() => {
          var bank = [
            { icon: "🐶", word: "Cachorro" }, { icon: "🐱", word: "Gato" }, { icon: "🍎", word: "Maçã" }, { icon: "🚗", word: "Carro" },
            { icon: "⭐", word: "Estrela" }, { icon: "🐘", word: "Elefante" }, { icon: "🍌", word: "Banana" }, { icon: "✈️", word: "Avião" },
            { icon: "🌻", word: "Girassol" }, { icon: "🐟", word: "Peixe" }, { icon: "🍇", word: "Uva" }, { icon: "🚲", word: "Bicicleta" }
          ];
          var maxOptions = 4;
          var options = shuf(bank).slice(0, maxOptions);
          gameState.target = options[Math.floor(Math.random() * options.length)]; gameState.options = options;
          renderIdentifyGame();
       }, 1000);
    }
  } else {
    playError(); 
    document.getElementById("game-board").classList.add("shake"); 
    setTimeout(() => document.getElementById("game-board").classList.remove("shake"), 300);
    renderIdentifyGame("Errou! Tente novamente. ❌", "error");
  }
}

function renderConnectGame() {
  var board = document.getElementById("game-board");
  var leftBtns = []; var rightBtns = [];
  gameState.leftItems.forEach(function(item) {
    var done = gameState.matchedIds.indexOf(item.id) !== -1;
    var sel = gameState.selectedLeft === item.id;
    leftBtns.push('<button type="button" class="tile-btn ' + (sel ? "selected" : "") + ' ' + (done ? "matched" : "") + '" onclick="selectLeft(' + item.id + ')"><span style="font-size:2.5rem;">' + item.icon + '</span></button>');
  });
  gameState.rightItems.forEach(function(item) {
    var done = gameState.matchedIds.indexOf(item.id) !== -1;
    rightBtns.push('<button type="button" class="tile-btn ' + (done ? "matched" : "") + '" onclick="selectRight(' + item.id + ')"><span style="font-size:2.5rem;">' + item.icon + '</span></button>');
  });
  board.innerHTML = '<div style="text-align:center;margin-bottom:10px;"><strong>Nível ' + gameState.level + ' - Acertos: ' + gameState.levelCorrects + '/' + TARGET_CORRECT + '</strong></div><p class="subtitle"><div style="background:#fffbeb; border:1px solid #fde68a; padding:12px; margin-bottom:15px; border-radius:8px; text-align:center; color:#92400e; font-size:0.95rem; line-height:1.4;"><strong>Como jogar:</strong> Encontre a imagem da direita que combina com a da esquerda.<br><em>Exemplo: A Chave 🔑 combina com o Cadeado 🔒.</em></div></p><div class="grid-2"><div class="tiles-grid">' + leftBtns.join("") + '</div><div class="tiles-grid">' + rightBtns.join("") + '</div></div>';
}

function selectLeft(id) { if (gameState.matchedIds.indexOf(id) !== -1) return; gameState.selectedLeft = id; renderConnectGame(); }

async function selectRight(id) {
  if (!gameState.selectedLeft || gameState.matchedIds.indexOf(id) !== -1) return;
  gameState.tentativas++; gameState.totalTentativas = (gameState.totalTentativas || 0) + 1;
  if (gameState.selectedLeft === id) {
    gameState.acertos++; gameState.totalAcertos = (gameState.totalAcertos || 0) + 1; gameState.levelCorrects++; gameState.matchedIds.push(id); playSuccess();
    if (gameState.levelCorrects >= TARGET_CORRECT || gameState.matchedIds.length === gameState.pairs.length) {
       var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
       finishGame("Ligar Imagens", gameState.acertos, gameState.tentativas, dur);
    }
  } else {
    playError(); document.getElementById("game-board").classList.add("shake"); setTimeout(() => document.getElementById("game-board").classList.remove("shake"), 300);
  }
  gameState.selectedLeft = null; renderConnectGame();
}

function renderConceptsGame(feedbackMsg = "", feedbackType = "") {
  var board = document.getElementById("game-board");
  var btns = [];
  gameState.options.forEach(function(opt) { btns.push('<button type="button" class="tile-btn" onclick="clickConceptOption(\'' + opt.label + '\')"><span style="font-size:2.5rem;">' + opt.display + '</span></button>'); });
  
  var feedbackHtml = feedbackMsg ? `<div style="text-align:center; font-weight:bold; color:${feedbackType === 'success' ? '#22C55E' : '#EF4444'}; margin-bottom:10px; font-size:1.2rem;">${feedbackMsg}</div>` : '<div style="height:24px; margin-bottom:10px;"></div>';

  board.innerHTML = `
    ${feedbackHtml}
    <div style="text-align:center;margin-bottom:15px;">
      <strong>Acertos: ${gameState.levelCorrects} / ${TARGET_CORRECT}</strong><br>
      Toque em: <span style="color:var(--gold-dark);font-size:1.5rem;">${gameState.target.label}</span>
    </div>
    <div class="tiles-grid">${btns.join("")}</div>
  `;
}

async function clickConceptOption(label) {
  gameState.tentativas++; gameState.totalTentativas = (gameState.totalTentativas || 0) + 1;
  if (label === gameState.target.label) {
    gameState.acertos++; gameState.totalAcertos = (gameState.totalAcertos || 0) + 1; gameState.levelCorrects++; playSuccess();
    
    if (gameState.levelCorrects >= TARGET_CORRECT) {
      var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
      finishGame("Identificação de Conceitos", gameState.totalAcertos, gameState.totalTentativas, dur);
    } else {
      renderConceptsGame("Acertou! 🎉", "success");
      setTimeout(() => {
        var cBank = [
          { display: "A", label: "Letra A" }, { display: "7", label: "Número 7" }, { display: "🔵", label: "Círculo azul" },
          { display: "🔺", label: "Triângulo" }, { display: "🦋", label: "Borboleta" }, { display: "🟨", label: "Quadrado amarelo" },
          { display: "B", label: "Letra B" }, { display: "3", label: "Número 3" }, { display: "🟩", label: "Quadrado verde" }, { display: "⭐", label: "Estrela" }
        ];
        var opts = shuf(cBank).slice(0, 6);
        gameState.target = opts[Math.floor(Math.random() * opts.length)]; gameState.options = opts;
        renderConceptsGame();
      }, 1000);
    }
  } else {
    playError(); 
    document.getElementById("game-board").classList.add("shake"); 
    setTimeout(() => document.getElementById("game-board").classList.remove("shake"), 300);
    renderConceptsGame("Errou! Tente de novo. ❌", "error");
  }
}

document.addEventListener("DOMContentLoaded", async function() {
  applySavedCredsToForm();
  if (typeof sb !== "undefined" && sb) {
    try {
      var sRes = await sb.auth.getSession();
      var session = sRes && sRes.data ? sRes.data.session : null;
      if (session && document.getElementById("app-section")) {
        var pRes = await sb.from("profiles").select("*").eq("id", session.user.id).single();
        var profile = pRes ? pRes.data : null;
        if (profile && (profile.role === "admin" || !!profile.ativo)) openWorkspace(profile);
      }
    } catch (err) { console.error("Erro ao verificar sessão:", err); }
  }
});

// --- FUNÇÕES DO PAINEL DO CLIENTE (ANAMNESE) ---

let anamneseModelsCache = [];
let anamneseResponsesCache = [];

async function loadAnamneseModels() {
  if (typeof sb === "undefined" || !sb) return;
  const sel = document.getElementById("select-anamnese-modelo");
  if (!sel) return;
  
  const { data, error } = await sb.from("anamnese_modelos").select("*").order("titulo");
  if (error) {
    console.error("Erro ao carregar modelos:", error);
    sel.innerHTML = '<option value="">Erro ao carregar modelos.</option>';
    return;
  }
  
  anamneseModelsCache = data || [];
  
  if (anamneseModelsCache.length === 0) {
    sel.innerHTML = '<option value="">Nenhum modelo disponível.</option>';
    return;
  }
  
  sel.innerHTML = '<option value="">Selecione um modelo...</option>' +
    anamneseModelsCache.map(m => `<option value="${m.id}">${escapeHtml(m.titulo)}</option>`).join("");
}

function renderAnamneseForm() {
  const sel = document.getElementById("select-anamnese-modelo");
  const form = document.getElementById("dynamic-anamnese-form");
  const container = document.getElementById("dynamic-fields-container");
  
  if (!sel || !form || !container) return;
  
  const modelId = sel.value;
  if (!modelId) {
    form.classList.add("hidden");
    return;
  }
  
  const model = anamneseModelsCache.find(m => m.id === modelId);
  if (!model) return;
  
  document.getElementById("current-anamnese-id").value = modelId;
  
  container.innerHTML = model.campos.map(c => {
    let inputHtml = "";
    if (c.type === "textarea") {
      inputHtml = `<textarea id="f-${c.id}" required rows="3"></textarea>`;
    } else if (c.type === "date") {
      inputHtml = `<input type="date" id="f-${c.id}" required>`;
    } else {
      inputHtml = `<input type="text" id="f-${c.id}" required>`;
    }
    
    return `
      <div class="field" style="margin-bottom:15px;">
        <label style="font-weight:bold;">${escapeHtml(c.label)}</label>
        ${inputHtml}
      </div>
    `;
  }).join("");
  
  form.classList.remove("hidden");
}

async function saveAnamneseResponse() {
  if (typeof sb === "undefined" || !sb) return;
  
  const pacienteNome = document.getElementById("paciente-nome")?.value || "";
  const modelId = document.getElementById("current-anamnese-id")?.value;
  
  if (!pacienteNome || !modelId) return showAppAlert("Preencha o nome do paciente.", "error");
  
  const model = anamneseModelsCache.find(m => m.id === modelId);
  if (!model) return;
  
  const respostas = {};
  let preenchido = true;
  
  model.campos.forEach(c => {
    const val = document.getElementById(`f-${c.id}`)?.value || "";
    if (!val.trim()) preenchido = false;
    respostas[c.label] = val;
  });
  
  if (!preenchido) return showAppAlert("Por favor, preencha todos os campos.", "error");
  
  const uRes = await sb.auth.getUser();
  const user = uRes?.data?.user;
  if (!user) return;
  
  const { error } = await sb.from("anamnese_respostas").insert({
    user_id: user.id,
    anamnese_modelo_id: modelId,
    paciente_nome: pacienteNome,
    respostas: respostas
  });
  
  if (error) {
    console.error(error);
    return showAppAlert("Erro ao salvar: " + error.message, "error");
  }
  
  showAppAlert("Prontuário salvo com sucesso!", "success");
  document.getElementById("dynamic-anamnese-form").reset();
  document.getElementById("dynamic-anamnese-form").classList.add("hidden");
  
  loadAnamneseResponses();
}

// CORREÇÃO DO ERRO DE RESPOSTAS (Sem JOIN e usando o Cache)
async function loadAnamneseResponses() {
  if (typeof sb === "undefined" || !sb) return;
  const tbody = document.getElementById("clients-tbody");
  if (!tbody) return;
  
  const uRes = await sb.auth.getUser();
  const user = uRes?.data?.user;
  if (!user) return;

  // Busca apenas as respostas, sem fazer JOIN
  const { data, error } = await sb.from("anamnese_respostas")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar respostas:", error);
    tbody.innerHTML = '<tr><td colspan="3">Erro ao carregar prontuários. Verifique o console.</td></tr>';
    return;
  }

  anamneseResponsesCache = data || [];

  if (anamneseResponsesCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">Nenhum prontuário salvo.</td></tr>';
    return;
  }

  tbody.innerHTML = anamneseResponsesCache.map(r => {
    const dt = new Date(r.created_at).toLocaleDateString("pt-BR");
    // Procura o título no cache de modelos em vez de depender do banco
    const model = anamneseModelsCache.find(m => m.id === r.anamnese_modelo_id);
    const titulo = model ? model.titulo : "Modelo não encontrado";
    
    return `<tr>
      <td><strong>${escapeHtml(r.paciente_nome)}</strong><br><small>${escapeHtml(titulo)}</small></td>
      <td>${dt}</td>
      <td><button type="button" class="btn btn-outline btn-sm" onclick="viewAnamneseResponse('${r.id}')">Ver Detalhes</button></td>
    </tr>`;
  }).join("");
}

function viewAnamneseResponse(id) {
  const resp = anamneseResponsesCache.find(r => r.id === id);
  if (!resp) return;

  const existing = document.getElementById('view-anamnese-overlay');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'view-anamnese-overlay';
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;";
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  
  const respostasHtml = Object.entries(resp.respostas || {}).map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`).join("");
  const model = anamneseModelsCache.find(m => m.id === resp.anamnese_modelo_id);
  const titulo = model ? model.titulo : "N/A";

  modal.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:10px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;position:relative;">
      <button onclick="document.getElementById('view-anamnese-overlay').remove()" style="position:absolute;top:15px;right:15px;background:#EF4444;color:#fff;border:none;padding:8px 12px;cursor:pointer;border-radius:5px;font-weight:bold;">X</button>
      <h2 style="margin-top:0; color:#333;">Prontuário: ${escapeHtml(resp.paciente_nome)}</h2>
      <p style="color:#666; font-size:14px;"><strong>Modelo:</strong> ${escapeHtml(titulo)}</p>
      <hr style="margin:15px 0; border:0; border-top:1px solid #ddd;">
      <ul style="margin:0; padding-left:20px; line-height:1.6; color:#333;">
        ${respostasHtml}
      </ul>
    </div>
  `;
  document.body.appendChild(modal);
}