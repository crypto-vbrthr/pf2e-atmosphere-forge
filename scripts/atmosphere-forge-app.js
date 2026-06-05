import { AtmosphereService } from "./atmosphere-service.js";

const MODULE_ID = "pf2e-atmosphere-forge";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PF2eAtmosphereForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #lastResult = null;

  static DEFAULT_OPTIONS = {
    id: "pf2e-atmosphere-forge-app",
    tag: "form",
    window: {
      title: "PF2EATMOSPHEREFORGE.Title",
      icon: "fa-solid fa-smog",
      resizable: true
    },
    position: {
      width: 800,
      height: "auto"
    },
    classes: ["pf2e-atmosphere-forge"],
    actions: {
      generate: PF2eAtmosphereForgeApp.#onGenerate,
      sendGM: PF2eAtmosphereForgeApp.#onSendGM,
      sendPublic: PF2eAtmosphereForgeApp.#onSendPublic
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
      environments: AtmosphereService.getAvailableEnvironments(),
      selectedEnvironment: this.#lastResult?.environment ?? "forest",
      selectedIntensity: this.#lastResult?.intensity ?? 50,
      result: this.#lastResult,
      previewText: this.#lastResult?.text ?? game.i18n.localize("PF2EATMOSPHEREFORGE.Preview.Empty"),
      canSend: Boolean(this.#lastResult?.text)
    };
  }

  static async #onGenerate(event, target) {
    event.preventDefault();

    const app = this;
    const form = target.closest("form");
    const environment = form?.querySelector("[name='environment']")?.value ?? "forest";
    const intensity = form?.querySelector("[name='intensity']")?.value ?? 50;

    app.#lastResult = await AtmosphereService.generate({ environment, intensity });
    app.render({ force: true });
  }

  static async #onSendGM(event, target) {
    event.preventDefault();
    await this.#sendToChat({ whisperGM: true });
  }

  static async #onSendPublic(event, target) {
    event.preventDefault();
    await this.#sendToChat({ whisperGM: false });
  }

  async #sendToChat({ whisperGM = false } = {}) {
    if (!this.#lastResult?.sections?.length) {
      ui.notifications.warn(game.i18n.localize("PF2EATMOSPHEREFORGE.Notification.NoPreview"));
      return;
    }

    const content = await renderTemplate(`modules/${MODULE_ID}/templates/chat-message.hbs`, {
      title: game.i18n.localize("PF2EATMOSPHEREFORGE.Chat.Title"),
      environmentLabel: this.#lastResult.environmentLabel,
      intensityLabel: this.#lastResult.intensityLabel,
      sections: this.#lastResult.sections
    });

    const chatData = {
      speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("PF2EATMOSPHEREFORGE.Title") }),
      content
    };

    if (whisperGM) {
      chatData.whisper = ChatMessage.getWhisperRecipients("GM").map((user) => user.id);
    }

    await ChatMessage.create(chatData);
  }
}
