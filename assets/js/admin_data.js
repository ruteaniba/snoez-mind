// Script para o Admin visualizar dados de pacientes de todos os terapeutas
async function viewTherapistData(userId, userName) {
  const modal = document.createElement('div');
  modal.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;";
  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:10px;max-width:800px;width:100%;max-height:80vh;overflow-y:auto;">
      <button onclick="this.parentElement.parentElement.remove()" style="float:right;background:red;color:#fff;border:none;padding:5px 10px;cursor:pointer;border-radius:5px;">Fechar</button>
      <h3>Dados de: ${userName}</h3>
      <div id="admin-modal-content">Carregando...</div>
    </div>
  `;
  document.body.appendChild(modal);

  const content = document.getElementById("admin-modal-content");
  
  // Busca Crianças
  const { data: criancas } = await sb.from("criancas").select("*").eq("user_id", userId);
  // Busca Sessões
  const { data: sessoes } = await sb.from("sessoes_jogos").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  
  let html = "<h4>Crianças Cadastradas:</h4><ul>";
  if (criancas && criancas.length > 0) {
    criancas.forEach(c => html += `<li>${c.nome} (${c.idade || '?'} anos) - ${c.diagnostico || 'Sem diagnóstico'}</li>`);
  } else { html += "<li>Nenhuma criança.</li>"; }
  html += "</ul>";

  html += "<h4>Últimas Sessões de Jogos:</h4><ul>";
  if (sessoes && sessoes.length > 0) {
    sessoes.forEach(s => {
      const dt = new Date(s.created_at).toLocaleString('pt-BR');
      html += `<li>${dt} - ${s.jogo} (Acertos: ${s.acertos}/${s.tentativas} em ${s.duracao_seg}s)</li>`;
    });
  } else { html += "<li>Nenhuma sessão registrada.</li>"; }
  html += "</ul>";
  
  content.innerHTML = html;
}
