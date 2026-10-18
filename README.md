# Kasama (phone app)

A calm personal assistant and companion on your phone. Talk to Kasama (type or speak), or let out everything on your mind; Claude sorts it into tasks with real dates and ideas, warns you about clashes with work and class, and plans your day around your fixed schedule. It remembers things about you, fixes your day when you miss something, reminds you only as much as you want, and closes each day with a gentle evening check-in.

Kasama lives in a calm place you choose: **Dagat** (by the sea), **Bundok** (the mountains) or **Palayan** (the rice fields). Its logo is two stones side by side: the big one is Kasama, the small one is you.

**Stack:** React Native · Expo SDK 57 · Expo Router (tabs) · TypeScript · expo-notifications (local) · expo-speech-recognition · react-native-svg · AsyncStorage · Supabase Edge Function → Claude API

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
   │  ├─ _layout.tsx           fonts, splash, first-open Welcome, reminders, opens tapped notifications
   │  ├─ welcome.tsx           first open: your name and your place
   │  └─ (tabs)/
   │     ├─ _layout.tsx        floating bottom bar; the middle button talks to Kasama
   │     ├─ index.tsx          Home: morning path, afternoon "next", night check-in
   │     ├─ things.tsx         Things: To do + Ideas
   │     ├─ kasama.tsx         Kasama: talk or let it all out (sorted, with Undo)
   │     ├─ journey.tsx        Journey: your week, moods, patterns, cleanup
   │     └─ you.tsx            You: place, name, how Kasama talks, reminders, schedule
   ├─ components/              Logo, Scene (sea/mountains/rice fields), CheckIn, TaskRow, TodoList, IdeaList, ui
   └─ lib/
      ├─ types.ts              Task, Settings, Mood, DumpResult, DayPlan
      ├─ storage.ts            save/load on the phone + your default schedule
      ├─ notifications.ts      reminders (loaded safely, so Expo Go can't crash)
      ├─ voice.ts              speech to text for the mic (installed app only)
      ├─ alarm.ts              opens the Clock app for alarms (Android)
      ├─ actions.ts            add / done / drop / apply plan (always re-schedules reminders)
      ├─ api.ts, mock.ts       calls the Edge Function, or simple on-phone rules in demo mode
      ├─ theme.ts              the three places, fonts, night colors
      ├─ time.ts, useData.ts
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
   - Optional: `DAILY_LIMIT` (Claude calls per phone per day, default `60`) and `GLOBAL_DAILY_LIMIT` (all phones together, default `1000`)
5. **Daily limits** (so nobody can drain your Claude credit, even if they pull the secret out of the APK):
   - **Authentication → Sign In / Providers → Anonymous Sign-Ins → on.** Each phone signs in once, with no email or password.
   - **SQL Editor** → paste all of `supabase/migrations/20261018000000_usage_quota.sql` → **Run**.
   - Recommended: **Authentication → Attack Protection → CAPTCHA**, if strangers start creating many sign-ins.
6. Copy the function URL. It looks like `https://YOUR-PROJECT.supabase.co/functions/v1/assistant`.

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
EXPO_PUBLIC_SUPABASE_ANON_KEY=Project Settings → API → anon / publishable key
```

### 5. Run it on your phone (testing)

```bash
npx expo start
```

A QR code appears in the terminal. Your phone and laptop must be on the **same Wi-Fi**.

- **Android:** open Expo Go → **Scan QR code**.
- **iPhone:** open the Camera app → scan → tap the Expo Go link.

On first open, the Welcome asks your name and your place. Then:

1. **Middle button → type** "submit java activity on saturday 5pm, pay meralco before the 20th, buy rice" → send. Kasama sorts it into tasks (tap **Undo** if it got something wrong).
2. **Home → Plan my day.** Each planned block will notify you when it starts.
3. **You → Send a test notification**, and lock your phone.

When you save a file in VS Code, the app reloads on your phone instantly. After adding or removing screens, restart with `npx expo start --clear`.

> **Expo Go limits:** the **mic** (speech to text), **reminders** and the **Clock alarm** need the installed app (step 6). In Expo Go they quietly fall back instead of crashing: the mic opens your keyboard, and reminders are skipped.
>
> If the QR code won't connect (office or school Wi-Fi often blocks it), run `npx expo start --tunnel`, or type the `exp://…` address into Expo Go → **Enter URL manually**.

### 6. Install it for real (no Expo Go needed)

**Android, free.** Builds an `.apk` you install directly:

```bash
npx eas-cli@latest login            # your expo.dev account
npx eas-cli@latest init             # once: links this project to your account
npm run build:apk                   # builds in the cloud, about 10–30 min
```

**Before the first build:** the cloud build does not see your `.env` file, because it's git-ignored. Add the same three values on expo.dev → your project → **Environment variables** → environment **preview** (visibility "Plain text"): `EXPO_PUBLIC_ASSISTANT_URL`, `EXPO_PUBLIC_APP_SECRET` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Without them, the installed app can't reach Claude.

When the build finishes, open the link it prints on your phone → download the APK → install it. Android will ask you to allow installing from your browser.

**iPhone.** Apple only lets you install your own apps with a paid Apple Developer account ($99/year), through TestFlight: `npx eas-cli@latest build -p ios` then `npx eas-cli@latest submit -p ios`. Until then, keep using Expo Go. Reminders still work there while Kasama is installed in Expo Go.

---

## Daily use

The bottom bar: **Home · Things · (Kasama) · Journey · You**.

- **Home changes with your day.** Morning: today's path, never more than 3 things. Afternoon: the one thing that's **next**. Night (30 minutes before your check-in time): Home **becomes the evening check-in**: Done, Tomorrow or Let go for what's left, and how you feel.
- **Something comes up? Tap the middle button.** In the installed app it's already listening; just talk. Or type. Questions get answers ("Pagod ako, what can I skip today?"); messy lists get sorted into tasks and ideas ("java sat, meralco before 20th, call mama"). Every change shows **Undo**.
- **Alarms:** "Set an alarm for 5am" opens your Clock app with it filled in (Android). Kasama may offer once when you mention something early; it never sets one you didn't say yes to.
- **Things:** **To do** (grouped Today, This week, Later, Whenever; tap a pebble when done) and **Ideas** (old ones come back now and then for one small step).
- **Journey:** a note from Kasama about your week, your mood dots from the check-ins, patterns ("you get the most done in the morning"), and things that waited two weeks ("Still want these?").
- **You:** your place, your name, how Kasama talks to you (encouragement, listening or advice, faith), how often it reminds you (Quiet, Calm, Everything), your fixed schedule, and what Kasama knows about you.
- **Repeating tasks:** say "every month" or "every Saturday", or pick it when adding. Tick it off and the next one appears.
- **Missed a planned task?** Home shows "One thing slipped by". Tap **Fix my day** or **Move to tomorrow**.
- Tick tasks as done. Their reminders are cancelled automatically.

## Good to know

- Your tasks live **only on your phone**. Uninstalling the app deletes them. Syncing to Supabase is the first practice project below.
- Talking to Kasama and Plan my day need internet (and Claude credit). Without a backend the app runs in **demo mode** with simple on-phone rules. Reminders, ticking tasks and the mic don't need internet.
- The morning notification lists your top 3 tasks as of the last time you opened the app. Open it once in the evening to keep the next morning's list fresh.
- **Android:** if reminders come late, set Battery → Kasama → **Unrestricted**, and allow "Alarms & reminders" if your phone asks.

## Practice ideas (also great for your portfolio)

1. **Supabase sync:** save tasks to Supabase so they're backed up and visible on your laptop. Reuse the JobPilot patterns.
2. **Date picker** for deadlines (`@react-native-community/datetimepicker`).
3. **Snooze 15 min** button on notifications (notification categories/actions in expo-notifications).
4. **Home screen shortcut or widget** that opens Kasama already listening.
5. **Gentle motion:** rocking boats, drifting clouds, a breathing logo (React Native Reanimated).
6. **Link with JobPilot:** when a job scores 80+, add "Apply to …" as a task.

## Troubleshooting

| Problem | Fix |
|---|---|
| `EXPO_PUBLIC_ASSISTANT_URL is missing` | `.env` is missing or misnamed. Stop the server and run `npx expo start --clear`. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY is missing` | Add the anon key to `.env` (step 4), then `npx expo start --clear`. |
| `Anonymous sign-ins are disabled` | Turn on Anonymous Sign-Ins in Supabase (step 3.5). |
| `Something went wrong on my side` right after updating | Run the usage SQL (step 3.5) and redeploy the function. The Supabase logs show the exact error. |
| `We've talked a lot today` | The daily limit was reached. It resets at midnight UTC (8 AM Manila). Raise `DAILY_LIMIT` if you need more. |
| `Wrong app secret` | `EXPO_PUBLIC_APP_SECRET` in `.env` must equal `APP_SECRET` in Supabase. |
| `401 Missing authorization header` | "Verify JWT" is still on for the function. Turn it off (step 3). |
| `Claude error 404` / model error | Update the `CLAUDE_MODEL` secret to a current model name, e.g. `claude-sonnet-5-5`. |
| `Claude error 400` after updating | Redeploy the latest `supabase/functions/assistant/index.ts`. Older versions used a request style current models reject. |
| `Unknown action` in chat | The Edge Function is the old version. Redeploy it (step 3). |
| No notifications | Allow notifications for Expo Go/Kasama in phone settings, then use the test button. |
| Times are off | The app sends your phone's time zone to Claude. Check that your phone is set to Manila time automatically. |
