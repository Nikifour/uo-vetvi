/**
 * Что нового: табличка при запуске мира.
 *
 * Два случая, оба только для ведущего:
 *
 * 1. **Модуль обновился.** Установленная версия новее той, что ведущий уже
 *    видел, — показать, что изменилось с тех пор (разделы `CHANGELOG.md`
 *    между виденной и нынешней).
 * 2. **Вышла новая версия.** На GitHub лежит версия новее установленной —
 *    сказать об этом, показать её патчноут и где обновить. Foundry сама
 *    сообщает об обновлениях только на экране настройки, куда за столом
 *    не заходят неделями.
 *
 * Что ведущий уже видел, лежит флагом на его пользователе, а не настройкой
 * браузера: сел за другую машину — одна и та же табличка второй раз
 * не выскочит. «Напомнить позже» ничего не запоминает, «Не напоминать» —
 * запоминает эту версию. Проверку GitHub можно выключить в настройках
 * модуля: это запрос наружу при каждом запуске.
 *
 * Файл один и тот же во всех модулях UO — id модуля он узнаёт по своему
 * адресу, а слова несёт с собой, не трогая словарь модуля. Правится в одном
 * модуле и копируется: стенд следит, чтобы копии не разошлись.
 */

const ID = new URL(import.meta.url).pathname.match(/\/modules\/([^/]+)\//)?.[1];
const BOOSTY = "https://boosty.to/unshaved_orange";

const СЛОВА = {
  ru: {
    обновлён: "{модуль} обновлён до {версия}",
    чтоНового: "Что нового",
    вышла: "Вышла новая версия: {модуль} {версия}",
    установлена: "У вас стоит {версия}.",
    какОбновить: "Обновить: <strong>Настройка → Дополнения → Модули</strong>, кнопка «Обновить» у модуля (или «Проверить обновления»). Игру для этого придётся закрыть.",
    понятно: "Понятно",
    позже: "Напомнить позже",
    неНапоминать: "Не напоминать об этой версии",
    новости: "Новости и разборы — на <a href=\"{boosty}\">Boosty</a>.",
    пусто: "Подробностей в списке изменений нет.",
    настройка: "Сообщать о новых версиях",
    настройкаПодсказка: "Раз в запуск спрашивать GitHub, не вышла ли новая версия модуля, и показывать ведущему её список изменений.",
  },
  en: {
    обновлён: "{модуль} updated to {версия}",
    чтоНового: "What's new",
    вышла: "A new version is out: {модуль} {версия}",
    установлена: "You have {версия} installed.",
    какОбновить: "To update: <strong>Setup → Add-ons → Modules</strong>, the “Update” button next to the module (or “Check for Updates”). You will need to close the game first.",
    понятно: "Got it",
    позже: "Remind me later",
    неНапоминать: "Don't remind me about this version",
    новости: "News and write-ups on <a href=\"{boosty}\">Boosty</a>.",
    пусто: "The changelog has no details for this version.",
    настройка: "Announce new versions",
    настройкаПодсказка: "Once per launch, ask GitHub whether a new version of the module is out and show its changelog to the GM.",
  },
};

/*
 * Язык — тот же, что у самого модуля: настройка «Язык модуля» (`yazyk`, её
 * заводит yazyk.mjs), а при «как в Foundry» — русский только при русском Foundry.
 */
const язык = () => {
  let выбор = "auto";
  try { выбор = game.settings.get(ID, "yazyk"); } catch { /* модуль без настройки языка */ }
  if (выбор === "ru" || выбор === "en") return выбор;
  return game.i18n?.lang === "ru" ? "ru" : "en";
};
const слово = (ключ, данные = {}) => String(СЛОВА[язык()][ключ]).replace(/\{(\S+?)\}/g, (_, к) => данные[к] ?? `{${к}}`);
const экранировать = s => foundry.utils.escapeHTML(String(s ?? ""));

/* ─────────────────────────── список изменений ─────────────────────────── */

/**
 * Разделы `## 0.7.0` из CHANGELOG: версия → строки раздела.
 * Заголовок раздела может нести дату: `## 0.7.0 — 2026-09-14`.
 */
export function разделы(текст) {
  const итог = new Map();
  let текущая = null;
  for (const строка of String(текст ?? "").split(/\r?\n/)) {
    const з = /^##\s+v?(\d+(?:\.\d+)*)/.exec(строка);
    if (з) { текущая = з[1]; итог.set(текущая, []); continue; }
    if (текущая && !/^#\s/.test(строка)) итог.get(текущая).push(строка);
  }
  return итог;
}

/** Маленький markdown: списки, абзацы, жирный, курсив, код, ссылки. Больше в патчноуте не нужно. */
export function вHTML(строки) {
  const строчно = s => экранировать(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "<a href=\"$2\">$1</a>");
  const html = [];
  let пункты = null, абзац = [];
  const закрыть = () => {
    if (абзац.length) { html.push(`<p>${строчно(абзац.join(" "))}</p>`); абзац = []; }
    if (пункты) { html.push(`<ul>${пункты.map(п => `<li>${строчно(п)}</li>`).join("")}</ul>`); пункты = null; }
  };
  for (const сырая of строки) {
    const строка = сырая.trimEnd();
    const пункт = /^\s*[-*]\s+(.*)$/.exec(строка);
    if (!строка.trim()) { закрыть(); continue; }
    if (пункт) {
      if (абзац.length) закрыть();
      (пункты ??= []).push(пункт[1]);
    } else if (пункты && /^\s{2,}\S/.test(сырая)) {
      пункты[пункты.length - 1] += " " + строка.trim();
    } else {
      if (пункты) закрыть();
      абзац.push(строка.trim());
    }
  }
  закрыть();
  return html.join("");
}

/** Версии из списка, что новее `после` и не новее `до`, — от свежей к старой. */
export function версииМежду(список, после, до) {
  const новее = foundry.utils.isNewerVersion;
  return [...список.keys()]
    .filter(в => (!после || новее(в, после)) && !новее(в, до))
    .sort((а, б) => (новее(а, б) ? -1 : новее(б, а) ? 1 : 0));
}

async function прочесть(адрес, { json = false, таймаут = 6000 } = {}) {
  const стоп = new AbortController();
  const таймер = setTimeout(() => стоп.abort(), таймаут);
  try {
    const ответ = await fetch(адрес, { signal: стоп.signal, cache: "no-store" });
    if (!ответ.ok) return null;
    return json ? await ответ.json() : await ответ.text();
  } catch {
    return null;
  } finally {
    clearTimeout(таймер);
  }
}

/** CHANGELOG на языке модуля, а нет такого — русский. */
async function списокИзменений(корень) {
  const имя = язык() === "en" ? "CHANGELOG.en.md" : "CHANGELOG.md";
  const текст = (await прочесть(`${корень}/${имя}`)) ?? (имя !== "CHANGELOG.md" ? await прочесть(`${корень}/CHANGELOG.md`) : null);
  return разделы(текст);
}

function телоИзменений(список, версии) {
  if (!версии.length) return `<p class="notes">${слово("пусто")}</p>`;
  return версии.map(в => `
    ${версии.length > 1 ? `<h4>${экранировать(в)}</h4>` : ""}
    ${вHTML(список.get(в)) || `<p class="notes">${слово("пусто")}</p>`}`).join("");
}

/* ─────────────────────────── таблички ─────────────────────────── */

const флаг = () => game.user.getFlag(ID, "novoe") ?? {};
const запомнить = данные => game.user.setFlag(ID, "novoe", { ...флаг(), ...данные });

async function показать({ заголовок, тело, кнопки }) {
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.wait({
    window: { title: заголовок, icon: "fa-solid fa-gift" },
    position: { width: 520 },
    content: `<div class="uo-novoe" style="max-height: 60vh; overflow-y: auto">${тело}
      <p class="notes" style="margin-top: .8em">${слово("новости", { boosty: BOOSTY })}</p></div>`,
    buttons: кнопки,
    rejectClose: false,
  }).catch(() => null);
}

async function послеОбновления(модуль) {
  const виденная = флаг().videl;
  const версия = модуль.version;
  if (виденная && !foundry.utils.isNewerVersion(версия, виденная)) return;

  const список = await списокИзменений(`modules/${ID}`);
  // Флага ещё нет — модуль только поставили или обновили до версии с этой табличкой: показать нынешнюю.
  const версии = версииМежду(список, виденная ?? null, версия).slice(0, виденная ? undefined : 1);
  if (!версии.length && !виденная) { await запомнить({ videl: версия }); return; }

  await показать({
    заголовок: слово("обновлён", { модуль: модуль.title, версия }),
    тело: `<h3>${слово("чтоНового")}</h3>${телоИзменений(список, версии)}`,
    кнопки: [{ action: "ok", label: слово("понятно"), default: true }],
  });
  await запомнить({ videl: версия });
}

async function новаяВерсия(модуль) {
  const repo = String(модуль.url ?? "").match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/)?.[1];
  if (!repo) return;
  const корень = `https://raw.githubusercontent.com/${repo}/main`;
  const там = await прочесть(`${корень}/module.json`, { json: true });
  const версия = там?.version;
  if (!версия || !foundry.utils.isNewerVersion(версия, модуль.version)) return;
  if (флаг().ne_napominat === версия) return;

  const список = await списокИзменений(корень);
  const версии = версииМежду(список, модуль.version, версия);
  const выбор = await показать({
    заголовок: слово("вышла", { модуль: модуль.title, версия }),
    тело: `<p>${слово("установлена", { версия: экранировать(модуль.version) })}</p>
      <h3>${слово("чтоНового")}</h3>${телоИзменений(список, версии)}
      <p>${слово("какОбновить")}</p>`,
    кнопки: [
      { action: "позже", label: слово("позже"), default: true },
      { action: "не", label: слово("неНапоминать") },
    ],
  });
  if (выбор === "не") await запомнить({ ne_napominat: версия });
}

/**
 * Показать табличку «Что нового» нынешней версии прямо сейчас, ничего не запоминая.
 * Для макроса и для проверки: `(await import("/modules/uo-vetvi/scripts/novoe.mjs")).показатьНынешнее()`.
 */
export async function показатьНынешнее() {
  const модуль = game.modules.get(ID);
  const список = await списокИзменений(`modules/${ID}`);
  return показать({
    заголовок: слово("обновлён", { модуль: модуль.title, версия: модуль.version }),
    тело: `<h3>${слово("чтоНового")}</h3>${телоИзменений(список, список.has(модуль.version) ? [модуль.version] : [])}`,
    кнопки: [{ action: "ok", label: слово("понятно"), default: true }],
  });
}

if (ID) {
  Hooks.once("init", () => {
    // Подпись двуязычная: при init настройка «Язык модуля» ещё не заведена, и язык не узнать.
    game.settings.register(ID, "novoe-proveryat", {
      name: `${СЛОВА.ru.настройка} / ${СЛОВА.en.настройка}`,
      hint: `${СЛОВА.ru.настройкаПодсказка} / ${СЛОВА.en.настройкаПодсказка}`,
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
    });
  });

  Hooks.once("ready", () => {
    if (!game.user.isGM) return;
    const модуль = game.modules.get(ID);
    if (!модуль?.active) return;
    // Чуть позже запуска: чтобы табличка не легла под окна, которые мир открывает сам.
    setTimeout(async () => {
      try {
        await послеОбновления(модуль);
        if (game.settings.get(ID, "novoe-proveryat")) await новаяВерсия(модуль);
      } catch (e) {
        console.warn(`${ID} | что нового: не вышло`, e);
      }
    }, 2500);
  });
}
