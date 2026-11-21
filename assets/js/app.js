document.addEventListener("DOMContentLoaded", async () => {
  const formLogin = document.getElementById("login-form");
  const formRegister = document.getElementById("register-form");
  const formRecover = document.getElementById("recover-form");

  formLogin?.addEventListener("submit", (e) => {
    e.preventDefault();
    loginUser(
      document.getElementById("login-email").value.trim(),
      document.getElementById("login-pass").value
    );
  });

  formRegister?.addEventListener("submit", (e) => {
    e.preventDefault();
    registerUser(
      document.getElementById("reg-nome").value.trim(),
      document.getElementById("reg-email").value.trim(),
      document.getElementById("reg-whatsapp").value.trim(),
      document.getElementById("reg-pass").value
    );
  });

  formRecover?.addEventListener("submit", (e) => {
    e.preventDefault();
    recoverPassword(document.getElementById("rec-email").value.trim());
  });

  if (typeof sb !== "undefined" && sb) {
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
          document.getElementById("auth-section")?.classList.add("hidden");
          document.getElementById("app-section")?.classList.remove("hidden");
          const emailEl = document.getElementById("user-email");
          if (emailEl) emailEl.textContent = profile.email;
        }
      }
    }
  }
});

function switchTab(tab) {
  ["login-form", "register-form", "recover-form"].forEach(id => {
    document.getElementById(id)?.classList.add("hidden");
  });
  document.getElementById(`${tab}-form`)?.classList.remove("hidden");
  document.getElementById("auth-alert")?.classList.remove("show");
}
