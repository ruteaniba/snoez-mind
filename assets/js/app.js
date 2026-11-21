let childrenList = [];
let clientsCache = [];
let selectedChildId = "";
let gameState = null;
const CREDS_KEY = "snoezmind_saved_creds_v1";
const TARGET_CORRECT = 7;

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
  const score = tentativas > 0 ? Math.round((acertos / tentativas) * 100) : 0;
  playSuccess();
  
  const overlay = document.createElement("div");
  overlay.className = "game-modal-overlay";
  // Força o modal a ficar no topo da tela para não tampar o quebra-cabeça
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:flex-start; padding-top:30px; z-index:9999; opacity:0; transition:opacity 0.3s;";
  
  overlay.innerHTML = `
    <div class="game-modal" style="background:#fff; padding:20px; border-radius:10px; text-align:center; max-width:400px; width:90%; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
      <h2 style="margin-top:0;">Fim do Jogo!</h2>
      <p><strong>${gameName}</strong></p>
      <div class="score" style="font-size:2rem; font-weight:bold; color:#EAB308; margin:10px 0;">${score}%</div>
      <p>Acertos: ${acertos} | Erros: ${tentativas - acertos}</p>
      <p>Tempo: ${duration} segundos</p>
      <button class="btn btn-gold" onclick="this.closest('.game-modal-overlay').remove(); startGame('${gameName.toLowerCase().includes('identifica') ? 'identificacao_imagem' : 'pareamento_cores'}')">Jogar Novamente</button>
      <button class="btn btn-outline" style="margin-left:10px;" onclick="this.closest('.game-modal-overlay').remove();">Fechar</button>
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
  // Removemos o "criancas" da lista de abas
  ["jogos", "emocional"].forEach(function(t) {
    var sec = document.getElementById("tab-" + t);
    if (sec) sec.classList.toggle("hidden", t !== tab);
  });
  if (tab === "emocional") { loadClients(); }
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
  
  // Removemos o loadChildren() e loadReports() daqui, pois a tela sumiu.
  loadClients(); 
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

async function loadClients() {
  if (typeof sb === "undefined" || !sb) return;
  var uRes = await sb.auth.getUser(); var user = uRes && uRes.data ? uRes.data.user : null;
  if (!user) return;
  var res = await sb.from("clientes_emocionais").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  clientsCache = res.data || [];
  var tbody = document.getElementById("clients-tbody");
  if (!tbody) return;
  if (clientsCache.length === 0) tbody.innerHTML = '<tr><td colspan="5">Nenhum paciente cadastrado.</td></tr>';
  else {
    var htmlRows = [];
    clientsCache.forEach(function(cl, idx) { htmlRows.push('<tr><td><strong>' + escapeHtml(cl.nome) + '</strong></td><td>' + escapeHtml(cl.telefone || "-") + '<br><small>' + escapeHtml(cl.email || "") + '</small></td><td>' + escapeHtml(cl.queixa_principal || "-") + '</td><td><small>' + escapeHtml(cl.anamnese || "-") + '</small></td><td class="actions"><button type="button" class="btn btn-outline btn-sm" onclick="editClientByIndex(' + idx + ')">Editar</button><button type="button" class="btn btn-danger btn-sm" onclick="deleteClient(\'' + escapeHtml(cl.id) + '\')">Excluir</button></td></tr>'); });
    tbody.innerHTML = htmlRows.join("");
  }
}

function editClientByIndex(idx) {
  var cl = clientsCache[idx]; if (!cl) return;
  document.getElementById("client-id").value = cl.id;
  document.getElementById("client-nome").value = cl.nome || "";
  document.getElementById("client-tel").value = cl.telefone || "";
  document.getElementById("client-email").value = cl.email || "";
  document.getElementById("client-queixa").value = cl.queixa_principal || "";
  document.getElementById("client-anamnese").value = cl.anamnese || "";
}

function resetClientForm() { document.getElementById("client-id").value = ""; document.getElementById("client-form")?.reset(); }

async function saveClient() {
  if (typeof sb === "undefined" || !sb) return;
  var uRes = await sb.auth.getUser(); var user = uRes && uRes.data ? uRes.data.user : null;
  if (!user) return showAppAlert("Faça login para salvar.", "error");
  var id = document.getElementById("client-id")?.value;
  var payload = { user_id: user.id, nome: (document.getElementById("client-nome")?.value || "").trim(), telefone: (document.getElementById("client-tel")?.value || "").trim() || null, email: (document.getElementById("client-email")?.value || "").trim() || null, queixa_principal: (document.getElementById("client-queixa")?.value || "").trim() || null, anamnese: (document.getElementById("client-anamnese")?.value || "").trim() || null, updated_at: new Date().toISOString() };
  var res = id ? await sb.from("clientes_emocionais").update(payload).eq("id", id) : await sb.from("clientes_emocionais").insert(payload);
  if (res.error) return showAppAlert("Erro: " + res.error.message, "error");
  resetClientForm(); showAppAlert("Prontuário salvo!"); loadClients();
}

async function deleteClient(id) {
  if (typeof sb === "undefined" || !sb) return;
  var res = await sb.from("clientes_emocionais").delete().eq("id", id);
  if (res.error) return showAppAlert("Erro: " + res.error.message, "error");
  showAppAlert("Removido."); loadClients();
}

function startGame(type, level = 1) {
  gameState = { type: type, level: level, startedAt: Date.now(), acertos: 0, tentativas: 0, selected: null, matchedIds: [], levelCorrects: 0, totalAcertos: level > 1 ? (gameState?.totalAcertos || 0) : 0, totalTentativas: level > 1 ? (gameState?.totalTentativas || 0) : 0 };
  if (type === "pareamento_cores" || type === "pareamento_sobras") {
    var base = [
      { key: "Vermelho", color: "#EF4444", label: "Vermelho" }, { key: "Azul", color: "#3B82F6", label: "Azul" },
      { key: "Amarelo", color: "#EAB308", label: "Amarelo" }, { key: "Verde", color: "#22C55E", label: "Verde" },
      { key: "Roxo", color: "#A855F7", label: "Roxo" }, { key: "Laranja", color: "#F97316", label: "Laranja" }
    ];
    var items = [];
    base.forEach(function(b, idx) { items.push({ id: "a-" + idx, key: b.key, label: b.label, color: b.color }); items.push({ id: "b-" + idx, key: b.key, label: b.label, color: b.color }); });
    if (type === "pareamento_sobras") { items.push({ id: "extra-1", key: "Marrom", label: "Marrom", color: "#78350F" }); items.push({ id: "extra-2", key: "Rosa", label: "Rosa", color: "#EC4899" }); }
    gameState.items = shuf(items); gameState.totalPairs = base.length;
    renderPairGame();
  } else if (type === "quebra_cabeca") {
    startRealPuzzle();
  } else if (type === "identificacao_imagem") {
    var bank = [
      { icon: "🐶", word: "Cachorro" }, { icon: "🐱", word: "Gato" }, { icon: "🍎", word: "Maçã" }, { icon: "🚗", word: "Carro" },
      { icon: "⭐", word: "Estrela" }, { icon: "🐘", word: "Elefante" }, { icon: "🍌", word: "Banana" }, { icon: "✈️", word: "Avião" },
      { icon: "🌻", word: "Girassol" }, { icon: "🐟", word: "Peixe" }, { icon: "🍇", word: "Uva" }, { icon: "🚲", word: "Bicicleta" },
      { icon: "🦁", word: "Leão" }, { icon: "🍓", word: "Morango" }, { icon: "🚁", word: "Helicóptero" }, { icon: "🌈", word: "Arco-íris" }
    ];
    var maxOptions = level === 1 ? 4 : (level === 2 ? 6 : 9);
    var options = shuf(bank).slice(0, maxOptions);
    gameState.target = options[Math.floor(Math.random() * options.length)]; gameState.options = options;
    renderIdentifyGame();
  } else if (type === "ligar_imagens") {
    var pairs = [
      { id: 1, left: "🔑", right: "🔒", label: "Chave e cadeado" }, { id: 2, left: "🖌️", right: "🎨", label: "Pincel e tinta" },
      { id: 3, left: "🧦", right: "👟", label: "Meia e tênis" }, { id: 4, left: "☀️", right: "🕶️", label: "Sol e óculos" },
      { id: 5, left: "☕", right: "🥐", label: "Café e pão" }, { id: 6, left: "🧼", right: "💧", label: "Sabão e água" }
    ];
    gameState.pairs = pairs; gameState.leftItems = shuf(pairs.map(function(p) { return { id: p.id, icon: p.left }; })); gameState.rightItems = shuf(pairs.map(function(p) { return { id: p.id, icon: p.right }; })); gameState.selectedLeft = null;
    renderConnectGame();
  } else if (type === "identificacao_conceitos") {
    var cBank = [
      { display: "A", label: "Letra A" }, { display: "7", label: "Número 7" }, { display: "🔵", label: "Círculo azul" },
      { display: "🔺", label: "Triângulo" }, { display: "🦋", label: "Borboleta" }, { display: "🟨", label: "Quadrado amarelo" },
      { display: "B", label: "Letra B" }, { display: "3", label: "Número 3" }, { display: "🟩", label: "Quadrado verde" }, { display: "⭐", label: "Estrela" }
    ];
    var opts = shuf(cBank).slice(0, 6);
    gameState.target = opts[Math.floor(Math.random() * opts.length)]; gameState.options = opts;
    renderConceptsGame();
  }
}

function renderPairGame() {
  var board = document.getElementById("game-board");
  var btns = [];
  gameState.items.forEach(function(it) {
    var isMatched = gameState.matchedIds.indexOf(it.id) !== -1;
    var isSel = gameState.selected === it.id;
    btns.push('<button type="button" class="tile-btn ' + (isSel ? "selected" : "") + ' ' + (isMatched ? "matched" : "") + '" onclick="clickPairTile(\'' + it.id + '\')"><span style="width:40px;height:40px;border-radius:50%;background:' + it.color + ';display:inline-block;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.2);"></span></button>');
  });
  board.innerHTML = '<div class="tiles-grid">' + btns.join("") + '</div>';
}

async function clickPairTile(id) {
  if (gameState.matchedIds.indexOf(id) !== -1 || gameState.selected === id) return;
  var clicked = gameState.items.find(function(x) { return x.id === id; });
  if (!gameState.selected) { gameState.selected = id; renderPairGame(); return; }
  var prev = gameState.items.find(function(x) { return x.id === gameState.selected; });
  gameState.tentativas += 1; gameState.totalTentativas++; gameState.selected = null;
  if (prev.key === clicked.key) {
    gameState.acertos += 1; gameState.totalAcertos++; gameState.levelCorrects++; gameState.matchedIds.push(prev.id, clicked.id); playSuccess();
    if (gameState.levelCorrects >= TARGET_CORRECT || gameState.matchedIds.length / 2 === gameState.totalPairs) {
       var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
       finishGame("Pareamento", gameState.acertos, gameState.tentativas, dur);
    }
  } else { 
      playError(); 
      document.getElementById("game-board").classList.add("shake"); 
      setTimeout(() => document.getElementById("game-board").classList.remove("shake"), 300); 
  }
  renderPairGame();
}

let puzzlePieces = []; let puzzleSolved = false;
const puzzleImages = [
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1591871937573-74dbba515c4c?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1552410260-0fd9b577afa6?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1529778873920-4da4926a72c2?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1507666405895-422eee7d517f?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1596706589401-13f9fb8b7998?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1555169062-013468b47731?w=400&h=400&fit=crop"
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
  gameState.tentativas++; gameState.totalTentativas++;
  if (word === gameState.target.word) {
    gameState.acertos++; gameState.totalAcertos++; gameState.levelCorrects++; playSuccess();
    
    if (gameState.levelCorrects >= TARGET_CORRECT) {
       var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
       finishGame("Identificação de Imagem", gameState.totalAcertos, gameState.totalTentativas, dur);
    } else {
       renderIdentifyGame("Acertou! 🎉", "success");
       setTimeout(() => {
          var bank = [
            { icon: "🐶", word: "Cachorro" }, { icon: "🐱", word: "Gato" }, { icon: "🍎", word: "Maçã" }, { icon: "🚗", word: "Carro" },
            { icon: "⭐", word: "Estrela" }, { icon: "🐘", word: "Elefante" }, { icon: "🍌", word: "Banana" }, { icon: "✈️", word: "Avião" },
            { icon: "🌻", word: "Girassol" }, { icon: "🐟", word: "Peixe" }, { icon: "🍇", word: "Uva" }, { icon: "🚲", word: "Bicicleta" },
            { icon: "🦁", word: "Leão" }, { icon: "🍓", word: "Morango" }, { icon: "🚁", word: "Helicóptero" }, { icon: "🌈", word: "Arco-íris" }
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
  board.innerHTML = '<div style="text-align:center;margin-bottom:10px;"><strong>Nível ' + gameState.level + ' - Acertos: ' + gameState.levelCorrects + '/' + TARGET_CORRECT + '</strong></div><p class="subtitle">Toque na imagem da esquerda e depois na correspondente da direita.</p><div class="grid-2"><div class="tiles-grid">' + leftBtns.join("") + '</div><div class="tiles-grid">' + rightBtns.join("") + '</div></div>';
}

function selectLeft(id) { if (gameState.matchedIds.indexOf(id) !== -1) return; gameState.selectedLeft = id; renderConnectGame(); }

async function selectRight(id) {
  if (!gameState.selectedLeft || gameState.matchedIds.indexOf(id) !== -1) return;
  gameState.tentativas++; gameState.totalTentativas++;
  if (gameState.selectedLeft === id) {
    gameState.acertos++; gameState.totalAcertos++; gameState.levelCorrects++; gameState.matchedIds.push(id); playSuccess();
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
  gameState.tentativas++; gameState.totalTentativas++;
  if (label === gameState.target.label) {
    gameState.acertos++; gameState.totalAcertos++; gameState.levelCorrects++; playSuccess();
    
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