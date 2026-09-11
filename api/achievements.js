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
    return res.status(200).send("🏆 Nenhuma categoria de jogo ativa na transmissão no momento.");
  }

  const STEAM_KEY = process.env.STEAM_API_KEY;
  const STEAM_ID = process.env.STEAM_USER_ID;
  const RA_USER = process.env.RA_USER;
  const RA_KEY = process.env.RA_API_KEY;

  function normalizeTitle(str) {
    return str
      .toLowerCase()
      .replace(/[®™]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  try {
    const cleanQuery = gameQuery.replace(/[®™]/g, "").trim();
    const normalizedQuery = normalizeTitle(cleanQuery);

    // 1. BUSCA NA STEAM COM COMPARAÇÃO NORMALIZADA
    if (STEAM_KEY && STEAM_ID) {
      const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanQuery)}&l=brazilian&cc=BR&_t=${Date.now()}`;
      const searchRes = await fetch(searchUrl, { cache: "no-store" });
      const searchData = await searchRes.json();

      if (searchData.items && searchData.items.length > 0) {
        let appId = null;

        for (const item of searchData.items) {
          const normalizedItemName = normalizeTitle(item.name);

          const isMatch =
            normalizedItemName === normalizedQuery ||
            normalizedItemName.includes(normalizedQuery) ||
            normalizedQuery.includes(normalizedItemName);

          if (isMatch) {
            const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${item.id}&l=brazilian&_t=${Date.now()}`;
            const detailsRes = await fetch(detailsUrl, { cache: "no-store" });
            const detailsData = await detailsRes.json();

            if (detailsData[item.id] && detailsData[item.id].success && detailsData[item.id].data.type === "game") {
              appId = item.id;
              break;
            }
          }
        }

        if (appId) {
          const schemaUrl = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_KEY}&appid=${appId}&l=brazilian&_t=${Date.now()}`;
          const schemaRes = await fetch(schemaUrl, { cache: "no-store" });
          const schemaData = await schemaRes.json();

          const allSchemaAchievements = schemaData?.game?.availableGameStats?.achievements;

          if (allSchemaAchievements && allSchemaAchievements.length > 0) {
            const totalGameAchievements = allSchemaAchievements.length;
            const gameName = schemaData.game.gameName || cleanQuery;

            const statsUrl = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=${appId}&key=${STEAM_KEY}&steamid=${STEAM_ID}&_t=${Date.now()}`;
            const statsRes = await fetch(statsUrl, { cache: "no-store" });
            const statsData = await statsRes.json();

            let unlockedCount = 0;
            if (statsData.playerstats && statsData.playerstats.achievements) {
              unlockedCount = statsData.playerstats.achievements.filter((ach) => ach.achieved === 1).length;
            }

            const percentage = Math.round((unlockedCount / totalGameAchievements) * 100);
            return res
              .status(200)
              .send(`🏆 Progresso na Steam em ${gameName}: ${unlockedCount} de ${totalGameAchievements} conquistas concluídas (${percentage}%)!`);
          }
        }
      }
    }

    // 2. FALLBACK RETRÔ: RETROACHIEVEMENTS
    if (RA_USER && RA_KEY) {
      const recentUrl = `https://retroachievements.org/API/API_GetUserRecentlyPlayedGames.php?z=${RA_USER}&y=${RA_KEY}&u=${RA_USER}&count=15`;
      const recentRes = await fetch(recentUrl, { cache: "no-store" });
      const recentData = await recentRes.json();

      if (Array.isArray(recentData) && recentData.length > 0) {
        let matchedGame = null;

        for (const g of recentData) {
          const normalizedRaTitle = normalizeTitle(g.Title);
          if (normalizedRaTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedRaTitle)) {
            matchedGame = g;
            break;
          }
        }

        if (!matchedGame) {
          return res.status(200).send(`🏆 ${cleanQuery}: Aguardando inicialização do jogo no emulador para sincronizar o progresso do RetroAchievements.`);
        }

        const gameId = matchedGame.GameID;
        const raGameUrl = `https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=${RA_USER}&y=${RA_KEY}&u=${RA_USER}&g=${gameId}`;
        const raGameRes = await fetch(raGameUrl, { cache: "no-store" });
        const raGameData = await raGameRes.json();

        if (raGameData && raGameData.NumAchievements > 0) {
          const total = raGameData.NumAchievements;
          const unlocked = raGameData.NumAwardedToUser || 0;
          const percentage = Math.round((unlocked / total) * 100);
          const title = raGameData.Title || matchedGame.Title;
          const consoleName = raGameData.ConsoleName ? ` (${raGameData.ConsoleName})` : "";

          return res
            .status(200)
            .send(`🏆 Progresso no RetroAchievements em ${title}${consoleName}: ${unlocked} de ${total} conquistas concluídas (${percentage}%)!`);
        }
      }
    }

    return res.status(200).send(`🏆 Não foram encontradas conquistas para ${gameQuery} na Steam nem no RetroAchievements.`);
  } catch (error) {
    return res.status(200).send("Erro ao consultar as conquistas.");
  }
}