const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();
const express = require('express');

// Cấu hình bot
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX || 'e';

// Kết nối MongoDB
mongoose.set('strictQuery', true);
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  userID: String,
  balance: { type: Number, default: 0 },
  marriage: {
    partnerID: { type: String, default: null },
    ringID: { type: String, default: null },
    lovePoints: { type: Number, default: 0 },
    weddingDate: { type: Date, default: null },
    caption: { type: String, default: null },
    image: { type: String, default: null },
    thumbnail: { type: String, default: null }
  },
  inventory: { type: Array, default: [] },
  lastLuvTime: { type: Number, default: 0 }
}));

const ShopItem = mongoose.model('ShopItem', new mongoose.Schema({
  id: String,
  name: String,
  price: Number,
  emoji: String,
  lovePoints: { type: Number, default: 0 }
}));

// Dữ liệu shop mặc định
const initializeShop = async () => {
  const defaultRings = [
    { id: '01', name: 'ENZ Peridot', price: 100000, emoji: '🟢' },
    { id: '02', name: 'ENZ Citrin', price: 200000, emoji: '💛' },
    { id: '03', name: 'ENZ Topaz', price: 500000, emoji: '🟡' },
    { id: '04', name: 'ENZ Spinel', price: 1000000, emoji: '🟥' },
    { id: '05', name: 'ENZ Aquamarine', price: 2500000, emoji: '💎' },
    { id: '06', name: 'ENZ Emerald', price: 5000000, emoji: '💚' },
    { id: '07', name: 'ENZ Ruby', price: 10000000, emoji: '❤️' },
    { id: '333', name: 'ENZ Sapphire', price: 25000000, emoji: '💙', lovePoints: 333 },
    { id: '999', name: 'ENZ Centenary', price: 99999999, emoji: '💖', lovePoints: 999 }
  ];

  for (const ring of defaultRings) {
    await ShopItem.updateOne({ id: ring.id }, { $set: ring }, { upsert: true });
  }
  console.log('✅ Dữ liệu shop nhẫn đã được khởi tạo.');
};
initializeShop();

// Khởi tạo bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});
const prefix = DEFAULT_PREFIX;

// Embed helper
const defaultEmbed = (title, description, color = 'Red') =>
  new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);

// Khởi động bot
client.once('ready', () => {
  console.log(`🤖 Bot đã hoạt động với tên: ${client.user.tag}`);
});

// Xử lý lệnh
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  let userData = await User.findOne({ userID: message.author.id });
  if (!userData) {
    userData = new User({ userID: message.author.id });
    await userData.save();
  }

  /** 1. Kiểm tra số dư xu */
  if (command === 'xu') {
    return message.reply({
      embeds: [defaultEmbed('💰 Số dư', `Bạn có **${userData.balance.toLocaleString()} xu**.`)]
    });
  }

  /** 2. Nhận quà hàng ngày */
  if (command === 'daily') {
    const reward = Math.floor(Math.random() * (20000 - 1000 + 1)) + 1000;
    userData.balance += reward;
    await userData.save();
    return message.reply({
      embeds: [defaultEmbed('🎁 Quà tặng hàng ngày', `Bạn nhận được **${reward.toLocaleString()} xu**.`)]
    });
  }

  /** 3. Chuyển xu */
  if (command === 'givexu') {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('❌ Cú pháp: `e givexu @user <số xu>`');
    if (userData.balance < amount) return message.reply('❌ Bạn không đủ xu.');

    const targetData = await User.findOneAndUpdate(
      { userID: target.id },
      { $inc: { balance: amount } },
      { new: true, upsert: true }
    );

    userData.balance -= amount;
    await userData.save();

    return message.reply({
      embeds: [defaultEmbed('✅ Giao dịch thành công', `Bạn đã chuyển **${amount.toLocaleString()} xu** cho **${target.username}**.`)]
    });
  }

  /** 4. Tài xỉu */
  if (command === 'tx') {
    const bet = parseInt(args[0]);
    const choice = args[1]?.toLowerCase();
    if (isNaN(bet) || bet <= 0 || !['tài', 'xỉu'].includes(choice)) return message.reply('❌ Cú pháp: `e tx <số xu> <tài/xỉu>`');
    if (userData.balance < bet) return message.reply('❌ Bạn không đủ xu.');

    const dice = [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
    const total = dice.reduce((sum, num) => sum + num, 0);
    const result = total <= 10 ? 'xỉu' : 'tài';
    const won = result === choice;

    userData.balance += won ? bet : -bet;
    await userData.save();

    return message.reply({
      embeds: [defaultEmbed('🎲 Kết quả Tài Xỉu', `🎲 Kết quả: **${total}** - **${result.toUpperCase()}**\nBạn ${won ? 'thắng' : 'thua'} ${bet.toLocaleString()} xu.`)]
    });
  }

  /** 5. Xem shop nhẫn */
  if (command === 'shop') {
    const rings = await ShopItem.find();
    const shopItems = rings.map(r => `**ID:** ${r.id} | ${r.emoji} **${r.name}** - **${r.price.toLocaleString()} xu**`).join('\n');
    return message.reply({ embeds: [defaultEmbed('💍 Cửa hàng nhẫn', shopItems)] });
  }

  /** 6. Mua nhẫn */
  if (command === 'buy') {
    const ringID = args[0];
    const ring = await ShopItem.findOne({ id: ringID });
    if (!ring) return message.reply('❌ Không tìm thấy nhẫn này.');

    if (userData.balance < ring.price) return message.reply('❌ Bạn không đủ xu.');
    userData.balance -= ring.price;
    userData.inventory.push({ id: ring.id, name: ring.name, emoji: ring.emoji });
    await userData.save();

    return message.reply({
      embeds: [defaultEmbed('✅ Mua thành công', `Bạn đã mua nhẫn **${ring.emoji} ${ring.name}**.`)]
    });
  }

// 7. Kiểm tra kho nhẫn của người dùng
if (command === 'inv') {
  const inventory = userData.inventory;
  if (!inventory.length) {
    return message.reply({
      embeds: [defaultEmbed('📦 Kho nhẫn', 'Bạn chưa sở hữu nhẫn nào.')]
    });
  }

  const itemsList = inventory.map((item, index) => `${index + 1}. ${item.emoji} **${item.name}**`).join('\n');
  return message.reply({
    embeds: [defaultEmbed('📦 Kho nhẫn', `Danh sách nhẫn bạn sở hữu:\n\n${itemsList}`)]
  });
}

// 8. Tặng nhẫn cho người khác
if (command === 'gift') {
  const target = message.mentions.users.first();
  const ringIndex = parseInt(args[1]) - 1;

  if (!target || isNaN(ringIndex) || ringIndex < 0 || ringIndex >= userData.inventory.length) {
    return message.reply('❌ Cú pháp: `e gift @user <số thứ tự nhẫn>`.');
  }

  const ring = userData.inventory.splice(ringIndex, 1)[0];
  let targetData = await User.findOne({ userID: target.id });
  if (!targetData) {
    targetData = new User({ userID: target.id });
  }

  targetData.inventory.push(ring);

  await userData.save();
  await targetData.save();

  return message.reply({
    embeds: [defaultEmbed('🎁 Tặng nhẫn', `Bạn đã tặng **${ring.emoji} ${ring.name}** cho **${target.username}**.`)]
  });
}

// 9. Cầu hôn người khác
if (command === 'marry') {
  const target = message.mentions.users.first();
  const ringIndex = parseInt(args[1]) - 1;

  if (!target || isNaN(ringIndex) || ringIndex < 0 || ringIndex >= userData.inventory.length) {
    return message.reply('❌ Cú pháp: `e marry @user <số thứ tự nhẫn>`.');
  }

  const ring = userData.inventory.splice(ringIndex, 1)[0];
  await userData.save();

  const marryEmbed = defaultEmbed(
    '💍 Lời cầu hôn',
    `**${message.author.username}** đã cầu hôn **${target.username}** bằng nhẫn **${ring.emoji} ${ring.name}**.\nBạn có đồng ý không?`
  );

  const acceptButton = new ButtonBuilder().setCustomId('accept_marry').setLabel('Đồng ý 💖').setStyle(ButtonStyle.Success);
  const declineButton = new ButtonBuilder().setCustomId('decline_marry').setLabel('Từ chối 💔').setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

  const marryMessage = await message.reply({ embeds: [marryEmbed], components: [row] });

  const collector = marryMessage.createMessageComponentCollector({
    filter: (interaction) => interaction.user.id === target.id,
    time: 60000
  });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'accept_marry') {
      userData.marriage.partnerID = target.id;
      userData.marriage.ringID = ring.id;
      userData.marriage.weddingDate = new Date();

      let partnerData = await User.findOne({ userID: target.id });
      if (!partnerData) partnerData = new User({ userID: target.id });
      partnerData.marriage.partnerID = message.author.id;

      await userData.save();
      await partnerData.save();

      return interaction.update({
        embeds: [defaultEmbed('💖 Chúc mừng!', `Cả hai đã chính thức kết hôn!`)],
        components: []
      });
    } else {
      userData.inventory.push(ring);
      await userData.save();

      return interaction.update({
        embeds: [defaultEmbed('💔 Từ chối', `${target.username} đã từ chối lời cầu hôn.`)],
        components: []
      });
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      userData.inventory.push(ring);
      userData.save();
      marryMessage.edit({
        embeds: [defaultEmbed('⏰ Hết thời gian', 'Lời cầu hôn đã hết thời gian phản hồi.')],
        components: []
      });
    }
  });
}

// 10. Ly hôn
if (command === 'divorce') {
  if (!userData.marriage.partnerID) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.')] });
  }

  const partnerData = await User.findOne({ userID: userData.marriage.partnerID });
  if (!partnerData) return;

  userData.marriage = {};
  partnerData.marriage = {};

  await userData.save();
  await partnerData.save();

  return message.reply({
    embeds: [defaultEmbed('💔 Ly hôn', 'Bạn đã chính thức ly hôn.')]
  });
}

// 11. Xem thông tin hôn nhân
if (command === 'pmarry') {
  if (!userData.marriage.partnerID) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.')] });
  }

  const partner = await User.findOne({ userID: userData.marriage.partnerID });
  const ring = await ShopItem.findOne({ id: userData.marriage.ringID });

  const embed = new EmbedBuilder()
    .setTitle('💞 Thông tin hôn nhân')
    .setDescription(`Bạn đang hạnh phúc với: **${partner.username}**`)
    .addFields(
      { name: '💍 Nhẫn', value: `${ring.emoji} ${ring.name}`, inline: true },
      { name: '❤️ Điểm yêu thương', value: `${userData.marriage.lovePoints || 0}`, inline: true },
      { name: '📅 Ngày kết hôn', value: `${userData.marriage.weddingDate.toDateString()}`, inline: true }
    )
    .setColor('#FF00CB');

  return message.reply({ embeds: [embed] });
}

   /** 12. Thêm ảnh lớn vào thông tin hôn nhân */
if (command === 'addimage') {
  const imageUrl = args[0];
  if (!userData.marriage.partnerID) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.')] });
  }

  if (!isValidImageUrl(imageUrl)) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng cung cấp URL hình ảnh hợp lệ.')] });
  }

  userData.marriage.image = imageUrl;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Đã thêm ảnh lớn vào thông tin hôn nhân.')]
  });
}

/** 13. Xóa ảnh lớn khỏi thông tin hôn nhân */
if (command === 'delimage') {
  if (!userData.marriage.partnerID || !userData.marriage.image) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Không có ảnh lớn nào để xóa.')] });
  }

  userData.marriage.image = null;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Ảnh lớn đã được xóa khỏi thông tin hôn nhân.')]
  });
}

/** 14. Thêm thumbnail vào thông tin hôn nhân */
if (command === 'addthumbnail') {
  const thumbnailUrl = args[0];
  if (!userData.marriage.partnerID) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.')] });
  }

  if (!isValidImageUrl(thumbnailUrl)) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng cung cấp URL hình ảnh hợp lệ.')] });
  }

  userData.marriage.thumbnail = thumbnailUrl;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Đã thêm thumbnail vào thông tin hôn nhân.')]
  });
}

/** 15. Xóa thumbnail khỏi thông tin hôn nhân */
if (command === 'delthumbnail') {
  if (!userData.marriage.partnerID || !userData.marriage.thumbnail) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Không có thumbnail nào để xóa.')] });
  }

  userData.marriage.thumbnail = null;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Thumbnail đã được xóa khỏi thông tin hôn nhân.')]
  });
}

/** 16. Thêm caption vào thông tin hôn nhân */
if (command === 'addcaption') {
  const caption = args.join(' ');
  if (!userData.marriage.partnerID) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.')] });
  }

  if (!caption) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập nội dung caption.')] });
  }

  userData.marriage.caption = caption;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', `Caption đã được thêm: "${caption}"`)]
  });
}

/** 17. Xóa caption khỏi thông tin hôn nhân */
if (command === 'delcaption') {
  if (!userData.marriage.partnerID || !userData.marriage.caption) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Không có caption nào để xóa.')] });
  }

  userData.marriage.caption = null;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Caption đã được xóa khỏi thông tin hôn nhân.')]
  });
}

/** 18. Lệnh cộng điểm yêu thương */
if (command === 'luv') {
  const now = Date.now();
  const lastLuvTime = userData.lastLuvTime || 0;

  if (now - lastLuvTime < 3600000) { // 1 giờ
    const remainingTime = Math.ceil((3600000 - (now - lastLuvTime)) / 60000);
    return message.reply({
      embeds: [defaultEmbed('⏰ Chờ thêm', `Bạn cần chờ **${remainingTime} phút** trước khi cộng điểm tiếp.`)]
    });
  }

  userData.lastLuvTime = now;
  userData.marriage.lovePoints += 1;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('❤️ Thành công', 'Bạn đã cộng 1 điểm yêu thương!')]
  });
}

/** 19. Lệnh dành cho admin: Thêm xu */
if (command === 'addxu') {
  if (message.author.id !== '1262464227348582492') {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.')] });
  }

  const target = message.mentions.users.first();
  const amount = parseInt(args[1]);

  if (!target || isNaN(amount) || amount <= 0) {
    return message.reply('❌ Cú pháp: `e addxu @user <số xu>`.');
  }

  let targetData = await User.findOne({ userID: target.id });
  if (!targetData) {
    targetData = new User({ userID: target.id });
  }

  targetData.balance += amount;
  await targetData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', `Đã thêm **${amount.toLocaleString()} xu** cho **${target.username}**.`)]
  });
}

/** 20. Lệnh dành cho admin: Trừ xu */
if (command === 'delxu') {
  if (message.author.id !== '1262464227348582492') {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.')] });
  }

  const target = message.mentions.users.first();
  const amount = parseInt(args[1]);

  if (!target || isNaN(amount) || amount <= 0) {
    return message.reply('❌ Cú pháp: `e delxu @user <số xu>`.');
  }

  let targetData = await User.findOne({ userID: target.id });
  if (!targetData || targetData.balance < amount) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Người dùng không đủ xu để trừ.')] });
  }

  targetData.balance -= amount;
  await targetData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', `Đã trừ **${amount.toLocaleString()} xu** từ **${target.username}**.`)]
  });
}

  /** 21. Lệnh thay đổi prefix (chỉ admin) */
if (command === 'prefix') {
  if (message.author.id !== '1262464227348582492') {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.')] });
  }

  const newPrefix = args[0];
  if (!newPrefix) return message.reply('❌ Vui lòng nhập prefix mới.');

  process.env.DEFAULT_PREFIX = newPrefix;

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', `Prefix của bot đã được đổi thành **${newPrefix}**.`)]
  });
}

/** 22. Lệnh reset tất cả dữ liệu bot (chỉ admin) */
if (command === 'resetallbot') {
  if (message.author.id !== '1262464227348582492') {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.')] });
  }

  await User.deleteMany({});
  await ShopItem.deleteMany({});
  await initializeShop();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Tất cả dữ liệu đã được reset.')]
  });
}

 /** 23. Xem 10 tin nhắn đã xóa gần nhất */
const DeletedMessages = []; // Tạm thời lưu tin nhắn đã xóa vào bộ nhớ

client.on('messageDelete', (message) => {
  if (!message.partial && message.content) {
    DeletedMessages.unshift({ content: message.content, author: message.author.tag });
    if (DeletedMessages.length > 10) DeletedMessages.pop(); // Lưu tối đa 10 tin nhắn
  }
});

if (command === 'sn') {
  if (DeletedMessages.length === 0) {
    return message.reply({
      embeds: [defaultEmbed('💬 Tin nhắn đã xóa', 'Hiện không có tin nhắn nào bị xóa.')]
    });
  }

  let currentIndex = 0;

  const createEmbed = () => {
    const msg = DeletedMessages[currentIndex];
    return new EmbedBuilder()
      .setTitle(`💬 Tin nhắn đã xóa #${currentIndex + 1}`)
      .setDescription(`**Tác giả:** ${msg.author}\n**Nội dung:** ${msg.content}`)
      .setFooter({ text: `Trang ${currentIndex + 1} / ${DeletedMessages.length}` });
  };

  const previousButton = new ButtonBuilder()
    .setCustomId('previous_sn')
    .setLabel('⬅️ Trước')
    .setStyle(ButtonStyle.Primary);
  const nextButton = new ButtonBuilder()
    .setCustomId('next_sn')
    .setLabel('➡️ Tiếp')
    .setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(previousButton, nextButton);

  const reply = await message.reply({ embeds: [createEmbed()], components: [row] });

  const collector = reply.createMessageComponentCollector({
    time: 60000,
    filter: (i) => i.user.id === message.author.id
  });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'previous_sn' && currentIndex > 0) currentIndex--;
    if (interaction.customId === 'next_sn' && currentIndex < DeletedMessages.length - 1) currentIndex++;

    await interaction.update({ embeds: [createEmbed()], components: [row] });
  });

  collector.on('end', () => reply.edit({ components: [] }));
}

/** 23. Đặt cược Nổ Hũ "nohu" */
if (command === 'nohu') {
  const bet = parseInt(args[0]);
  if (isNaN(bet) || bet <= 0) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập số tiền cược hợp lệ!')] });
  }

  if (userData.balance < bet) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không đủ xu để đặt cược!')] });
  }

  const chance = message.author.id === '1262464227348582492' ? 100 : Math.random() * 50;
  const isWin = chance < 1; // 1/50 tỷ lệ thắng, nhưng admin 100% trúng

  userData.balance -= bet;
  if (isWin) {
    const winnings = bet * 100; // Trúng x100
    userData.balance += winnings;
    await userData.save();
    return message.reply({
      embeds: [defaultEmbed('🎉 Chúc mừng!', `Bạn đã trúng Nổ Hũ và nhận được **${winnings.toLocaleString()} xu**!`)]
    });
  } else {
    await userData.save();
    return message.reply({
      embeds: [defaultEmbed('😢 Chia buồn', 'Bạn đã thua cược. Hãy thử lại nhé!')]
    });
  }
}

/** 24. Hiển thị bảng xếp hạng xu "top" */
if (command === 'top') {
  const topUsers = await User.find().sort({ balance: -1 }).limit(10);
  if (!topUsers.length) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Không có dữ liệu người dùng trong bảng xếp hạng.')] });
  }

  const leaderboard = topUsers.map((user, index) => `**${index + 1}.** <@${user.userID}> - **${user.balance.toLocaleString()} xu**`);
  return message.reply({
    embeds: [defaultEmbed('🏆 Bảng xếp hạng xu', leaderboard.join('\n'), 'Gold')]
  });
}

/** 25. Thêm emoji vào nhẫn "addemoji" (chỉ admin) */
if (command === 'addemoji') {
  if (message.author.id !== '1262464227348582492') {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.')] });
  }

  const ringID = args[0];
  const emoji = args[1];
  if (!ringID || !emoji) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập ID nhẫn và emoji.')] });
  }

  const ring = await ShopItem.findOne({ id: ringID });
  if (!ring) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Không tìm thấy nhẫn với ID này.')] });
  }

  ring.emoji = emoji;
  await ring.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', `Đã thêm emoji **${emoji}** cho nhẫn **${ring.name}**.`)]
  });
}
  
/** 26. Xóa emoji khỏi nhẫn "delimoji" (chỉ admin) */
if (command === 'delimoji') {
  if (message.author.id !== '1262464227348582492') {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.')] });
  }

  const ringID = args[0];
  if (!ringID) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập ID nhẫn cần xóa emoji.')] });
  }

  const ring = await ShopItem.findOne({ id: ringID });
  if (!ring) {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Không tìm thấy nhẫn với ID này.')] });
  }

  ring.emoji = ''; // Xóa emoji
  await ring.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', `Đã xóa emoji khỏi nhẫn **${ring.name}**.`)]
  });
}

/** 27. Reset toàn bộ dữ liệu bot "resetallbot" (chỉ admin) */
if (command === 'resetallbot') {
  if (message.author.id !== '1262464227348582492') {
    return message.reply({ embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.')] });
  }

  await User.deleteMany({});
  await ShopItem.deleteMany({});
  await initializeShop(); // Khởi tạo lại cửa hàng nhẫn

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Tất cả dữ liệu đã được reset.')]
  });
}
    
});

// Cấu hình Express để chạy trên Render
const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌐 Server đang chạy trên cổng ${port}`);
});

client.login(DISCORD_TOKEN);
