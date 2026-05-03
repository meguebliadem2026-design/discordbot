const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');

const GUILD_ID = '1474882664635957278';
const MEMBER_ROLE = '1499045309261545803';
const MOD_COMMAND_ROLE = '1499045019133415494';
const PUBLIC_COMMANDS = new Set(['invites', 'invite', 'leaderboard', 'rank', 'levels', 'stats']);
const CATEGORY_MODERATION = '1499447532164485210';
const CATEGORY_MM = '1499447622472040559';
const STAFF_ROLES = [
  '1499045019133415494',
  '1498705565453647882',
  '1499044989949444108',
];
const MM_ROLE = '1499045058392096890';

const TICKET_TYPES = [
  { label: 'Support', value: 'support', emoji: '🛠️' },
  { label: 'Réclamation Giveway', value: 'giveway', emoji: '🎁' },
  { label: 'Recrutement', value: 'recrutement', emoji: '📋' },
  { label: 'Service Inde', value: 'service', emoji: '💼' },
  { label: 'Middle Man', value: 'middleman', emoji: '🤝' },
];

function buildTicketPanel() {
  const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🎟️ Système de Tickets')
    .setDescription(
      'Besoin d\'aide ou d\'un service ? **Ouvre un ticket** en sélectionnant une catégorie ci-dessous.\n\n' +
        '> 🛠️ **Support** — Aide générale\n' +
        '> 🎁 **Réclamation Giveway** — Réclamer un lot\n' +
        '> 📋 **Recrutement** — Postuler au staff\n' +
        '> 💼 **Service Inde** — Demande de prestation\n' +
        '> 🤝 **Middle Man** — Sécuriser un échange\n\n' +
        '_Un salon privé sera créé avec le staff concerné._',
    )
    .setFooter({ text: 'Merci d\'utiliser un seul ticket à la fois 💗' });

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_menu')
      .setPlaceholder('🎟️ Choisis un type de ticket')
      .addOptions(TICKET_TYPES),
  );

  return { embeds: [embed], components: [menu] };
}

const fs = require('fs');
const path = require('path');
const ms = require('ms');
require('./keepAlive');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const TICKET_PANEL_CHANNEL_ID = process.env.TICKET_PANEL_CHANNEL_ID;
const LEVEL_CHANNEL_ID = process.env.LEVEL_CHANNEL_ID;
const LOG_CHANNEL_ID = '1498712403213422753';

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN environment variable.');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('Missing DISCORD_CLIENT_ID environment variable.');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'invites.json');
const PANEL_FILE = path.join(DATA_DIR, 'ticket-panel.json');
const XP_FILE = path.join(DATA_DIR, 'xp.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const WARNS_FILE = path.join(DATA_DIR, 'warns.json');
const GIVEAWAYS_FILE = path.join(DATA_DIR, 'giveaways.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let invitesData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    invitesData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to parse invites.json, starting fresh.', err);
    invitesData = {};
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(invitesData, null, 2));
}

let xpData = {};
if (fs.existsSync(XP_FILE)) {
  try {
    xpData = JSON.parse(fs.readFileSync(XP_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to parse xp.json, starting fresh.', err);
    xpData = {};
  }
}

let xpSaveTimer = null;
function saveXp() {
  if (xpSaveTimer) return;
  xpSaveTimer = setTimeout(() => {
    fs.writeFileSync(XP_FILE, JSON.stringify(xpData, null, 2));
    xpSaveTimer = null;
  }, 5000);
}

function getLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

function randomXP() {
  return Math.floor(Math.random() * 11) + 5;
}

const xpCooldown = new Map();

// Stats (messages + voice)
let statsData = {};
if (fs.existsSync(STATS_FILE)) {
  try {
    statsData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch {
    statsData = {};
  }
}

let statsSaveTimer = null;
function saveStats() {
  if (statsSaveTimer) return;
  statsSaveTimer = setTimeout(() => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(statsData, null, 2));
    statsSaveTimer = null;
  }, 5000);
}

function ensureStats(id) {
  if (!statsData[id]) statsData[id] = { messages: 0, voice: 0 };
}

// Warns
let warnsData = {};
if (fs.existsSync(WARNS_FILE)) {
  try {
    warnsData = JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
  } catch {
    warnsData = {};
  }
}

function saveWarns() {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(warnsData, null, 2));
}

function sendModLog(guild, embed) {
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;
  logChannel.send({ embeds: [embed] }).catch(() => {});
}

// Giveaways
const giveaways = new Map();

function saveGiveaways() {
  const obj = {};
  for (const [id, data] of giveaways) obj[id] = data;
  fs.writeFileSync(GIVEAWAYS_FILE, JSON.stringify(obj, null, 2));
}

async function endGiveaway(messageId, clientRef) {
  const data = giveaways.get(messageId);
  if (!data) return;

  giveaways.delete(messageId);
  saveGiveaways();

  try {
    const guild = await clientRef.guilds.fetch(data.guildId);
    const channel = await guild.channels.fetch(data.channelId);
    const msg = await channel.messages.fetch(messageId);

    const reaction = msg.reactions.cache.get('🎉');
    const allUsers = reaction
      ? (await reaction.users.fetch()).filter((u) => !u.bot).map((u) => u.id)
      : [];

    if (allUsers.length === 0) {
      await channel.send({ embeds: [new EmbedBuilder().setColor('Red').setTitle('🎁 Giveaway terminé').setDescription('❌ Aucun participant — pas de gagnant.')] });
      return;
    }

    const pool = [...allUsers];
    const winners = [];
    const count = Math.min(data.winners, pool.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(idx, 1)[0]);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle('🎉 Giveaway terminé !')
      .addFields(
        { name: '🏆 Prix', value: data.prize },
        { name: '🥇 Gagnant(s)', value: winners.map((w) => `<@${w}>`).join(', ') },
      )
      .setTimestamp();

    await channel.send({ content: winners.map((w) => `<@${w}>`).join(' '), embeds: [embed] });
  } catch (err) {
    console.error('[GIVEAWAY] Erreur fin:', err.message);
  }
}

const voiceTimes = new Map();

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

client.invites = new Collection();

client.once('ready', async () => {
  console.log(`${client.user.tag} est en ligne`);

  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      client.invites.set(guild.id, invites);
    } catch (err) {
      console.error(`Impossible de récupérer les invites pour ${guild.name}:`, err.message);
    }
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('invites')
      .setDescription("Voir le nombre d'invites")
      .addUserOption((option) =>
        option.setName('user').setDescription('Utilisateur').setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Top invites'),
    new SlashCommandBuilder()
      .setName('resetinviteall')
      .setDescription('Réinitialise toutes les invites'),
    new SlashCommandBuilder()
      .setName('resetinvite')
      .setDescription("Réinitialise les invites d'un utilisateur")
      .addUserOption((option) =>
        option.setName('user').setDescription('Utilisateur').setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName('invite')
      .setDescription('Génère ton lien d\'invitation personnel (traqué)'),
    new SlashCommandBuilder()
      .setName('ticketpanel')
      .setDescription('Affiche le menu d\'ouverture de tickets'),
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Voir ton niveau et ton XP'),
    new SlashCommandBuilder()
      .setName('levels')
      .setDescription('Top 10 des niveaux'),
    new SlashCommandBuilder()
      .setName('reglement')
      .setDescription('Envoie le règlement officiel du serveur'),
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription("Voir les stats d'un utilisateur (messages & vocal)")
      .addUserOption((option) =>
        option.setName('user').setDescription('Utilisateur').setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName('resetstats')
      .setDescription("Réinitialise les stats d'un utilisateur")
      .addUserOption((option) =>
        option.setName('user').setDescription('Utilisateur').setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Avertir un utilisateur')
      .addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison').setRequired(true)),
    new SlashCommandBuilder()
      .setName('unwarn')
      .setDescription("Enlever tous les warns d'un utilisateur")
      .addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true)),
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription("Voir les warns d'un utilisateur")
      .addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true)),
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Mute un utilisateur (timeout)')
      .addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true))
      .addStringOption((o) => o.setName('temps').setDescription('Durée (ex: 10m, 1h, 1d)').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison').setRequired(true)),
    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Unmute un utilisateur')
      .addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true)),
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban un utilisateur')
      .addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison').setRequired(true)),
    new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Déban un utilisateur par son ID')
      .addStringOption((o) => o.setName('id').setDescription('ID Discord').setRequired(true)),
    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Système de giveaway')
      .addSubcommand((s) =>
        s.setName('create')
          .setDescription('Créer un giveaway')
          .addStringOption((o) => o.setName('prix').setDescription('Prix à gagner').setRequired(true))
          .addStringOption((o) => o.setName('temps').setDescription('Durée (ex: 10m, 1h, 7d)').setRequired(true))
          .addIntegerOption((o) => o.setName('winners').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1)),
      )
      .addSubcommand((s) =>
        s.setName('end')
          .setDescription('Terminer un giveaway maintenant')
          .addStringOption((o) => o.setName('id').setDescription('ID du message giveaway').setRequired(true)),
      )
      .addSubcommand((s) =>
        s.setName('reroll')
          .setDescription('Retirer un nouveau gagnant')
          .addStringOption((o) => o.setName('id').setDescription('ID du message giveaway').setRequired(true)),
      ),
  ];

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Slash commands enregistrées');
  } catch (err) {
    console.error("Échec de l'enregistrement des slash commands:", err);
  }

  if (TICKET_PANEL_CHANNEL_ID) {
    let alreadySent = null;
    if (fs.existsSync(PANEL_FILE)) {
      try {
        alreadySent = JSON.parse(fs.readFileSync(PANEL_FILE, 'utf8'));
      } catch {
        alreadySent = null;
      }
    }

    if (alreadySent?.channelId === TICKET_PANEL_CHANNEL_ID && alreadySent?.messageId) {
      console.log(`[PANEL] Déjà envoyé dans ${TICKET_PANEL_CHANNEL_ID} (msg ${alreadySent.messageId})`);
    } else {
      try {
        const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
        const msg = await channel.send(buildTicketPanel());
        fs.writeFileSync(
          PANEL_FILE,
          JSON.stringify({ channelId: TICKET_PANEL_CHANNEL_ID, messageId: msg.id }, null, 2),
        );
        console.log(`[PANEL] Envoyé dans ${TICKET_PANEL_CHANNEL_ID} (msg ${msg.id})`);
      } catch (err) {
        console.error('[PANEL] Échec envoi:', err.message);
      }
    }
  }

  // Restaurer les giveaways actifs après redémarrage
  if (fs.existsSync(GIVEAWAYS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(GIVEAWAYS_FILE, 'utf8'));
      for (const [id, data] of Object.entries(saved)) {
        const remaining = data.endTime - Date.now();
        if (remaining <= 0) {
          // Déjà expiré, terminer immédiatement
          giveaways.set(id, data);
          endGiveaway(id, client);
        } else {
          giveaways.set(id, data);
          setTimeout(() => endGiveaway(id, client), remaining);
          console.log(`[GIVEAWAY] Restauré : ${id} (dans ${Math.round(remaining / 1000)}s)`);
        }
      }
    } catch (err) {
      console.error('[GIVEAWAY] Erreur restauration:', err.message);
    }
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.member?.id || oldState.member?.id;
  if (!userId) return;

  if (!oldState.channelId && newState.channelId) {
    voiceTimes.set(userId, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    const joinTime = voiceTimes.get(userId);
    if (!joinTime) return;
    const spent = Date.now() - joinTime;
    voiceTimes.delete(userId);
    ensureStats(userId);
    statsData[userId].voice += spent;
    saveStats();
  }
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const id = message.author.id;

  // Compter le message
  ensureStats(id);
  statsData[id].messages++;
  saveStats();

  const now = Date.now();
  const last = xpCooldown.get(id) || 0;
  if (now - last < 5_000) return;
  xpCooldown.set(id, now);

  if (!xpData[id]) xpData[id] = { xp: 0, level: 0 };
  const user = xpData[id];
  user.xp += randomXP();

  const newLevel = getLevel(user.xp);
  if (newLevel > user.level) {
    user.level = newLevel;

    const channel = LEVEL_CHANNEL_ID
      ? message.guild.channels.cache.get(LEVEL_CHANNEL_ID)
      : message.channel;

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle('📈 Level Up !')
      .setDescription(`GG <@${id}> tu viens de monter d'un lvl ! 🎉`)
      .addFields(
        { name: 'Level', value: `${user.level}`, inline: true },
        { name: 'XP total', value: `${user.xp}`, inline: true },
      )
      .setThumbnail(message.author.displayAvatarURL());

    if (channel) {
      try {
        await channel.send({ content: `<@${id}>`, embeds: [embed] });
      } catch (err) {
        console.error('[XP] Échec envoi level up:', err.message);
      }
    }
  }

  saveXp();
});

client.on('guildMemberAdd', async (member) => {
  console.log(`[JOIN] ${member.user.tag} a rejoint ${member.guild.name}`);

  let inviterId = null;
  let inviterTag = null;

  try {
    const newInvites = await member.guild.invites.fetch();
    const oldInvites = client.invites.get(member.guild.id);

    if (!oldInvites) {
      console.log(`[JOIN] Pas d'ancien cache d'invites pour ${member.guild.name}.`);
    }

    const inviteUsed = newInvites.find(
      (inv) => (oldInvites?.get(inv.code)?.uses ?? 0) < inv.uses,
    );

    client.invites.set(member.guild.id, newInvites);

    if (inviteUsed?.inviter) {
      inviterId = inviteUsed.inviter.id;
      inviterTag = inviteUsed.inviter.username;
      console.log(`[JOIN] ${member.user.tag} invité par ${inviteUsed.inviter.tag} (lien ${inviteUsed.code})`);

      if (!invitesData[inviterId]) invitesData[inviterId] = 0;
      invitesData[inviterId]++;
      saveData();
    } else if (!inviteUsed) {
      console.log(`[JOIN] Aucun lien détecté (vanity URL, ajout direct, ou cache désynchronisé).`);
    } else {
      console.log(`[JOIN] Lien ${inviteUsed.code} utilisé mais sans inviteur connu.`);
    }
  } catch (err) {
    console.error('Erreur tracking invite:', err);
  }

  if (!WELCOME_CHANNEL_ID) return;
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) {
    console.log(`[WELCOME] Salon ${WELCOME_CHANNEL_ID} introuvable dans ${member.guild.name}`);
    return;
  }

  try {
    if (inviterId) {
      await channel.send(`👤 **${member.user.username}** a été invité par **${inviterTag}**`);
    } else {
      await channel.send(`👤 **${member.user.username}** a rejoint (inviteur inconnu)`);
    }
  } catch (err) {
    console.error('[WELCOME] Échec envoi message bienvenue:', err.message);
  }
});

client.on('interactionCreate', async (interaction) => {
  // Vérification du rôle modération pour toutes les commandes non-publiques
  if (interaction.isChatInputCommand() && !PUBLIC_COMMANDS.has(interaction.commandName)) {
    const hasRole = interaction.member?.roles?.cache?.has(MOD_COMMAND_ROLE);
    if (!hasRole) {
      await interaction.reply({
        content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ticketpanel') {
    await interaction.channel.send(buildTicketPanel());
    await interaction.reply({ content: '✅ Panel envoyé.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
    if (!interaction.member.roles.cache.has(MEMBER_ROLE)) {
      await interaction.reply({ content: "❌ Tu n'as pas la permission.", flags: MessageFlags.Ephemeral });
      return;
    }

    const choice = interaction.values[0];
    let category = CATEGORY_MODERATION;
    let staffPing = STAFF_ROLES;

    if (choice === 'middleman') {
      category = CATEGORY_MM;
      staffPing = [MM_ROLE];
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
            ],
          },
          ...staffPing.map((r) => ({
            id: r,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
            ],
          })),
        ],
      });

      const mention = staffPing.map((r) => `<@&${r}>`).join(' ');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('claim')
          .setLabel('📌 Claim')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('close')
          .setLabel('❌ Close')
          .setStyle(ButtonStyle.Danger),
      );

      await channel.send({
        content: `${mention} | Ticket ouvert par ${interaction.user} (type: **${choice}**)`,
        components: [row],
      });

      await interaction.reply({ content: `✅ Ticket créé : ${channel}`, flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('[TICKET] Échec création:', err);
      await interaction.reply({
        content: "❌ Impossible de créer le ticket. Vérifie que j'ai la permission `Gérer les salons` et l'accès aux catégories.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === 'claim') {
    if (!interaction.member.roles.cache.some((r) => STAFF_ROLES.includes(r.id) || r.id === MM_ROLE)) {
      await interaction.reply({ content: '❌ Staff only', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(`📌 Ticket pris par ${interaction.user}`);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'close') {
    if (!interaction.member.roles.cache.some((r) => STAFF_ROLES.includes(r.id) || r.id === MM_ROLE)) {
      await interaction.reply({ content: '❌ Staff only', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply('❌ Fermeture du ticket dans 3s...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'invites') {
    const user = interaction.options.getUser('user') || interaction.user;
    const count = invitesData[user.id] || 0;

    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('📊 Invites')
      .setDescription(`${user} a **${count} invites**`);

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'invite') {
    const channel = interaction.channel;
    if (!channel || typeof channel.createInvite !== 'function') {
      await interaction.reply({
        content: "❌ Cette commande doit être utilisée dans un salon où je peux créer des invitations.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const invite = await channel.createInvite({
        maxAge: 0,
        maxUses: 0,
        unique: true,
        reason: `Lien personnel pour ${interaction.user.tag}`,
      });

      const newInvites = await interaction.guild.invites.fetch();
      client.invites.set(interaction.guild.id, newInvites);

      const embed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle('🔗 Ton lien d\'invitation')
        .setDescription(
          `Voici ton lien personnel : ${invite.url}\n\nChaque membre qui rejoindra avec ce lien sera compté comme ton invité.`,
        );

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error("Échec de création de l'invitation:", err);
      await interaction.reply({
        content: "❌ Impossible de créer l'invitation. Vérifie que j'ai la permission `Créer une invitation` dans ce salon.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (interaction.commandName === 'resetinvite') {
    const user = interaction.options.getUser('user', true);
    const previous = invitesData[user.id] || 0;
    delete invitesData[user.id];
    saveData();

    const embed = new EmbedBuilder()
      .setColor('Orange')
      .setTitle('🧹 Invites réinitialisées')
      .setDescription(`Les invites de ${user} ont été remises à zéro (avant : **${previous}**).`);

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === 'resetinviteall') {
    invitesData = {};
    saveData();

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('🧹 Invites réinitialisées')
      .setDescription('Toutes les invites ont été remises à zéro.');

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === 'leaderboard') {
    const sorted = Object.entries(invitesData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let desc = '';
    sorted.forEach((data, index) => {
      desc += `**${index + 1}.** <@${data[0]}> — ${data[1]} invites\n`;
    });

    const embed = new EmbedBuilder()
      .setColor('Gold')
      .setTitle('🏆 Leaderboard')
      .setDescription(desc || 'Aucune donnée');

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === 'rank') {
    const id = interaction.user.id;
    const user = xpData[id] || { xp: 0, level: 0 };

    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('📊 Ton Rank')
      .addFields(
        { name: 'Level', value: `${user.level}`, inline: true },
        { name: 'XP', value: `${user.xp}`, inline: true },
      )
      .setThumbnail(interaction.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.commandName === 'reglement') {
    const channel = interaction.guild.channels.cache.get('1498711996684570634');
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('📜 Règlement Officiel du Serveur ! ⚠️')
      .setDescription(
        `**RÈGLES DES SALONS**

🚫 Pas de hors-sujet (utiliser le bon canal selon sa description)
😂 Pas d'abus de mèmes/gifs
📢 Pas de publicité
💬 Pas de spamming
📛 Pas de spam de mentions
❌ Pas de langage offensant
🔞 Pas de contenu NSFW / pornographie
🚫 Pas de contenu illégal ou piratage
🔒 Pas de doxxing (infos personnelles interdites)
⚠️ Pas de harcèlement / insultes / racisme / sexisme
🗳️ Pas de politique ou religion
⚧️ Pas de débats sur genre / sexualité
😵 Pas d'abus d'emojis ou majuscules

⚖️ Après 3 avertissements → expulsion puis bannissement

👮 Les modérateurs peuvent modifier ou supprimer tout message.

---

**RÈGLES DU SERVEUR**

🚫 Pas de pseudos inappropriés
🚫 Pas de caractères illisibles
🚫 Pas de pseudo vide
🚫 Pas de photo de profil inappropriée
🚫 Pas de bugs / exploits / hacks
🔁 Pas de double compte
📩 Les règles s'appliquent aussi en DM

👑 Usurpation du staff STRICTEMENT interdite
⚖️ Les modérateurs peuvent juger sans suivre les règles strictement

---

💗 En cas de question ouvre un 🎫 ticket`,
      )
      .setFooter({ text: 'Respecte les règles pour garder le serveur safe 💗' });

    if (!channel) {
      await interaction.reply({
        content: '❌ Salon du règlement introuvable.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await channel.send({
        content: '@everyone 📢',
        embeds: [embed],
        allowedMentions: { parse: ['everyone'] },
      });
      await interaction.reply({ content: '✅ Règlement envoyé !', flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('[REGLEMENT] Échec envoi:', err.message);
      await interaction.reply({
        content: "❌ Impossible d'envoyer le règlement. Vérifie que j'ai la permission d'envoyer des messages et de mentionner @everyone dans ce salon.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (interaction.commandName === 'levels') {
    const lb = Object.entries(xpData)
      .map(([id, u]) => ({ id, xp: u.xp, level: u.level }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor('Gold')
      .setTitle('🏆 Top niveaux')
      .setDescription(
        lb.length
          ? lb
              .map((u, i) => `**${i + 1}.** <@${u.id}> — lvl **${u.level}** | XP **${u.xp}**`)
              .join('\n')
          : 'Aucune donnée',
      );

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === 'stats') {
    const target = interaction.options.getUser('user') || interaction.user;
    const s = statsData[target.id] || { messages: 0, voice: 0 };
    const minutes = Math.floor(s.voice / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const voiceStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`📊 Stats de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '💬 Messages', value: `${s.messages}`, inline: true },
        { name: '🎤 Temps vocal', value: voiceStr, inline: true },
      )
      .setFooter({ text: 'Stats depuis le lancement du bot' });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === 'resetstats') {
    const target = interaction.options.getUser('user', true);
    delete statsData[target.id];
    saveStats();

    const embed = new EmbedBuilder()
      .setColor('Orange')
      .setTitle('🧹 Stats réinitialisées')
      .setDescription(`Les stats de ${target} ont été remises à zéro.`);

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ─── MODÉRATION ────────────────────────────────────────

  if (interaction.commandName === 'warn') {
    const target = interaction.options.getUser('user', true);
    const raison = interaction.options.getString('raison', true);

    if (!warnsData[target.id]) warnsData[target.id] = [];
    warnsData[target.id].push({ raison, mod: interaction.user.tag, date: new Date().toISOString() });
    saveWarns();

    const total = warnsData[target.id].length;

    target.send(`⚠️ Tu as reçu un avertissement sur **${interaction.guild.name}**\nRaison : ${raison}`).catch(() => {});

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('⚠️ Avertissement')
          .setDescription(`${target} a été averti.`)
          .addFields({ name: 'Raison', value: raison }, { name: 'Total warns', value: `${total}` })
          .setTimestamp(),
      ],
    });

    sendModLog(interaction.guild,
      new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('⚠️ WARN')
        .addFields(
          { name: 'Utilisateur', value: `${target.tag} (${target.id})` },
          { name: 'Modérateur', value: interaction.user.tag },
          { name: 'Raison', value: raison },
          { name: 'Total warns', value: `${total}` },
        )
        .setTimestamp(),
    );
    return;
  }

  if (interaction.commandName === 'unwarn') {
    const target = interaction.options.getUser('user', true);
    const before = (warnsData[target.id] || []).length;
    delete warnsData[target.id];
    saveWarns();

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('Green')
          .setTitle('🔄 Warns supprimés')
          .setDescription(`Les **${before} warn(s)** de ${target} ont été supprimés.`)
          .setTimestamp(),
      ],
    });

    sendModLog(interaction.guild,
      new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle('🔄 UNWARN')
        .addFields(
          { name: 'Utilisateur', value: `${target.tag}` },
          { name: 'Modérateur', value: interaction.user.tag },
        )
        .setTimestamp(),
    );
    return;
  }

  if (interaction.commandName === 'warnings') {
    const target = interaction.options.getUser('user', true);
    const list = warnsData[target.id] || [];

    const embed = new EmbedBuilder()
      .setColor('Orange')
      .setTitle(`📋 Warns de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    if (list.length === 0) {
      embed.setDescription('Aucun avertissement.');
    } else {
      embed.setDescription(
        list.map((w, i) => `**${i + 1}.** ${w.raison} — par *${w.mod}*`).join('\n'),
      );
    }

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === 'mute') {
    const target = interaction.options.getUser('user', true);
    const temps = interaction.options.getString('temps', true);
    const raison = interaction.options.getString('raison', true);

    const duration = ms(temps);
    if (!duration || duration <= 0) {
      await interaction.reply({ content: '❌ Durée invalide. Exemples : `10m`, `1h`, `7d`', flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const memberTarget = await interaction.guild.members.fetch(target.id);
      await memberTarget.timeout(duration, raison);

      target.send(`🔇 Tu as été mute sur **${interaction.guild.name}** pendant **${temps}**\nRaison : ${raison}`).catch(() => {});

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('🔇 Mute')
            .setDescription(`${target} a été mute pendant **${temps}**.`)
            .addFields({ name: 'Raison', value: raison })
            .setTimestamp(),
        ],
      });

      sendModLog(interaction.guild,
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🔇 MUTE')
          .addFields(
            { name: 'Utilisateur', value: `${target.tag}` },
            { name: 'Durée', value: temps },
            { name: 'Raison', value: raison },
            { name: 'Modérateur', value: interaction.user.tag },
          )
          .setTimestamp(),
      );
    } catch (err) {
      await interaction.reply({ content: `❌ Impossible de muter : ${err.message}`, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (interaction.commandName === 'unmute') {
    const target = interaction.options.getUser('user', true);

    try {
      const memberTarget = await interaction.guild.members.fetch(target.id);
      await memberTarget.timeout(null);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Green')
            .setTitle('🔊 Unmute')
            .setDescription(`${target} n'est plus muté.`)
            .setTimestamp(),
        ],
      });

      sendModLog(interaction.guild,
        new EmbedBuilder()
          .setColor(0x00ff99)
          .setTitle('🔊 UNMUTE')
          .addFields(
            { name: 'Utilisateur', value: `${target.tag}` },
            { name: 'Modérateur', value: interaction.user.tag },
          )
          .setTimestamp(),
      );
    } catch (err) {
      await interaction.reply({ content: `❌ Impossible d'unmuter : ${err.message}`, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (interaction.commandName === 'ban') {
    const target = interaction.options.getUser('user', true);
    const raison = interaction.options.getString('raison', true);

    try {
      const memberTarget = await interaction.guild.members.fetch(target.id);
      await memberTarget.ban({ reason: raison });

      target.send(`⛔ Tu as été banni de **${interaction.guild.name}**\nRaison : ${raison}`).catch(() => {});

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('⛔ Ban')
            .setDescription(`${target} a été banni.`)
            .addFields({ name: 'Raison', value: raison })
            .setTimestamp(),
        ],
      });

      sendModLog(interaction.guild,
        new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('⛔ BAN')
          .addFields(
            { name: 'Utilisateur', value: `${target.tag} (${target.id})` },
            { name: 'Raison', value: raison },
            { name: 'Modérateur', value: interaction.user.tag },
          )
          .setTimestamp(),
      );
    } catch (err) {
      await interaction.reply({ content: `❌ Impossible de ban : ${err.message}`, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (interaction.commandName === 'unban') {
    const id = interaction.options.getString('id', true);

    try {
      await interaction.guild.members.unban(id);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Green')
            .setTitle('🔓 Unban')
            .setDescription(`L'utilisateur \`${id}\` a été débanni.`)
            .setTimestamp(),
        ],
      });

      sendModLog(interaction.guild,
        new EmbedBuilder()
          .setColor(0x00ff99)
          .setTitle('🔓 UNBAN')
          .addFields(
            { name: 'User ID', value: id },
            { name: 'Modérateur', value: interaction.user.tag },
          )
          .setTimestamp(),
      );
    } catch (err) {
      await interaction.reply({ content: `❌ Impossible de débannir : ${err.message}`, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // ─── GIVEAWAY ────────────────────────────────────────

  if (interaction.commandName === 'giveaway') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const prize = interaction.options.getString('prix', true);
      const tempsStr = interaction.options.getString('temps', true);
      const winnersCount = interaction.options.getInteger('winners', true);
      const duration = ms(tempsStr);

      if (!duration || duration <= 0) {
        await interaction.reply({ content: '❌ Durée invalide. Exemples : `10m`, `1h`, `7d`', flags: MessageFlags.Ephemeral });
        return;
      }

      const endTime = Date.now() + duration;

      const embed = new EmbedBuilder()
        .setColor(0xffc300)
        .setTitle('🎁 GIVEAWAY')
        .addFields(
          { name: '🏆 Prix', value: prize },
          { name: '👑 Gagnant(s)', value: `${winnersCount}` },
          { name: '👤 Créé par', value: interaction.user.tag },
          { name: '⏰ Fin', value: `<t:${Math.floor(endTime / 1000)}:R>` },
        )
        .setFooter({ text: 'Réagis 🎉 pour participer !' })
        .setTimestamp(endTime);

      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      await msg.react('🎉');

      giveaways.set(msg.id, {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        prize,
        winners: winnersCount,
        endTime,
      });
      saveGiveaways();

      setTimeout(() => endGiveaway(msg.id, client), duration);
      return;
    }

    if (sub === 'end') {
      const id = interaction.options.getString('id', true);
      if (!giveaways.has(id)) {
        await interaction.reply({ content: '❌ Giveaway introuvable.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ content: '✅ Giveaway terminé !', flags: MessageFlags.Ephemeral });
      await endGiveaway(id, client);
      return;
    }

    if (sub === 'reroll') {
      const id = interaction.options.getString('id', true);

      try {
        const channel = interaction.channel;
        const msg = await channel.messages.fetch(id);
        const reaction = msg.reactions.cache.get('🎉');
        const allUsers = reaction
          ? (await reaction.users.fetch()).filter((u) => !u.bot).map((u) => u.id)
          : [];

        if (allUsers.length === 0) {
          await interaction.reply({ content: '❌ Aucun participant.', flags: MessageFlags.Ephemeral });
          return;
        }

        const winner = allUsers[Math.floor(Math.random() * allUsers.length)];
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xffc300)
              .setTitle('🔁 Reroll !')
              .setDescription(`Nouveau gagnant : <@${winner}> 🎉`)
              .setTimestamp(),
          ],
        });
      } catch (err) {
        await interaction.reply({ content: `❌ Erreur : ${err.message}`, flags: MessageFlags.Ephemeral });
      }
      return;
    }
  }
});

client.on('error', (err) => {
  console.error('[Client error]', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

client.login(TOKEN);
