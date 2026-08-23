"use client";

// Limpa o cache de páginas do service worker no logout — sem isso, HTML de
// telas autenticadas (financeiro, dados de cliente etc.) já renderizado
// ficava em disco indefinidamente, disponível offline sem checar sessão.
export function clearServiceWorkerPageCache() {
  navigator.serviceWorker?.controller?.postMessage({
    type: "CLEAR_PAGE_CACHE",
  });
}
