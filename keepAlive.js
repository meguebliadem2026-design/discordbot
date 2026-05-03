const express = require("express");
const app = express();

// Route principale (keep alive)
app.get("/", (req, res) => {
  res.status(200).send("Bot is alive ✅");
});

// Port Render / Replit / local
const PORT = process.env.PORT || 3000;

// Lancement du serveur
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur actif sur le port ${PORT}`);
});
