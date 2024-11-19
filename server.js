const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './upload';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Serve static files
app.use(express.static('public'));
app.use('/upload', express.static('upload'));

// Message storage
const messageFile = 'messages.txt';

// Initialize message file if it doesn't exist
if (!fs.existsSync(messageFile)) {
    fs.writeFileSync(messageFile, '');
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected');

    // Load message history
    const history = fs.readFileSync(messageFile, 'utf8')
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    socket.emit('load_history', history);

    socket.on('message', (data) => {
        const messageData = {
            id: Date.now(),
            user: data.user,
            message: data.message,
            timestamp: new Date().toISOString(),
            type: 'text'
        };
        
        // Save message to file
        fs.appendFileSync(messageFile, JSON.stringify(messageData) + '\n');
        
        // Broadcast to all clients
        io.emit('message', messageData);
    });

    socket.on('image_message', (data) => {
        const messageData = {
            id: Date.now(),
            user: data.user,
            imageUrl: data.imageUrl,
            timestamp: new Date().toISOString(),
            type: 'image'
        };
        
        // Save message to file
        fs.appendFileSync(messageFile, JSON.stringify(messageData) + '\n');
        
        // Broadcast to all clients
        io.emit('message', messageData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// File upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        res.json({
            success: true,
            imageUrl: `/upload/${req.file.filename}`
        });
    } else {
        res.status(400).json({ success: false });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});