const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const config = require("../config");
const router = express.Router();
const axios = require("axios");

const upload = multer({ dest: config.uploadsDir });

function loadGiveaways() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "../data/giveaways.json")));
}
function saveGiveaways(data) {
  fs.writeFileSync(path.join(__dirname, "../data/giveaways.json"), JSON.stringify(data, null, 2));
}

async function getGuildIdFromInvite(invite) {
  try {
    const code = invite.split("/").pop();
    const res = await fetch(`https://discord.com/api/v10/invites/${code}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.guild && data.guild.id ? data.guild.id : null;
  } catch {
    return null;
  }
}

function sendWebhook(url, content) {
  if (!url) return;
  axios.post(url, { content }).catch(() => {});
}

function autoStartGiveaways() {
  const giveaways = loadGiveaways();
  const now = new Date();
  let changed = false;
  giveaways.forEach(giveaway => {
    if (giveaway.status === "pending" && new Date(giveaway.start) <= now) {
      giveaway.status = "active";
      changed = true;
      if (giveaway.webhook) {
        let msg = `🎉 Çekiliş Başladı!\nÇekiliş: ${giveaway.title}\nBaşlangıç: ${giveaway.start}\nBitiş: ${giveaway.end}\nKatılmak için: ${config.siteUrl}/giveaway/${giveaway.id}`;
        sendWebhook(giveaway.webhook, msg);
      }
    }
  });
  if (changed) saveGiveaways(giveaways);
}

function autoEndGiveaways() {
  const giveaways = loadGiveaways();
  const now = new Date();
  let changed = false;
  giveaways.forEach(giveaway => {
    if (giveaway.status === "active" && new Date(giveaway.end) <= now) {
      const entries = [...giveaway.entries];
      const winners = [];
      let totalWinners = Math.min(giveaway.winnerCount, entries.length);
      let prizeList = [];
      giveaway.prizes.forEach(p => {
        for (let i = 0; i < p.count; i++) prizeList.push(p.name);
      });
      prizeList = prizeList.sort(() => Math.random() - 0.5);
      const shuffled = entries.sort(() => Math.random() - 0.5);
      for (let i = 0; i < totalWinners; i++) {
        winners.push({
          userId: shuffled[i].userId,
          username: shuffled[i].username,
          prize: prizeList[i] || prizeList[0] || "Ödül"
        });
      }
      giveaway.winners = winners;
      giveaway.status = "ended";
      changed = true;
      if (giveaway.webhook) {
        let msg = `🏆 Çekiliş Sona Erdi!\nÇekiliş: ${giveaway.title}\nKazananlar:`;
        winners.forEach(w => { msg += `\n- ${w.username} → ${w.prize}`; });
        sendWebhook(giveaway.webhook, msg);
      }
    }
  });
  if (changed) saveGiveaways(giveaways);
}

router.get("/create", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/discord");
  res.render("pages/create", { user: req.session.user, siteName: config.siteName });
});

router.post("/create", upload.single("banner"), async (req, res) => {
  if (!req.session.user) return res.redirect("/auth/discord");
  const giveaways = loadGiveaways();
  const id = Date.now().toString();
  const file = req.file ? "/uploads/" + path.basename(req.file.path) : "";
  const invites = Array.isArray(req.body.invites) ? req.body.invites : [req.body.invites];
  const prizes = Array.isArray(req.body.prizes) ? req.body.prizes : [req.body.prizes];
  const prizeCounts = Array.isArray(req.body.prizeCounts) ? req.body.prizeCounts : [req.body.prizeCounts];
  const prizeList = prizes.map((p, i) => ({ name: p, count: parseInt(prizeCounts[i] || 1) }));
  const inviteObjs = [];
  for (let inv of invites) {
    const guildId = await getGuildIdFromInvite(inv);
    inviteObjs.push({ invite: inv, guildId });
  }
  giveaways.push({
    id,
    title: req.body.title,
    description: req.body.description,
    banner: file,
    start: req.body.start,
    end: req.body.end,
    winnerCount: parseInt(req.body.winnerCount),
    invites: inviteObjs,
    prizes: prizeList,
    webhook: req.body.webhook,
    creator: req.session.user.id,
    createdAt: new Date().toISOString(),
    entries: [],
    winners: [],
    status: "pending"
  });
  saveGiveaways(giveaways);
  res.redirect("/");
});

router.get("/", (req, res) => {
  autoStartGiveaways();
  autoEndGiveaways();
  let giveaways = [];
  if (fs.existsSync(path.join(__dirname, "../data/giveaways.json"))) {
    giveaways = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/giveaways.json")));
  }
  res.render("pages/index", { user: req.session.user || null, giveaways });
});

router.get("/:id", (req, res) => {
  autoStartGiveaways();
  autoEndGiveaways();
  const giveaways = loadGiveaways();
  const giveaway = giveaways.find(g => g.id === req.params.id);
  if (!giveaway) return res.status(404).send("Çekiliş bulunamadı");
  let joined = false;
  let canJoin = false;
  let userGuilds = [];
  let now = new Date();
  let start = new Date(giveaway.start);
  let end = new Date(giveaway.end);
  let canJoinTime = now >= start && now <= end && giveaway.status === "active";
  if (req.session.user) {
    userGuilds = req.session.user.guilds.map(g => g.id);
    canJoin = giveaway.invites.every(inv => inv.guildId && userGuilds.includes(inv.guildId));
    joined = giveaway.entries.some(e => e.userId === req.session.user.id);
  }
  res.render("pages/detail", {
    user: req.session.user || null,
    giveaway,
    joined,
    canJoin,
    userGuilds,
    canJoinTime,
    now,
    start,
    end
  });
});

router.post("/:id/join", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/discord");
  const giveaways = loadGiveaways();
  const giveaway = giveaways.find(g => g.id === req.params.id);
  if (!giveaway) return res.status(404).send("Çekiliş bulunamadı");
  const now = new Date();
  const start = new Date(giveaway.start);
  const end = new Date(giveaway.end);
  if (now < start) return res.redirect(`/giveaway/${giveaway.id}`);
  if (now > end) return res.redirect(`/giveaway/${giveaway.id}`);
  if (giveaway.status !== "active") return res.redirect(`/giveaway/${giveaway.id}`);
  const already = giveaway.entries.some(e => e.userId === req.session.user.id);
  if (already) return res.redirect(`/giveaway/${giveaway.id}`);
  const userGuilds = req.session.user.guilds.map(g => g.id);
  const canJoin = giveaway.invites.every(inv => inv.guildId && userGuilds.includes(inv.guildId));
  if (!canJoin) return res.redirect(`/giveaway/${giveaway.id}`);
  giveaway.entries.push({ userId: req.session.user.id, username: req.session.user.username });
  saveGiveaways(giveaways);
  res.redirect(`/giveaway/${giveaway.id}`);
});

router.post("/:id/end", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/discord");
  const giveaways = loadGiveaways();
  const giveaway = giveaways.find(g => g.id === req.params.id);
  if (!giveaway) return res.status(404).send("Çekiliş bulunamadı");
  if (giveaway.creator !== req.session.user.id) return res.status(403).send("Yetkisiz işlem");
  if (giveaway.status !== "active") return res.redirect(`/giveaway/${giveaway.id}`);
  const entries = [...giveaway.entries];
  if (entries.length === 0) return res.redirect(`/giveaway/${giveaway.id}`);
  const winners = [];
  let totalWinners = Math.min(giveaway.winnerCount, entries.length);
  let prizeList = [];
  giveaway.prizes.forEach(p => {
    for (let i = 0; i < p.count; i++) prizeList.push(p.name);
  });
  prizeList = prizeList.sort(() => Math.random() - 0.5);
  const shuffled = entries.sort(() => Math.random() - 0.5);
  for (let i = 0; i < totalWinners; i++) {
    winners.push({
      userId: shuffled[i].userId,
      username: shuffled[i].username,
      prize: prizeList[i] || prizeList[0] || "Ödül"
    });
  }
  giveaway.winners = winners;
  giveaway.status = "ended";
  saveGiveaways(giveaways);
  res.redirect(`/giveaway/${giveaway.id}`);
});

module.exports = router; 