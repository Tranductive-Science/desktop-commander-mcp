export function renderDashboardHtml(info: {
    port: number;
    publicUrl: string;
    authIssuer: string;
    authMode: string;
    uptimeSeconds: number;
    version: string;
}): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desktop Commander Edge Companion — Transductive Science</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #131b2e;
      --border: #1e293b;
      --primary: #7c3aed;
      --primary-light: #a78bfa;
      --accent: #10b981;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 32px 16px;
    }
    .container { max-width: 960px; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; border-bottom: 1px solid var(--border); padding-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo { width: 44px; height: 44px; background: linear-gradient(135deg, var(--primary), #3b82f6); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; }
    .brand-title h1 { font-size: 22px; font-weight: 700; color: #fff; }
    .brand-title p { font-size: 13px; color: var(--primary-light); }
    .status-badge { display: flex; align-items: center; gap: 8px; background: #064e3b; color: #34d399; padding: 6px 14px; border-radius: 9999px; font-weight: 600; font-size: 13px; border: 1px solid #059669; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 32px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; }
    .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; color: #e2e8f0; }
    .field { margin-bottom: 14px; }
    .field-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .copy-box { display: flex; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    .copy-box input { flex: 1; background: transparent; border: none; padding: 8px 12px; color: #38bdf8; font-family: monospace; font-size: 13px; outline: none; }
    .copy-box button { background: #1e293b; border: none; border-left: 1px solid #334155; color: #f1f5f9; padding: 8px 14px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .copy-box button:hover { background: #334155; }
    
    .section-title { font-size: 20px; font-weight: 700; margin: 32px 0 16px 0; color: #fff; display: flex; align-items: center; gap: 10px; }
    .guide-step { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 16px; }
    .guide-step h3 { font-size: 16px; color: #38bdf8; margin-bottom: 8px; }
    .guide-step p { font-size: 14px; color: #cbd5e1; margin-bottom: 12px; }
    .guide-step ol { padding-left: 20px; font-size: 14px; color: #cbd5e1; }
    .guide-step ol li { margin-bottom: 6px; }
    
    .info-callout { background: #1e1b4b; border-left: 4px solid var(--primary); padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 14px; color: #e0e7ff; }
    .info-callout strong { color: #fff; }
    
    .wishlist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .wishlist-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; position: relative; }
    .wishlist-tag { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; background: #312e81; color: #a5b4fc; margin-bottom: 8px; }
    .wishlist-card h4 { font-size: 15px; color: #f8fafc; margin-bottom: 6px; }
    .wishlist-card p { font-size: 13px; color: var(--text-muted); }
    
    footer { text-align: center; margin-top: 48px; border-top: 1px solid var(--border); padding-top: 24px; font-size: 13px; color: var(--text-muted); }
    footer a { color: var(--primary-light); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-logo">⚡</div>
        <div class="brand-title">
          <h1>Desktop Commander Edge Companion</h1>
          <p>By Transductive Science (<a href="https://transductive.org" target="_blank" style="color: var(--primary-light);">transductive.org</a>)</p>
        </div>
      </div>
      <div class="status-badge">
        <div class="status-dot"></div>
        <span>Service Active (Port ${info.port})</span>
      </div>
    </header>

    <div class="info-callout">
      <strong>🔒 Why is a Cloudflare Tunnel necessary & 100% safe?</strong><br>
      ChatGPT runs in OpenAI's cloud and needs a secure HTTPS connection to reach your local computer. Rather than opening risky inbound ports on your home router (port-forwarding), the Cloudflare Tunnel opens an <strong>outbound-only encrypted tunnel</strong>. All requests must pass <strong>OAuth 2.0 PKCE authentication</strong>. Zero open firewall ports, zero remote desktop video latency, and direct native execution.
    </div>

    <div class="grid">
      <div class="card">
        <h2>⚡ ChatGPT Connection Parameters</h2>
        <div class="field">
          <div class="field-label">1. Server URL / MCP Endpoint</div>
          <div class="copy-box">
            <input id="f-mcp" readonly value="${info.publicUrl}/mcp">
            <button onclick="navigator.clipboard.writeText(document.getElementById('f-mcp').value)">Copy</button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">2. Authorization URL</div>
          <div class="copy-box">
            <input id="f-auth" readonly value="${info.authIssuer}/authorize">
            <button onclick="navigator.clipboard.writeText(document.getElementById('f-auth').value)">Copy</button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">3. Token URL</div>
          <div class="copy-box">
            <input id="f-tok" readonly value="${info.authIssuer}/token">
            <button onclick="navigator.clipboard.writeText(document.getElementById('f-tok').value)">Copy</button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">4. Scope</div>
          <div class="copy-box">
            <input id="f-scope" readonly value="mcp openid">
            <button onclick="navigator.clipboard.writeText(document.getElementById('f-scope').value)">Copy</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>🖥️ Local Runtime Status</h2>
        <div class="field">
          <div class="field-label">Service Port</div>
          <div style="font-family: monospace; font-size: 14px; color: #38bdf8;">${info.port} (127.0.0.1)</div>
        </div>
        <div class="field">
          <div class="field-label">Authentication Mode</div>
          <div style="font-family: monospace; font-size: 14px; color: #34d399;">${info.authMode.toUpperCase()} (PKCE + JWKS)</div>
        </div>
        <div class="field">
          <div class="field-label">Active Version</div>
          <div style="font-family: monospace; font-size: 14px; color: #f1f5f9;">v${info.version} (Transductive Edition)</div>
        </div>
        <div class="field">
          <div class="field-label">Tools Registered</div>
          <div style="font-family: monospace; font-size: 14px; color: #fbbf24;">26 Tools (Filesystem, Terminal, Process, Ripgrep)</div>
        </div>
      </div>
    </div>

    <div class="section-title">📖 Setup Guide for ChatGPT (Step-by-Step)</div>
    
    <div class="guide-step">
      <h3>Step 1: Open ChatGPT Connected Apps / MCP Settings</h3>
      <p>Log in to ChatGPT in your browser (Brave, Chrome, Edge), click your profile icon in the bottom left -> <strong>Settings</strong> -> <strong>Connected Apps / Developer Mode / MCP Connectors</strong>.</p>
    </div>

    <div class="guide-step">
      <h3>Step 2: Add Desktop Commander MCP</h3>
      <p>Click <strong>Add New Connector</strong> (or Add Custom MCP App) and paste the parameters from the card above:</p>
      <ol>
        <li>Set <strong>Authentication Type</strong> to <code>OAuth 2.0</code>.</li>
        <li>Paste the <strong>Server URL</strong> (<code>${info.publicUrl}/mcp</code>).</li>
        <li>Paste the <strong>Authorization URL</strong> and <strong>Token URL</strong>.</li>
        <li>Set <strong>Scope</strong> to <code>mcp openid</code>.</li>
        <li>Click <strong>Connect & Authorize</strong>. When the browser tab opens, click <strong>"Approve"</strong>.</li>
      </ol>
    </div>

    <div class="guide-step">
      <h3>Step 3: Scan Tools & Start Talking!</h3>
      <p>Click <strong>"Scan Tools"</strong> to verify all 26 tools appear. In any chat, you can now prompt:</p>
      <p style="background: #0f172a; padding: 10px; border-radius: 6px; font-family: monospace; color: #4ade80; font-size: 13px;">
        "Use Desktop Commander to list the files in my project directory and run the test suite."
      </p>
    </div>

    <div class="section-title">🚀 Future Wishlist & Roadmap (Transductive Science)</div>
    <div class="wishlist-grid">
      <div class="wishlist-card">
        <span class="wishlist-tag">In Development</span>
        <h4>Automated Workflow Triggers</h4>
        <p>Allow ChatGPT and background agents to wake up on file system events, webhooks, or recurring schedules to autonomously run maintenance.</p>
      </div>

      <div class="wishlist-card">
        <span class="wishlist-tag">Planned</span>
        <h4>Multi-Device Mesh Sync</h4>
        <p>Control multiple Windows, Mac, and Linux machines from a single ChatGPT session with smart device-routing and cross-device clipboard sync.</p>
      </div>

      <div class="wishlist-card">
        <span class="wishlist-tag">Planned</span>
        <h4>Encrypted File Vault & Sandbox</h4>
        <p>Granular folder-level biometric & PIN access controls preventing unauthorized read/write outside designated project workspaces.</p>
      </div>

      <div class="wishlist-card">
        <span class="wishlist-tag">Research</span>
        <h4>Zero-Latency Local LLM Sidecar</h4>
        <p>Hybrid local embedding engine to pre-index millions of files in real time, making billion-line codebase queries instant.</p>
      </div>
    </div>

    <footer>
      <p>Desktop Commander Edge Edition is an open-source project by <a href="https://transductive.org" target="_blank">Transductive Science</a>.</p>
      <p style="margin-top: 6px;">Repository: <a href="https://github.com/Tranductive-Science/desktop-commander-mcp" target="_blank">github.com/Tranductive-Science/desktop-commander-mcp</a></p>
    </footer>
  </div>
</body>
</html>`;
}
