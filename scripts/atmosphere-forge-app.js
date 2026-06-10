import { AtmosphereService } from "./atmosphere-service.js";
import { WeatherContextService } from "./weather-context-service.js";

const MODULE_ID = "pf2e-atmosphere-forge";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PF2eAtmosphereForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #lastResult = null;
  #weatherContext = WeatherContextService.getContext();
  #formState = {
    environment: "forest",
    intensity: 50,
    useWeather: false,
    weather: "auto",
    useTimeOfDay: false,
    timeOfDay: "auto",
    useSeason: false,
    season: "auto"
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
      sendPublic: PF2eAtmosphereForgeApp.#onSendPublic,
      reloadWeather: PF2eAtmosphereForgeApp.#onReloadWeather,
      rerollSection: PF2eAtmosphereForgeApp.#onRerollSection
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/atmosphere-forge.hbs`
    }
  };

  async _prepareContext(options) {
    const weatherForgeActive = WeatherContextService.isWeatherForgeActive();
    const weatherContext = this.#weatherContext;

    return {
      moduleId: MODULE_ID,
      weatherForgeActive,
      weatherContext,
      environments: AtmosphereService.getAvailableEnvironments(),
      weatherOptions: AtmosphereService.getWeatherOptions(),
      timeOfDayOptions: AtmosphereService.getTimeOfDayOptions(),
      seasonOptions: AtmosphereService.getSeasonOptions(),
      selectedEnvironment: this.#formState.environment,
      selectedIntensity: this.#formState.intensity,
      useWeather: this.#formState.useWeather,
      selectedWeather: this.#formState.weatherSelection ?? this.#formState.weather,
      useTimeOfDay: this.#formState.useTimeOfDay,
      selectedTimeOfDay: this.#formState.timeOfDaySelection ?? this.#formState.timeOfDay,
      useSeason: this.#formState.useSeason,
      selectedSeason: this.#formState.seasonSelection ?? this.#formState.season,
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
    const useSeason = form.querySelector("[name='useSeason']");
    const season = form.querySelector("[name='season']");

    const syncSceneParameterControls = () => {
      if (weather && useWeather) weather.disabled = !useWeather.checked;
      if (timeOfDay && useTimeOfDay) timeOfDay.disabled = !useTimeOfDay.checked;
      if (season && useSeason) season.disabled = !useSeason.checked;
    };

    useWeather?.addEventListener("change", syncSceneParameterControls);
    useTimeOfDay?.addEventListener("change", syncSceneParameterControls);
    useSeason?.addEventListener("change", syncSceneParameterControls);

    syncSceneParameterControls();
  }

  static async #onGenerate(event, target) {
    event.preventDefault();

    const app = this;
    const form = target.closest("form");

    const weatherSelection = form?.querySelector("[name='weather']")?.value ?? "auto";
    const timeOfDaySelection = form?.querySelector("[name='timeOfDay']")?.value ?? "auto";
    const seasonSelection = form?.querySelector("[name='season']")?.value ?? "auto";

    app.#formState = {
      environment: form?.querySelector("[name='environment']")?.value ?? "forest",
      intensity: Number(form?.querySelector("[name='intensity']")?.value ?? 50),
      useWeather: form?.querySelector("[name='useWeather']")?.checked ?? false,
      weather: weatherSelection === "auto" ? app.#weatherContext.weather : weatherSelection,
      weatherSelection,
      useTimeOfDay: form?.querySelector("[name='useTimeOfDay']")?.checked ?? false,
      timeOfDay: timeOfDaySelection === "auto" ? app.#weatherContext.timeOfDay : timeOfDaySelection,
      timeOfDaySelection,
      useSeason: form?.querySelector("[name='useSeason']")?.checked ?? false,
      season: seasonSelection === "auto" ? app.#weatherContext.season : seasonSelection,
      seasonSelection
    };

    app.#lastResult = await AtmosphereService.generate(app.#formState);
    app.render({ force: true });
  }



  static async #onRerollSection(event, target) {
    event.preventDefault();

    const sectionId = target.dataset.sectionId;
    if (!sectionId || !this.#lastResult) return;

    this.#lastResult = await AtmosphereService.rerollSection(this.#lastResult, sectionId);
    this.render({ force: true });
  }

  static async #onReloadWeather(event, target) {
    event.preventDefault();

    this.#weatherContext = WeatherContextService.getContext();

    if (this.#weatherContext.weather && this.#weatherContext.weather !== "auto") {
      this.#formState.useWeather = true;
      this.#formState.weather = this.#weatherContext.weather;
      this.#formState.weatherSelection = this.#weatherContext.weather;
    }

    if (this.#weatherContext.timeOfDay && this.#weatherContext.timeOfDay !== "auto") {
      this.#formState.useTimeOfDay = true;
      this.#formState.timeOfDay = this.#weatherContext.timeOfDay;
      this.#formState.timeOfDaySelection = this.#weatherContext.timeOfDay;
    }

    if (this.#weatherContext.season && this.#weatherContext.season !== "auto") {
      this.#formState.useSeason = true;
      this.#formState.season = this.#weatherContext.season;
      this.#formState.seasonSelection = this.#weatherContext.season;
    }

    ui.notifications.info(this.#weatherContext.label);
    this.render({ force: true });
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
