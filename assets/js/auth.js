function showAlert(id, msg, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `alert show ${type}`;
}

function isAccessAllowed(profile) {
  if (!profile || !profile.ativo) {
    return { ok: false, reason: "A sua conta está desativada. Fale com o administrador." };
  }
  const today = new Date().toISOString().split("T")[0];
  if (profile.data_inicio && today < profile.data_inicio) {
    return { ok: false, reason: `O seu acesso será libertado em ${profile.data_inicio}.` };
  }
  if (profile.data_fim && today > profile.data_fim) {
    return { ok: false, reason: `O seu acesso expirou em ${profile.data_fim}.` };
  }
  return { ok: true };
}

async function loginUser(email, password) {
  showAlert("auth-alert", "A verificar credenciais...", "success");

  if (typeof sb === "undefined" || !sb) {
    return showAlert("auth-alert", "Erro de configuração do Supabase (config.js).");
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    return showAlert("auth-alert", error.message || "E-mail ou senha inválidos.");
  }

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (pErr || !profile) {
    await sb.auth.signOut();
    return showAlert("auth-alert", pErr ? pErr.message : "Perfil não encontrado na tabela profiles.");
  }

  if (profile.role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  const check = isAccessAllowed(profile);
  if (!check.ok) {
    await sb.auth.signOut();
    return showAlert("auth-alert", check.reason);
  }

  if (typeof openWorkspace === "function") {
    openWorkspace(profile);
  } else {
    document.getElementById("auth-section")?.classList.add("hidden");
    document.getElementById("app-section")?.classList.remove("hidden");
    const emailEl = document.getElementById("user-email");
    if (emailEl) emailEl.textContent = profile.email;
  }
}

async function registerUser(nome, email, whatsapp, password) {
  showAlert("auth-alert", "A criar conta...", "success");
  if (typeof sb === "undefined" || !sb) {
    return showAlert("auth-alert", "Erro de configuração do Supabase (config.js).");
  }
  const cleanWhatsapp = String(whatsapp || "").replace(/\D/g, "");
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome,
        whatsapp: cleanWhatsapp
      }
    }
  });
  if (error) return showAlert("auth-alert", error.message);
  showAlert("auth-alert", "Cadastro realizado! Aguarde a ativação pelo administrador.", "success");
}

async function recoverPassword(email) {
  showAlert("auth-alert", "A enviar ligação de recuperação...", "success");
  if (typeof sb === "undefined" || !sb) {
    return showAlert("auth-alert", "Erro de configuração do Supabase (config.js).");
  }
  const basePath = window.location.pathname.replace(/\/[^/]*$/, "/");
  const redirectTo = window.location.origin + basePath + "redefinir-senha.html";
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return showAlert("auth-alert", error.message);
  showAlert("auth-alert", "Enviámos uma ligação de recuperação para o seu e-mail.", "success");
}

async function logoutUser() {
  if (typeof sb !== "undefined" && sb) {
    await sb.auth.signOut();
  }
  window.location.href = "index.html";
}
