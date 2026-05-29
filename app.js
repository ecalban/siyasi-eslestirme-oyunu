const state = {
  items: [],
  currentEventId: null,
  currentDefinitionId: null,
  definitionDeck: [],
  correct: 0,
  wrong: 0,
  matched: new Set(),
  mistakes: [],
  locked: false
};

const GUARANTEED_TARGET_WINDOW = 5;

const els = {
  eventCard: document.querySelector("#eventCard"),
  eventYear: document.querySelector("#eventYear"),
  eventName: document.querySelector("#eventName"),
  definitionCard: document.querySelector("#definitionCard"),
  definitionText: document.querySelector("#definitionText"),
  newEvent: document.querySelector("#newEvent"),
  newDefinition: document.querySelector("#newDefinition"),
  matchButton: document.querySelector("#matchButton"),
  correctScore: document.querySelector("#correctScore"),
  wrongScore: document.querySelector("#wrongScore"),
  percentScore: document.querySelector("#percentScore"),
  remainingScore: document.querySelector("#remainingScore"),
  statusStrip: document.querySelector("#statusStrip"),
  statusText: document.querySelector("#statusText"),
  resultScreen: document.querySelector("#resultScreen"),
  resultCorrect: document.querySelector("#resultCorrect"),
  resultWrong: document.querySelector("#resultWrong"),
  resultPercent: document.querySelector("#resultPercent"),
  mistakesList: document.querySelector("#mistakesList"),
  playAgain: document.querySelector("#playAgain"),
  restartTop: document.querySelector("#restartTop")
};

document.addEventListener("DOMContentLoaded", init);
els.playAgain.addEventListener("click", restartGame);
els.restartTop.addEventListener("click", restartGame);
els.newEvent.addEventListener("click", showRandomEvent);
els.newDefinition.addEventListener("click", showRandomDefinition);
els.definitionCard.addEventListener("click", showRandomDefinition);
els.matchButton.addEventListener("click", checkMatch);

async function init() {
  try {
    const response = await fetch("data.txt", { cache: "no-cache" });

    if (!response.ok) {
      throw new Error("data.txt okunamadı.");
    }

    const text = await response.text();
    state.items = parseData(text);

    if (state.items.length === 0) {
      throw new Error("data.txt içinde uygun satır bulunamadı.");
    }

    restartGame();
  } catch (error) {
    showLoadError(error);
  }
}

function parseData(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const colonIndex = line.indexOf(":");

      if (colonIndex === -1) {
        return null;
      }

      const leftPart = line.slice(0, colonIndex).trim();
      const definition = line.slice(colonIndex + 1).trim();
      const dateMatch = leftPart.match(/^(\d{4}(?:-\d{4})?)\s+(.+)$/);

      if (!dateMatch || !definition) {
        return null;
      }

      return {
        id: `item-${index}`,
        year: dateMatch[1].slice(0, 4),
        dateLabel: dateMatch[1],
        eventName: dateMatch[2].trim(),
        definition
      };
    })
    .filter(Boolean);
}

function restartGame() {
  state.currentEventId = null;
  state.currentDefinitionId = null;
  state.definitionDeck = [];
  state.correct = 0;
  state.wrong = 0;
  state.matched = new Set();
  state.mistakes = [];
  state.locked = false;
  els.resultScreen.classList.add("hidden");
  setControlsDisabled(false);
  startRound();
  updateScore();
}

function startRound(preferredEventId) {
  if (state.matched.size === state.items.length) {
    showResults();
    return;
  }

  const openItems = getOpenItems();
  const nextEvent = preferredEventId && !state.matched.has(preferredEventId)
    ? findItem(preferredEventId)
    : randomFrom(openItems);

  state.currentEventId = nextEvent.id;
  state.definitionDeck = createDefinitionDeck();
  state.currentDefinitionId = takeNextDefinitionId();
  state.locked = false;

  renderRound();
  clearFeedbackClasses();
  setStatus("Doğru tanım en geç 5 aday içinde gelir. Eşleştiğini düşünüyorsan kontrol et.");
}

function renderRound() {
  const eventItem = findItem(state.currentEventId);
  const definitionItem = findItem(state.currentDefinitionId);

  els.eventYear.textContent = eventItem.dateLabel;
  els.eventName.textContent = eventItem.eventName;
  els.definitionText.textContent = definitionItem.definition;
}

function showRandomEvent() {
  if (state.locked) {
    return;
  }

  const openItems = getOpenItems();
  const candidates = openItems.filter((item) => item.id !== state.currentEventId);
  const nextEvent = randomFrom(candidates.length > 0 ? candidates : openItems);
  state.currentEventId = nextEvent.id;
  state.definitionDeck = createDefinitionDeck();
  state.currentDefinitionId = takeNextDefinitionId();
  renderRound();
  clearFeedbackClasses();
  pulse(els.eventCard);
  pulse(els.definitionCard);
  setStatus("Yeni olay geldi. Doğru tanım en geç 5 aday içinde.");
}

function showRandomDefinition() {
  if (state.locked) {
    return;
  }

  state.currentDefinitionId = takeNextDefinitionId(state.currentDefinitionId);
  renderRound();
  clearFeedbackClasses();
  pulse(els.definitionCard);
  setStatus("Yeni aday tanım geldi.");
}

function checkMatch() {
  if (state.locked || !state.currentEventId || !state.currentDefinitionId) {
    return;
  }

  const eventItem = findItem(state.currentEventId);
  const definitionItem = findItem(state.currentDefinitionId);

  state.locked = true;
  setControlsDisabled(true);

  if (state.currentEventId === state.currentDefinitionId) {
    handleCorrectMatch(eventItem);
  } else {
    handleWrongMatch(eventItem, definitionItem);
  }
}

function handleCorrectMatch(item) {
  state.correct += 1;
  state.matched.add(item.id);
  updateScore();
  setFeedback("correct");
  setStatus("Doğru eşleştirme. Yeni soru geliyor.", "correct");

  window.setTimeout(() => {
    setControlsDisabled(false);
    startRound();
  }, 900);
}

function handleWrongMatch(eventItem, definitionItem) {
  state.wrong += 1;
  state.mistakes.push({
    eventLabel: `${eventItem.dateLabel} ${eventItem.eventName}`,
    chosenDefinition: definitionItem.definition,
    correctDefinition: eventItem.definition
  });

  updateScore();
  setFeedback("wrong");
  setStatus("Yanlış eşleştirme. Yeni tanım geliyor.", "wrong");

  window.setTimeout(() => {
    state.locked = false;
    setControlsDisabled(false);
    state.currentDefinitionId = takeNextDefinitionId(definitionItem.id);
    renderRound();
    clearFeedbackClasses();
    pulse(els.definitionCard);
    setStatus("Aynı olay için yeni aday geldi. Doğru tanım en geç 5 aday içinde.");
  }, 900);
}

function updateScore() {
  const attempts = state.correct + state.wrong;
  const percent = attempts === 0 ? 0 : Math.round((state.correct / attempts) * 100);
  const remaining = state.items.length - state.matched.size;

  els.correctScore.textContent = state.correct;
  els.wrongScore.textContent = state.wrong;
  els.percentScore.textContent = `%${percent}`;
  els.remainingScore.textContent = remaining;
}

function showResults() {
  const attempts = state.correct + state.wrong;
  const percent = attempts === 0 ? 0 : Math.round((state.correct / attempts) * 100);

  state.locked = true;
  setControlsDisabled(true);
  els.resultCorrect.textContent = state.correct;
  els.resultWrong.textContent = state.wrong;
  els.resultPercent.textContent = `%${percent}`;
  els.mistakesList.innerHTML = "";

  if (state.mistakes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Hiç yanlış eşleştirme yok.";
    els.mistakesList.appendChild(empty);
  } else {
    state.mistakes.forEach((mistake, index) => {
      const item = document.createElement("div");
      item.className = "mistake-item";
      item.innerHTML = `
        <strong>${index + 1}. ${escapeHtml(mistake.eventLabel)}</strong>
        <span class="mistake-label">Seçilen yanlış tanım</span>
        <p>${escapeHtml(mistake.chosenDefinition)}</p>
        <span class="mistake-label">Doğru tanım</span>
        <p>${escapeHtml(mistake.correctDefinition)}</p>
      `;
      els.mistakesList.appendChild(item);
    });
  }

  els.resultScreen.classList.remove("hidden");
  els.playAgain.focus();
}

function showLoadError(error) {
  setControlsDisabled(true);
  els.statusText.textContent = "Veri yüklenemedi.";
  els.eventName.textContent = "Hata";
  els.definitionText.innerHTML = `<span class="error-state">${escapeHtml(error.message)}</span>`;
}

function setStatus(message, type) {
  els.statusText.textContent = message;
  els.statusStrip.classList.remove("correct", "wrong");

  if (type) {
    els.statusStrip.classList.add(type);
  }
}

function setFeedback(type) {
  clearFeedbackClasses();
  els.eventCard.classList.add(type, "pop");
  els.definitionCard.classList.add(type, "pop");
}

function clearFeedbackClasses() {
  els.eventCard.classList.remove("correct", "wrong", "pop");
  els.definitionCard.classList.remove("correct", "wrong", "pop");
  els.statusStrip.classList.remove("correct", "wrong");
}

function pulse(element) {
  element.classList.remove("pop");
  window.requestAnimationFrame(() => {
    element.classList.add("pop");
  });
}

function setControlsDisabled(disabled) {
  els.newEvent.disabled = disabled;
  els.newDefinition.disabled = disabled;
  els.definitionCard.disabled = disabled;
  els.matchButton.disabled = disabled;
}

function takeNextDefinitionId(excludeId) {
  state.definitionDeck = state.definitionDeck.filter((id) => id !== excludeId);

  if (state.definitionDeck.length === 0 || !state.definitionDeck.includes(state.currentEventId)) {
    state.definitionDeck = createDefinitionDeck(excludeId);
  }

  return state.definitionDeck.shift() || state.currentEventId;
}

function createDefinitionDeck(excludeId) {
  const targetId = state.currentEventId;
  const otherIds = getOpenItems()
    .map((item) => item.id)
    .filter((id) => id !== targetId && id !== excludeId);
  const shuffledOthers = shuffle(otherIds);
  const firstWindowSize = Math.min(GUARANTEED_TARGET_WINDOW, shuffledOthers.length + 1);
  const targetMinIndex = excludeId === targetId && firstWindowSize > 1 ? 1 : 0;
  const targetIndex = randomInt(targetMinIndex, firstWindowSize - 1);
  const firstWindow = shuffledOthers.slice(0, firstWindowSize - 1);
  const rest = shuffledOthers.slice(firstWindowSize - 1);

  firstWindow.splice(targetIndex, 0, targetId);

  return firstWindow.concat(rest);
}

function getOpenItems() {
  return state.items.filter((item) => !state.matched.has(item.id));
}

function findItem(id) {
  return state.items.find((item) => item.id === id);
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return map[char];
  });
}
