# GitHub Pages 上線與離線使用

把遊戲放到 GitHub Pages，學生第一次連網開啟、下載完整離線內容，再從主畫面開啟，就能在沒有網路時答題、播放 3D 招式和中文朗讀。遊戲不需要 GitHub 帳號，也不需要登入；老師發布網站時才使用 GitHub。

## 老師發布：原始碼包（建議）

1. **解壓 GitHub-Source.zip，建立 GitHub 儲存庫。**將解壓後的內容放到儲存庫根目錄，根目錄應直接看到 package.json、src、public、.github，不能只上傳 ZIP，也不要再套一層資料夾。使用 GitHub Desktop 的 Publish repository 或 git push 上傳；需包含 .github/workflows/deploy-pages.yml 和 public/audio 的完整音檔。GitHub Free 可使用公開儲存庫的 Pages。
2. **設定 Pages。**在儲存庫的 Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。原始碼包已包含部署流程，不需另外貼入程式或設定 API 金鑰。
3. **執行並取得網址。**開啟 Actions → Deploy AI Campus Guardians to GitHub Pages，按 Run workflow，選 main 或 master。流程會安裝依賴、檢查題庫、跑測試、建置並發布。成功後在 Settings → Pages 查看網址，例如 https://你的帳號.github.io/你的儲存庫名稱/ 。之後推送 main／master 會自動更新。
4. **先試一次離線。**在實際手機／平板開啟該 HTTPS 網址，按下一節完成安裝與下載，關閉網路後再開啟測試。確認全部下載完畢後，再把網址分享給學生。

這個包可修改遊戲與題庫。public/audio 已有預錄台灣華語神經語音；GitHub 的建置流程直接使用音檔，不需要在 Linux 重新連接語音服務生成。不要把 node_modules、runtime、release、dist 或測試快取放進原始碼儲存庫。

## 只想直接上傳成品：靜態網站包

GitHub-Static.zip 已建置完成，適合只要發布的老師。**此包不要和原始碼包混放在同一個發布目錄。**

1. 解壓 GitHub-Static.zip，用 GitHub Desktop／git 將內容上傳到專門的儲存庫或發布分支。儲存庫根目錄應直接看到 index.html、sw.js、offline-manifest.json、assets、audio 和 .nojekyll；不要只上傳 ZIP。
2. 在 Settings → Pages → Source 選 **Deploy from a branch**，選剛才上傳的分支與 **/(root)**，按 Save。
3. 發布成功後使用 Settings → Pages 顯示的 HTTPS 網址，再完成學生安裝與離線下載。

.nojekyll 已包含在成品包；同一套檔案可放在帳號首頁或 /儲存庫名稱/ 子路徑，不必手動改網址。靜態網站包不提供原始碼的重新建置；日後改題目時用原始碼重建，再重新發布成品。

## 學生遊戲與教師備課分開

學生使用遊戲首頁 https://你的帳號.github.io/你的儲存庫名稱/ 。教師使用獨立備課網址 https://你的帳號.github.io/你的儲存庫名稱/teacher/ ，可查看教學說明，下載完整題目、選項、正確答案 CSV／HTML／Markdown 與題庫 JSON。教師備課頁不放在學生遊戲選單中。

學生的「下載離線內容」只儲存遊戲需要的程式、題目、字型、3D 場景與朗讀，不會下載 teacher/ 的教師手冊或答案檔。教師網頁與備課檔案保留在網站及發布包，需連網存取；教師可另行下載檔案到電腦備課。此網址是公開的獨立頁面，沒有密碼保護；區分入口是為了讓學生畫面維持遊戲流程。

## 學生使用：安裝、下載、離線

1. **連網開啟發布網址。**iPhone／iPad 使用 Safari 的「分享」→「加入主畫面」；若看到「打開為網頁 App」，請保持開啟。Android 使用 Chrome 的「安裝應用程式」或「加到主畫面」。電腦可使用支援安裝的 Chrome／Edge；也可在同一個瀏覽器收藏網址。
2. **從主畫面的遊戲圖示開啟。**按首頁「下載離線內容」，等到畫面顯示 **「可離線使用」**。下載期間保持畫面開啟；可暫停，之後再按下載會接續。安裝圖示本身不代表素材已完整下載。
3. **關掉網路測試。**開啟飛航模式，關閉遊戲後再從同一個主畫面圖示重開。全部十二關、題目、角色、攻擊、朗讀與進度都由裝置上的離線資料提供。完成下載後，日常遊玩不需重新連線或登入。
4. **更新或移除時留意存檔。**老師發布新版後，想更新時再連網下載新版，確認完整後套用。清除網站資料、移除網頁 App 或瀏覽器清理資料，可能移除離線內容與進度；請先在遊戲「離線與設定」匯出備份，之後再下載內容。

每台裝置、每個瀏覽器的下載與進度分開保存。若從 Safari 改到 Chrome，或換手機，請在新環境重新下載；可用匯出／還原移轉進度。首次使用仍需連網取得資料，老師改用其他發布網址後也需重新安裝與下載。

## 原始碼開發與重新打包

需要 Node.js 24；在專案資料夾執行：

```text
npm ci
npm run content:check
npm test
npm run build
npm run package:github
```

最後一行需 Windows PowerShell，會在 release 產生 GitHub-Source.zip 與 GitHub-Static.zip，檔名附離線版本號。兩包均附 SHA-256 檔與 GITHUB-PACKAGE-CONTENTS.json；原始碼包採明確檔案清單，不包含本機 Node 執行檔、node_modules、舊發佈包或裝置存檔。靜態包會逐檔核對離線清單的大小與 SHA-256，再打包成品。

Vite base 使用 ./。PWA 的 manifest、圖示、Service Worker、離線素材及下載連結均以遊戲所在的資料夾為基準，因此可使用任意儲存庫名稱。manifest 未指定 id，讓瀏覽器依實際 start_url 辨識此遊戲，避免同帳號其他 Pages 網站共用根網址身分。遊戲以 # 地圖／對戰路由運作，不需要 GitHub Pages 額外的 404 路由設定。完整離線資料含中文字型、題庫、程式和預錄朗讀；沒有外部模型或 CDN 的執行依賴。

## 官方設定說明

- [GitHub：自訂 Actions 部署 Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub：選擇發布來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Apple：iPad 網站加入主畫面](https://support.apple.com/en-ca/guide/ipad/ipad8f1f7a29/ipados)
- [Google：Android 安裝網頁應用程式](https://support.google.com/chrome/answer/9658361?hl=zh-Hant&co=GENIE.Platform%3DAndroid)
