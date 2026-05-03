const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  MessageFlags,
} = require('discord.js');

const fs = require('fs');
const path = require('path');
require('./keepAlive');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN) {
  console.error("❌ TOKEN manquant");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID manquant");
  process.exit(1);
}

const GUILD_ID = '1474882664635957278';

// 📁 SAFE PATH
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const XP_FILE = path.join(DATA_DIR, 'xp.json');
const INVITES_FILE = path.join(DATA_DIR, 'invites.json');

let xpData = fs.existsSync(XP_FILE)
  ? JSON.parse(fs.readFileSync(XP_FILE))
  : {};

let invitesData = fs.existsSync(INVITES_FILE)
  ? JSON.parse(fs.readFileSync(INVITES_FILE))
  : {};

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------------- BOT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  console.log(`✅ Connecté: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('rank').setDescription('Ton level'),
    new SlashCommandBuilder().setName('invites').setDescription('Tes invites'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top invites'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash commands OK");
});

// ---------------- XP ----------------
function getLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

client.on('messageCreate', (message) => {
  if (!message.guild || message.author.bot) return;

  const id = message.author.id;

  if (!xpData[id]) xpData[id] = { xp: 0, level: 0 };

  xpData[id].xp += Math.floor(Math.random() * 10) + 5;

  const newLevel = getLevel(xpData[id].xp);

  if (newLevel > xpData[id].level) {
    xpData[id].level = newLevel;

    const channel = message.guild.channels.cache.get("1499439112552317133");

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("📈 Level Up !")
      .setDescription(`GG <@${id}> tu viens de passer level **${newLevel}** 🎉`)
      .addFields(
        { name: "Level", value: `${newLevel}`, inline: true },
        { name: "XP", value: `${xpData[id].xp}`, inline: true }
      )
      .setThumbnail(message.author.displayAvatarURL());

    if (channel) {
      channel.send({ content: `<@${id}>`, embeds: [embed] });
    } else {
      message.channel.send("❌ Salon level introuvable");
    }
  }

  save(XP_FILE, xpData);
});

// ---------------- COMMANDS ----------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'rank') {
    const data = xpData[interaction.user.id] || { xp: 0, level: 0 };

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📊 Rank')
          .addFields(
            { name: 'Level', value: String(data.level), inline: true },
            { name: 'XP', value: String(data.xp), inline: true }
          )
      ],
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === 'invites') {
    const count = invitesData[interaction.user.id] || 0;
    return interaction.reply(`📊 Tu as **${count} invites**`);
  }

  if (interaction.commandName === 'leaderboard') {
    const top = Object.entries(invitesData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return interaction.reply(
      top.length
        ? top.map((u, i) => `#${i + 1} <@${u[0]}> — ${u[1]} invites`).join('\n')
        : "Aucune donnée"
    );
  }
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(TOKEN);
