module.exports = {
  siteName: "NarGift",
  siteUrl: "http://localhost:3000",
  sessionSecret: "fivegift_secret_key",
  discord: {
    clientId: "",
    clientSecret: "",
    redirectUri: "http://localhost:3000/auth/discord/callback",
    scopes: ["identify", "guilds"],
  },
  uploadsDir: "public/uploads/",
  webhookDefault: "",
  port: 3000
}; 