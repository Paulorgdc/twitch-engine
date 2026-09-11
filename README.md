# 🎮 Twitch Stream Intelligence & Achievement Tracker Engine

> Production-ready serverless middleware connecting **Twitch Helix API**, **Steamworks Web API**, **RAWG Video Games Database**, and **RetroAchievements** to deliver contextual live game data and real-time user progress directly to chat bot commands.

![Category](https://img.shields.io/badge/CATEGORY-PERSONAL_PROJECT-e6005c?style=for-the-badge&labelColor=383838)
![Platform](https://img.shields.io/badge/PLATFORM-VERCEL_FUNCTIONS-00c8ff?style=for-the-badge&labelColor=383838)
![License](https://img.shields.io/badge/LICENSE-MIT-70b300?style=for-the-badge&labelColor=383838)

---

## 📌 Overview

Designed for automated broadcast operations, this engine connects directly with your preferred chat bot or automation service. It resolves live channel metadata via OAuth-secured Twitch Helix endpoints, sanitizes titles, strips unnecessary symbols, extracts release year tags, and coordinates lookups across external gaming databases (Steamworks, RAWG, and RetroAchievements) to deliver formatted responses straight to your live chat.

---

## 🎯 Matching Engine & Search Accuracy

Because both game descriptions and achievement queries rely on the active **Twitch category string**, resolution depends on external database search endpoints (such as Steam Store Search, RAWG, and RetroAchievements):

* **Fuzzy Resolution:** Identical or similar franchise titles (e.g., remasters, spin-offs, or subtitle variations) may occasionally match an adjacent store listing.
* **Built-in Sanitization:** The engine incorporates rigorous query cleaning, symbol removal (`®`, `™`), release-year proximity filters, and negative keyword guards (filtering out unrelated items like pinball, baseball, or board games).
* **Overall Precision:** While string-based matching across third-party APIs cannot be 100% deterministic, the filtering logic delivers highly accurate matches in the vast majority of streaming scenarios.

---

## ⚡ Endpoints & Features

### 1. `GET /api/game-info`
* **Dynamic Broadcaster Lookup:** Queries active channel categories in real time via App Access Tokens.
* **Intelligent Query Sanitization:** Strips trademark symbols (`®`, `™`), isolates release years from titles (e.g., *Spider-Man (2000)*), and applies blacklist guards against mismatched game results.
* **Hybrid Data Source Routing:** Queries Steam Store API for PC titles; falls back to RAWG API for legacy/console releases with integrated translation routines to Brazilian Portuguese.

### 2. `GET /api/achievements`
* **Steamworks Integration:** Resolves game schemas dynamically and calculates unlocked milestone ratios (`unlocked / total`) for the configured SteamID64 profile.
* **RetroAchievements Fallback:** Queries recent play sessions for emulated legacy games, computing progress percentage alongside console tags.
* **Real-time Delivery Headers:** Strict `no-cache`, `must-revalidate`, and UTF-8 enforcement to ensure responses arrive fresh on every chat query.

---

## 🛠️ Environment Configuration

Set up the following variables within your deployment settings (e.g., Vercel Project Settings > Environment Variables):

| Variable | Description |
| :--- | :--- |
| `TWITCH_CLIENT_ID` | Twitch Developer Console Application Client ID |
| `TWITCH_CLIENT_SECRET` | Twitch Developer Console Application Secret |
| `TWITCH_CHANNEL` | Default broadcaster channel username |
| `STEAM_API_KEY` | Valve Steamworks Web API Access Key |
| `STEAM_USER_ID` | Broadcaster SteamID64 target account |
| `RA_USER` | RetroAchievements username |
| `RA_API_KEY` | RetroAchievements Web API key |
| `RAWG_API_KEY` | RAWG Video Games Database API token |

---

## 🚀 Live Chat Integration

Configure custom command responses inside your preferred broadcast bot using its URL fetch syntax. Replace `<your-vercel-domain>` with your actual deployment host.

### 1. Game Information & Description
Fetches real-time metadata, release details, and localized synopses for the currently active broadcast category:

* **Command Name:** Choose any trigger name you prefer (e.g., `!game`, `!jogo`, `!info`).
* **Request URL:**
  ```text
  https://<your-vercel-domain>.vercel.app/api/game-info?query=${game}
  ```

### 2. Achievement Progress & Milestones
Fetches completion stats, total trophy quantity, and unlock percentage from Steam or RetroAchievements:

* **Command Name:** Choose any trigger name you prefer (e.g., `!achievements`, `!conquistas`, `!progresso`).
* **Request URL:**
  ```text
  https://<your-vercel-domain>.vercel.app/api/achievements?query=${game}
  ```

> **Optional Parameters:**  
> * `query`: Pass the active category dynamically using your bot's game variable.  
> * `channel`: Append `&channel=channel_name` to query a specific broadcaster without relying exclusively on deployment environment defaults.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.