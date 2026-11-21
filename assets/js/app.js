let speechEnabled = true;
let childrenList = [];
let clientsCache = [];
let selectedChildId = "";
let gameState = null;
const CREDS_KEY = "snoezmind_saved_creds_v1";

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

function speak(text) {
  if (!speechEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  var utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  window.speechSynthesis.speak(utter);
}

function toggleSpeech() {
  speechEnabled = !speechEnabled;
  var span = document.getElementById("speech-status");
  if (span) span.textContent = speechEnabled ? "SIM" : "NÃO";
  if (speechEnabled) speak("Estímulo de fala ativado");
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
  ["jogos", "criancas", "emocional"].forEach(function(t) {
    var sec = document.getElementById("tab-" + t);
    if (sec) sec.classList.toggle("hidden", t !== tab);
  });
  if (tab === "criancas") { loadChildren(); loadReports(); }
  else if (tab === "emocional") { loadClients(); }
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
  loadChildren(); loadReports(); loadClients();
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
  } catch (err) {
    setAuthAlert("Falha no login: " + (err && err.message ? err.message : err), false);
  }
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
    var opts = ['<option value="">Sessão avulsa (sem criança vinculada)</option>'];
    childrenList.forEach(function(c) { opts.push('<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.nome) + (c.diagnostico ? " (" + escapeHtml(c.diagnostico) + ")" : "") + "</option>"); });
    sel.innerHTML = opts.join("");
    if (prev && childrenList.some(function(c) { return c.id === prev; })) sel.value = prev;
    selectedChildId = sel.value;
  }
  var tbody = document.getElementById("children-tbody");
  if (tbody) {
    if (childrenList.length === 0) tbody.innerHTML = '<tr><td colspan="5">Nenhuma criança cadastrada.</td></tr>';
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
  document.getElementById("child-form")?.reset(); showAppAlert("Criança cadastrada!"); loadChildren();
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
  if (clientsCache.length === 0) tbody.innerHTML = '<tr><td colspan="5">Nenhum cliente cadastrado.</td></tr>';
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
  resetClientForm(); showAppAlert("Cliente salvo!"); loadClients();
}

async function deleteClient(id) {
  if (typeof sb === "undefined" || !sb) return;
  var res = await sb.from("clientes_emocionais").delete().eq("id", id);
  if (res.error) return showAppAlert("Erro: " + res.error.message, "error");
  showAppAlert("Removido."); loadClients();
}

function startGame(type) {
  gameState = { type: type, startedAt: Date.now(), acertos: 0, tentativas: 0, selected: null, matchedIds: [], puzzleOrder: [] };
  if (type === "pareamento_cores" || type === "pareamento_sobras") {
    var base = [{ key: "Vermelho", color: "#EF4444", label: "Vermelho" }, { key: "Azul", color: "#3B82F6", label: "Azul" }, { key: "Amarelo", color: "#EAB308", label: "Amarelo" }, { key: "Verde", color: "#22C55E", label: "Verde" }];
    var items = [];
    base.forEach(function(b, idx) { items.push({ id: "a-" + idx, key: b.key, label: b.label, color: b.color }); items.push({ id: "b-" + idx, key: b.key, label: b.label, color: b.color }); });
    if (type === "pareamento_sobras") { items.push({ id: "extra-1", key: "Roxo", label: "Roxo", color: "#A855F7" }); items.push({ id: "extra-2", key: "Laranja", label: "Laranja", color: "#F97316" }); }
    gameState.items = shuf(items); gameState.totalPairs = base.length;
    speak(type === "pareamento_sobras" ? "Pareamento com sobras. Encontre os pares iguais." : "Pareamento colorido. Encontre as cores iguais.");
    renderPairGame();
  } else if (type === "quebra_cabeca") {
    startRealPuzzle();
  } else if (type === "identificacao_imagem") {
    var bank = [{ icon: "🐶", word: "Cachorro" }, { icon: "🐱", word: "Gato" }, { icon: "🍎", word: "Maçã" }, { icon: "🚗", word: "Carro" }, { icon: "⭐", word: "Estrela" }];
    gameState.target = bank[Math.floor(Math.random() * bank.length)]; gameState.options = shuf(bank);
    speak("Encontre: " + gameState.target.word); renderIdentifyGame();
  } else if (type === "ligar_imagens") {
    var pairs = [{ id: 1, left: "🔑", right: "🔒", label: "Chave e cadeado" }, { id: 2, left: "🖌️", right: "🎨", label: "Pincel e tinta" }, { id: 3, left: "🧦", right: "👟", label: "Meia e tênis" }, { id: 4, left: "☀️", right: "🕶️", label: "Sol e óculos" }];
    gameState.pairs = pairs; gameState.leftItems = shuf(pairs.map(function(p) { return { id: p.id, icon: p.left }; })); gameState.rightItems = shuf(pairs.map(function(p) { return { id: p.id, icon: p.right }; })); gameState.selectedLeft = null;
    speak("Ligue uma imagem a outra que combina."); renderConnectGame();
  } else if (type === "identificacao_conceitos") {
    var cBank = [{ display: "A", label: "Letra A" }, { display: "7", label: "Número 7" }, { display: "🔵", label: "Círculo azul" }, { display: "🔺", label: "Triângulo" }, { display: "🦋", label: "Borboleta" }, { display: "🟨", label: "Quadrado amarelo" }];
    gameState.target = cBank[Math.floor(Math.random() * cBank.length)]; gameState.options = shuf(cBank);
    speak("Toque em: " + gameState.target.label); renderConceptsGame();
  }
}

function renderPairGame() {
  var board = document.getElementById("game-board");
  var title = gameState.type === "pareamento_sobras" ? "Pareamento com Sobras" : "Pareamento Colorido";
  var btns = [];
  gameState.items.forEach(function(it) {
    var isMatched = gameState.matchedIds.indexOf(it.id) !== -1;
    var isSel = gameState.selected === it.id;
    btns.push('<button type="button" class="tile-btn ' + (isSel ? "selected" : "") + ' ' + (isMatched ? "matched" : "") + '" onclick="clickPairTile(\'' + it.id + '\')"><span style="width:28px;height:28px;border-radius:50%;background:' + it.color + ';display:inline-block;border:1px solid rgba(0,0,0,0.15);"></span><span>' + it.label + '</span></button>');
  });
  board.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><strong>' + title + '</strong><span>Acertos: ' + (gameState.matchedIds.length / 2) + ' / ' + gameState.totalPairs + '</span></div><div class="tiles-grid">' + btns.join("") + '</div>';
}

async function clickPairTile(id) {
  if (gameState.matchedIds.indexOf(id) !== -1 || gameState.selected === id) return;
  var clicked = gameState.items.find(function(x) { return x.id === id; });
  speak(clicked.label);
  if (!gameState.selected) { gameState.selected = id; renderPairGame(); return; }
  var prev = gameState.items.find(function(x) { return x.id === gameState.selected; });
  gameState.tentativas += 1; gameState.selected = null;
  if (prev.key === clicked.key) {
    gameState.acertos += 1; gameState.matchedIds.push(prev.id, clicked.id);
    if (gameState.matchedIds.length / 2 === gameState.totalPairs) {
      var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
      await recordGameSession(gameState.type === "pareamento_sobras" ? "Pareamento com Sobras" : "Pareamento Colorido", gameState.acertos, gameState.tentativas, dur);
      speak("Parabéns! Concluiu o pareamento."); showAppAlert("Atividade concluída e salva no relatório!");
    }
  }
  renderPairGame();
}

function renderPuzzleGame() {
  var board = document.getElementById("game-board");
  var nextExpected = gameState.acertos + 1;
  var btns = [];
  gameState.puzzleOrder.forEach(function(num) {
    var done = num < nextExpected;
    btns.push('<button type="button" class="tile-btn ' + (done ? "matched" : "") + '" onclick="clickPuzzlePiece(' + num + ')"><span style="font-size:1.8rem;">' + num + '</span><small>Peça ' + num + '</small></button>');
  });
  board.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><strong>Quebra-Cabeça (Sequência 1 a 4)</strong><span>Próxima peça: <strong>' + (nextExpected <= 4 ? nextExpected : "Concluído!") + '</strong></span></div><div class="tiles-grid">' + btns.join("") + '</div>';
}

async function clickPuzzlePiece(num) {
  var expected = gameState.acertos + 1; if (expected > 4) return;
  gameState.tentativas += 1; speak("Peça " + num);
  if (num === expected) {
    gameState.acertos += 1;
    if (gameState.acertos === 4) {
      var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
      await recordGameSession("Quebra-Cabeça", gameState.acertos, gameState.tentativas, dur);
      speak("Muito bem! Quebra-cabeça montado."); showAppAlert("Quebra-cabeça concluído!");
    }
  }
  renderPuzzleGame();
}

function renderIdentifyGame() {
  var board = document.getElementById("game-board");
  var btns = [];
  gameState.options.forEach(function(opt) { btns.push('<button type="button" class="tile-btn" onclick="clickIdentifyOption(\'' + opt.word + '\')"><span style="font-size:2rem;">' + opt.icon + '</span></button>'); });
  board.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><strong>Identificação de Imagem — Encontre: <span style="color:var(--gold-dark);">' + gameState.target.word + '</span></strong><button type="button" class="btn btn-outline btn-sm" onclick="speak(\'' + gameState.target.word + '\')">Ouvir palavra</button></div><div class="tiles-grid">' + btns.join("") + '</div>';
}

async function clickIdentifyOption(word) {
  gameState.tentativas += 1;
  if (word === gameState.target.word) {
    gameState.acertos += 1;
    var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
    await recordGameSession("Identificação de Imagem", gameState.acertos, gameState.tentativas, dur);
    speak("Isso mesmo! " + word); showAppAlert("Acertou (" + word + ")!");
    setTimeout(function() { startGame("identificacao_imagem"); }, 900);
  } else { speak("Tente novamente"); }
}

function renderConnectGame() {
  var board = document.getElementById("game-board");
  var leftBtns = []; var rightBtns = [];
  gameState.leftItems.forEach(function(item) {
    var done = gameState.matchedIds.indexOf(item.id) !== -1;
    var sel = gameState.selectedLeft === item.id;
    leftBtns.push('<button type="button" class="tile-btn ' + (sel ? "selected" : "") + ' ' + (done ? "matched" : "") + '" onclick="selectLeft(' + item.id + ')"><span style="font-size:1.8rem;">' + item.icon + '</span></button>');
  });
  gameState.rightItems.forEach(function(item) {
    var done = gameState.matchedIds.indexOf(item.id) !== -1;
    rightBtns.push('<button type="button" class="tile-btn ' + (done ? "matched" : "") + '" onclick="selectRight(' + item.id + ')"><span style="font-size:1.8rem;">' + item.icon + '</span></button>');
  });
  board.innerHTML = '<strong>Ligar uma Imagem a Outra</strong><p class="subtitle">Toque na imagem da esquerda e depois na imagem correspondente da direita.</p><div class="grid-2"><div class="tiles-grid">' + leftBtns.join("") + '</div><div class="tiles-grid">' + rightBtns.join("") + '</div></div>';
}

function selectLeft(id) { if (gameState.matchedIds.indexOf(id) !== -1) return; gameState.selectedLeft = id; renderConnectGame(); }

async function selectRight(id) {
  if (!gameState.selectedLeft || gameState.matchedIds.indexOf(id) !== -1) return;
  gameState.tentativas += 1;
  if (gameState.selectedLeft === id) {
    gameState.acertos += 1; gameState.matchedIds.push(id); speak("Boa ligação!");
    if (gameState.matchedIds.length === gameState.pairs.length) {
      var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
      await recordGameSession("Ligar uma Imagem a Outra", gameState.acertos, gameState.tentativas, dur);
      showAppAlert("Todas as ligações concluídas!");
    }
  } else { speak("Não combina. Tente outro par."); }
  gameState.selectedLeft = null; renderConnectGame();
}

function renderConceptsGame() {
  var board = document.getElementById("game-board");
  var btns = [];
  gameState.options.forEach(function(opt) { btns.push('<button type="button" class="tile-btn" onclick="clickConceptOption(\'' + opt.label + '\')"><span style="font-size:1.8rem;">' + opt.display + '</span></button>'); });
  board.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><strong>Identificação — Toque em: <span style="color:var(--gold-dark);">' + gameState.target.label + '</span></strong><button type="button" class="btn btn-outline btn-sm" onclick="speak(\'' + gameState.target.label + '\')">Ouvir</button></div><div class="tiles-grid">' + btns.join("") + '</div>';
}

async function clickConceptOption(label) {
  gameState.tentativas += 1;
  if (label === gameState.target.label) {
    gameState.acertos += 1;
    var dur = Math.max(1, Math.round((Date.now() - gameState.startedAt) / 1000));
    await recordGameSession("Identificação (Letras/Números/Cores/Formas)", gameState.acertos, gameState.tentativas, dur);
    speak("Muito bem! " + label); showAppAlert("Acertou (" + label + ")!");
    setTimeout(function() { startGame("identificacao_conceitos"); }, 900);
  } else { speak("Tente de novo"); }
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
