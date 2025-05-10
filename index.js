// ✅ index.js
const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
  } = require('discord.js');
const schedule = require('node-schedule');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const reactionMap = new Map();
const jobMap = new Map();

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    client.user.setActivity(`🦻 멤버들 예약`, {
        type: 2 // Playing (기본값), 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching, 5 = Competing
    });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.name !== "🌀ㅣ모집방") return;

    const fireDate = extractTime(message.content, message.createdAt);
    if (!fireDate || fireDate < new Date()) return;

    const userIds = [];
    reactionMap.set(message.id, userIds);

    const scheduleNotification = async (targetTime, label) => {
        const utcTarget = new Date(targetTime.getTime() - 9 * 60 * 60 * 1000);
        console.log(`targetTime : ${targetTime}`);

        const job = schedule.scheduleJob(utcTarget, async () => {
            console.log("✅ 테스트 스케줄 실행됨");
            try {
                const userIds = reactionMap.get(message.id) || [];
                const mentionIds = [...new Set([message.author.id, ...userIds])];
                if (mentionIds.length === 0) return;

                const mentions = mentionIds.map(id => `<@${id}>`).join(' ');
                const alertChannel = await client.channels.fetch(process.env.ALERT_CHANNEL_ID);

                const embed = {
                    color: label.includes('5분') ? 0x3B82F6 : 0xEF4444,
                    title: ` **${label}** `,
                    author: {
                        name: message.member?.displayName || message.author.username,
                        icon_url: message.author.displayAvatarURL({ dynamic: true })
                    },
                    description: [
                        `\u200B`,
                        `**🔔 예약 시간**\n> 🕘 ${formatKoreanDate(targetTime)}`,
                        ``,
                        `**📝 모집 내용**\n> ${message.content.length > 100 ? message.content.slice(0, 100) + '...' : message.content}`
                    ].join('\n'),
                };

                await alertChannel.send({ content: `🔔 ${mentions}`, embeds: [embed] });
                console.log(`[${label} 알림 전송 성공] ID: ${message.id}`);
            } catch (err) {
                console.error(`❌ ${label} 알림 전송 실패`, err);
            }
        });

        jobMap.set(`${message.id}-${label}`, job);
    };


    // const now = new Date(Date.now() + 9 * 60 * 60 * 1000);

    scheduleNotification(fireDate, '지금부터 늦으면 지각입니다!!');
    scheduleNotification(new Date(fireDate.getTime() - 5 * 60 * 1000), '게임 시작 5분전!!');
    // scheduleNotification(new Date(fireDate.getTime() - 9 * 60 * 60 * 1000), '지금부터 늦으면 지각입니다!!');
    // scheduleNotification(new Date(fireDate.getTime() - 9 * 60 * 60 * 1000 - 5 * 60 * 1000), '게임 시작 5분전!!');

    console.log(`[예약 콘솔로그] ${formatKoreanDate(fireDate)} 예약 완료됨. 메시지 ID: ${message.id}`);

    if (containsDayOfWeek(message.content)) {
        const alertChannel = await client.channels.fetch(process.env.ALERT_CHANNEL_ID);
        const embed = {
            color: 0x10B981, // 예약 완료 색상
            title: `📌 예약이 등록되었습니다!`,
            author: {
                name: message.member?.displayName || message.author.username,
                icon_url: message.author.displayAvatarURL({ dynamic: true })
            },
            description: [
                `\u200B`,
                `**🔔 예약 시간**\n> 🕘 ${formatKoreanDate(fireDate)}`,
                ``,
                `**📝 모집 내용**\n> ${message.content.length > 100 ? message.content.slice(0, 100) + '...' : message.content}`
            ].join('\n'),
        };
        alertChannel.send({ embeds: [embed] });
    }
});

client.on('messageReactionAdd', (reaction, user) => {
    if (user.bot) return;
    const list = reactionMap.get(reaction.message.id) || [];
    if (!list.includes(user.id)) list.push(user.id);
    reactionMap.set(reaction.message.id, list);
});

client.on('messageDelete', async (message) => {
    const labels = ['지금부터 늦으면 지각입니다!!', '게임 시작 5분전!!'];

    const hasAnyJob = labels.some(label => jobMap.has(`${message.id}-${label}`));
    if (!hasAnyJob) return;
    
    labels.forEach(label => {
        const key = `${message.id}-${label}`;
        if (jobMap.has(key)) {
            jobMap.get(key).cancel();
            jobMap.delete(key);
        }
    });

    const userIds = reactionMap.get(message.id) || [];

    reactionMap.delete(message.id);

    console.log(`🗑️ 예약 취소됨: ${message.id}`);

    try {
        const alertChannel = await client.channels.fetch(process.env.ALERT_CHANNEL_ID);
        const mentionIds = [...new Set([message.author?.id, ...userIds])].filter(Boolean);
        const mentions = mentionIds.map(id => `<@${id}>`).join(' ') || '🔕 알림 대상 없음';

        const embed = {
            color: 0xF87171, // 붉은색 경고 느낌
            title: '🗑️ 예약이 취소되었습니다!',
            description: [
              `\u200b`,
              '**📝 모집 내용**',
              `> ${message.content || '삭제된 메시지'}`,
              '',
              '**👥 알림 대상**',
              `> ${mentions}`
            ].join('\n'),
            author: {
              name: message.member?.displayName || message.author?.username || '알 수 없음',
              icon_url: message.author?.displayAvatarURL?.({ dynamic: true }) || null
            }
          };

        await alertChannel.send({ content: `❌ ${mentions}`, embeds: [embed] });
    } catch (err) {
        console.error(`❌ 예약 취소 알림 전송 실패`, err);
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);

function extractTime(text, messageTime) {
    // const dayMap = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };
    const dayMap = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
    // const now = new Date(messageTime);
    const now = new Date(messageTime.getTime() + 9 * 60 * 60 * 1000); // KST
    // console.log("🔥 now:", now.toString());
    // console.log("🔥 현재 요일:", now.getDay());
    // const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // KST 기준
    // const nowDay = (kst.getUTCDay() + 6) % 7; // 0(월) ~ 6(일)
    // const nowDay = (now.getDay() + 6) % 7; // 0(월) ~ 6(일)로 맞춤

    const nowDay = now.getDay();

    const patterns = [
        /(\d{1,2})시\s*(\d{1,2})분/,
        /(\d{1,2}):(\d{1,2})/,
        /\b(\d{3,4})\b/,
        /(\d{1,2})시\s*반/,
        /(\d{1,2})시반/,
        /(\d{1,2})시/ 
    ];

    const ampmMatch = text.match(/(오전|오후)/);
    const isAM = ampmMatch?.[0] === '오전';
    const isPM = ampmMatch?.[0] === '오후';

    const hasNextKeyword = /다음\s*주/.test(text);
    const weekdayMatch = [...text.matchAll(/[월화수목금토일]/g)];
    const foundDays = weekdayMatch.map(match => dayMap[match[0]]);

    let targetOffset = 0;

    if (foundDays.length > 0) {
        const targetDay = foundDays[0];

        console.log("🔥 현재 요일:", nowDay);
        console.log("🎯 대상 요일:", targetDay);
        console.log("🧩 hasNextKeyword:", hasNextKeyword);

        if (hasNextKeyword) {
            // 지난 요일
            if(nowDay > targetDay){
                const baseOffset = (targetDay - nowDay + 7) % 7;
                targetOffset = baseOffset === 0 && targetDay !== nowDay ? 7 : baseOffset;
            }
            // 지나지 않은 요일
            else{
                const baseOffset = (targetDay - nowDay + 7) % 7;
                targetOffset = baseOffset === 0 ? 7 : baseOffset + 7;
            }   
        } else {
            const baseOffset = (targetDay - nowDay + 7) % 7;
            targetOffset = baseOffset === 0 && targetDay !== nowDay ? 7 : baseOffset;
        }
        console.log("📆 최종 targetOffset:", targetOffset);
    }

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let hour, minute;

        if (pattern === patterns[3] || pattern === patterns[4]) {
            hour = parseInt(match[1]);
            minute = 30;
        } else if (match[0].includes('시')) {
            hour = parseInt(match[1]);
            // minute = parseInt(match[2]);
            minute = match[2] ? parseInt(match[2]) : 0;
        } else if (match[0].includes(':')) {
            hour = parseInt(match[1]);
            minute = parseInt(match[2]);
        } else if (match[1].length === 3) {
            hour = parseInt(match[1][0]);
            minute = parseInt(match[1].slice(1));
        } else {
            hour = parseInt(match[1].slice(0, 2));
            minute = parseInt(match[1].slice(2));
        }
    
            if (isPM && hour < 12) hour += 12;
            if (isAM && hour === 12) hour = 0;
    
            // 오전/오후 없이 요일도 없으면 → 오후 보정
            if (!isAM && !isPM && foundDays.length === 0) {
                const temp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
                if (temp <= now && hour < 12) hour += 12;
            }
    
            return new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + targetOffset,
                hour, minute, 0
            );
        }
    }

    return null;
}

function formatKoreanTime(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const hour12 = hours % 12 || 12;
    return `${ampm} ${hour12}:${minutes}`;
}

function formatKoreanDate(date) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth()+1}월 ${date.getDate()}일 (${dayNames[date.getDay()]}) ${formatKoreanTime(date)}`;
}

function containsDayOfWeek(text) {
    return /[월화수목금토일]/.test(text);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

async function registerGuildCommands() {
  const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📘 꽹가리 봇 사용법을 안내합니다.').toJSON()
  ];
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✅ 서버 전용 슬래시 명령어 등록 완료');
}

async function clearGlobalCommands() {
  const commands = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
  for (const cmd of commands) {
    console.log(`🧹 글로벌 명령 삭제 중: ${cmd.name}`);
    await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, cmd.id));
  }
  console.log('✅ 글로벌 명령어 정리 완료');
}

async function clearGuildCommands(guildId) {
  const commands = await rest.get(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId));
  for (const cmd of commands) {
    console.log(`🧹 서버(${guildId}) 명령 삭제 중: ${cmd.name}`);
    await rest.delete(Routes.applicationGuildCommand(process.env.CLIENT_ID, guildId, cmd.id));
  }
  console.log(`✅ 서버(${guildId}) 명령어 정리 완료`);
}

(async () => {
  await clearGlobalCommands();
  await clearGuildCommands(process.env.GUILD_ID);
  await registerGuildCommands();
})();
//#endregion

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📌  꽹과리 사용법 안내')
        .setDescription(
          `📘 예시 입력\n\n` +
          `**목요일 9시 30분 칼바람 내전 구함!**\n` +
          `⏱️ 자동 인식 지원\n\n` +
          `**- 시간: 9시반, 21:10, 2130, 오후 9:30, 10시 등**\n` +
            `**- 요일: 월화수목금토일, 다음주 월 등**\n` +
            `**  ex) 오늘이 수요일인 경우 월요일, 화요일 → 다음 주 요일 예약**\n` +
          `✅ 알림 조건\n\n` +
          `**- 이모지 누른 사람 + 작성자에게만 알림**\n` +
                `**- 정시: 지금부터 늦으면 지각입니다!!**\n` +
                `**- 5분 전: 게임 시작 5분전!!**\n` +
                `**- 시간은 무조건 기입해야하며 요일을 생략할 시 금일로 판단**\n` +
                `❌ 모집글 삭제 시\n` + 
                `**→ 예약 자동 취소 및 전체 태그 알림**\n`
        )
        .setColor(0x00BFFF)
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
});