# Meta Instagram Graph API Setup Guide

This guide covers configuring the Instagram Graph API with Instagram Login for automated product publishing in VaaniReel, including permissions, token generation, 2-step publishing calls, constraints, and fallback behavior.

---

## 1. Prerequisites

1. **Instagram Professional Account**:
   - The shop's Instagram account must be set to a **Business** or **Creator** account (Personal accounts cannot publish via API).
   - In Instagram mobile app: **Settings > Account > Switch to Professional Account**.
2. **Linked Facebook Page**:
   - The Instagram Business account must be linked to a Facebook Page owned by the shopkeeper.
   - In Facebook Page Settings: **Linked Accounts > Instagram > Connect Account**.
3. **Meta Developer Account**:
   - A registered account on [developers.facebook.com](https://developers.facebook.com/).

---

## 2. Meta App Configuration

1. Log in to [Meta for Developers](https://developers.facebook.com/) and click **My Apps > Create App**.
2. Select **Other** as the use case, then choose **Business** as the app type.
3. Name your app (e.g. `VaaniReel-Marketing-Bot`).
4. In the app dashboard, locate **Instagram Graph API** and click **Set Up**.
5. Add the following required permissions to your app:
   - `instagram_basic`: Allows reading basic account information and Instagram Business Account ID.
   - `instagram_content_publish`: Allows publishing photos, carousels, and reels on behalf of the account.
   - `pages_show_list`: Allows viewing the connected Facebook Page.
   - `pages_read_engagement`: Allows verifying connection permissions.

---

## 3. Obtaining the Instagram Business Account ID (`IG_USER_ID`)

1. Open the **Meta Graph API Explorer**:
   `https://developers.facebook.com/tools/explorer/`
2. Select your App from the top-right dropdown.
3. Select your User Token and click **Generate Access Token**, accepting the requested permissions.
4. Run this query in the Explorer:
   ```http
   GET me/accounts?fields=name,instagram_business_account
   ```
5. In the response JSON, locate the `instagram_business_account.id`:
   ```json
   {
     "data": [
       {
         "name": "My Saree Boutique",
         "instagram_business_account": {
           "id": "17841400000000000"
         }
       }
     ]
   }
   ```
6. Copy this ID to `.env` as `IG_USER_ID=17841400000000000`.

---

## 4. Generating a Long-Lived Access Token (`IG_ACCESS_TOKEN`)

By default, Explorer tokens expire after 1–2 hours. Convert it to a 60-day long-lived token:

1. Replace placeholders and make this GET request in your browser or curl:
   ```bash
   curl -i -X GET "https://graph.facebook.com/v21.0/oauth/access_token?\
     grant_type=fb_exchange_token&\
     client_id=YOUR_META_APP_ID&\
     client_secret=YOUR_META_APP_SECRET&\
     fb_exchange_token=SHORT_LIVED_TOKEN"
   ```
2. The response will return an `access_token` valid for 60 days.
3. Store this token in `.env` as `IG_ACCESS_TOKEN=YOUR_LONG_LIVED_TOKEN`.

---

## 5. The 2-Step Publishing Mechanism

Instagram publishing requires two distinct API calls with a short delay between them to allow Meta's CDN to download, validate, and optimize the image container.

### Step 1: Create Media Container
- **Endpoint**: `POST https://graph.instagram.com/v21.0/{IG_USER_ID}/media`
- **Headers**:
  ```http
  Authorization: Bearer YOUR_IG_ACCESS_TOKEN
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "image_url": "https://cdn.wiro.ai/outputs/task-12345/result.jpg",
    "caption": "Deepavali Special Banarasi Saree collection! Visit us at T. Nagar today!\n\n#ChennaiShopping #SilkSarees #FestiveCollection",
    "is_ai_generated": true
  }
  ```
- **Response**: Returns a container ID:
  ```json
  {
    "id": "17900000000000000"
  }
  ```

### Step 2: Processing Wait Period
- Instagram asynchronously fetches the image from `image_url` and verifies dimensions.
- The n8n workflow includes a mandatory **Wait 8 Seconds** node (`Wait 8 Seconds for Container`) to ensure the container status changes to `FINISHED` before publishing.

### Step 3: Publish Media
- **Endpoint**: `POST https://graph.instagram.com/v21.0/{IG_USER_ID}/media_publish`
- **Headers**:
  ```http
  Authorization: Bearer YOUR_IG_ACCESS_TOKEN
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "creation_id": "17900000000000000"
  }
  ```
- **Response**: Returns the live published Instagram media ID:
  ```json
  {
    "id": "18000000000000000"
  }
  ```

### Step 4: Fetch Permalink
- **Endpoint**: `GET https://graph.instagram.com/v21.0/{media_id}?fields=permalink`
- **Headers**: `Authorization: Bearer YOUR_IG_ACCESS_TOKEN`
- **Response**:
  ```json
  {
    "permalink": "https://www.instagram.com/p/DB12345xyz/",
    "id": "18000000000000000"
  }
  ```

---

## 6. Technical Constraints & Policies

1. **Image Requirements**:
   - Must be in **JPEG format** (`.jpg` or `.jpeg`). Wiro AI Seedream 5.5 Advanced generates JPEG by default (`outputFormat=jpeg`).
   - Must be hosted on a publicly accessible HTTPS URL. Wiro AI's CDN (`cdn.wiro.ai`) satisfies this constraint.
   - Aspect ratio must be between **4:5 (vertical)** and **1.91:1 (landscape)**. VaaniReel uses 1:1 (`1024x1024`) which is universally supported for Instagram feed posts.
2. **API Publishing Limits**:
   - Meta enforces a limit of **100 API-published posts per 24 hours** per connected Instagram account.
3. **Meta AI Disclosure Compliance**:
   - Every container request in VaaniReel passes `"is_ai_generated": true` to comply with Meta's official AI transparency policies.

---

## 7. Graceful Fallback Mode in n8n

During local development, hackathon demos, or while awaiting Meta App Review approval:
- The three Instagram nodes in [`workflows/vaanireel-full.json`](file:///D:/VanniReel/VaaniReel/workflows/vaanireel-full.json) (`Instagram Create Container`, `Instagram Publish Media`, `Instagram Fetch Permalink`) have **`continueOnFail: true`** enabled.
- If the token is missing, expired, or the user is not in Meta Developer Test mode, the workflow **does not fail or halt**.
- Instead, it logs the generated image, voiceover script, and Wiro costs into the Google Sheet with a fallback marker (`"TODO: Check Instagram"`), ensuring the rest of the pipeline functions flawlessly.
