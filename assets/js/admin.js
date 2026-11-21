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
        <strong>${u.nome || "-"}</strong><br>
        <small>${u.email}</small><br>
        <small>${u.whatsapp || "Sem WhatsApp"}</small>
      </td>
      <td>${u.role}</td>
      <td><span class="badge ${u.ativo ? "badge-on" : "badge-off"}">${u.ativo ? "Ativo" : "Inativo"}</span></td>
      <td><input type="date" id="ini-${u.id}" value="${u.data_inicio || ""}"></td>
      <td><input type="date" id="fim-${u.id}" value="${u.data_fim || ""}"></td>
      <td class="actions">
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

document.addEventListener("DOMContentLoaded", initAdmin);
