import { AtmosphereService } from "./atmosphere-service.js";
import { WeatherContextService } from "./weather-context-service.js";
import { CITY_SOURCE_MODES, CityContextService } from "./city-context-service.js";

const MODULE_ID = "pf2e-atmosphere-forge";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PF2eAtmosphereForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #lastResult = null;
  #weatherContext = null;
  #cityContext = null;
  #citySourceAbortController = null;
  #formState = {
    environment: "forest",
    intensity: 50,
    intensityOverride: false,
    useCityEnvironment: true,
    useCityIntensity: true,
    includeCityContext: true,
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
      width: 1280,
      height: 900
    },
    classes: ["pf2e-atmosphere-forge"],
    actions: {
      generate: PF2eAtmosphereForgeApp.#onGenerate,
      sendGM: PF2eAtmosphereForgeApp.#onSendGM,
      sendPublic: PF2eAtmosphereForgeApp.#onSendPublic,
      reloadWeather: PF2eAtmosphereForgeApp.#onReloadContext,
      reloadContext: PF2eAtmosphereForgeApp.#onReloadContext,
      rerollSection: PF2eAtmosphereForgeApp.#onRerollSection
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/atmosphere-forge.hbs`
    }
  };

  async _prepareContext(options) {
    this.#weatherContext = await WeatherContextService.getContext();
    this.#cityContext = await CityContextService.getContext();

    const citySettlements = await CityContextService.listSettlements();
    const cityResolved = this.#cityContext.source === "cityForge" && Boolean(this.#cityContext.context);

    const effectiveEnvironment = cityResolved && this.#formState.useCityEnvironment
      ? this.#cityContext.derivedEnvironment
      : this.#formState.environment;

    if (
      cityResolved
      && this.#formState.useCityIntensity
      && !this.#formState.intensityOverride
      && Number.isFinite(Number(this.#cityContext.suggestedIntensity))
    ) {
      this.#formState.intensity = Number(this.#cityContext.suggestedIntensity);
    }

    const effectiveIntensity = this.#formState.intensity;

    return {
      moduleId: MODULE_ID,

      weatherForgeActive: this.#weatherContext.active,
      weatherForgeCompatible: this.#weatherContext.compatible,
      weatherContext: this.#weatherContext,

      cityForgeActive: this.#cityContext.status?.active ?? false,
      cityForgeCompatible: this.#cityContext.status?.compatible ?? false,
      cityIntegration: this.#prepareCityIntegration(this.#cityContext),
      citySourceModes: CITY_SOURCE_MODES.map((id) => ({
        id,
        label: game.i18n.localize(`PF2EATMOSPHEREFORGE.CityForge.SourceOptions.${id}`),
        selected: id === CityContextService.sourceMode()
      })),
      citySettlements: [
        {
          id: "",
          label: game.i18n.localize("PF2EATMOSPHEREFORGE.CityForge.SelectSettlement"),
          selected: !CityContextService.settlementId()
        },
        ...citySettlements.map((entry) => ({
          id: entry.id,
          label: entry.region ? `${entry.name} · ${entry.region}` : entry.name,
          selected: entry.id === CityContextService.settlementId()
        }))
      ],

      environments: AtmosphereService.getAvailableEnvironments(),
      weatherOptions: AtmosphereService.getWeatherOptions(),
      timeOfDayOptions: AtmosphereService.getTimeOfDayOptions(),
      seasonOptions: AtmosphereService.getSeasonOptions(),

      selectedEnvironment: this.#formState.environment,
      selectedIntensity: this.#formState.intensity,
      intensityOverride: this.#formState.intensityOverride,
      intensityUsesCitySuggestion: cityResolved && this.#formState.useCityIntensity && !this.#formState.intensityOverride,
      useCityEnvironment: this.#formState.useCityEnvironment,
      useCityIntensity: this.#formState.useCityIntensity,
      includeCityContext: this.#formState.includeCityContext,
      effectiveEnvironment,
      effectiveEnvironmentLabel: game.i18n.localize(
        `PF2EATMOSPHEREFORGE.Environment.${capitalize(effectiveEnvironment)}`
      ),
      effectiveIntensity,
      effectiveIntensityLabel: intensityLabel(effectiveIntensity),

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

    this.#citySourceAbortController?.abort();
    const controller = new AbortController();
    this.#citySourceAbortController = controller;
    const signal = controller.signal;

    const form = this.element;
    if (!form) return;

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

    useWeather?.addEventListener("change", syncSceneParameterControls, { signal });
    useTimeOfDay?.addEventListener("change", syncSceneParameterControls, { signal });
    useSeason?.addEventListener("change", syncSceneParameterControls, { signal });

    const citySource = form.querySelector("[name='citySourceMode']");
    const citySettlement = form.querySelector("[name='citySettlementId']");
    const useCityEnvironment = form.querySelector("[name='useCityEnvironment']");
    const useCityIntensity = form.querySelector("[name='useCityIntensity']");
    const includeCityContext = form.querySelector("[name='includeCityContext']");

    citySource?.addEventListener("change", async () => {
      const mode = CITY_SOURCE_MODES.includes(citySource.value) ? citySource.value : "scene";
      await game.settings.set(MODULE_ID, "citySourceMode", mode);
      this.#formState.intensityOverride = false;
      this.render({ force: true });
    }, { signal });

    citySettlement?.addEventListener("change", async () => {
      const settlementId = String(citySettlement.value ?? "").trim();
      await game.settings.set(MODULE_ID, "citySettlementId", settlementId);
      if (settlementId) await game.settings.set(MODULE_ID, "citySourceMode", "settlement");
      this.#formState.intensityOverride = false;
      this.render({ force: true });
    }, { signal });

    useCityEnvironment?.addEventListener("change", () => {
      this.#formState.useCityEnvironment = useCityEnvironment.checked;
      this.render({ force: true });
    }, { signal });

    useCityIntensity?.addEventListener("change", () => {
      this.#formState.useCityIntensity = useCityIntensity.checked;
      this.#formState.intensityOverride = false;
      this.render({ force: true });
    }, { signal });

    includeCityContext?.addEventListener("change", () => {
      this.#formState.includeCityContext = includeCityContext.checked;
    }, { signal });

    const intensitySlider = form.querySelector("[name='intensity']");
    const effectiveIntensityValue = form.querySelector("[data-effective-intensity-value]");
    const effectiveIntensityLabel = form.querySelector("[data-effective-intensity-label]");

    intensitySlider?.addEventListener("input", () => {
      const value = Number(intensitySlider.value ?? 50);
      this.#formState.intensity = value;
      this.#formState.intensityOverride = true;
      if (effectiveIntensityValue) effectiveIntensityValue.textContent = String(value);
      if (effectiveIntensityLabel) effectiveIntensityLabel.textContent = intensityLabel(value);
    }, { signal });

    syncSceneParameterControls();
  }

  static async #onGenerate(event, target) {
    event.preventDefault();

    const app = this;
    const form = target.closest("form");
    const city = await CityContextService.getContext();
    const weatherContext = await WeatherContextService.getContext();

    app.#cityContext = city;
    app.#weatherContext = weatherContext;

    const weatherSelection = form?.querySelector("[name='weather']")?.value ?? "auto";
    const timeOfDaySelection = form?.querySelector("[name='timeOfDay']")?.value ?? "auto";
    const seasonSelection = form?.querySelector("[name='season']")?.value ?? "auto";

    const manualEnvironment = form?.querySelector("[name='environment']")?.value ?? "forest";
    const manualIntensity = Number(form?.querySelector("[name='intensity']")?.value ?? 50);
    const useCityEnvironment = form?.querySelector("[name='useCityEnvironment']")?.checked ?? false;
    const useCityIntensity = form?.querySelector("[name='useCityIntensity']")?.checked ?? false;
    const includeCityContext = form?.querySelector("[name='includeCityContext']")?.checked ?? false;

    const cityResolved = city.source === "cityForge" && Boolean(city.context);
    const environment = cityResolved && useCityEnvironment
      ? city.derivedEnvironment
      : manualEnvironment;
    const intensity = manualIntensity;

    app.#formState = {
      environment: manualEnvironment,
      intensity: manualIntensity,
      intensityOverride: app.#formState.intensityOverride,
      useCityEnvironment,
      useCityIntensity,
      includeCityContext,

      useWeather: form?.querySelector("[name='useWeather']")?.checked ?? false,
      weather: weatherSelection === "auto" ? weatherContext.weather : weatherSelection,
      weatherSelection,

      useTimeOfDay: form?.querySelector("[name='useTimeOfDay']")?.checked ?? false,
      timeOfDay: timeOfDaySelection === "auto" ? weatherContext.timeOfDay : timeOfDaySelection,
      timeOfDaySelection,

      useSeason: form?.querySelector("[name='useSeason']")?.checked ?? false,
      season: seasonSelection === "auto" ? weatherContext.season : seasonSelection,
      seasonSelection
    };

    const cityContextMeta = cityResolved ? {
      sourceMode: city.sourceMode,
      settlementId: city.context.settlement?.id ?? null,
      settlementName: city.context.settlement?.name ?? null,
      settlementRevision: city.context.settlement?.revision ?? null,
      districtId: city.context.scope?.district?.id ?? null,
      districtName: city.context.scope?.district?.name ?? null,
      locationId: city.context.scope?.location?.id ?? null,
      locationName: city.context.scope?.location?.name ?? null,
      derivedEnvironment: environment,
      suggestedIntensity: city.suggestedIntensity
    } : null;

    app.#lastResult = await AtmosphereService.generate({
      environment,
      intensity,
      useWeather: app.#formState.useWeather,
      weather: app.#formState.weather,
      useTimeOfDay: app.#formState.useTimeOfDay,
      timeOfDay: app.#formState.timeOfDay,
      useSeason: app.#formState.useSeason,
      season: app.#formState.season,
      cityContextText: cityResolved && includeCityContext ? city.summary : "",
      cityContextMeta
    });

    app.render({ force: true });
  }

  static async #onRerollSection(event, target) {
    event.preventDefault();

    const sectionId = target.dataset.sectionId;
    if (!sectionId || !this.#lastResult) return;

    this.#lastResult = await AtmosphereService.rerollSection(this.#lastResult, sectionId);
    this.render({ force: true });
  }

  static async #onReloadContext(event, target) {
    event.preventDefault();

    const form = this.element;
    if (form) this.#captureFormState(form);

    this.#weatherContext = await WeatherContextService.getContext();
    this.#cityContext = await CityContextService.getContext();

    if (this.#formState.useCityIntensity) this.#formState.intensityOverride = false;

    if (this.#weatherContext.weather && this.#weatherContext.weather !== "auto") {
      this.#formState.useWeather = true;
      this.#formState.weather = this.#weatherContext.weather;
      this.#formState.weatherSelection = "auto";
    }

    if (this.#weatherContext.timeOfDay && this.#weatherContext.timeOfDay !== "auto") {
      this.#formState.useTimeOfDay = true;
      this.#formState.timeOfDay = this.#weatherContext.timeOfDay;
      this.#formState.timeOfDaySelection = "auto";
    }

    if (this.#weatherContext.season && this.#weatherContext.season !== "auto") {
      this.#formState.useSeason = true;
      this.#formState.season = this.#weatherContext.season;
      this.#formState.seasonSelection = "auto";
    }

    ui.notifications.info(game.i18n.localize("PF2EATMOSPHEREFORGE.Notification.ContextReloaded"));
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

  #captureFormState(form) {
    const weatherSelection = form.querySelector("[name='weather']")?.value
      ?? this.#formState.weatherSelection
      ?? this.#formState.weather;
    const timeOfDaySelection = form.querySelector("[name='timeOfDay']")?.value
      ?? this.#formState.timeOfDaySelection
      ?? this.#formState.timeOfDay;
    const seasonSelection = form.querySelector("[name='season']")?.value
      ?? this.#formState.seasonSelection
      ?? this.#formState.season;

    this.#formState = {
      ...this.#formState,
      environment: form.querySelector("[name='environment']")?.value ?? this.#formState.environment,
      intensity: Number(form.querySelector("[name='intensity']")?.value ?? this.#formState.intensity),
      intensityOverride: this.#formState.intensityOverride,
      useCityEnvironment: form.querySelector("[name='useCityEnvironment']")?.checked ?? this.#formState.useCityEnvironment,
      useCityIntensity: form.querySelector("[name='useCityIntensity']")?.checked ?? this.#formState.useCityIntensity,
      includeCityContext: form.querySelector("[name='includeCityContext']")?.checked ?? this.#formState.includeCityContext,
      useWeather: form.querySelector("[name='useWeather']")?.checked ?? this.#formState.useWeather,
      weather: weatherSelection,
      weatherSelection,
      useTimeOfDay: form.querySelector("[name='useTimeOfDay']")?.checked ?? this.#formState.useTimeOfDay,
      timeOfDay: timeOfDaySelection,
      timeOfDaySelection,
      useSeason: form.querySelector("[name='useSeason']")?.checked ?? this.#formState.useSeason,
      season: seasonSelection,
      seasonSelection
    };
  }

  #prepareCityIntegration(city) {
    const context = city?.context ?? null;
    const path = [
      context?.settlement?.name,
      context?.scope?.district?.name,
      context?.scope?.location?.name
    ].filter(Boolean).join(" › ");

    return {
      active: city?.status?.active ?? false,
      compatible: city?.status?.compatible ?? false,
      resolved: city?.source === "cityForge" && Boolean(context),
      sourceMode: city?.sourceMode ?? "scene",
      reason: city?.reason ?? "manual-mode",
      reasonLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.CityForge.Status.${city?.reason ?? "manual-mode"}`),
      path,
      settlementName: context?.settlement?.name ?? "",
      region: context?.geography?.region ?? "",
      terrain: context?.geography?.terrain ?? "",
      derivedEnvironment: city?.derivedEnvironment ?? null,
      derivedEnvironmentLabel: city?.derivedEnvironment
        ? game.i18n.localize(`PF2EATMOSPHEREFORGE.Environment.${capitalize(city.derivedEnvironment)}`)
        : "",
      suggestedIntensity: city?.suggestedIntensity ?? null,
      suggestedIntensityLabel: city?.suggestedIntensity != null
        ? intensityLabel(city.suggestedIntensity)
        : "",
      conditionCount: context?.state?.activeConditions?.length ?? 0,
      threatCount: context?.state?.activeThreats?.length ?? 0,
      summary: city?.summary ?? ""
    };
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
      cityContextMeta: this.#lastResult.cityContextMeta,
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

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function intensityLabel(value) {
  const number = Number(value ?? 50);
  const key = number < 25 ? "calm" : number < 60 ? "normal" : number < 85 ? "tense" : "nightmare";
  return game.i18n.localize(`PF2EATMOSPHEREFORGE.Intensity.${key}`);
}
