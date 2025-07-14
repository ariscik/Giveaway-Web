const express = require("express");
const session = require("express-session");
const path = require("path");
const config = require("./config");
const authRoutes = require("./routes/auth");
const giveawayRoutes = require("./routes/giveaway");
const profileRoutes = require("./routes/profile");
const fs = require("fs");
const giveawaysPath = require("path").join(__dirname, "data/giveaways.json");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false
}));

app.locals.siteName = config.siteName;

app.use("/auth", authRoutes);
app.use("/giveaway", giveawayRoutes);
app.use("/profile", profileRoutes);

app.get("/", (req, res) => {
  let giveaways = [];
  if (fs.existsSync(giveawaysPath)) {
    giveaways = JSON.parse(fs.readFileSync(giveawaysPath));
  }
  res.render("pages/index", { user: req.session.user || null, giveaways });
});

app.listen(config.port, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${config.port}`);
}); 