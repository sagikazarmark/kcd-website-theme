// Site-wide behaviour, loaded deferred from layouts/base.vto on every page.
// Plain script, no modules, no build step. Each initialiser below is
// independent and checks for the markup it drives before doing anything, so
// the same file serves pages that have none of it.
//
// Not here on purpose: the agenda teaser's random pick (inline in the home
// page, src/index.vto; it has to run before paint), the
// pretix callback (src/_components/pretix/head.vto; it must exist before the
// widget script loads) and the attending-badge generator (page-specific).

// menu: the panel of comp.menu. Closes on Escape and on a click outside, so
// it behaves like a menu rather than a box that sticks open.
(() => {
    const header = document.querySelector("[data-menu]");
    if (!header) return;

    const toggle = header.querySelector("[data-menu-toggle]");
    const panel = header.querySelector("[data-menu-panel]");
    const icon = toggle.querySelector("i");

    const setOpen = (open) => {
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        // Swap the glyph only; the rest of the icon's classes are ui.icon's.
        icon.classList.toggle("fa-bars", !open);
        icon.classList.toggle("fa-xmark", open);
    };

    toggle.addEventListener("click", () => setOpen(panel.hidden));

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !panel.hidden) {
            setOpen(false);
            toggle.focus();
        }
    });

    document.addEventListener("click", (e) => {
        if (!panel.hidden && !header.contains(e.target)) {
            setOpen(false);
        }
    });
})();

// dialogs: comp.dialog.frame. Opens the <dialog data-dialog> named by a
// [data-dialog-open="<id>"] button; closes it from [data-dialog-close], the
// Escape key (native) or a click on the backdrop. The open dialog's id is
// mirrored into the URL hash so a session, speaker, keynote or organizer can
// be deep-linked (/agenda/#session-123, /#keynote-jane-doe), and a matching
// hash on load opens that dialog. Without this script the cards still show
// every key fact; only abstracts and bios stay hidden.
(() => {
    const dialogs = Array.from(document.querySelectorAll("dialog[data-dialog]"));
    if (dialogs.length === 0) return;

    const closeAll = () => {
        dialogs.forEach((dialog) => dialog.open && dialog.close());
    };

    const open = (dialog, { updateHash = true } = {}) => {
        if (dialog.open) return;
        closeAll();
        dialog.showModal();
        if (updateHash && location.hash !== `#${dialog.id}`) {
            history.replaceState(null, "", `#${dialog.id}`);
        }
    };

    dialogs.forEach((dialog) => {
        // The frame has no padding, so a click whose target is the dialog
        // itself landed on the backdrop.
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) dialog.close();
        });
        dialog.addEventListener("close", () => {
            if (location.hash === `#${dialog.id}`) {
                history.replaceState(null, "", location.pathname + location.search);
            }
        });
        dialog.querySelectorAll("[data-dialog-close]").forEach((button) => {
            button.addEventListener("click", () => dialog.close());
        });
    });

    document.querySelectorAll("[data-dialog-open]").forEach((button) => {
        button.addEventListener("click", () => {
            const dialog = document.getElementById(button.dataset.dialogOpen);
            if (dialog && dialogs.includes(dialog)) open(dialog);
        });
    });

    const syncWithHash = () => {
        const id = decodeURIComponent(location.hash.slice(1));
        const dialog = id ? document.getElementById(id) : null;
        if (dialog && dialogs.includes(dialog)) {
            open(dialog, { updateHash: false });
        } else {
            closeAll();
        }
    };

    globalThis.addEventListener("hashchange", syncWithHash);
    syncWithHash();
})();

// countdown: the comp.ui.countdown card in the hero. Fills the digits every
// second; once the deadline passes, swaps the heading and status line for the
// expired texts stored on the card as data attributes. Copy elsewhere on the
// page that changes at the same deadline is handled by `timed` below.
(() => {
    const countdown = document.querySelector("[data-countdown]");
    if (!countdown) return;

    const card = countdown.closest("[data-countdown-card]");
    const heading = card.querySelector("[data-countdown-heading]");
    const status = card.querySelector("[data-countdown-status]");
    const deadline = new Date(countdown.dataset.deadline).getTime();
    const units = {
        days: countdown.querySelector("[data-countdown-days]"),
        hours: countdown.querySelector("[data-countdown-hours]"),
        minutes: countdown.querySelector("[data-countdown-minutes]"),
        seconds: countdown.querySelector("[data-countdown-seconds]"),
    };
    let interval;

    const expire = () => {
        heading.textContent = card.dataset.expiredHeading;
        status.textContent = card.dataset.expiredStatus;
        countdown.setAttribute("aria-label", card.dataset.expiredStatus);
    };

    const updateCountdown = () => {
        const remaining = Math.max(0, deadline - Date.now());
        const totalSeconds = Math.ceil(remaining / 1000);
        const values = {
            days: Math.floor(totalSeconds / 86400),
            hours: Math.floor((totalSeconds % 86400) / 3600),
            minutes: Math.floor((totalSeconds % 3600) / 60),
            seconds: totalSeconds % 60,
        };

        Object.entries(values).forEach(([unit, value]) => {
            units[unit].textContent = String(value).padStart(2, "0");
        });

        countdown.setAttribute(
            "aria-label",
            `${values.days} days, ${values.hours} hours, ${values.minutes} minutes and ${values.seconds} seconds ${card.dataset.ariaSuffix}`,
        );

        if (remaining === 0) {
            clearInterval(interval);
            expire();
        }
    };

    updateCountdown();
    if (Date.now() < deadline) {
        interval = setInterval(updateCountdown, 1000);
    }
})();

// timed: the comp.ui.until / comp.ui.after pair. The build set each span's
// `hidden` from the build clock; this re-evaluates against the browser clock
// (the build may be hours old) and schedules a flip for the next deadline
// still ahead. setTimeout overflows past 2^31-1 ms, so long waits are split
// and re-armed; a tab that was asleep re-checks when it becomes visible.
(() => {
    const spans = Array.from(document.querySelectorAll("[data-until], [data-after]"));
    if (spans.length === 0) return;

    const MAX_DELAY = 2147483647;
    let timer;

    const update = () => {
        const now = Date.now();
        let next = Infinity;
        spans.forEach((span) => {
            const isUntil = span.dataset.until !== undefined;
            const time = new Date(isUntil ? span.dataset.until : span.dataset.after).getTime();
            span.hidden = isUntil ? now >= time : now < time;
            if (time > now && time < next) next = time;
        });
        clearTimeout(timer);
        if (next !== Infinity) {
            timer = setTimeout(update, Math.min(next - now, MAX_DELAY));
        }
    };

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) update();
    });
    update();
})();

// smoothScroll: in-page links glide to their target instead of jumping. Left
// out: the terms page's language tabs (hash links that `termsTabs` below turns
// into tabs that must not scroll), links to a dialog (the hash change is what
// `dialogs` listens for, so preventing it would keep the dialog shut), and a
// bare "#" (not a selector).
(() => {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (href === "#" || anchor.closest("[data-language-tabs]")) return;
        const target = document.getElementById(href.slice(1));
        if (!target || target.matches("dialog[data-dialog]")) return;
        anchor.addEventListener("click", (e) => {
            e.preventDefault();
            target.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    });
})();

// termsTabs: upgrades the language links above the terms (the site's terms.vto) into
// WAI-ARIA tabs: one version visible at a time, roving tabindex, arrow-key
// navigation. The URL hash (#hu, #en) picks the initial tab and follows the
// selection so a version can be deep-linked. Without this script the
// versions stack and the links simply jump to them.
(() => {
    const languageTabs = document.querySelector("[data-language-tabs]");
    if (!languageTabs) return;

    const tablist = languageTabs.querySelector("[data-language-tablist]");
    const tabs = Array.from(languageTabs.querySelectorAll("[data-language-tab]"));
    const panels = Array.from(languageTabs.querySelectorAll("[data-language-panel]"));
    const langs = tabs.map((tab) => tab.dataset.languageTab);

    const select = (lang, { focus = false, updateHash = true } = {}) => {
        tabs.forEach((tab) => {
            const selected = tab.dataset.languageTab === lang;
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;
            if (selected && focus) {
                tab.focus();
            }
        });
        panels.forEach((panel) => {
            panel.hidden = panel.dataset.languagePanel !== lang;
        });
        if (updateHash && location.hash !== `#${lang}`) {
            history.replaceState(null, "", `#${lang}`);
        }
    };

    const langFromHash = () => {
        const lang = location.hash.slice(1);
        return langs.includes(lang) ? lang : null;
    };

    tablist.setAttribute("role", "tablist");
    tabs.forEach((tab) => {
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", tab.dataset.languageTab);
        tab.addEventListener("click", (event) => {
            event.preventDefault();
            select(tab.dataset.languageTab);
        });
    });
    panels.forEach((panel) => {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", `tab-${panel.dataset.languagePanel}`);
        panel.tabIndex = 0;
    });

    tablist.addEventListener("keydown", (event) => {
        const current = langs.indexOf(document.activeElement.dataset.languageTab);
        if (current === -1) return;

        const moves = {
            ArrowRight: (current + 1) % langs.length,
            ArrowLeft: (current - 1 + langs.length) % langs.length,
            Home: 0,
            End: langs.length - 1,
        };
        if (event.key in moves) {
            event.preventDefault();
            select(langs[moves[event.key]], { focus: true });
        }
    });

    globalThis.addEventListener("hashchange", () => {
        const lang = langFromHash();
        if (lang) select(lang, { updateHash: false });
    });

    select(langFromHash() || langs[0], { updateHash: false });
})();
