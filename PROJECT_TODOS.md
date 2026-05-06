# Midterm Project TODOs

整理日期：2026-05-07  
依據：`2026(Spring)_SS-Midterm Project.pdf`

## 總覽

目前根目錄專案是 React + Vite + Firebase chatroom。`npm run build` 已通過，build output 會輸出到 `public/`，符合 `firebase.json` 的 Firebase Hosting 設定。

最高優先事項不是再加很多功能，而是把已完成的功能寫清楚、修掉明顯風險、確認部署與繳交流程。

## P0：今天繳交前必做

- [ ] 重寫 `README.md`。
  - 必須說明網站功能、操作方式、local setup step by step。
  - 目前 README 還是 Create React App 預設內容，會讓 TA 找不到功能，也可能被 README 規則扣分。
  - README 需至少包含：註冊/登入、加好友、建立私訊/群組、邀請成員、傳訊息、搜尋、編輯、收回、傳圖片、reply、profile、通知、Firebase deploy URL、GitHub URL。

- [ ] 產生或補上 `AI_reference.pdf`。
  - 如果有用 AI：列模型、使用範圍、檔名與行號、prompt/response、修改後說明。
  - 如果完全沒用 AI：PDF 內寫 `No AI tools were used in this assignment.`
  - 注意：這份檔案要放在 project root。

- [ ] 確認 Firebase Hosting 已部署且網址可打開。
  - 指令：`npm run deploy`
  - 部署後用無痕視窗測：登入、聊天室、重新整理是否仍可進 `/chat`。
  - `firebase.json` hosting public 目前是 `public`，而 `vite.config.js` build outDir 也是 `public`。

- [ ] 打包前清掉不該交的內容。
  - 不要把 `node_modules/`、`my-app/node_modules/` 放進 zip。
  - 檢查是否真的需要交 `my-app/`；它看起來像另一個 Vite 範例專案，若不是主作品，建議不要放進最終 zip。
  - 確認 `public/` 是最新 `npm run build` 產物。

- [ ] 做 MD5 checksum 並填表。
  - PDF 寫明沒做 MD5 會扣 10%。
  - zip 檔名依規則：`Midterm_Project_學號.zip`，重傳用 `Midterm_Project_學號_v?.zip`。
  - eeclass 需交：MD5、web link、GitHub URL。

## P1：Basic Components 50%

- [x] Membership mechanism：Email Sign Up / Email Sign In。
  - 對應：`src/components/auth.jsx`
  - 還要實測：新帳號註冊後是否會寫入 `users/{uid}`。

- [x] Firebase authenticated database read/write。
  - 對應：`database.rules.json` 目前限制 `auth != null` 才可 read/write。
  - 建議：README 說明資料都需登入後操作。

- [x] React framework。
  - 這是 advanced 5%，但也是整體架構事實。

- [ ] Firebase Hosting 實際部署驗證。
  - 程式設定看起來 OK，但要以線上 URL 實測才算完成。

- [ ] RWD 實機/瀏覽器測試。
  - PDF 要求不同尺寸所有 components remain visible，且小螢幕若需要 scrolling 會扣分。
  - 目前 CSS 在小於 1000px 會縮 sidebar，但還需要測手機寬度：登入頁、聊天室、settings panel、profile、friends view、modal。

- [ ] Git commit 紀錄整理。
  - PDF 要求 regular commits，不只最後一天。
  - 繳交前至少確認目前變更都已 commit，並保留合理 commit history。

- [x] Chatroom core。
  - 可建立私訊、群組聊天室。
  - 可載入目前聊天室歷史訊息。
  - 可在群組 settings 裡邀請新成員。
  - 需實測：兩個以上帳號同時在線互傳、舊訊息重新整理後仍存在、新成員加入後可看到聊天室。

## P1：Advanced Components 35%

- [x] Google sign in。
  - 對應：`src/components/auth.jsx`
  - 分數小但容易拿，README 要明確寫出。

- [x] Chrome notification。
  - 對應：`src/pages/Chat.jsx`
  - 需實測：Chrome 背景/切 tab 時，只有別人的新訊息通知；目前邏輯會略過自己發的訊息與 muted chat。

- [x] CSS animation 佐證。
  - 目前有 transition/hover，但 PDF 明確說 button hover 不算 animation。
  - TODO：加入一個明顯但不干擾的 CSS animation，例如新訊息淡入、登入卡片進場、送出訊息 bubble pop-in，並在 README 指出位置。

- [x] Sending code problem。
  - React 直接把訊息放在 JSX `{msg.text}` 中，沒有使用 `dangerouslySetInnerHTML`，`<script>` / `<h1>` 應會以文字顯示。
  - 仍需手動測試貼上 `<script>alert("example");</script>` 與 `<h1>example</h1>`。

- [x] User profile。
  - 有獨立 profile page。
  - 可編輯並儲存 profile picture、username/displayName、email、phone、address。
  - Chatroom 有顯示 sender name / avatar。

- [x] Message operations。
  - Unsend 自己訊息。
  - Edit 自己訊息。
  - Search messages。
  - Send image，圖片訊息也可由自己 unsend。
  - 需實測：非本人看不到 edit/unsend 按鈕。

## P2：Bonus 可選加分

- [x] Reply for specific message。
  - 已有 reply UI、輸入框上方 preview、點 reply box scroll/highlight 原訊息。
  - 這項最高 6%，建議 README 放一段清楚操作說明。

- [ ] Message emoji reaction。
  - 未看到實作。
  - 若時間夠，這項 3%，可做在每則訊息 actions 裡：新增 emoji reaction、顯示統計、允許使用者收回自己的 reaction。

- [ ] Block user。
  - 未看到實作。
  - 若時間夠，這項 2%，但牽涉私訊阻擋與群組互相隱藏訊息，測試成本高。

- [ ] Tenor GIF。
  - 未看到實作。
  - 這項 3%，需要 Tenor API key 與搜尋/傳送 GIF UI。

- [ ] Chatbot。
  - 未看到實作。
  - 這項 2%，需 ChatGPT 或 Gemini API；若前端直放 API key 不安全，建議沒時間就不要硬做。

- [ ] Custom sticker。
  - 未看到實作。
  - 這項最高 10%，但 canvas、筆刷、顏色、定位、unsend 都要做，時間不足時風險較高。

## P2：程式碼與交付品質

- [ ] 修掉 `src/pages/Chat.jsx` 的不可達程式碼。
  - `handleComposerKeyDown` 裡 `return;` 後面還有一行 `msgData.replyToSender = ...`，這行永遠不會執行，而且 `msgData` 在該 scope 不存在。
  - Build 會過，但這是 code review 明顯瑕疵，建議刪掉。

- [ ] 移除未使用 import/state。
  - 例：`src/pages/Profile.jsx` import 了 `Link` 但未使用。
  - 例：`src/components/auth.jsx` 有 `mode` state 但未使用。

- [ ] 檢查 Firebase Storage rules。
  - 程式有上傳 profile image、chat image、chat icon。
  - 目前 repo 只有 Realtime Database rules，未看到 storage rules 檔；請確認 Firebase Console 中 Storage rules 允許 authenticated upload/read。

- [ ] 確認 `public/index.html`、`public/assets/*` 是 build 產物，不要手動改。
  - 每次 code 改完都跑 `npm run build`。

- [ ] 視覺與功能手測清單。
  - 桌機：Chrome、Firefox/Edge 任一。
  - 手機寬度：375x667、390x844。
  - 帳號情境：A/B 兩個使用者、A/B/C 群組。
  - 功能情境：註冊、登入、profile 儲存、加好友、私訊、群組、加成員、傳文字、傳 code、傳圖、edit、unsend、search、reply、notification。

## 最終繳交 Checklist

- [ ] `npm run build` 成功。
- [ ] `npm run deploy` 成功。
- [ ] README 已更新，TA 照著能 setup locally。
- [ ] `AI_reference.pdf` 已放 root。
- [ ] 不包含 `node_modules/`。
- [ ] 不包含不必要的 `my-app/` 範例專案，除非它是作業必要內容。
- [ ] zip 檔名符合規定。
- [ ] MD5 已產生並填表。
- [ ] FTP 已上傳 zip。
- [ ] eeclass 已填 MD5、Firebase URL、GitHub URL。
