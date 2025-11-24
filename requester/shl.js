/**
 * SHL Share Picker - Client Library
 * A minimalist, static, cross-platform flow for secure credential sharing
 */
(() => {
  const te = new TextEncoder(), td = new TextDecoder();

  // Base64url encoding/decoding utilities
  const b64u = (buf) => {
    const bin = String.fromCharCode(...new Uint8Array(buf));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const ub64 = (s) => {
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
  };

  const encJ = (o) => b64u(te.encode(JSON.stringify(o)));
  const decJ = (s) => JSON.parse(td.decode(ub64(s)));

  // Generate random state (128-bit hex)
  const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  /**
   * Initiate a credential request (Navigator Credentials API compatible)
   * @param {Object} credentialRequest - { digital: { requests: [{ protocol, data }] } }
   * @param {Object} opts - Options { checkinBase, onRequestStart?: (params) => void }
   * @returns {Promise<Object>} - { type, protocol, data }
   */
  async function request(credentialRequest, opts) {
    if (!credentialRequest?.digital?.requests?.[0]) {
      throw new Error('digital.requests[0] required');
    }

    const checkinBase = (opts?.checkinBase || opts?.gatewayBase || '').replace(/\/+$/, '');
    if (!checkinBase) throw new Error('checkinBase required');

    const protocol = credentialRequest.digital.requests[0].protocol;
    if (protocol !== 'openid4vp') {
      throw new Error('Only openid4vp protocol is supported');
    }

    const state = rand();
    const onRequestStart = typeof opts?.onRequestStart === 'function' ? opts.onRequestStart : null;

    console.log('[SHL] Initiating request:', { credentialRequest, state });

    // Prepare listeners BEFORE opening popup
    const chan = new BroadcastChannel('shl-' + state);
    let pop;

    const done = new Promise((resolve, reject) => {
      const timeout = 2 * 60 * 1000; // 2 minutes
      const to = setTimeout(() => {
        cleanup();
        reject(new Error('Request timeout after 2 minutes'));
      }, timeout);

      chan.onmessage = async (ev) => {
        const msg = ev.data;
        console.log('[SHL] Received message on channel:', msg);

        if (!msg || msg.state !== state) return;
        if (msg.origin && msg.origin !== location.origin) {
          console.warn('[SHL] Origin mismatch, ignoring message');
          return;
        }

        if (msg.vp_token && msg.smart_artifacts) {
          console.log('[SHL] Received OID4VP split-payload response');
          cleanup();
          resolve({
            type: 'digital_credential',
            protocol,
            data: JSON.stringify(msg)
          });
        }
      };

      function cleanup() {
        clearTimeout(to);
        chan.close();
        try {
          if (pop && !pop.closed) {
            console.log('[SHL] Closing app picker popup');
            pop.close();
          }
        } catch (e) {
          console.warn('[SHL] Could not close popup:', e);
        }
      }
    });

    const redirectUrl = new URL(location.href);
    redirectUrl.hash = '';
    const redirectUri = redirectUrl.toString();
    const clientId = `redirect_uri:${redirectUri}`;
    const nonce = rand();

    const params = new URLSearchParams({
      protocol: 'openid4vp', // Custom signal for our picker
      client_id: clientId,
      response_type: 'vp_token',
      response_mode: 'fragment',
      nonce: nonce,
      state: state,
      dcql_query: JSON.stringify(credentialRequest.digital.requests[0].data.dcql_query)
    });

    if (onRequestStart) {
      onRequestStart({
        protocol,
        client_id: clientId,
        response_type: 'vp_token',
        response_mode: 'fragment',
        state,
        nonce,
        dcql_query: credentialRequest.digital.requests[0].data.dcql_query
      });
    }

    const url = `${checkinBase}/?${params.toString()}`;
    console.log('[SHL] Opening OID4VP check-in:', url);

    pop = window.open(url, '_blank');
    if (!pop) {
      chan.close();
      throw new Error('Popup blocked - please allow popups for this site');
    }

    return done;
  }

  /**
   * Auto-detect and handle return context
   * Call this on page load to handle return flow
   * @returns {Promise<boolean>} - true if this was a return context
   */
  async function maybeHandleReturn() {
    const h = location.hash.slice(1);
    if (!h) return false;

    const p = new URLSearchParams(h);
    const vpToken = p.get('vp_token');
    const smartArtifacts = p.get('smart_artifacts');
    const state = p.get('state');
    const nonce = p.get('nonce');
    if (!(vpToken && smartArtifacts && state && nonce)) return false;

    console.log('[SHL] Detected OID4VP return context');

    const bc = new BroadcastChannel('shl-' + state);
    bc.postMessage({
      origin: location.origin,
      state,
      nonce,
      vp_token: JSON.parse(vpToken),
      smart_artifacts: JSON.parse(smartArtifacts)
    });
    bc.close();

    document.body.textContent = '';
    const div = document.createElement('div');
    div.style.cssText = 'font-family:system-ui;padding:40px;text-align:center;background:#0f141c;color:#e9eef5;min-height:100vh';
    const h1 = document.createElement('h1');
    h1.style.cssText = 'color:#4ade80';
    h1.textContent = '✓ Shared';
    const p1 = document.createElement('p');
    p1.textContent = 'You can close this window.';
    div.appendChild(h1);
    div.appendChild(p1);
    document.body.appendChild(div);
    window.close();

    return true;
  }

  // Export API
  window.SHL = { request, maybeHandleReturn };
  console.log('[SHL] Library loaded');
})();
