const sni = require("sni");
const net = require("net");
const b32 = require("hi-base32");
const DHT = require("@hyperswarm/dht");
const pump = require('pump')
const node = new DHT({});

const http = require('http');
const httpProxy = require('http-proxy');

let mod = 0;
const tunnels = {};
const agent = new http.Agent(
  {
    maxSockets: Number.MAX_VALUE,
    keepAlive: true,
    keepAliveMsecs: 720000,
    timeout: 360000
  }
);
var proxy = httpProxy.createProxyServer({
  ws: true,
  agent: agent,
  timeout: 360000
});
const doServer = async function (req, res) {
        console.log(req.headers);
  if(!req.headers.host) return;
  const split = req.headers.host.split('.');
  const publicKey = await getKey(split[split.length-3]);
  if (!tunnels[publicKey]) {
    const port = 1337 + ((mod++) % 1000);
    try {
        var server = net.createServer(function (local) {
          const socket = node.connect(publicKey);
          socket.write('http');
          pump(local, socket, local);
        });
        server.listen(port, "127.0.0.1");
        tunnels[publicKey] = port;
        target = 'http://127.0.0.1:' + port;
      } catch(e) {
        console.trace(e);
        console.error(e);
      }
  } else {
    target = 'http://127.0.0.1:' + tunnels[publicKey]
  }
  proxy.web(req, res, {
    target
  }, function (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Cannot reach node ' + e.message);
  });

}
var server = http.createServer(doServer);
server.listen(80);
const getKey = (name)=>{
  let publicKey;
  let decoded = '';
  try {decoded = b32.decode.asBytes(name.toUpperCase())} catch (e) {
          console.error(e)
  }
  if (decoded.length == 32) publicKey = Buffer.from(decoded);
  return publicKey;
}

net.createServer(function (local) {
  local.once("data", async function (data) {
    const server = sni(data);
    if (server) {
      const split = server.split('.');
      if (split[split.length - 3]) {
        let domain = await getKey(split[split.length - 3], 'mumbai');
        console.log(domain.toString('hex'));
        if (!domain) {
          return;
        }
        console.log({domain});
        const socket = node.connect(domain);
        socket.write('https');
        socket.write(data);
        pump(local, socket, local);
      }
    }
  });
}).listen(443);

const validateSubdomain = (subdomain) => {
  const MIN_LENGTH = 1;
  const MAX_LENGTH = 63;
  const ALPHA_NUMERIC_REGEX = /^[a-z][a-z-]*[a-z0-9]*$/;
  const START_END_HYPHEN_REGEX = /A[^-].*[^-]z/i;
  const reservedNames = [
    "www",
    "ftp",
    "mail",
    "pop",
    "smtp",
    "admin",
    "ssl",
    "sftp",
    "domain"
  ];
  //if is reserved...
  if (reservedNames.includes(subdomain))
    throw new Error("cannot be a reserved name");

  //if is too small or too big...
  if (subdomain.length < MIN_LENGTH || subdomain.length > MAX_LENGTH)
    throw new Error(
      `must have between ${MIN_LENGTH} and ${MAX_LENGTH} characters`
    );

  //if subdomain is started/ended with hyphen or is not alpha numeric
  if (!ALPHA_NUMERIC_REGEX.test(subdomain) || START_END_HYPHEN_REGEX.test(subdomain))
    throw new Error(
      subdomain.indexOf("-") === 0 ||
        subdomain.indexOf("-") === subdomain.length - 1
        ? "cannot start or end with a hyphen"
        : "must be alphanumeric (or hyphen)"
    );

  return true;
};
