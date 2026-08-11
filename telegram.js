require("dotenv").config();

const { TelegramBot } = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан");
}

if (!chatId) {
  throw new Error("TELEGRAM_CHAT_ID не задан");
}

const bot = new TelegramBot(token);

async function sendTelegramMessage(message) {
  return bot.sendMessage(chatId, message);
}

module.exports = {
  sendTelegramMessage,
};
