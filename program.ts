/**
 * The programme as data: `agenda` and `speakers` (./schema/concepts.ts)
 * with `patches` merged over them, and the checks that span records. Two
 * pure functions, used by the schema (./schema/mod.ts) and the view model
 * (./schedule.ts) alike, so what is validated is what is rendered:
 *
 *   applyPatches   merges the patches over the records, matched on `id`.
 *                  A key in a patch replaces that key wholesale; `null`
 *                  removes it. A patch for an id no record has is reported,
 *                  not applied; patches never add records.
 *   checkProgram   what a Zod shape cannot state: unique ids, speakers and
 *                  rooms that exist, `start` and `end` together and in order.
 */

import type {
  Agenda,
  AgendaBreak,
  AgendaSession,
  Patches,
  SpeakerRecord,
  Speakers,
} from "./schema/concepts.ts";

/** Where a problem is: which list of which concept, which record, which key inside it. */
export interface ProgramIssue {
  concept: "agenda" | "speakers";
  /** `sessions`, `breaks` or `rooms` under `agenda`; `""` for the `speakers` list itself. */
  list: "sessions" | "breaks" | "rooms" | "";
  index: number;
  /** Key path inside the record; `[]` when about the record as a whole. */
  key: PropertyKey[];
  message: string;
}

/** A patch that matched nothing. */
export interface UnknownPatch {
  concept: "agenda" | "speakers";
  list: "sessions" | "breaks" | "";
  /** Index in the patch list. */
  index: number;
  id: string;
}

export interface Patched {
  agenda: Agenda;
  speakers: Speakers;
  unknown: UnknownPatch[];
}

type Record_ = Record<string, unknown>;

/** One list, patched; records are copied, never mutated. Patches are typed loosely: the schema (`patchOf`) has already checked them. */
function patchList<T extends { id?: string }>(
  records: readonly T[],
  patches: readonly Record_[] | undefined,
  report: (index: number, id: string) => void,
): T[] {
  const out = records.map((record) => ({ ...record }));
  patches?.forEach((patch, index) => {
    const id = String(patch.id);
    const target = out.find((record) => record.id === id);
    if (!target) {
      report(index, id);
      return;
    }
    for (const [key, value] of Object.entries(patch)) {
      if (key === "id") continue;
      if (value === null) delete (target as Record_)[key];
      else (target as Record_)[key] = value;
    }
  });
  return out;
}

/** The two concepts with `patches` applied; see the header. */
export function applyPatches(
  agenda: Agenda,
  speakers: Speakers,
  patches: Patches | undefined,
): Patched {
  const unknown: UnknownPatch[] = [];
  const sessions = patchList(
    agenda.sessions,
    patches?.agenda?.sessions,
    (index, id) => unknown.push({ concept: "agenda", list: "sessions", index, id }),
  );
  const breaks = agenda.breaks === undefined && !patches?.agenda?.breaks
    ? undefined
    : patchList(
      agenda.breaks ?? [],
      patches?.agenda?.breaks,
      (index, id) => unknown.push({ concept: "agenda", list: "breaks", index, id }),
    );
  const people = patchList(
    speakers,
    patches?.speakers,
    (index, id) => unknown.push({ concept: "speakers", list: "", index, id }),
  );
  return {
    agenda: { ...agenda, sessions, ...(breaks ? { breaks } : {}) },
    speakers: people,
    unknown,
  };
}

// ---------------------------------------------------------------------------
// Checks

/** "2030-05-15T09:00" and "2030-05-15T09:00:00" compare as the same moment. */
function moment(local: string): string {
  return local.length === 16 ? `${local}:00` : local;
}

/** The relational rules over the patched programme; each issue names its record by list and index. */
export function checkProgram(agenda: Agenda, speakers: Speakers): ProgramIssue[] {
  const issues: ProgramIssue[] = [];
  const at = (
    concept: ProgramIssue["concept"],
    list: ProgramIssue["list"],
    index: number,
    key: PropertyKey[],
    message: string,
  ) => issues.push({ concept, list, index, key, message });

  // Rooms: unique names.
  const rooms = new Set<string>();
  (agenda.rooms ?? []).forEach((room, index) => {
    if (rooms.has(room)) at("agenda", "rooms", index, [], `duplicate room "${room}"`);
    rooms.add(room);
  });

  // Speakers: unique ids.
  const speakerIds = new Set<string>();
  speakers.forEach((speaker, index) => {
    if (speakerIds.has(speaker.id)) {
      at("speakers", "", index, ["id"], `duplicate id "${speaker.id}"`);
    }
    speakerIds.add(speaker.id);
  });

  const timed = (
    list: "sessions" | "breaks",
    index: number,
    item: { start?: string; end?: string },
  ) => {
    const { start, end } = item;
    if ((start === undefined) !== (end === undefined)) {
      const missing = start === undefined ? "start" : "end";
      at("agenda", list, index, [missing], "missing: start and end go together");
    } else if (start !== undefined && end !== undefined && moment(end) <= moment(start)) {
      at("agenda", list, index, ["end"], "must be after start");
    }
  };

  const inRooms = (list: "sessions" | "breaks", index: number, room: string | undefined) => {
    if (room !== undefined && !rooms.has(room)) {
      at("agenda", list, index, ["room"], `"${room}" is not in rooms`);
    }
  };

  // Sessions: unique ids, known speakers and room, consistent times.
  const sessionIds = new Set<string>();
  agenda.sessions.forEach((session: AgendaSession, index) => {
    if (sessionIds.has(session.id)) {
      at("agenda", "sessions", index, ["id"], `duplicate id "${session.id}"`);
    }
    sessionIds.add(session.id);
    session.speakers.forEach((id, position) => {
      if (!speakerIds.has(id)) {
        at(
          "agenda",
          "sessions",
          index,
          ["speakers", position],
          `no speaker with id "${id}" in speakers`,
        );
      }
    });
    inRooms("sessions", index, session.room);
    timed("sessions", index, session);
  });

  // Breaks: unique ids where given, known room, end after start.
  const breakIds = new Set<string>();
  (agenda.breaks ?? []).forEach((item: AgendaBreak, index) => {
    if (item.id !== undefined) {
      if (breakIds.has(item.id)) {
        at("agenda", "breaks", index, ["id"], `duplicate id "${item.id}"`);
      }
      breakIds.add(item.id);
    }
    inRooms("breaks", index, item.room);
    timed("breaks", index, item);
  });

  return issues;
}

export type { Agenda, AgendaBreak, AgendaSession, Patches, SpeakerRecord, Speakers };
