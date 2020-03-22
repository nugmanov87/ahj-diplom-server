const http = require('http');
const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const koaBody = require('koa-body');
const koaStatic = require('koa-static');
const fs = require('fs');
const uuid = require('uuid');
const WS = require('ws');

const fetch = require('node-fetch');

const app = new Koa();

const public = path.join(__dirname, '/public')
app.use(koaStatic(public));

// CORS
app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*', };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }

    ctx.response.status = 204;
  }
});


app.use(koaBody({
  text: true,
  urlencoded: true,
  multipart: true,
  json: true,
}));

const router = new Router();
const server = http.createServer(app.callback())
const wsServer = new WS.Server({ server });

const arrMessges = [];

let initMsg = false;

router.get('/initmsg', async (ctx, next) => {
  if (!initMsg) {
    initMsg = true;
    const resp = await fetch('https://ahj-diplom-server.herokuapp.com');
    const body = await resp.text();
    const arrInitMsg = JSON.parse(body);
    arrMessges.push(...arrInitMsg);
    ctx.response.body = arrMessges[0];
  }
  ctx.response.body = 'ok';
});

router.get('/allmsg', async (ctx, next) => {
  console.log('get index');
  ctx.response.body = arrMessges;
});

router.get('/msg/:numb', async (ctx, next) => {
  console.log('get numb', ctx.params.numb);
  const endArr = arrMessges.length - ctx.params.numb;
  const startArr = (endArr - 10) < 0 ? 0 : (endArr - 10);
  const returnArr = arrMessges.slice(startArr, endArr).reverse();
  ctx.response.body = returnArr;
});

router.post('/favorits', async (ctx, next) => {
  const msgOb = JSON.parse(ctx.request.body);
  const itemIndex = arrMessges.findIndex((item) => JSON.parse(item).id === msgOb.id);
  arrMessges[itemIndex].favorit = msgOb.value;
  const obj = {
    type: 'change-favorit',
    id: msgOb.id,
    value: msgOb.value,
  };
  ctx.response.status = 204
});

wsServer.on('connection', (ws, req) => {
  console.log('connection');
  ws.on('message', (msg) => {
    arrMessges.push(msg);

    [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(msg));
  });

  ws.on('close', (msg) => {
    console.log('close');
    [...wsServer.clients]

    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(JSON.stringify({type: 'del user'})));
    ws.close();
  });

  [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(JSON.stringify({type: 'add user'})));

});

app.use(router.routes()).use(router.allowedMethods());
const port = process.env.PORT || 7070;
server.listen(port);
