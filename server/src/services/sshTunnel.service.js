import fs from "node:fs";
import net from "node:net";
import { Client as SshClient } from "ssh2";
import { env } from "../config/env.js";

/** @type {import("ssh2").Client | null} */
let sshClient = null;
/** @type {import("node:net").Server | null} */
let localServer = null;
/** @type {Promise<void> | null} */
let ensurePromise = null;

function readPrivateKey() {
  const pkeyPath = String(env.SSH_PKEY || "").trim();
  if (!pkeyPath) {
    throw new Error("SSH_PKEY belum di-set.");
  }
  if (!fs.existsSync(pkeyPath)) {
    throw new Error(`SSH_PKEY file tidak ditemukan: ${pkeyPath}`);
  }
  return fs.readFileSync(pkeyPath);
}

/**
 * Pastikan local forward aktif: PG_SSH_HOST:PG_SSH_LOCAL_PORT → PG_HOST:PG_PORT via jump host.
 * Singleton; reconnect otomatis jika putus.
 */
export async function ensurePgSshTunnel() {
  if (localServer?.listening && sshClient) {
    return {
      host: String(env.PG_SSH_HOST || "127.0.0.1"),
      port: Number(env.PG_SSH_LOCAL_PORT) || 5433,
    };
  }
  if (ensurePromise) {
    await ensurePromise;
    return {
      host: String(env.PG_SSH_HOST || "127.0.0.1"),
      port: Number(env.PG_SSH_LOCAL_PORT) || 5433,
    };
  }

  ensurePromise = (async () => {
    await closePgSshTunnel();

    const sshHost = String(env.SSH_HOST || "").trim();
    const sshUser = String(env.SSH_USER || "").trim();
    const sshPort = Number(env.SSH_PORT) || 22;
    const remoteHost = String(env.PG_HOST || "").trim();
    const remotePort = Number(env.PG_PORT) || 5432;
    const localHost = String(env.PG_SSH_HOST || "127.0.0.1").trim() || "127.0.0.1";
    const localPort = Number(env.PG_SSH_LOCAL_PORT) || 5433;

    if (!sshHost || !sshUser || !remoteHost) {
      throw new Error("Konfigurasi SSH/PG tidak lengkap.");
    }

    const privateKey = readPrivateKey();

    const conn = new SshClient();
    await new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (err) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      const cleanup = () => {
        conn.removeListener("ready", onReady);
        conn.removeListener("error", onError);
      };
      conn.once("ready", onReady);
      conn.once("error", onError);
      conn.connect({
        host: sshHost,
        port: sshPort,
        username: sshUser,
        privateKey,
        readyTimeout: 20000,
        keepaliveInterval: 15000,
      });
    });

    conn.on("error", () => {
      sshClient = null;
    });
    conn.on("close", () => {
      sshClient = null;
      if (localServer) {
        try {
          localServer.close();
        } catch {
          /* ignore */
        }
        localServer = null;
      }
    });

    sshClient = conn;

    const server = net.createServer((socket) => {
      conn.forwardOut(socket.remoteAddress || "127.0.0.1", socket.remotePort || 0, remoteHost, remotePort, (err, stream) => {
        if (err) {
          socket.destroy();
          return;
        }
        socket.pipe(stream);
        stream.pipe(socket);
        socket.on("error", () => {
          try {
            stream.end();
          } catch {
            /* ignore */
          }
        });
        stream.on("error", () => {
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
        });
      });
    });

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(localPort, localHost, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });

    localServer = server;
  })();

  try {
    await ensurePromise;
  } finally {
    ensurePromise = null;
  }

  return {
    host: String(env.PG_SSH_HOST || "127.0.0.1"),
    port: Number(env.PG_SSH_LOCAL_PORT) || 5433,
  };
}

export async function closePgSshTunnel() {
  if (localServer) {
    await new Promise((resolve) => {
      localServer.close(() => resolve());
    }).catch(() => {});
    localServer = null;
  }
  if (sshClient) {
    try {
      sshClient.end();
    } catch {
      /* ignore */
    }
    sshClient = null;
  }
}
