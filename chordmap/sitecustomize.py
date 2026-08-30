from fastapi.responses import HTMLResponse

import app.main as main

_original_index = main.index

HELPER = r'''
<style>
.ytassist{display:none;margin-top:14px;padding:14px;border:1px solid #3b465b;background:#0d131d;border-radius:14px;gap:10px}
.ytassist.show{display:grid}.ytassist strong{font-size:14px}.ytassist p{margin:0;color:#8e9aad;font-size:12px;line-height:1.65}
.ytassist .actions{display:flex;flex-wrap:wrap;gap:8px}.ytbadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 8px;border-radius:999px;border:1px solid #554b37;color:#f2c66d;font-size:11px;font-weight:800}
</style>
<script>
(() => {
  const input=document.querySelector('#urlInput');
  const form=document.querySelector('#urlForm');
  const status=document.querySelector('#status');
  const hint=document.querySelector('#pane-url .hint');
  if(!input||!form||!status||!hint) return;
  const turbo='https://turboscribe.ai/zh-TW/downloader/youtube/mp3/free';
  const isYT=value=>{try{const u=new URL(value);const h=u.hostname.toLowerCase();return h==='youtu.be'||h==='youtube.com'||h.endsWith('.youtube.com')}catch{return false}};
  const box=document.createElement('div');
  box.className='ytassist'; box.id='ytAssist';
  box.innerHTML='<span class="ytbadge">YouTube → MP3 輔助流程</span><strong>偵測到 YouTube 網址</strong><p>TurboScribe 的公開下載頁目前沒有提供第三方網站可自動取回 MP3 的 Downloader API。按下按鈕後，ChordMap 會先嘗試複製你貼的 YouTube 網址，再開啟 TurboScribe。下載你有權使用的 MP3 後，回到上傳音檔即可直接抓和弦。</p><div class="actions"><button id="youtubeConvert" class="primary" type="button">複製網址並開啟 TurboScribe</button><button id="youtubeUpload" class="ghost" type="button">我已下載 MP3 → 上傳</button></div>';
  hint.insertAdjacentElement('afterend',box);
  const setStatus=(text,kind='')=>{status.textContent=text;status.className=('status '+kind).trim()};
  const refresh=()=>{const show=isYT(input.value.trim());box.classList.toggle('show',show);if(show)setStatus('YouTube 連結已辨識。可先用 TurboScribe 轉成你有權使用的 MP3，再回來分析。')};
  input.addEventListener('input',refresh); refresh();
  box.querySelector('#youtubeConvert').addEventListener('click',async()=>{
    const url=input.value.trim(); if(!isYT(url)){setStatus('請先貼入 YouTube 網址。','error');return}
    let copied=false; try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);copied=true}}catch{}
    window.open(turbo,'_blank','noopener,noreferrer');
    setStatus(copied?'已複製 YouTube 網址並開啟 TurboScribe。轉好 MP3 後回來上傳即可。':'已開啟 TurboScribe。請把 YouTube 網址貼過去，轉好 MP3 後回來上傳。','ok');
  });
  box.querySelector('#youtubeUpload').addEventListener('click',()=>{
    document.querySelector('[data-tab="upload"]')?.click();
    setStatus('選擇剛才下載、且你有權使用的 MP3，ChordMap 會直接開始分析。');
    document.querySelector('#fileInput')?.focus();
  });
  form.addEventListener('submit',event=>{
    if(!isYT(input.value.trim())) return;
    event.preventDefault(); event.stopImmediatePropagation(); refresh();
    setStatus('YouTube 一般播放頁不能直接交給 ChordMap 當音訊檔。請使用下方 TurboScribe 按鈕轉成你有權使用的 MP3，再回來上傳。');
  },true);
  document.querySelector('.badge')?.replaceChildren(document.createTextNode('ChordMap V0.3.2'));
})();
</script>
'''

# Remove the original root route and replace only the rendered shell.
main.app.router.routes[:] = [
    route for route in main.app.router.routes
    if not (getattr(route, 'path', None) == '/' and 'GET' in (getattr(route, 'methods', None) or set()))
]

@main.app.get('/', response_class=HTMLResponse)
def youtube_helper_index():
    response = _original_index()
    body = response.body.decode('utf-8')
    return HTMLResponse(body.replace('</body>', HELPER + '\n</body>'))
