/**
 * Feed Blocker - To-do list widget
 */

const FBTodo = (function () {
  const TODO_ID = "fb-todo";
  const STORAGE_KEY = STORAGE_KEYS.TODOS;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[STORAGE_KEY] && document.getElementById("fb-todo-list")) {
      render(changes[STORAGE_KEY].newValue ?? []);
    }
  });

  function getContainer() {
    const feed = document.querySelector('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');
    return feed?.parentElement;
  }

  function isDarkMode() {
    return document.documentElement.hasAttribute("dark");
  }

  function generateId() {
    return "fb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function createTodoElement(todo) {
    const li = document.createElement("li");
    li.dataset.id = todo.id;
    if (todo.done) li.classList.add("fb-done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const text = document.createElement("span");
    text.className = "fb-todo-text";
    text.textContent = todo.text;

    const delBtn = document.createElement("button");
    delBtn.className = "fb-todo-delete";
    delBtn.textContent = "×";
    delBtn.setAttribute("aria-label", t("todoDelete"));
    delBtn.addEventListener("click", () => deleteTodo(todo.id));

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(delBtn);
    return li;
  }

  function render(todos) {
    const list = document.getElementById("fb-todo-list");
    if (!list) return;

    list.innerHTML = "";
    todos.forEach((todo) => list.appendChild(createTodoElement(todo)));

    const done = todos.filter((t) => t.done).length;
    const total = todos.length;
    const counter = document.getElementById("fb-todo-counter");
    if (counter) {
      counter.textContent = total ? t("todoCounter", [String(done), String(total)]) : "";
    }
  }

  function loadAndRender() {
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const todos = data[STORAGE_KEY] ?? DEFAULTS.todos;
      render(todos);
    });
  }

  function saveTodos(todos) {
    chrome.storage.sync.set({ [STORAGE_KEY]: todos }, loadAndRender);
  }

  function addTodo(text) {
    const trimmed = String(text).trim();
    if (!trimmed) return;

    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const todos = data[STORAGE_KEY] ?? DEFAULTS.todos;
      todos.push({
        id: generateId(),
        text: trimmed,
        done: false,
        createdAt: Date.now(),
      });
      saveTodos(todos);
    });
  }

  function toggleTodo(id) {
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const todos = data[STORAGE_KEY] ?? DEFAULTS.todos;
      const todo = todos.find((t) => t.id === id);
      if (todo) {
        todo.done = !todo.done;
        saveTodos(todos);
      }
    });
  }

  function deleteTodo(id) {
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const todos = (data[STORAGE_KEY] ?? DEFAULTS.todos).filter((t) => t.id !== id);
      saveTodos(todos);
    });
  }

  function createWidget() {
    const container = getContainer();
    if (!container) return null;

    let el = document.getElementById(TODO_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = TODO_ID;
    if (isDarkMode()) el.classList.add("fb-dark");

    el.innerHTML = `
      <h2>${t("todoHeading")}</h2>
      <div id="fb-todo-input-row">
        <input type="text" id="fb-todo-input" placeholder="${t("todoPlaceholder")}" />
        <button type="button" id="fb-todo-add">${t("todoAdd")}</button>
      </div>
      <ul id="fb-todo-list"></ul>
      <div id="fb-todo-counter"></div>
    `;

    el.querySelector("#fb-todo-add").addEventListener("click", () => {
      const input = el.querySelector("#fb-todo-input");
      addTodo(input.value);
      input.value = "";
    });

    el.querySelector("#fb-todo-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const input = el.querySelector("#fb-todo-input");
        addTodo(input.value);
        input.value = "";
      }
    });

    container.insertBefore(el, container.firstChild);
    loadAndRender();

    return el;
  }

  function inject(retries = 0) {
    const container = getContainer();
    if (!container) {
      if (retries < 15) setTimeout(() => inject(retries + 1), 200);
      return;
    }
    createWidget();
  }

  function remove() {
    const el = document.getElementById(TODO_ID);
    if (el) el.remove();
  }

  return { inject, remove };
})();
