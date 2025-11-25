// src/smart-health-checkin.ts
function generateRandomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function parseReturnHash(hash) {
  if (!hash || hash === "#")
    return null;
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const p = new URLSearchParams(h);
  const state = p.get("state");
  if (!state)
    return null;
  const error = p.get("error");
  if (error) {
    return {
      type: "error",
      state,
      error,
      error_description: p.get("error_description") || undefined
    };
  }
  const vpToken = p.get("vp_token");
  const smartArtifacts = p.get("smart_artifacts");
  if (vpToken && smartArtifacts) {
    return {
      type: "success",
      state,
      vp_token: JSON.parse(vpToken),
      smart_artifacts: JSON.parse(smartArtifacts)
    };
  }
  return null;
}
function broadcastResponse(state, data) {
  const bc = new BroadcastChannel("shl-" + state);
  bc.postMessage({ state, ...data });
  bc.close();
}
function rehydrateResponse(response) {
  const credentials = {};
  for (const [id, presentations] of Object.entries(response.vp_token)) {
    credentials[id] = presentations.map((presentation) => {
      const artifact = response.smart_artifacts[presentation.artifact];
      return artifact?.data !== undefined ? artifact.data : artifact;
    });
  }
  return {
    ...response,
    credentials
  };
}
async function request(dcqlQuery, opts) {
  const checkinBase = opts.checkinBase.replace(/\/+$/, "");
  if (!checkinBase) {
    throw new Error("checkinBase required");
  }
  if (!dcqlQuery || !Array.isArray(dcqlQuery.credentials)) {
    throw new Error("dcqlQuery must be an object with a credentials array");
  }
  const state = generateRandomState();
  const nonce = generateRandomState();
  const shouldRehydrate = opts.rehydrate !== false;
  const timeout = opts.timeout ?? 2 * 60 * 1000;
  const chan = new BroadcastChannel("shl-" + state);
  let popup = null;
  const done = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Request timeout"));
    }, timeout);
    chan.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.state !== state)
        return;
      if (msg.error) {
        cleanup();
        const err = new Error(msg.error_description || msg.error);
        err.code = msg.error;
        err.state = msg.state;
        reject(err);
        return;
      }
      if (msg.vp_token && msg.smart_artifacts) {
        cleanup();
        const response = {
          state: msg.state,
          vp_token: msg.vp_token,
          smart_artifacts: msg.smart_artifacts
        };
        resolve(shouldRehydrate ? rehydrateResponse(response) : response);
      }
    };
    function cleanup() {
      clearTimeout(timeoutId);
      chan.close();
      try {
        if (popup && !popup.closed) {
          popup.close();
        }
      } catch {}
    }
  });
  const redirectUrl = new URL(location.href);
  redirectUrl.hash = "";
  const redirectUri = redirectUrl.toString();
  const clientId = `redirect_uri:${redirectUri}`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "vp_token",
    response_mode: "fragment",
    nonce,
    state,
    dcql_query: JSON.stringify(dcqlQuery)
  });
  if (opts.onRequestStart) {
    opts.onRequestStart({
      client_id: clientId,
      response_type: "vp_token",
      response_mode: "fragment",
      state,
      nonce,
      dcql_query: dcqlQuery
    });
  }
  const url = `${checkinBase}/?${params.toString()}`;
  popup = window.open(url, "_blank");
  if (!popup) {
    chan.close();
    throw new Error("Popup blocked - please allow popups for this site");
  }
  return done;
}
function renderReturnUI(success, message) {
  document.body.textContent = "";
  const div = document.createElement("div");
  div.style.cssText = "font-family:system-ui;padding:40px;text-align:center;background:#0f141c;color:#e9eef5;min-height:100vh";
  const h1 = document.createElement("h1");
  h1.style.cssText = success ? "color:#4ade80" : "color:#f87171";
  h1.textContent = success ? "✓ Shared" : "✗ Not Shared";
  const p = document.createElement("p");
  p.textContent = message;
  div.appendChild(h1);
  div.appendChild(p);
  document.body.appendChild(div);
}
async function maybeHandleReturn(opts = {}) {
  const renderUI = opts.renderUI !== false;
  const parsed = parseReturnHash(location.hash);
  if (!parsed)
    return false;
  if (parsed.type === "error") {
    broadcastResponse(parsed.state, {
      error: parsed.error,
      error_description: parsed.error_description
    });
    if (renderUI) {
      renderReturnUI(false, parsed.error_description || parsed.error);
      window.close();
    }
    return true;
  }
  if (parsed.type === "success") {
    broadcastResponse(parsed.state, {
      vp_token: parsed.vp_token,
      smart_artifacts: parsed.smart_artifacts
    });
    if (renderUI) {
      renderReturnUI(true, "You can close this window.");
      window.close();
    }
    return true;
  }
  return false;
}
if (typeof window !== "undefined") {
  window.SHL = {
    request,
    maybeHandleReturn,
    parseReturnHash,
    rehydrateResponse
  };
}
export {
  request,
  renderReturnUI,
  rehydrateResponse,
  parseReturnHash,
  maybeHandleReturn,
  broadcastResponse
};
