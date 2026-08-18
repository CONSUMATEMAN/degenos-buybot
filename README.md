# DegenOS BuyBot

First production-oriented build of the DegenOS BuyBot.

## Current build

- Telegram group bot
- `/start`, `/help`, `/add`, `/remove`, `/settings`, `/status`
- Admin-only token configuration
- BNB Smart Chain token validation
- PancakeSwap V2 WBNB pair discovery
- Real-time V2 Swap-event polling
- Buy detection
- Minimum USD threshold
- Rich buy notifications
- Inline group settings
- JSON persistence for the first milestone

## Setup

```bash
npm install
copy .env.example .env
```

Put your BotFather token in `.env`.

Then:

```bash
npm run typecheck
npm run dev
```

Production:

```bash
npm run build
npm start
```

## Add a token

Add the bot to a Telegram group, then as a group administrator:

```text
/add 0xYourTokenContract
```

The bot validates the contract and finds the token/WBNB PancakeSwap V2 pair.

## Current limitation

This first milestone monitors the PancakeSwap V2-style WBNB pair. Multi-pair aggregation, V3, custom GIF/image upload, competitions, compilations, premium mode and analytics come next.
