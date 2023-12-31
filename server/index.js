import logger from "morgan";
import express from "express";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

import { Server } from "socket.io";
import { createServer } from "node:http";

dotenv.config();
const port = process.env.PORT ?? 4000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {},
})

const db = createClient({
    url: 'libsql://loved-bloom-geovamena.turso.io',
    authToken: process.env.DB_TOKEN,
});

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL
    )
`)

io.on("connection", async (socket) => {
    console.log("a user connected");

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });

    socket.on("chat message", async (msg) => {
        let result
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content) VALUES (:msg)',
                args: {
                    msg
                },
            });
        } catch (e) {
            console.error(e);
            return;
        }
        io.emit("chat message", msg, result.lastInsertRowid.toString());
    });

    if (!socket.recovered) {
        try {
            const result = await db.execute({
                sql: 'SELECT id, content FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0],
            });

            result.rows.forEach(row => {
                socket.emit("chat message", row.content, row.id.toString());
            });
        
        } catch (e) {
            console.error(e);
            return;
        }
    }
    
});

app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})