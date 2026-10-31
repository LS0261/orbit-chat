const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' })); // Permitir avatares e imágenes en base64 grandes

io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado:', socket.id);

    socket.on('chat_message', (data) => {
        // Reenvía el mensaje con datos completos (incluyendo pfp y tipo de mensaje) a todos
        io.emit('chat_message', {
            id: socket.id,
            username: data.username || 'Anónimo',
            pfp: data.pfp || 'https://i.imgur.com/6VBx3io.png',
            text: data.text,
            media: data.media || null,
            mediaType: data.mediaType || null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
