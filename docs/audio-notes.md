# 台灣華語朗讀的更新方式

目前的 606 段預製朗讀採 Microsoft `zh-TW-HsiaoChenNeural` 台灣華語神經語音，語速 `-6%`、音高 `-2Hz`。採成年教師般平穩清楚的說話方向，沒有指定真人聲音。全部 MP3 已放在 `public/audio`，一般遊玩及 GitHub 建置不必連接語音服務。

修改題庫後，在專案根目錄執行：

```powershell
npm run content:export
npm run audio:generate -- -FfmpegPath "你的 FFmpeg 路徑"
npm run content:check
npm run build
```

製作新音檔需要連網、Python 3.10 以上、pip 與 FFmpeg。`-PythonPath` 可指定 Python；FFmpeg 也可經 `AI_GAME_FFMPEG` 指定。生成腳本把 `edge-tts==7.2.7`、`truststore==0.10.4` 及其依賴裝在被 Git 忽略的 `.audio-work/tts-runtime`，不修改全域 Python，也不要求付費 API 或金鑰。TLS 驗證使用系統信任憑證，沒有停用驗證。

腳本先產生新清單及待生成文字，再以四個工作同步製作新版 MP3。每段完成後使用 FFmpeg 完整解碼檢查；全部完成後才把新版音檔複製到 `public/audio`、核對 SHA-256、切換索引並移除沒有被索引使用的舊音檔。生成失敗時，先前可播放的索引會保留；重新執行可沿用已完成且通過解碼的片段。`.audio-work/neural-audio-audit.json` 保存完整生成檢查結果。

`-Concurrency 1` 至 `6` 可調整同步工作數；預設 `4`。`-Force` 會重製全部片段。遊戲的音檔識別包含音色及語速版本，切換後瀏覽器會下載新音檔，不會把舊音色當成新版。

如要更換音色或參數，須同步更新 `scripts/check-content.ts` 的檔名版本前綴及 `scripts/generate-audio.ps1` 的 `VOICE`、`RATE`、`PITCH`、`PROFILE`，再重製整包。不要只覆蓋索引或只更換部分音檔。

服務與生成工具的來源、授權說明見 `public/audio/provenance.md`。Microsoft 音色支援表：[官方文件](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)；生成工具：[edge-tts 原始碼](https://github.com/rany2/edge-tts)。
