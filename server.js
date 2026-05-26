const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Хранилище данных
let onlinePlayers = new Map();
let allRegisteredPlayers = new Map();
let matchmakingQueue = [];
let activeGames = [];

// HTML страница прямо в коде
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Brawl Stars - Онлайн</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
            color: #fff;
            overflow-x: hidden;
        }

        .login-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }

        .login-box {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            padding: 50px;
            border-radius: 30px;
            border: 3px solid #ffd700;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }

        .login-title {
            font-size: 48px;
            color: #ffd700;
            margin-bottom: 10px;
            text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
        }

        .login-subtitle {
            font-size: 18px;
            color: #fff;
            margin-bottom: 30px;
        }

        .login-input {
            width: 100%;
            padding: 15px 20px;
            font-size: 18px;
            border: 3px solid #ffd700;
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
            border-radius: 25px;
            margin-bottom: 20px;
            outline: none;
        }

        .login-input::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }

        .login-btn {
            width: 100%;
            padding: 15px;
            font-size: 20px;
            font-weight: bold;
            background: #ffd700;
            color: #1a1a2e;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .login-btn:hover {
            transform: scale(1.05);
        }

        .hidden {
            display: none !important;
        }

        .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 15px 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .header-container {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .user-name {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 10px 20px;
            border-radius: 20px;
            font-weight: bold;
        }

        .user-trophies {
            background: rgba(255, 215, 0, 0.2);
            padding: 10px 20px;
            border-radius: 20px;
            border: 2px solid #ffd700;
            font-weight: bold;
        }

        .user-stats {
            font-size: 14px;
            color: #fff;
        }

        .logout-btn {
            background: #ff4444;
            padding: 10px 20px;
            border-radius: 20px;
            border: none;
            color: #fff;
            font-weight: bold;
            cursor: pointer;
        }

        .main-menu {
            min-height: 100vh;
            padding: 40px 20px;
        }

        .menu-grid {
            max-width: 1200px;
            margin: 40px auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
        }

        .menu-card {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
            border: 3px solid #ffd700;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .menu-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px 
