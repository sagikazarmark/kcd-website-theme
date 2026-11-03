// All photo processing and PNG generation stays in this browser tab.
const root = document.querySelector("#badge-tool");
const canvas = root.querySelector("#badge-canvas");
const ctx = canvas.getContext("2d");
const controls = root.querySelector("#badge-controls");
const photoInput = root.querySelector("#badge-photo");
const cropControls = root.querySelector("#badge-crop");
const zoom = root.querySelector("#badge-zoom");
const horizontal = root.querySelector("#badge-horizontal");
const vertical = root.querySelector("#badge-vertical");
const nameInput = root.querySelector("#badge-name");
const titleInput = root.querySelector("#badge-title");
const download = root.querySelector("#badge-download");
const status = root.querySelector("#badge-status");
const caption = root.querySelector("#badge-caption");
const copy = root.querySelector("#badge-copy");
const event = root.dataset;
// What the card prints besides the site title, date and venue the page hands
// over in data attributes. The page is a theme page whose markup every
// instance shares, so the two instance-specific lines are derived from what
// is already on it rather than added as attributes:
//   city  the "See you in <city>." line. The site title is "<event.name>
//         <event.year>" and an event is usually named "KCD <City>", so the
//         city is what is left after that prefix and the year; an event named
//         otherwise gets its full name here, which still reads.
//   host  the site's host name, printed at the bottom of the card, from the
//         absolute URL the build wrote into the caption; the page's own host
//         is the fallback, so a preview build prints the preview host.
const city = event.eventName.replace(/\s+\d{4}$/, "").replace(/^KCD\s+/i, "");
const host = (() => {
    const match = caption.value.match(/https?:\/\/\S+/);
    try {
        return new URL(match ? match[0] : location.href).host;
    } catch {
        return location.host;
    }
})();
const size = 1200;
// The card is painted in the site's colour roles (defined on :root by the
// site's src/style.css), read once at load so a re-coloured site hands out a
// matching badge. The hex values are the CNCF defaults, used only if a
// stylesheet failed to load. Navy is the card's own dark ground, not a role:
// it has to stay dark under white text whatever the roles become.
const rootStyle = getComputedStyle(document.documentElement);
const role = (name, fallback) =>
    rootStyle.getPropertyValue(name).trim() || fallback;
const colors = {
    navy: "#0b193b",
    primary: role("--color-primary", "#0086ff"),
    accent: role("--color-accent", "#d62293"),
    secondary: role("--color-secondary", "#93eaff"),
};
const regions = {
    card: { x: 916, y: 470, radius: 204 },
    ring: { x: 600, y: 600, radius: 578 },
};
const state = { mode: "card", photo: null, zoom: 1, x: 0, y: 0 };
let logo;
let background;
let photoRequest = 0;
let assetsReady = false;
let photoLoading = false;

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load image"));
        image.src = url;
    });
}

function circle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
}

function text(
    value,
    x,
    y,
    fontSize,
    color = "white",
    maxWidth = 1060,
    weight = 700,
) {
    // Fit real text metrics, including long names and accented letters.
    ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
    while (ctx.measureText(value).width > maxWidth && fontSize > 18) {
        ctx.font = `${weight} ${--fontSize}px Arial, sans-serif`;
    }
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, maxWidth);
}

function photoBounds() {
    const { radius } = regions[state.mode];
    const scale = Math.max(
        radius * 2 / state.photo.naturalWidth,
        radius * 2 / state.photo.naturalHeight,
    ) * state.zoom;
    const width = state.photo.naturalWidth * scale;
    const height = state.photo.naturalHeight * scale;
    return {
        width,
        height,
        maxX: Math.max(0, width / 2 - radius),
        maxY: Math.max(0, height / 2 - radius),
    };
}

function clampCrop() {
    if (!state.photo) return;
    const { maxX, maxY } = photoBounds();
    state.x = Math.max(-maxX, Math.min(maxX, state.x));
    state.y = Math.max(-maxY, Math.min(maxY, state.y));
    horizontal.value = maxX ? state.x / maxX * 100 : 0;
    vertical.value = maxY ? state.y / maxY * 100 : 0;
    horizontal.disabled = maxX < 1;
    vertical.disabled = maxY < 1;
}

function drawPhoto() {
    const { x, y, radius } = regions[state.mode];
    ctx.save();
    circle(x, y, radius);
    ctx.clip();
    ctx.fillStyle = "#18345d";
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    if (state.photo) {
        const { width, height } = photoBounds();
        ctx.drawImage(
            state.photo,
            x - width / 2 + state.x,
            y - height / 2 + state.y,
            width,
            height,
        );
    } else {
        ctx.fillStyle = "#365980";
        circle(x, y - radius * 0.2, radius * 0.28);
        ctx.fill();
        circle(x, y + radius * 0.72, radius * 0.6);
        ctx.fill();
        ctx.textAlign = "center";
        text(
            "Your photo here",
            x,
            y + radius * 0.7,
            radius * 0.12,
            "white",
            radius * 1.6,
        );
    }
    ctx.restore();
}

function drawCard() {
    ctx.fillStyle = colors.navy;
    ctx.fillRect(0, 0, size, size);
    if (background) {
        const height = 900;
        const width = background.naturalWidth * height /
            background.naturalHeight;
        ctx.drawImage(background, (size - width) / 2, 0, width, height);
        const shade = ctx.createLinearGradient(0, 0, 0, height);
        shade.addColorStop(0, "#0b193b99");
        shade.addColorStop(0.6, "#0b193b99");
        shade.addColorStop(1, colors.navy);
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, size, height);
    }
    ctx.fillStyle = colors.accent;
    ctx.fillRect(0, 0, size, 12);
    if (logo) {
        ctx.drawImage(
            logo,
            70,
            58,
            440,
            440 * logo.naturalHeight / logo.naturalWidth,
        );
    }
    ctx.textAlign = "left";
    text("I'M", 70, 365, 106);
    text("ATTENDING", 70, 472, 100, "white", 620);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(74, 512, 100, 9);
    text(`See you in ${city}.`, 70, 587, 37, colors.secondary, 620, 400);

    drawPhoto();
    const { x, y, radius } = regions.card;
    circle(x, y, radius + 9);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 8;
    ctx.stroke();
    circle(x, y, radius + 22);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 5;
    ctx.stroke();

    text(nameInput.value.trim() || "Be part of the community.", 70, 789, 64);
    text(titleInput.value.trim(), 70, 849, 34, colors.secondary, 1060, 400);
    ctx.fillStyle = "#ffffff33";
    ctx.fillRect(70, 905, 1060, 2);
    text(event.eventName, 70, 978, 43);
    text(`${event.date}  ·  ${event.venue}`, 70, 1040, 34, "white", 1060, 400);
    text(host, 70, 1140, 30, colors.secondary);
}

function drawRing() {
    drawPhoto();
    const { x, y, radius } = regions.ring;
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, colors.accent);
    circle(x, y, radius - 9);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 20;
    ctx.stroke();

    // A curved band sits inside the photo, so it survives circular avatar crops.
    const start = Math.PI * 0.12;
    const end = Math.PI * 0.88;
    const inner = radius - 130;
    ctx.beginPath();
    ctx.arc(x, y, radius - 20, start, end);
    ctx.arc(x, y, inner, end, start, true);
    ctx.closePath();
    ctx.fillStyle = colors.navy;
    ctx.fill();

    const label = `I'M ATTENDING · ${event.eventName.toUpperCase()}`;
    const textRadius = radius - 75;
    let fontSize = 42;
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    while (ctx.measureText(label).width > textRadius * 2.15 && fontSize > 18) {
        ctx.font = `700 ${--fontSize}px Arial, sans-serif`;
    }
    const letters = Array.from(label);
    const widths = letters.map((letter) => ctx.measureText(letter).width + 1);
    let angle = widths.reduce((sum, width) => sum + width, 0) / textRadius / 2;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < letters.length; i++) {
        const step = widths[i] / textRadius;
        angle -= step / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(letters[i], 0, textRadius);
        ctx.restore();
        angle -= step / 2;
    }
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
}

function draw() {
    if (!ctx) return;
    // Stable 1200-unit design space with a 2x backing store for crisp downloads.
    ctx.setTransform(canvas.width / size, 0, 0, canvas.height / size, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (state.mode === "card") drawCard();
    else drawRing();
}

function resetCrop() {
    state.zoom = 1;
    state.x = state.y = 0;
    zoom.value = "1";
    root.querySelector("#badge-zoom-value").textContent = "100%";
    clampCrop();
    draw();
}

root.querySelectorAll('[name="badge-format"]').forEach((input) => {
    input.addEventListener("change", () => {
        state.mode = input.value;
        root.querySelector("#badge-details").hidden = state.mode === "ring";
        root.querySelector("#badge-format-help").textContent =
            state.mode === "card"
                ? "2400 × 2400 PNG · ready for your social feed"
                : "2400 × 2400 PNG · transparent corners for your profile photo";
        resetCrop();
    });
});

photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    const request = ++photoRequest;
    if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 20 * 1024 * 1024
    ) {
        status.textContent =
            "Please choose a JPG, PNG or WebP photo smaller than 20 MB.";
        photoLoading = false;
        download.disabled = !assetsReady || !state.photo;
        return;
    }
    photoLoading = true;
    download.disabled = true;
    status.textContent = "";
    const url = URL.createObjectURL(file);
    try {
        const image = await loadImage(url);
        if (request !== photoRequest) return;
        state.photo = image;
        cropControls.disabled = false;
        canvas.classList.add("has-photo");
        resetCrop();
    } catch {
        if (request === photoRequest) {
            status.textContent =
                "That photo could not be opened. Please try another JPG, PNG or WebP.";
        }
    } finally {
        URL.revokeObjectURL(url);
        if (request === photoRequest) {
            photoLoading = false;
            download.disabled = !assetsReady || !state.photo;
        }
    }
});

zoom.addEventListener("input", () => {
    state.zoom = Number(zoom.value);
    root.querySelector("#badge-zoom-value").textContent = `${
        Math.round(state.zoom * 100)
    }%`;
    clampCrop();
    draw();
});
for (const input of [horizontal, vertical]) {
    input.addEventListener("input", () => {
        if (!state.photo) return;
        const { maxX, maxY } = photoBounds();
        state.x = Number(horizontal.value) / 100 * maxX;
        state.y = Number(vertical.value) / 100 * maxY;
        draw();
    });
}
root.querySelector("#badge-reset").addEventListener("click", resetCrop);
for (const input of [nameInput, titleInput]) {
    input.addEventListener("input", draw);
}

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
    if (!state.photo || !e.isPrimary || e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y, radius } = regions[state.mode];
    if (
        Math.hypot(
            (e.clientX - rect.left) * size / rect.width - x,
            (e.clientY - rect.top) * size / rect.height - y,
        ) > radius
    ) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const scale = size / canvas.getBoundingClientRect().width;
    state.x += (e.clientX - drag.x) * scale;
    state.y += (e.clientY - drag.y) * scale;
    drag.x = e.clientX;
    drag.y = e.clientY;
    clampCrop();
    draw();
});
for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(eventName, () => {
        drag = null;
    });
}

download.addEventListener("click", () => {
    if (!state.photo || !assetsReady || photoLoading) return;
    download.disabled = true;
    const filename = `${
        event.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    }-${state.mode === "card" ? "im-attending" : "profile-ring"}.png`;
    const fail = () => {
        download.disabled = !assetsReady || !state.photo || photoLoading;
        status.textContent = "The PNG could not be created. Please try again.";
    };
    try {
        canvas.toBlob((blob) => {
            if (!blob) return fail();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            download.disabled = !assetsReady || !state.photo || photoLoading;
            status.textContent = "";
        }, "image/png");
    } catch {
        fail();
    }
});

copy.disabled = false;
copy.addEventListener("click", async () => {
    const feedback = root.querySelector("#badge-copy-status");
    try {
        await navigator.clipboard.writeText(caption.value);
        feedback.textContent =
            "Caption copied. Paste it into your post and attach the downloaded image.";
    } catch {
        caption.focus();
        caption.select();
        feedback.textContent =
            "Copy isn't available here. The caption is selected so you can copy it manually.";
    }
});

if (ctx) {
    draw();
    try {
        [logo, background] = await Promise.all([
            loadImage(event.logo),
            loadImage(event.background),
        ]);
        assetsReady = true;
        controls.disabled = false;
        draw();
    } catch {
        status.textContent =
            "The artwork could not be loaded. Please reload this page to try again.";
    }
} else {
    status.textContent =
        "Your browser doesn't support the image generator. Please try a newer browser.";
}
