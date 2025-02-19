const wsProtocol = document.location.protocol == 'https:' ? 'wss:' : 'ws:';

let LinkSet = [];
const MarkerContent = document.getElementById("media");
let term = null;

function OSCHandler(payload) {
    if (payload == "") {
        LinkSet = [];
        for (let it of MarkerContent.children) {
            it.style.display = 'none';
        }
        return true;
    }
    let parts = payload.split(';');
    if (parts.length >= 1) {
        let type = parts[0];
        switch (type) {
            case 'link':
                {
                    let len = parseInt(parts[1]);
                    let link = parts.slice(2).join(';');
                    let x = term.buffer.active.cursorX;
                    let y = term.buffer.active.baseY + term.buffer.active.cursorY;
                    LinkSet.push({
                        x, y, len, link,
                    });
                }
                break;
            case 'media':
                {
                    let id = parts[1];
                    let text = atob(parts[2]);
                    let lines = parseInt(parts[3]);
                    let url = parts.slice(4).join(';');
                    let y = term.buffer.active.baseY + term.buffer.active.cursorY;
                    let CellHeight = term._core._renderService.dimensions.actualCellHeight;

                    id = 'media-content-' + id;

                    let media = document.getElementById(id);

                    if (media == null) {
                        media = document.createElement("div");
                        media.style.height = `${CellHeight * lines}px`;
                        media.style.position = 'absolute';
                        media.style.left = `32px`;
                        media.id = id;
                        MarkerContent.appendChild(media);

                        fetch(url, { method: 'HEAD' }).then((res) => {
                            let contentType = res.headers.get('content-type');
                            let mediaType = contentType.split('/')[0];

                            let media = document.getElementById(id);
                            if (media == null) {
                                return;
                            }
                            if (mediaType == 'image') {
                                media.innerHTML = `<image src="${url}" alt="${text}" height="${CellHeight * lines}">`;
                                media.onclick = function () {
                                    window.open(url, "_blank");
                                }
                            } else if (mediaType == 'video') {
                                media.innerHTML = `<video controls src="${url}" alt="${text}" height="${CellHeight * lines}">`;
                            }
                        });
                    }
                    media.style.top = `${CellHeight * (y + 1)}px`;
                    media.style.display = 'block';
                }
                break;
            case 'cleanMedia':
                MarkerContent.innerHTML = "";
                break;
        }
    }
    return true;
}

const LinkProvider = {
    provideLinks(y, callback) {
        let links = [];
        for (let link of LinkSet) {
            if (link.y == y - 1) {
                links.push({
                    range: {
                        start: { x: link.x + 1, y },
                        end: { x: link.x + link.len, y },
                    },
                    text: link.link,
                    activate() {
                        window.open(link.link, "_blank");
                    }
                });
            }
        }
        if (links.length > 0) {
            callback(links);
        } else {
            callback(undefined);
        }
    }
};

function RefreshScroll() {
    let viewport = document.querySelector('.xterm-scroll-area');
    const CellHeight = term._core._renderService.dimensions.actualCellHeight;
    MarkerContent.parentElement.scrollTop = Math.round(viewport.parentElement.scrollTop / CellHeight) * CellHeight;
    MarkerContent.style.height = viewport.style.height;
}

function start() {
    term = new Terminal({
        fontFamily: globalThis.RenderFonts.join(', ') + ", Fira Code, Inconsolata, JetBrains Mono, Consolas, DejaVu Sans Mono, Everson Mono, FreeMono, Menlo, Terminal, monospace, Apple Symbols",
        cursorStyle: "block",
        fontSize: 14,
        theme: { background: '#000000' }
    });

    term.options.allowProposedApi = true;
    const fitAddon = new FitAddon.FitAddon();
    const uincode11Addon = new Unicode11Addon.Unicode11Addon();
    const webglAddon = new WebglAddon.WebglAddon();

    var searchAddon = new SearchAddon.SearchAddon();
    var searchbarAddon = new SearchBarAddon.SearchBarAddon({
        searchAddon
    });
    term.loadAddon(searchAddon);
    term.loadAddon(searchbarAddon);

    // customize as needed (showing addon defaults)
    // initialization
    term.loadAddon(new ImageAddon.ImageAddon({
        enableSizeReports: true,    // whether to enable CSI t reports (see below)
        pixelLimit: 16777216,       // max. pixel size of a single image
        sixelSupport: true,         // enable sixel support
        sixelScrolling: true,       // whether to scroll on image output
        sixelPaletteLimit: 256,     // initial sixel palette size
        sixelSizeLimit: 25000000,   // size limit of a single sixel sequence
        storageLimit: 128,          // FIFO storage limit in MB
        showPlaceholder: true,      // whether to show a placeholder for evicted images
        iipSupport: true,           // enable iTerm IIP support
        iipSizeLimit: 20000000      // size limit of a single IIP sequence
    }));

    // Binding Shortcuts
    document.addEventListener('keydown', function (event) {
        // show searchbar
        if (event.ctrlKey && event.shiftKey && event.key === 'F') {
            searchbarAddon.show();
            event.preventDefault()
        }

        // hide searchbar
        if (event.key === 'Escape') {
            searchbarAddon.hidden();
            term.focus();
            event.preventDefault()
        }

        // copy selection
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
            navigator.clipboard.writeText(term.getSelection());
            event.preventDefault()
        }
    });

    term.parser.registerOscHandler(9999, OSCHandler);
    term.registerLinkProvider(LinkProvider);

    const socket = new WebSocket(`${wsProtocol}//${document.location.host}/ws`);
    // Connection opened
    socket.addEventListener('open', function (event) {
        term.open(document.getElementById('terminal'));
        term.focus();
        document.querySelector(".xterm-screen").insertBefore(MarkerContent.parentElement, document.querySelector(".xterm-decoration-container"));
        let viewport = document.querySelector('.xterm-scroll-area');
        viewport.parentElement.addEventListener("scroll", RefreshScroll);
        term.loadAddon(fitAddon);
        term.loadAddon(uincode11Addon);
        term.loadAddon(webglAddon);
        term.loadAddon(new WebLinksAddon.WebLinksAddon());
        // term.loadAddon(new CanvasAddon.CanvasAddon());
        // term.loadAddon(new LigaturesAddon.LigaturesAddon());

        fitAddon.fit();
    });

    socket.addEventListener('close', function () {
        console.log("connection closed");
    });

    // Listen for messages
    socket.addEventListener('message', async function (event) {
        term.write(new Uint8Array(await event.data.arrayBuffer()));
    });

    const encoder = new TextEncoder();

    term.onData((chunk) => {
        let encoded = encoder.encode(chunk);
        let buffer = new Uint8Array(4 + encoded.length);
        buffer.set(new Uint32Array([1]), 0);
        buffer.set(encoded, 4);
        socket.send(buffer);
    });

    term.onBinary((chunk) => {
        let buffer = new Uint8Array(4 + chunk.length);
        buffer.set(new Uint32Array([1]), 0);
        for (let i = 0; i < chunk.length; i++) {
            buffer[i + 4] = chunk.charCodeAt(i);
        }
        socket.send(buffer);
    });

    term.onResize((data) => {
        let encoded = encoder.encode(JSON.stringify(data));
        let buffer = new Uint8Array(4 + encoded.length);
        buffer.set(new Uint32Array([2]), 0);
        buffer.set(encoded, 4);
        socket.send(buffer);
    });

    window.addEventListener('resize', function () {
        fitAddon.fit();
    });

    term.onRender(RefreshScroll);

    // printf '\033]0;my title\007'
    term.onTitleChange(function (title) {
        document.title = title;
    });

    // term.onSelectionChange(function (msg){
    //     console.log(term.getSelection());
    // })
}

const params = new Map((window.location.search || "?").slice(1).split('&').filter(it => it != '').map((it) => it.split('=').map(it => decodeURIComponent(it))));

async function loadTheme(theme) {
    let themeFile = globalThis.ThemeList[theme];
    if (themeFile !== undefined) {
        let module = await import(themeFile);
        if (module.init instanceof Function) {
            await module.init(params);
        }
    }
}

globalThis.loadTheme = loadTheme;

async function prepareTheme() {
    try {
        let res = await fetch("/themes.json");
        let desc = await res.json();
        globalThis.ThemeList = desc;
        let theme = desc["."];
        if (params.has("theme")) {
            theme = params.get("theme");
        }
        await loadTheme(theme);
    } catch (err) { }
}

async function loadTermFont(fontFamily, descList) {
    for (let desc of descList) {
        let font = new FontFace(fontFamily, `url(${desc.url})`, desc.desc);
        await font.load();
        document.fonts.add(font);
    }
    globalThis.RenderFonts.push(JSON.stringify(fontFamily));
}

globalThis.loadTermFont = loadTermFont;
globalThis.RenderFonts = [];

window.addEventListener('load', async function () {
    await loadTermFont("PureNerdFont", [{ url: "/fonts/PureNerdFont.woff2" }]);
    await prepareTheme();
    // if (globalThis.RenderFonts.length == 1) {
    //     await loadTermFont("Fira Code", [
    //         { url: "https://cdn.jsdelivr.net/npm/firacode@6.2.0/distr/woff2/FiraCode-Regular.woff2", desc: { stretch: 'normal', style: 'normal', weight: '400' } },
    //         { url: "https://cdn.jsdelivr.net/npm/firacode@6.2.0/distr/woff2/FiraCode-Bold.woff2", desc: { stretch: 'normal', style: 'normal', weight: '700' } },
    //     ]);
    // }
    start();
});