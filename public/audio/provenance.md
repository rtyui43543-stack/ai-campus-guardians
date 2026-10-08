# 離線台灣華語朗讀

本版使用 Microsoft `zh-TW-HsiaoChenNeural` 神經語音，語系為台灣華語（繁體中文）。朗讀方向是穩定、清楚、親切的成年教師口吻；語速設定為 `-6%`，音高設定為 `-2Hz`。這是合成語音，未模仿或複製任何特定老師的聲音。

所有朗讀由本專案題庫及教材說明產生，保存為 MP3，隨完整離線包下載。遊玩時只播放本機音檔，不呼叫語音服務，不需 API 金鑰或登入。

生成工具為 [edge-tts 7.2.7](https://github.com/rany2/edge-tts)，透過 Microsoft Edge 的線上朗讀服務製作音檔。該工具主要採 LGPLv3 授權；本網站沒有打包該 Python 工具或其執行環境。工具授權與語音服務條款是不同事項；此頁不授予 Microsoft 音色本身的所有權。

[Microsoft 官方語系與音色表](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)列有本音色。生成腳本為 `scripts/generate-audio.ps1`，只在更新教材文字或更換朗讀版本時需要連網執行。

`generation.json` 記錄音色、參數、各音檔大小與 SHA-256。每段音檔已通過完整 MP3 解碼檢查；題庫索引與音檔檔名使用 `zh-TW-HsiaoChenNeural-rate-6-pitch-2-v2` 版本識別。生成前會整理重複句點及多餘空格，保留題幹、四個選項、提示與解說的原意。

目前906個索引鍵對應696段唯一MP3，包含十四關的46段劇情。30道獨立最終新題新增210段音檔；舊V2L最終題的鍵仍保留，供既有存檔續玩並共用原主要題的同文本音檔。此次增量生成逐檔驗證並復用486段既有語音，沒有重製原題、劇情或音樂。舊24題複習的168段朗讀已從現行離線包移除，歷史文字與成績仍保留。
