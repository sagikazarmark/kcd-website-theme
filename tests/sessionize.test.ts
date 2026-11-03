/**
 * The Sessionize converter as a function: `fromSessionize()` on the two
 * fixture views under tests/fixtures/sessionize/ (a fictional five-speaker
 * event with a keynote, a cancelled talk, a talk without a slot, custom
 * questions and typed links), asserted field by field against the `agenda`
 * and `speakers` concepts it should produce. No network, no Lume.
 *
 *     deno task test
 */

import { assert, assertEquals } from "@std/assert";
import { agendaSchema, speakersSchema } from "../schema/concepts.ts";
import { checkProgram } from "../program.ts";
import { type ApiAll, type ApiGridDay, fromSessionize, isMirrored } from "../sessionize.ts";

const fixtures = new URL("./fixtures/sessionize/", import.meta.url);
const all: ApiAll = JSON.parse(await Deno.readTextFile(new URL("All.json", fixtures)));
const grid: ApiGridDay[] = JSON.parse(await Deno.readTextFile(new URL("GridSmart.json", fixtures)));

const converted = fromSessionize(all, grid);
const { agenda, speakers } = converted;

Deno.test("fromSessionize: the output is valid programme data", () => {
    assertEquals(agendaSchema.safeParse(agenda).error?.issues, undefined);
    assertEquals(speakersSchema.safeParse(speakers).error?.issues, undefined);
    assertEquals(checkProgram(agenda, speakers), []);
});

Deno.test("fromSessionize: rooms in sort order; talks from the All view, breaks from the grid", () => {
    assertEquals(agenda.rooms, ["Hall B", "Hall C"]);
    assertEquals(agenda.sessions.map((s) => s.id), ["1001", "1002", "1003", "1004", "1005", "1006"], "scheduled by time and room, the unscheduled one last");
    assertEquals(agenda.breaks?.map((b) => b.title), ["Registration", "Coffee break"]);
    const registration = agenda.breaks![0];
    assertEquals(registration, {
        id: "00000000-0000-4000-8000-00000000a001",
        title: "Registration",
        room: "Hall B",
        start: "2030-05-15T08:00:00",
        end: "2030-05-15T09:00:00",
        plenary: true,
    });
});

Deno.test("fromSessionize: a session carries its speakers, slot and flags; flags only when true", () => {
    const keynote = agenda.sessions.find((s) => s.id === "1001")!;
    assertEquals(keynote.speakers, ["00000000-0000-4000-8000-000000000001"]);
    assertEquals(keynote.room, "Hall B");
    assertEquals(keynote.start, "2030-05-15T09:00:00");
    assertEquals(keynote.end, "2030-05-15T09:45:00");
    assertEquals(keynote.keynote, true, "the Keynote checkbox");
    assertEquals(keynote.plenary, true, "isPlenumSession");
    assertEquals(keynote.cancelled, undefined, "no Cancelled answer is not cancelled");
    assert(keynote.abstract!.startsWith("Conferences come and go"));

    const talk = agenda.sessions.find((s) => s.id === "1002")!;
    assertEquals(Object.keys(talk), ["id", "title", "abstract", "speakers", "room", "start", "end"], "false flags are left out, keys in schema order");
    assertEquals(talk.abstract!.split("\n\n").length, 2, "paragraphs survive, CRLF normalised");

    const cancelled = agenda.sessions.find((s) => s.id === "1005")!;
    assertEquals(cancelled.cancelled, true, 'the Cancelled checkbox answered "true"');
    assertEquals(cancelled.keynote, undefined, 'answered "false" is not a flag');
});

Deno.test("isMirrored: the CDN's file names are the converter's to prune, a portrait of the site's own is not", () => {
    for (const name of ["8db9-400o400o1-test4.jpg", "bd76-400o400o1-YPi5jFpCUbCpseRGHyCEBj.jpg", "b6a1-400o400o1-wBe4ZZNYmKneho6MWu46j9.png"]) {
        assert(isMirrored(name), name);
    }
    for (const name of ["laszlo-kollar.webp", "aiden-test.jpg", "8db9-portrait.jpg", "notes.txt"]) {
        assert(!isMirrored(name), name);
    }
});

Deno.test("fromSessionize: a time with a trailing Z (Sessionize's sample event) is read as the event's local time", () => {
    const zulu = structuredClone(all);
    const raw = zulu.sessions.find((s) => !s.isServiceSession)!;
    raw.startsAt = "2030-05-15T09:00:00Z";
    raw.endsAt = "2030-05-15T09:45:00Z";
    const { agenda } = fromSessionize(zulu, grid);
    const keynote = agenda.sessions.find((s) => s.id === raw.id)!;
    assertEquals(keynote.start, "2030-05-15T09:00:00");
    assertEquals(keynote.end, "2030-05-15T09:45:00");
});

Deno.test("fromSessionize: a talk without a slot has no room or times", () => {
    const tba = agenda.sessions.find((s) => s.id === "1006")!;
    assertEquals(tba.room, undefined);
    assertEquals(tba.start, undefined);
    assertEquals(tba.end, undefined);
    assertEquals(tba.speakers, ["00000000-0000-4000-8000-000000000004"]);
    assertEquals(tba.abstract, "What a two-person team can do.\n\nAnd what it should not.");
});

Deno.test("fromSessionize: speakers by name, with title and company from the questions, photo, links and bio", () => {
    assertEquals(speakers.map((s) => s.name), ["Ada Example", "Bram Placeholder", "Chloé Sample", "Dev Fictional", "Eli Mockup"]);

    const ada = speakers[0];
    assertEquals(ada.title, "Principal Platform Engineer");
    assertEquals(ada.company, "Example Corp");
    assertEquals(ada.tagline, "Principal Platform Engineer at Example Corp");
    assertEquals(ada.photo, "/assets/speakers/0000-400o400o1-AdaExample.jpg", "the CDN file name under the mirror folder");
    assertEquals(ada.links, {
        website: "https://ada.example",
        x: "https://x.com/ada_example",
        linkedin: "https://example.com/kcd-demo-city/ada-example",
        github: "https://github.com/ada-example",
    }, "typed links mapped, Blog before Company_Website for website, Other by host, Facebook dropped, canonical key order");
    assertEquals(ada.bio!.split("\n\n").length, 2);

    const bram = speakers[1];
    assertEquals(bram.links, { linkedin: "https://www.linkedin.com/in/bram-placeholder" }, "a handle in the LinkedIn question becomes a URL");
    assertEquals(bram.photo, undefined);

    const chloe = speakers[2];
    assertEquals(Object.keys(chloe), ["id", "name", "title", "company", "tagline", "bio"], "no empty keys");
});

Deno.test("fromSessionize: the photos to mirror are the referenced CDN file names", () => {
    assertEquals(converted.photos, ["0000-400o400o1-AdaExample.jpg"]);
});

Deno.test("fromSessionize: without a published grid there are no breaks, and the talks keep their slots from the All view", () => {
    const unpublished = fromSessionize(all, []);
    assertEquals(unpublished.agenda.breaks, undefined);
    assertEquals(unpublished.agenda.sessions.length, 6);
    assertEquals(unpublished.agenda.rooms, ["Hall B", "Hall C"]);
});

Deno.test("fromSessionize: is deterministic", () => {
    const again = fromSessionize(
        { ...all, speakers: [...all.speakers].reverse(), sessions: [...all.sessions].reverse() },
        grid,
    );
    assertEquals(again, converted);
});
