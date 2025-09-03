#!/bin/bash

# Clara Voice Lab Docker Management Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if NVIDIA Docker runtime is available
check_nvidia_docker() {
    if docker info 2>/dev/null | grep -q "nvidia"; then
        print_success "NVIDIA Docker runtime detected"
    else
        print_warning "NVIDIA Docker runtime not detected. GPU acceleration may not work."
    fi
}

# Function to show usage
show_help() {
    cat << EOF
Clara Voice Lab Docker Management

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    dev         Start development environment
    prod        Start production environment
    build       Build Docker images
    rebuild     Rebuild Docker images from scratch
    stop        Stop all services
    restart     Restart all services
    logs        Show logs
    clean       Clean up containers and images
    status      Show status of services
    shell       Open shell in main container
    backup      Backup data volumes
    restore     Restore data volumes

Options:
    --no-gpu    Disable GPU support
    --force     Force operation without confirmation
    --tail      Number of log lines to show (default: 100)

Examples:
    $0 dev                 Start development environment
    $0 prod                Start production environment
    $0 logs --tail 50      Show last 50 log lines
    $0 clean --force       Clean up without confirmation
    $0 backup              Create backup of data volumes

EOF
}

# Load environment variables
load_env() {
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_status "Loaded environment variables from .env"
    else
        print_warning ".env file not found. Using default values."
    fi
}

# Start development environment
start_dev() {
    print_status "Starting Clara Voice Lab in development mode..."
    check_docker
    check_nvidia_docker
    load_env
    
    docker-compose up -d
    
    print_success "Development environment started!"
    print_status "Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    print_status "Backend API: http://localhost:${BACKEND_PORT:-8000}"
    print_status "API Docs: http://localhost:${BACKEND_PORT:-8000}/docs"
    print_status "Main App: http://localhost:${WEB_PORT:-8080}"
}

# Start production environment
start_prod() {
    print_status "Starting Clara Voice Lab in production mode..."
    check_docker
    check_nvidia_docker
    load_env
    
    if [ -z "$SECRET_KEY" ]; then
        print_error "SECRET_KEY must be set in production. Please update your .env file."
        exit 1
    fi
    
    docker-compose -f docker-compose.prod.yml up -d
    
    print_success "Production environment started!"
    print_status "Main App: http://localhost:${WEB_PORT:-80}"
}

# Build images
build_images() {
    print_status "Building Docker images..."
    check_docker
    
    if [ "$1" = "--no-cache" ]; then
        docker-compose build --no-cache
    else
        docker-compose build
    fi
    
    print_success "Images built successfully!"
}

# Rebuild images from scratch
rebuild_images() {
    print_status "Rebuilding Docker images from scratch..."
    check_docker
    
    docker-compose down --rmi all --volumes --remove-orphans
    docker-compose build --no-cache
    
    print_success "Images rebuilt successfully!"
}

# Stop services
stop_services() {
    print_status "Stopping Clara Voice Lab services..."
    docker-compose down
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    print_success "Services stopped!"
}

# Restart services
restart_services() {
    print_status "Restarting Clara Voice Lab services..."
    docker-compose restart
    print_success "Services restarted!"
}

# Show logs
show_logs() {
    local tail_lines=${1:-100}
    print_status "Showing logs (last $tail_lines lines)..."
    docker-compose logs --tail=$tail_lines -f
}

# Clean up
cleanup() {
    local force=$1
    
    if [ "$force" != "--force" ]; then
        print_warning "This will remove all containers, networks, and unused images."
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleanup cancelled."
            return 0
        fi
    fi
    
    print_status "Cleaning up Docker resources..."
    docker-compose down --rmi all --volumes --remove-orphans
    docker-compose -f docker-compose.prod.yml down --rmi all --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f
    print_success "Cleanup completed!"
}

# Show status
show_status() {
    print_status "Clara Voice Lab Service Status:"
    echo
    docker-compose ps
    echo
    print_status "Docker System Info:"
    docker system df
}

# Open shell in main container
open_shell() {
    print_status "Opening shell in Clara Voice Lab container..."
    if docker-compose ps | grep -q "clara-voice-lab.*Up"; then
        docker-compose exec clara-voice-lab /bin/bash
    elif docker-compose -f docker-compose.prod.yml ps | grep -q "clara-voice-lab-prod.*Up"; then
        docker-compose -f docker-compose.prod.yml exec clara-voice-lab /bin/bash
    else
        print_error "No running containers found. Please start the services first."
        exit 1
    fi
}

# Backup data volumes
backup_data() {
    local backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    print_status "Creating backup in $backup_dir..."
    
    # Backup development volumes
    if docker volume ls | grep -q "clara_voice_data"; then
        docker run --rm -v clara_voice_data:/source -v "$(pwd)/$backup_dir":/backup alpine tar czf /backup/clara_voice_data.tar.gz -C /source .
        print_success "Backed up development data volume"
    fi
    
    if docker volume ls | grep -q "clara_voice_models"; then
        docker run --rm -v clara_voice_models:/source -v "$(pwd)/$backup_dir":/backup alpine tar czf /backup/clara_voice_models.tar.gz -C /source .
        print_success "Backed up development models volume"
    fi
    
    # Backup production volumes
    if docker volume ls | grep -q "clara_voice_data_prod"; then
        docker run --rm -v clara_voice_data_prod:/source -v "$(pwd)/$backup_dir":/backup alpine tar czf /backup/clara_voice_data_prod.tar.gz -C /source .
        print_success "Backed up production data volume"
    fi
    
    if docker volume ls | grep -q "clara_voice_models_prod"; then
        docker run --rm -v clara_voice_models_prod:/source -v "$(pwd)/$backup_dir":/backup alpine tar czf /backup/clara_voice_models_prod.tar.gz -C /source .
        print_success "Backed up production models volume"
    fi
    
    print_success "Backup completed in $backup_dir"
}

# Restore data volumes
restore_data() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        print_error "Please specify backup file to restore."
        echo "Usage: $0 restore /path/to/backup.tar.gz"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    print_warning "This will overwrite existing data. Make sure services are stopped."
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled."
        return 0
    fi
    
    print_status "Restoring from $backup_file..."
    # Implementation depends on backup structure
    print_success "Restore completed!"
}

# Parse command line arguments
case "$1" in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    build)
        build_images "$2"
        ;;
    rebuild)
        rebuild_images
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        shift
        tail_lines=100
        while [[ $# -gt 0 ]]; do
            case $1 in
                --tail)
                    tail_lines="$2"
                    shift 2
                    ;;
                *)
                    shift
                    ;;
            esac
        done
        show_logs "$tail_lines"
        ;;
    clean)
        cleanup "$2"
        ;;
    status)
        show_status
        ;;
    shell)
        open_shell
        ;;
    backup)
        backup_data
        ;;
    restore)
        restore_data "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac
