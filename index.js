// Require the necessary discord.js classes
const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');
const { MessageEmbed } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const SQLite = require("better-sqlite3");
const sql = new SQLite("./funnies.sqlite");

const prefix = "+";

// When the client is ready, run this code (only once)
client.once('ready', () => {
    // Check if the sql table exists.
    const table = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name ='funnies';").get();
    if (!table['count(*)']) {
        // If the table isn't there, create it and setup the database correctly.
        sql.prepare("CREATE TABLE funnies (id TEXT PRIMARY KEY, user TEXT, guild TEXT, funnies INTEGER);").run();
        // Ensure that the "id" row is always unique and indexed.
        sql.prepare("CREATE UNIQUE INDEX idx_funnies_id ON funnies (id);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    //statements to get and set the score data.
    client.getScore = sql.prepare("SELECT * FROM funnies WHERE user = ? AND guild = ?");
    client.setScore = sql.prepare("INSERT OR REPLACE INTO funnies (id, user, guild, funnies) VALUES (@id, @user, @guild, @funnies);");


    client.user.setActivity("for Funnies", {type:"WATCHING"});
    console.log('Funnies are being Watched');
});

client.on("messageCreate", (message) => {
    // Exit and stop if it's not there
    if (!message.content.startsWith(prefix)) return;

    //----------------------------------------LEADERBOARD
    getLeaderboard(message);

    //check if user is mentioned
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Please @ Someone');

    const userID = user.id;
    const guildID= message.guild.id;

    //score initialization (?)
    let score = client.getScore.get(userID, guildID);

    if (!score) {
        score = {
            id: `${guildID}-${userID}`,
            user: userID,
            guild: guildID,
            funnies: 0,
            }
        }

    //command start - if/else being used because its only 4 commands so far
    //----------------------------------------------------ADD FUNNY
    giveFunny(message, score, user)

    //----------------------------------------------------BALANCE
    getBalance(message, score, user)

    client.setScore.run(score);
});

function getLeaderboard(message) {
    if (message.content.startsWith(`${prefix}leaderboard`)) {
        const top5 = sql.prepare("SELECT * FROM funnies WHERE guild = ? ORDER BY funnies DESC LIMIT 5;").all(message.guild.id);

        // embed
        const embed = new MessageEmbed()
            .setTitle("Leaderboard")
            .setAuthor(null)
            .setDescription("Our top 10 points leaders!")
            .setColor(0x00AE86);

            for (const data of top5) {
                embed.addFields({ name: client.users.cache.get(data.user).tag, value: `${data.funnies} funnies` });
            }
        console.log(embed)
        message.channel.send({ embeds: [embed] })
        return
    } 
}

function giveFunny(message, score, user) {
    if (message.content.startsWith(`${prefix}funny`)) {
        if (checkDouble(user,message)) {
        score.funnies++;
        message.channel.send(`One (1) Funny Added to ${user}. Now they have ${score.funnies} Funnies!`) }
    }
}

function getBalance(message, score, user) {
    if (message.content.startsWith(`${prefix}balance`)) {
		message.channel.send(`${user} has ${score.funnies} Funnies!`);
	}
}

function checkDouble(user, message) {
    if (user.id == message.author.id) {
        message.channel.send("You can't give yourself a Funny")
    }
}

// Login to Discord with your client's token
client.login(token);