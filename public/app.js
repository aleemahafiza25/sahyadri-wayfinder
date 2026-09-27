// ---------- Elements and state ----------

const $ = (id) => document.getElementById(id);

const MAP_WIDTH = 1198;
const MAP_HEIGHT = 1313;

let data = null;
let selectedRoomId = null;
let isAdmin = false;
let mapZoom = 1;


// ---------- Corridor junctions ----------
// Coordinates match the supplied floor-plan image.
// These routes still need checking at the college.

const nodes = {
  entry: [206, 1090],

  "bottom-left": [299, 1118],
  "bottom-center": [510, 1118],
  "bottom-right": [785, 1118],

  "lower-left": [211, 864],
  "lower-center": [555, 862],
  "lower-right": [795, 887],

  "middle-left": [196, 685],
  "middle-center": [550, 685],
  "middle-right": [790, 694],

  "upper-left": [198, 321],
  "upper-center": [548, 321],
  "upper-right": [787, 321],

  "top-left": [352, 320],
  "top-right": [680, 320]
};

const edges = [
  ["entry", "bottom-left"],
  ["entry", "lower-left"],

  ["bottom-left", "bottom-center"],
  ["bottom-center", "bottom-right"],
  ["bottom-center", "lower-center"],
  ["bottom-right", "lower-right"],

  ["lower-left", "lower-center"],
  ["lower-left", "middle-left"],
  ["lower-center", "lower-right"],
  ["lower-center", "middle-center"],
  ["lower-right", "middle-right"],

  ["middle-left", "middle-center"],
  ["middle-left", "upper-left"],
  ["middle-center", "middle-right"],
  ["middle-center", "upper-center"],
  ["middle-right", "upper-right"],

  ["upper-left", "upper-center"],
  ["upper-left", "top-left"],
  ["upper-center", "upper-right"],
  ["upper-center", "top-left"],
  ["upper-center", "top-right"],
  ["upper-right", "top-right"]
];


// ---------- Helpers ----------

function escapeHtml(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value).replace(
    /[&<>"']/g,
    (character) => characters[character]
  );
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Request failed.");
  }

  return result;
}

function postJson(url, body) {
  return request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function getEntrance() {
  return data.scans.find((point) => point.id === "entry");
}

function getSelectedRoom() {
  return data.rooms.find((room) => room.id === selectedRoomId);
}

function getEditedItem() {
  if (!data) return null;

  const category = $("editType").value;
  const id = $("editItem").value;

  return data[category].find((item) => item.id === id);
}


// ---------- Find a route ----------

function pathBetween(start, end) {
  if (!nodes[start] || !nodes[end]) {
    return [];
  }

  const distances = {
    [start]: 0
  };

  const previous = {};
  const visited = new Set();

  while (true) {
    const current = Object.keys(distances)
      .filter((node) => !visited.has(node))
      .sort((a, b) => distances[a] - distances[b])[0];

    if (!current || current === end) {
      break;
    }

    visited.add(current);

    for (const [a, b] of edges) {
      let neighbor = null;

      if (a === current) {
        neighbor = b;
      } else if (b === current) {
        neighbor = a;
      }

      if (!neighbor) continue;

      const distance = Math.hypot(
        nodes[current][0] - nodes[neighbor][0],
        nodes[current][1] - nodes[neighbor][1]
      );

      const candidate = distances[current] + distance;

      if (candidate < (distances[neighbor] ?? Infinity)) {
        distances[neighbor] = candidate;
        previous[neighbor] = current;
      }
    }
  }

  if (start !== end && !previous[end]) {
    return [];
  }

  const route = [end];

  while (route[0] !== start) {
    route.unshift(previous[route[0]]);
  }

  return route;
}

function directionBetween(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? "right on the map (east)"
      : "left on the map (west)";
  }

  return dy > 0
    ? "towards the main entry (south)"
    : "towards reception (north)";
}


// ---------- Search results ----------

function renderResults() {
  const searchTerm = $("search").value.trim().toLowerCase();

  const matches = data.rooms.filter((room) => {
    return !searchTerm || room.name.toLowerCase().includes(searchTerm);
  });

  if (!matches.length) {
    $("results").innerHTML = `
      <p class="empty-message">
        No matching place. Check the spelling or ask the editor
        to add it.
      </p>
    `;

    return;
  }

  $("results").innerHTML = matches
    .slice(0, 30)
    .map((room) => {
      const active = room.id === selectedRoomId;

      return `
        <button
          type="button"
          class="result ${active ? "active" : ""}"
          data-id="${escapeHtml(room.id)}"
          aria-pressed="${active}"
        >
          ${escapeHtml(room.name)}
        </button>
      `;
    })
    .join("");

  $("results").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRoomId = button.dataset.id;
      render();
    });
  });
}


// ---------- Map markers ----------

function renderMarkers(entrance, destination) {
  const pins = [
    {
      ...entrance,
      kind: "start",
      label: "You are here"
    }
  ];

  if (destination) {
    pins.push({
      ...destination,
      kind: "end",
      label: destination.name
    });
  }

  if (isAdmin) {
    const editedItem = getEditedItem();

    if (editedItem) {
      pins.push({
        ...editedItem,
        kind: "edit",
        label: `Editing: ${editedItem.name}`
      });
    }
  }

  $("markers").innerHTML = pins
    .map((pin) => {
      const left = (pin.x / MAP_WIDTH) * 100;
      const top = (pin.y / MAP_HEIGHT) * 100;

      let alignment = "";

      if (pin.x < 240) {
        alignment = "near-left";
      } else if (pin.x > 960) {
        alignment = "near-right";
      }

      return `
        <div
          class="pin ${pin.kind} ${alignment}"
          style="left: ${left}%; top: ${top}%;"
          title="${escapeHtml(pin.label)}"
        >
          <span>${escapeHtml(pin.label)}</span>
        </div>
      `;
    })
    .join("");
}


// ---------- Route line ----------

function renderRoute(entrance, destination, route) {
  if (!destination || !route.length) {
    $("route").innerHTML = "";
    return;
  }

  const points = [
    [entrance.x, entrance.y],
    ...route.map((node) => nodes[node]),
    [destination.x, destination.y]
  ];

  const coordinates = points
    .map((point) => point.join(","))
    .join(" ");

  $("route").innerHTML = `
    <polyline
      points="${coordinates}"
      fill="none"
      stroke="#ffffff"
      stroke-width="13"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <polyline
      points="${coordinates}"
      fill="none"
      stroke="#08755d"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray="15 10"
    />
  `;
}


// ---------- Written directions ----------

function renderDirections(entrance, destination, route) {
  if (!destination) {
    $("directions").textContent =
      "Choose a destination to see directions.";

    return;
  }

  if (!route.length) {
    $("directions").innerHTML = `
      <h2>${escapeHtml(destination.name)}</h2>
      <p>
        A route is not available for this room.
        Ask the editor to check its corridor junction.
      </p>
    `;

    return;
  }

  const steps = [];

  if (route.length > 1) {
    const firstDirection = directionBetween(
      [entrance.x, entrance.y],
      nodes[route[1]]
    );

    steps.push(
      `From ${entrance.name}, head ${firstDirection} along the corridor.`
    );

    for (let index = 1; index < route.length - 1; index++) {
      const nextDirection = directionBetween(
        nodes[route[index]],
        nodes[route[index + 1]]
      );

      if (!steps.at(-1).includes(nextDirection)) {
        steps.push(
          `At the next corridor junction, continue ${nextDirection}.`
        );
      }
    }
  } else {
    steps.push("You are close to this room.");
  }

  steps.push(
    `Look for ${destination.name} beside the marked corridor. ` +
    "Check its door sign before entering."
  );

  $("directions").innerHTML = `
    <h2>${escapeHtml(destination.name)}</h2>

    <ol>
      ${steps.map((step) => `
        <li>${escapeHtml(step)}</li>
      `).join("")}
    </ol>

    <small>
      Directions are approximate and need on-site checking.
    </small>
  `;
}


// ---------- Update the visitor view ----------

function render() {
  if (!data) return;

  const entrance = getEntrance();

  if (!entrance) {
    $("directions").textContent = "Entrance location is missing.";
    return;
  }

  const destination = getSelectedRoom();

  const route = destination
    ? pathBetween(entrance.node, destination.node)
    : [];

  $("originName").textContent = entrance.name;

  $("mapCaption").textContent =
    destination?.name || "Select a destination";

  renderResults();
  renderMarkers(entrance, destination);
  renderRoute(entrance, destination, route);
  renderDirections(entrance, destination, route);
}


// ---------- Map zoom ----------

function setMapZoom(value) {
  mapZoom = Math.min(3, Math.max(1, value));

  $("map").style.width = `${mapZoom * 100}%`;

  $("zoomLevel").textContent =
    `${Math.round(mapZoom * 100)}%`;

  $("zoomOut").disabled = mapZoom === 1;
  $("zoomIn").disabled = mapZoom === 3;

  if (mapZoom === 1) {
    $("mapScroller").scrollTo(0, 0);
  }
}

$("zoomIn").addEventListener("click", () => {
  setMapZoom(mapZoom + 0.5);
});

$("zoomOut").addEventListener("click", () => {
  setMapZoom(mapZoom - 0.5);
});

$("zoomFit").addEventListener("click", () => {
  setMapZoom(1);
});

$("search").addEventListener("input", render);


// ---------- Login dialog ----------

function openLogin() {
  $("loginError").textContent = "";
  $("loginModal").hidden = false;
  $("password").focus();
}

function closeLogin() {
  $("loginModal").hidden = true;
  $("password").value = "";
  $("adminToggle").focus();
}

$("adminToggle").addEventListener("click", openLogin);
$("closeModal").addEventListener("click", closeLogin);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("loginModal").hidden) {
    closeLogin();
  }
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await postJson("/api/login", {
      password: $("password").value
    });

    $("password").value = "";
    $("loginError").textContent = "";
    $("loginModal").hidden = true;

    setAdmin(true);
  } catch (error) {
    $("loginError").textContent = error.message;
  }
});


// ---------- Editor visibility ----------

function setAdmin(value) {
  isAdmin = value;

  $("editor").hidden = !value;
  $("adminToggle").hidden = value;

  if (value && data) {
    populateEditorLocations();
    renderQr();
  } else {
    render();
  }
}

$("logout").addEventListener("click", async () => {
  try {
    await request("/api/logout", {
      method: "POST"
    });

    // Discard any unsaved edits when signing out.
    data = await request("/api/data");
    setAdmin(false);
  } catch (error) {
    $("saveStatus").textContent = error.message;
  }
});


// ---------- Editor fields ----------

function populateEditorLocations(selectedId = null) {
  const category = $("editType").value;

  const items = category === "scans"
    ? data.scans.filter((point) => point.id === "entry")
    : data.rooms;

  $("editItem").innerHTML = items
    .map((item) => `
      <option value="${escapeHtml(item.id)}">
        ${escapeHtml(item.name)}
      </option>
    `)
    .join("");

  if (selectedId && items.some((item) => item.id === selectedId)) {
    $("editItem").value = selectedId;
  }

  updateEditorForm();
}

function updateEditorForm() {
  const editingEntrance = $("editType").value === "scans";
  const item = getEditedItem();

  $("addItem").hidden = editingEntrance;
  $("deleteItem").hidden = editingEntrance;

  $("editName").value = item?.name || "";
  $("editNode").value = item?.node || "entry";

  $("editName").disabled = !item;
  $("editNode").disabled = !item;
  $("deleteItem").disabled = !item;

  render();
}

$("editType").addEventListener("change", () => {
  populateEditorLocations();
});

$("editItem").addEventListener("change", updateEditorForm);

$("editName").addEventListener("input", () => {
  const item = getEditedItem();

  if (!item) return;

  item.name = $("editName").value;

  const selectedOption = $("editItem").selectedOptions[0];

  if (selectedOption) {
    selectedOption.textContent = item.name;
  }

  $("saveStatus").textContent = "Unsaved changes.";
  render();
});

$("editNode").addEventListener("change", () => {
  const item = getEditedItem();

  if (!item) return;

  item.node = $("editNode").value;

  $("saveStatus").textContent = "Unsaved changes.";
  render();
});


// ---------- Move a pin in the editor ----------

$("map").addEventListener("click", (event) => {
  if (!isAdmin) return;

  const item = getEditedItem();

  if (!item) return;

  const bounds = $("map").getBoundingClientRect();

  item.x = Math.round(
    ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH
  );

  item.y = Math.round(
    ((event.clientY - bounds.top) / bounds.height) * MAP_HEIGHT
  );

  item.x = Math.max(0, Math.min(MAP_WIDTH, item.x));
  item.y = Math.max(0, Math.min(MAP_HEIGHT, item.y));

  $("saveStatus").textContent =
    `Moved ${item.name}. Click Save changes to publish.`;

  render();
});


// ---------- Add and delete rooms ----------

$("addItem").addEventListener("click", () => {
  if (!data || $("editType").value !== "rooms") return;

  const answer = window.prompt("New room name:");
  const name = answer?.trim();

  if (!name) return;

  const id = `point-${Date.now().toString(36)}`;

  data.rooms.push({
    id,
    name: name.slice(0, 100),
    x: 550,
    y: 685,
    node: "middle-center"
  });

  populateEditorLocations(id);

  $("saveStatus").textContent =
    "Room added. Move its pin to the correct position and save.";
});

$("deleteItem").addEventListener("click", () => {
  if ($("editType").value !== "rooms") return;

  const item = getEditedItem();

  if (!item) return;

  if (!window.confirm(`Delete ${item.name}?`)) {
    return;
  }

  data.rooms = data.rooms.filter((room) => room.id !== item.id);

  if (selectedRoomId === item.id) {
    selectedRoomId = null;
  }

  populateEditorLocations();

  $("saveStatus").textContent =
    "Room removed. Save to publish this change.";
});


// ---------- Save changes ----------

$("save").addEventListener("click", async () => {
  if (!data) return;

  const entries = [...data.rooms, ...data.scans];

  if (entries.some((item) => !item.name.trim())) {
    $("saveStatus").textContent =
      "Every location needs a name before saving.";

    return;
  }

  $("save").disabled = true;
  $("saveStatus").textContent = "Saving...";

  try {
    await postJson("/api/save", data);

    $("saveStatus").textContent = "Saved and published.";

    render();
    renderQr();
  } catch (error) {
    $("saveStatus").textContent = error.message;
  } finally {
    $("save").disabled = false;
  }
});


// ---------- Entrance QR code ----------

function renderQr() {
  const entrance = getEntrance();

  if (!entrance) {
    $("qrList").textContent = "Entrance location is missing.";
    return;
  }

  const qrUrl = `/api/qr/${encodeURIComponent(entrance.id)}`;

  $("qrList").innerHTML = `
    <div class="qr-card">
      <strong>${escapeHtml(entrance.name)}</strong>

      <img
        src="${qrUrl}"
        alt="Entrance QR code"
      >

      <a href="${qrUrl}" download="entrance-qr.png">
        Download PNG
      </a>
    </div>
  `;
}


// ---------- Start the application ----------

async function initialize() {
  $("editNode").innerHTML = Object.keys(nodes)
    .map((node) => `
      <option value="${node}">
        ${node.replaceAll("-", " ")}
      </option>
    `)
    .join("");

  setMapZoom(1);

  try {
    data = await request("/api/data");

    if (!getEntrance()) {
      throw new Error("Entrance location is missing.");
    }

    render();
  } catch (error) {
    $("directions").textContent =
      `Could not load the map: ${error.message}`;

    return;
  }

  try {
    const session = await request("/api/auth");

    if (session.admin) {
      setAdmin(true);
    }
  } catch {
    // The public map remains usable if the session check fails.
  }
}

initialize();