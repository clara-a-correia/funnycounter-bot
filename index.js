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
        sql.prepare("CREATE TABLE funnies (id TEXT PRIMARY KEY, user TEXT, guild TEXT, funnies INTEGER, active INTEGER, activity INTEGER);").run();
        // Ensure that the "id" row is always unique and indexed.
        sql.prepare("CREATE UNIQUE INDEX idx_funnies_id ON funnies (id);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }
    //used once to alter the prexisting table
    //sql.prepare("ALTER TABLE funnies ADD COLUMN active INTEGER DEFAULT 1").run();
    //sql.prepare("ALTER TABLE funnies ADD COLUMN activity INTEGER DEFAULT 0").run();

    //inactivate old activities
    sql.prepare("UPDATE funnies SET active = 0 WHERE active = 1").run();

    //statements to get and set the score data.
    client.getInfoDB = sql.prepare("SELECT * FROM funnies WHERE user = ? AND guild = ?");
    client.setInfoDB = sql.prepare("INSERT OR REPLACE INTO funnies (id, user, guild, funnies, active, activity) VALUES (@id, @user, @guild, @funnies, @active, @activity);");

    //current activity statement
    client.currentActivity = sql.prepare("SELECT * FROM funnies WHERE active = 1 AND activity = 1 AND guild = ? ORDER BY funnies LIMIT 1");

    client.user.setActivity("for Funnies", {type:"WATCHING"});
    console.log('Funnies are being Watched');
});

client.on("messageCreate", (message) => {
    // Exit and stop if it's not there
    if (!message.content.startsWith(prefix)) return;

    let timeoutId;

    getLeaderboard(message)
    getHelp(message) 
    getStatus(message)
    funnyInteractions(message)
    getBalance(message)

    startActivity(message, timeoutId)
    deleteActivity(message);
    currentActivity(message);
    getActivities(message);
    if (message.content.startsWith(`${prefix}inactivate`)) {
        inactivateActivity(message);
        clearTimeout(timeoutId);
    };
});

async function getLeaderboard(message) {
    let users5;
    let title;
    let description;
    if (message.content.startsWith(`${prefix}leaderboard`)) {
        users5 = sql.prepare("SELECT * FROM funnies WHERE guild = ? and activity = 0 ORDER BY funnies DESC LIMIT 5;").all(message.guild.id);
        title = "Leaderboard";
        description = "Our top 5 funnymen!";
    } else if (message.content.startsWith(`${prefix}failureboard`)) {
        users5 = sql.prepare("SELECT * FROM funnies WHERE guild = ? and activity = 0 ORDER BY funnies LIMIT 5;").all(message.guild.id);
        title = "Failureboard";
        description = "Our bottom 5 ~~funny~~ men!";
    } else {
        return;
    }
        // embed message set up
        const embed = new MessageEmbed()
            .setTitle(title)
            .setDescription(description)
            .setColor(0x00AE86);

            for (const data of users5) {
                let usr = await client.users.fetch(data.user)
                embed.addFields({ name: `${usr.username}`, value: `${data.funnies} funnies` });
            }

        message.channel.send({ embeds: [embed] })
        return
} 

function funnyInteractions(message) {
    let text;
    let user;
    let score;
    if (message.content.startsWith(`${prefix}funny`) || message.content.startsWith(`${prefix}remove`)) {
        let info = checkUser(message);
        const currentActivity = client.currentActivity.get(message.guild.id);
        user = info[0]
        score = info[1]
        if (user != null && user.bot == true) {
            message.channel.send("You need to specify a user (not a bot) to use this command");
            return;
        } else if (user != null && user.id == message.author.id) {
            message.channel.send("You can't change your Funnies yourself")
            return;
        } else if (user == null && currentActivity) {
            user = currentActivity.user
            score = currentActivity
        } else if (user == null && !currentActivity) {
            message.channel.send("You need to specify a user (not a bot) or have an active activity to use this command");
            return
        }
    
        if (user !== null) {
                if (message.content.startsWith(`${prefix}remove`)) {
                    score.funnies--
                    text = `One (1) Funny was Removed from ${user}. Now they have ${score.funnies} Funnies.`
                } else { 
                    score.funnies++
                    text = `One (1) Funny Added to ${user}. Now they have ${score.funnies} Funnies!`
                    message.channel.send("funny added")
                }
                client.setInfoDB.run(score);
                message.channel.send(text);
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


function getHelp(message) {
    if (message.content.startsWith(`${prefix}help`)) {
        const embedhelp = new MessageEmbed()
            .setTitle("Help Menu")
            .setDescription("Commands Available - Initial Batch")
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

        const embedhelp2 = new MessageEmbed()
            .setTitle("Help Menu")
            .setDescription("Commands Available - Patch 2.0 - Activities")
            .setColor(0x00AE86)
            .addFields(
                { name: "+start [name]", value: "Start an activity with a [name] (mandatory) - current Timer: 3 hours" },
                { name: "+activities", value: "See all previous activities" },
                { name: "+current", value: "See the current activity" },
                { name: "+inactivate", value: "Inactivate an activity, but don't remove it completely" },
                { name: "+delete [name]", value: "Delete activity [name] completely" },
                { name: "+funny / +remove", value: "Add or remove funnies from activities" }
            );
        
        message.channel.send({ embeds: [embedhelp2] });
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

function checkUser(message){
    const user = message.mentions.users.first();
    if (!user) {
        return [null, null]
    } else {
    
        const userID = user.id;
        const guildID= message.guild.id;

        //score initialization
        let score = client.getInfoDB.get(userID, guildID);

        if (!score) {
            score = {
                id: `${guildID}-${userID}`,
                user: userID,
                guild: guildID,
                funnies: 0,
                active: 1,
                activity: 0,
            }
        }
        return [user, score]; }
}

/////////////////
//ACTIVITY TIME//
/////////////////

function startActivity(message, timeoutId){
    if (message.content.startsWith(`${prefix}start`)) {

        const name = message.content.split(" ").slice(1).join(" ");
        if (name.length < 1) {
            message.channel.send("An Activity must have a name");
            return;
        }
        const guildID= message.guild.id;

        //const seeRepeat = sql.prepare("SELECT count(*) FROM funnies WHERE activity = 1 AND active = 1");
        const currentActivity = client.currentActivity.get(guildID);
        //Object.keys(seeRepeat).length == 0
        let score = client.getInfoDB.get(name, guildID);
        if (!score && !currentActivity) {
            score = {
                id: `${guildID}-${name}`,
                user: name,
                guild: guildID,
                funnies: 0,
                active: 1,
                activity: 1,
            }
            client.setInfoDB.run(score);
            timeoutId = setTimeout(() => { inactivateActivity(message) }, 10800000)

            message.channel.send(`Activity ${name} created! Have fun :)`);
        } else if (currentActivity){
            if(currentActivity.user == name){
                message.channel.send(`This activity (${currentActivity.user}) was already created and is currently active`)
            } else {
                message.channel.send(`Only one activity can be active at each moment - Please use ${currentActivity.user}`)
            }
        } else {
            message.channel.send(`Activity ${name} already exists, but isn't active. Please use an unique name if you want to start an activity`)
        }
    } 
}

function deleteActivity(message){
    if (message.content.startsWith(`${prefix}delete`)) {

        const name = message.content.split(" ").slice(1).join(" ");

        const guildID= message.guild.id;
        let score = client.getInfoDB.get(name, guildID);
        if (score) {
            sql.prepare("DELETE FROM funnies WHERE user = ? AND guild = ?").run(name, guildID);
            message.channel.send(`Activity ${name} was deleted.`)
        }
    } 
}

function currentActivity(message){
    if (message.content.startsWith(`${prefix}current`)) {
        const currentActivity = client.currentActivity.get(message.guild.id);
        if(Object.keys(currentActivity).length !== 0){
            message.channel.send(`We are currently enjoying ${currentActivity.user} with ${currentActivity.funnies} funnies!`)
        } else {
            message.channel.send(`There isn't an ongoing activity.`)
        }
    } 
}

function getActivities(message){
    if (message.content.startsWith(`${prefix}activities`)) {
        const activities = sql.prepare("SELECT * FROM funnies WHERE activity = 1 AND guild = ? ORDER BY funnies DESC").all(message.guild.id);
        const embed = new MessageEmbed()
        .setTitle("All Activities")
        .setDescription("Activities enjoyed previously")
        .setColor(0x00AE86);

        for (const activity of activities) {
            embed.addFields({ name: `${activity.user}`, value: `${activity.funnies} funnies` });
        }

    message.channel.send({ embeds: [embed] })
    return
    } 
}

function inactivateActivity(message){
        const guildID= message.guild.id;
        const currentActivity = client.currentActivity.get(guildID);
        if (currentActivity) {
            currentActivity.active = 0;
            client.setInfoDB.run(currentActivity);
            message.channel.send(`Activity ${currentActivity.user} was inactivated! Hope you had fun :)`)
        }
}

// Login to Discord with your client's token
client.login(token);