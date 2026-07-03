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
            // 不等了！一進來直接主動向母視窗（後台）空投成功登入的暗號
            if (window.opener) {
              window.opener.postMessage("authorization:${provider}:${status}:${content}", "*");
              // 丟完暗號後，給它 200 毫秒的緩衝時間確保母視窗收下，然後自己功成身退關閉
              setTimeout(function() {
                window.close();
              }, 200);
            } else {
              document.body.innerHTML = "登入成功，請回到原視窗！若未自動關閉請手動關閉此分頁。";
            }
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
