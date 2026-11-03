/**
 * The view model (../schedule.ts) as a function over programme data: what
 * the agenda and speaker pages can rely on about `schedule`. The fixture is
 * the small valid programme in fixtures.ts, bent per test. No Lume.
 *
 *     deno task test
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { buildSchedule, emptySchedule, type ScheduleIO } from "../schedule.ts";
import { agenda, speakers } from "./fixtures.ts";

/** Every photo exists, unless the test says otherwise. */
const io: ScheduleIO = { exists: () => true };

Deno.test("buildSchedule: with neither concept the schedule is empty; with only speakers there are no days", () => {
    assertEquals(buildSchedule({}, io), emptySchedule);
    const only = buildSchedule({ speakers }, io);
    assertEquals(only.days, []);
    assertEquals(only.sessions, []);
    assertEquals(only.speakers, [], "a speaker with no talk is not listed");
});

Deno.test("buildSchedule: the timetable has one row per start time, breaks and plenary items span the tracks, parallel talks take their columns", () => {
    const schedule = buildSchedule({ agenda, speakers }, io);
    assertEquals(schedule.rooms, ["Hall B", "Hall C"]);
    assertEquals(schedule.days.length, 1);
    const [day] = schedule.days;
    assertEquals(day.date, "2030-05-15");
    assertEquals(day.label, "Wednesday, 15 May 2030");
    assertEquals(day.rows.map((r) => r.start), ["08:00", "09:00", "09:45", "10:00"]);

    const [registration] = day.rows[0].sessions;
    assertEquals(registration.session.isBreak, true);
    assertEquals(registration.session.icon, "fa-id-badge", "icon from the title");
    assertEquals(registration.track, null, "plenary spans the tracks");
    assertEquals(registration.rowSpan, 1);

    const [keynote] = day.rows[1].sessions;
    assertEquals(keynote.session.format, "Keynote");
    assertEquals(keynote.session.isPlenary, true);
    assertEquals(keynote.track, null);

    const parallel = day.rows[3].sessions;
    assertEquals(parallel.map((p) => [p.session.id, p.track]), [["k8s", 0], ["o11y", 1]], "ordered by track");
    assertEquals(day.rows[3].startsAt, "2030-05-15T10:00:00");
});

Deno.test("buildSchedule: an item covers every later row that starts before it ends", () => {
    const long = {
        ...agenda,
        breaks: [...agenda.breaks, { title: "Lunch", room: "Hall C", start: "2030-05-15T09:00:00", end: "2030-05-15T10:40:00" }],
    };
    const [day] = buildSchedule({ agenda: long, speakers }, io).days;
    const lunch = day.rows[1].sessions.find((p) => p.session.title === "Lunch")!;
    assertEquals(lunch.track, 1, "not plenary: stays in its track");
    assertEquals(lunch.rowSpan, 3, "09:00 through 09:45 and 10:00");
    const keynote = day.rows[1].sessions.find((p) => p.session.id === "keynote")!;
    assertEquals(keynote.track, 0, "a plenary item with a genuinely busy other track stays put");
});

Deno.test("buildSchedule: a room used only by plenary items is not a track; a lone room still is", () => {
    const hall = buildSchedule({
        agenda: { ...agenda, rooms: ["Main Hall", "Hall B", "Hall C"], sessions: agenda.sessions.map((s) => s.id === "keynote" ? { ...s, room: "Main Hall" } : s) },
        speakers,
    }, io);
    assertEquals(hall.rooms, ["Hall B", "Hall C"]);

    const single = buildSchedule({
        agenda: { rooms: ["The Room"], sessions: [{ ...agenda.sessions[0], room: "The Room" }] },
        speakers,
    }, io);
    assertEquals(single.rooms, ["The Room"], "every item plenary: the one room is the track");
});

Deno.test("buildSchedule: an unscheduled talk is in sessions (last) and in its speaker's talks, not on a day", () => {
    const schedule = buildSchedule({ agenda, speakers }, io);
    assertEquals(schedule.sessions.map((s) => s.id), ["keynote", "k8s", "o11y", "tba"]);
    const tba = schedule.sessions[3];
    assertEquals([tba.start, tba.end, tba.room, tba.date, tba.minutes], [null, null, null, null, null]);
    const chloe = schedule.speakers.find((s) => s.id === "chloe")!;
    assertEquals(chloe.sessions.map((t) => t.id), ["o11y", "tba"], "scheduled first");
    assert(!schedule.days[0].rows.some((r) => r.sessions.some((p) => p.session.id === "tba")));
});

Deno.test("buildSchedule: a speaker has initials, byline (title and company, else tagline), links (empty map when none), paragraphs and avatar", () => {
    const schedule = buildSchedule({ agenda, speakers }, io);
    const [ada, bram, chloe] = schedule.speakers;
    assertEquals(schedule.speakers.map((s) => s.name), ["Ada Example", "Bram Placeholder", "Chloé Sample"], "by name");
    assertEquals(ada.initials, "AE");
    assertEquals(ada.byline, "Platform Engineer, Example Corp");
    assertEquals(ada.links, { linkedin: "https://example.com/ada" });
    assertEquals(ada.bio, ["Para one.", "Para two."]);
    assertEquals(ada.avatar, null);
    assertEquals(ada.isKeynote, true);
    assertEquals(bram.byline, "SRE at Demo Cloud", "the tagline when title and company are missing");
    assertEquals(bram.links, {});
    assertEquals(chloe.byline, "Developer Advocate");
    assertEquals(chloe.isKeynote, false);
});

Deno.test("buildSchedule: a photo is the avatar and must exist", () => {
    const withPhoto = [{ ...speakers[0], photo: "/assets/img/speakers/ada.webp" }, ...speakers.slice(1)];
    assertEquals(buildSchedule({ agenda, speakers: withPhoto }, io).speakers[0].avatar, "/assets/img/speakers/ada.webp");
    assertThrows(
        () => buildSchedule({ agenda, speakers: withPhoto }, { exists: () => false }),
        Error,
        "Photo of Ada Example (ada) is not a file under src/: /assets/img/speakers/ada.webp",
    );
});

Deno.test("buildSchedule: a cancelled talk keeps its slot and dialog, marked; a speaker with no other talk is not listed; a cancelled keynote does not make a keynote speaker", () => {
    const cancelled = {
        ...agenda,
        sessions: agenda.sessions.map((s) => s.id === "k8s" || s.id === "keynote" ? { ...s, cancelled: true } : s),
    };
    const schedule = buildSchedule({ agenda: cancelled, speakers }, io);
    const k8s = schedule.sessions.find((s) => s.id === "k8s")!;
    assertEquals(k8s.cancelled, true);
    assert(schedule.days[0].rows[3].sessions.some((p) => p.session.id === "k8s"), "still on the timetable");
    assertEquals(schedule.speakers.map((s) => s.id), ["chloe"], "ada (cancelled keynote) and bram (cancelled talk) are not listed");
    assertEquals(schedule.sessions.find((s) => s.id === "keynote")!.format, "Keynote", "the pill stays on the card");
});

Deno.test("buildSchedule: patches are applied before building", () => {
    const schedule = buildSchedule({
        agenda,
        speakers,
        patches: {
            agenda: { sessions: [{ id: "k8s", cancelled: true }], breaks: [{ id: "coffee", icon: "fa-cookie" }] },
            speakers: [{ id: "bram", title: "Site Reliability Engineer", company: "Demo Cloud" }],
        },
    }, io);
    assertEquals(schedule.sessions.find((s) => s.id === "k8s")!.cancelled, true);
    assertEquals(schedule.days[0].rows[2].sessions[0].session.icon, "fa-cookie");
    assertEquals(schedule.speakers.map((s) => s.id), ["ada", "chloe"], "bram's only talk is cancelled");
});

Deno.test("buildSchedule: a lightning talk is a plenary talk of ten minutes or less; times without seconds work", () => {
    const schedule = buildSchedule({
        agenda: {
            rooms: ["Hall B"],
            sessions: [{ id: "flash", title: "Flash", speakers: ["ada"], room: "Hall B", start: "2030-05-15T12:00", end: "2030-05-15T12:10", plenary: true }],
        },
        speakers,
    }, io);
    const [flash] = schedule.sessions;
    assertEquals(flash.format, "Lightning talk");
    assertEquals(flash.minutes, 10);
    assertEquals(flash.startsAt, "2030-05-15T12:00:00");
    assertEquals(schedule.days[0].rows[0].startsAt, "2030-05-15T12:00:00");
});

Deno.test("buildSchedule: a break without an id or room spans the tracks and gets a stable id", () => {
    const schedule = buildSchedule({
        agenda: { ...agenda, breaks: [{ title: "Closing remarks", start: "2030-05-15T17:00:00", end: "2030-05-15T17:30:00" }] },
        speakers,
    }, io);
    const [closing] = schedule.days[0].rows.at(-1)!.sessions;
    assertEquals(closing.track, null);
    assertEquals(closing.session.id, "break-0");
    assertEquals(closing.session.icon, "fa-flag-checkered");
});
