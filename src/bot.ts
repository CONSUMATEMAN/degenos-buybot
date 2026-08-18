import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { isAddress } from "ethers";
import { config } from "./config.js";
import { getGroup, saveStore } from "./store.js";
import type { Store } from "./types/index.js";
import { buildTokenConfig } from "./services/blockchain.js";

type AddStep =
  | {
      step: "contract";
      chatId: string;
      userId: number;
    }
  | {
      step: "link";
      chatId: string;
      userId: number;
      tokenContract: string;
    };

type LinkStep = {
  chatId: string;
  userId: number;
};

type TextStep =
  | {
      step: "emoji";
      chatId: string;
      userId: number;
    }
  | {
      step: "minbuy";
      chatId: string;
      userId: number;
    }
  | {
      step: "buystep";
      chatId: string;
      userId: number;
    }
  | {
      step: "media";
      chatId: string;
      userId: number;
    }
  | {
      step: "link";
      chatId: string;
      userId: number;
    };

function chatId(ctx: Context): string {
  if (!ctx.chat) {
    throw new Error("This command must be used in a chat.");
  }

  return String(ctx.chat.id);
}

async function isGroupAdmin(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !ctx.from) {
    return false;
  }

  if (config.superAdminIds.has(String(ctx.from.id))) {
    return true;
  }

  if (ctx.chat.type === "private") {
    return false;
  }

  const member = await ctx.telegram.getChatMember(
    ctx.chat.id,
    ctx.from.id
  );

  return (
    member.status === "administrator" ||
    member.status === "creator"
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeLink(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function tokenStatus(
  store: Store,
  id: string
): string {
  const group = store.groups[id];
  const token = group?.token;

  if (!token) {
    return "🟡 No token configured.";
  }

  return [
    "🟢 <b>DegenOS BuyBot</b>",
    "",
    `🪙 <b>${escapeHtml(token.name)}</b> (${escapeHtml(token.symbol)})`,
    `📄 <code>${token.contract}</code>`,
    `💧 Pair: <code>${token.pair}</code>`,
    "",
    `💵 Minimum Buy: $${token.minimumBuyUsd}`,
    `📈 Buy Step: $${token.buyStepUsd}`,
    `🤑 Buy Emoji: ${escapeHtml(token.buyEmoji)}`,
    `🔢 Buys announced: ${token.buyCount}`,
    `⚡ Status: ${token.enabled ? "ON" : "OFF"}`,
    "",
    `🖼️ Media: ${
      token.buyMediaUrl ? "Configured" : "Not configured"
    }`,
    `🏆 Competition: ${
      token.competitionEnabled ? "ON" : "OFF"
    }`,
    `🚀 Fast-Track: ${
      token.trendingFastTrack ? "ON" : "OFF"
    }`,
    `💎 Premium: ${
      token.premiumAdFree ? "ACTIVE" : "OFF"
    }`,
    "",
    `🔗 Community: ${
      group.communityLink
        ? `<a href="${escapeHtml(group.communityLink)}">Open Link</a>`
        : "Not configured"
    }`
  ].join("\n");
}

function settingsKeyboard(
  token: NonNullable<
    ReturnType<typeof getGroup>
  >["token"]
) {
  if (!token) {
    return Markup.inlineKeyboard([]);
  }

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "🖼️ GIF / Image",
        "settings:media"
      ),
      Markup.button.callback(
        `🤑 Emoji: ${token.buyEmoji}`,
        "settings:emoji"
      )
    ],
    [
      Markup.button.callback(
        `💵 Min Buy: $${token.minimumBuyUsd}`,
        "settings:minbuy"
      ),
      Markup.button.callback(
        `📈 Buy Step: $${token.buyStepUsd}`,
        "settings:buystep"
      )
    ],
    [
      Markup.button.callback(
        `🏆 Last Buy Comp: ${
          token.competitionEnabled ? "ON" : "OFF"
        }`,
        "settings:competition"
      )
    ],
    [
      Markup.button.callback(
        "⚙️ Group Settings",
        "settings:group"
      )
    ],
    [
      Markup.button.callback(
        `🚀 Trending Fast-Track: ${
          token.trendingFastTrack ? "ON" : "OFF"
        }`,
        "settings:trending"
      )
    ],
    [
      Markup.button.callback(
        `💎 Premium (Ad-Free): ${
          token.premiumAdFree ? "ON" : "OFF"
        }`,
        "settings:premium"
      )
    ],
    [
      Markup.button.callback(
        token.enabled
          ? "🟢 BuyBot ON"
          : "🔴 BuyBot OFF",
        "settings:toggle"
      ),
      Markup.button.callback(
        "🔄 Refresh",
        "settings:refresh"
      )
    ]
  ]);
}

function settingsText(
  group: ReturnType<typeof getGroup>
): string {
  const token = group.token;

  if (!token) {
    return "🟡 No token configured.";
  }

  return [
    "⚙️ <b>DegenOS BuyBot Settings</b>",
    "",
    `🪙 <b>${escapeHtml(token.name)}</b> (${escapeHtml(token.symbol)})`,
    `📄 <code>${token.contract}</code>`,
    "",
    "🎨 <b>Buy Display</b>",
    `🖼️ GIF / Image: ${
      token.buyMediaUrl ? "Configured" : "Not configured"
    }`,
    `🤑 Buy Emoji: ${escapeHtml(token.buyEmoji)}`,
    `💵 Min Buy: $${token.minimumBuyUsd}`,
    `📈 Buy Step: $${token.buyStepUsd}`,
    `🏆 Last Buy Comp: ${
      token.competitionEnabled ? "ON" : "OFF"
    }`,
    "",
    "⚙️ <b>Group Settings</b>",
    `🔗 Community: ${
      group.communityLink
        ? "Configured"
        : "Not configured"
    }`,
    "",
    "🚀 <b>Growth</b>",
    `🔥 Trending Fast-Track: ${
      token.trendingFastTrack ? "ON" : "OFF"
    }`,
    `💎 Premium (Ad-Free): ${
      token.premiumAdFree ? "ON" : "OFF"
    }`,
    "",
    `⚡ BuyBot Status: ${
      token.enabled ? "🟢 ON" : "🔴 OFF"
    }`
  ].join("\n");
}

async function sendSettings(
  ctx: Context,
  group: ReturnType<typeof getGroup>
): Promise<void> {
  if (!group.token) {
    await ctx.reply(
      "🟡 Add a token first with /add"
    );
    return;
  }

  await ctx.reply(
    settingsText(group),
    {
      parse_mode: "HTML",
      ...settingsKeyboard(group.token)
    }
  );
}

export function createBot(
  store: Store
): Telegraf {
  const bot = new Telegraf(config.telegramToken);

  const addSteps = new Map<string, AddStep>();
  const linkSteps = new Map<string, LinkStep>();
  const textSteps = new Map<string, TextStep>();

  // ─────────────────────────────────────
  // START
  // ─────────────────────────────────────

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "🟢 <b>DegenOS BuyBot is online.</b>",
        "",
        "Add me to a Telegram group and make me an admin.",
        "",
        "Then use:",
        "<code>/add</code>",
        "",
        "I will guide you through:",
        "1️⃣ Token contract",
        "2️⃣ Project / Community link",
        "",
        "Use <code>/settings</code> to configure BuyBot."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // HELP
  // ─────────────────────────────────────

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "🟢 <b>DegenOS BuyBot</b>",
        "",
        "<b>Admin Commands</b>",
        "",
        "/add — Add Token",
        "/settings — Group Settings",
        "/tutorial — BuyBot Tutorial",
        "/comp — Competition Info",
        "/winners — Competition Winners",
        "/bbns — BuyBot Same Service",
        "/remove — Remove Token & Clear Competition",
        "/status — Current Token Status",
        "",
        "<b>Quick Command</b>",
        "/minbuy 25 — Set minimum buy"
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // ADD
  // ─────────────────────────────────────

  bot.command("add", async (ctx) => {
    try {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.reply(
          "⛔ Only group administrators can configure BuyBot."
        );
        return;
      }

      const id = chatId(ctx);
      const userId = ctx.from?.id;

      if (!userId) {
        await ctx.reply(
          "❌ Could not identify the Telegram user."
        );
        return;
      }

      const text = ctx.message.text.trim();
      const parts = text.split(/\s+/);
      const contract = parts[1];

      if (!contract) {
        addSteps.set(id, {
          step: "contract",
          chatId: id,
          userId
        });

        await ctx.reply(
          [
            "🪙 <b>Add Token</b>",
            "",
            "Please paste the token contract address.",
            "",
            "Example:",
            "<code>0x123456789...</code>",
            "",
            "⛔ Send only the contract address."
          ].join("\n"),
          {
            parse_mode: "HTML"
          }
        );

        return;
      }

      if (!isAddress(contract)) {
        await ctx.reply(
          [
            "❌ Invalid contract address.",
            "",
            "Please use:",
            "<code>/add 0xYourTokenContract</code>"
          ].join("\n"),
          {
            parse_mode: "HTML"
          }
        );

        return;
      }

      await ctx.reply(
        "🔎 Validating token and finding its PancakeSwap pair..."
      );

      const token =
        await buildTokenConfig(contract);

      const group = getGroup(store, id);

      group.token = token;

      saveStore(store);

      addSteps.set(id, {
        step: "link",
        chatId: id,
        userId,
        tokenContract: token.contract
      });

      await ctx.reply(
        [
          "✅ <b>Token detected successfully!</b>",
          "",
          `🪙 <b>${escapeHtml(token.name)}</b> (${escapeHtml(token.symbol)})`,
          `📄 <code>${token.contract}</code>`,
          `💧 Pair: <code>${token.pair}</code>`,
          "",
          "🔗 <b>Next Step</b>",
          "",
          "Please send the Group, Channel, Community or Portal link that should appear on BuyBot notifications.",
          "",
          "Example:",
          "<code>https://t.me/DegenOS</code>"
        ].join("\n"),
        {
          parse_mode: "HTML"
        }
      );
    } catch (error) {
      console.error("Add error:", error);

      await ctx.reply(
        `❌ Could not add token.\n\n${
          error instanceof Error
            ? error.message
            : "Unknown error."
        }`
      );
    }
  });

  // ─────────────────────────────────────
  // REMOVE
  // ─────────────────────────────────────

  bot.command("remove", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.reply(
        "⛔ Only group administrators can configure BuyBot."
      );
      return;
    }

    const id = chatId(ctx);
    const group = getGroup(store, id);

    group.token = undefined;
    group.communityLink = undefined;

    addSteps.delete(id);
    linkSteps.delete(id);
    textSteps.delete(id);

    saveStore(store);

    await ctx.reply(
      [
        "🗑 <b>BuyBot Removed</b>",
        "",
        "The active token has been removed.",
        "The community link has been cleared.",
        "Competition settings have also been cleared.",
        "",
        "Use /add to configure another token."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────

  bot.command("status", async (ctx) => {
    await ctx.reply(
      tokenStatus(store, chatId(ctx)),
      {
        parse_mode: "HTML",
        link_preview_options: {
          is_disabled: true
        }
      }
    );
  });

  // ─────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────

  bot.command("settings", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.reply(
        "⛔ Only group administrators can configure BuyBot."
      );
      return;
    }

    const group = getGroup(
      store,
      chatId(ctx)
    );

    await sendSettings(ctx, group);
  });

  // ─────────────────────────────────────
  // TOKEN / CONTRACT
  // ─────────────────────────────────────

  bot.action("settings:token", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.answerCbQuery("Admin only.");
      return;
    }

    const group = getGroup(
      store,
      chatId(ctx)
    );

    if (!group.token) {
      await ctx.answerCbQuery(
        "No token configured."
      );
      return;
    }

    await ctx.answerCbQuery(
      "Token information"
    );

    await ctx.reply(
      [
        "🪙 <b>Current Token</b>",
        "",
        `Name: <b>${escapeHtml(group.token.name)}</b>`,
        `Symbol: <b>${escapeHtml(group.token.symbol)}</b>`,
        `Contract: <code>${group.token.contract}</code>`,
        `Pair: <code>${group.token.pair}</code>`
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // MIN BUY
  // ─────────────────────────────────────

  bot.action("settings:minbuy", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.answerCbQuery(
        "Admin only."
      );
      return;
    }

    const id = chatId(ctx);
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.answerCbQuery(
        "Could not identify user."
      );
      return;
    }

    textSteps.set(id, {
      step: "minbuy",
      chatId: id,
      userId
    });

    await ctx.answerCbQuery(
      "Enter minimum buy"
    );

    await ctx.reply(
      [
        "💵 <b>Minimum Buy</b>",
        "",
        "Send the minimum USD value for a BuyBot notification.",
        "",
        "Example:",
        "<code>25</code>"
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  bot.command("minbuy", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.reply("⛔ Admin only.");
      return;
    }

    const group = getGroup(
      store,
      chatId(ctx)
    );

    if (!group.token) {
      await ctx.reply(
        "🟡 Add a token first."
      );
      return;
    }

    const value = Number(
      ctx.message.text
        .trim()
        .split(/\s+/)[1]
    );

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      await ctx.reply(
        "Usage:\n/minbuy 25"
      );
      return;
    }

    group.token.minimumBuyUsd = value;

    saveStore(store);

    await ctx.reply(
      `✅ Minimum buy set to $${value}.`
    );
  });

  // ─────────────────────────────────────
  // BUY STEP
  // ─────────────────────────────────────

  bot.action("settings:buystep", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.answerCbQuery(
        "Admin only."
      );
      return;
    }

    const id = chatId(ctx);
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.answerCbQuery(
        "Could not identify user."
      );
      return;
    }

    textSteps.set(id, {
      step: "buystep",
      chatId: id,
      userId
    });

    await ctx.answerCbQuery(
      "Enter Buy Step"
    );

    await ctx.reply(
      [
        "📈 <b>Buy Step</b>",
        "",
        "Buy Step controls the USD progression used by BuyBot.",
        "",
        "Example:",
        "<code>10</code>",
        "",
        "This means each $10 level can be treated as the next buy milestone."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // EMOJI
  // ─────────────────────────────────────

  bot.action("settings:emoji", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.answerCbQuery(
        "Admin only."
      );
      return;
    }

    const id = chatId(ctx);
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.answerCbQuery(
        "Could not identify user."
      );
      return;
    }

    textSteps.set(id, {
      step: "emoji",
      chatId: id,
      userId
    });

    await ctx.answerCbQuery(
      "Send your Buy Emoji"
    );

    await ctx.reply(
      [
        "🤑 <b>Buy Emoji</b>",
        "",
        "Send one emoji or a short emoji combination.",
        "",
        "Examples:",
        "🟢",
        "🚀",
        "🔥",
        "💎"
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // GIF / IMAGE
  // ─────────────────────────────────────

  bot.action("settings:media", async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      await ctx.answerCbQuery(
        "Admin only."
      );
      return;
    }

    const id = chatId(ctx);
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.answerCbQuery(
        "Could not identify user."
      );
      return;
    }

    textSteps.set(id, {
      step: "media",
      chatId: id,
      userId
    });

    await ctx.answerCbQuery(
      "Send GIF/Image URL"
    );

    await ctx.reply(
      [
        "🖼️ <b>Buy GIF / Image</b>",
        "",
        "Send a direct image or GIF URL.",
        "",
        "Example:",
        "<code>https://example.com/buy.gif</code>",
        "",
        "Send <code>none</code> to remove the current media."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // COMPETITION
  // ─────────────────────────────────────

  bot.action(
    "settings:competition",
    async (ctx) => {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.answerCbQuery(
          "Admin only."
        );
        return;
      }

      const group = getGroup(
        store,
        chatId(ctx)
      );

      if (!group.token) {
        await ctx.answerCbQuery(
          "No token configured."
        );
        return;
      }

      group.token.competitionEnabled =
        !group.token.competitionEnabled;

      if (group.token.competitionEnabled) {
        group.token.competitionStartedAt =
          Date.now();
      } else {
        group.token.competitionStartedAt =
          undefined;

        group.token.competitionEndsAt =
          undefined;
      }

      saveStore(store);

      await ctx.answerCbQuery(
        group.token.competitionEnabled
          ? "Competition enabled."
          : "Competition disabled."
      );

      await ctx.editMessageText(
        settingsText(group),
        {
          parse_mode: "HTML",
          ...settingsKeyboard(
            group.token
          )
        }
      );
    }
  );

  // ─────────────────────────────────────
  // GROUP SETTINGS
  // ─────────────────────────────────────

  bot.action(
    "settings:group",
    async (ctx) => {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.answerCbQuery(
          "Admin only."
        );
        return;
      }

      const group = getGroup(
        store,
        chatId(ctx)
      );

      await ctx.answerCbQuery(
        "Group Settings"
      );

      await ctx.reply(
        [
          "⚙️ <b>Group Settings</b>",
          "",
          `🪙 Token: ${
            group.token
              ? escapeHtml(group.token.symbol)
              : "None"
          }`,
          "",
          `🔗 Community / Portal Link:`,
          group.communityLink
            ? `<a href="${escapeHtml(group.communityLink)}">${escapeHtml(group.communityLink)}</a>`
            : "Not configured",
          "",
          "Use the button below to change the link."
        ].join("\n"),
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🔗 Change Community / Portal Link",
                "settings:link"
              )
            ],
            [
              Markup.button.callback(
                "⬅️ Back to Settings",
                "settings:refresh"
              )
            ]
          ])
        }
      );
    }
  );

  // ─────────────────────────────────────
  // LINK
  // ─────────────────────────────────────

  bot.action(
    "settings:link",
    async (ctx) => {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.answerCbQuery(
          "Admin only."
        );
        return;
      }

      const id = chatId(ctx);
      const userId = ctx.from?.id;

      if (!userId) {
        await ctx.answerCbQuery(
          "Could not identify user."
        );
        return;
      }

      textSteps.set(id, {
        step: "link",
        chatId: id,
        userId
      });

      await ctx.answerCbQuery(
        "Send the link"
      );

      await ctx.reply(
        [
          "🔗 <b>Community / Portal Link</b>",
          "",
          "Send the link you want displayed on BuyBot notifications.",
          "",
          "Example:",
          "<code>https://t.me/DegenOS</code>"
        ].join("\n"),
        {
          parse_mode: "HTML"
        }
      );
    }
  );

  // ─────────────────────────────────────
  // TRENDING FAST TRACK
  // ─────────────────────────────────────

  bot.action(
    "settings:trending",
    async (ctx) => {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.answerCbQuery(
          "Admin only."
        );
        return;
      }

      const group = getGroup(
        store,
        chatId(ctx)
      );

      if (!group.token) {
        await ctx.answerCbQuery(
          "No token configured."
        );
        return;
      }

      group.token.trendingFastTrack =
        !group.token.trendingFastTrack;

      saveStore(store);

      await ctx.answerCbQuery(
        group.token.trendingFastTrack
          ? "Trending Fast-Track enabled."
          : "Trending Fast-Track disabled."
      );

      await ctx.editMessageText(
        settingsText(group),
        {
          parse_mode: "HTML",
          ...settingsKeyboard(
            group.token
          )
        }
      );
    }
  );

  // ─────────────────────────────────────
  // PREMIUM
  // ─────────────────────────────────────

  bot.action(
    "settings:premium",
    async (ctx) => {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.answerCbQuery(
          "Admin only."
        );
        return;
      }

      const group = getGroup(
        store,
        chatId(ctx)
      );

      if (!group.token) {
        await ctx.answerCbQuery(
          "No token configured."
        );
        return;
      }

      if (group.token.premiumAdFree) {
        group.token.premiumAdFree = false;

        saveStore(store);

        await ctx.answerCbQuery(
          "Premium disabled."
        );
      } else {
        await ctx.answerCbQuery(
          "Premium is a future paid feature."
        );

        await ctx.reply(
          [
            "💎 <b>DegenOS BuyBot Premium</b>",
            "",
            "Premium will provide:",
            "",
            "🚫 Ad-Free BuyBot",
            "⚡ Priority features",
            "🔥 Trending Fast-Track",
            "🎨 Advanced Buy Display",
            "🏆 Advanced Competition",
            "",
            "💎 Premium activation will be connected later."
          ].join("\n"),
          {
            parse_mode: "HTML"
          }
        );
      }
    }
  );

  // ─────────────────────────────────────
  // TOGGLE
  // ─────────────────────────────────────

  bot.action(
    "settings:toggle",
    async (ctx) => {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.answerCbQuery(
          "Admin only."
        );
        return;
      }

      const group = getGroup(
        store,
        chatId(ctx)
      );

      if (!group.token) {
        await ctx.answerCbQuery(
          "No token configured."
        );
        return;
      }

      group.token.enabled =
        !group.token.enabled;

      saveStore(store);

      await ctx.answerCbQuery(
        group.token.enabled
          ? "BuyBot enabled."
          : "BuyBot disabled."
      );

      await ctx.editMessageText(
        settingsText(group),
        {
          parse_mode: "HTML",
          ...settingsKeyboard(
            group.token
          )
        }
      );
    }
  );

  // ─────────────────────────────────────
  // REFRESH
  // ─────────────────────────────────────

  bot.action(
    "settings:refresh",
    async (ctx) => {
      if (!(await isGroupAdmin(ctx))) {
        await ctx.answerCbQuery(
          "Admin only."
        );
        return;
      }

      const group = getGroup(
        store,
        chatId(ctx)
      );

      if (!group.token) {
        await ctx.answerCbQuery(
          "No token configured."
        );
        return;
      }

      await ctx.answerCbQuery(
        "Settings refreshed."
      );

      await ctx.editMessageText(
        settingsText(group),
        {
          parse_mode: "HTML",
          ...settingsKeyboard(
            group.token
          )
        }
      );
    }
  );

  // ─────────────────────────────────────
  // TUTORIAL
  // ─────────────────────────────────────

  bot.command("tutorial", async (ctx) => {
    await ctx.reply(
      [
        "📘 <b>DegenOS BuyBot Tutorial</b>",
        "",
        "1️⃣ Add the bot to your group.",
        "2️⃣ Make the bot an administrator.",
        "3️⃣ Use /add.",
        "4️⃣ Paste your token contract.",
        "5️⃣ Send your Community / Portal link.",
        "6️⃣ Open /settings.",
        "7️⃣ Configure your BuyBot display.",
        "",
        "The bot will then monitor PancakeSwap buys and announce qualifying buys."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // COMPETITION INFO
  // ─────────────────────────────────────

  bot.command("comp", async (ctx) => {
    const group = getGroup(
      store,
      chatId(ctx)
    );

    if (!group.token) {
      await ctx.reply(
        "🟡 No token configured."
      );
      return;
    }

    await ctx.reply(
      [
        "🏆 <b>Buy Competition</b>",
        "",
        `Status: ${
          group.token.competitionEnabled
            ? "🟢 ACTIVE"
            : "🔴 OFF"
        }`,
        "",
        "Competition tracking is being prepared for the next DegenOS BuyBot stage.",
        "",
        "Use /settings to enable or disable the competition."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // WINNERS
  // ─────────────────────────────────────

  bot.command("winners", async (ctx) => {
    await ctx.reply(
      [
        "🏆 <b>Competition Winners</b>",
        "",
        "No completed competition has been recorded yet.",
        "",
        "The full leaderboard and winner system will be connected in the competition stage."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // BBNS
  // ─────────────────────────────────────

  bot.command("bbns", async (ctx) => {
    await ctx.reply(
      [
        "🤖 <b>DegenOS BuyBot</b>",
        "",
        "BuyBot Same Service",
        "",
        "This section will contain the DegenOS BuyBot service information and upgrade options.",
        "",
        "🚀 More features coming."
      ].join("\n"),
      {
        parse_mode: "HTML"
      }
    );
  });

  // ─────────────────────────────────────
  // TEXT INPUT HANDLER
  // ─────────────────────────────────────

  bot.on("text", async (ctx, next) => {
    try {
      if (!ctx.chat || !ctx.from) {
        await next();
        return;
      }

      const id = chatId(ctx);
      const userId = ctx.from.id;
      const text = ctx.message.text.trim();

      if (text.startsWith("/")) {
        await next();
        return;
      }

      if (!(await isGroupAdmin(ctx))) {
        await next();
        return;
      }

      // ────────────────────────────────
      // /ADD FLOW
      // ────────────────────────────────

      const addStep = addSteps.get(id);

      if (
        addStep &&
        addStep.userId === userId
      ) {
        if (addStep.step === "contract") {
          if (!isAddress(text)) {
            await ctx.reply(
              [
                "❌ Invalid BSC contract address.",
                "",
                "Please paste the <b>0x...</b> token contract."
              ].join("\n"),
              {
                parse_mode: "HTML"
              }
            );

            return;
          }

          try {
            await ctx.reply(
              "🔎 Detecting token and PancakeSwap pair..."
            );

            const token =
              await buildTokenConfig(text);

            const group =
              getGroup(store, id);

            group.token = token;

            saveStore(store);

            addSteps.set(id, {
              step: "link",
              chatId: id,
              userId,
              tokenContract:
                token.contract
            });

            await ctx.reply(
              [
                "🟢 <b>Token detected!</b>",
                "",
                `🪙 <b>${escapeHtml(token.name)}</b> (${escapeHtml(token.symbol)})`,
                `📄 <code>${token.contract}</code>`,
                `💧 Pair: <code>${token.pair}</code>`,
                "",
                "🔗 Now send the Group / Channel / Community / Portal link."
              ].join("\n"),
              {
                parse_mode: "HTML"
              }
            );
          } catch (error) {
            console.error(error);

            await ctx.reply(
              `❌ Could not detect token.\n\n${
                error instanceof Error
                  ? error.message
                  : "Unknown error."
              }`
            );
          }

          return;
        }

        if (addStep.step === "link") {
          const link =
            normalizeLink(text);

          if (!link) {
            await ctx.reply(
              [
                "❌ Invalid link.",
                "",
                "Please send a valid link such as:",
                "<code>https://t.me/DegenOS</code>"
              ].join("\n"),
              {
                parse_mode: "HTML"
              }
            );

            return;
          }

          const group =
            getGroup(store, id);

          if (!group.token) {
            addSteps.delete(id);

            await ctx.reply(
              "❌ Token configuration disappeared. Please use /add again."
            );

            return;
          }

          group.communityLink = link;
          group.token.enabled = true;

          saveStore(store);

          addSteps.delete(id);

          await ctx.reply(
            [
              "🎉 <b>DegenOS BuyBot Setup Complete!</b>",
              "",
              `🪙 <b>${escapeHtml(group.token.name)}</b> (${escapeHtml(group.token.symbol)})`,
              `📄 <code>${group.token.contract}</code>`,
              `💧 Pair: <code>${group.token.pair}</code>`,
              `💵 Minimum Buy: $${group.token.minimumBuyUsd}`,
              `📈 Buy Step: $${group.token.buyStepUsd}`,
              `🔗 <a href="${escapeHtml(link)}">Community / Portal</a>`,
              "",
              "🟢 <b>Buy monitoring is ACTIVE.</b>",
              "",
              "Use /settings to customize your BuyBot."
            ].join("\n"),
            {
              parse_mode: "HTML",
              link_preview_options: {
                is_disabled: true
              }
            }
          );

          return;
        }
      }

      // ────────────────────────────────
      // SETTINGS TEXT INPUT
      // ────────────────────────────────

      const textStep =
        textSteps.get(id);

      if (
        textStep &&
        textStep.userId === userId
      ) {
        const group =
          getGroup(store, id);

        if (!group.token) {
          textSteps.delete(id);

          await ctx.reply(
            "🟡 No token configured."
          );

          return;
        }

        // EMOJI
        if (textStep.step === "emoji") {
          if (text.length > 20) {
            await ctx.reply(
              "❌ Please send a short emoji combination."
            );
            return;
          }

          group.token.buyEmoji =
            text;

          saveStore(store);
          textSteps.delete(id);

          await ctx.reply(
            `✅ Buy Emoji updated to ${escapeHtml(text)}.`,
            {
              parse_mode: "HTML"
            }
          );

          return;
        }

        // MIN BUY
        if (textStep.step === "minbuy") {
          const value =
            Number(text);

          if (
            !Number.isFinite(value) ||
            value < 0
          ) {
            await ctx.reply(
              "❌ Please send a valid number, for example: 25"
            );
            return;
          }

          group.token.minimumBuyUsd =
            value;

          saveStore(store);
          textSteps.delete(id);

          await ctx.reply(
            `✅ Minimum Buy set to $${value}.`
          );

          return;
        }

        // BUY STEP
        if (textStep.step === "buystep") {
          const value =
            Number(text);

          if (
            !Number.isFinite(value) ||
            value <= 0
          ) {
            await ctx.reply(
              "❌ Please send a number greater than 0."
            );
            return;
          }

          group.token.buyStepUsd =
            value;

          saveStore(store);
          textSteps.delete(id);

          await ctx.reply(
            `✅ Buy Step set to $${value}.`
          );

          return;
        }

        // MEDIA
        if (textStep.step === "media") {
          if (
            text.toLowerCase() ===
            "none"
          ) {
            group.token.buyMediaUrl =
              undefined;

            group.token.buyMediaType =
              undefined;

            saveStore(store);
            textSteps.delete(id);

            await ctx.reply(
              "✅ Buy GIF / Image removed."
            );

            return;
          }

          const mediaUrl =
            normalizeLink(text);

          if (!mediaUrl) {
            await ctx.reply(
              [
                "❌ Invalid media URL.",
                "",
                "Please send a valid HTTP/HTTPS URL."
              ].join("\n")
            );

            return;
          }

          const lower =
            mediaUrl.toLowerCase();

          const isAnimation =
            lower.includes(".gif");

          group.token.buyMediaUrl =
            mediaUrl;

          group.token.buyMediaType =
            isAnimation
              ? "animation"
              : "photo";

          saveStore(store);
          textSteps.delete(id);

          await ctx.reply(
            [
              "✅ <b>Buy GIF / Image saved.</b>",
              "",
              `Type: ${
                isAnimation
                  ? "GIF / Animation"
                  : "Image"
              }`,
              `URL: <code>${escapeHtml(mediaUrl)}</code>`
            ].join("\n"),
            {
              parse_mode: "HTML"
            }
          );

          return;
        }

        // COMMUNITY LINK
        if (textStep.step === "link") {
          const link =
            normalizeLink(text);

          if (!link) {
            await ctx.reply(
              "❌ Please send a valid HTTP/HTTPS link."
            );
            return;
          }

          group.communityLink =
            link;

          saveStore(store);
          textSteps.delete(id);

          await ctx.reply(
            [
              "✅ <b>Community / Portal Link Updated</b>",
              "",
              `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`,
              "",
              "This link will appear on BuyBot notifications."
            ].join("\n"),
            {
              parse_mode: "HTML",
              link_preview_options: {
                is_disabled: true
              }
            }
          );

          return;
        }
      }

      await next();
    } catch (error) {
      console.error(
        "Text handler error:",
        error
      );

      await next();
    }
  });

  bot.catch((error) => {
    console.error(
      "Telegram bot error:",
      error
    );
  });

  return bot;
}