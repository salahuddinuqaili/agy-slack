import type { SlackChannel, SlackUser } from "./types";

const FIRST = [
  "Alex",
  "Sam",
  "Jordan",
  "Chris",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Quinn",
  "Avery",
  "Jamie",
  "Cameron",
  "Drew",
  "Skyler",
  "Reese",
  "Parker",
  "Rowan",
  "Sage",
  "Phoenix",
  "Harper",
] as const;

const LAST = [
  "Kim",
  "Park",
  "Shah",
  "Rossi",
  "Chen",
  "Okoye",
  "Berg",
  "Nielsen",
  "Patel",
  "Silva",
  "Wright",
  "Khan",
  "Nakamura",
  "Costa",
  "Novak",
  "Ibrahim",
  "Andersen",
  "Kowalski",
  "Santos",
  "Nguyen",
] as const;

const TZ = [
  "Europe/Berlin",
  "America/Los_Angeles",
  "America/New_York",
  "Asia/Tokyo",
  "Africa/Lagos",
  "Europe/London",
  "Asia/Kolkata",
  "Pacific/Auckland",
] as const;

export interface Crowd {
  users: SlackUser[];
  channels: SlackChannel[];
  unique: SlackUser[];
  alexes: SlackUser[];
  unicode: SlackUser[];
  dotted: SlackUser[];
  prefix: {
    ann: SlackUser;
    anna: SlackUser;
    annabelle: SlackUser;
  };
  deleted: SlackUser[];
  bots: SlackUser[];
  jordans: SlackUser[];
  obriens: SlackUser[];
}

function user(partial: SlackUser): SlackUser {
  return partial;
}

function dmFor(u: SlackUser): SlackChannel {
  const suffix = u.id.replace(/^U0C/, "");
  return {
    id: `D0C${suffix}`,
    name: u.name,
    nameNormalized: u.name.toLowerCase(),
    isIm: true,
    isMember: true,
    user: u.id,
    unreadCount: 0,
  };
}

/** Deterministic 1000-user Slack workspace used by CI. */
export function makeCrowd(count = 1000): Crowd {
  if (count < 50) throw new Error("makeCrowd needs at least 50 users");

  const users: SlackUser[] = [];
  const unique: SlackUser[] = [];
  const alexes: SlackUser[] = [];
  const unicode: SlackUser[] = [];
  const dotted: SlackUser[] = [];
  const deleted: SlackUser[] = [];
  const bots: SlackUser[] = [];
  const jordans: SlackUser[] = [];
  const obriens: SlackUser[] = [];
  const prefixUsers: Partial<Crowd["prefix"]> = {};


  for (let i = 0; i < count; i += 1) {
    const id = `U0C${String(i).padStart(4, "0")}`;
    const tz = TZ[i % TZ.length];

    if (i < 700) {
      const u = user({
        id,
        name: `person${i}`,
        displayName: `person${i}`,
        realName: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]} ${i}`,
        email: `person${i}@northstar.example`,
        title: i % 17 === 0 ? "Staff engineer" : "Engineer",
        tz,
      });
      users.push(u);
      unique.push(u);
      continue;
    }

    if (i < 750) {
      const n = i - 700;
      const u = user({
        id,
        name: `alex${n}`,
        displayName: "Alex",
        realName: `Alex ${LAST[n % LAST.length]} ${n}`,
        email: `alex${n}@northstar.example`,
        title: "Engineer",
        tz,
      });
      users.push(u);
      alexes.push(u);
      continue;
    }

    if (i < 760) {
      const samples: Array<Pick<SlackUser, "name" | "displayName" | "realName" | "email">> = [
        { name: "jose", displayName: "José", realName: "José García", email: "jose@northstar.example" },
        { name: "muller", displayName: "Müller", realName: "Lina Müller", email: "mueller@northstar.example" },
        { name: "soren", displayName: "Søren", realName: "Søren Nielsen", email: "soren@northstar.example" },
        { name: "francois", displayName: "François", realName: "François Dupont", email: "francois@northstar.example" },
        { name: "asa", displayName: "Åsa", realName: "Åsa Lind", email: "asa@northstar.example" },
        { name: "liwei", displayName: "李伟", realName: "李伟", email: "liwei@northstar.example" },
        { name: "chloe", displayName: "Chloé", realName: "Chloé Martin", email: "chloe@northstar.example" },
        { name: "zoee", displayName: "Zoë", realName: "Zoë Papadopoulos", email: "zoe@northstar.example" },
        { name: "ivan", displayName: "Иван", realName: "Иван Петров", email: "ivan@northstar.example" },
        { name: "seol", displayName: "설", realName: "설민준", email: "seol@northstar.example" },
      ];
      const sample = samples[i - 750]!;
      const u = user({ id, title: "Engineer", tz, ...sample });
      users.push(u);
      unicode.push(u);
      unique.push(u);
      continue;
    }

    if (i < 770) {
      const n = i - 760;
      const u = user({
        id,
        name: `j.smith.${n}`,
        displayName: `j.smith.${n}`,
        realName: `Jordan Smith ${n}`,
        email: `j.smith.${n}@northstar.example`,
        title: "Engineer",
        tz,
      });
      users.push(u);
      dotted.push(u);
      unique.push(u);
      continue;
    }

    if (i < 780) {
      const names = [
        "ann",
        "anna",
        "annabelle",
        "anne",
        "annette",
        "annika",
        "anika",
        "ania",
        "ana",
        "andi",
      ] as const;
      const handle = names[i - 770]!;
      const u = user({
        id,
        name: handle,
        displayName: handle,
        realName: `${handle[0]!.toUpperCase()}${handle.slice(1)} Prefix`,
        email: `${handle}@northstar.example`,
        title: "Engineer",
        tz,
      });
      users.push(u);
      unique.push(u);
      if (handle === "ann" || handle === "anna" || handle === "annabelle") {
        prefixUsers[handle] = u;
      }
      continue;
    }

    if (i < 790) {
      const n = i - 780;
      const u = user({
        id,
        name: `gone${n}`,
        displayName: `gone${n}`,
        realName: `Deleted User ${n}`,
        email: `gone${n}@northstar.example`,
        tz,
        deleted: true,
      });
      users.push(u);
      deleted.push(u);
      continue;
    }

    if (i < 800) {
      const n = i - 790;
      const u = user({
        id,
        name: `bot${n}`,
        displayName: `bot${n}`,
        realName: `Deploy Bot ${n}`,
        email: `bot${n}@northstar.example`,
        tz,
        isBot: true,
      });
      users.push(u);
      bots.push(u);
      unique.push(u);
      continue;
    }

    if (i < 810) {
      const n = i - 800;
      const u = user({
        id,
        name: `jordanlee${n}`,
        displayName: `jordanlee${n}`,
        realName: "Jordan Lee",
        email: `jordanlee${n}@northstar.example`,
        title: "Product",
        tz,
      });
      users.push(u);
      jordans.push(u);
      unique.push(u);
      continue;
    }

    if (i < 820) {
      const n = i - 810;
      const u = user({
        id,
        name: `obrien${n}`,
        displayName: `obrien${n}`,
        realName: `Siobhan O'Brien ${n}`,
        email: `obrien${n}@northstar.example`,
        title: "Design",
        tz,
      });
      users.push(u);
      obriens.push(u);
      unique.push(u);
      continue;
    }

    if (i < 830) {
      const n = i - 820;
      const u = user({
        id,
        name: `mary-jane-${n}`,
        displayName: `mary-jane-${n}`,
        realName: `Mary Jane ${n}`,
        email: `maryjane${n}@northstar.example`,
        tz,
      });
      users.push(u);
      unique.push(u);
      continue;
    }

    const u = user({
      id,
      name: `person${i}`,
      displayName: `person${i}`,
      realName: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]} ${i}`,
      email: `person${i}@northstar.example`,
      title: "Engineer",
      tz,
    });
    users.push(u);
    unique.push(u);
  }

  if (!prefixUsers.ann || !prefixUsers.anna || !prefixUsers.annabelle) {
    throw new Error("prefix cluster missing");
  }
  const prefix = {
    ann: prefixUsers.ann,
    anna: prefixUsers.anna,
    annabelle: prefixUsers.annabelle,
  };

  const channels = users.filter((u) => !u.deleted).map(dmFor);

  return {
    users,
    channels,
    unique,
    alexes,
    unicode,
    dotted,
    prefix,
    deleted,
    bots,
    jordans,
    obriens,
  };
}
