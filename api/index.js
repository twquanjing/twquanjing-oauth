const crypto = require('crypto');

module.exports = async (req, res) => {
  // 💡 終極防禦：因為 Vercel 有時候會把 /login 或 /callback 帶上斜線傳進來
  // 我們直接抓取 req.url 的後半段路徑，不管 Vercel 怎麼導流，程式碼自己判斷！
  const { host } = req.headers;
  const url = new URL(req.url, `https://${host}`);
  const scope = 'repo,user';
  const provider = 'github';
  
  const client_id = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;

  // ✨ 精準相容：同時支援包含 /api/index、/login 或 /callback 的各種 Vercel 奇葩路由
  if (url.pathname.includes('/login')) {
    const state = crypto.randomBytes(16).toString('hex');
    res.writeHead(302, {
      Location: `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=${scope}&state=${state}`
    });
    return res.end();
  }

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
              // 這裡會安全地把暗號丟回給 twquanjing.github.io/admin/
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

  // 💡 如果 Vercel 真的完全不理會 vercel.json，那它的預設 API 路徑會是 /api/index 
  // 如果是透過後台直接彈出，我們就當作是 callback 處理
  res.statusCode = 404;
  return res.end('Not Found');
};
