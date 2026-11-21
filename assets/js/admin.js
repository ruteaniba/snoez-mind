function showAdminAlert(msg, type = "error") {
  const el = document.getElementById("admin-alert");
  if (!el) return;
  el.textContent = msg;
  el.className = `alert show ${type}`;
}

async function initAdmin() {
  if (typeof sb === "undefined" || !sb) {
    showAdminAlert("Erro de configuração do Supabase (config.js).");
    return;
  }

  const { data: { session }, error: sErr } = await sb.auth.getSession();
  if (sErr || !session) {
    window.location.href = "index.html";
    return;
  }

  const { data: me, error: mErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (mErr || !me) {
    showAdminAlert(mErr ? mErr.message : "Perfil de administrador não encontrado.");
    return;
  }

  if (me.role !== "admin") {
    showAdminAlert("Acesso restrito a administradores.");
    setTimeout(() => (window.location.href = "index.html"), 1500);
    return;
  }

  loadUsers();
}

async function loadUsers() {
  const tbody = document.getElementById("users-tbody");
  const { data: users, error } = await sb
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showAdminAlert("Erro ao carregar utilizadores: " + error.message);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">Não foi possível carregar a lista.</td></tr>`;
    return;
  }

  if (!users || users.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">Nenhum utilizador encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <strong>${escapeHTML(u.nome) || "-"}</strong><br>
        <small>${escapeHTML(u.email)}</small><br>
        <small>${u.whatsapp || "Sem WhatsApp"}</small>
      </td>
      <td>${u.role}</td>
      <td><span class="badge ${u.ativo ? "badge-on" : "badge-off"}">${u.ativo ? "Ativo" : "Inativo"}</span></td>
      <td><input type="date" id="ini-${u.id}" value="${u.data_inicio || ""}"></td>
      <td><input type="date" id="fim-${u.id}" value="${u.data_fim || ""}"></td>
      <td class="actions" style="display: flex; gap: 5px; flex-wrap: wrap;">
        <button class="btn btn-gold btn-sm" onclick="viewTherapistData('${u.id}', '${escapeHTML(u.nome)}')">Ver Dados</button>
        <button class="btn btn-outline btn-sm" onclick="saveDates('${u.id}')">Salvar Datas</button>
        <button class="btn btn-outline btn-sm" onclick="toggleUser('${u.id}', ${!u.ativo})">${u.ativo ? "Desativar" : "Ativar"}</button>
        ${u.role !== "admin" ? `<button class="btn btn-danger btn-sm" onclick="removeUser('${u.id}')">Remover</button>` : ""}
      </td>
    </tr>
  `).join("");
}

async function toggleUser(id, novoStatus) {
  const { error } = await sb.from("profiles").update({ ativo: novoStatus }).eq("id", id);
  if (error) return showAdminAlert("Erro ao atualizar estado: " + error.message);
  loadUsers();
}

async function saveDates(id) {
  const data_inicio = document.getElementById(`ini-${id}`).value || null;
  const data_fim = document.getElementById(`fim-${id}`).value || null;
  const { error } = await sb.from("profiles").update({ data_inicio, data_fim }).eq("id", id);
  if (error) return showAdminAlert("Erro ao guardar datas: " + error.message);
  showAdminAlert("Datas atualizadas com sucesso!", "success");
  loadUsers();
}

async function removeUser(id) {
  if (!confirm("Tem certeza que deseja remover este usuário permanentemente?")) return;
  const { error } = await sb.rpc("admin_delete_user", { target_user_id: id });
  if (error) return showAdminAlert("Erro ao remover: " + error.message);
  showAdminAlert("Utilizador removido com sucesso.", "success");
  loadUsers();
}

// --- NOVA FUNÇÃO PARA MOSTRAR OS DADOS DO CLIENTE ---
async function viewTherapistData(userId, userName) {
  const existing = document.getElementById('admin-modal-overlay');
  if (existing) existing.remove();

  // Cria o modal
  const modal = document.createElement('div');
  modal.id = 'admin-modal-overlay';
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;";
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  modal.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:10px;max-width:900px;width:100%;max-height:85vh;overflow-y:auto;position:relative;">
      <button onclick="document.getElementById('admin-modal-overlay').remove()" style="position:absolute;top:15px;right:15px;background:#EF4444;color:#fff;border:none;padding:8px 12px;cursor:pointer;border-radius:5px;font-weight:bold;">X</button>
      <h2 style="margin-top:0; color:#333;">Dados do Terapeuta: ${escapeHTML(userName)}</h2>
      <hr style="margin-bottom:20px; border:0; border-top:1px solid #ddd;">
      <div id="admin-modal-content" style="color:#333;">Carregando informações...</div>
    </div>
  `;
  document.body.appendChild(modal);

  const content = document.getElementById("admin-modal-content");
  
  try {
    // Puxa Anamnese, Crianças e Sessões desse terapeuta específico
    const [anamneses, criancas, sessoes] = await Promise.all([
      sb.from("clientes_emocionais").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      sb.from("criancas").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      sb.from("sessoes_jogos").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20)
    ]);

    let html = "";

    // 1. Seção de Anamnese
    html += `<h3 style="color:#D97706; margin-bottom:10px;">📋 Prontuários / Anamnese</h3>`;
    if (anamneses.data && anamneses.data.length > 0) {
      html += `<div style="display:grid; gap:10px; margin-bottom:30px;">`;
      anamneses.data.forEach(a => {
        html += `
          <div style="background:#f9f9f9; padding:15px; border-left:4px solid #D97706; border-radius:4px;">
            <strong>Paciente: ${escapeHTML(a.nome)}</strong> <br>
            <small><b>Contato:</b> ${escapeHTML(a.telefone || "-")} | ${escapeHTML(a.email || "-")}</small><br>
            <p style="margin:5px 0;"><b>Queixa:</b> ${escapeHTML(a.queixa_principal || "-")}</p>
            <p style="margin:5px 0;"><b>Anamnese:</b> ${escapeHTML(a.anamnese || "-")}</p>
          </div>
        `;
      });
      html += `</div>`;
    } else {
      html += `<p style="color:#666; margin-bottom:20px;">Nenhuma anamnese registrada.</p>`;
    }

    // 2. Seção de Crianças
    html += `<h3 style="color:#3B82F6; margin-bottom:10px;">🧸 Crianças Cadastradas</h3>`;
    if (criancas.data && criancas.data.length > 0) {
      html += `<ul style="margin-bottom:30px; padding-left:20px;">`;
      criancas.data.forEach(c => {
        html += `<li style="margin-bottom:5px;"><strong>${escapeHTML(c.nome)}</strong> (${c.idade || '?'} anos) - Foco: ${escapeHTML(c.diagnostico || 'Não informado')}</li>`;
      });
      html += `</ul>`;
    } else {
      html += `<p style="color:#666; margin-bottom:20px;">Nenhuma criança cadastrada.</p>`;
    }

    // 3. Seção de Sessões
    html += `<h3 style="color:#10B981; margin-bottom:10px;">🎮 Últimas Sessões de Jogos</h3>`;
    if (sessoes.data && sessoes.data.length > 0) {
      html += `<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:14px;">
                <tr style="background:#eee;">
                  <th style="padding:8px; border:1px solid #ddd; text-align:left;">Data</th>
                  <th style="padding:8px; border:1px solid #ddd; text-align:left;">Jogo</th>
                  <th style="padding:8px; border:1px solid #ddd; text-align:left;">Acertos / Tentativas</th>
                  <th style="padding:8px; border:1px solid #ddd; text-align:left;">Tempo</th>
                </tr>`;
      sessoes.data.forEach(s => {
        const dt = new Date(s.created_at).toLocaleString('pt-BR');
        html += `<tr>
                  <td style="padding:8px; border:1px solid #ddd;">${dt}</td>
                  <td style="padding:8px; border:1px solid #ddd;">${escapeHTML(s.jogo)}</td>
                  <td style="padding:8px; border:1px solid #ddd;">${s.acertos} / ${s.tentativas}</td>
                  <td style="padding:8px; border:1px solid #ddd;">${s.duracao_seg}s</td>
                </tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p style="color:#666;">Nenhuma sessão de jogo registrada.</p>`;
    }

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<p style="color:red;">Erro ao carregar dados: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initAdmin);