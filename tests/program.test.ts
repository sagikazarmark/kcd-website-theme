/**
 * The programme's pure functions (../program.ts): patches merged record by
 * record on `id`, and the relational checks a Zod shape cannot state. No
 * Lume; the messages' placement in files is the schema plugin's and is
 * tested in schema.test.ts.
 *
 *     deno task test
 */

import { assertEquals } from "@std/assert";
import { applyPatches, checkProgram } from "../program.ts";
import { agenda, speakers } from "./fixtures.ts";

Deno.test("applyPatches: a key in the patch replaces that key, null removes it, the rest of the record stays", () => {
    const { agenda: patched, speakers: people, unknown } = applyPatches(agenda, speakers, {
        agenda: {
            sessions: [{ id: "k8s", cancelled: true, room: "Hall C" }],
            breaks: [{ id: "coffee", icon: "fa-cookie", title: "Cookies" }],
        },
        speakers: [{ id: "ada", photo: "/assets/img/speakers/ada.webp", links: null, title: "Staff Engineer" }],
    });
    assertEquals(unknown, []);

    const k8s = patched.sessions.find((s) => s.id === "k8s")!;
    assertEquals(k8s.cancelled, true);
    assertEquals(k8s.room, "Hall C");
    assertEquals(k8s.title, "Kubernetes for the rest of us", "untouched keys stay");
    assertEquals(k8s.speakers, ["bram"]);

    const coffee = patched.breaks!.find((b) => b.id === "coffee")!;
    assertEquals(coffee.icon, "fa-cookie");
    assertEquals(coffee.title, "Cookies");
    assertEquals(coffee.start, "2030-05-15T09:45:00");

    const ada = people.find((s) => s.id === "ada")!;
    assertEquals(ada.photo, "/assets/img/speakers/ada.webp");
    assertEquals(ada.title, "Staff Engineer");
    assertEquals("links" in ada, false, "null clears the key");
    assertEquals(ada.company, "Example Corp");
});

Deno.test("applyPatches: does not mutate its input", () => {
    const before = JSON.stringify([agenda, speakers]);
    applyPatches(agenda, speakers, { agenda: { sessions: [{ id: "k8s", cancelled: true }] }, speakers: [{ id: "ada", bio: null }] });
    assertEquals(JSON.stringify([agenda, speakers]), before);
});

Deno.test("applyPatches: a patch for an id no record has is reported by list and index, not applied", () => {
    const { agenda: patched, unknown } = applyPatches(agenda, speakers, {
        agenda: { sessions: [{ id: "k8s", cancelled: true }, { id: "nope", cancelled: true }], breaks: [{ id: "lunch", icon: "fa-utensils" }] },
        speakers: [{ id: "zed", name: "Zed" }],
    });
    assertEquals(unknown, [
        { concept: "agenda", list: "sessions", index: 1, id: "nope" },
        { concept: "agenda", list: "breaks", index: 0, id: "lunch" },
        { concept: "speakers", list: "", index: 0, id: "zed" },
    ]);
    assertEquals(patched.sessions.find((s) => s.id === "k8s")!.cancelled, true, "the matching patch still applies");
    assertEquals(patched.sessions.length, agenda.sessions.length, "nothing added");
});

Deno.test("applyPatches: without patches the data comes back as it was", () => {
    const { agenda: patched, speakers: people, unknown } = applyPatches(agenda, speakers, undefined);
    assertEquals(patched, agenda);
    assertEquals(people, speakers);
    assertEquals(unknown, []);
    assertEquals(applyPatches({ sessions: [] }, [], undefined).agenda, { sessions: [] }, "no breaks key is invented");
});

Deno.test("checkProgram: the fixture passes", () => {
    assertEquals(checkProgram(agenda, speakers), []);
});

Deno.test("checkProgram: a speaker id no speaker has, a room not in rooms", () => {
    const issues = checkProgram({
        ...agenda,
        sessions: [{ ...agenda.sessions[1], speakers: ["bram", "ghost"], room: "Hall Z" }],
        breaks: [{ ...agenda.breaks[0], room: "Attic" }],
    }, speakers);
    assertEquals(issues, [
        { concept: "agenda", list: "sessions", index: 0, key: ["speakers", 1], message: 'no speaker with id "ghost" in speakers' },
        { concept: "agenda", list: "sessions", index: 0, key: ["room"], message: '"Hall Z" is not in rooms' },
        { concept: "agenda", list: "breaks", index: 0, key: ["room"], message: '"Attic" is not in rooms' },
    ]);
});

Deno.test("checkProgram: duplicate ids in each list and duplicate rooms", () => {
    const issues = checkProgram({
        rooms: ["Hall B", "Hall C", "Hall B"],
        sessions: [agenda.sessions[1], { ...agenda.sessions[2], id: "k8s" }],
        breaks: [agenda.breaks[0], { ...agenda.breaks[1], id: "registration" }],
    }, [...speakers, { id: "ada", name: "Ada Again" }]);
    assertEquals(issues.map((i) => [i.concept, i.list, i.index, i.message]), [
        ["agenda", "rooms", 2, 'duplicate room "Hall B"'],
        ["speakers", "", 3, 'duplicate id "ada"'],
        ["agenda", "sessions", 1, 'duplicate id "k8s"'],
        ["agenda", "breaks", 1, 'duplicate id "registration"'],
    ]);
});

Deno.test("checkProgram: start and end go together and in order; seconds are optional", () => {
    const issues = checkProgram({
        rooms: agenda.rooms,
        sessions: [
            { ...agenda.sessions[1], end: undefined },
            { ...agenda.sessions[2], start: undefined },
            { ...agenda.sessions[3], start: "2030-05-15T11:00", end: "2030-05-15T11:00:00" },
            { ...agenda.sessions[3], id: "fine", start: "2030-05-15T11:00", end: "2030-05-15T11:40:00" },
        ],
        breaks: [{ ...agenda.breaks[0], end: "2030-05-15T07:00:00" }],
    }, speakers);
    assertEquals(issues.map((i) => [i.list, i.index, i.key, i.message]), [
        ["sessions", 0, ["end"], "missing: start and end go together"],
        ["sessions", 1, ["start"], "missing: start and end go together"],
        ["sessions", 2, ["end"], "must be after start"],
        ["breaks", 0, ["end"], "must be after start"],
    ]);
});
