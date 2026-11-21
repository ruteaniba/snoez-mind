function showAlert(id, msg, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `alert show ${type}`;
}

function isAccessAllowed(profile) {
  if (!profile || !profile.ativo) {
    return { ok: false, reason: "Sua conta está desativada. Fale com o administrador." };
  }
  const today = new Date().toISOString().split("T")[0];
  if (profile.data_inicio && today < profile.data_inicio) {
    return { ok: false, reason: `Seu acesso será liberado em ${profile.data_inicio}.` };
  }
  if (profile.data_fim && today > profile.data_fim) {
    return { ok: false, reason: `Seu acesso expirou em ${profile.data_fim}.` };
  }
  return { ok: true };
}

async function loginUser(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return showAlert("auth-alert", "E-mail ou senha inválidos.");

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (pErr || !profile) {
    await sb.auth.signOut();
    return showAlert("auth-alert", "Perfil não encontrado.");
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

  document.getElementById("auth-section").classList.add("hidden");
  document.getElementById("app-section").classList.remove("hidden");
  document.getElementById("user-email").textContent = profile.email;
}

async function registerUser(nome, email, whatsapp, password) {
  const cleanWhatsapp = whatsapp.replace(/\D/g, "");
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
  const redirectTo = window.location.origin + window.location.pathname.replace("index.html", "") + "redefinir-senha.html";
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return showAlert("auth-alert", error.message);
  showAlert("auth-alert", "Enviamos um link de recuperação para seu e-mail.", "success");
}

async function logoutUser() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}
