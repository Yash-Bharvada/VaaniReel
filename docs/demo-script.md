# VaaniReel 90-Second Demo Video Script

> **Video Title**: VaaniReel: Voice-First AI Marketing for Chennai's Local Retailers  
> **Duration**: Exactly 90 Seconds  
> **Target Audience**: Hackathon Judges, Retail Shopkeepers, Community Developers

---

## 3-Line Submission Blurb

> VaaniReel empowers neighborhood retail shopkeepers in Chennai to transform simple counter photos and native-language voice notes into high-converting Instagram marketing posts without keyboards, complex dashboards, or studio photography fees.  
> Powered by an autonomous 31-node n8n workflow, Google Gemini 2.5 Flash extracts grounded product facts and writes localized Tamil/Tanglish/Hindi copy, while Wiro AI (ByteDance Seedream 5.5 Advanced) restages the item in warm festive lighting for just $0.0280.  
> Featuring native Gemini visual QA, mandatory Telegram human-in-the-loop approval, and automatic Google Sheets cost accounting, VaaniReel delivers an enterprise marketing team into a merchant's pocket for under ₹4 per post.

---

## Timed Video Script (00:00 - 01:30)

| Timestamp | Visual / Screen On Display | Voiceover Audio (Spoken Track) | Production Notes |
| :--- | :--- | :--- | :--- |
| **00:00 – 00:12** *(12s)* | Quick montage of bustling retail streets in T. Nagar & Sowcarpet, Chennai. Close-up of a shopkeeper standing behind a glass counter holding a phone. | *"Meet small shopkeepers in Chennai. They have incredible products, but competing with online giants on Instagram requires studio photos, English copywriting, and time they don't have behind a busy retail counter."* | Warm, empathetic tone. Show text overlay: *"The Problem: High Studio Costs & Language Barrier"*. |
| **00:12 – 00:25** *(13s)* | Screen recording of Telegram on mobile. The shopkeeper takes a photo of a black saree on the counter, sends it to the VaaniReel bot, and presses the mic button to record a 10s voice note. | *"With VaaniReel, Telegram is their entire interface. The shopkeeper snaps a photo of a silk saree and speaks a quick voice note in Tamil: 'Vanakkam, idhu namma pudhu Deepavali black sequin saree collection, 20% discount irukku!' No typing required."* | Zoom in on Telegram message bubbles. Show photo upload and `.oga` voice note waveform. |
| **00:25 – 00:42** *(17s)* | Split screen: n8n workflow canvas animating in real-time, zooming into the Gemini audio and vision analysis nodes. | *"Behind the scenes, our 31-node n8n workflow triggers instantly. Gemini 2.5 Flash transcribes the Tamil audio, extracts verified facts, and analyzes the saree's texture. Our Creative Director prompt crafts a punchy Tanglish caption, 7 local hashtags, and an exact Wiro restaging prompt—strictly forbidding invented claims."* | Highlight the n8n data flowing through Gemini nodes to Wiro. Show the structured JSON payload. |
| **00:42 – 00:54** *(12s)* | Wiro HTTP request finishes. Back in Telegram, a stunning restaged visual arrives with brass diyas and warm lighting, accompanied by an ElevenLabs voiceover audio clip. | *"Next, Wiro AI's Seedream 5.5 Advanced model restages the saree on a festive marble surface in just 21 seconds for only $0.0280, while ElevenLabs synthesizes an energetic multilingual voiceover."* | Play 2 seconds of the generated audio: *"Vanakkam! Check out our new Deepavali saree collection..."* |
| **00:54 – 01:05** *(11s)* | Telegram message shows Gemini QA Score: `8/10 (Passed: true)`. An inline interactive button pops up: `[✅ Approve] [❌ Disapprove]`. The shopkeeper taps `Approve`. | *"Before anything is posted, Gemini QA inspects the visual for fidelity. The owner receives the full draft in Telegram and has total human-in-the-loop control. One tap on 'Approve' authorizes publishing."* | Point cursor / finger firmly on the green `Approve` button. |
| **01:05 – 01:15** *(10s)* | Cut to Instagram app. The new post appears seamlessly in the feed with the restaged image, bilingual caption, hashtags, and Meta's official 'AI info' label. | *"Instantly, n8n calls the Instagram Graph API. The photo is live on their business profile—complete with Meta's official AI transparency tag and local hashtags like #ChennaiShopping."* | Scroll down the Instagram post showing the caption and image. |
| **01:15 – 01:22** *(7s)* | Cut to Google Sheets tab `vaanireel_posts_log`. A new row highlights with timestamp, caption, permalink, and total cost: `$0.0280`. | *"Every post, QA score, and billed cent is automatically logged into the shop's Google Sheet for complete financial tracking. Total cost: under ₹4."* | Highlight the `$0.0280` cell in Google Sheets. |
| **01:22 – 01:30** *(8s)* | Quick screen view of `samples/bakeoff/image/index.html` showing the 3 model cards, then final slide with GitHub link and hackathon logo. | *"We chose Seedream 5.5 Advanced using our empirical Wiro picker CLI after comparing quality and costs across live models. VaaniReel: Local commerce empowered by Gemini, n8n, and Wiro AI."* | Show bakeoff comparison page, fade into VaaniReel logo and team credits. |

---

## 📋 Recording Checklist

Ensure you have prepared the following items before hitting record:

- [ ] **Mobile Device / Screencast**: Clean Telegram interface with bot conversation open.
- [ ] **Sample Photo**: [`samples/saree.jpg`](file:///D:/VanniReel/VaaniReel/samples/saree.jpg) ready in camera roll or desktop emulator.
- [ ] **Voice Note Audio**: Clear microphone for recording the Tamil voice prompt (*"வணக்கம்! இது நம்ம புதிய தீபாவளி பட்டுப் புடவை கலெக்ஷன்..."*).
- [ ] **n8n Canvas Tab**: n8n instance with [`workflows/vaanireel-full.json`](file:///D:/VanniReel/VaaniReel/workflows/vaanireel-full.json) imported and zoomed to show node executions.
- [ ] **Generated Assets**: [`samples/bakeoff/image/bytedance-seedream-5.5-advanced-1.jpg`](file:///D:/VanniReel/VaaniReel/samples/bakeoff/image/bytedance-seedream-5.5-advanced-1.jpg) ready for Telegram delivery.
- [ ] **Instagram Feed Tab**: Instagram test business profile ready to display the newly published post.
- [ ] **Google Sheets Tab**: Spreadsheet with [`samples/sheet-template.csv`](file:///D:/VanniReel/VaaniReel/samples/sheet-template.csv) headers.
- [ ] **Bakeoff Report Tab**: Open browser to [`samples/bakeoff/image/index.html`](file:///D:/VanniReel/VaaniReel/samples/bakeoff/image/index.html) to demonstrate empirical model selection.
