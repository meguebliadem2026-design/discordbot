const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const ms = require('ms');

require('./keepAlive'); // ✅ IMPORTANT

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const GUILD_ID = '1474882664635957278';
const LOG_CHANNEL_ID = '1498712403213422753';

const MEMBER_ROLE = '1499045309261545803';
const MOD_COMMAND_ROLE = '1499045019133415494';

const CATEGORY_MODERATION = '1499447532164485210';
const CATEGORY_MM = '1499447622472040559';

const STAFF_ROLES = [
  '1499045019133415494',
  '1498705565453647882',
  '1499044989949444108',
];

const MM_ROLE = '1499045058392096890';

const PUBLIC_COMMANDS = new Set([
  'invites',
  'invite',
  'leaderboard',
  'rank',
  'levels',
  'stats',
]);

// ✅ FIX RENDER SAFE PATH
const DATA_DIR = path.join(process.cwd(), 'data');

const DATA_FILE = path.join(DATA_DIR, 'invites.json');
const XP_FILE = path.join(DATA_DIR, 'xp.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const WARNS_FILE = path.join(DATA_DIR, 'warns.json');
const GIVEAWAYS_FILE = path.join(DATA_DIR, 'giveaways.json');
const PANEL_FILE = path.join(DATA_DIR, 'ticket-panel.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------- DATA ----------------
let invitesData = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  : {};

let xpData = fs.existsSync(XP_FILE)
  ? JSON.parse(fs.readFileSync(XP_FILE, 'utf8'))
  : {};

let statsData = fs.existsSync(STATS_FILE)
  ? JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'))
  : {};

let warnsData = fs.existsSync(WARNS_FILE)
  ? JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'))
  : {};

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------------- BOT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.once('ready', async () => {
  console.log(`✅ Connecté: ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder().setName('invites').setDescription('Voir invites'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top invites'),
    new SlashCommandBuilder().setName('invite').setDescription('Lien invite'),
    new SlashCommandBuilder().setName('rank').setDescription('Ton level'),
    new SlashCommandBuilder().setName('levels').setDescription('Top levels'),
    new SlashCommandBuilder().setName('stats').setDescription('Stats'),
    new SlashCommandBuilder().setName('ticketpanel').setDescription('Panel tickets'),
  ];

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log('✅ Slash commands OK');
});

// ---------------- XP SIMPLE ----------------
function getLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

// ---------------- MESSAGE XP ----------------
client.on('messageCreate', (message) => {
  if (!message.guild || message.author.bot) return;

  const id = message.author.id;

  if (!xpData[id]) xpData[id] = { xp: 0, level: 0 };

  xpData[id].xp += Math.floor(Math.random() * 10) + 5;

  const newLevel = getLevel(xpData[id].xp);

  if (newLevel > xpData[id].level) {
    xpData[id].level = newLevel;

    message.channel.send(`📈 GG <@${id}> level ${newLevel}`);
  }

  save(XP_FILE, xpData);
});

// ---------------- INTERACTIONS ----------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // -------- RANK --------
  if (commandName === 'rank') {
    const user = xpData[interaction.user.id] || { xp: 0, level: 0 };

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📊 Rank')
          .addFields(
            { name: 'Level', value: String(user.level), inline: true },
            { name: 'XP', value: String(user.xp), inline: true }
          )
      ],
      flags: MessageFlags.Ephemeral
    });
  }

  // -------- INVITES SIMPLE --------
  if (commandName === 'invites') {
    const count = invitesData[interaction.user.id] || 0;

    return interaction.reply(`📊 Tu as **${count} invites**`);
  }

  // -------- LEADERBOARD --------
  if (commandName === 'leaderboard') {
    const top = Object.entries(invitesData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return interaction.reply(
      top.map((u, i) => `#${i + 1} <@${u[0]}> — ${u[1]} invites`).join('\n') || 'Aucun data'
    );
  }

  // -------- TICKET PANEL --------
  if (commandName === 'ticketpanel') {
    const embed = new EmbedBuilder()
      .setTitle('🎟️ Tickets')
      .setDescription('Utilise le menu pour ouvrir un ticket');

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket')
        .addOptions([
          { label: 'Support', value: 'support' },
          { label: 'Middleman', value: 'mm' },
        ])
    );

    return interaction.reply({ embeds: [embed], components: [menu] });
  }
});

// ---------------- KEEP ALIVE ERROR SAFE ----------------
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(TOKEN);
