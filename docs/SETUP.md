# VaaniReel Complete Setup & Deployment Guide

This guide provides step-by-step instructions for configuring all services, credentials, and data stores required to run the VaaniReel marketing automation pipeline.

---

## 1. Telegram Bot Setup

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a display name (e.g., `VaaniReel Chennai Assistant`) and a unique username ending in `bot` (e.g., `vaanireel_demo_bot`).
3. BotFather will provide an HTTP API token (format: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
4. Copy this token to your `.env` file as `TELEGRAM_BOT_TOKEN`.
5. *(Optional)* Send `/setdescription` to BotFather to give your bot a welcome explanation for shopkeepers.

---

## 2. Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** and create a new key in a Google Cloud project.
4. Copy the API key to your `.env` as `GEMINI_API_KEY`.
5. Verify access to `models/gemini-2.5-flash` (or `models/gemini-1.5-flash`) for audio, vision, and text understanding.

---

## 3. Wiro AI API Key

1. Log in to [Wiro AI](https://wiro.ai/).
2. Navigate to your Account Dashboard > **API Keys**.
3. Generate a new API Key.
4. Save the key to your `.env` as `WIRO_API_KEY`.
5. Ensure your Wiro account has sufficient balance (ByteDance Seedream 5.5 Advanced costs ~$0.0280 per generation).

---

## 4. Meta & Instagram Business Account Setup

1. **Prerequisites**:
   - An Instagram Professional (Business or Creator) account.
   - A Facebook Page connected to your Instagram account.
2. Follow the detailed steps in [`docs/instagram-setup.md`](file:///D:/VanniReel/VaaniReel/docs/instagram-setup.md) to generate:
   - Long-Lived User Access Token (`IG_ACCESS_TOKEN`).
   - Instagram Business Account ID (`IG_USER_ID`).
3. **Graceful Fallback Mode**:
   - If your Meta App Review or Instagram tokens are not yet configured, the workflow handles this seamlessly! The Instagram nodes have **Continue On Fail** enabled, meaning the workflow will still restage the image, synthesize the voiceover, obtain approval, and log the asset URLs to Google Sheets without crashing.

---

## 5. Google Sheets Post Log Setup

1. Go to [Google Sheets](https://sheets.google.com/) and create a new spreadsheet named:
   ```
   vaanireel_posts_log
   ```
2. In the first sheet (`Sheet1`), add the exact column headers from [`samples/sheet-template.csv`](file:///D:/VanniReel/VaaniReel/samples/sheet-template.csv):
   ```csv
   timestamp,chat_id,language,offer,caption,hashtags,image_url,audio_url,qa_score,total_cost_usd,instagram_url
   ```
3. Share the spreadsheet with the Google account or service account you connect to n8n.

---

## 6. Configuring Credentials in n8n

Open your n8n workspace, navigate to **Credentials > New Credential**, and create the 5 required credentials using these exact names:

| Credential Name in n8n | Credential Type in n8n | Configuration Details |
| :--- | :--- | :--- |
| **`Telegram`** | `Telegram API` | Access Token: paste your Telegram Bot Token. |
| **`Google Gemini API`** | `Google PaLM API` (or Google Gemini) | API Key: paste your `GEMINI_API_KEY`. |
| **`Wiro`** | `Header Auth` | Name: `x-api-key`<br>Value: paste your `WIRO_API_KEY`. |
| **`Instagram`** | `Header Auth` | Name: `Authorization`<br>Value: `Bearer YOUR_IG_ACCESS_TOKEN`. |
| **`Google Sheets`** | `Google Sheets OAuth2 API` | Connect your Google account with drive/sheets scopes. |

---

## 7. Creating the n8n Data Table

VaaniReel uses n8n's native Data Tables to store the session state across the two separate incoming Telegram messages (photo first, voice note second):

1. In n8n, navigate to **Data Tables** in the left sidebar.
2. Click **Create Table**.
3. Set the table name to:
   ```
   vaanireel_sessions
   ```
4. Define two columns:
   - `chat_id` (Type: **String**, check "Index" if available)
   - `photo_file_id` (Type: **String**)
5. Click **Save**.

---

## 8. Importing and Activating the Workflow

1. In n8n, click **Workflows > Import from File**.
2. Select [`workflows/vaanireel-full.json`](file:///D:/VanniReel/VaaniReel/workflows/vaanireel-full.json).
3. Verify that all 31 nodes appear on the canvas and connect properly.
4. Verify that the nodes reference the credentials you created in Step 6 (`Telegram`, `Google Gemini API`, `Wiro`, `Instagram`, `Google Sheets`).
5. Toggle the workflow switch in the top right to **Active**.

---

## 9. Testing the Live Flow

1. Open Telegram on your phone and start a conversation with your bot (`/start`).
2. Send an image of any retail product on a table.
3. Wait for the confirmation: *"📸 Photo received! Now please send a voice note..."*
4. Send an audio voice note describing the product in Tamil, Hindi, or English.
5. In ~25 seconds, your bot will reply with:
   - Restaged high-resolution visual.
   - ElevenLabs synthesized voiceover audio.
   - Gemini QA Score.
   - Proposed localized post caption and hashtags with an **[Approve]** button.
6. Tap **Approve**! The post is submitted to Instagram and recorded in your Google Sheet.
