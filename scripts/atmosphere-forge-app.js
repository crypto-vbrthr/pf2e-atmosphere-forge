const MODULE_ID = "pf2e-atmosphere-forge";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PF2eAtmosphereForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pf2e-atmosphere-forge-app",
    tag: "form",
    window: {
      title: "PF2EATMOSPHEREFORGE.Title",
      icon: "fa-solid fa-smog",
      resizable: true
    },
    position: {
      width: 720,
      height: "auto"
    },
    classes: ["pf2e-atmosphere-forge"],
    actions: {
      generate: PF2eAtmosphereForgeApp.#onGenerate
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/atmosphere-forge.hbs`
    }
  };

  async _prepareContext(options) {
    const weatherForgeActive = game.modules.get("pf2e-weather-forge")?.active ?? false;

    return {
      moduleId: MODULE_ID,
      weatherForgeActive,
      previewText: game.i18n.localize("PF2EATMOSPHEREFORGE.Preview.Empty")
    };
  }

  static #onGenerate(event, target) {
    event.preventDefault();

    const appElement = target.closest(".application");
    const preview = appElement?.querySelector("[data-preview]");
    if (!preview) return;

    preview.textContent = game.i18n.localize("PF2EATMOSPHEREFORGE.Preview.Dummy");
  }
}
