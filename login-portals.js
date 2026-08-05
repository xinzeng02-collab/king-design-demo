(() => {
  const screen = document.querySelector("#loginScreen");
  const panels = [...document.querySelectorAll("[data-login-panel]")];
  const viewButtons = [...document.querySelectorAll("[data-login-target]")];
  const passwordButtons = [...document.querySelectorAll("[data-password-toggle]")];
  if (!screen || !panels.length) return;

  let activeView = "entry";
  let focusTimer = 0;
  let transitionTimer = 0;

  function focusFirstField(view) {
    if (view === "entry" || screen.classList.contains("hidden")) return;
    const panel = panels.find((item) => item.dataset.loginPanel === view);
    panel?.querySelector("input:not([type='checkbox'])")?.focus({ preventScroll: true });
  }

  function show(view, options = {}) {
    const targetView = panels.some((item) => item.dataset.loginPanel === view) ? view : "entry";
    const outgoing = panels.find((item) => item.classList.contains("is-active"));
    const incoming = panels.find((item) => item.dataset.loginPanel === targetView);
    if (!incoming) return;
    clearTimeout(focusTimer);
    clearTimeout(transitionTimer);

    if (outgoing && outgoing !== incoming) {
      outgoing.classList.add("is-leaving");
      outgoing.classList.remove("is-active");
      outgoing.setAttribute("aria-hidden", "true");
      transitionTimer = window.setTimeout(() => outgoing.classList.remove("is-leaving"), 420);
    }

    panels.forEach((panel) => {
      if (panel !== incoming && panel !== outgoing) {
        panel.classList.remove("is-active", "is-leaving");
        panel.setAttribute("aria-hidden", "true");
      }
    });
    incoming.classList.remove("is-leaving", "hidden");
    incoming.classList.add("is-active");
    incoming.setAttribute("aria-hidden", "false");
    screen.dataset.loginView = targetView;
    activeView = targetView;
    document.querySelector("#loginError")?.replaceChildren();
    document.querySelector("#clientLoginError")?.replaceChildren();
    if (options.focus !== false) focusTimer = window.setTimeout(() => focusFirstField(targetView), 390);
  }

  function setSubmitting(view, loading) {
    const button = document.querySelector(`[data-login-submit="${view}"]`);
    if (!button) return;
    button.disabled = Boolean(loading);
    button.classList.toggle("is-loading", Boolean(loading));
    button.setAttribute("aria-busy", String(Boolean(loading)));
    const loadingLabel = button.querySelector(".login-submit-loading");
    loadingLabel?.setAttribute("aria-hidden", String(!loading));
  }

  function handleViewClick(event) {
    const button = event.currentTarget;
    show(button.dataset.loginTarget);
  }

  function handlePasswordToggle(event) {
    const button = event.currentTarget;
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "显示" : "隐藏";
    button.setAttribute("aria-label", showing ? "显示密码" : "隐藏密码");
    button.setAttribute("aria-pressed", String(!showing));
    input.focus({ preventScroll: true });
  }

  viewButtons.forEach((button) => button.addEventListener("click", handleViewClick));
  passwordButtons.forEach((button) => button.addEventListener("click", handlePasswordToggle));
  show("entry", { focus: false });

  window.KingLoginPortal = {
    show,
    setSubmitting,
    getActiveView: () => activeView,
    destroy() {
      clearTimeout(focusTimer);
      clearTimeout(transitionTimer);
      viewButtons.forEach((button) => button.removeEventListener("click", handleViewClick));
      passwordButtons.forEach((button) => button.removeEventListener("click", handlePasswordToggle));
    },
  };
})();
