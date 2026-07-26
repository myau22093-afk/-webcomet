/**
 * Локальные тесты маршрутизации расходов (без API).
 * Запуск: npx --yes tsx scripts/test-cost-optimization.ts
 */
import {
  classifySiteRequest,
  resolveOptimizedSitePlan,
} from "../lib/costOptimization";
import { matchSiteTemplate } from "../lib/siteTemplates";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function main() {
  // 1) Создание с нуля → Fable
  const create = resolveOptimizedSitePlan({
    prompt: "Создай сайт для цветочного магазина",
    isEdit: false,
    qualityMode: "quality",
  });
  assert(create.kind === "create", "create kind");
  assert(create.config.id === "claude-fable-5", `create model=${create.config.id}`);

  // 2) Правка цвета → Terra
  const edit = resolveOptimizedSitePlan({
    prompt: "Сделай кнопки красными",
    isEdit: false,
    qualityMode: "quality",
    modelId: "claude-fable-5",
  });
  assert(edit.kind === "edit", "edit kind");
  assert(edit.config.id === "gpt-5.6-terra", `edit model=${edit.config.id}`);

  const editFlag = resolveOptimizedSitePlan({
    prompt: "поправь отступы",
    isEdit: true,
    qualityMode: "quality",
  });
  assert(editFlag.kind === "edit", "isEdit flag");
  assert(editFlag.config.id === "gpt-5.6-terra", "isEdit → terra");

  // 3) Стоматология → шаблон + Terra
  const dent = resolveOptimizedSitePlan({
    prompt: "Создай сайт для стоматологии",
    isEdit: false,
    qualityMode: "quality",
  });
  assert(dent.kind === "template", "dentistry template kind");
  assert(dent.template?.id === "dentistry", `template=${dent.template?.id}`);
  assert(dent.config.id === "gpt-5.6-terra", `template model=${dent.config.id}`);
  assert(matchSiteTemplate("стоматология")?.id === "dentistry", "match dentistry");

  // 4) Чат → не генерируем сайт
  const chat = resolveOptimizedSitePlan({
    prompt: "Привет, помоги — что такое SEO?",
    isEdit: false,
    qualityMode: "quality",
  });
  assert(chat.kind === "chat", "chat kind");
  assert(chat.chatSuggested === true, "chatSuggested");

  assert(classifySiteRequest("убери футер", false) === "edit", "убери → edit");
  assert(classifySiteRequest("сделай лендинг", false) === "create", "лендинг → create");

  // 5) Мастер: простой → Sol + без нишевого template (structure adapt в route)
  const wizardSimple = resolveOptimizedSitePlan({
    prompt: "Сайт для стоматологии в Казани",
    isEdit: false,
    qualityMode: "quality",
    wizardMode: true,
    modelId: "gpt-5.6-sol",
  });
  assert(wizardSimple.kind === "create", "wizard simple kind");
  assert(wizardSimple.template == null, "wizard simple no niche template");
  assert(wizardSimple.config.id === "gpt-5.6-sol", `wizard simple model=${wizardSimple.config.id}`);

  // 6) Мастер: премиум → Kimi с нуля
  const wizardPremium = resolveOptimizedSitePlan({
    prompt: "Сайт для стоматологии",
    isEdit: false,
    qualityMode: "quality",
    wizardMode: true,
    modelId: "kimi-k2.6",
  });
  assert(wizardPremium.config.id === "kimi-k2.6", "wizard premium kimi");
  assert(wizardPremium.template == null, "wizard premium no template");

  console.log("\nAll cost-optimization routing tests passed.");
}

main();
