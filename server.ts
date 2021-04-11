import {
    Application,
    isHttpError,
    Status,
} from "https://deno.land/x/oak/mod.ts";

const app = new Application();
const port = 8000;

app.addEventListener("listen", ({ hostname, port, secure }) => {
    console.log(`Listening on: ${secure ? "https://" : "http://"}${
        hostname ?? "localhost"
    }:${port}`);
});

// Logger
app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// Timing
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
    ctx.response.headers.set("Access-Control-Allow-Origin", "*");
});

// Hello World!
app.use(async (context, next) => {
    let { request, response } = context;
    let { pathname } = request.url;
    const location = `https://unpkg.com${pathname}?module`;
    let res = await fetch(location);
    const url: string = res.url;
    let newPath = new URL(url).pathname;
    if (newPath !== pathname) { response.redirect(newPath) } else {
        response.type = 'js';
        response.body = await res.text().then(script => replaceURLS("localhost:8000", url, script))
    }
    await next();
});

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        if (isHttpError(err)) {
            switch (err.status) {
                case Status.NotFound:
                    // handle NotFound
                    break;
                default:
                // handle other statuses
            }
        } else {
          // rethrow if you can't handle the error
          throw err;
        }
    }
});

await app.listen({ port });

async function replaceURLS(host: string, base: string, string: string) {
    let { origin, hostname } = new URL(base);
    return Promise.all([...new Set([...string.matchAll(/"((https:\/\/unpkg\.com)?([^\?\n]*)\?module)"/g)]
        .map(m => m[1]))]
        .map(url => fetch(new URL(url, base).href).then(response => {
            return [
                url,
                response.url
                    .split('?module').join('')
                    .split(hostname).join(host)
                    .split('https').join('http')
            ]
        }))
    )
    .then(urls => urls.reduce((string, [oldPath, newPath]) => string.split(oldPath).join(newPath), string))
}