# Kasama on Google Play: checklist and form answers

Everything Google asks for, in order, with answers you can copy. Google changes its forms often: if a question below looks different in Play Console, answer what it asks, using the facts here.

## 0. Before anything (one time)

- [ ] Replace `YOUR-EMAIL-HERE` in `docs/privacy.html` and `docs/delete-data.html` with the email you want public (two places in each file).
- [ ] Commit and push, then turn on GitHub Pages: GitHub → **kasama** repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch **main**, folder **/docs** → Save.
- [ ] After a minute, check these open:
  - https://jypeejypee.github.io/kasama/privacy.html
  - https://jypeejypee.github.io/kasama/delete-data.html
- [ ] Supabase → SQL Editor: run `supabase/migrations/20261019000000_careful_limit.sql`, then `supabase/migrations/20261020000000_reports.sql`.
- [ ] Supabase → Edge Functions → assistant: paste the newest `supabase/functions/assistant/index.ts` → Deploy.
- [ ] expo.dev → kasama → Environment variables: copy the 3 `EXPO_PUBLIC_...` values to the **production** environment too (not only preview).

## 1. Developer account

- play.google.com/console → **Personal** account → pay $25 → verify your ID, phone and email.

## 2. Create the app

- App name: **Kasama** · Default language: English · App · Free.

## 3. App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | `https://jypeejypee.github.io/kasama/privacy.html` |
| Ads | **No**, the app has no ads |
| App access | All features work without special access (no login) |
| Content rating | Fill in the questionnaire honestly. Category: Utility / Productivity. No violence, no sexual content, no gambling. Users can interact with an AI chat: **yes** |
| Target audience | **18 and over** |
| News app | No |
| Government app | No |
| Financial features | None |
| Health | If asked: not a medical device; offers wellbeing check-ins and crisis hotline info; no health data leaves the phone (moods stay on device) |
| Generative AI | Yes. Users can report a reply in the app (the "Report" link under every Kasama reply) |

### Data safety

General questions:

- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (everything goes over HTTPS)
- Do you provide a way for users to request that their data be deleted? **Yes** (in the app: You → Your data → Delete my data, and the web page `https://jypeejypee.github.io/kasama/delete-data.html`)

Data types. For each: **Collected: yes. Shared: no** (Supabase and Anthropic process it for you as service providers, which Google doesn't count as sharing).

| Data type | Why | Required? | Notes |
|---|---|---|---|
| Personal info → **Name** | App functionality, Personalization | Optional | The nickname they enter |
| Messages → **Other in-app messages** | App functionality | Required for chat | Messages to Kasama, sent to the AI to get a reply |
| App activity → **Other user-generated content** | App functionality, Personalization | Optional | Tasks, schedule, "What I know about you", first names of their people |
| Calendar → **Calendar events** | App functionality | Optional | Only busy times, processed to plan the day. Mark **processed ephemerally** |
| Device or other IDs | App functionality, Fraud prevention / security | Required | The anonymous account ID used for daily limits |
| Personal info → **Religious or political beliefs** | Personalization | Optional | Only if they pick a faith in You (Christian, Spiritual or their own words). Sent with messages so Kasama can talk to them that way. Mark **processed ephemerally** |

**Not collected:** location, contacts list, photos, audio (speech becomes text on the phone), health data (moods stay on the phone), financial info, web history.

## 4. Sensitive permissions (if Google asks)

- **Exact alarms (`SCHEDULE_EXACT_ALARM`):** "Kasama sets alarms and time-based reminders the user asks for ('wake me at 5', 'remind me before my deadline'). They must fire at the exact time to be useful."
- **Microphone (`RECORD_AUDIO`):** "Voice input: the user taps the mic to speak instead of typing. Only active while they use it."
- **Calendar (`READ_CALENDAR`, `WRITE_CALENDAR`):** "Optional. Reads busy times so the day's plan never overlaps meetings. Event details stay on the device."

## 5. Store listing

**Short description** (max 80 characters):
> A calm friend that sorts your messy thoughts into a gentle plan.

**Full description:**
> Para sa mga taong maraming iniisip.
>
> Kasama is a calm personal assistant that feels like a friend, not a boss. Tell it everything on your mind, even if it's messy or in Taglish, and it sorts it into tasks, ideas and a short plan for today.
>
> • Brain dump: type or speak. Kasama pulls out tasks, dates and ideas.
> • A short path each morning, and a gentle check-in at night.
> • Your calendar and to-dos together. Plan my day never books over a meeting.
> • A gentle heads-up the night before: what's coming tomorrow.
> • Reminders that don't pressure you. Miss something? It helps fix the rest of your day.
> • A little buddy on your Home: Kape or Puto, with a kind word every day.
> • Honest, but kind: it notices when you keep moving the same task.
> • Make it yours: listen or advise, how much cheering, even faith.
> • Your lists stay on your phone. No ads.
>
> Kasama is not a therapist or an emergency service. If you are in danger, contact the NCMH Crisis Hotline (1553) or 911.

**Graphics:** ready in the `store/` folder: `icon-512.png`, `feature-graphic.png`, and `screenshot-1` to `screenshot-6` (upload in that order).

Words to avoid in the listing: therapy, treatment, cure, diagnose, mental health app.

## 6. Build and closed testing

```
npm run build:play
```
This builds an **AAB** for Play (the version number goes up by itself). Upload it to **Testing → Closed testing**, add 15+ testers by email, and share the opt-in link. Keep at least 12 opted in for **14 days in a row**. Write down their feedback and what you changed; Google asks about it.

Updates for Play Store installs use their own channel:
```
npm run update:play "What changed"
```
(`npm run update:phone` still updates the APK your friends installed directly.)

## 7. Production

Play Console → **Apply for production** → answer the questions about testing → wait for review (usually a few days).
