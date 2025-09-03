#!/bin/bash
# Quick Docker status and management for Clara Voice Lab

echo "🐳 Clara Voice Lab Docker Status"
echo "================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

echo "✅ Docker is running"
echo

# Show containers
echo "📦 Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=clara"

echo
echo "💾 Volumes:"
docker volume ls --format "table {{.Name}}\t{{.Driver}}" --filter "name=clara"

echo
echo "🌐 Networks:"
docker network ls --format "table {{.Name}}\t{{.Driver}}" --filter "name=clara"

echo
echo "📊 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" --filter "name=clara" 2>/dev/null || echo "No running containers"

echo
echo "🔗 Access Points:"
echo "   Main App: http://localhost:8080"
echo "   API Docs: http://localhost:8080/api/docs"
echo "   Frontend: http://localhost:3000 (direct)"
echo "   Backend:  http://localhost:8000 (direct)"

echo
echo "⚡ Quick Commands:"
echo "   Stop:     docker-compose down"
echo "   Logs:     docker-compose logs -f"
echo "   Shell:    docker-compose exec clara-voice-lab bash"
echo "   Rebuild:  docker-compose up --build"
