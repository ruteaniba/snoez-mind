async function initAdmin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return (window.location.href = "index.html");

  const { data: me } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!me || me.role !== "admin") return (window.location.href = "index.html");

  loadUsers();
}

async function loadUsers() {
  const { data: users, error } = await sb
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const tbody = document.getElementById("users-tbody");
  if (error) return;

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
  await sb.from("profiles").update({ ativo: novoStatus }).eq("id", id);
  loadUsers();
}

async function saveDates(id) {
  const data_inicio = document.getElementById(`ini-${id}`).value || null;
  const data_fim = document.getElementById(`fim-${id}`).value || null;
  await sb.from("profiles").update({ data_inicio, data_fim }).eq("id", id);
  alert("Datas atualizadas com sucesso!");
  loadUsers();
}

async function removeUser(id) {
  if (!confirm("Tem certeza que deseja remover este usuário permanentemente?")) return;
  const { error } = await sb.rpc("admin_delete_user", { target_user_id: id });
  if (error) return alert("Erro ao remover: " + error.message);
  loadUsers();
}

document.addEventListener("DOMContentLoaded", initAdmin);
