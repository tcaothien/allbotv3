const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config(); // Load biến môi trường từ .env

// Lấy thông tin từ biến môi trường
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX || 'e';

// Kết nối MongoDB
mongoose.set('strictQuery', true);
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Tạo model dữ liệu người dùng
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
  inventory: { type: Array, default: [] }
}));

// Cấu hình client Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const prefix = DEFAULT_PREFIX;

// Sự kiện bot khởi động
client.once('ready', () => {
  console.log(`🤖 Bot đã hoạt động với tên: ${client.user.tag}`);
});

// Xử lý tin nhắn
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Embed mặc định
  const defaultEmbed = (title, description, color = 'Red') =>
    new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);

  // Kiểm tra hoặc tạo dữ liệu người dùng
  let userData = await User.findOne({ userID: message.author.id });
  if (!userData) {
    userData = new User({ userID: message.author.id });
    await userData.save();
  }

  /** --- 1. Kiểm tra số dư "xu" --- */
  if (command === 'xu') {
    return message.reply({
      embeds: [
        defaultEmbed(`💰 Số dư của bạn`, `Hiện tại bạn có **${userData.balance} xu**.`)
      ]
    });
  }

  /** --- 2. Nhận quà tặng hàng ngày "daily" --- */
  if (command === 'daily') {
    const reward = Math.floor(Math.random() * (20000 - 1000 + 1)) + 1000;
    userData.balance += reward;
    await userData.save();
    return message.reply({
      embeds: [
        defaultEmbed(
          `🎁 Quà tặng hàng ngày`,
          `Bạn đã nhận được **${reward} xu** hôm nay!\nSố dư hiện tại: **${userData.balance} xu**.`
        )
      ]
    });
  }

  /** --- 3. Chuyển xu cho người khác "givexu" --- */
  if (command === 'givexu') {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng đề cập một người và số xu hợp lệ để chuyển!')]
      });
    }

    const targetData = await User.findOne({ userID: target.id });
    if (!targetData) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Người dùng này chưa được đăng ký trong hệ thống!')]
      });
    }

    if (userData.balance < amount) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không đủ xu để thực hiện giao dịch!')]
      });
    }

    userData.balance -= amount;
    targetData.balance += amount;

    await userData.save();
    await targetData.save();

    return message.reply({
      embeds: [
        defaultEmbed(
          `✅ Giao dịch thành công`,
          `Bạn đã chuyển **${amount} xu** cho ${target.username}.\nSố dư hiện tại của bạn: **${userData.balance} xu**.`
        )
      ]
    });
  }

  /** --- 4. Đặt cược tài xỉu "tx" --- */
  if (command === 'tx') {
    const bet = parseInt(args[0]);
    const choice = args[1]?.toLowerCase();

    if (isNaN(bet) || !['tài', 'xỉu'].includes(choice)) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Cú pháp: `e<tx> <số tiền> <tài/xỉu>`.')]
      });
    }

    if (userData.balance < bet) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không đủ xu để đặt cược!')]
      });
    }

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const dice3 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2 + dice3;

    const result = total <= 10 ? 'xỉu' : 'tài';
    const won = result === choice;

    if (won) {
      userData.balance += bet;
    } else {
      userData.balance -= bet;
    }

    await userData.save();

    return message.reply({
      embeds: [
        defaultEmbed(
          `🎲 Kết quả tài xỉu`,
          `🎲 Xúc xắc: [${dice1}, ${dice2}, ${dice3}] (Tổng: ${total})\nKết quả: **${result.toUpperCase()}**\nBạn ${won ? 'thắng' : 'thua'}! Số dư: **${userData.balance} xu**.`
        )
      ]
    });
  }

  /** --- 5. Mua nhẫn từ cửa hàng "buy" --- */
if (command === 'buy') {
  const ringID = args[0];
  if (!ringID) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập ID nhẫn bạn muốn mua.', 'Red')]
    });
  }

  const ring = rings.find((r) => r.id === ringID);
  if (!ring) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Không tìm thấy nhẫn với ID đã cung cấp.', 'Red')]
    });
  }

  if (userData.xu < ring.price) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', `Bạn không đủ xu để mua nhẫn **${ring.name}**.`, 'Red')]
    });
  }

  userData.xu -= ring.price;
  userData.inventory.push({ id: ring.id, name: ring.name, emoji: ring.emoji });
  await userData.save();

  return message.reply({
    embeds: [
      defaultEmbed(
        '✅ Thành công',
        `Bạn đã mua nhẫn **${ring.emoji} ${ring.name}** với giá **${ring.price.toLocaleString()} xu**. Hãy kiểm tra bằng lệnh \`inv\`.`,
        'Pink'
      )
    ]
  });
}

  /** --- 6. Kiểm tra kho lưu trữ nhẫn "inv" --- */
if (command === 'inv') {
  const inventory = userData.inventory;
  if (!inventory || inventory.length === 0) {
    return message.reply({
      embeds: [defaultEmbed('📦 Kho lưu trữ nhẫn', 'Bạn chưa sở hữu nhẫn nào.', 'Pink')]
    });
  }

  const inventoryList = inventory
    .map((item, index) => `**${index + 1}.** ${item.emoji} **${item.name}**`)
    .join('\n');

  return message.reply({
    embeds: [
      defaultEmbed(
        '📦 Kho lưu trữ nhẫn',
        `Danh sách nhẫn bạn sở hữu:\n\n${inventoryList}`,
        'Pink'
      )
    ]
  });
}

  /** --- 7. Tặng nhẫn cho người khác "gift" --- */
if (command === 'inv') {
  const inventory = userData.inventory;
  if (!inventory || inventory.length === 0) {
    return message.reply({
      embeds: [defaultEmbed('📦 Kho lưu trữ nhẫn', 'Bạn chưa sở hữu nhẫn nào.', 'Pink')]
    });
  }

  const inventoryList = inventory
    .map((item, index) => `**${index + 1}.** ${item.emoji} **${item.name}**`)
    .join('\n');

  return message.reply({
    embeds: [
      defaultEmbed(
        '📦 Kho lưu trữ nhẫn',
        `Danh sách nhẫn bạn sở hữu:\n\n${inventoryList}`,
        'Pink'
      )
    ]
  });
}

  /** --- 8. Cầu hôn người khác "marry" --- */
if (command === 'marry') {
  const target = message.mentions.users.first();
  const index = parseInt(args[1]) - 1;

  if (!target) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng tag người bạn muốn cầu hôn.', 'Red')]
    });
  }

  if (isNaN(index) || index < 0 || index >= userData.inventory.length) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập số thứ tự nhẫn hợp lệ trong kho.', 'Red')]
    });
  }

  const ring = userData.inventory.splice(index, 1)[0];
  await userData.save();

  const marryEmbed = defaultEmbed(
    '💍 Lời cầu hôn',
    `**${message.author.username}** đã cầu hôn **${target.username}** bằng nhẫn **${ring.emoji} ${ring.name}**. Bạn có đồng ý không?`,
    'Pink'
  );

  const acceptButton = new MessageButton()
    .setCustomId('accept_marry')
    .setLabel('Đồng ý')
    .setStyle('SUCCESS');

  const declineButton = new MessageButton()
    .setCustomId('decline_marry')
    .setLabel('Từ chối')
    .setStyle('DANGER');

  const row = new MessageActionRow().addComponents(acceptButton, declineButton);

  const marryMessage = await message.reply({ embeds: [marryEmbed], components: [row] });

  const collector = marryMessage.createMessageComponentCollector({
    filter: (interaction) => interaction.user.id === target.id,
    time: 60000
  });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'accept_marry') {
      collector.stop('accepted');
      userData.marriedTo = target.id;
      userData.lovePoints = (userData.lovePoints || 0) + (ring.lovePoints || 0);
      targetData.marriedTo = message.author.id;

      await userData.save();
      await targetData.save();

      return interaction.update({
        embeds: [defaultEmbed('💖 Chúc mừng!', 'Cả hai đã kết hôn!', 'Pink')],
        components: []
      });
    } else if (interaction.customId === 'decline_marry') {
      collector.stop('declined');
      userData.inventory.push(ring);
      await userData.save();

      return interaction.update({
        embeds: [defaultEmbed('💔 Từ chối', `${target.username} đã từ chối lời cầu hôn.`, 'Red')],
        components: []
      });
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      userData.inventory.push(ring);
      userData.save();
      marryMessage.edit({
        embeds: [defaultEmbed('⏰ Hết thời gian', 'Không có phản hồi từ đối phương.', 'Red')],
        components: []
      });
    }
  });
}

  /** --- 9. Ly hôn "divorce" --- */
  if (command === 'divorce') {
    if (!userData.marriage.partnerID) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn để ly hôn!')]
      });
    }

    const partnerData = await User.findOne({ userID: userData.marriage.partnerID });
    if (!partnerData) return;

    const filter = interaction => interaction.user.id === userData.marriage.partnerID;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('acceptDivorce').setLabel('Đồng ý 💔').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('declineDivorce').setLabel('Từ chối ❌').setStyle(ButtonStyle.Secondary)
    );

    const divorceEmbed = new EmbedBuilder()
      .setTitle('💔 Ly hôn')
      .setDescription(`${message.author.username} muốn ly hôn với bạn. Bạn có đồng ý không?`)
      .setColor('Pink');

    const divorceRequest = await message.reply({ embeds: [divorceEmbed], components: [row] });

    const collector = divorceRequest.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async interaction => {
      if (interaction.customId === 'acceptDivorce') {
        userData.marriage = {};
        partnerData.marriage = {};
        await userData.save();
        await partnerData.save();

        interaction.reply({
          embeds: [
            defaultEmbed(
              '💔 Đã ly hôn',
              `${message.author.username} và ${partnerData.userID} đã chính thức ly hôn.`,
              'Pink'
            )
          ]
        });
        collector.stop();
      } else {
        interaction.reply({
          embeds: [defaultEmbed('❌ Từ chối ly hôn', 'Đối tác của bạn đã từ chối ly hôn.')]
        });
        collector.stop();
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        divorceRequest.edit({
          components: [],
          embeds: [defaultEmbed('⏰ Hết thời gian', 'Yêu cầu ly hôn đã hết thời gian trả lời.')]
        });
      }
    });
  }

/** --- 10. Xem thông tin hôn nhân "pmarry" --- */
if (command === 'pmarry') {
  if (!userData.marriedTo) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.', 'Red')]
    });
  }

  // Lấy dữ liệu đối tác từ cơ sở dữ liệu
  const partnerData = await User.findOne({ userId: userData.marriedTo });
  if (!partnerData) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Không tìm thấy thông tin đối tác.', 'Red')]
    });
  }

  // Lấy thông tin nhẫn kết hôn
  const marriageRing = userData.marriageRing || {};
  const ringName = marriageRing.name || 'Không xác định';
  const ringEmoji = marriageRing.emoji || '💍';

  // Dữ liệu hôn nhân
  const marriageDate = userData.marriageDate || 'Không xác định';
  const lovePoints = userData.lovePoints || 0;
  const caption = userData.marriageCaption ? `"${userData.marriageCaption}"` : null;

  // Hình ảnh và thumbnail (nếu có)
  const marriageImage = userData.marriageImage || null;
  const marriageThumbnail = userData.marriageThumbnail || null;

  // Embed hiển thị thông tin
  const embed = new EmbedBuilder()
    .setColor('Pink')
    .setTitle(`💞 Thông tin hôn nhân của ${message.author.username}`)
    .setDescription(`Bạn đang hạnh phúc với: **${partnerData.username}**`)
    .addFields(
      { name: '💍 Nhẫn kết hôn', value: `${ringEmoji} ${ringName}`, inline: true },
      { name: '❤️ Điểm yêu thương', value: `${lovePoints}`, inline: true },
      { name: '📅 Ngày kết hôn', value: `${marriageDate}`, inline: true }
    );

  // Thêm caption nếu có
  if (caption) {
    embed.addFields({ name: '✨ Caption', value: `${caption}` });
  }

  // Thêm hình ảnh hoặc emoji của nhẫn
  if (marriageImage) {
    embed.setImage(marriageImage);
  } else {
    embed.setDescription(`${embed.data.description}\n${ringEmoji}`);
  }

  // Thêm thumbnail nếu có
  if (marriageThumbnail) {
    embed.setThumbnail(marriageThumbnail);
  }

  return message.reply({ embeds: [embed] });
}

  /** --- 11. Thêm ảnh lớn "addimage" --- */
  if (command === 'addimage') {
  const imageUrl = args[0];
  if (!userData.marriedTo) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.', 'Red')]
    });
  }

  if (!imageUrl || !isValidImageUrl(imageUrl)) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng cung cấp một URL hình ảnh hợp lệ.', 'Red')]
    });
  }

  userData.marriageInfo = userData.marriageInfo || {};
  if (userData.marriageInfo.image) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Thông tin hôn nhân đã có ảnh lớn. Hãy xóa ảnh cũ trước.', 'Red')]
    });
  }

  userData.marriageInfo.image = imageUrl;
  await userData.save();

  return message.reply({
    embeds: [
      defaultEmbed(
        '✅ Thành công',
        `Đã thêm ảnh lớn vào thông tin hôn nhân.`,
        'Pink'
      )
    ]
  });
}

  /** --- 12. Xóa ảnh lớn "delimage" --- */
  if (command === 'delimage') {
  if (!userData.marriedTo) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.', 'Red')]
    });
  }

  if (!userData.marriageInfo || !userData.marriageInfo.image) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Thông tin hôn nhân không có ảnh lớn để xóa.', 'Red')]
    });
  }

  delete userData.marriageInfo.image;
  await userData.save();

  return message.reply({
    embeds: [
      defaultEmbed(
        '✅ Thành công',
        `Đã xóa ảnh lớn khỏi thông tin hôn nhân.`,
        'Pink'
      )
    ]
  });
}

  /** --- 13. Thêm thumbnail "addthumbnail" --- */
  if (command === 'addthumbnail') {
  const thumbnailUrl = args[0];
  if (!userData.marriedTo) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.', 'Red')]
    });
  }

  if (!thumbnailUrl || !isValidImageUrl(thumbnailUrl)) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng cung cấp một URL hình ảnh hợp lệ.', 'Red')]
    });
  }

  userData.marriageInfo = userData.marriageInfo || {};
  if (userData.marriageInfo.thumbnail) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Thông tin hôn nhân đã có thumbnail. Hãy xóa thumbnail cũ trước.', 'Red')]
    });
  }

  userData.marriageInfo.thumbnail = thumbnailUrl;
  await userData.save();

  return message.reply({
    embeds: [
      defaultEmbed(
        '✅ Thành công',
        `Đã thêm thumbnail vào thông tin hôn nhân.`,
        'Pink'
      )
    ]
  });
}

  /** --- Lệnh xóa ảnh thu nhỏ "delthumbnail" --- */
if (command === 'delthumbnail') {
  if (!userData.marriedTo) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.', 'Red')]
    });
  }

  if (!userData.marriageThumbnail) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có ảnh thu nhỏ trong thông tin hôn nhân.', 'Red')]
    });
  }

  userData.marriageThumbnail = null;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Ảnh thu nhỏ đã được xóa khỏi thông tin hôn nhân.', 'Pink')]
  });
}

  /** --- 15. Thêm caption "addcaption" --- */
  if (command === 'addcaption') {
    const caption = args.join(' ');
    if (!caption) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Hãy cung cấp nội dung caption để thêm!', 'Pink')]
      });
    }

    userData.marriage.caption = caption;
    await userData.save();

    return message.reply({
      embeds: [defaultEmbed('✅ Thêm caption thành công', `Caption đã được thêm: "${caption}"`, 'Pink')]
    });
  }

  /** --- 16. Xóa caption "delcaption" --- */
if (command === 'delcaption') {
  if (!userData.marriedTo) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.', 'Red')]
    });
  }

  if (!userData.marriageCaption) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có caption nào trong thông tin hôn nhân.', 'Red')]
    });
  }

  userData.marriageCaption = null;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('✅ Thành công', 'Caption đã được xóa khỏi thông tin hôn nhân.', 'Pink')]
  });
}
  /** --- 17. Tăng điểm yêu thương "luv" --- */
  /** --- Lệnh cộng điểm yêu thương "luv" --- */
if (command === 'luv') {
  if (!userData.marriedTo) {
    return message.reply({
      embeds: [defaultEmbed('❌ Lỗi', 'Bạn chưa kết hôn.', 'Red')]
    });
  }

  const now = Date.now();
  const lastLuvTime = userData.lastLuvTime || 0;

  if (now - lastLuvTime < 3600000) {
    const remainingTime = Math.ceil((3600000 - (now - lastLuvTime)) / 60000);
    return message.reply({
      embeds: [
        defaultEmbed(
          '⏰ Chờ thêm',
          `Bạn cần chờ **${remainingTime} phút** trước khi tăng điểm yêu thương lần tiếp theo.`,
          'Red'
        )
      ]
    });
  }

  userData.lastLuvTime = now;
  userData.lovePoints = (userData.lovePoints || 0) + 1;
  await userData.save();

  return message.reply({
    embeds: [defaultEmbed('❤️ Thành công', 'Bạn đã cộng 1 điểm yêu thương!', 'Pink')]
  });
}

/** --- 18. Xem lại 10 tin nhắn đã xóa "sn" --- */
  if (command === 'sn') {
    const deletedMessages = await DeletedMessages.find({ channelID: message.channel.id })
      .sort({ deletedAt: -1 })
      .limit(10);
    
    if (deletedMessages.length === 0) {
      return message.reply({
        embeds: [
          defaultEmbed('❌ Không có tin nhắn', 'Hiện tại không có tin nhắn nào đã bị xóa trong kênh này.', 'Red')
        ]
      });
    }

    const messageChunks = deletedMessages.map(
      (msg, index) =>
        `**${index + 1}.** [${msg.authorTag}](${msg.content ? msg.content : '*[Nội dung không khả dụng]*'})`
    );

    const embed = new EmbedBuilder()
      .setTitle('💬 10 tin nhắn đã xóa gần nhất')
      .setDescription(messageChunks.join('\n'))
      .setColor('Red')
      .setFooter({ text: 'Sử dụng các nút bên dưới để xem chi tiết' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('previous_sn')
        .setLabel('⬅️ Trước')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('next_sn')
        .setLabel('➡️ Tiếp')
        .setStyle(ButtonStyle.Primary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

/** --- 19. Thêm xu "addxu" --- */
  if (command === 'addxu') {
    if (message.author.id !== '1262464227348582492') {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.', 'Red')]
      });
    }

    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) {
      return message.reply({
        embeds: [
          defaultEmbed('❌ Lỗi', 'Vui lòng đề cập người dùng và số lượng xu muốn thêm.', 'Red')
        ]
      });
    }

    const targetData = await User.findOne({ userID: target.id });
    if (!targetData) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Người dùng không tồn tại trong cơ sở dữ liệu.', 'Red')]
      });
    }

    targetData.xu += amount;
    await targetData.save();

    return message.reply({
      embeds: [
        defaultEmbed('✅ Thành công', `Đã thêm **${amount} xu** cho **${target.tag}**.`, 'Red')
      ]
    });
  }

  /** --- 20. Trừ xu "delxu" --- */
  if (command === 'delxu') {
    if (message.author.id !== '1262464227348582492') {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.', 'Red')]
      });
    }

    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) {
      return message.reply({
        embeds: [
          defaultEmbed('❌ Lỗi', 'Vui lòng đề cập người dùng và số lượng xu muốn trừ.', 'Red')
        ]
      });
    }

    const targetData = await User.findOne({ userID: target.id });
    if (!targetData) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Người dùng không tồn tại trong cơ sở dữ liệu.', 'Red')]
      });
    }

    if (targetData.xu < amount) {
      return message.reply({
        embeds: [
          defaultEmbed('❌ Lỗi', 'Người dùng không đủ xu để trừ.', 'Red')
        ]
      });
    }

    targetData.xu -= amount;
    await targetData.save();

    return message.reply({
      embeds: [
        defaultEmbed('✅ Thành công', `Đã trừ **${amount} xu** từ **${target.tag}**.`, 'Red')
      ]
    });
  }

  /** --- 21. Thay đổi prefix "prefix" --- */
  if (command === 'prefix') {
    if (message.author.id !== '1262464227348582492') {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.', 'Red')]
      });
    }

    const newPrefix = args[0];
    if (!newPrefix) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Hãy cung cấp prefix mới!', 'Red')]
      });
    }

    config.prefix = newPrefix;
    return message.reply({
      embeds: [
        defaultEmbed('✅ Thành công', `Prefix của bot đã được thay đổi thành **${newPrefix}**`, 'Red')
      ]
    });
  }

  /** --- 22. Reset toàn bộ dữ liệu bot "resetallbot" --- */
  if (command === 'resetallbot') {
    if (message.author.id !== '1262464227348582492') {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.', 'Red')]
      });
    }

    await User.deleteMany({});
    return message.reply({
      embeds: [
        defaultEmbed('✅ Thành công', 'Tất cả dữ liệu đã được reset.', 'Red')
      ]
    });
  }

  /** --- 23. Đặt cược Nổ Hũ "nohu" --- */
  if (command === 'nohu') {
    const bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0) {
      return message.reply({
        embeds: [
          defaultEmbed('❌ Lỗi', 'Vui lòng nhập số tiền cược hợp lệ!', 'Red')
        ]
      });
    }

    if (userData.xu < bet) {
      return message.reply({
        embeds: [
          defaultEmbed('❌ Lỗi', 'Bạn không đủ xu để đặt cược.', 'Red')
        ]
      });
    }

    const chance = message.author.id === '1262464227348582492' ? 100 : Math.random() * 50;
    const isWin = chance < 1; // 1/50 tỷ lệ thắng, nhưng admin 100% trúng.

    userData.xu -= bet;
    if (isWin) {
      const winnings = bet * 100;
      userData.xu += winnings;
      await userData.save();
      return message.reply({
        embeds: [
          defaultEmbed('🎉 Chúc mừng!', `Bạn đã trúng Nổ Hũ và nhận được **${winnings} xu**!`, 'Green')
        ]
      });
    } else {
      await userData.save();
      return message.reply({
        embeds: [
          defaultEmbed('😢 Chia buồn', 'Bạn đã thua cược. Hãy thử lại nhé!', 'Red')
        ]
      });
    }
  }

  /** --- 24. Hiển thị bảng xếp hạng "top" --- */
  if (command === 'top') {
    const topUsers = await User.find().sort({ xu: -1 }).limit(10);
    if (!topUsers || topUsers.length === 0) {
      return message.reply({
        embeds: [
          defaultEmbed('❌ Không có dữ liệu', 'Không có người dùng nào trong bảng xếp hạng.', 'Red')
        ]
      });
    }

    const leaderboard = topUsers.map(
      (user, index) => `**${index + 1}.** ${user.username} - **${user.xu.toLocaleString()} xu**`
    );

    return message.reply({
      embeds: [
        defaultEmbed('🏆 Bảng xếp hạng xu', leaderboard.join('\n'), 'Gold')
      ]
    });
  }

  /** --- 25. Hiển thị cửa hàng nhẫn "shop" --- */
  if (command === 'shop') {
    const rings = [
      { id: '01', name: 'ENZ Peridot', price: 100000, emoji: '💚' },
      { id: '02', name: 'ENZ Citrin', price: 200000, emoji: '💛' },
      { id: '03', name: 'ENZ Topaz', price: 500000, emoji: '🟡' },
      { id: '04', name: 'ENZ Spinel', price: 1000000, emoji: '🟥' },
      { id: '05', name: 'ENZ Aquamarine', price: 2500000, emoji: '💎' },
      { id: '06', name: 'ENZ Emerald', price: 5000000, emoji: '💚' },
      { id: '07', name: 'ENZ Ruby', price: 10000000, emoji: '❤️' },
      { id: '333', name: 'ENZ Sapphire', price: 25000000, emoji: '💙', lovePoints: 333 },
      { id: '999', name: 'ENZ Centenary', price: 99999999, emoji: '💖', lovePoints: 999 },
    ];

    const shopDescription = rings
      .map(
        (ring) =>
          `**ID:** ${ring.id} | ${ring.emoji} **${ring.name}** - **${ring.price.toLocaleString()} xu**${
            ring.lovePoints ? ` | ❤️ **+${ring.lovePoints} điểm yêu thương**` : ''
          }`
      )
      .join('\n');

    return message.reply({
      embeds: [
        defaultEmbed('💍 Cửa hàng nhẫn', shopDescription, 'Pink')
      ]
    });
  }

  /** --- 26. Thêm emoji vào nhẫn "addemoji" --- */
  if (command === 'addemoji') {
    if (message.author.id !== '1262464227348582492') {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.', 'Red')]
      });
    }

    const ringID = args[0];
    const emoji = args[1];
    if (!ringID || !emoji) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập ID nhẫn và emoji.', 'Red')]
      });
    }

    const ring = rings.find((r) => r.id === ringID);
    if (!ring) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Không tìm thấy nhẫn với ID đã cung cấp.', 'Red')]
      });
    }

    ring.emoji = emoji;

    return message.reply({
      embeds: [
        defaultEmbed('✅ Thành công', `Đã thêm emoji ${emoji} cho nhẫn **${ring.name}**.`, 'Pink')
      ]
    });
  }

  /** --- 27. Xóa emoji khỏi nhẫn "delimoji" --- */
  if (command === 'delimoji') {
    if (message.author.id !== '1262464227348582492') {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Bạn không có quyền sử dụng lệnh này.', 'Red')]
      });
    }

    const ringID = args[0];
    if (!ringID) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Vui lòng nhập ID nhẫn cần xóa emoji.', 'Red')]
      });
    }

    const ring = rings.find((r) => r.id === ringID);
    if (!ring) {
      return message.reply({
        embeds: [defaultEmbed('❌ Lỗi', 'Không tìm thấy nhẫn với ID đã cung cấp.', 'Red')]
      });
    }

    ring.emoji = '';

    return message.reply({
      embeds: [
        defaultEmbed('✅ Thành công', `Đã xóa emoji khỏi nhẫn **${ring.name}**.`, 'Pink')
      ]
    });
  }

});

// Đăng nhập bot
client.login(DISCORD_TOKEN);
