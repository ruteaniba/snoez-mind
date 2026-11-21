document.addEventListener("DOMContentLoaded", () => {
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
});

function switchTab(tab) {
  ["login-form", "register-form", "recover-form"].forEach(id => {
    document.getElementById(id)?.classList.add("hidden");
  });
  document.getElementById(`${tab}-form`)?.classList.remove("hidden");
  document.getElementById("auth-alert")?.classList.remove("show");
}
