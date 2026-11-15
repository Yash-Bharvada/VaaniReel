# Wiro Model Placeholders & Parameter Specifications

This document defines the exact Wiro AI model identifiers, parameter IDs, option values, and content types required for the VaaniReel n8n workflow.

---

## A) Placeholders Table

| Placeholder | Value | Source file |
| :--- | :--- | :--- |
| `[IMAGE_MODEL]` | `bytedance/seedream-5-5-advanced` (Sync URL: `https://api.wiro.ai/v1/Run/bytedance/seedream-5-5-advanced/sync`) | `samples/detail-bytedance-seedream-5.5-advanced.json` |
| `[IMAGE_PROMPT_PARAM]` | `prompt` | `samples/detail-bytedance-seedream-5.5-advanced.json` |
| `[IMAGE_FILE_PARAM]` | `inputImage` | `samples/detail-bytedance-seedream-5.5-advanced.json` |
| `[IMAGE_OPTIONS]` | `width = 1024, height = 1024, background = auto, outputFormat = jpeg, watermark = false` | `samples/detail-bytedance-seedream-5.5-advanced.json` |
| `[VIDEO_MODEL]` | `alibaba/wan-2-6` [TENTATIVE (not tested by me)] (Sync URL: `https://api.wiro.ai/v1/Run/alibaba/wan%202.6/sync`) | `samples/detail-alibaba-wan-2.6.json` |
| `[VIDEO_PROMPT_PARAM]` | `prompt` | `samples/detail-alibaba-wan-2.6.json` |
| `[VIDEO_IMAGE_PARAM]` | `inputImage` | `samples/detail-alibaba-wan-2.6.json` |
| `[VIDEO_OPTIONS]` | `ratio = 9:16, duration = 3, resolution = 720P, audioEnabled = true, mode = std` | `samples/detail-alibaba-wan-2.6.json` |
| `[TTS_MODEL]` | `elevenlabs/eleven-v4-turbo` [TENTATIVE (not tested by me)] (Sync URL: `https://api.wiro.ai/v1/Run/elevenlabs/eleven-v4-turbo/sync`) | `samples/detail-elevenlabs-eleven-v4-turbo.json` |
| `[TTS_TEXT_PARAM]` | `prompt` | `samples/detail-elevenlabs-eleven-v4-turbo.json` |
| `[TTS_LANG_PARAM]` | `languageCode` | `samples/detail-elevenlabs-eleven-v4-turbo.json` |
| `[TTS_OPTIONS]` | `voice = sarah, outputFormat = mp3_44100_128, languageCode = ta` | `samples/detail-elevenlabs-eleven-v4-turbo.json` |

---

## B) USE THESE EXACT VALUES

```text
[IMAGE_MODEL] = bytedance/seedream-5-5-advanced
[IMAGE_PROMPT_PARAM] = prompt
[IMAGE_FILE_PARAM] = inputImage
[IMAGE_OPTIONS] = width = 1024, height = 1024, background = auto, outputFormat = jpeg, watermark = false
[VIDEO_MODEL] = alibaba/wan-2-6
[VIDEO_PROMPT_PARAM] = prompt
[VIDEO_IMAGE_PARAM] = inputImage
[VIDEO_OPTIONS] = ratio = 9:16, duration = 3, resolution = 720P, audioEnabled = true, mode = std
[TTS_MODEL] = elevenlabs/eleven-v4-turbo
[TTS_TEXT_PARAM] = prompt
[TTS_LANG_PARAM] = languageCode
[TTS_OPTIONS] = voice = sarah, outputFormat = mp3_44100_128, languageCode = ta
```

---

## C) Warnings

1. **TENTATIVE Models**:
   - `[VIDEO_MODEL]` (`alibaba/wan-2-6`): Marked **TENTATIVE (not tested by me)**. No video model was selected in `config/models.json` and no `samples/bakeoff/video` test runs existed. Selected via `scripts/wiro-picker.mjs find image-to-video --require prompt,inputImage` as the cheapest qualifying model with ≥80% success rate (83.3% success, 850 completed runs).
   - `[TTS_MODEL]` (`elevenlabs/eleven-v4-turbo`): Marked **TENTATIVE (not tested by me)**. Chosen as the default recommended TTS model; its schema and language support were verified via free `Tool/Detail` API inspection, but live paid audio generation has not been run.

2. **NOT FOUND Parameters**:
   - `[IMAGE_OPTIONS]` Aspect Ratio: **NOT FOUND**. ByteDance Seedream 5.5 Advanced does not provide an `aspect_ratio` or `ratio` parameter ID. The aspect ratio is strictly configured using explicit pixel dimensions via `width` and `height` (`width = 1024, height = 1024` yields 1:1 square).

3. **Required Parameters with No Default Value in Schema**:
   - `[IMAGE_MODEL]`: `prompt` (textarea) is required and has no default value; dynamic prompt text must be provided on every request. (`width` and `height` default to 1024).
   - `[VIDEO_MODEL]`: `prompt` (textarea) is required and has no default value. (Required parameter `mode` defaults to `std`, `duration` defaults to `5` [min: 3], and `resolution` defaults to `1080P` [lowest: 720P]).
   - `[TTS_MODEL]`: `prompt` (textarea) is required and has no default value. (`voice` defaults to `alice` [we set `sarah`], and `outputFormat` defaults to `mp3_44100_128`).

4. **Tamil Support by TTS Model**:
   - **Supported**: `elevenlabs/eleven-v4-turbo` explicitly supports Tamil via `languageCode = ta` (labeled `"Tamil"` in the schema options). Hindi (`languageCode = hi`), English (`languageCode = en`), and automatic detection (`languageCode = auto`) are also fully supported.

5. **Estimated Cost per Call**:
   - `[IMAGE_MODEL]` (`bytedance/seedream-5-5-advanced`): **$0.0280** per generation ($0.008 per input image + $0.020 for output up to 2.6M pixels; confirmed at exactly $0.0280 in `samples/bakeoff/image/index.html`).
   - `[VIDEO_MODEL]` (`alibaba/wan-2-6`): Estimated **$0.075 to $0.150** per video (dynamicprice: standard mode at 720P costs $0.025/s without audio, or $0.050/s with `audioEnabled = true`. For a 3-second shortest duration with audio, estimated cost is $0.150; for 5 seconds without audio, estimated cost is $0.125).
   - `[TTS_MODEL]` (`elevenlabs/eleven-v4-turbo`): Estimated **$0.004 to $0.008** per voiceover (dynamicprice: `$0.00004` per character via `cp-promptlength`. A typical 25-word marketing script contains ~120–150 characters, costing ~$0.0048 to $0.0060).

6. **Content Types**:
   - `[IMAGE_MODEL]`: `multipart/form-data` (requires `inputImage` file upload).
   - `[VIDEO_MODEL]`: `multipart/form-data` (requires `inputImage` file upload).
   - `[TTS_MODEL]`: `application/json` (text-only payload, no file upload required).
