const crypto = require('crypto');

module.exports = async (req, res) => {
  const { host } = req.headers;
  const url = new URL(req.url, `https://${host}`);
  const scope = 'repo,user';
  const provider = 'github';
  
  const client_id = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;

  // 1. 處理登入端點
  if (url.pathname.includes('/auth') || url.pathname.includes('/login')) {
    const state = crypto.randomBytes(16).toString('hex');
    res.writeHead(302, {
      Location: `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=${scope}&state=${state}`
    });
    return res.end();
  }

  // 2. 處理回呼端點 (Callback)
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

      // 🚀 請把原本的 const script = `...` 替換成以下這段經典對話版：
      const script = `
        <script>
          (function() {
            function recieveMessage(e) {
              // 當前台（母視窗）發送 handshake 訊號過來時，把暗號精準投遞過去
              window.opener.postMessage("authorization:${provider}:${status}:${content.replace(/"/g, '\\"')}", e.origin);
            }
            window.addEventListener("message", recieveMessage, false);
            // 點火：告訴母視窗，我準備好要傳輸了
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

  // 3. 都不匹配時的回傳
  res.statusCode = 404;
  return res.end('Not Found');
};
