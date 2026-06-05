import { AtmosphereService } from "./atmosphere-service.js";

const MODULE_ID = "pf2e-atmosphere-forge";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PF2eAtmosphereForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #lastResult = null;
  #formState = {
    environment: "forest",
    intensity: 50,
    useWeather: false,
    weather: "auto",
    useTimeOfDay: false,
    timeOfDay: "auto"
  };

  static DEFAULT_OPTIONS = {
    id: "pf2e-atmosphere-forge-app",
    tag: "form",
    window: {
      title: "PF2EATMOSPHEREFORGE.Title",
      icon: "fa-solid fa-smog",
      resizable: true
    },
    position: {
      width: 900,
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
      weatherOptions: AtmosphereService.getWeatherOptions(),
      timeOfDayOptions: AtmosphereService.getTimeOfDayOptions(),
      selectedEnvironment: this.#formState.environment,
      selectedIntensity: this.#formState.intensity,
      useWeather: this.#formState.useWeather,
      selectedWeather: this.#formState.weather,
      useTimeOfDay: this.#formState.useTimeOfDay,
      selectedTimeOfDay: this.#formState.timeOfDay,
      result: this.#lastResult,
      previewText: this.#lastResult?.text ?? game.i18n.localize("PF2EATMOSPHEREFORGE.Preview.Empty"),
      canSend: Boolean(this.#lastResult?.sections?.length)
    };
  }


  _onRender(context, options) {
    super._onRender(context, options);

    const form = this.element;
    const useWeather = form.querySelector("[name='useWeather']");
    const weather = form.querySelector("[name='weather']");
    const useTimeOfDay = form.querySelector("[name='useTimeOfDay']");
    const timeOfDay = form.querySelector("[name='timeOfDay']");

    const syncSceneParameterControls = () => {
      if (weather && useWeather) weather.disabled = !useWeather.checked;
      if (timeOfDay && useTimeOfDay) timeOfDay.disabled = !useTimeOfDay.checked;
    };

    useWeather?.addEventListener("change", syncSceneParameterControls);
    useTimeOfDay?.addEventListener("change", syncSceneParameterControls);

    syncSceneParameterControls();
  }

  static async #onGenerate(event, target) {
    event.preventDefault();

    const app = this;
    const form = target.closest("form");

    app.#formState = {
      environment: form?.querySelector("[name='environment']")?.value ?? "forest",
      intensity: Number(form?.querySelector("[name='intensity']")?.value ?? 50),
      useWeather: form?.querySelector("[name='useWeather']")?.checked ?? false,
      weather: form?.querySelector("[name='weather']")?.value ?? "auto",
      useTimeOfDay: form?.querySelector("[name='useTimeOfDay']")?.checked ?? false,
      timeOfDay: form?.querySelector("[name='timeOfDay']")?.value ?? "auto"
    };

    app.#lastResult = await AtmosphereService.generate(app.#formState);
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
      sceneParameters: this.#lastResult.sceneParameters,
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
