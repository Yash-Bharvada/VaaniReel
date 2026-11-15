# VaaniReel 🎙️✨

> **Voice-first AI social marketing for Chennai's local shopkeepers.**  
> Turn a casual voice note and counter photo into an Instagram-ready marketing visual and localized post in seconds.

[![Built with Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Orchestrated with n8n](https://img.shields.io/badge/Workflow-n8n-EA4B71?logo=n8n&logoColor=white)](https://n8n.io/)
[![Powered by Wiro AI](https://img.shields.io/badge/Compute-Wiro%20AI-00C7B7)](https://wiro.ai/)
[![Interface-Telegram](https://img.shields.io/badge/Interface-Telegram%20Bot-24A1DE?logo=telegram&logoColor=white)](https://telegram.org/)

---

## 📌 The Problem

Small retail businesses in Chennai—silk saree stores in T. Nagar, brassware artisans, spice and jewelry shops in Sowcarpet, and neighborhood boutiques—want to reach new customers on Instagram to compete with large e-commerce platforms. However, they face significant hurdles:

1. **Language & Copywriting Friction**: Writing engaging social media copy in conversational Tamil, Tanglish, or Hindi requires time and digital marketing expertise.
2. **High Photography Costs**: Staging professional catalog shoots with festival props and studio lighting is prohibitively expensive for single garments or daily stock.
3. **Complex Desktop Interfaces**: Existing generative AI software requires typing intricate English prompts into browser dashboards—an interface unfamiliar to busy shop owners working behind retail counters.
4. **Hallucination & Misrepresentation Risk**: Off-the-shelf generative AI often invents fake discounts, alters product colors, or adds distorted logos that mislead buyers.

---

## 💡 The Solution

**VaaniReel eliminates apps, dashboards, and keyboards entirely.**

Telegram serves as the complete interface. A shopkeeper simply:
1. Takes a photo of an item on their counter and sends it to the Telegram bot.
2. Sends a 15-second voice note in **Tamil**, **Tanglish**, **Hindi**, or **English** describing the item and any offer.

Behind the scenes:
- **Gemini 2.5 Flash** listens to the audio, understands the image, extracts verified facts, and crafts culturally resonant copy matching the shopkeeper's dialect.
- **Wiro AI (ByteDance Seedream 5.5 Advanced)** restages the product in an authentic festive setting while keeping the item 100% identical.
- **Wiro AI (ElevenLabs V4 Turbo)** generates a punchy multilingual voiceover.
- **Gemini QA** inspects the visual for fidelity and cleanliness.
- **Human-in-the-Loop Approval**: The shopkeeper previews the photo, audio, and copy directly in Telegram and taps **Approve** to publish automatically to Instagram and log costs to Google Sheets.

---

## ⚙️ How We Use Gemini, n8n, and Wiro AI

| Technology | Specific Features Used | Role in VaaniReel |
| :--- | :--- | :--- |
| **Google Gemini** | • Multimodal Audio Understanding (`models/gemini-2.5-flash`)<br>• Visual Image Inspection<br>• Constrained Structured JSON Output<br>• Automated Quality Assurance (QA) Loop | • Transcribes Tamil, Tanglish, Hindi, and English voice notes verbatim and translates to English.<br>• Extracts grounded visual details (fabric, texture, craftsmanship).<br>• Acts as Creative Director writing captions, hashtags, and Wiro image prompts.<br>• Compares generated output against original product to prevent hallucinations. |
| **n8n Workflow Engine** | • Telegram Trigger & Actions<br>• Switch Router Node<br>• Native Data Tables (`vaanireel_sessions`)<br>• HTTP Request with Header Authentication<br>• Human-in-the-Loop Send-and-Wait Approval<br>• Google Sheets Integration Node | • Orchestrates the entire 31-node pipeline without dedicated custom servers.<br>• Preserves session state between separate photo and voice messages.<br>• Enforces strict budget controls (retries disabled, timeout limits).<br>• Suspends workflow safely until shopkeeper taps "Approve" in Telegram.<br>• Logs timestamps, URLs, QA scores, and total generation costs into Google Sheets. |
| **Wiro AI** | • Seedream 5.5 Advanced (`bytedance/seedream-5-5-advanced`)<br>• ElevenLabs V4 Turbo (`elevenlabs/eleven-v4-turbo`)<br>• Synchronous Execution Endpoint (`/v1/Run/.../sync`)<br>• Catalog Picker CLI (`scripts/wiro-picker.mjs`) | • Restages products into studio/festive lighting for ~$0.0280 per image.<br>• Generates expressive multilingual audio voiceover.<br>• Delivers synchronous response with exit status (`pexit`), download URL, and actual cost.<br>• Empirical model comparison tool for finding optimal price/quality balance. |

---

## 🔄 Workflow Architecture

```mermaid
flowchart TD
    subgraph Input ["1. Telegram Input"]
        TG[Shopkeeper Telegram] -->|1. Sends Photo| SW{Switch Message Type}
        TG -->|2. Sends Voice Note| SW
        SW -->|Photo Message| DT[(n8n Data Table\nsave photo_file_id)]
        SW -->|Voice Message| LK[(n8n Data Table\nlookup photo_file_id)]
    end

    subgraph Intelligence ["2. Gemini Multimodal Analysis"]
        LK --> GF[Telegram Get Files\nPhoto + Voice OGG]
        GF --> GA[Gemini 2.5 Flash\nAnalyze Voice Note]
        GF --> GI[Gemini 2.5 Flash\nAnalyze Product Photo]
        GA & GI --> CD[Gemini 2.5 Flash\nCreative Director Engine]
        CD --> JSON[Structured JSON\nCaption, Script, Image Prompt]
    end

    subgraph Generation ["3. Wiro AI Generation & QA"]
        JSON --> WI[Wiro AI HTTP\nSeedream 5.5 Advanced]
        WI --> CHK{Image Succeeded?\npexit == '0'}
        CHK -->|Yes| WV[Wiro AI HTTP\nElevenLabs Voiceover]
        CHK -->|No| ERR[Telegram Alert\nRetries Blocked]
        WV --> QA[Gemini 2.5 Flash\nImage QA Review Score]
    end

    subgraph Governance ["4. Human-in-the-Loop & Publishing"]
        QA --> PREVIEW[Telegram Send Photo,\nAudio & Proposed Post]
        PREVIEW --> APPR{Telegram Send-and-Wait\nShopkeeper Approval}
        APPR -->|Disapproved| CANCEL[Telegram Cancellation Notice]
        APPR -->|Approved| IG_C[Instagram Graph API\nCreate Media Container]
        IG_C --> WAIT[Wait 8 Seconds]
        WAIT --> IG_P[Instagram Graph API\nPublish Media]
        IG_P --> PERMA[Fetch Permalink]
        PERMA --> GS[Google Sheets\nAppend Accounting Row]
        GS --> CONFIRM[Telegram Final Success Confirmation]
    end
```

---

## 🔬 The Model Picker Story

Before deploying our Wiro AI integration, we built and ran an empirical bakeoff tool: [`scripts/wiro-picker.mjs`](file:///D:/VanniReel/VaaniReel/scripts/wiro-picker.mjs).

The script scanned Wiro's live model catalog across categories (`image-to-image`, `image-editing`), filtered candidates requiring at least 20 runs and an 80% success rate, and benchmarked the top 3 contenders against our local test asset ([`samples/saree.jpg`](file:///D:/VanniReel/VaaniReel/samples/saree.jpg)).

View the live bakeoff review report at: [`samples/bakeoff/image/index.html`](file:///D:/VanniReel/VaaniReel/samples/bakeoff/image/index.html).

### Empirical Results

| Candidate Model | Actual Billed Cost | Turnaround Time | Exit Status | Decision |
| :--- | :--- | :--- | :--- | :--- |
| **ByteDance Seedream 5.5 Advanced** | **$0.0280** | **21.62 seconds** | `pexit: 0` | **SELECTED**: Flawless saree drape preservation, crisp festive marble lighting, fast and economical. |
| **ByteDance Seedream 5.5 Layerize** | $0.0480 | 20.03 seconds | `pexit: 0` | **REJECTED**: Outputted decomposed mask layers and JSON rather than a finished commercial photo. |
| **ByteDance Seedream 5.5 Uncensored Advanced** | $0.0280 | 24.60 seconds | `pexit: 0` | **REJECTED**: Identical pricing but 3s slower; uncensored weights avoided for brand-safe public retail tools. |

---

## 🛡️ Responsible AI & Guardrails

1. **Human-in-the-Loop Mandatory Approval**: No post can ever be published to Instagram automatically. The n8n workflow physically pauses on a Telegram `sendAndWait` approval node until the shop owner taps **Approve**.
2. **Transparent AI Disclosure**: Every publication request sent to the Instagram Graph API includes `"is_ai_generated": true` in adherence to Meta's AI transparency guidelines.
3. **Strict Truthfulness (Facts-Only Rule)**: The Creative Director prompt forbids hallucinating prices, discounts, or specifications not spoken by the owner. If a shopkeeper doesn't state a discount, none is advertised.
4. **Budget Protection**: Wiro HTTP nodes have automatic retries disabled (`maxTries: 1`). If a render fails, the workflow alerts the owner rather than burning money in a retry loop.

---

## 🚀 Quick Start (< 5 Minutes)

### Prerequisites
- An active [n8n instance](https://n8n.io) (cloud or self-hosted Docker).
- [Telegram Bot](https://t.me/BotFather) token.
- [Google Gemini API Key](https://aistudio.google.com/).
- [Wiro AI API Key](https://wiro.ai/).
- Instagram Professional account linked to a Facebook Page (for Graph API access).
- Google Sheets spreadsheet named `vaanireel_posts_log`.

### Setup Steps
1. **Clone repository**:
   ```bash
   git clone https://github.com/your-username/VaaniReel.git
   cd VaaniReel
   cp .env.example .env
   ```
2. **Import Workflow**:
   In your n8n workspace, navigate to **Workflows > Import from File** and select [`workflows/vaanireel-full.json`](file:///D:/VanniReel/VaaniReel/workflows/vaanireel-full.json).
3. **Configure Credentials in n8n**:
   - `Telegram`: Telegram API Bot Token.
   - `Google Gemini API`: Google PaLM / Gemini API credential.
   - `Wiro`: Header Auth with Header `x-api-key: YOUR_WIRO_API_KEY`.
   - `Instagram`: Header Auth with Header `Authorization: Bearer YOUR_IG_ACCESS_TOKEN`.
   - `Google Sheets`: Google Sheets OAuth2 credential.
4. **Create Data Table**:
   In n8n Data Tables, create a table named `vaanireel_sessions` with two columns:
   - `chat_id` (String)
   - `photo_file_id` (String)
5. **Activate**:
   Toggle the workflow to **Active**. Open your bot on Telegram and send a photo!

---

## 📸 Sample Outputs

- **Input Saree Photo**: [`samples/saree.jpg`](file:///D:/VanniReel/VaaniReel/samples/saree.jpg) (Black sequined saree taken on counter).
- **Generated Festive Visual**: [`samples/bakeoff/image/bytedance-seedream-5.5-advanced-1.jpg`](file:///D:/VanniReel/VaaniReel/samples/bakeoff/image/bytedance-seedream-5.5-advanced-1.jpg)
- **Voice Note Audio**: [TODO: Record sample Tamil voice note: "Vanakkam, idhu namma pudhu Deepavali black sequin saree collection..."]
- **Telegram Approval Interaction**: [TODO: Add screenshot of Telegram inline approve button UI]
- **Published Instagram Post**: [TODO: Add screenshot of published Instagram post]
- **Google Sheet Accounting Row**: See [`samples/sheet-template.csv`](file:///D:/VanniReel/VaaniReel/samples/sheet-template.csv) for column layout.

---

## 💰 Cost Per Post

Computed strictly from verified benchmark metrics:

| Pipeline Stage | Provider / Model | Measured Cost (USD) |
| :--- | :--- | :--- |
| Audio Transcription & Translation | Gemini 2.5 Flash | < $0.0005 |
| Product Visual Analysis | Gemini 2.5 Flash | < $0.0005 |
| Creative Copywriting & Prompting | Gemini 2.5 Flash | < $0.0005 |
| Product Restaging Image | Wiro AI (Seedream 5.5 Advanced) | **$0.0280** (verified in bakeoff) |
| Multilingual Voiceover | Wiro AI (ElevenLabs V4 Turbo) | [TODO: Live run measurement, ~$0.0100] |
| Visual Quality Assurance Review | Gemini 2.5 Flash | < $0.0005 |
| **Total Estimated Cost Per Post** | | **~$0.038 to $0.040 USD** (~₹3.20 INR) |

*Local studio catalog photography typically costs ₹500–₹1,500 per garment. VaaniReel delivers an ad-ready post for under ₹4.*

---

## ⚠️ Honest Limitations

- **Single Instagram Account**: Current workflow connects to a single shopkeeper's Instagram account via environment credentials.
- **Meta App Review**: Onboarding multiple arbitrary shopkeepers requires a formal Meta App Review for the Instagram Graph API permissions.
- **Full Video Reel Assembly**: Currently generates high-resolution product imagery and audio voiceover. Automatic video muxing (combining video motion with the audio track into an `.mp4` reel) is documented in the roadmap.
- **End-to-End Live Status**: Individual API contracts, prompts, schema definitions, and node configurations have been validated. Live end-to-end execution across all third-party services is **untested / pending live credentials deployment** as noted in [`docs/AGENT_REPORT.md`](file:///D:/VanniReel/VaaniReel/docs/AGENT_REPORT.md).

---

## 🗺️ Roadmap

- [ ] **WhatsApp Business Cloud API**: Expand beyond Telegram to WhatsApp, the primary communication tool for Indian merchants.
- [ ] **Automatic Video Reel Muxing**: Merge Wiro image-to-video with ElevenLabs voiceover into vertical 9:16 `.mp4` Reels via FFmpeg.
- [ ] **Multi-Shop Self-Serve Onboarding**: Let merchants connect their Instagram and Google Sheets in one click.
- [ ] **Festive Campaign Calendar**: Proactive automated alerts reminding shopkeepers of upcoming festivals (Pongal, Diwali, Tamil New Year, Eid, Christmas) with pre-designed creative themes.

---

## 👥 Credits & Acknowledgments

Built for the **Build with Gemini Chennai Hackathon 2026** by team VaaniReel.  
Powered by Google Gemini 2.5 Flash, n8n automation, and Wiro AI infrastructure.
