// Upper-floor coordinates come from the uploaded 1200 × 1599 photos.
// Convert them to the application's shared coordinate system.

const point = (x, y) => [
  x * 1198 / 1200,
  y * 1313 / 1599
];

const convert = (items) => {
  return Object.fromEntries(
    Object.entries(items).map(([id, coordinates]) => [
      id,
      point(...coordinates)
    ])
  );
};

// Connect consecutive corridor points in each supplied chain.
const connect = (...chains) => {
  return chains.flatMap((chain) =>
    chain.slice(1).map((node, index) => [
      chain[index],
      node
    ])
  );
};

const upperEdges = connect(
  [
    "stairs",
    "west-low",
    "low-center",
    "south-center",
    "bottom-center",
    "bottom-east",
    "south-east"
  ],
  [
    "west-low",
    "west-middle",
    "north-west",
    "north-center",
    "north-east",
    "east-middle",
    "middle-center",
    "north-center"
  ],
  [
    "west-middle",
    "core-west",
    "middle-center"
  ],
  [
    "core-west",
    "low-center"
  ],
  [
    "south-center",
    "south-east"
  ],
  [
    "bottom-center",
    "bottom-west"
  ]
);


// ---------- Floor maps and corridor points ----------

export const floors = {
  0: {
    name: "Ground floor",
    image: "/ground-floor.jpeg",
    ratio: "1198 / 1313",

    nodes: {
      entry: [206, 1090],

      "bottom-left": [299, 1118],
      "bottom-center": [550, 1118],
      "bottom-right": [785, 1118],

      "lower-left": [240, 850],
      "lower-center": [550, 850],
      "lower-right": [795, 890],

      "middle-left": [193, 552],
      "middle-center": [550, 552],
      "middle-right": [785, 552],

      "upper-left": [193, 315],
      "upper-center": [550, 315],
      "upper-right": [785, 315],

      "top-left": [352, 315],
      "top-right": [680, 315],

      stairs: [307, 898],

      "stair-approach": [307, 850],
      "west-approach": [240, 1118],
      "west-middle": [193, 850]
    },

    edges: connect(
      [
        "entry",
        "west-approach",
        "bottom-left",
        "bottom-center",
        "bottom-right",
        "lower-right",
        "middle-right",
        "upper-right"
      ],
      [
        "west-approach",
        "lower-left",
        "stair-approach",
        "stairs"
      ],
      [
        "lower-left",
        "west-middle",
        "middle-left",
        "upper-left",
        "top-left",
        "upper-center",
        "top-right",
        "upper-right"
      ],
      [
        "middle-left",
        "middle-center",
        "middle-right"
      ],
      [
        "middle-center",
        "upper-center"
      ],
      [
        "stair-approach",
        "lower-center",
        "bottom-center"
      ],
      [
        "lower-center",
        "middle-center"
      ]
    )
  },

  1: {
    name: "First floor",
    image: "/first-floor.png",
    ratio: "1200 / 1599",

    nodes: convert({
      stairs: [313, 1040],

      "west-low": [257, 990],
      "low-center": [478, 990],
      "south-center": [590, 1036],
      "south-east": [859, 1036],

      "bottom-center": [589, 1275],
      "bottom-east": [859, 1275],
      "bottom-west": [400, 1275],

      "west-middle": [183, 674],
      "core-west": [474, 678],
      "middle-center": [576, 686],
      "east-middle": [859, 686],

      "north-west": [153, 384],
      "north-center": [575, 375],
      "north-east": [855, 370]
    }),

    edges: upperEdges
  },

  2: {
    name: "Second floor",
    image: "/second-floor.png",
    ratio: "1200 / 1599",

    nodes: convert({
      stairs: [383, 1049],

      "west-low": [317, 996],
      "low-center": [540, 992],
      "south-center": [644, 1040],
      "south-east": [927, 1040],

      "bottom-center": [642, 1285],
      "bottom-east": [927, 1285],
      "bottom-west": [469, 1285],

      "west-middle": [251, 685],
      "core-west": [540, 686],
      "middle-center": [643, 687],
      "east-middle": [914, 685],

      "north-west": [239, 405],
      "north-center": [641, 394],
      "north-east": [913, 381]
    }),

    edges: upperEdges
  },

  3: {
    name: "Third floor",
    image: "/third-floor.png",
    ratio: "1200 / 1599",

    nodes: convert({
      stairs: [372, 949],

      "west-low": [294, 893],
      "low-center": [533, 893],
      "south-center": [645, 950],
      "south-east": [934, 952],

      "bottom-center": [643, 1212],
      "bottom-east": [934, 1220],
      "bottom-west": [463, 1208],

      "west-middle": [267, 584],
      "core-west": [536, 592],
      "middle-center": [636, 585],
      "east-middle": [891, 566],

      "north-west": [269, 348],
      "north-center": [630, 321],
      "north-east": [889, 294]
    }),

    edges: upperEdges
  }
};


// ---------- Upper-floor destinations ----------

function room(floor, id, name, x, y, node) {
  const [convertedX, convertedY] = point(x, y);

  return {
    id: `f${floor}-${id}`,
    floor,
    name,
    x: convertedX,
    y: convertedY,
    node
  };
}

export const upperRooms = [
  // First floor
  room(1, "112", "CAED Lab 112",
    410, 309, "north-center"),

  room(1, "113", "Ladies Room 113",
    205, 312, "north-west"),

  room(1, "111", "Guest Faculty 111",
    626, 305, "north-center"),

  room(1, "110", "MBA Classroom 110",
    734, 303, "north-center"),

  room(1, "109", "MBA Office 109",
    845, 290, "north-east"),

  room(1, "101", "MBA Director's Chamber 101",
    968, 282, "north-east"),

  room(1, "102", "MBA Classroom 102",
    949, 458, "east-middle"),

  room(1, "103", "MBA Classroom 103",
    943, 606, "east-middle"),

  room(1, "106", "MBA Staff Room 106",
    815, 758, "east-middle"),

  room(1, "mba-library", "MBA Library",
    505, 535, "middle-center"),

  room(1, "116", "Aptitude Lab 116",
    114, 641, "west-middle"),

  room(1, "137", "Digital Library 137",
    147, 1034, "west-low"),

  room(1, "135", "Library 135",
    265, 1190, "stairs"),

  room(1, "134", "E & C Lab 8 — 134",
    403, 1048, "low-center"),

  room(1, "132", "E & C Lab 7 — 132",
    522, 1062, "south-center"),

  room(1, "130", "E & C Lab 6 — 130",
    527, 1190, "bottom-center"),

  room(1, "129", "E & C Lab 5 — 129",
    480, 1320, "bottom-west"),

  room(1, "128", "E & C Lab 4 — 128",
    609, 1328, "bottom-center"),

  room(1, "126", "E & C Lab 3 — 126",
    776, 1336, "bottom-east"),

  room(1, "125", "E & C Lab 2 — 125",
    908, 1342, "bottom-east"),

  room(1, "lab1", "E & C Lab 1",
    932, 1159, "south-east"),


  // Second floor
  room(2, "213", "Mathematics Department 213",
    580, 334, "north-center"),

  room(2, "214", "Faculty Department 214",
    443, 331, "north-west"),

  room(2, "215", "Student Lounge 215",
    281, 336, "north-west"),

  room(2, "211", "E & C Classroom 211",
    795, 326, "north-center"),

  room(2, "201", "MBA Placement 201",
    1006, 305, "north-east"),

  room(2, "202", "MBA Classroom 202",
    1000, 480, "east-middle"),

  room(2, "203", "MBA Classroom 203",
    995, 608, "east-middle"),

  room(2, "206", "IS Classroom 206",
    882, 755, "east-middle"),

  room(2, "209", "Computer Lab 209",
    577, 480, "middle-center"),

  room(2, "208", "Civil Computer Lab 208",
    581, 611, "middle-center"),

  room(2, "218", "Physics Lab 218",
    189, 595, "west-middle"),

  room(2, "219", "Drawing Room 219",
    403, 756, "core-west"),

  room(2, "220", "Intel Lab 220",
    604, 770, "core-west"),

  room(2, "240", "Chemistry Lab 240",
    202, 934, "west-low"),

  room(2, "239", "Library 239",
    309, 1229, "stairs"),

  room(2, "238", "CS Classroom 238",
    471, 1055, "low-center"),

  room(2, "236", "CS Classroom 236",
    588, 1068, "south-center"),

  room(2, "234", "CS Classroom 234",
    591, 1212, "bottom-center"),

  room(2, "226", "CS Classroom 226",
    991, 1199, "south-east"),

  room(2, "229", "IS Lab 2 — 229",
    974, 1343, "bottom-east"),

  room(2, "230", "IS Lab 3 — 230",
    845, 1341, "bottom-east"),

  room(2, "232", "IS Lab 4",
    661, 1342, "bottom-center"),

  room(2, "233", "IS Lab 5 — 233",
    546, 1340, "bottom-west"),


  // Third floor
  room(3, "301", "Civil Staff Room 301",
    977, 237, "north-east"),

  room(3, "302", "Civil Classroom 302",
    983, 366, "north-east"),

  room(3, "303", "Civil Classroom 303",
    987, 490, "east-middle"),

  room(3, "306", "Civil Classroom 306",
    875, 632, "east-middle"),

  room(3, "307", "Store Room 307",
    695, 663, "middle-center"),

  room(3, "308", "Civil Classroom 308",
    566, 507, "middle-center"),

  room(3, "309", "Civil Classroom 309",
    565, 402, "north-center"),

  room(3, "313", "Civil Classroom 313",
    546, 283, "north-center"),

  room(3, "314", "First Year L Classroom 314",
    434, 298, "north-west"),

  room(3, "315", "First Year K Classroom 315",
    318, 305, "north-west"),

  room(3, "319", "First Year I Classroom 319",
    219, 554, "west-middle"),

  room(3, "320", "First Year H Classroom 320",
    215, 665, "west-middle"),

  room(3, "321", "Environmental Lab 321",
    403, 658, "core-west"),

  room(3, "training", "Training Room",
    604, 673, "core-west"),

  room(3, "322", "Room 322",
    604, 826, "low-center"),

  room(3, "343", "First Year F Classroom 343",
    463, 949, "low-center"),

  room(3, "344", "CS M.Tech Lab 344",
    316, 973, "stairs"),

  room(3, "arm", "ARM Lab",
    581, 974, "south-center"),

  room(3, "340", "EC Classroom 340",
    586, 1074, "south-center"),

  room(3, "339", "CS Classroom 339",
    585, 1160, "bottom-center"),

  room(3, "338", "Security 338",
    442, 1301, "bottom-west"),

  room(3, "337", "Classroom 337",
    509, 1280, "bottom-west"),

  room(3, "336", "IS Classroom 336",
    595, 1289, "bottom-center"),

  room(3, "335", "IS Classroom 335",
    684, 1294, "bottom-center"),

  room(3, "334", "IS Classroom 334",
    786, 1301, "bottom-east"),

  room(3, "333", "IS Classroom 333",
    895, 1309, "bottom-east")
];