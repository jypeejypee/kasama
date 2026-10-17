# Kasama (phone app)

Your personal assistant and companion on your phone. Chat with Kasama like a person, or brain-dump whatever is on your mind; Claude summarizes it, pulls out tasks with real dates, warns you about clashes with work and class, and plans the rest of your day around your fixed schedule. It collects your ideas, remembers things about you, and fixes your day when you miss something. The phone then reminds you: when each task starts, an hour before deadlines, a morning focus and an evening check-in.

**Stack:** React Native · Expo SDK 57 · Expo Router (tabs) · TypeScript · expo-notifications (local) · AsyncStorage · Supabase Edge Function → Claude API

If you know React, you already know most of this. Instead of `<div>` and `<p>` you use `<View>` and `<Text>`, and styles are JavaScript objects.

---

## How it works

```
┌──────────── Your phone (Kasama app) ────────────┐
│ Brain dump ─┐                                   │
│ Plan my day ┼──► fetch() ─────────────┐         │
│             │                         ▼         │        ┌── Supabase Edge Function ──┐
│             │                (internet needed)  │ ─────► │ adds your secret Claude key │ ──► Claude API
│             │                         ▲         │ ◄───── │ returns tasks / day plan    │
│ Tasks saved on the phone (AsyncStorage)          │        └─────────────────────────────┘
│ Reminders scheduled on the phone (local notifications)
│   → fire even offline and with the app closed   │
└─────────────────────────────────────────────────┘
```

- **Why a server function at all?** An API key inside an app can be pulled out of the APK by anyone. The Edge Function keeps the key on Supabase.
- **Why local notifications?** The phone itself fires them at the right time. You don't need a server running every minute, and they still work without signal.

## Folder structure

```
kasama/
├─ app.json                    app name, icons, Android package, notification plugin
├─ eas.json                    build profiles (preview = installable Android APK)
├─ .env.example                assistant URL + app secret (copy to .env)
├─ assets/                     app icons
├─ supabase/functions/assistant/index.ts   the Claude backend (Deno)
└─ src/
   ├─ app/                     screens (Expo Router: every file is a screen)
   │  ├─ _layout.tsx           asks for notification permission, refreshes reminders, opens tapped notifications
   │  ├─ check-in.tsx          Evening check-in: done / tomorrow / drop
   │  ├─ settings.tsx          About me, reminder times, fixed schedule, test notification (gear icon)
   │  └─ (tabs)/
   │     ├─ _layout.tsx        bottom tabs
   │     ├─ index.tsx          Today + "Plan the rest of my day" + missed tasks
   │     ├─ chat.tsx           Chat with Kasama (it changes your tasks for you)
   │     ├─ dump.tsx           Brain dump → review → save tasks
   │     ├─ tasks.tsx          All tasks + quick add (with repeat)
   │     └─ ideas.tsx          All your ideas in one place
   ├─ components/              TaskRow, Card, Button, Chip
   └─ lib/
      ├─ types.ts              Task, Settings, DumpResult, DayPlan
      ├─ storage.ts            save/load on the phone + your default schedule
      ├─ notifications.ts      setupNotifications(), rescheduleAll(), test
      ├─ actions.ts            add / done / drop / apply plan (always re-schedules reminders)
      ├─ api.ts                calls the Edge Function
      ├─ time.ts, theme.ts, useData.ts
```

---

## Setup

### 1. Tools (once)

- **Node.js 20+**, **VS Code**, **Git**
- On your phone: install **Expo Go** from the Play Store or App Store (for testing).
- Free accounts: **Supabase** (you have one from JobPilot) and **expo.dev** (for building the installable app).

### 2. Open the project

Unzip, then in VS Code: **File → Open Folder → kasama**. Open the terminal (<kbd>Ctrl</kbd>+<kbd>`</kbd>) and run:

```bash
npm install --legacy-peer-deps
```

### 3. Create the Claude backend (Supabase Edge Function)

The easiest way is from the Supabase website:

1. Supabase → your project → **Edge Functions → Deploy a new function → Via Editor**.
2. Name it `assistant`. Delete the sample code and paste all of `supabase/functions/assistant/index.ts` → **Deploy**.
3. Open the function's **Details/Settings** and turn **off** "Verify JWT" (Enforce JWT verification). The app uses its own secret instead.
4. **Edge Functions → Secrets** (or Project Settings → Edge Functions) → add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com (set a monthly spend limit there)
   - `APP_SECRET` = any long random text
   - `CLAUDE_MODEL` = `claude-sonnet-5-5` (or leave it out, that is the default)
5. Copy the function URL. It looks like `https://YOUR-PROJECT.supabase.co/functions/v1/assistant`.

<details><summary>Prefer the command line?</summary>

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... APP_SECRET=... CLAUDE_MODEL=...
npx supabase functions deploy assistant --no-verify-jwt
```
If the CLI asks for a `config.toml`, run `npx supabase init` first and answer "no" to the extra options.
</details>

### 4. Connect the app to it

**No backend yet?** Skip steps 3 and 4. Without `.env` the app runs in **demo mode**: Brain dump, Plan my day and Chat answer with simple rules on the phone (you will see a "Demo mode" label). Everything else works normally. Add `.env` later and restart with `npx expo start --clear` to switch to Claude.

Copy `.env.example` to `.env` and fill in:

```
EXPO_PUBLIC_ASSISTANT_URL=https://YOUR-PROJECT.supabase.co/functions/v1/assistant
EXPO_PUBLIC_APP_SECRET=the same APP_SECRET as step 3
```

### 5. Run it on your phone (testing)

```bash
npx expo start
```

A QR code appears in the terminal. Your phone and laptop must be on the **same Wi-Fi**.

- **Android:** open Expo Go → **Scan QR code**.
- **iPhone:** open the Camera app → scan → tap the Expo Go link.

Allow notifications when asked, then:

1. **Settings (gear icon, top right) → Send a test notification**, and lock your phone. It should appear in about 5 seconds.
2. **Brain dump:** "submit java activity on saturday 5pm, apply to seansoft and stay finance this week, pay meralco before the 20th, buy rice" → **Sort my thoughts** → **Save tasks**.
3. **Today → Plan the rest of my day.** Each planned block will notify you when it starts.

When you save a file in VS Code, the app reloads on your phone instantly.

> If the QR code won't connect (office or school Wi-Fi often blocks it), run `npx expo start --tunnel`.

### 6. Install it for real (no Expo Go needed)

**Android, free.** Builds an `.apk` you install directly:

```bash
npx eas-cli@latest login            # your expo.dev account
npx eas-cli@latest build:configure  # once; accept the defaults
npm run build:apk                   # builds in the cloud, about 10–20 min
```

**Before the first build:** the cloud build does not see your `.env` file, because it's git-ignored. Add the same two values on expo.dev → your project → **Environment variables** → environment **preview** (visibility "Plain text"): `EXPO_PUBLIC_ASSISTANT_URL` and `EXPO_PUBLIC_APP_SECRET`. Without them, the installed app can't reach Claude.

When the build finishes, open the link it prints on your phone → download the APK → install it. Android will ask you to allow installing from your browser.

**iPhone.** Apple only lets you install your own apps with a paid Apple Developer account ($99/year), through TestFlight: `npx eas-cli@latest build -p ios` then `npx eas-cli@latest submit -p ios`. Until then, keep using Expo Go. Reminders still work there while Kasama is installed in Expo Go.

---

## Daily use

- **Talk to Kasama:** the **Kasama** tab. "Pagod ako, what can I skip today?", "Remind me to call Mama tomorrow 7pm", "Move the Java activity to Sunday". It answers and changes your tasks. Under its reply you see exactly what it did.
- **Ideas:** say "Idea: …" in chat, write it in the **Ideas** tab, or just brain-dump. Every idea is collected in the Ideas tab, where you can search it or turn it into a task.
- **Kasama remembers you:** tell it in chat ("I don't like tasks after 10pm"), or write in **Settings (gear icon) → About me**. It uses this every time it plans or answers.
- **Repeating tasks:** bills and weekly things. Say "every month" or "every Saturday" in chat or brain dump, or pick daily/weekly/monthly in quick add. Tick it off and the next one appears. Dropping it stops the repeat.
- **Nudges:** if a deadline is coming and the task isn't planned, Kasama nudges you early enough to still do it (only between 7am and 10pm).
- **Anything comes up:** Brain dump. Tap the microphone on your keyboard to talk instead of typing.
- **Morning (7:00):** notification with your top 3 tasks.
- **After work:** Today → **Plan the rest of my day**.
- **Missed a planned task?** 15 minutes after its slot ends, Kasama asks "Did you finish…?" Today shows it under **You missed…**. Tap **Fix my day** and Kasama re-plans the rest of today and tells you what it moved, or tap **Move to tomorrow**.
- **Night (9:30):** evening check-in. Tap the notification, or **Today → Evening check-in**. For each task left today, choose **Done**, **Tomorrow** or **Drop**. Moving a task to tomorrow also moves today's (or an overdue) deadline to tomorrow at the same time.
- Tick tasks as done. Their reminders are cancelled automatically.
- Change work, class or sleep times in **Settings**, then **Save**.

## Good to know

- Your tasks live **only on your phone**. Uninstalling the app deletes them. Syncing to Supabase is the first practice project below.
- Brain dump and Plan my day need internet. Reminders and ticking tasks don't.
- The morning notification lists your top 3 tasks as of the last time you opened the app. Open it once in the evening to keep the next morning's list fresh.
- **Android:** if reminders come late, set Battery → Kasama → **Unrestricted**, and allow "Alarms & reminders" if your phone asks.

## Practice ideas (also great for your portfolio)

1. **Supabase sync:** save tasks to Supabase so they're backed up and visible on your laptop. Reuse the JobPilot patterns.
2. **Date picker** for deadlines (`@react-native-community/datetimepicker`).
3. **Snooze 15 min** button on notifications (notification categories/actions in expo-notifications).
4. **Recurring tasks** ("every Saturday: review Java notes").
5. **Weekly review** screen: a summary of your notes and finished tasks.
6. **Link with JobPilot:** when a job scores 80+, add "Apply to …" as a task.

## Troubleshooting

| Problem | Fix |
|---|---|
| `EXPO_PUBLIC_ASSISTANT_URL is missing` | `.env` is missing or misnamed. Stop the server and run `npx expo start --clear`. |
| `Wrong app secret` | `EXPO_PUBLIC_APP_SECRET` in `.env` must equal `APP_SECRET` in Supabase. |
| `401 Missing authorization header` | "Verify JWT" is still on for the function. Turn it off (step 3). |
| `Claude error 404` / model error | Update the `CLAUDE_MODEL` secret to a current model name, e.g. `claude-sonnet-5-5`. |
| `Claude error 400` after updating | Redeploy the latest `supabase/functions/assistant/index.ts`. Older versions used a request style current models reject. |
| `Unknown action` in chat | The Edge Function is the old version. Redeploy it (step 3). |
| No notifications | Allow notifications for Expo Go/Kasama in phone settings, then use the test button. |
| Times are off | The app sends your phone's time zone to Claude. Check that your phone is set to Manila time automatically. |
