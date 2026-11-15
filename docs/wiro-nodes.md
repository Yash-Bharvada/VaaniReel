# Wiro AI Node Specifications

This document details the exact configuration, endpoint URLs, parameters, content types, curl examples, and response parsing paths for the Wiro AI nodes used in VaaniReel.

---

## 1. Chosen IMAGE Model: ByteDance Seedream 5.5 Advanced

- **Model Identifier**: `ByteDance/seedream 5.5 advanced` (Clean slug: `bytedance/seedream-5-5-advanced`)
- **Selection Context**: Evaluated in the image bakeoff (`samples/bakeoff/image/index.html`). Yielded high-quality product staging with the saree sample, 21.62s turnaround, $0.0280 actual billed cost, and `pexit=0`. The uncensored variant (`seedream 5.5 uncensored advanced`) was avoided as unsuitable for a public marketing tool, and `seedream 5.5 layerize` outputted segmented asset layers rather than a unified marketing photo.

### Exact Run URL
```
https://api.wiro.ai/v1/Run/bytedance/seedream-5-5-advanced/sync
```
*(Alternative URL with URL-encoded display slug: `https://api.wiro.ai/v1/Run/ByteDance/seedream%205.5%20advanced/sync`)*

### Content-Type
`multipart/form-data`

### Parameter IDs to Send

| Parameter ID | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `prompt` | string / text | **Yes** | Text prompt describing the desired background, environment, and style while preserving product fidelity. |
| `inputImage` | file / binary | **Yes** (for img2img) | The input product photo file (e.g. `saree.jpg`). |
| `width` | integer | **Yes** | Image width in pixels (e.g. `1024`). |
| `height` | integer | **Yes** | Image height in pixels (e.g. `1024`). |
| `background` | string / select | No | Background handling mode: `auto` (default), `transparent`, or `opaque`. |
| `outputFormat` | string / select | No | Generated image format: `jpeg` (default) or `png`. |
| `watermark` | string / select | No | Whether to apply watermark: `false` (default) or `true`. |

> **Note on Aspect Ratio**: This model does not have a separate `aspect_ratio` parameter ID. The aspect ratio is controlled directly by the `width` and `height` parameters:
> - **1:1 Square (Feed Post)**: `width=1024`, `height=1024`
> - **9:16 Vertical (Reels / Stories)**: `width=768`, `height=1344` (or `width=1024`, `height=1792`)
> - **16:9 Landscape**: `width=1344`, `height=768`

### Example curl (Image Generation with Placeholders)

```bash
curl -X POST "https://api.wiro.ai/v1/Run/bytedance/seedream-5-5-advanced/sync" \
  -H "x-api-key: YOUR_WIRO_API_KEY" \
  -F "prompt=Premium product photo of this item on a marble table, warm Diwali festival lighting, keep the product exactly the same, no text, no logos" \
  -F "inputImage=@samples/saree.jpg" \
  -F "width=1024" \
  -F "height=1024" \
  -F "outputFormat=jpeg" \
  -F "watermark=false"
```

---

## 2. TTS (Voice) Model: Selection Status & Candidate Parameters

- **Selection Status**: **Not yet chosen in `config/models.json`**. No TTS model entry currently exists in `config/models.json`, and no `samples/detail-*.json` detail file was checked in for voice.
- **Primary Candidate**: `elevenlabs/eleven-v4-turbo` (Clean slug: `elevenlabs/eleven-v4-turbo`), recommended for expressive multilingual speech synthesis (including Tamil, Hindi, and English).

### Candidate Run URL
```
https://api.wiro.ai/v1/Run/elevenlabs/eleven-v4-turbo/sync
```

### Content-Type
`application/json` *(or `multipart/form-data`)*

### Candidate Parameter IDs (from Wiro Tool/Detail API Inspection)

| Parameter ID | Parameter Type | Required | Description & Candidate Values |
| :--- | :--- | :--- | :--- |
| `prompt` | string / text | **Yes** | **The spoken text / script** to synthesize into audio. |
| `voice` | string / select | **Yes** | Voice actor selection (e.g. `sarah`, `adam`, `bella`, `charlie`, `george`). |
| `outputFormat` | string / select | **Yes** | Audio output format and bitrate (`mp3_44100_128`, `mp3_44100_64`, `mp3_22050_32`). |
| `languageCode` | string / select | No | Language code: `auto`, `ta` (Tamil), `hi` (Hindi), `te` (Telugu), `en` (English), `bn` (Bengali), etc. |
| `stability` | float | No | Voice stability tuning (0.0 to 1.0). |
| `similarityBoost`| float | No | Voice similarity boost (0.0 to 1.0). |
| `timestamps` | string / select | No | Whether to return timestamps: `false` or `true`. |
| `applyTextNormalization` | string / select | No | Text normalization: `auto`, `on`, `off`. |
| `seed` | float | No | Seed value for reproducible generation. |

### Example curl (TTS Synthesis with Placeholders)

```bash
curl -X POST "https://api.wiro.ai/v1/Run/elevenlabs/eleven-v4-turbo/sync" \
  -H "x-api-key: YOUR_WIRO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "வணக்கம்! எங்கள் புதிய பட்டுப் புடவைகள் இப்போது சிறப்பு தள்ளுபடியில் கிடைக்கின்றன.",
    "voice": "sarah",
    "outputFormat": "mp3_44100_128",
    "languageCode": "ta"
  }'
```

---

## 3. Response Paths to Read

All Wiro synchronous execution endpoints return a JSON response containing a `tasklist` array. Inspect the first task entry (`tasklist[0]`):

| Metric | Exact Response Path | Description | Success Condition |
| :--- | :--- | :--- | :--- |
| **Exit Code** | `tasklist[0].pexit` | Process exit status code. | Must equal `"0"` for success. Non-zero indicates failure. |
| **Output URL** | `tasklist[0].outputs[0].url` | Direct HTTPS URL to download the generated image (`.jpg`/`.png`) or audio (`.mp3`). | Must be a valid HTTPS URL string. |
| **Cost** | `tasklist[0].totalcost` | Total execution cost in USD billed for this task execution. | Numeric / float value (e.g. `0.0280`). |

### Additional Useful Response Paths
- `tasklist[0].taskid`: Unique task ID in Wiro.
- `tasklist[0].status`: Execution status string (e.g. `"completed"`).
- `tasklist[0].computingtime`: Elapsed compute duration (e.g. `"21.62 seconds"`).
- `tasklist[0].error`: Error details if `pexit != "0"`.

### Example Synchronous Response Payload
```json
{
  "tasklist": [
    {
      "taskid": "6134449",
      "status": "completed",
      "pexit": "0",
      "totalcost": 0.0280,
      "computingtime": "21.62 seconds",
      "outputs": [
        {
          "url": "https://cdn.wiro.ai/outputs/task-6134449/result.jpg"
        }
      ]
    }
  ]
}
```

### n8n Expression Reference
When handling the response in an n8n HTTP Request node:
- **pexit**: `{{ $json.tasklist[0].pexit }}`
- **Output URL**: `{{ $json.tasklist[0].outputs[0].url }}`
- **Total Cost**: `{{ $json.tasklist[0].totalcost }}`
