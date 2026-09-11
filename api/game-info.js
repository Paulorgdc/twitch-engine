export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const targetChannel = req.query.channel || process.env.TWITCH_CHANNEL;

  let gameQuery = req.query.query ? decodeURIComponent(req.query.query).trim() : "";

  if (!gameQuery || gameQuery.includes("twitch.game") || gameQuery.includes("${") || gameQuery.includes("$(")) {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;

      if (clientId && clientSecret && targetChannel) {
        const tokenRes = await fetch(
          `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
          { method: "POST", cache: "no-store" }
        );
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (accessToken) {
          const userRes = await fetch(
            `https://api.twitch.tv/helix/users?login=${encodeURIComponent(targetChannel)}`,
            {
              headers: {
                "Client-ID": clientId,
                "Authorization": `Bearer ${accessToken}`
              },
              cache: "no-store"
            }
          );
          const userData = await userRes.json();

          if (userData.data && userData.data.length > 0) {
            const broadcasterId = userData.data[0].id;
            const channelRes = await fetch(
              `https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`,
              {
                headers: {
                  "Client-ID": clientId,
                  "Authorization": `Bearer ${accessToken}`
                },
                cache: "no-store"
              }
            );
            const channelData = await channelRes.json();

            if (channelData.data && channelData.data.length > 0) {
              gameQuery = channelData.data[0].game_name;
            }
          }
        }
      }
    } catch (e) {
      // Fallback
    }
  }

  if (!gameQuery || gameQuery.includes("twitch.game")) {
    return res.status(200).send("🎮 Nenhuma categoria de jogo ativa na transmissão no momento.");
  }

  async function translateToPt(text) {
    try {
      const cleanText = text.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
      if (!cleanText) return "";

      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(cleanText)}`;
      const res = await fetch(translateUrl, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          return data[0].map((item) => item[0]).join("");
        }
      }
    } catch (e) {
      // Fallback
    }
    return text;
  }

  function isTargetGameValid(query, resultName) {
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const r = resultName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const forbidden = ["mahjong", "baseball", "cricket", "pinball", "cartoon"];
    for (const word of forbidden) {
      if (r.includes(word) && !q.includes(word)) {
        return false;
      }
    }

    return r.includes(q) || q.includes(r);
  }

  try {
    const cleanQuery = gameQuery.replace(/[®™]/g, "").trim();

    const yearMatch = cleanQuery.match(/\b(19\d\d|20\d\d)\b/);
    const targetYear = yearMatch ? parseInt(yearMatch[0]) : null;

    const cleanTitleOnly = cleanQuery.replace(/\s*\(\d{4}\)\s*/g, "").replace(/\b(19\d\d|20\d\d)\b/g, "").trim();

    const isRetroYear = targetYear && targetYear < 2015;

    if (!isRetroYear) {
      const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanTitleOnly)}&l=brazilian&cc=BR&_t=${Date.now()}`;
      const searchRes = await fetch(searchUrl, { cache: "no-store" });
      const searchData = await searchRes.json();

      if (searchData.items && searchData.items.length > 0) {
        let selectedAppId = null;

        for (const item of searchData.items) {
          if (isTargetGameValid(cleanTitleOnly, item.name)) {
            const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${item.id}&l=brazilian&_t=${Date.now()}`;
            const detailsRes = await fetch(detailsUrl, { cache: "no-store" });
            const detailsData = await detailsRes.json();

            if (detailsData[item.id] && detailsData[item.id].success && detailsData[item.id].data.type === "game") {
              selectedAppId = item.id;
              break;
            }
          }
        }

        if (selectedAppId) {
          const finalUrl = `https://store.steampowered.com/api/appdetails?appids=${selectedAppId}&l=brazilian&_t=${Date.now()}`;
          const finalRes = await fetch(finalUrl, { cache: "no-store" });
          const finalData = await finalRes.json();

          if (finalData[selectedAppId] && finalData[selectedAppId].success) {
            const gameData = finalData[selectedAppId].data;
            let description = gameData.short_description || "";
            description = description.replace(/<[^>]*>?/gm, "").replace(/\n/g, " ").trim();

            if (description.length > 0) {
              return res.status(200).send(`🎮 ${gameData.name}: ${description}`);
            }
          }
        }
      }
    }

    const rawgKey = process.env.RAWG_API_KEY;

    if (rawgKey) {
      const rawgSearchUrl = `https://api.rawg.io/api/games?key=${rawgKey}&search=${encodeURIComponent(cleanTitleOnly)}&page_size=15`;
      const rawgSearchRes = await fetch(rawgSearchUrl, { cache: "no-store" });

      if (rawgSearchRes.ok) {
        const rawgSearchData = await rawgSearchRes.json();

        if (rawgSearchData.results && rawgSearchData.results.length > 0) {
          let selectedGame = null;

          if (targetYear) {
            let minDiff = Infinity;

            for (const item of rawgSearchData.results) {
              if (isTargetGameValid(cleanTitleOnly, item.name) && item.released) {
                const releaseYear = parseInt(item.released.split("-")[0]);
                const diff = Math.abs(releaseYear - targetYear);

                if (diff < minDiff && diff <= 5) {
                  minDiff = diff;
                  selectedGame = item;
                }
              }
            }
          }

          if (!selectedGame) {
            for (const item of rawgSearchData.results) {
              if (isTargetGameValid(cleanTitleOnly, item.name)) {
                selectedGame = item;
                break;
              }
            }
          }

          if (selectedGame) {
            const rawgDetailsUrl = `https://api.rawg.io/api/games/${selectedGame.slug}?key=${rawgKey}`;
            const rawgDetailsRes = await fetch(rawgDetailsUrl, { cache: "no-store" });

            if (rawgDetailsRes.ok) {
              const rawgGameData = await rawgDetailsRes.json();
              let rawDescription = rawgGameData.description_raw || rawgGameData.description || "";

              if (rawDescription.length > 0) {
                const translatedDescription = await translateToPt(rawDescription);
                let finalDesc = translatedDescription || rawDescription;

                if (finalDesc.length > 300) {
                  finalDesc = finalDesc.substring(0, 297) + "...";
                }

                return res.status(200).send(`🎮 ${rawgGameData.name}: ${finalDesc}`);
              }
            }
          }
        }
      }
    }

    return res.status(200).send(`🎮 Transmitindo atualmente: ${gameQuery}. (Descrição não disponível)`);
  } catch (error) {
    return res.status(200).send("Erro ao consultar informações do jogo.");
  }
}