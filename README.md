# Galleria Chat

Galleria Chat 是一個以「文藝復興美術館 / 畫廊」為主題的即時聊天室。專案使用 React + Vite 建置前端，Firebase Authentication 負責登入註冊，Firebase Realtime Database 儲存使用者、好友、聊天室與訊息，Firebase Storage 儲存使用者頭像、聊天圖片與聊天室 icon，並整合 GIPHY API 傳送 GIF。

這份 README 說明所有功能、操作方式、local setup、Firebase 設定、部署流程，以及作業要求對照。

## Demo / Submission Links

- Firebase Hosting URL: `https://chat-room-885ce.firebaseapp.com/`
- GitHub Repository URL: `https://github.com/Latuuuuu/assignment02-chat-room`
- Project root: `assignment02-chat-room`

## Tech Stack

- React 18
- Vite 6
- Firebase Authentication
- Firebase Realtime Database
- Firebase Storage
- Firebase Hosting
- GIPHY API
- SCSS / CSS animation

## Main Features

### 1. Entry Page

進入網站會先看到美術館入口頁，而不是直接進聊天室。

使用方式：

1. 打開網站首頁 `/`。
2. 會看到文藝復興畫廊風格的 entry page。
3. 入口頁中央有 `Galleria Chat` intro panel。
4. 背景牆面有多幅抽象模仿名畫的 paintings。
5. 滑鼠 hover 畫作時，畫作會有 tilt / light animation。
6. 使用者可以拖曳畫作，改變畫作在牆上的位置。
7. 點 `Enter Gallery`：
   - 已登入使用者會進入 `/chat`
   - 未登入使用者會進入 `/login`

CSS animation / interaction：

- Entry intro panel 進場動畫。
- Painting hanging / breathing animation。
- Painting hover tilt。
- Painting drag interaction。

### 2. Authentication

支援 Email / Password 與 Google Sign-In。

使用方式：

1. 進入 `/login`。
2. Email 登入：
   - 輸入 email。
   - 輸入 password。
   - 點 `Sign In`。
3. Email 註冊：
   - 輸入 email。
   - 輸入 password。
   - 點 `Sign Up`。
   - 註冊成功後會自動跳到 `/profile`，讓新使用者先設定個人資料。
4. Google 登入：
   - 點 `Continue with Google`。
   - 完成 Google popup 登入。

登入後，Firebase Authentication 會建立使用者 session。第一次登入時，系統會在 Realtime Database 的 `users/{uid}` 建立使用者資料。

### 3. User Profile

每個使用者都有獨立 profile page。

可設定欄位：

- Email
- Display Name
- Phone
- Address
- Profile Picture

使用方式：

1. 登入後點左側導覽列最下方的 user icon。
2. 進入 `/profile`。
3. 修改欄位。
4. 若要更換頭像，點 `Change Picture` 上傳圖片。
5. 點 `Save Profile` 儲存。

Email 修改流程：

- Firebase 要求新 email 先驗證。
- 使用者修改 email 後，系統會寄驗證信到新 email。
- 系統會登出使用者。
- 使用者需要到新信箱點驗證連結。
- 驗證後，用新 email 重新登入。
- 重新登入時，系統會同步 Firebase Auth 的新 email 到 Realtime Database。

Default avatar：

- 若使用者沒有上傳頭像，系統會用 uid / email 產生穩定隨機的抽象畫家 SVG 頭像。
- 這個頭像會出現在 nav profile icon、訊息 avatar、friends list、members list、read receipts 等位置。

### 4. Friends

使用者可以用 email 加好友，好友關係會雙向寫入 Firebase。

使用方式：

1. 點左側導覽列 `Friends` icon。
2. 在 `Add Friend` 輸入對方 email。
3. 點 `Add`。
4. 成功後會出現主題化 gallery dialog，不使用瀏覽器原生 alert。

錯誤處理：

- 找不到使用者：顯示 `No Match` dialog。
- 加自己：顯示 `Already You` dialog。
- 已經是好友：顯示 `Already Friends` dialog。

好友列表功能：

- 顯示好友 avatar、名稱與共同群組數。
- 可點 `Chat` 開啟或建立一對一私訊。
- 可點 `Delete` 移除好友，會先顯示確認 dialog。

### 5. Direct Chat

使用者可以和好友建立一對一聊天室。

使用方式：

1. 到 Friends view。
2. 找到好友。
3. 點 `Chat`。
4. 若已存在私訊聊天室，系統會直接開啟。
5. 若不存在，系統會建立新的 direct chat，並寫入雙方 `user_chats`。

Direct chat 的訊息會即時同步，重新整理後仍會保留。

### 6. Group Chat

使用者可以建立群組聊天室。

使用方式：

1. 到 Chats view。
2. 點 sidebar 上方 `+`。
3. 勾選一位或多位好友。
4. 若選擇多位好友，可輸入 group name。
5. 點 `Create`。

建立後：

- 系統會在 `chats/{chatId}` 建立聊天室 metadata。
- 每位成員會在 `user_chats/{uid}` 看到該聊天室。
- 聊天室會出現在左側 chat list。

### 7. Invite Members

群組聊天室可以邀請更多好友加入。

使用方式：

1. 進入聊天室。
2. 點右上角 settings icon。
3. 展開 `Members`。
4. 點 `+ Add member`。
5. 勾選尚未在聊天室中的好友。
6. 點 `Add`。

加入後，新成員會取得該聊天室的 `user_chats` 入口。

### 8. Chat Settings

每個聊天室都有 settings panel。

功能：

- Rename chat
- Change chat icon
- Members list
- Edit member nickname
- Add member
- Media, Files & Links
- Notification preference
- Leave chat

Rename chat：

1. 打開 settings。
2. 在 `Custom Chat` 輸入新名稱。
3. 點 `Rename`。

Change chat icon：

1. 打開 settings。
2. 點 `Change Icon`。
3. 選擇圖片。
4. 圖片會上傳到 Firebase Storage，並更新聊天室 icon。

Edit member nickname：

1. 打開 settings。
2. 展開 `Members`。
3. 點某位成員旁邊的 `Edit`。
4. 輸入 nickname。
5. 儲存後，該聊天室內會使用 nickname 顯示。

Leave chat：

- 點 `Leave Chat` 會出現 gallery confirm dialog。
- 確認後，使用者會從聊天室 members 與自己的 user_chats 移除。

### 9. Send Text Message

使用方式：

1. 選擇聊天室。
2. 在 composer 輸入文字。
3. 按 Enter 或點 `Send`。

換行方式：

- `Shift + Enter`
- `Ctrl + Enter`
- `Cmd + Enter`

安全性：

- 訊息內容直接作為 React text node 顯示。
- 沒有使用 `dangerouslySetInnerHTML`。
- 因此輸入 `<script>alert("x")</script>` 或 `<h1>Hello</h1>` 會顯示成純文字，不會執行 HTML / JavaScript。

### 10. Send Image

使用方式：

1. 點 composer 左側 paperclip icon。
2. 選擇圖片檔。
3. 圖片檔名會顯示在輸入列。
4. 點 `Send`。
5. 圖片會上傳 Firebase Storage，訊息會儲存 image URL。

圖片訊息功能：

- 可在聊天室中預覽。
- 點圖片可開 fullscreen viewer。
- 自己傳的圖片訊息可以 unsend。
- Media panel 中也會列出圖片。

### 11. GIPHY GIF

此專案整合 GIPHY API。

使用方式：

1. 在 `.env` 設定：

```env
VITE_GIPHY_API_KEY=your_giphy_api_key_here
```

2. 重啟 dev server。
3. 在聊天室 composer 點 `GIF` icon。
4. 搜尋關鍵字，或空白顯示 trending GIFs。
5. 點任一 GIF 即可送出。

GIF 訊息：

- 會顯示 GIF preview。
- 會標示 `GIPHY`。
- 點 GIF 可前往 GIPHY 原始連結。
- Media panel 會把 GIF 一起列入 Media。

### 12. Emoji Picker

使用方式：

1. 在 composer 點 emoji icon。
2. 開啟 emoji picker panel。
3. 點 emoji。
4. emoji 會插入目前游標位置。

特色：

- 不會覆蓋原本輸入內容。
- 插入後游標會移到 emoji 後方。
- 支援常用表情與符號。

### 13. Emoji Reaction

每則訊息都可以加 emoji reaction。

使用方式：

1. 將滑鼠移到訊息。
2. 在訊息 action row 最右側會看到小 emoji icon。
3. hover emoji icon 後，reaction list 會向右展開。
4. 點 `👍 ❤️ 😂 😮 😢 🔥` 任一 reaction。
5. 同一使用者再次點同一 reaction 會取消。
6. 點不同 reaction 會覆蓋自己的舊 reaction。

顯示方式：

- 訊息下方會顯示 reaction summary。
- 每個 emoji 會顯示累計數量。
- 自己已選的 reaction 會有 active 樣式。

### 14. Reply to Message

支援針對特定訊息回覆。

使用方式：

1. hover 訊息。
2. 點 `Reply`。
3. Composer 上方會出現 reply preview。
4. 輸入訊息並送出。
5. 送出的訊息會包含 replied-to box。
6. 點 replied-to box 會 scroll 到原訊息。
7. 原訊息 bubble 會用 gallery spotlight animation 高亮。

### 15. Edit Message

使用者可以編輯自己送出的訊息。

使用方式：

1. hover 自己的訊息。
2. 點 `Edit`。
3. Composer 會進入 editing mode。
4. 修改文字。
5. 按 Enter 或點 `Save`。
6. 訊息會標記 `(edited)`。

限制：

- 只能編輯自己的訊息。
- 編輯時其他訊息會降低透明度，讓目前編輯目標更明確。

### 16. Unsend Message

使用者可以收回自己送出的訊息。

使用方式：

1. hover 自己的訊息。
2. 點 `Unsend`。
3. 系統會顯示 gallery confirm dialog。
4. 點 `Unsend` 後，訊息會從 Firebase 移除。

限制：

- 只能收回自己的訊息。
- 收回後其他使用者也看不到該訊息。

### 17. Pin Message

聊天室可以 pin 重要訊息。

使用方式：

1. hover 訊息。
2. 點 `Pin`。
3. 聊天室上方會出現 pinned message 區塊。
4. 點 pinned message 會跳到原訊息。
5. 原訊息 bubble 會高亮。
6. 已 pin 訊息可點 `Unpin` 取消。

### 18. Search Messages

使用方式：

1. 打開聊天室 settings panel。
2. 在 `Search in conversation...` 輸入關鍵字。
3. 訊息列表會即時篩選。

搜尋範圍：

- 訊息文字。
- Reply preview 文字。
- GIF title。

### 19. Mentions

支援 `@user` 與 `@everyone`。

使用方式：

1. 在 composer 輸入 `@`。
2. 系統會顯示 mention suggestion list。
3. 可選擇聊天室成員或 `@everyone`。
4. 被 mention 的訊息會有特殊背景提示。

通知搭配：

- 若聊天室通知設定為 `Mentions`，只有被 @ 或 @everyone 時才會跳通知。

### 20. Notification Preferences

每個聊天室可以個別設定通知模式。

使用方式：

1. 打開聊天室 settings。
2. 點 notification button。
3. 每點一次會循環：
   - `All`
   - `Mentions`
   - `Muted`

行為：

- `All`: 收到該聊天室所有別人發的新訊息通知。
- `Mentions`: 只有被 @ 或 @everyone 才通知。
- `Muted`: 不通知。

通知條件：

- 必須允許 browser notification permission。
- 自己發的訊息不會通知自己。
- 當頁面正在 focus 時不會跳系統通知。

### 21. Read Receipts

聊天室支援 read receipts。

行為：

- 系統會偵測目前使用者看見的最新訊息。
- 會把 read receipt 寫入 Firebase。
- 其他使用者的已讀 avatar 會顯示在訊息下方。
- 沒有上傳頭像時會顯示抽象畫家 avatar。

### 22. Media, Files & Links

聊天室 settings 中有 `Media, Files & Links`。

使用方式：

1. 打開 settings panel。
2. 點 `Media, Files & Links`。

內容：

- `Media`: 顯示圖片與 GIF 九宮格。
- `Links`: 自動擷取文字訊息中的 `http://` 或 `https://` 連結。
- `Files`: 目前保留空狀態，尚未實作一般檔案傳送。

### 23. Gallery Dialog

所有原本瀏覽器預設 alert / confirm 都已替換成主題化 gallery dialog。

使用場景：

- 新增好友成功。
- 找不到使用者。
- 刪除好友確認。
- 收回訊息確認。
- 離開聊天室確認。
- 圖片上傳錯誤。
- Chat icon 上傳錯誤。
- Email 驗證提示。

這可以避免瀏覽器原生黑色 alert 破壞整體畫廊主題。

## Project Structure

```text
src/
  components/
    AbstractAvatar.jsx      # 預設抽象畫家頭像
    GalleryDialog.jsx       # 主題化 notice / confirm dialog
    GalleryIcons.jsx        # SVG icon set
    ProtectedRoute.jsx      # 登入保護路由
    auth.jsx                # 登入 / 註冊 / Google sign in
  context/
    AuthContext.jsx         # Firebase Auth 狀態與 users/{uid} 同步
  pages/
    Entry.jsx               # 美術館入口頁
    Login.jsx               # 登入頁
    Chat.jsx                # 主要聊天室功能
    Profile.jsx             # 使用者 profile
  styles/
    auth.scss
    chat.scss
    entry.scss
    global.scss
    profile.scss
  utils/
    chatUtils.js
```

## Firebase Data Model

主要資料節點：

```text
users/{uid}
  uid
  email
  displayName
  phone
  address
  photoURL
  pendingEmail
  createdAt
  lastLogin

friends/{uid}/{friendUid}
  true

user_chats/{uid}/{chatId}
  true

chats/{chatId}/metadata
  name
  members
  nicknames
  iconUrl
  isDirect
  createdAt

chats/{chatId}/messages/{messageId}
  senderId
  text
  imageUrl
  gifUrl
  gifPreviewUrl
  gifTitle
  giphyUrl
  mentions
  replyToId
  replyToText
  replyToSender
  reactions
  timestamp
  isEdited
  editedAt

chats/{chatId}/pinnedMessages/{messageId}

chats/{chatId}/readReceipts/{uid}
  messageId
```

Database rules:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

說明：目前所有 Realtime Database read/write 都要求登入。繳交或正式上線前可再依資料節點細分權限。

## Local Setup

### 1. Requirements

- Node.js 18+
- npm
- Firebase project
- GIPHY API key

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

建立 `.env`：

```bash
cp .env.example .env
```

填入：

```env
VITE_GIPHY_API_KEY=your_giphy_api_key_here
```

### 4. Firebase Setup

本專案目前 Firebase config 寫在 [src/config.js](src/config.js)。

需要啟用：

1. Authentication
   - Email / Password
   - Google sign-in
2. Realtime Database
   - rules 至少需允許 authenticated user read/write
3. Storage
   - 需允許 authenticated user 上傳 / 讀取 profile images、chat images、chat icons
4. Hosting
   - Firebase Hosting public folder 對應 `public`

Email 修改注意：

- Firebase Auth 若要求 verify before email update，使用者修改 email 時會收到驗證信。
- 點驗證信後，再用新 email 登入。

### 5. Run Dev Server

```bash
npm run dev
```

預設 Vite dev server：

```text
http://localhost:3000
```

### 6. Build

```bash
npm run build
```

本專案 Vite build output 設定為 `public/`，配合 Firebase Hosting：

```js
build: {
  outDir: 'public',
  emptyOutDir: true
}
```

### 7. Preview Production Build

```bash
npm run preview
```

### 8. Deploy to Firebase Hosting

```bash
npm run deploy
```

`npm run deploy` 會先 build，再執行：

```bash
firebase deploy --only hosting
```

## Scripts

```bash
npm run dev       # Start Vite dev server
npm run build     # Build production files into public/
npm run preview   # Preview production build
npm run test      # Run Vitest
npm run deploy    # Build and deploy Firebase Hosting
```

## Assignment Requirement Checklist

### Basic Requirements

- [x] Membership mechanism: Email sign up / sign in.
- [x] Firebase Authentication integration.
- [x] Firebase authenticated read/write for app data.
- [x] Chatroom core features:
  - [x] Create direct chat.
  - [x] Create group chat.
  - [x] Add / invite members.
  - [x] Send realtime text messages.
  - [x] Load chat history.
  - [x] Display each direct chat as the other user's name and avatar.
- [x] React framework.
- [x] Firebase Hosting deployment.
- [x] Responsive layout.

### Advanced Requirements

- [x] Google Sign-In.
- [x] Browser / Chrome notification.
- [x] CSS animation:
  - [x] Entry intro animation.
  - [x] Painting hanging / breathing animation.
  - [x] Message frame-in animation.
  - [x] Pinned message spotlight animation.
  - [x] Gallery dialog animation.
- [x] Safe rendering for code / HTML-like messages.
- [x] User profile page and profile picture upload.
- [x] Message operations:
  - [x] Edit message.
  - [x] Unsend message.
  - [x] Search messages.
  - [x] Send image.

### Bonus Features

- [x] Friend system.
- [x] Reply specific message.
- [x] Emoji picker.
- [x] Emoji reaction.
- [x] GIPHY GIF search / send.
- [x] Mentions / @everyone.
- [x] Notification preference: All / Mentions / Muted.
- [x] Pinned messages.
- [x] Read receipts.
- [x] Custom chat icon.
- [x] Member nickname.
- [x] Abstract default avatar.
- [x] Theme-consistent gallery dialog.
- [x] Interactive draggable painting entry page.

### Submission Checklist

- [x] Firebase Hosting URL is listed in this README.
- [x] GitHub repository URL is listed in this README.
- [x] `npm run build` succeeds.
- [x] `npm run deploy` is configured for Firebase Hosting.
- [x] `public/` contains the latest production build.
- [x] `AI_reference.pdf` is included.
- [x] Zip package should include source code, `public/`, `static/`, Firebase config files, package files, and README.
- [x] Zip package should exclude `node_modules/`, `.git/`, `.firebase/`, `.env`, local logs, and old zip files.
- [x] MD5 checksum can be generated after creating the zip.

## Manual Test Guide

建議用兩到三個帳號測試。

### Account Flow

1. 註冊新帳號。
2. 確認註冊後進入 profile。
3. 設定 display name。
4. 上傳 profile picture。
5. 登出。
6. 重新登入。

### Friend / Chat Flow

1. A 用 B 的 email 加好友。
2. A 點 B 的 `Chat` 建立私訊。
3. A/B 互傳文字。
4. A 建立群組並加入 B/C。
5. A 在 settings 中邀請新 member。

### Message Flow

1. 傳文字。
2. 傳 `<script>alert("x")</script>`，確認它顯示為文字。
3. 傳圖片。
4. 傳 GIF。
5. Reply 一則訊息。
6. 點 reply box 回到原訊息。
7. Edit 自己的訊息。
8. Unsend 自己的訊息。
9. Pin / Unpin 訊息。
10. 對訊息加 emoji reaction。
11. 搜尋訊息。

### Notification Flow

1. 允許 browser notification。
2. A 開聊天室但切到其他 tab。
3. B 傳訊息給 A。
4. 確認 A 收到 notification。
5. 設定 Muted 後確認不通知。
6. 設定 Mentions 後確認只有 @ 才通知。

### Profile / Email Flow

1. 修改 display name / phone / address。
2. 修改 email。
3. 收到新 email 驗證信。
4. 點驗證連結。
5. 用新 email 登入。
6. 確認資料庫 email 已同步。
