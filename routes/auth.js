const express = require("express");
const axios = require("axios");
const config = require("../config");
const router = express.Router();

router.get("/discord", (req, res) => {
  const redirect =
    "https://discord.com/api/oauth2/authorize?client_id=" +
    config.discord.clientId +
    "&redirect_uri=" + encodeURIComponent(config.discord.redirectUri) +
    "&response_type=code&scope=" + config.discord.scopes.join("%20");
  res.redirect(redirect);
});

router.get("/discord/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/");
  try {
    const params = new URLSearchParams();
    params.append("client_id", config.discord.clientId);
    params.append("client_secret", config.discord.clientSecret);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", config.discord.redirectUri);
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      params,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const accessToken = tokenRes.data.access_token;
    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const guildsRes = await axios.get("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    req.session.user = {
      id: userRes.data.id,
      username: userRes.data.username,
      avatar: userRes.data.avatar,
      guilds: guildsRes.data,
      accessToken,
    };
    res.redirect("/");
  } catch (e) {
    res.redirect("/");
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

module.exports = router; 