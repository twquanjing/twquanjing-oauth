const crypto = require('crypto');

module.exports = async (req, res) => {
  const { host } = req.headers;
  const url = new URL(req.url, `https://${host}`);
  const scope = 'repo,user';
  const provider = 'github';
  
  const client_id = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;

  // ✨ 完美統一：當 Decap CMS 發送 /auth 或是舊的 /login 請求時，通通觸發登入
  if (url.pathname.includes('/auth') || url.pathname.includes('/login')) {
    const state = crypto.randomBytes(16).toString('hex');
    res.writeHead(302, {
      Location: `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=${scope}&state=${state}`
    });
    return res.end();
  }

  // ⚠️ 注意：這個 /callback 必須保留！因為 GitHub 授權完後會固定把密碼丟回這個路徑
  if (url.pathname.includes('/callback')) {
    const code = url.searchParams.get('code');
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id,
          client_secret,
          code
        })
      });

      const data = await response.json();
      const { access_token, error } = data;
      
      let content, status;
      if (error) {
        content = JSON.stringify({ error });
        status = 'error';
      } else {
        content = JSON.stringify({ token: access_token, provider });
        status = 'success';
      }

      const script = `
        <script>
          (function() {
            function recieveMessage(e) {
              window.opener.postMessage("authorization:${provider}:${status}:${content}", e.origin);
            }
            window.addEventListener("message", recieveMessage, false);
            window.opener.postMessage("authorizing:${provider}", "*");
          })();
        </script>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.end(script);
    } catch (err) {
      res.statusCode = 500;
      return res.end(err.message);
    }
  }

  // 如果都不匹配，才會走到這
  res.statusCode = 404;
  return res.end('Not Found');
};
