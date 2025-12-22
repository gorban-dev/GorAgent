#!/bin/bash

# Скрипт для запуска всех MCP серверов

echo "🚀 Запуск MCP серверов..."
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    exit 1
fi

# Создание директорий
mkdir -p mcp-data
mkdir -p mcp-output

echo "📁 Директории созданы"
echo ""

# Запуск серверов в фоновом режиме
echo "🌤️  Запуск Weather MCP (порт 8080)..."
echo "   (Ваш существующий сервер должен быть запущен отдельно)"
echo ""

echo "✨ Запуск Formatter MCP (порт 8082)..."
node mcp-server-formatter.js > logs/formatter.log 2>&1 &
FORMATTER_PID=$!
echo "   PID: $FORMATTER_PID"
echo ""

echo "💾 Запуск FileSaver MCP (порт 8081)..."
node mcp-server-filesaver.js > logs/filesaver.log 2>&1 &
FILESAVER_PID=$!
echo "   PID: $FILESAVER_PID"
echo ""

echo "📱 Запуск Android Emulator MCP (порт 8083)..."
node mcp-server-android.js > logs/android.log 2>&1 &
ANDROID_PID=$!
echo "   PID: $ANDROID_PID"
echo ""

# Ожидание запуска
echo "⏳ Ожидание запуска серверов..."
sleep 3

# Проверка доступности
echo ""
echo "🔍 Проверка доступности серверов..."

check_server() {
    if curl -s -f "$1/health" > /dev/null; then
        echo "✅ $2 доступен ($1)"
        return 0
    else
        echo "❌ $2 недоступен ($1)"
        return 1
    fi
}

# Проверка Formatter
check_server "http://localhost:8082" "Formatter MCP"

# Проверка FileSaver
check_server "http://localhost:8081" "FileSaver MCP"

# Проверка Android
check_server "http://localhost:8083" "Android Emulator MCP"

echo ""
echo "📝 PID процессов сохранены в:"
echo "   Formatter: $FORMATTER_PID"
echo "   FileSaver: $FILESAVER_PID"
echo "   Android: $ANDROID_PID"
echo ""
echo "⚠️  Weather MCP (порт 8080) должен быть запущен отдельно"
echo ""
echo "🎉 MCP серверы запущены!"
echo "🌐 Откройте веб-интерфейс: http://localhost:3000/mcp-multi-demo"
echo ""
echo "Для остановки серверов используйте:"
echo "   kill $FORMATTER_PID $FILESAVER_PID $ANDROID_PID"
echo ""
echo "Логи серверов:"
echo "   tail -f logs/formatter.log"
echo "   tail -f logs/filesaver.log"
echo "   tail -f logs/android.log"



