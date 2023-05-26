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


    getLeaderboard(message)
    getFailureboard(message)  
    getHelp(message) 
    getStatus(message)

    giveFunny(message)
    takeFunny(message)

    getBalance(message)
    
});

async function getFailureboard(message) {
    if (message.content.startsWith(`${prefix}failureboard`)) {
        const bottom5 = sql.prepare("SELECT * FROM funnies WHERE guild = ? ORDER BY funnies LIMIT 5;").all(message.guild.id);

        // embed
        const embed = new MessageEmbed()
            .setTitle("Failureboard")
            .setDescription("Our bottom 5 ~~funny~~ men!")
            .setColor(0x00AE86);

            for (const data of bottom5 ) {
                let usr = await client.users.fetch(data.user)
                embed.addFields({ name: `${usr.username}`, value: `${data.funnies} funnies` });
            }

        message.channel.send({ embeds: [embed] })
        return
    } 
}

async function getLeaderboard(message) {
    if (message.content.startsWith(`${prefix}leaderboard`)) {
        const top5 = sql.prepare("SELECT * FROM funnies WHERE guild = ? ORDER BY funnies DESC LIMIT 5;").all(message.guild.id);

        // embed
        const embed = new MessageEmbed()
            .setTitle("Leaderboard")
            .setDescription("Our top 5 funnymen!")
            .setColor(0x00AE86);

            for (const data of top5) {
                let usr = await client.users.fetch(data.user)
                embed.addFields({ name: `${usr.username}`, value: `${data.funnies} funnies` });
            }

        message.channel.send({ embeds: [embed] })
        return
    } 
}

function giveFunny(message) {
    if (message.content.startsWith(`${prefix}funny`)) {
        let info = checkUser(message);
        const user = info[0]
        const score = info[1]
        if (user !== null && user.bot == false) {
		    if (checkDouble(user,message) == false) {
                score.funnies++
                client.setScore.run(score); //commit changes
                message.channel.send(`One (1) Funny Added to ${user}. Now they have ${score.funnies} Funnies!`) }
	    } else {
            message.channel.send("You need to specify a user (not a bot) to use this command");
        }
    }   
}

function getBalance(message) {
    if (message.content.startsWith(`${prefix}balance`)) {
        let info = checkUser(message);
        const user = info[0]
        const score = info[1]
        if (user !== null && user.bot ==false) {
		    message.channel.send(`${user} has ${score.funnies} Funnies!`);
	    }else {
            message.channel.send("You need to specify a user (not a bot) to use this command");
    }}
}

function checkDouble(user, message) {
    if (user.id == message.author.id) {
        message.channel.send("You can't change your Funnies yourself")
        return true
    } else {
        return false
    }
}


function getHelp(message) {
    if (message.content.startsWith(`${prefix}help`)) {
        const embedhelp = new MessageEmbed()
            .setTitle("Help Menu")
            .setDescription("Commands Available")
            .setColor(0x00AE86)
            .addFields(
                { name: "+funny", value: "Give one Funny to @someone" },
                { name: "+remove", value: "Take one Funny from @someone" },
                { name: "+balance", value: "Check @someone's balance" },
                { name: "+leaderboard", value: "See the Top 5 leaderboard" },
                { name: "+failureboard", value: "See the Bottom 5 leaderboard" },
                { name: "+status", value: "Check the current bot status" }
            );
        
        message.channel.send({ embeds: [embedhelp] });
    }
}

function getStatus(message) {
    if (message.content.startsWith(`${prefix}status`)) {
        const embedhelp = new MessageEmbed()
            .setTitle("Bot Status")
            .setDescription("The bot is functional! :}")
            .setColor(0x00AE86);
        message.channel.send({ embeds: [embedhelp] });
    }
}

function takeFunny(message) {
    if (message.content.startsWith(`${prefix}remove`)) {
        let info = checkUser(message);
        const user = info[0]
        const score = info[1]
        if (user !== null && user.bot == false) {
		    if (checkDouble(user,message) == false) {
                score.funnies--
                client.setScore.run(score); //commit changes
                message.channel.send(`One (1) Funny was Removed from ${user}. Now they have ${score.funnies} Funnies.`) }
	    }else {
            message.channel.send("You need to specify a user (not a bot) to use this command");
    }}   
}

function checkUser(message){
    const user = message.mentions.users.first();
    if (!user) {
        return [null, null]
    } else {
    
        const userID = user.id;
        const guildID= message.guild.id;

        //score initialization
        let score = client.getScore.get(userID, guildID);

        if (!score) {
            score = {
                id: `${guildID}-${userID}`,
                user: userID,
                guild: guildID,
                funnies: 0,
            }
        }
        
        return [user, score]; }
}

// Login to Discord with your client's token
client.login(token);