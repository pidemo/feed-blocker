/**
 * Feed Blocker - To-do list widget
 */

const FBTodo = (function () {
  const TODO_ID = "fb-todo";
  const STORAGE_KEY = STORAGE_KEYS.TODOS;

  let _injectTimer = null;
  let _storageListener = null;
  let _darkObserver = null;
  let _writeQueue = Promise.resolve();

  function _isContextValid() {
    return !!(chrome.runtime && chrome.runtime.id);
  }

  function _enqueueWrite(fn) {
    _writeQueue = _writeQueue.then(() => new Promise((resolve) => {
      if (!_isContextValid()) { resolve(); return; }
      fn(resolve);
    }));
  }

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
    delBtn.textContent = "\u00d7";
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
    if (!_isContextValid()) return;
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      if (chrome.runtime.lastError) return;
      const todos = data[STORAGE_KEY] ?? DEFAULTS.todos;
      render(todos);
    });
  }

  function saveTodos(todos, done) {
    const serialized = JSON.stringify(todos);
    if (serialized.length > 7500) {
      console.warn("Feed Blocker: todo list approaching sync storage limit");
    }
    chrome.storage.sync.set({ [STORAGE_KEY]: todos }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Feed Blocker: failed to save todos", chrome.runtime.lastError.message);
      }
      loadAndRender();
      if (done) done();
    });
  }

  function addTodo(text) {
    const trimmed = String(text).trim();
    if (!trimmed) return;
    _enqueueWrite((done) => {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        if (chrome.runtime.lastError) { done(); return; }
        const todos = data[STORAGE_KEY] ?? DEFAULTS.todos;
        todos.push({
          id: generateId(),
          text: trimmed,
          done: false,
          createdAt: Date.now(),
        });
        saveTodos(todos, done);
      });
    });
  }

  function toggleTodo(id) {
    _enqueueWrite((done) => {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        if (chrome.runtime.lastError) { done(); return; }
        const todos = data[STORAGE_KEY] ?? DEFAULTS.todos;
        const todo = todos.find((t) => t.id === id);
        if (todo) {
          todo.done = !todo.done;
          saveTodos(todos, done);
        } else {
          done();
        }
      });
    });
  }

  function deleteTodo(id) {
    _enqueueWrite((done) => {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        if (chrome.runtime.lastError) { done(); return; }
        const todos = (data[STORAGE_KEY] ?? DEFAULTS.todos).filter((t) => t.id !== id);
        saveTodos(todos, done);
      });
    });
  }

  function _onStorageChange(changes, area) {
    if (area === "sync" && changes[STORAGE_KEY] && document.getElementById("fb-todo-list")) {
      render(changes[STORAGE_KEY].newValue ?? []);
    }
  }

  function _startDarkModeObserver() {
    if (_darkObserver) return;
    _darkObserver = new MutationObserver(() => {
      const el = document.getElementById(TODO_ID);
      if (el) {
        el.classList.toggle("fb-dark", isDarkMode());
      }
    });
    _darkObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dark"],
    });
  }

  function _stopDarkModeObserver() {
    if (_darkObserver) {
      _darkObserver.disconnect();
      _darkObserver = null;
    }
  }

  function createWidget() {
    const container = getContainer();
    if (!container) return null;

    let el = document.getElementById(TODO_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = TODO_ID;
    if (isDarkMode()) el.classList.add("fb-dark");

    const heading = document.createElement("h2");
    heading.textContent = t("todoHeading");

    const inputRow = document.createElement("div");
    inputRow.id = "fb-todo-input-row";

    const label = document.createElement("label");
    label.setAttribute("for", "fb-todo-input");
    label.className = "fb-sr-only";
    label.textContent = t("todoPlaceholder");

    const input = document.createElement("input");
    input.type = "text";
    input.id = "fb-todo-input";
    input.placeholder = t("todoPlaceholder");

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.id = "fb-todo-add";
    addBtn.textContent = t("todoAdd");

    inputRow.appendChild(label);
    inputRow.appendChild(input);
    inputRow.appendChild(addBtn);

    const list = document.createElement("ul");
    list.id = "fb-todo-list";

    const counter = document.createElement("div");
    counter.id = "fb-todo-counter";

    el.appendChild(heading);
    el.appendChild(inputRow);
    el.appendChild(list);
    el.appendChild(counter);

    addBtn.addEventListener("click", () => {
      addTodo(input.value);
      input.value = "";
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addTodo(input.value);
        input.value = "";
      }
    });

    container.insertBefore(el, container.firstChild);

    if (!_storageListener) {
      _storageListener = _onStorageChange;
      try { chrome.storage.onChanged.addListener(_storageListener); } catch {}
    }

    _startDarkModeObserver();
    loadAndRender();

    return el;
  }

  function inject(retries = 0) {
    if (_injectTimer) {
      clearTimeout(_injectTimer);
      _injectTimer = null;
    }
    const container = getContainer();
    if (!container) {
      if (retries < 15) {
        _injectTimer = setTimeout(() => {
          _injectTimer = null;
          inject(retries + 1);
        }, 200);
      }
      return;
    }
    createWidget();
  }

  function remove() {
    if (_injectTimer) {
      clearTimeout(_injectTimer);
      _injectTimer = null;
    }
    _stopDarkModeObserver();
    if (_storageListener) {
      try { chrome.storage.onChanged.removeListener(_storageListener); } catch {}
      _storageListener = null;
    }
    const el = document.getElementById(TODO_ID);
    if (el) el.remove();
  }

  return { inject, remove };
})();
