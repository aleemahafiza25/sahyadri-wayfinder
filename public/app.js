import { floors, upperRooms } from "./floors.js";


// ---------- State and helpers ----------

const $ = (id) => document.getElementById(id);

const MAP_WIDTH = 1198;
const MAP_HEIGHT = 1313;

let data = null;
let selected = null;
let activeFloor = 0;
let admin = false;
let zoom = 1;

const scroller = document.querySelector(".map-scroller");

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

function post(url, body) {
  return request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function prepareData(value) {
  // Older ground-floor rooms did not have a floor property.
  value.rooms.forEach((room) => {
    room.floor ??= 0;
  });

  // Add the initial upper-floor rooms once.
  // After an admin saves, the version flag prevents deleted
  // rooms from being added again.
  if (!value.multiFloorVersion) {
    const existingIds = new Set(
      value.rooms.map((room) => room.id)
    );

    const additions = upperRooms
      .filter((room) => !existingIds.has(room.id))
      .map((room) => ({ ...room }));

    value.rooms.push(...additions);

    value.multiFloorVersion = 1;
    value.staircaseVerified = false;
  }

  return value;
}

function entrance() {
  return data.scans.find((point) => point.id === "entry");
}

function destination() {
  return data.rooms.find((room) => room.id === selected);
}

function current() {
  if (!data) return null;

  const category = $("editType").value;
  const id = $("editItem").value;

  return data[category].find((item) => item.id === id);
}


// ---------- Add floor controls ----------

document.querySelector(".map-tools").insertAdjacentHTML(
  "beforebegin",
  `
    <div
      id="floorTabs"
      class="floor-tabs"
      role="group"
      aria-label="View a floor"
    ></div>

    <p
      id="floorStatus"
      class="floor-status"
      aria-live="polite"
    ></p>
  `
);

$("editName").insertAdjacentHTML(
  "afterend",
  `
    <label for="editFloor">Room floor</label>
    <select id="editFloor"></select>
  `
);

$("saveStatus").insertAdjacentHTML(
  "beforebegin",
  `
    <label class="verify-stairs">
      <input type="checkbox" id="verifyStairs">
      <span>
        I checked that Staircase A connects all four
        marked landings.
      </span>
    </label>
  `
);

$("editFloor").innerHTML = Object.entries(floors)
  .map(([id, floor]) => `
    <option value="${id}">${floor.name}</option>
  `)
  .join("");

const brandSubtitle = document.querySelector(".brand small");

if (brandSubtitle) {
  brandSubtitle.textContent = "CAMPUS WAYFINDER";
}

const mapTitle = document.querySelector(
  ".map-heading > strong, .map-head > strong"
);

if (mapTitle) {
  mapTitle.textContent = "Campus map";
}

document.title = "Sahyadri Campus Wayfinder";


// ---------- Find a route on one floor ----------

function findPath(floorNumber, start, end) {
  const { nodes, edges } = floors[floorNumber];

  if (!nodes[start] || !nodes[end]) {
    return [];
  }

  const distance = {
    [start]: 0
  };

  const previous = {};
  const visited = new Set();

  while (true) {
    const currentNode = Object.keys(distance)
      .filter((node) => !visited.has(node))
      .sort((a, b) => distance[a] - distance[b])[0];

    if (!currentNode || currentNode === end) {
      break;
    }

    visited.add(currentNode);

    for (const [a, b] of edges) {
      let neighbor = null;

      if (a === currentNode) {
        neighbor = b;
      } else if (b === currentNode) {
        neighbor = a;
      }

      if (!neighbor) continue;

      const cost = distance[currentNode] + Math.hypot(
        nodes[currentNode][0] - nodes[neighbor][0],
        nodes[currentNode][1] - nodes[neighbor][1]
      );

      if (cost < (distance[neighbor] ?? Infinity)) {
        distance[neighbor] = cost;
        previous[neighbor] = currentNode;
      }
    }
  }

  if (start !== end && !previous[end]) {
    return [];
  }

  const path = [end];

  while (path[0] !== start) {
    path.unshift(previous[path[0]]);
  }

  return path;
}


// ---------- Connect floor sections through stairs ----------

function routeOnFloor(room, floorNumber) {
  if (
    !room ||
    room.id === "workshop" ||
    floorNumber > room.floor
  ) {
    return [];
  }

  const floor = floors[floorNumber];
  const start = entrance();

  const fromNode = floorNumber === 0
    ? start.node
    : "stairs";

  const toNode = floorNumber === room.floor
    ? room.node
    : "stairs";

  const path = findPath(
    floorNumber,
    fromNode,
    toNode
  );

  if (!path.length) {
    return [];
  }

  const points = path.map((node) => floor.nodes[node]);

  if (floorNumber === 0) {
    points.unshift([start.x, start.y]);
  }

  if (floorNumber === room.floor) {
    points.push([room.x, room.y]);
  }

  return points;
}


// ---------- Zoom and floor selection ----------

function setZoom(value) {
  zoom = Math.max(1, Math.min(3, value));

  $("map").style.width = `${zoom * 100}%`;

  $("zoomLevel").textContent =
    `${Math.round(zoom * 100)}%`;

  $("zoomOut").disabled = zoom === 1;
  $("zoomIn").disabled = zoom === 3;

  if (zoom === 1) {
    scroller.scrollTo(0, 0);
  }
}

function showFloor(floorNumber) {
  activeFloor = Number(floorNumber);

  setZoom(1);
  render();
}


// ---------- Draw markers ----------

function drawPins(pins) {
  $("markers").innerHTML = pins
    .map((pin) => {
      const left = pin.x / MAP_WIDTH * 100;
      const top = pin.y / MAP_HEIGHT * 100;

      const alignment = pin.x < 240
        ? "near-left"
        : "";

      return `
        <div
          class="pin ${pin.kind} ${alignment}"
          style="left: ${left}%; top: ${top}%;"
        >
          <span>${escapeHtml(pin.label)}</span>
        </div>
      `;
    })
    .join("");
}


// ---------- Render the map and search ----------

function render() {
  if (!data) return;

  const start = entrance();
  const room = destination();
  const floor = floors[activeFloor];

  $("originName").textContent =
    `${start.name} · Ground floor`;

  const term = $("search").value.trim().toLowerCase();

  const matches = data.rooms.filter((item) => {
    const searchableText =
      `${item.name} ${floors[item.floor].name}`.toLowerCase();

    return searchableText.includes(term);
  });

  $("results").innerHTML = matches
    .map((item) => `
      <button
        type="button"
        class="result ${selected === item.id ? "active" : ""}"
        data-id="${escapeHtml(item.id)}"
      >
        ${escapeHtml(item.name)}
        <small>${floors[item.floor].name}</small>
      </button>
    `)
    .join("") || `
      <p>No matching room. Try a name or room number.</p>
    `;

  $("results").querySelectorAll("button").forEach((button) => {
    button.onclick = () => {
      selected = button.dataset.id;

      // Always begin the route at the entrance.
      showFloor(0);
    };
  });

  $("floorTabs").innerHTML = Object.entries(floors)
    .map(([id, item]) => `
      <button
        type="button"
        data-floor="${id}"
        aria-pressed="${Number(id) === activeFloor}"
      >
        ${item.name}
      </button>
    `)
    .join("");

  $("floorTabs").querySelectorAll("button").forEach((button) => {
    button.onclick = () => {
      showFloor(button.dataset.floor);
    };
  });

  const image = $("map").querySelector("img");

  if (image.getAttribute("src") !== floor.image) {
    image.src = floor.image;
  }

  image.alt = `${floor.name} campus plan`;

  $("map").style.aspectRatio = floor.ratio;

  // All floor coordinates use the same logical coordinate space.
  $("route").setAttribute("preserveAspectRatio", "none");

  $("mapCaption").textContent = floor.name;

  const points = routeOnFloor(room, activeFloor);

  const coordinates = points
    .map((point) => point.join(","))
    .join(" ");

  $("route").innerHTML = points.length > 1
    ? `
      <polyline
        points="${coordinates}"
        fill="none"
        stroke="white"
        stroke-width="13"
      />

      <polyline
        points="${coordinates}"
        fill="none"
        stroke="#08755d"
        stroke-width="7"
        stroke-linejoin="round"
        stroke-dasharray="15 10"
      />
    `
    : "";

  const pins = [];

  if (activeFloor === 0) {
    pins.push({
      ...start,
      kind: "start",
      label: "You are here"
    });
  }

  if (room?.floor > 0 && activeFloor <= room.floor) {
    const [x, y] = floor.nodes.stairs;

    pins.push({
      x,
      y,
      kind: "edit",
      label: activeFloor < room.floor
        ? "Staircase A · go up"
        : "Staircase A · exit here"
    });
  }

  if (room?.floor === activeFloor) {
    pins.push({
      ...room,
      kind: "end",
      label: room.name
    });
  }

  if (admin) {
    const item = current();

    if (item && (item.floor ?? 0) === activeFloor) {
      pins.push({
        ...item,
        kind: "edit",
        label: `Editing: ${item.name}`
      });
    }
  }

  drawPins(pins);

  $("floorStatus").textContent = activeFloor === 0
    ? "Route starts at the main entrance."
    : (
      `Viewing ${floor.name.toLowerCase()}. ` +
      "Your starting point remains the ground-floor entrance."
    );

  renderDirections(room);
}


// ---------- Directions and route-floor buttons ----------

function renderDirections(room) {
  if (!room) {
    $("directions").textContent =
      "Search for a room on any floor.";

    return;
  }

  if (!routeOnFloor(room, 0).length) {
    $("directions").innerHTML = `
      <h2>${escapeHtml(room.name)}</h2>
      <p>This route has not been mapped yet.</p>
    `;

    return;
  }

  let steps;

  if (room.floor === 0) {
    steps = [
      "Start at the main entrance.",
      "Follow the marked ground-floor corridor route.",
      `Check the door sign for ${room.name}.`
    ];
  } else {
    const floorName = floors[room.floor].name.toLowerCase();
    const floorWord = room.floor === 1 ? "floor" : "floors";

    steps = [
      (
        "From the main entrance, follow the ground-floor line " +
        "to Staircase A near the store rooms."
      ),
      (
        `Go up ${room.floor} ${floorWord} using the same ` +
        `staircase to reach the ${floorName}.`
      ),
      (
        `Open the ${floorName} map below and follow the line ` +
        `from the staircase to ${room.name}.`
      ),
      "Check the room name or number on its door."
    ];
  }

  const draft =
    room.floor > 0 && !data.staircaseVerified;

  const floorButtons = Array.from(
    { length: room.floor + 1 },
    (_, floorNumber) => `
      <button
        type="button"
        data-floor="${floorNumber}"
      >
        ${floors[floorNumber].name}
      </button>
    `
  ).join("");

  $("directions").innerHTML = `
    <h2>${escapeHtml(room.name)}</h2>

    <p>${floors[room.floor].name}</p>

    ${draft ? `
      <p class="route-notice">
        Draft route: the staircase connection still needs
        checking at the college.
      </p>
    ` : ""}

    <ol>
      ${steps.map((step) => `
        <li>${escapeHtml(step)}</li>
      `).join("")}
    </ol>

    <div class="route-floors">
      ${floorButtons}
    </div>

    <small>
      Map routes are approximate. Upper-floor routes use stairs.
    </small>
  `;

  $("directions")
    .querySelectorAll("[data-floor]")
    .forEach((button) => {
      button.onclick = () => {
        showFloor(button.dataset.floor);

        document.querySelector(".map-panel").scrollIntoView({
          behavior: "smooth"
        });
      };
    });
}


// ---------- Editor location lists ----------

function fillLocations(selectedId = null) {
  const items = $("editType").value === "scans"
    ? data.scans.filter((item) => item.id === "entry")
    : data.rooms;

  $("editItem").innerHTML = items
    .map((item) => `
      <option value="${escapeHtml(item.id)}">
        ${escapeHtml(item.name)} ·
        ${floors[item.floor ?? 0].name}
      </option>
    `)
    .join("");

  if (selectedId) {
    $("editItem").value = selectedId;
  }

  fillForm();
}

function fillForm() {
  const item = current();
  const isEntrance = $("editType").value === "scans";
  const floorNumber = Number(item?.floor ?? 0);

  $("editName").value = item?.name || "";

  $("editFloor").value = floorNumber;
  $("editFloor").disabled = isEntrance || !item;

  $("addItem").hidden = isEntrance;
  $("deleteItem").hidden = isEntrance;

  $("editNode").innerHTML = Object.keys(
    floors[floorNumber].nodes
  )
    .map((id) => `
      <option value="${id}">
        ${id.replaceAll("-", " ")}
      </option>
    `)
    .join("");

  $("editNode").value = item?.node || "stairs";

  showFloor(floorNumber);
}

function setAdmin(value) {
  admin = value;

  $("editor").hidden = !value;
  $("adminToggle").hidden = value;

  if (value) {
    $("verifyStairs").checked =
      Boolean(data.staircaseVerified);

    fillLocations();

    $("qrList").innerHTML = `
      <div class="qr-card">
        <strong>Main entrance</strong>

        <img
          src="/api/qr/entry"
          alt="Entrance QR code"
        >

        <a
          href="/api/qr/entry"
          download="entrance-qr.png"
        >
          Download entrance QR
        </a>
      </div>
    `;
  } else {
    render();
  }
}


// ---------- Search and zoom events ----------

$("search").oninput = render;

$("zoomIn").onclick = () => {
  setZoom(zoom + 0.5);
};

$("zoomOut").onclick = () => {
  setZoom(zoom - 0.5);
};

$("zoomFit").onclick = () => {
  setZoom(1);
};


// ---------- Login events ----------

$("adminToggle").onclick = () => {
  $("loginError").textContent = "";
  $("loginModal").hidden = false;
  $("password").focus();
};

$("closeModal").onclick = () => {
  $("loginModal").hidden = true;
  $("password").value = "";
};

$("loginForm").onsubmit = async (event) => {
  event.preventDefault();

  try {
    await post("/api/login", {
      password: $("password").value
    });

    $("password").value = "";
    $("loginModal").hidden = true;

    setAdmin(true);
  } catch (error) {
    $("loginError").textContent = error.message;
  }
};

$("logout").onclick = async () => {
  try {
    await post("/api/logout", {});

    data = prepareData(
      await request("/api/data")
    );

    setAdmin(false);
  } catch (error) {
    $("saveStatus").textContent = error.message;
  }
};


// ---------- Edit room details ----------

$("editType").onchange = () => {
  fillLocations();
};

$("editItem").onchange = fillForm;

$("editName").oninput = () => {
  const item = current();

  if (!item) return;

  item.name = $("editName").value.slice(0, 100);

  $("saveStatus").textContent = "Unsaved changes.";

  render();
};

$("editFloor").onchange = () => {
  const item = current();

  if (!item || $("editType").value === "scans") {
    return;
  }

  item.floor = Number($("editFloor").value);
  item.node = "stairs";

  [item.x, item.y] = floors[item.floor].nodes.stairs;

  fillForm();

  $("saveStatus").textContent =
    "Tap the correct room position on this floor, then save.";
};

$("editNode").onchange = () => {
  const item = current();

  if (!item) return;

  item.node = $("editNode").value;

  $("saveStatus").textContent = "Unsaved changes.";

  render();
};

$("verifyStairs").onchange = () => {
  data.staircaseVerified = $("verifyStairs").checked;

  $("saveStatus").textContent =
    "Save to publish this change.";

  render();
};


// ---------- Move a room pin ----------

$("map").onclick = (event) => {
  const item = current();

  if (
    !admin ||
    !item ||
    (item.floor ?? 0) !== activeFloor
  ) {
    return;
  }

  const bounds = $("map").getBoundingClientRect();

  item.x = Math.max(
    0,
    Math.min(
      MAP_WIDTH,
      (event.clientX - bounds.left) / bounds.width * MAP_WIDTH
    )
  );

  item.y = Math.max(
    0,
    Math.min(
      MAP_HEIGHT,
      (event.clientY - bounds.top) / bounds.height * MAP_HEIGHT
    )
  );

  $("saveStatus").textContent =
    "Pin moved. Save changes to publish.";

  render();
};


// ---------- Add or delete a room ----------

$("addItem").onclick = () => {
  if ($("editType").value !== "rooms") return;

  const name = prompt("New room name or number:")?.trim();

  if (!name) return;

  const id = `room-${Date.now().toString(36)}`;
  const [x, y] = floors[activeFloor].nodes.stairs;

  data.rooms.push({
    id,
    name: name.slice(0, 100),
    floor: activeFloor,
    x,
    y,
    node: "stairs"
  });

  fillLocations(id);

  $("saveStatus").textContent =
    "Room added. Set its floor, pin and corridor junction, then save.";
};

$("deleteItem").onclick = () => {
  const item = current();

  if (
    $("editType").value !== "rooms" ||
    !item ||
    !confirm(`Delete ${item.name}?`)
  ) {
    return;
  }

  data.rooms = data.rooms.filter(
    (room) => room.id !== item.id
  );

  fillLocations();

  $("saveStatus").textContent =
    "Room removed. Save to publish.";
};


// ---------- Save to the existing backend ----------

$("save").onclick = async () => {
  $("save").disabled = true;

  try {
    const items = [
      ...data.rooms,
      ...data.scans
    ];

    if (items.some((item) => !item.name.trim())) {
      throw new Error("Every location needs a name.");
    }

    await post("/api/save", data);

    $("saveStatus").textContent = "Saved and published.";
  } catch (error) {
    $("saveStatus").textContent = error.message;
  } finally {
    $("save").disabled = false;
  }
};


// ---------- Start ----------

setZoom(1);

try {
  data = prepareData(
    await request("/api/data")
  );

  if (!entrance()) {
    throw new Error("Entrance location is missing.");
  }

  render();

  try {
    const session = await request("/api/auth");

    if (session.admin) {
      setAdmin(true);
    }
  } catch {
    // Public navigation still works if the session check fails.
  }
} catch (error) {
  $("directions").textContent =
    `Could not load map: ${error.message}`;
}