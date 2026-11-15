# VaaniReel Project Context

VaaniReel is a hackathon project for Build with Gemini Chennai. It uses a Telegram + n8n + Gemini + Wiro AI workflow to turn a shopkeeper's voice note and product photo into a marketing post.

## Stack

- n8n workflow, exported as JSON in `/workflows`
- Gemini API
- Wiro AI API (`https://api.wiro.ai/v1`)
- Telegram bot

## Rules

- Never hardcode secrets. Read all credentials from `.env`.
- Keep code beginner-readable and add helpful comments.
- Avoid unnecessary dependencies.
