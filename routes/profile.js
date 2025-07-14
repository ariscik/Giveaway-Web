const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();

function loadGiveaways() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "../data/giveaways.json")));
}

router.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/discord");
  const giveaways = loadGiveaways();
  const userId = req.session.user.id;
  const created = giveaways.filter(g => g.creator === userId);
  const joined = giveaways.filter(g => g.entries.some(e => e.userId === userId));
  const won = giveaways.filter(g => g.winners && g.winners.some(w => w.userId === userId));
  res.render("pages/profile", {
    user: req.session.user,
    created,
    joined,
    won
  });
});

module.exports = router; 