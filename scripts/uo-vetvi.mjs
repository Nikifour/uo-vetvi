/**
 * UO · Ветви сценария
 *
 * Архитектура кампании: узлы, развилки, метки и финалы. Ведущий пишет, что на
 * что выводит, отмечает случившееся — и видит, какие финалы ещё в игре, а какие
 * партия уже отрезала.
 *
 * Сценарий — обычный журнал, узел — его страница (svod.mjs). Рассуждения о
 * достижимости живут отдельно и без Foundry (pravila.mjs), поэтому проверяются
 * стендом: обещание «этот финал отрезан» дорого стоит, и подтверждать его надо
 * не на живой кампании.
 *
 * Видят граф только ведущие. Это кухня, а не стол.
 */

import {
  MODULE_ID, сценарии, этоСценарий, завести, расплести, свести,
  партии, текущаяПартия, завестиПартию, удалитьПартию, размножитьПартию, перейтиКПартии,
} from "./svod.mjs";
import { открыть } from "./graf.mjs";
import { источник, поискатьИсточник, обновитьИзИсточника } from "./iz-kompendiuma.mjs";
import * as правила from "./pravila.mjs";
import { Т, загрузитьЯзык } from "./yazyk.mjs";

const { DialogV2 } = foundry.applications.api;
const экранировать = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Журнал по чему угодно: по документу, id или имени. Для макросов. */
const журналПо = что => что?.documentName === "JournalEntry"
  ? что
  : (game.journal.get(что) ?? game.journal.getName(что) ?? null);

/* ─────────────────────────── вход в модуль ─────────────────────────── */

/** Выбор сценария: открыть написанный или завести новый. */
export async function выбратьСценарий() {
  if (!game.user.isGM) return null;

  const свои = сценарии();
  const список = свои.length
    ? свои.map(ж => {
      const с = свести(ж);
      const финалы = правила.итоги(с);
      const живых = финалы.filter(ф => ф.достижим && !ф.состоялся).length;

      /*
       * Партии перечисляем прямо здесь: выбирая сценарий, ведущий заодно
       * видит, какая компания в нём сейчас на ходу. Иначе про переключение
       * вспоминаешь уже после того, как отметил чужое пройденное.
       */
      const свои = с.партии;
      const очём = свои.length > 1
        ? `<em>${Т("партии: {кто}", {
            кто: свои.map(п => п.id === с.партия?.id
              ? `<strong>${экранировать(п.имя)}</strong>`
              : экранировать(п.имя)).join(", "),
          })}</em>`
        : "";

      return `<label class="uo-vetvi-vybor">
        <input type="radio" name="сценарий" value="${ж.id}">
        <span><strong>${экранировать(ж.name)}</strong>
        <em>${Т("узлов {у}, стрелок {с}", { у: с.узлы.length, с: с.рёбра.length })}${
          финалы.length ? Т(", финалов {ф} (в игре {ж})", { ф: финалы.length, ж: живых }) : ""}</em>
        ${очём}</span>
      </label>`;
    }).join("")
    : `<p class="uo-vetvi-tiho">${Т("Сценариев пока нет.")}</p>`;

  return DialogV2.wait({
    window: { title: Т("Ветви сценария"), icon: "fa-solid fa-code-branch" },
    position: { width: 460 },
    content: `<div class="uo-forma uo-vetvi">${список}</div>`,
    buttons: [
      {
        action: "открыть", label: Т("Открыть"), default: true,
        callback: (event, кнопка, диалог) => {
          const id = диалог.element.querySelector(`[name="сценарий"]:checked`)?.value;
          const журнал = id ? game.journal.get(id) : null;
          return журнал ? открыть(журнал) : ui.notifications.warn(Т("Сценарий не выбран."));
        },
      },
      {
        action: "новый", label: Т("Новый сценарий"),
        callback: async () => {
          const журнал = await завести(Т("Новый сценарий"));
          return журнал ? открыть(журнал) : null;
        },
      },
      { action: "отмена", label: Т("Отмена") },
    ],
  });
}

/* ─────────────────────── обновление из компендиума ─────────────────────── */

/**
 * Подтянуть свежую схему в журнал, который уже водят.
 *
 * Перетаскивание из пакета создаёт копию, а не обновляет — и прогресс
 * остаётся в старом журнале со старыми стрелками. Здесь наоборот: журнал
 * тот же, схема свежая, пройденное на месте.
 */
async function диалогОбновления(журнал) {
  if (!game.user.isGM || !журнал) return;

  let uuid = источник(журнал);

  if (!uuid) {
    const находки = await поискатьИсточник(журнал);
    if (!находки.length) {
      return void ui.notifications.warn(
        Т("Откуда этот журнал приехал, неизвестно, и одноимённого в пакетах нет. Перетащите сценарий из компендиума заново."));
    }
    const выбор = await DialogV2.wait({
      window: { title: Т("Откуда обновлять"), icon: "fa-solid fa-rotate" },
      position: { width: 460 },
      content: `
        <div class="uo-forma">
          <p class="uo-podskazka">${Т("Foundry не записал, откуда этот журнал. Нашлись одноимённые — выберите тот, что нужен: чужой тёзка перезапишет схему чужими стрелками.")}</p>
          ${находки.map((u, i) => `<label class="uo-igrok"><input type="radio" name="источник" value="${u}" ${i ? "" : "checked"}> ${экранировать(u)}</label>`).join("")}
        </div>`,
      buttons: [
        {
          action: "выбрать", label: Т("Это он"), default: true,
          callback: (event, кнопка, диалог) => диалог.element.querySelector(`[name="источник"]:checked`)?.value ?? null,
        },
        { action: "отмена", label: Т("Отмена"), callback: () => null },
      ],
    });
    if (!выбор) return;
    uuid = выбор;
  }

  const итог = await DialogV2.wait({
    window: { title: Т("Обновить из компендиума"), icon: "fa-solid fa-rotate" },
    position: { width: 480 },
    content: `
      <div class="uo-forma">
        <p>${Т("Источник: {uuid}", { uuid: `<code>${экранировать(uuid)}</code>` })}</p>
        <p class="uo-podskazka">${Т("Стрелки, метки и виды узлов приедут заново. Пройденное и поднятые метки кампании останутся: они в другом флаге, и сборка их не пишет.")}</p>
        <label>${Т("Обновить и текст страниц")} <input type="checkbox" name="текст" checked></label>
        <p class="uo-podskazka">${Т("Если вы правили текст прямо в мире, правки затрутся текстом из источника.")}</p>
        <label>${Т("Убрать страницы, которых нет в источнике")} <input type="checkbox" name="лишние"></label>
        <p class="uo-podskazka">${Т("По умолчанию такие страницы остаются: вдруг это ваша заметка на полях, а не удалённый узел.")}</p>
      </div>`,
    buttons: [
      {
        action: "обновить", label: Т("Обновить"), default: true,
        callback: (event, кнопка, диалог) => ({
          текст: !!диалог.element.querySelector(`[name="текст"]`)?.checked,
          убиратьЛишние: !!диалог.element.querySelector(`[name="лишние"]`)?.checked,
        }),
      },
      { action: "отмена", label: Т("Отмена"), callback: () => null },
    ],
  });

  if (!итог) return;

  const отчёт = await обновитьИзИсточника(журнал, uuid, итог);
  if (!отчёт) return;

  ui.notifications.info(Т("Обновлено страниц: {обновлено}, добавлено: {создано}.",
    { обновлено: отчёт.обновлено, создано: отчёт.создано }));

  if (отчёт.лишние.length) {
    ui.notifications.warn(Т("В источнике больше нет страниц: {имена}. Они остались в журнале.",
      { имена: отчёт.лишние.join(", ") }));
  }
}

/* ─────────────────────────── связь с Foundry ─────────────────────────── */

// Пункты в меню журнала: открыть граф или объявить журнал сценарием.
Hooks.on("getJournalEntryContextOptions", (приложение, пункты) => {
  if (!game.user.isGM) return;

  пункты.push({
    name: Т("Ветви: открыть граф"),
    icon: '<i class="fa-solid fa-code-branch"></i>',
    condition: цель => этоСценарий(game.journal.get(цель.dataset.entryId)),
    callback: цель => открыть(game.journal.get(цель.dataset.entryId)),
  }, {
    name: Т("Ветви: сделать сценарием"),
    icon: '<i class="fa-solid fa-code-branch"></i>',
    condition: цель => !этоСценарий(game.journal.get(цель.dataset.entryId)),
    callback: async цель => {
      const журнал = game.journal.get(цель.dataset.entryId);
      await завести(журнал.name, журнал);
      await открыть(журнал);
    },
  }, {
    name: Т("Ветви: обновить из компендиума"),
    icon: '<i class="fa-solid fa-rotate"></i>',
    condition: цель => этоСценарий(game.journal.get(цель.dataset.entryId)),
    callback: цель => диалогОбновления(game.journal.get(цель.dataset.entryId)),
  }, {
    name: Т("Ветви: перестать быть сценарием"),
    icon: '<i class="fa-solid fa-link-slash"></i>',
    condition: цель => этоСценарий(game.journal.get(цель.dataset.entryId)),
    callback: async цель => {
      const журнал = game.journal.get(цель.dataset.entryId);
      const ладно = await DialogV2.confirm({
        window: { title: Т("Перестать быть сценарием") },
        content: `<p>${Т("Убрать ветви у «{имя}»? Страницы и текст останутся, пропадут только стрелки, метки и отметки о пройденном.",
          { имя: экранировать(журнал.name) })}</p>`,
      });
      if (ладно) await расплести(журнал);
    },
  });
});

// Кнопка в шапке боковой панели журналов — чтобы граф не приходилось искать.
Hooks.on("renderJournalDirectory", (приложение, элемент) => {
  if (!game.user.isGM) return;
  const шапка = элемент.querySelector(".header-actions");
  if (!шапка || шапка.querySelector(`[data-uo-vetvi]`)) return;

  const кнопка = document.createElement("button");
  кнопка.type = "button";
  кнопка.dataset.uoVetvi = "1";
  кнопка.innerHTML = `<i class="fa-solid fa-code-branch"></i> ${Т("Ветви")}`;
  кнопка.addEventListener("click", () => выбратьСценарий());
  шапка.append(кнопка);
});

/* ─────────────────────────── для макросов ─────────────────────────── */

globalThis.UOVetvi = {
  /** Выбор сценария — то же, что кнопка «Ветви» в журналах. */
  panel: () => выбратьСценарий(),

  /** Открыть граф журнала: по документу, id или имени. */
  open: что => {
    const журнал = журналПо(что);
    return журнал ? открыть(журнал) : ui.notifications.warn(Т("Такого журнала нет."));
  },

  /** Завести новый сценарий. */
  create: имя => завести(имя),

  /** Список сценариев мира. */
  get list() { return сценарии().map(ж => ({ id: ж.id, имя: ж.name })); },

  /**
   * Партии, которые водят по этому сценарию.
   *
   * Схема у них общая, свой только ход. `switch` переключает ту, чей ход
   * пишется дальше, — это же делает и кнопка в панели графа.
   */
  parties: {
    list: что => партии(журналПо(что)),
    current: что => текущаяПартия(журналПо(что)),
    switch: (что, партияId) => перейтиКПартии(журналПо(что), партияId),
    add: (что, имя) => завестиПартию(журналПо(что), имя),
    /** Отделившаяся начинает с того же места: половина игроков ушла своим путём. */
    split: (что, партияId, имя) => размножитьПартию(журналПо(что), партияId, имя),
    remove: (что, партияId) => удалитьПартию(журналПо(что), партияId),
  },

  /** Сводка по сценарию: узлы, стрелки, метки, ход. Без партии — по текущей. */
  sum: (что, партияId) => свести(журналПо(что), партияId),

  /** Финалы: что состоялось, что ещё возможно, что отрезано. По партии. */
  endings: (что, партияId) => правила.итоги(globalThis.UOVetvi.sum(что, партияId)),

  /** Разбор написанного: сироты, тупики, метки ниоткуда. Ход тут не при чём. */
  check: что => правила.разбор(globalThis.UOVetvi.sum(что)),

  правила,
};

// Словарь читается один раз при запуске: какой язык выбран в игре, тот и берём.
Hooks.once("i18nInit", () => загрузитьЯзык(MODULE_ID));

console.log(`${MODULE_ID} | ветви сценария на месте`);
